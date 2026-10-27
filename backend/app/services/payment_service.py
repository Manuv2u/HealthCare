"""PaymentService — initiate, verify, webhook, refunds, invoices.

All money figures come from the BillingService engine; this service never
computes GST or totals itself. `Payment.amount` is always the gross amount
collected by that payment (GST inclusive); `gst_amount` is the GST component
of the full bill.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment as PaymentModel
from app.repositories.booking_repository import BookingRepository
from app.repositories.payment_repository import (
    PaymentRepository,
    RefundRepository,
    WebhookEventRepository,
)
from app.repositories.user_repository import UserRepository
from app.services.billing_service import BillingService
from app.services.gateway_client import GatewayError, get_gateway_client
from app.services.invoice_service import InvoiceService

logger = logging.getLogger("sri.payment")

# All bookings (Lab Visit and Home Collection) must be paid online before
# they're confirmed — this is a whitelist so any future gateway method name is
# still allowed without a code change, while anything else is rejected.
_GATEWAY_METHODS = {"online", "card", "upi", "netbanking"}

# Forward-only refund status progression an admin can drive manually.
_REFUND_TRANSITIONS: dict[str, list[str]] = {
    "initiated": ["approved", "failed"],
    "approved": ["completed", "failed"],
    "completed": [],
    "failed": [],
}


class PaymentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = PaymentRepository(db)
        self.refund_repo = RefundRepository(db)
        self.booking_repo = BookingRepository(db)
        self.webhook_repo = WebhookEventRepository(db)
        self.billing = BillingService(db)

    async def _gateway(self):  # type: ignore[no-untyped-def]
        return await get_gateway_client(self.db)

    # ── initiate ──────────────────────────────────────────────────────────────

    async def initiate_payment(
        self,
        booking_id: uuid.UUID,
        method: str,
        user_id: uuid.UUID,
        role: str,
    ) -> dict:
        booking = await self.booking_repo.get_by_id(booking_id)
        if booking is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
            )
        if role != "admin" and booking.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN", "message": "Access denied"},
            )

        if method not in _GATEWAY_METHODS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "ONLINE_PAYMENT_REQUIRED",
                    "message": "Online payment is required for all bookings",
                },
            )

        existing = await self.repo.get_by_booking_id(booking_id)
        if existing and existing.status == "paid":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "ALREADY_PAID", "message": "Booking is already paid"},
            )

        # Server-side money math — items + admin adjustments + GST.
        totals = await self.billing.booking_totals(booking)

        # Online: charge the full total through the gateway.
        amount_paise = int(round(totals["total"] * 100))
        gateway = await self._gateway()

        # Gateways whose order-creation API mandates customer details (e.g.
        # Cashfree) need this; Razorpay-style gateways just ignore it.
        payer = await UserRepository(self.db).get_by_id(booking.user_id)
        customer = (
            {"id": str(payer.id), "name": payer.name, "phone": payer.phone, "email": payer.email}
            if payer is not None
            else None
        )

        try:
            order = await gateway.create_order(
                amount_paise=amount_paise,
                receipt=str(booking_id),
                notes={"booking_reference": booking.reference_number},
                customer=customer,
            )
        except GatewayError as exc:
            logger.error("gateway_order_failed: booking_id=%s error=%s", booking_id, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error_code": "GATEWAY_ERROR", "message": str(exc)},
            )

        payment = await self._upsert_payment(
            existing, booking_id, method,
            amount=totals["total"],
            gst_amount=totals["gst_amount"],
            gateway=gateway.name,
        )
        await self.repo.update_status(
            payment.id,
            status="pending",
            gateway_order_id=order["order_id"],
        )

        checkout = gateway.checkout_config()
        checkout.update({
            "order_id": order["order_id"],
            "amount_paise": order["amount_paise"],
            "currency": order.get("currency", "INR"),
            **order.get("checkout_extra", {}),
        })

        return {
            "payment_id": payment.id,
            "order_id": order["order_id"],
            "payment_url": order.get("payment_url"),
            "amount": totals["total"],
            "gst_amount": totals["gst_amount"],
            "totals": totals,
            "checkout": checkout,
        }

    async def _upsert_payment(
        self,
        existing,  # type: ignore[no-untyped-def]
        booking_id: uuid.UUID,
        method: str,
        amount: float,
        gst_amount: float,
        gateway: str | None,
    ):
        if existing is None:
            payment = await self.repo.create(
                booking_id=booking_id, method=method, amount=amount, gst_amount=gst_amount
            )
        else:
            payment = existing
        await self.db.execute(
            sa_update(PaymentModel)
            .where(PaymentModel.id == payment.id)
            .values(
                method=method,
                amount=amount,
                gst_amount=gst_amount,
                gateway=gateway,
            )
        )
        await self.db.flush()
        return payment

    async def _issue_invoice(self, payment_id: uuid.UUID) -> None:
        """Issue the immutable invoice; never let invoice trouble fail a payment."""
        try:
            invoice = await InvoiceService(self.db).issue_for_payment(payment_id)
            if invoice is not None:
                await self.db.execute(
                    sa_update(PaymentModel)
                    .where(PaymentModel.id == payment_id)
                    .values(invoice_number=invoice.invoice_number)
                )
                await self.db.flush()
        except Exception as exc:
            logger.error("invoice_generation_failed: payment_id=%s error=%s", payment_id, exc)

    # ── checkout config (frontend bootstrap) ─────────────────────────────────

    async def checkout_config(self) -> dict:
        gateway = await self._gateway()
        return gateway.checkout_config()

    # ── verify (checkout return flow) ─────────────────────────────────────────

    async def verify_checkout(
        self,
        booking_id: uuid.UUID,
        gateway_order_id: str,
        gateway_payment_id: str,
        gateway_signature: str,
        user_id: uuid.UUID,
        role: str,
    ) -> dict:
        """Called when the user completes the gateway's checkout. Verifies the
        signature and confirms the payment. Idempotent with the webhook — the
        first of the two to arrive wins, the other is a no-op."""
        payment = await self.repo.get_by_booking_id(booking_id)
        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "PAYMENT_NOT_FOUND", "message": "Payment not found"},
            )
        booking = await self.booking_repo.get_by_id(booking_id)
        if role != "admin" and (booking is None or booking.user_id != user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN", "message": "Access denied"},
            )
        if payment.gateway_order_id != gateway_order_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error_code": "ORDER_MISMATCH", "message": "Order does not match this booking"},
            )

        gateway = await self._gateway()
        # Never trust the browser-supplied payment_id directly — the returned
        # value is the gateway's own confirmation of what actually got paid
        # (HMAC-derived for Razorpay, API-fetched for Cashfree).
        verified_payment_id = await gateway.verify_checkout_signature(
            gateway_order_id, gateway_payment_id, gateway_signature
        )
        if not verified_payment_id:
            logger.warning("checkout_signature_invalid: booking_id=%s", booking_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_SIGNATURE", "message": "Payment signature verification failed"},
            )

        if payment.status == "paid":
            return {"status": "already_processed", "payment_id": payment.id}

        await self._confirm_payment(payment.id, verified_payment_id)
        return {"status": "ok", "payment_id": payment.id}

    async def _confirm_payment(self, payment_id: uuid.UUID, gateway_payment_id: str) -> None:
        payment = await self.repo.update_status(
            payment_id,
            status="paid",
            gateway_payment_id=gateway_payment_id,
            paid_at=datetime.now(timezone.utc),
        )
        await self.booking_repo.sync_payment_status(payment.booking_id, "paid")  # type: ignore[union-attr]
        await self._issue_invoice(payment_id)
        logger.info(
            "payment_confirmed: payment_id=%s booking_id=%s",
            payment_id, payment.booking_id,  # type: ignore[union-attr]
        )

    # ── webhook ───────────────────────────────────────────────────────────────

    async def handle_webhook(
        self,
        payload: bytes,
        signature: str,
        gateway_event_id: str | None = None,
        timestamp: str | None = None,
    ) -> dict:
        gateway = await self._gateway()
        if not gateway.verify_webhook_signature(payload, signature, timestamp):
            await self.webhook_repo.record(
                gateway=gateway.name, event_type="unknown", status="failed",
                gateway_event_id=gateway_event_id, error="signature mismatch",
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_SIGNATURE", "message": "Webhook signature mismatch"},
            )

        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            await self.webhook_repo.record(
                gateway=gateway.name, event_type="unknown", status="failed",
                gateway_event_id=gateway_event_id, error="invalid JSON",
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_PAYLOAD", "message": "Webhook payload is not valid JSON"},
            )

        # Gateway-level idempotency: Razorpay retries deliveries; the event id
        # header makes retries exact no-ops.
        if gateway_event_id and await self.webhook_repo.already_processed(
            gateway.name, gateway_event_id
        ):
            await self.webhook_repo.record(
                gateway=gateway.name,
                event_type=str(data.get("event", "unknown")),
                status="duplicate",
                gateway_event_id=None,
                payload=data,
            )
            return {"status": "already_processed"}

        event_type = data.get("event") or data.get("type")
        try:
            if gateway.name == "cashfree" and data.get("type"):
                result = await self._handle_cashfree_event(data["type"], data)
            elif event_type:  # Real Razorpay event envelope
                result = await self._handle_gateway_event(event_type, data)
            else:  # Legacy simplified payload (existing tests / manual replays)
                result = await self._handle_simple_payload(data)
            await self.webhook_repo.record(
                gateway=gateway.name,
                event_type=event_type or "payment.simple",
                status="processed" if result.get("status") == "ok" else result.get("status", "ignored"),
                gateway_event_id=gateway_event_id,
                payload=data,
            )
            return result
        except HTTPException as exc:
            await self.webhook_repo.record(
                gateway=gateway.name,
                event_type=event_type or "payment.simple",
                status="failed",
                gateway_event_id=gateway_event_id,
                error=str(exc.detail),
                payload=data,
            )
            raise

    async def _handle_gateway_event(self, event_type: str, data: dict) -> dict:
        """Razorpay envelope: {event, payload: {payment|refund: {entity: {...}}}}."""
        if event_type in ("payment.captured", "order.paid"):
            entity = data.get("payload", {}).get("payment", {}).get("entity", {})
            return await self._process_payment_captured(
                gateway_payment_id=entity.get("id", ""),
                gateway_order_id=entity.get("order_id", ""),
            )
        if event_type == "payment.failed":
            entity = data.get("payload", {}).get("payment", {}).get("entity", {})
            payment = await self._find_by_order_id(entity.get("order_id", ""))
            if payment is not None and payment.status != "paid":
                await self.repo.update_status(payment.id, status="failed")
                logger.info("payment_failed_webhook: payment_id=%s", payment.id)
            return {"status": "ok"}
        if event_type in ("refund.processed", "refund.failed"):
            entity = data.get("payload", {}).get("refund", {}).get("entity", {})
            return await self._process_refund_event(event_type, entity)
        logger.info("webhook_ignored: event=%s", event_type)
        return {"status": "ignored"}

    async def _handle_cashfree_event(self, event_type: str, data: dict) -> dict:
        """Cashfree envelope: {type, data: {order: {...}, payment|refund: {...}}}."""
        entity = data.get("data", {})
        if event_type == "PAYMENT_SUCCESS_WEBHOOK":
            payment_entity = entity.get("payment", {})
            order_entity = entity.get("order", {})
            return await self._process_payment_captured(
                gateway_payment_id=str(payment_entity.get("cf_payment_id", "")),
                gateway_order_id=str(order_entity.get("order_id", "")),
            )
        if event_type in ("PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"):
            order_entity = entity.get("order", {})
            payment = await self._find_by_order_id(str(order_entity.get("order_id", "")))
            if payment is not None and payment.status != "paid":
                await self.repo.update_status(payment.id, status="failed")
                logger.info("payment_failed_webhook: payment_id=%s", payment.id)
            return {"status": "ok"}
        if event_type == "REFUND_STATUS_WEBHOOK":
            refund_entity = entity.get("refund", {})
            mapped = {"SUCCESS": "refund.processed", "FAILED": "refund.failed"}.get(
                refund_entity.get("refund_status", "")
            )
            if mapped is None:
                return {"status": "ignored"}
            return await self._process_refund_event(
                mapped, {"id": str(refund_entity.get("cf_refund_id", "")), **refund_entity}
            )
        logger.info("webhook_ignored: event=%s", event_type)
        return {"status": "ignored"}

    async def _handle_simple_payload(self, data: dict) -> dict:
        """Legacy format: flat {payment_id|razorpay_payment_id, order_id|razorpay_order_id}."""
        gateway_payment_id = data.get("payment_id") or data.get("razorpay_payment_id", "")
        gateway_order_id = data.get("order_id") or data.get("razorpay_order_id", "")
        return await self._process_payment_captured(gateway_payment_id, gateway_order_id)

    async def _process_payment_captured(
        self, gateway_payment_id: str, gateway_order_id: str
    ) -> dict:
        existing = await self.repo.get_by_gateway_payment_id(gateway_payment_id)
        if existing and existing.status == "paid":
            logger.info("webhook_idempotent: gateway_payment_id=%s", gateway_payment_id)
            return {"status": "already_processed"}

        payment = await self._find_by_order_id(gateway_order_id)
        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "PAYMENT_NOT_FOUND", "message": "Payment not found"},
            )
        if payment.status == "paid":
            return {"status": "already_processed"}

        await self._confirm_payment(payment.id, gateway_payment_id)
        payment = await self.repo.get_by_id(payment.id)
        return {"status": "ok", "invoice_number": payment.invoice_number}  # type: ignore[union-attr]

    async def _process_refund_event(self, event_type: str, entity: dict) -> dict:
        gateway_refund_id = entity.get("id", "")
        refund = await self.refund_repo.get_by_gateway_refund_id(gateway_refund_id)
        if refund is None:
            logger.warning("refund_webhook_unmatched: gateway_refund_id=%s", gateway_refund_id)
            return {"status": "ignored"}
        if event_type == "refund.processed" and refund.status in ("initiated", "approved"):
            await self.refund_repo.update_refund_status(
                refund.id,
                status="completed",
                completed_at=datetime.now(timezone.utc),
                remarks="Refund settled by gateway (webhook)",
                gateway_response=entity,
            )
            logger.info("refund_completed_webhook: refund_id=%s", refund.id)
        elif event_type == "refund.failed" and refund.status not in ("completed",):
            await self.refund_repo.update_refund_status(
                refund.id,
                status="failed",
                remarks="Gateway reported refund failure (webhook)",
                gateway_response=entity,
            )
            logger.warning("refund_failed_webhook: refund_id=%s", refund.id)
        return {"status": "ok"}

    async def _find_by_order_id(self, gateway_order_id: str):  # type: ignore[no-untyped-def]
        from sqlalchemy import select

        result = await self.db.execute(
            select(PaymentModel).where(PaymentModel.gateway_order_id == gateway_order_id)
        )
        return result.scalar_one_or_none()

    # ── refunds ───────────────────────────────────────────────────────────────

    async def initiate_refund(
        self,
        payment_id: uuid.UUID,
        amount: float,
        reason: str,
        initiated_by: uuid.UUID,
    ) -> dict:
        """Admin-initiated (manual) refund. Partial amounts allowed up to the
        gross amount actually collected."""
        payment = await self.repo.get_by_id(payment_id)
        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "PAYMENT_NOT_FOUND", "message": "Payment not found"},
            )
        if payment.status != "paid":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error_code": "PAYMENT_NOT_PAID", "message": "Only paid payments can be refunded"},
            )

        total_paid = float(payment.amount)
        already_refunded = sum(
            float(r.amount)
            for r in await self.refund_repo.list_by_payment(payment_id)
            if r.status in ("initiated", "approved", "completed")
        )
        if amount > total_paid - already_refunded + 0.001:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "REFUND_EXCEEDS_PAYMENT",
                    "message": (
                        f"Refund amount cannot exceed the refundable balance "
                        f"(₹{max(total_paid - already_refunded, 0):.2f})"
                    ),
                },
            )

        refund = await self.refund_repo.create_refund(
            payment_id=payment_id,
            amount=amount,
            reason=reason,
            initiated_by=initiated_by,
        )
        await self.refund_repo.update_refund_status(refund.id, status="initiated")
        result = await self._execute_gateway_refund(refund.id, payment, amount)
        return {
            "refund_id": refund.id,
            "payment_id": payment_id,
            "amount": amount,
            "status": result["status"],
        }

    async def _execute_gateway_refund(self, refund_id: uuid.UUID, payment, amount: float) -> dict:  # type: ignore[no-untyped-def]
        """Call the gateway for a gateway-paid payment; payments that never
        reached a gateway (e.g. legacy cash records) stay manual (initiated →
        admin walks the state machine)."""
        is_gateway_payment = bool(
            payment.gateway
            and payment.gateway_payment_id
            and not str(payment.gateway_payment_id).startswith("cash_")
        )
        if not is_gateway_payment:
            return {"status": "initiated", "gateway": None}

        gateway = await self._gateway()
        try:
            result = await gateway.initiate_refund(
                gateway_payment_id=payment.gateway_payment_id,
                amount_paise=int(round(amount * 100)),
                gateway_order_id=payment.gateway_order_id,
            )
        except (GatewayError, Exception) as exc:  # noqa: BLE001 — refund must never crash cancel
            logger.error("refund_gateway_failed: refund_id=%s error=%s", refund_id, exc)
            await self.refund_repo.update_refund_status(
                refund_id,
                status="initiated",
                remarks=f"Automatic gateway refund failed: {exc}. Retry from the admin panel.",
            )
            return {"status": "initiated", "gateway_error": str(exc)}

        # "approved" = the gateway accepted and is processing; the
        # refund.processed webhook (or an admin) moves it to "completed".
        gateway_status = result.get("status", "")
        new_status = "completed" if gateway_status == "processed" else "approved"
        await self.refund_repo.update_refund_status(
            refund_id,
            status=new_status,
            gateway_refund_id=result["refund_id"],
            completed_at=datetime.now(timezone.utc) if new_status == "completed" else None,
            gateway_response=result.get("raw"),
        )
        logger.info("refund_initiated: refund_id=%s gateway_refund_id=%s", refund_id, result["refund_id"])
        return {"status": new_status}

    async def auto_refund_for_cancellation(self, booking_id: uuid.UUID) -> None:
        """Fire the gateway refund for the refund row the cancellation just
        created. Called by BookingService after a cancel; failures leave the
        refund in 'initiated' with a remark, for admin retry."""
        payment = await self.repo.get_by_booking_id(booking_id)
        if payment is None:
            return
        refunds = await self.refund_repo.list_by_payment(payment.id)
        pending = next(
            (r for r in refunds if r.status == "initiated" and not r.gateway_refund_id), None
        )
        if pending is None or float(pending.amount) <= 0:
            return
        await self._execute_gateway_refund(pending.id, payment, float(pending.amount))

    async def retry_refund(self, refund_id: uuid.UUID, admin_user_id: uuid.UUID) -> dict:
        """Admin retry after a failed automatic gateway refund."""
        refund = await self.refund_repo.get_by_id(refund_id)
        if refund is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "REFUND_NOT_FOUND", "message": "Refund not found"},
            )
        if refund.status not in ("initiated", "failed") or refund.gateway_refund_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "REFUND_NOT_RETRYABLE",
                    "message": "Only refunds that never reached the gateway can be retried",
                },
            )
        if float(refund.amount) <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "REFUND_NOT_RETRYABLE",
                    "message": "This refund has nothing to pay out — mark it completed instead of retrying",
                },
            )
        payment = await self.repo.get_by_id(refund.payment_id)
        if refund.status == "failed":
            await self.refund_repo.update_refund_status(refund.id, status="initiated")
        result = await self._execute_gateway_refund(refund.id, payment, float(refund.amount))
        logger.info("refund_retry: refund_id=%s by=%s result=%s", refund_id, admin_user_id, result["status"])
        return {"refund_id": refund_id, "status": result["status"]}

    # ── invoice ───────────────────────────────────────────────────────────────

    async def get_invoice(self, payment_id: uuid.UUID, user_id: uuid.UUID, role: str) -> bytes:
        payment = await self.repo.get_by_id(payment_id)
        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "PAYMENT_NOT_FOUND", "message": "Payment not found"},
            )
        if role != "admin":
            booking = await self.booking_repo.get_by_id(payment.booking_id)
            if booking is None or booking.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"error_code": "FORBIDDEN", "message": "Access denied"},
                )
        invoice_svc = InvoiceService(self.db)
        return await invoice_svc.generate_pdf(payment_id)

    # ── manual refund state machine (kept for gateway-failure cases) ─────────

    async def update_refund_status(
        self,
        refund_id: uuid.UUID,
        new_status: str,
        remarks: str | None,
        transaction_reference: str | None,
        admin_user_id: uuid.UUID,
    ) -> dict:
        refund = await self.refund_repo.get_by_id(refund_id)
        if refund is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "REFUND_NOT_FOUND", "message": "Refund not found"},
            )

        valid_next = _REFUND_TRANSITIONS.get(refund.status, [])
        if new_status not in valid_next:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "INVALID_REFUND_TRANSITION",
                    "message": f"Cannot move refund from '{refund.status}' to '{new_status}'. Valid next: {valid_next}",
                },
            )

        completed_at = datetime.now(timezone.utc) if new_status == "completed" else None
        await self.refund_repo.update_refund_status(
            refund_id,
            status=new_status,
            completed_at=completed_at,
            remarks=remarks,
            transaction_reference=transaction_reference,
        )

        logger.info(
            "refund_status_updated: refund_id=%s new_status=%s by=%s",
            refund_id, new_status, admin_user_id,
        )
        return {
            "refund_id": refund_id,
            "status": new_status,
            "remarks": remarks,
            "transaction_reference": transaction_reference,
            "completed_at": completed_at,
        }
