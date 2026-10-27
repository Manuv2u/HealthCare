"""AnalyticsService — dashboard summary, analytics, CSV export."""
from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingItem
from app.models.payment import Payment
from app.models.test import Test
from app.models.user import User

_TERMINAL_COMPLETED = "completed"
_TERMINAL_CANCELLED = "cancelled"


def _pct_change(current: float, previous: float) -> float | None:
    if not previous:
        return None
    return round((current - previous) / previous * 100, 1)


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_dashboard_summary(self) -> dict:
        now = datetime.now(timezone.utc)
        today = now.date()
        month_start = today.replace(day=1)

        # Total users
        total_users_result = await self.db.execute(
            select(func.count(User.id)).where(User.deleted_at.is_(None))
        )
        total_users = total_users_result.scalar_one()

        # Bookings today
        bookings_today_result = await self.db.execute(
            select(func.count(Booking.id)).where(Booking.booking_date == today)
        )
        bookings_today = bookings_today_result.scalar_one()

        # Bookings this month
        bookings_month_result = await self.db.execute(
            select(func.count(Booking.id)).where(Booking.booking_date >= month_start)
        )
        bookings_month = bookings_month_result.scalar_one()

        # Revenue today (paid payments)
        rev_today_result = await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0))
            .join(Booking, Booking.id == Payment.booking_id)
            .where(Payment.status == "paid", Booking.booking_date == today)
        )
        revenue_today = float(rev_today_result.scalar_one())

        # Revenue this month
        rev_month_result = await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0))
            .join(Booking, Booking.id == Payment.booking_id)
            .where(Payment.status == "paid", Booking.booking_date >= month_start)
        )
        revenue_month = float(rev_month_result.scalar_one())

        # Pending bookings
        pending_result = await self.db.execute(
            select(func.count(Booking.id)).where(Booking.status == "pending")
        )
        pending_count = pending_result.scalar_one()

        return {
            "total_users": total_users,
            "bookings_today": bookings_today,
            "bookings_month": bookings_month,
            "revenue_today": revenue_today,
            "revenue_month": revenue_month,
            "pending_bookings": pending_count,
        }

    async def _period_core_metrics(self, date_from: date, date_to: date) -> dict:
        """Cheap totals needed for both the current and the comparison period."""
        status_query = (
            select(Booking.status, func.count(Booking.id).label("count"))
            .where(Booking.booking_date >= date_from, Booking.booking_date <= date_to)
            .group_by(Booking.status)
        )
        status_result = await self.db.execute(status_query)
        bookings_by_status = {row.status: row.count for row in status_result.all()}
        total_bookings = sum(bookings_by_status.values())
        completed_bookings = bookings_by_status.get(_TERMINAL_COMPLETED, 0)
        cancelled_bookings = bookings_by_status.get(_TERMINAL_CANCELLED, 0)

        revenue_result = await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0))
            .join(Booking, Booking.id == Payment.booking_id)
            .where(
                Payment.status == "paid",
                Booking.booking_date >= date_from,
                Booking.booking_date <= date_to,
            )
        )
        total_revenue = float(revenue_result.scalar_one())
        avg_order_value = round(total_revenue / total_bookings, 2) if total_bookings else 0.0

        range_start = datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc)
        range_end = datetime.combine(date_to, datetime.max.time(), tzinfo=timezone.utc)
        new_users_result = await self.db.execute(
            select(func.count(User.id)).where(
                User.deleted_at.is_(None),
                User.created_at >= range_start,
                User.created_at <= range_end,
            )
        )
        new_users = new_users_result.scalar_one()

        return {
            "bookings_by_status": bookings_by_status,
            "total_bookings": total_bookings,
            "completed_bookings": completed_bookings,
            "cancelled_bookings": cancelled_bookings,
            "total_revenue": total_revenue,
            "avg_order_value": avg_order_value,
            "new_users": new_users,
        }

    async def _period_extended_metrics(self, date_from: date, date_to: date) -> dict:
        """Breakdowns only needed for the current (displayed) period."""
        rev_query = (
            select(Payment.method, func.coalesce(func.sum(Payment.amount), 0).label("total"))
            .join(Booking, Booking.id == Payment.booking_id)
            .where(
                Payment.status == "paid",
                Booking.booking_date >= date_from,
                Booking.booking_date <= date_to,
            )
            .group_by(Payment.method)
        )
        rev_result = await self.db.execute(rev_query)
        revenue_by_method = {row.method: float(row.total) for row in rev_result.all()}

        daily_query = (
            select(Booking.booking_date, func.coalesce(func.sum(Payment.amount), 0).label("total"))
            .join(Payment, Payment.booking_id == Booking.id)
            .where(
                Payment.status == "paid",
                Booking.booking_date >= date_from,
                Booking.booking_date <= date_to,
            )
            .group_by(Booking.booking_date)
            .order_by(Booking.booking_date.asc())
        )
        daily_result = await self.db.execute(daily_query)
        daily_revenue = [
            {"date": row.booking_date.isoformat(), "amount": float(row.total)}
            for row in daily_result.all()
        ]

        top_tests_query = (
            select(Test.name, func.count(BookingItem.id).label("count"))
            .join(Booking, Booking.id == BookingItem.booking_id)
            .join(Test, Test.id == BookingItem.test_id)
            .where(
                BookingItem.item_type == "test",
                Booking.booking_date >= date_from,
                Booking.booking_date <= date_to,
            )
            .group_by(Test.name)
            .order_by(func.count(BookingItem.id).desc())
            .limit(10)
        )
        top_tests_result = await self.db.execute(top_tests_query)
        top_tests = [
            {"test_name": row.name, "count": row.count} for row in top_tests_result.all()
        ]

        collection_query = (
            select(Booking.collection_type, func.count(Booking.id).label("count"))
            .where(Booking.booking_date >= date_from, Booking.booking_date <= date_to)
            .group_by(Booking.collection_type)
        )
        collection_result = await self.db.execute(collection_query)
        collection_type_split = {row.collection_type: row.count for row in collection_result.all()}

        return {
            "revenue_by_method": revenue_by_method,
            "daily_revenue": daily_revenue,
            "top_tests": top_tests,
            "collection_type_split": collection_type_split,
        }

    async def get_analytics(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
        service_area_id: uuid.UUID | None = None,
        category: str | None = None,
    ) -> dict:
        today = datetime.now(timezone.utc).date()
        date_to = date_to or today
        date_from = date_from or date_to.replace(day=1)

        current_core = await self._period_core_metrics(date_from, date_to)
        current_extended = await self._period_extended_metrics(date_from, date_to)

        period_days = (date_to - date_from).days + 1
        prev_to = date_from - timedelta(days=1)
        prev_from = prev_to - timedelta(days=period_days - 1)
        previous_core = await self._period_core_metrics(prev_from, prev_to)

        return {
            **current_core,
            **current_extended,
            "bookings_change_pct": _pct_change(
                current_core["total_bookings"], previous_core["total_bookings"]
            ),
            "revenue_change_pct": _pct_change(
                current_core["total_revenue"], previous_core["total_revenue"]
            ),
            "new_users_change_pct": _pct_change(
                current_core["new_users"], previous_core["new_users"]
            ),
        }

    async def export_csv(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> bytes:
        """Stream CSV of booking + payment records."""
        query = (
            select(
                Booking.reference_number,
                Booking.booking_date,
                Booking.status,
                Booking.collection_type,
                Payment.method,
                Payment.status.label("payment_status"),
                Payment.amount.label("payment_amount"),
                Payment.invoice_number,
            )
            .outerjoin(Payment, Payment.booking_id == Booking.id)
        )
        if date_from:
            query = query.where(Booking.booking_date >= date_from)
        if date_to:
            query = query.where(Booking.booking_date <= date_to)
        query = query.order_by(Booking.booking_date.desc())

        result = await self.db.execute(query)
        rows = result.all()

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "reference_number", "booking_date", "status", "collection_type",
            "payment_method", "payment_status",
            "payment_amount", "invoice_number",
        ])
        for row in rows:
            writer.writerow([
                row.reference_number,
                row.booking_date,
                row.status,
                row.collection_type,
                row.method,
                row.payment_status,
                row.payment_amount,
                row.invoice_number,
            ])

        return buf.getvalue().encode("utf-8")
