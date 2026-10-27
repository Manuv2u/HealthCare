"""Coupon repository: CRUD + package eligibility + atomic redemption."""
from __future__ import annotations

import uuid

from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import BookingAdjustment
from app.models.booking import Booking
from app.models.coupon import Coupon, CouponPackage
from app.models.test import Package


class CouponRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_all(self) -> list[Coupon]:
        result = await self.db.execute(select(Coupon).order_by(Coupon.created_at.desc()))
        return list(result.scalars().all())

    async def get_by_id(self, coupon_id: uuid.UUID) -> Coupon | None:
        result = await self.db.execute(select(Coupon).where(Coupon.id == coupon_id))
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Coupon | None:
        result = await self.db.execute(select(Coupon).where(Coupon.code == code))
        return result.scalar_one_or_none()

    async def get_live_by_id(self, coupon_id: uuid.UUID) -> Coupon | None:
        """The coupon only if it's currently redeemable: active, inside its
        validity window, and under its usage limit. Used to decide whether a
        banner's linked coupon badge should still show — a banner must not
        keep advertising a code that's already exhausted/expired/deactivated."""
        now = func.now()
        result = await self.db.execute(
            select(Coupon).where(
                Coupon.id == coupon_id,
                Coupon.is_active.is_(True),
                (Coupon.valid_from.is_(None)) | (Coupon.valid_from <= now),
                (Coupon.valid_until.is_(None)) | (Coupon.valid_until >= now),
                (Coupon.usage_limit.is_(None)) | (Coupon.times_used < Coupon.usage_limit),
            )
        )
        return result.scalar_one_or_none()

    async def create(self, **fields) -> Coupon:
        coupon = Coupon(**fields)
        self.db.add(coupon)
        await self.db.flush()
        await self.db.refresh(coupon)
        return coupon

    async def update(self, coupon: Coupon, **fields) -> Coupon:
        for key, value in fields.items():
            setattr(coupon, key, value)
        await self.db.flush()
        await self.db.refresh(coupon)
        return coupon

    async def delete(self, coupon: Coupon) -> None:
        await self.db.delete(coupon)
        await self.db.flush()

    # ── applicable packages ─────────────────────────────────────────────────

    async def list_package_ids(self, coupon_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.db.execute(
            select(CouponPackage.package_id).where(CouponPackage.coupon_id == coupon_id)
        )
        return list(result.scalars().all())

    async def list_packages(self, coupon_id: uuid.UUID) -> list[Package]:
        result = await self.db.execute(
            select(Package)
            .join(CouponPackage, CouponPackage.package_id == Package.id)
            .where(CouponPackage.coupon_id == coupon_id)
        )
        return list(result.scalars().all())

    async def replace_packages(
        self, coupon_id: uuid.UUID, package_ids: list[uuid.UUID]
    ) -> None:
        """Replace-all: delete existing links then insert the given set."""
        await self.db.execute(
            delete(CouponPackage).where(CouponPackage.coupon_id == coupon_id)
        )
        if package_ids:
            stmt = (
                pg_insert(CouponPackage)
                .values([{"coupon_id": coupon_id, "package_id": pid} for pid in package_ids])
                .on_conflict_do_nothing()
            )
            await self.db.execute(stmt)
        await self.db.flush()

    async def list_eligible_coupons_map(
        self, package_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, list[Coupon]]:
        """Batched lookup: active, currently-valid coupons covering any of the
        given packages, keyed by package_id. One query regardless of how many
        packages are being listed (avoids N+1 on package-listing endpoints)."""
        if not package_ids:
            return {}
        now = func.now()
        result = await self.db.execute(
            select(CouponPackage.package_id, Coupon)
            .join(Coupon, Coupon.id == CouponPackage.coupon_id)
            .where(
                CouponPackage.package_id.in_(package_ids),
                Coupon.is_active.is_(True),
                (Coupon.valid_from.is_(None)) | (Coupon.valid_from <= now),
                (Coupon.valid_until.is_(None)) | (Coupon.valid_until >= now),
                (Coupon.usage_limit.is_(None)) | (Coupon.times_used < Coupon.usage_limit),
            )
        )
        by_package: dict[uuid.UUID, list[Coupon]] = {}
        for package_id, coupon in result.all():
            by_package.setdefault(package_id, []).append(coupon)
        return by_package

    # ── usage ────────────────────────────────────────────────────────────────

    async def increment_usage_atomic(self, coupon_id: uuid.UUID) -> bool:
        """Atomic guard against over-redemption races: only succeeds while the
        coupon is still active and under its usage limit."""
        result = await self.db.execute(
            text(
                "UPDATE coupons SET times_used = times_used + 1 "
                "WHERE id = :id AND is_active = true "
                "AND (usage_limit IS NULL OR times_used < usage_limit) "
                "RETURNING id"
            ),
            {"id": str(coupon_id)},
        )
        return result.fetchone() is not None

    async def count_uses_by_user(self, coupon_id: uuid.UUID, user_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count(BookingAdjustment.id))
            .join(Booking, Booking.id == BookingAdjustment.booking_id)
            .where(
                BookingAdjustment.coupon_id == coupon_id,
                Booking.user_id == user_id,
                Booking.status != "cancelled",
            )
        )
        return result.scalar_one()
