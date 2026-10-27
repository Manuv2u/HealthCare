"""AdminUserService — read-side aggregation and export for the admin customer console.

Builds the enriched user list (with per-user booking/spend/report aggregates), the
dashboard summary cards, and the full per-user detail payload. All aggregates are
computed with grouped subqueries joined in a single round-trip — never N+1 per row.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Sequence

from sqlalchemy import String, and_, cast, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingItem
from app.models.payment import Payment, Refund
from app.models.report import Report
from app.models.user import Session, User, UserAddress
from app.utils.timezone import to_local_str

# A session is considered "online" if it was last seen within this window. last_seen_at
# only advances on token refresh, so this is an approximation (documented follow-up:
# real-time presence via WebSocket/SSE).
ONLINE_THRESHOLD_MINUTES = 5

_SORTABLE = {
    "name": User.name,
    "email": User.email,
    "created_at": User.created_at,
    "last_login_at": User.last_login_at,
    "account_status": User.account_status,
    "login_count": User.login_count,
}
_PENDING_BOOKING_STATUSES = ("booked", "confirmed", "sample_collected", "processing")
_COMPLETED_BOOKING_STATUSES = ("completed", "report_ready")
_PENDING_REPORT_STATUSES = ("sample_collected", "processing")


class UserFilters:
    """Typed container for the admin user-list query parameters."""

    def __init__(
        self,
        *,
        q: str | None = None,
        role: str | None = None,
        account_status: Sequence[str] | None = None,
        is_online: bool | None = None,
        email_verified: bool | None = None,
        phone_verified: bool | None = None,
        city: Sequence[str] | None = None,
        state: Sequence[str] | None = None,
        pincode: str | None = None,
        collection_type: str | None = None,
        has_bookings: bool | None = None,
        report_status: str | None = None,
        registered_from: datetime | None = None,
        registered_to: datetime | None = None,
        last_login_from: datetime | None = None,
        last_login_to: datetime | None = None,
        last_active_from: datetime | None = None,
        last_active_to: datetime | None = None,
        min_spent: float | None = None,
        max_spent: float | None = None,
    ) -> None:
        self.q = q
        self.role = role
        self.account_status = list(account_status) if account_status else None
        self.is_online = is_online
        self.email_verified = email_verified
        self.phone_verified = phone_verified
        self.city = list(city) if city else None
        self.state = list(state) if state else None
        self.pincode = pincode
        self.collection_type = collection_type
        self.has_bookings = has_bookings
        self.report_status = report_status
        self.registered_from = registered_from
        self.registered_to = registered_to
        self.last_login_from = last_login_from
        self.last_login_to = last_login_to
        self.last_active_from = last_active_from
        self.last_active_to = last_active_to
        self.min_spent = min_spent
        self.max_spent = max_spent


class AdminUserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── shared aggregate subqueries ─────────────────────────────────────────────

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _booking_agg(self):
        return (
            select(
                Booking.user_id.label("user_id"),
                func.count().label("total_bookings"),
                func.count().filter(Booking.status.in_(_PENDING_BOOKING_STATUSES)).label("pending_bookings"),
                func.count().filter(Booking.status.in_(_COMPLETED_BOOKING_STATUSES)).label("completed_bookings"),
                func.count().filter(Booking.status == "cancelled").label("cancelled_bookings"),
                func.count().filter(Booking.collection_type == "home").label("home_count"),
                func.count().filter(Booking.collection_type == "lab").label("lab_count"),
            )
            .group_by(Booking.user_id)
            .subquery()
        )

    def _item_agg(self):
        return (
            select(
                Booking.user_id.label("user_id"),
                func.count().filter(BookingItem.item_type == "test").label("total_tests"),
                func.count().filter(BookingItem.item_type == "package").label("total_packages"),
            )
            .join(BookingItem, BookingItem.booking_id == Booking.id)
            .group_by(Booking.user_id)
            .subquery()
        )

    def _spend_agg(self):
        return (
            select(
                Booking.user_id.label("user_id"),
                func.coalesce(func.sum(Payment.amount), 0).label("total_spent"),
            )
            .join(Payment, Payment.booking_id == Booking.id)
            .where(Payment.status == "paid")
            .group_by(Booking.user_id)
            .subquery()
        )

    def _refund_agg(self):
        return (
            select(
                Booking.user_id.label("user_id"),
                func.coalesce(func.sum(Refund.amount), 0).label("refund_amount"),
            )
            .join(Payment, Payment.booking_id == Booking.id)
            .join(Refund, Refund.payment_id == Payment.id)
            .group_by(Booking.user_id)
            .subquery()
        )

    def _report_agg(self):
        return (
            select(
                Booking.user_id.label("user_id"),
                func.count(Report.id).label("completed_reports"),
            )
            .join(Report, Report.booking_id == Booking.id)
            .group_by(Booking.user_id)
            .subquery()
        )

    def _pending_report_agg(self):
        return (
            select(
                Booking.user_id.label("user_id"),
                func.count().label("pending_reports"),
            )
            .where(Booking.status.in_(_PENDING_REPORT_STATUSES))
            .group_by(Booking.user_id)
            .subquery()
        )

    def _session_agg(self):
        return (
            select(
                Session.user_id.label("user_id"),
                func.max(Session.last_seen_at).label("last_active"),
            )
            .where(Session.revoked_at.is_(None), Session.expires_at > self._now())
            .group_by(Session.user_id)
            .subquery()
        )

    def _address_agg(self):
        # DISTINCT ON (user_id) — prefer the default address, else the most recent.
        return (
            select(
                UserAddress.user_id.label("user_id"),
                UserAddress.city.label("city"),
                UserAddress.state.label("state"),
                UserAddress.pincode.label("pincode"),
            )
            .where(UserAddress.deleted_at.is_(None))
            .order_by(
                UserAddress.user_id,
                UserAddress.is_default.desc(),
                UserAddress.created_at.desc(),
            )
            .distinct(UserAddress.user_id)
            .subquery()
        )

    # ── list ────────────────────────────────────────────────────────────────────

    async def list_users(
        self,
        filters: UserFilters,
        *,
        sort: str = "created_at",
        order: str = "desc",
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict[str, Any]], int]:
        ba = self._booking_agg()
        ia = self._item_agg()
        sa = self._spend_agg()
        rep = self._report_agg()
        prep = self._pending_report_agg()
        sess = self._session_agg()
        addr = self._address_agg()

        online_cutoff = self._now() - timedelta(minutes=ONLINE_THRESHOLD_MINUTES)

        total_bookings = func.coalesce(ba.c.total_bookings, 0)
        total_spent = func.coalesce(sa.c.total_spent, 0)

        stmt = (
            select(
                User,
                total_bookings.label("total_bookings"),
                func.coalesce(ba.c.home_count, 0).label("home_count"),
                func.coalesce(ba.c.lab_count, 0).label("lab_count"),
                func.coalesce(ia.c.total_tests, 0).label("total_tests"),
                func.coalesce(ia.c.total_packages, 0).label("total_packages"),
                total_spent.label("total_spent"),
                func.coalesce(rep.c.completed_reports, 0).label("completed_reports"),
                func.coalesce(prep.c.pending_reports, 0).label("pending_reports"),
                sess.c.last_active.label("last_active"),
                addr.c.city.label("city"),
                addr.c.state.label("state"),
            )
            .outerjoin(ba, ba.c.user_id == User.id)
            .outerjoin(ia, ia.c.user_id == User.id)
            .outerjoin(sa, sa.c.user_id == User.id)
            .outerjoin(rep, rep.c.user_id == User.id)
            .outerjoin(prep, prep.c.user_id == User.id)
            .outerjoin(sess, sess.c.user_id == User.id)
            .outerjoin(addr, addr.c.user_id == User.id)
            .where(User.deleted_at.is_(None))
        )

        stmt = self._apply_filters(stmt, filters, ba, sa, rep, prep, sess, online_cutoff)

        # Total count over the filtered set.
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        # Sorting: whitelist real user columns, plus the aggregate expressions.
        sort_col = _SORTABLE.get(sort)
        if sort == "total_bookings":
            sort_col = total_bookings
        elif sort == "total_spent":
            sort_col = total_spent
        elif sort == "last_active":
            sort_col = sess.c.last_active
        if sort_col is None:
            sort_col = User.created_at
        direction = sort_col.desc() if order.lower() == "desc" else sort_col.asc()
        # Stable secondary ordering for deterministic pagination.
        stmt = stmt.order_by(direction, User.id).offset((page - 1) * page_size).limit(page_size)

        rows = (await self.db.execute(stmt)).all()
        return [self._row_to_dict(r, online_cutoff) for r in rows], total

    def _apply_filters(self, stmt, f: UserFilters, ba, sa, rep, prep, sess, online_cutoff):
        if f.role:
            stmt = stmt.where(User.role == f.role)
        if f.account_status:
            stmt = stmt.where(User.account_status.in_(f.account_status))
        if f.email_verified is not None:
            cond = User.email_verified_at.isnot(None) if f.email_verified else User.email_verified_at.is_(None)
            stmt = stmt.where(cond)
        if f.phone_verified is not None:
            cond = User.phone_verified_at.isnot(None) if f.phone_verified else User.phone_verified_at.is_(None)
            stmt = stmt.where(cond)
        if f.registered_from:
            stmt = stmt.where(User.created_at >= f.registered_from)
        if f.registered_to:
            stmt = stmt.where(User.created_at <= f.registered_to)
        if f.last_login_from:
            stmt = stmt.where(User.last_login_at >= f.last_login_from)
        if f.last_login_to:
            stmt = stmt.where(User.last_login_at <= f.last_login_to)
        if f.last_active_from:
            stmt = stmt.where(sess.c.last_active >= f.last_active_from)
        if f.last_active_to:
            stmt = stmt.where(sess.c.last_active <= f.last_active_to)
        if f.is_online is not None:
            if f.is_online:
                stmt = stmt.where(sess.c.last_active >= online_cutoff)
            else:
                stmt = stmt.where(or_(sess.c.last_active.is_(None), sess.c.last_active < online_cutoff))
        if f.min_spent is not None:
            stmt = stmt.where(func.coalesce(sa.c.total_spent, 0) >= f.min_spent)
        if f.max_spent is not None:
            stmt = stmt.where(func.coalesce(sa.c.total_spent, 0) <= f.max_spent)
        if f.has_bookings is not None:
            if f.has_bookings:
                stmt = stmt.where(exists().where(Booking.user_id == User.id))
            else:
                stmt = stmt.where(~exists().where(Booking.user_id == User.id))
        if f.collection_type in ("home", "lab"):
            stmt = stmt.where(
                exists().where(and_(Booking.user_id == User.id, Booking.collection_type == f.collection_type))
            )
        if f.report_status == "completed":
            stmt = stmt.where(func.coalesce(rep.c.completed_reports, 0) > 0)
        elif f.report_status == "pending":
            stmt = stmt.where(func.coalesce(prep.c.pending_reports, 0) > 0)
        if f.city:
            stmt = stmt.where(
                exists().where(
                    and_(
                        UserAddress.user_id == User.id,
                        UserAddress.deleted_at.is_(None),
                        UserAddress.city.in_(f.city),
                    )
                )
            )
        if f.state:
            stmt = stmt.where(
                exists().where(
                    and_(
                        UserAddress.user_id == User.id,
                        UserAddress.deleted_at.is_(None),
                        UserAddress.state.in_(f.state),
                    )
                )
            )
        if f.pincode:
            stmt = stmt.where(
                exists().where(
                    and_(
                        UserAddress.user_id == User.id,
                        UserAddress.deleted_at.is_(None),
                        UserAddress.pincode == f.pincode,
                    )
                )
            )
        if f.q:
            like = f"%{f.q.strip()}%"
            stmt = stmt.where(
                or_(
                    User.name.ilike(like),
                    User.email.ilike(like),
                    User.phone.ilike(like),
                    cast(User.id, String).ilike(like),
                    exists().where(
                        and_(Booking.user_id == User.id, Booking.reference_number.ilike(like))
                    ),
                )
            )
        return stmt

    def _row_to_dict(self, row: Any, online_cutoff: datetime) -> dict[str, Any]:
        user: User = row.User
        last_active = row.last_active
        home = row.home_count or 0
        lab = row.lab_count or 0
        if home == 0 and lab == 0:
            preferred = None
        else:
            preferred = "home" if home >= lab else "lab"
        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "avatar_key": user.avatar_key,
            "is_active": user.is_active,
            "account_status": user.account_status,
            "email_verified": user.email_verified_at is not None,
            "phone_verified": user.phone_verified_at is not None,
            "created_at": user.created_at,
            "last_login_at": user.last_login_at,
            "last_active_at": last_active,
            "is_online": bool(last_active and last_active >= online_cutoff),
            "total_bookings": row.total_bookings or 0,
            "total_tests": row.total_tests or 0,
            "total_packages": row.total_packages or 0,
            "total_spent": float(row.total_spent or 0),
            "pending_reports": row.pending_reports or 0,
            "completed_reports": row.completed_reports or 0,
            "preferred_collection_type": preferred,
            "city": row.city,
            "state": row.state,
            "tags": user.tags or [],
        }

    # ── dashboard stats ──────────────────────────────────────────────────────────

    async def get_stats(self) -> dict[str, Any]:
        now = self._now()
        online_cutoff = now - timedelta(minutes=ONLINE_THRESHOLD_MINUTES)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())

        base = select(User).where(User.deleted_at.is_(None))

        async def _count(stmt) -> int:
            return (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

        total = await _count(base)
        active = await _count(base.where(User.account_status == "active"))
        blocked = await _count(base.where(User.account_status == "blocked"))
        new_today = await _count(base.where(User.created_at >= today_start))
        new_week = await _count(base.where(User.created_at >= week_start))

        online = (
            await self.db.execute(
                select(func.count(func.distinct(Session.user_id))).where(
                    Session.revoked_at.is_(None),
                    Session.expires_at > now,
                    Session.last_seen_at >= online_cutoff,
                )
            )
        ).scalar_one()

        total_bookings = (
            await self.db.execute(select(func.count()).select_from(Booking))
        ).scalar_one()
        total_revenue = (
            await self.db.execute(
                select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == "paid")
            )
        ).scalar_one()
        home_users = (
            await self.db.execute(
                select(func.count(func.distinct(Booking.user_id))).where(Booking.collection_type == "home")
            )
        ).scalar_one()
        lab_users = (
            await self.db.execute(
                select(func.count(func.distinct(Booking.user_id))).where(Booking.collection_type == "lab")
            )
        ).scalar_one()
        completed_reports = (
            await self.db.execute(select(func.count()).select_from(Report))
        ).scalar_one()
        pending_reports = (
            await self.db.execute(
                select(func.count()).where(Booking.status.in_(_PENDING_REPORT_STATUSES))
            )
        ).scalar_one()

        # Legacy fields preserved for backward compatibility with the old stats UI.
        by_role_rows = await self.db.execute(
            select(User.role, func.count()).where(User.deleted_at.is_(None)).group_by(User.role)
        )
        by_role = {row[0]: row[1] for row in by_role_rows}

        return {
            "total": total,
            "active": active,
            "inactive": total - active,
            "blocked": blocked,
            "online": online,
            "new_today": new_today,
            "new_this_week": new_week,
            "total_bookings": total_bookings,
            "total_revenue": float(total_revenue or 0),
            "home_collection_users": home_users,
            "lab_visit_users": lab_users,
            "pending_reports": pending_reports,
            "completed_reports": completed_reports,
            "by_role": by_role,
        }

    # ── per-user aggregates & detail ─────────────────────────────────────────────

    async def get_user_aggregates(self, user_id: uuid.UUID) -> dict[str, Any]:
        """Booking/spend/report breakdown for a single user (booking-summary tab)."""
        booking_row = (
            await self.db.execute(
                select(
                    func.count().label("total"),
                    func.count().filter(Booking.status.in_(_PENDING_BOOKING_STATUSES)).label("pending"),
                    func.count().filter(Booking.status.in_(_COMPLETED_BOOKING_STATUSES)).label("completed"),
                    func.count().filter(Booking.status == "cancelled").label("cancelled"),
                    func.count().filter(Booking.collection_type == "home").label("home"),
                    func.count().filter(Booking.collection_type == "lab").label("lab"),
                ).where(Booking.user_id == user_id)
            )
        ).one()

        item_row = (
            await self.db.execute(
                select(
                    func.count().filter(BookingItem.item_type == "test").label("tests"),
                    func.count().filter(BookingItem.item_type == "package").label("packages"),
                )
                .join(Booking, Booking.id == BookingItem.booking_id)
                .where(Booking.user_id == user_id)
            )
        ).one()

        total_paid = (
            await self.db.execute(
                select(func.coalesce(func.sum(Payment.amount), 0))
                .join(Booking, Booking.id == Payment.booking_id)
                .where(Booking.user_id == user_id, Payment.status == "paid")
            )
        ).scalar_one()

        refund_amount = (
            await self.db.execute(
                select(func.coalesce(func.sum(Refund.amount), 0))
                .join(Payment, Payment.id == Refund.payment_id)
                .join(Booking, Booking.id == Payment.booking_id)
                .where(Booking.user_id == user_id)
            )
        ).scalar_one()

        return {
            "total_bookings": booking_row.total,
            "pending_bookings": booking_row.pending,
            "completed_bookings": booking_row.completed,
            "cancelled_bookings": booking_row.cancelled,
            "home_collections": booking_row.home,
            "lab_visits": booking_row.lab,
            "total_tests": item_row.tests,
            "total_packages": item_row.packages,
            "total_amount_paid": float(total_paid or 0),
            "refund_amount": float(refund_amount or 0),
        }

    async def get_detail(self, user: User) -> dict[str, Any]:
        """Full detail payload (personal + activity summary + aggregates) for a user."""
        aggregates = await self.get_user_aggregates(user.id)

        last_active = (
            await self.db.execute(
                select(func.max(Session.last_seen_at)).where(
                    Session.user_id == user.id,
                    Session.revoked_at.is_(None),
                    Session.expires_at > self._now(),
                )
            )
        ).scalar_one()

        online_cutoff = self._now() - timedelta(minutes=ONLINE_THRESHOLD_MINUTES)
        preferred = None
        if aggregates["home_collections"] or aggregates["lab_visits"]:
            preferred = "home" if aggregates["home_collections"] >= aggregates["lab_visits"] else "lab"

        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "alternate_phone": user.alternate_phone,
            "role": user.role,
            "gender": user.gender,
            "date_of_birth": user.date_of_birth,
            "avatar_key": user.avatar_key,
            "is_active": user.is_active,
            "account_status": user.account_status,
            "email_verified": user.email_verified_at is not None,
            "email_verified_at": user.email_verified_at,
            "phone_verified": user.phone_verified_at is not None,
            "phone_verified_at": user.phone_verified_at,
            "health_concerns": user.health_concerns or [],
            "tags": user.tags or [],
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "first_login_at": user.first_login_at,
            "last_login_at": user.last_login_at,
            "last_logout_at": user.last_logout_at,
            "last_active_at": last_active,
            "is_online": bool(last_active and last_active >= online_cutoff),
            "login_count": user.login_count,
            "login_attempt_count": user.login_attempt_count,
            "login_window_expires_at": user.login_window_expires_at,
            "preferred_collection_type": preferred,
            "aggregates": aggregates,
        }

    # ── export ───────────────────────────────────────────────────────────────────

    _EXPORT_COLUMNS = [
        ("User ID", "id"),
        ("Name", "name"),
        ("Email", "email"),
        ("Mobile", "phone"),
        ("Account Status", "account_status"),
        ("Email Verified", "email_verified"),
        ("Mobile Verified", "phone_verified"),
        ("Registered", "created_at"),
        ("Last Login", "last_login_at"),
        ("Last Active", "last_active_at"),
        ("Online", "is_online"),
        ("Total Bookings", "total_bookings"),
        ("Total Tests", "total_tests"),
        ("Total Packages", "total_packages"),
        ("Total Spent", "total_spent"),
        ("Preferred Collection", "preferred_collection_type"),
        ("City", "city"),
        ("State", "state"),
    ]

    def _export_value(self, row: dict[str, Any], key: str) -> Any:
        value = row.get(key)
        if value is None:
            return ""
        if isinstance(value, datetime):
            return to_local_str(value, "%Y-%m-%d %H:%M IST")
        if isinstance(value, bool):
            return "Yes" if value else "No"
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, (int, float, str)):
            return value
        # UUIDs and any other type → string (openpyxl only accepts scalars).
        return str(value)

    # ── per-user sub-resources ───────────────────────────────────────────────────

    async def list_user_bookings(
        self, user_id: uuid.UUID, page: int = 1, page_size: int = 20
    ) -> tuple[list[dict[str, Any]], int]:
        """Enriched booking history for one user, batched to avoid N+1."""
        from sqlalchemy.orm import selectinload

        from app.models.service import Technician, TechnicianAssignment
        from app.services.booking_service import _booking_to_dict

        base = select(Booking).where(Booking.user_id == user_id)
        total = (
            await self.db.execute(select(func.count()).select_from(base.subquery()))
        ).scalar_one()
        result = await self.db.execute(
            select(Booking)
            .options(selectinload(Booking.items))
            .where(Booking.user_id == user_id)
            .order_by(Booking.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        bookings = list(result.scalars().all())
        booking_ids = [b.id for b in bookings]
        if not booking_ids:
            return [], total

        # Batch payments, reports and technician assignments for this page.
        payments = {
            p.booking_id: p
            for p in (
                await self.db.execute(select(Payment).where(Payment.booking_id.in_(booking_ids)))
            ).scalars()
        }
        reports_by_booking: dict[uuid.UUID, list[Report]] = {}
        for r in (
            await self.db.execute(select(Report).where(Report.booking_id.in_(booking_ids)))
        ).scalars():
            reports_by_booking.setdefault(r.booking_id, []).append(r)
        tech_rows = (
            await self.db.execute(
                select(TechnicianAssignment, Technician)
                .join(Technician, Technician.id == TechnicianAssignment.technician_id)
                .where(TechnicianAssignment.booking_id.in_(booking_ids))
            )
        ).all()
        techs = {ta.booking_id: (ta, t) for ta, t in tech_rows}

        rows: list[dict[str, Any]] = []
        for b in bookings:
            data = _booking_to_dict(b)
            payment = payments.get(b.id)
            data["payment"] = (
                {
                    "method": payment.method,
                    "status": payment.status,
                    "amount": float(payment.amount),
                    "invoice_number": payment.invoice_number,
                    "paid_at": payment.paid_at,
                }
                if payment
                else None
            )
            booking_reports = reports_by_booking.get(b.id, [])
            data["reports"] = [
                {"id": r.id, "file_name": r.file_name, "uploaded_at": r.uploaded_at}
                for r in booking_reports
            ]
            data["has_report"] = bool(booking_reports)
            tech = techs.get(b.id)
            data["assigned_technician"] = (
                {"name": tech[1].name, "phone": tech[1].phone, "assigned_at": tech[0].assigned_at}
                if tech
                else None
            )
            rows.append(data)
        return rows, total

    async def list_user_payments(
        self, user_id: uuid.UUID, page: int = 1, page_size: int = 50
    ) -> tuple[list[dict[str, Any]], int]:
        base = (
            select(Payment, Booking.reference_number)
            .join(Booking, Booking.id == Payment.booking_id)
            .where(Booking.user_id == user_id)
        )
        total = (
            await self.db.execute(select(func.count()).select_from(base.subquery()))
        ).scalar_one()
        result = await self.db.execute(
            base.order_by(Payment.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
        rows = result.all()
        payment_ids = [p.id for p, _ in rows]
        refunds: dict[uuid.UUID, float] = {}
        if payment_ids:
            for pid, amt in (
                await self.db.execute(
                    select(Refund.payment_id, func.coalesce(func.sum(Refund.amount), 0))
                    .where(Refund.payment_id.in_(payment_ids))
                    .group_by(Refund.payment_id)
                )
            ).all():
                refunds[pid] = float(amt)
        return (
            [
                {
                    "id": p.id,
                    "booking_reference": ref,
                    "method": p.method,
                    "status": p.status,
                    "amount": float(p.amount),
                    "gst_amount": float(p.gst_amount),
                    "invoice_number": p.invoice_number,
                    "gateway_payment_id": p.gateway_payment_id,
                    "paid_at": p.paid_at,
                    "refund_amount": refunds.get(p.id, 0.0),
                    "created_at": p.created_at,
                }
                for p, ref in rows
            ],
            total,
        )

    async def user_audit_logs(
        self, user_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> tuple[list[Any], int]:
        """Audit entries about this user OR any of their bookings."""
        from app.models.audit import AuditLog

        booking_ids = [
            str(bid)
            for bid in (
                await self.db.execute(select(Booking.id).where(Booking.user_id == user_id))
            ).scalars()
        ]
        entity_ids = [str(user_id), *booking_ids]
        base = select(AuditLog).where(AuditLog.entity_id.in_(entity_ids))
        total = (
            await self.db.execute(select(func.count()).select_from(base.subquery()))
        ).scalar_one()
        result = await self.db.execute(
            base.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total

    async def export(self, filters: UserFilters, fmt: str) -> tuple[bytes, str, str]:
        # Export honours the same filters as the list, capped to avoid unbounded memory.
        rows, _ = await self.list_users(filters, page=1, page_size=10000)
        if fmt == "xlsx":
            return self._to_xlsx(rows)
        return self._to_csv(rows)

    def _to_csv(self, rows: list[dict[str, Any]]) -> tuple[bytes, str, str]:
        import csv
        import io

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([label for label, _ in self._EXPORT_COLUMNS])
        for row in rows:
            writer.writerow([self._export_value(row, key) for _, key in self._EXPORT_COLUMNS])
        return buf.getvalue().encode("utf-8-sig"), "text/csv", "users.csv"

    def _to_xlsx(self, rows: list[dict[str, Any]]) -> tuple[bytes, str, str]:
        import io

        from openpyxl import Workbook
        from openpyxl.styles import Font

        wb = Workbook()
        ws = wb.active
        ws.title = "Users"
        ws.append([label for label, _ in self._EXPORT_COLUMNS])
        for cell in ws[1]:
            cell.font = Font(bold=True)
        for row in rows:
            ws.append([self._export_value(row, key) for _, key in self._EXPORT_COLUMNS])
        for idx, (label, _) in enumerate(self._EXPORT_COLUMNS, start=1):
            ws.column_dimensions[ws.cell(row=1, column=idx).column_letter].width = max(14, len(label) + 2)
        buf = io.BytesIO()
        wb.save(buf)
        return (
            buf.getvalue(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "users.xlsx",
        )

