"""PaymentRepository, RefundRepository and WebhookEventRepository."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment, Refund, WebhookEvent


class PaymentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        booking_id: uuid.UUID,
        method: str,
        amount: float,
        gst_amount: float,
    ) -> Payment:
        payment = Payment(
            id=uuid.uuid4(),
            booking_id=booking_id,
            method=method,
            status="pending",
            amount=amount,
            gst_amount=gst_amount,
        )
        self.db.add(payment)
        await self.db.flush()
        await self.db.refresh(payment)
        return payment

    async def get_by_id(self, payment_id: uuid.UUID) -> Payment | None:
        result = await self.db.execute(
            select(Payment).where(Payment.id == payment_id)
        )
        return result.scalar_one_or_none()

    async def get_by_booking_id(self, booking_id: uuid.UUID) -> Payment | None:
        result = await self.db.execute(
            select(Payment).where(Payment.booking_id == booking_id)
        )
        return result.scalar_one_or_none()

    async def get_by_gateway_payment_id(self, gateway_payment_id: str) -> Payment | None:
        result = await self.db.execute(
            select(Payment).where(Payment.gateway_payment_id == gateway_payment_id)
        )
        return result.scalar_one_or_none()

    async def update_status(
        self,
        payment_id: uuid.UUID,
        status: str,
        gateway_order_id: str | None = None,
        gateway_payment_id: str | None = None,
        invoice_number: str | None = None,
        paid_at: datetime | None = None,
    ) -> Payment | None:
        values: dict = {"status": status}
        if gateway_order_id is not None:
            values["gateway_order_id"] = gateway_order_id
        if gateway_payment_id is not None:
            values["gateway_payment_id"] = gateway_payment_id
        if invoice_number is not None:
            values["invoice_number"] = invoice_number
        if paid_at is not None:
            values["paid_at"] = paid_at

        await self.db.execute(
            update(Payment).where(Payment.id == payment_id).values(**values)
        )
        await self.db.flush()
        return await self.get_by_id(payment_id)


class RefundRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_refund(
        self,
        payment_id: uuid.UUID,
        amount: float,
        reason: str,
        initiated_by: uuid.UUID,
    ) -> Refund:
        refund = Refund(
            id=uuid.uuid4(),
            payment_id=payment_id,
            amount=amount,
            reason=reason,
            status="pending",
            initiated_by=initiated_by,
            initiated_at=datetime.now(timezone.utc),
        )
        self.db.add(refund)
        await self.db.flush()
        await self.db.refresh(refund)
        return refund

    async def get_by_id(self, refund_id: uuid.UUID) -> Refund | None:
        result = await self.db.execute(select(Refund).where(Refund.id == refund_id))
        return result.scalar_one_or_none()

    async def update_refund_status(
        self,
        refund_id: uuid.UUID,
        status: str,
        gateway_refund_id: str | None = None,
        completed_at: datetime | None = None,
        remarks: str | None = None,
        transaction_reference: str | None = None,
        gateway_response: dict | None = None,
    ) -> Refund | None:
        values: dict = {"status": status}
        if gateway_refund_id is not None:
            values["gateway_refund_id"] = gateway_refund_id
        if completed_at is not None:
            values["completed_at"] = completed_at
        if remarks is not None:
            values["remarks"] = remarks
        if transaction_reference is not None:
            values["transaction_reference"] = transaction_reference
        if gateway_response is not None:
            values["gateway_response"] = gateway_response

        await self.db.execute(
            update(Refund).where(Refund.id == refund_id).values(**values)
        )
        await self.db.flush()
        result = await self.db.execute(select(Refund).where(Refund.id == refund_id))
        return result.scalar_one_or_none()

    async def get_by_gateway_refund_id(self, gateway_refund_id: str) -> Refund | None:
        result = await self.db.execute(
            select(Refund).where(Refund.gateway_refund_id == gateway_refund_id)
        )
        return result.scalar_one_or_none()

    async def list_by_payment(self, payment_id: uuid.UUID) -> list[Refund]:
        result = await self.db.execute(
            select(Refund)
            .where(Refund.payment_id == payment_id)
            .order_by(Refund.initiated_at.desc())
        )
        return list(result.scalars().all())


class WebhookEventRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def already_processed(self, gateway: str, gateway_event_id: str) -> bool:
        result = await self.db.execute(
            select(WebhookEvent).where(
                WebhookEvent.gateway == gateway,
                WebhookEvent.gateway_event_id == gateway_event_id,
                WebhookEvent.status == "processed",
            )
        )
        return result.scalars().first() is not None

    async def record(
        self,
        gateway: str,
        event_type: str,
        status: str,
        gateway_event_id: str | None = None,
        error: str | None = None,
        payload: dict | None = None,
    ) -> WebhookEvent:
        event = WebhookEvent(
            id=uuid.uuid4(),
            gateway=gateway,
            event_type=event_type,
            gateway_event_id=gateway_event_id,
            status=status,
            error=error,
            payload=payload,
            processed_at=datetime.now(timezone.utc) if status == "processed" else None,
        )
        self.db.add(event)
        await self.db.flush()
        return event

    async def last_by_status(self, status: str) -> WebhookEvent | None:
        result = await self.db.execute(
            select(WebhookEvent)
            .where(WebhookEvent.status == status)
            .order_by(WebhookEvent.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def recent(self, limit: int = 20) -> list[WebhookEvent]:
        result = await self.db.execute(
            select(WebhookEvent).order_by(WebhookEvent.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())
