"""Billing router — server-computed checkout quotes, public billing config,
and admin-managed booking adjustments.

The billing engine (BillingService) is the single source of truth for money
math; these endpoints expose it so the frontend never hardcodes GST, discounts,
advances or totals.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.repositories.billing_repository import AdjustmentRepository
from app.repositories.booking_repository import BookingRepository
from app.schemas.billing import (
    BillingConfigPublic,
    BillingQuoteRequest,
    BillingTotalsOut,
    BookingAdjustmentIn,
    BookingAdjustmentOut,
)
from app.services.billing_service import BillingService

router = APIRouter(tags=["billing"])


@router.get("/billing/config", response_model=BillingConfigPublic)
async def get_billing_config(
    db: AsyncSession = Depends(get_db_session),
) -> BillingConfigPublic:
    """Public, non-sensitive billing display config (GST visibility, refund ETA)."""
    svc = BillingService(db)
    s = await svc.get_settings()
    return BillingConfigPublic(
        gst_enabled=s["gst_enabled"],
        gst_percentage=s["gst_percentage"],
        refund_eta_text=s["refund_eta_text"],
        company_name=s["company_name"],
    )


@router.post("/billing/quote", response_model=BillingTotalsOut)
async def quote_checkout(
    body: BillingQuoteRequest,
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> BillingTotalsOut:
    """Pre-booking checkout quote: server-side prices and GST."""
    if not body.test_ids and not body.package_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error_code": "NO_ITEMS", "message": "At least one test or package is required"},
        )
    svc = BillingService(db)
    totals = await svc.quote_items(
        body.test_ids,
        body.package_ids,
        coupon_code=body.coupon_code,
        user_id=uuid.UUID(current_user["user_id"]),
    )
    return BillingTotalsOut.model_validate(totals)


@router.get("/bookings/{booking_id}/billing-summary", response_model=BillingTotalsOut)
async def booking_billing_summary(
    booking_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> BillingTotalsOut:
    """Totals for an existing booking (items + manual adjustments)."""
    booking = await _get_booking_checked(booking_id, current_user, db)
    svc = BillingService(db)
    totals = await svc.booking_totals(booking)
    return BillingTotalsOut.model_validate(totals)


@router.get("/bookings/{booking_id}/adjustments", response_model=list[BookingAdjustmentOut])
async def list_adjustments(
    booking_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> list[BookingAdjustmentOut]:
    await _get_booking_checked(booking_id, current_user, db)
    repo = AdjustmentRepository(db)
    rows = await repo.list_by_booking(booking_id)
    return [BookingAdjustmentOut.model_validate(r) for r in rows]


@router.post(
    "/bookings/{booking_id}/adjustments",
    response_model=BookingAdjustmentOut,
    status_code=201,
)
async def add_adjustment(
    booking_id: uuid.UUID,
    body: BookingAdjustmentIn,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> BookingAdjustmentOut:
    """Admin adds a manual discount or extra charge. Only allowed before the
    booking is paid — an issued invoice must never drift from what was billed."""
    booking = await _get_booking_checked(booking_id, current_user, db)
    await _ensure_not_paid(booking_id, db)
    if booking.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error_code": "BOOKING_CANCELLED", "message": "Cannot adjust a cancelled booking"},
        )
    repo = AdjustmentRepository(db)
    row = await repo.create(
        booking_id=booking_id,
        kind=body.kind,
        label=body.label.strip(),
        amount=body.amount,
        created_by=uuid.UUID(current_user["user_id"]),
    )
    return BookingAdjustmentOut.model_validate(row)


@router.delete("/bookings/{booking_id}/adjustments/{adjustment_id}", status_code=204)
async def delete_adjustment(
    booking_id: uuid.UUID,
    adjustment_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    await _get_booking_checked(booking_id, current_user, db)
    await _ensure_not_paid(booking_id, db)
    repo = AdjustmentRepository(db)
    adjustment = await repo.get_by_id(adjustment_id)
    if adjustment is None or adjustment.booking_id != booking_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "ADJUSTMENT_NOT_FOUND", "message": "Adjustment not found"},
        )
    await repo.delete(adjustment_id)


async def _get_booking_checked(booking_id: uuid.UUID, current_user: dict, db: AsyncSession):  # type: ignore[no-untyped-def]
    repo = BookingRepository(db)
    booking = await repo.get_by_id(booking_id)
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
        )
    if current_user["role"] != "admin" and str(booking.user_id) != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error_code": "FORBIDDEN", "message": "Access denied"},
        )
    return booking


async def _ensure_not_paid(booking_id: uuid.UUID, db: AsyncSession) -> None:
    from app.repositories.payment_repository import PaymentRepository

    payment = await PaymentRepository(db).get_by_booking_id(booking_id)
    if payment is not None and payment.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "BOOKING_ALREADY_PAID",
                "message": "Adjustments cannot be changed after payment — the invoice is already issued",
            },
        )
