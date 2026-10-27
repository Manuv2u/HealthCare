"""Payments router."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.schemas.payments import (
    CheckoutConfig,
    PaymentInitiateRequest,
    PaymentInitiateResponse,
    PaymentVerifyRequest,
    PaymentVerifyResponse,
    RefundRequest,
    RefundResponse,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])


class RefundStatusUpdateRequest(BaseModel):
    status: Literal["approved", "completed", "failed"]
    remarks: Optional[str] = None
    transaction_reference: Optional[str] = None


class RefundStatusUpdateResponse(BaseModel):
    refund_id: uuid.UUID
    status: str
    remarks: Optional[str] = None
    transaction_reference: Optional[str] = None
    completed_at: Optional[datetime] = None


@router.post("/initiate", response_model=PaymentInitiateResponse)
async def initiate_payment(
    body: PaymentInitiateRequest,
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> PaymentInitiateResponse:
    svc = PaymentService(db)
    result = await svc.initiate_payment(
        booking_id=body.booking_id,
        method=body.method,
        user_id=uuid.UUID(current_user["user_id"]),
        role=current_user["role"],
    )
    return PaymentInitiateResponse.model_validate(result)


@router.get("/checkout-config", response_model=CheckoutConfig)
async def get_checkout_config(
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> CheckoutConfig:
    """Which gateway is active and the public key the checkout UI needs."""
    svc = PaymentService(db)
    return CheckoutConfig.model_validate(await svc.checkout_config())


@router.post("/verify", response_model=PaymentVerifyResponse)
async def verify_payment(
    body: PaymentVerifyRequest,
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> PaymentVerifyResponse:
    """Confirm a checkout-completed payment (signature-verified). Idempotent
    with the webhook — whichever arrives first confirms the payment."""
    svc = PaymentService(db)
    result = await svc.verify_checkout(
        booking_id=body.booking_id,
        gateway_order_id=body.gateway_order_id,
        gateway_payment_id=body.gateway_payment_id,
        gateway_signature=body.gateway_signature,
        user_id=uuid.UUID(current_user["user_id"]),
        role=current_user["role"],
    )
    return PaymentVerifyResponse.model_validate(result)


@router.post("/webhook")
async def payment_webhook(
    request: Request,
    x_razorpay_signature: str = Header(default=""),
    x_razorpay_event_id: str = Header(default=""),
    x_webhook_signature: str = Header(default=""),
    x_webhook_timestamp: str = Header(default=""),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    payload = await request.body()
    svc = PaymentService(db)
    return await svc.handle_webhook(
        payload=payload,
        # Razorpay uses X-Razorpay-Signature; Cashfree uses X-Webhook-Signature.
        # Only the active gateway's header is ever populated.
        signature=x_razorpay_signature or x_webhook_signature,
        gateway_event_id=x_razorpay_event_id or None,
        timestamp=x_webhook_timestamp or None,
    )


@router.post("/{payment_id}/refund", response_model=RefundResponse)
async def initiate_refund(
    payment_id: uuid.UUID,
    body: RefundRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> RefundResponse:
    svc = PaymentService(db)
    result = await svc.initiate_refund(
        payment_id=payment_id,
        amount=body.amount,
        reason=body.reason,
        initiated_by=uuid.UUID(current_user["user_id"]),
    )
    return RefundResponse.model_validate(result)


@router.get("/{payment_id}/invoice")
async def get_invoice(
    payment_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    svc = PaymentService(db)
    pdf_bytes = await svc.get_invoice(
        payment_id,
        user_id=uuid.UUID(current_user["user_id"]),
        role=current_user["role"],
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=invoice-{payment_id}.pdf"},
    )


@router.post("/refunds/{refund_id}/retry", response_model=RefundResponse)
async def retry_refund(
    refund_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> RefundResponse:
    """Retry the gateway call for a refund whose automatic initiation failed."""
    svc = PaymentService(db)
    result = await svc.retry_refund(refund_id, uuid.UUID(current_user["user_id"]))
    refund = await svc.refund_repo.get_by_id(refund_id)
    return RefundResponse(
        refund_id=refund_id,
        payment_id=refund.payment_id,  # type: ignore[union-attr]
        amount=float(refund.amount),  # type: ignore[union-attr]
        status=result["status"],
    )


@router.put("/refunds/{refund_id}/status", response_model=RefundStatusUpdateResponse)
async def update_refund_status(
    refund_id: uuid.UUID,
    body: RefundStatusUpdateRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> RefundStatusUpdateResponse:
    """Admin walks a refund forward through initiated -> approved -> completed,
    or marks it failed."""
    svc = PaymentService(db)
    result = await svc.update_refund_status(
        refund_id=refund_id,
        new_status=body.status,
        remarks=body.remarks,
        transaction_reference=body.transaction_reference,
        admin_user_id=uuid.UUID(current_user["user_id"]),
    )
    return RefundStatusUpdateResponse.model_validate(result)
