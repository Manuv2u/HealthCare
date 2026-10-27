"""Coupons router: admin CRUD + checkout-time code validation."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.schemas.coupons import (
    CouponCreate,
    CouponOut,
    CouponUpdate,
    CouponValidateRequest,
    CouponValidateResult,
)
from app.services.coupon_service import CouponService

router = APIRouter(prefix="/coupons", tags=["coupons"])


# ── Admin ─────────────────────────────────────────────────────────────────────
@router.get("/admin", response_model=list[CouponOut])
async def list_all_coupons(
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> list[CouponOut]:
    svc = CouponService(db)
    return [CouponOut(**c) for c in await svc.list_all()]


@router.post("", response_model=CouponOut, status_code=201)
async def create_coupon(
    body: CouponCreate,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> CouponOut:
    svc = CouponService(db)
    return CouponOut(**await svc.create(body))


@router.put("/{coupon_id}", response_model=CouponOut)
async def update_coupon(
    coupon_id: uuid.UUID,
    body: CouponUpdate,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> CouponOut:
    svc = CouponService(db)
    return CouponOut(**await svc.update(coupon_id, body))


@router.delete("/{coupon_id}", status_code=204)
async def delete_coupon(
    coupon_id: uuid.UUID,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = CouponService(db)
    await svc.delete(coupon_id)


# ── Checkout-time validation ─────────────────────────────────────────────────
@router.post("/validate", response_model=CouponValidateResult)
async def validate_coupon(
    body: CouponValidateRequest,
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> CouponValidateResult:
    svc = CouponService(db)
    result = await svc.validate(body.code, body.package_ids, uuid.UUID(current_user["user_id"]))
    if not result["valid"]:
        return CouponValidateResult(
            valid=False, error_code=result["error_code"], message=result["message"]
        )
    coupon = result["coupon"]
    eligible_subtotal = 0.0
    if body.package_ids:
        from app.repositories.package_repository import PackageRepository

        package_repo = PackageRepository(db)
        for pid in result["eligible_package_ids"]:
            pkg = await package_repo.get_by_id(pid)
            if pkg is not None:
                eligible_subtotal += float(pkg.discounted_price)
    discount_amount = svc.compute_discount(coupon, eligible_subtotal)
    return CouponValidateResult(
        valid=True,
        coupon={
            "code": coupon.code,
            "discount_type": coupon.discount_type,
            "discount_value": coupon.discount_value,
        },
        discount_amount=discount_amount,
    )
