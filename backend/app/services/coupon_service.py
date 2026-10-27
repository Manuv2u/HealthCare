"""Coupon service: validation, discount computation and admin CRUD.

CouponService.validate() is the single resolution point shared by the
checkout quote (BillingService.quote_items) and booking creation
(BookingService.create_booking) — both must agree on whether a code is
usable right now, the same role BannerService.resolve_package_discount used
to play for the retired banner-driven auto-apply mechanism.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.coupon import Coupon
from app.repositories.coupon_repository import CouponRepository
from app.schemas.coupons import CouponCreate, CouponUpdate


class CouponService:
    def __init__(self, db) -> None:
        self.db = db
        self.repo = CouponRepository(db)

    def serialize(self, coupon: Coupon, package_ids: list[uuid.UUID]) -> dict[str, Any]:
        return {
            "id": coupon.id,
            "code": coupon.code,
            "discount_type": coupon.discount_type,
            "discount_value": coupon.discount_value,
            "package_ids": package_ids,
            "valid_from": coupon.valid_from,
            "valid_until": coupon.valid_until,
            "usage_limit": coupon.usage_limit,
            "per_user_limit": coupon.per_user_limit,
            "times_used": coupon.times_used,
            "is_active": coupon.is_active,
            "created_at": coupon.created_at,
            "updated_at": coupon.updated_at,
        }

    async def get(self, coupon_id: uuid.UUID) -> Coupon:
        coupon = await self.repo.get_by_id(coupon_id)
        if not coupon:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "COUPON_NOT_FOUND", "message": "Coupon not found"},
            )
        return coupon

    async def list_all(self) -> list[dict[str, Any]]:
        coupons = await self.repo.list_all()
        return [
            self.serialize(c, await self.repo.list_package_ids(c.id)) for c in coupons
        ]

    async def create(self, body: CouponCreate) -> dict[str, Any]:
        fields = body.model_dump()
        package_ids = fields.pop("package_ids", [])
        try:
            coupon = await self.repo.create(**fields)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "COUPON_CODE_TAKEN", "message": "This code is already in use"},
            ) from None
        if package_ids:
            await self.repo.replace_packages(coupon.id, package_ids)
        return self.serialize(coupon, package_ids)

    async def update(self, coupon_id: uuid.UUID, body: CouponUpdate) -> dict[str, Any]:
        coupon = await self.get(coupon_id)
        fields = body.model_dump(exclude_unset=True)
        package_ids = fields.pop("package_ids", None)
        try:
            coupon = await self.repo.update(coupon, **fields)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "COUPON_CODE_TAKEN", "message": "This code is already in use"},
            ) from None
        if package_ids is not None:
            await self.repo.replace_packages(coupon_id, package_ids)
        effective_package_ids = (
            package_ids if package_ids is not None else await self.repo.list_package_ids(coupon_id)
        )
        return self.serialize(coupon, effective_package_ids)

    async def delete(self, coupon_id: uuid.UUID) -> None:
        coupon = await self.get(coupon_id)
        await self.repo.delete(coupon)

    # ── validation + discount ────────────────────────────────────────────────

    async def validate(
        self,
        code: str,
        package_ids: list[uuid.UUID],
        user_id: uuid.UUID | None,
    ) -> dict[str, Any]:
        coupon = await self.repo.get_by_code(code.strip().upper())
        if coupon is None:
            return {"valid": False, "error_code": "COUPON_NOT_FOUND", "message": "Invalid coupon code"}
        if not coupon.is_active:
            return {"valid": False, "error_code": "COUPON_INACTIVE", "message": "This coupon is no longer active"}

        now = datetime.now(timezone.utc)
        if coupon.valid_from and coupon.valid_from > now:
            return {"valid": False, "error_code": "COUPON_NOT_YET_VALID", "message": "This coupon isn't valid yet"}
        if coupon.valid_until and coupon.valid_until < now:
            return {"valid": False, "error_code": "COUPON_EXPIRED", "message": "This coupon has expired"}

        eligible_ids = set(await self.repo.list_package_ids(coupon.id))
        if not eligible_ids.intersection(package_ids):
            return {
                "valid": False,
                "error_code": "COUPON_PACKAGE_INELIGIBLE",
                "message": "This coupon doesn't apply to the selected package(s)",
            }

        if coupon.usage_limit is not None and coupon.times_used >= coupon.usage_limit:
            return {
                "valid": False,
                "error_code": "COUPON_USAGE_LIMIT_REACHED",
                "message": "This coupon has reached its usage limit",
            }

        if coupon.per_user_limit is not None and user_id is not None:
            used = await self.repo.count_uses_by_user(coupon.id, user_id)
            if used >= coupon.per_user_limit:
                return {
                    "valid": False,
                    "error_code": "COUPON_PER_USER_LIMIT_REACHED",
                    "message": "You've already used this coupon the maximum number of times",
                }

        return {"valid": True, "coupon": coupon, "eligible_package_ids": eligible_ids}

    def compute_discount(self, coupon: Coupon, eligible_subtotal: float) -> float:
        if coupon.discount_type == "percentage":
            amount = eligible_subtotal * float(coupon.discount_value) / 100
        else:
            amount = float(coupon.discount_value)
        return min(round(amount, 2), eligible_subtotal)

    async def redeem_atomic(self, coupon_id: uuid.UUID) -> bool:
        return await self.repo.increment_usage_atomic(coupon_id)
