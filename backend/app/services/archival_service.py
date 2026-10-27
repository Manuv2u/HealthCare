"""ArchivalService — move old bookings/payments to archive tables."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import BookingArchive, PaymentArchive
from app.models.booking import Booking
from app.models.payment import Payment

logger = logging.getLogger("sri.archival")

_RETENTION_YEARS = 3
_BATCH_SIZE = 100


class ArchivalService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def run_archival_job(self) -> dict:
        """Archive bookings older than 3 years. Returns summary."""
        cutoff = datetime.now(timezone.utc).date() - timedelta(days=365 * _RETENTION_YEARS)

        archived = 0
        failed = 0

        # Fetch old bookings in batches
        result = await self.db.execute(
            select(Booking)
            .where(Booking.booking_date < cutoff)
            .limit(_BATCH_SIZE)
        )
        bookings = list(result.scalars().all())

        for booking in bookings:
            try:
                await self._archive_booking(booking)
                archived += 1
            except Exception as exc:
                logger.error(
                    "archival_failed: entity=booking id=%s error=%s",
                    booking.id,
                    exc,
                )
                failed += 1

        await self.db.flush()
        logger.info("archival_complete: archived=%d failed=%d", archived, failed)
        return {"archived": archived, "failed": failed}

    async def _archive_booking(self, booking: Booking) -> None:
        # Archive payment first
        pay_result = await self.db.execute(
            select(Payment).where(Payment.booking_id == booking.id)
        )
        payment = pay_result.scalar_one_or_none()

        if payment:
            archive_payment = PaymentArchive(
                id=payment.id,
                booking_id=payment.booking_id,
                method=payment.method,
                status=payment.status,
                gateway_order_id=payment.gateway_order_id,
                gateway_payment_id=payment.gateway_payment_id,
                amount=payment.amount,
                gst_amount=payment.gst_amount,
                invoice_number=payment.invoice_number,
                paid_at=payment.paid_at,
                created_at=payment.created_at,
                updated_at=payment.updated_at,
            )
            self.db.add(archive_payment)
            await self.db.execute(delete(Payment).where(Payment.id == payment.id))

        # Archive booking
        archive_booking = BookingArchive(
            id=booking.id,
            reference_number=booking.reference_number,
            user_id=booking.user_id,
            patient_id=booking.patient_id,
            collection_type=booking.collection_type,
            time_slot_id=booking.time_slot_id,
            booking_date=booking.booking_date,
            lab_branch_id=booking.lab_branch_id,
            pincode=booking.pincode,
            status=booking.status,
            payment_status=booking.payment_status,
            collected_at=booking.collected_at,
            processing_started_at=booking.processing_started_at,
            completed_at=booking.completed_at,
            cancelled_at=booking.cancelled_at,
            created_at=booking.created_at,
            updated_at=booking.updated_at,
        )
        self.db.add(archive_booking)
        await self.db.execute(delete(Booking).where(Booking.id == booking.id))

        from app.utils.audit import audit
        await audit(
            self.db,
            action_type="RECORD_ARCHIVED",
            entity_type="booking",
            entity_id=str(booking.id),
            outcome="success",
            metadata={"booking_date": str(booking.booking_date)},
        )


async def run_archival_job() -> None:
    """APScheduler entry point."""
    from app.database import AsyncSessionFactory
    async with AsyncSessionFactory() as db:
        svc = ArchivalService(db)
        await svc.run_archival_job()
        await db.commit()
