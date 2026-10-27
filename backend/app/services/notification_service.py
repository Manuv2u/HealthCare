"""NotificationService — enqueue and retry delivery via APScheduler."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.notification_repository import NotificationRepository
from app.services.notification_providers import get_email_client, get_sms_client

logger = logging.getLogger("sri.notification")

# Exponential backoff delays (minutes) per attempt index
_BACKOFF_MINUTES = [1, 5, 25]


class NotificationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = NotificationRepository(db)

    async def enqueue(
        self,
        user_id: uuid.UUID,
        event_type: str,
        channels: list[str],
        booking_id: uuid.UUID | None = None,
    ) -> None:
        """Insert pending notification rows for each channel."""
        for channel in channels:
            await self.repo.create(
                user_id=user_id,
                event_type=event_type,
                channel=channel,
                booking_id=booking_id,
            )
        logger.info(
            "notifications_enqueued: user_id=%s event=%s channels=%s",
            user_id,
            event_type,
            channels,
        )


async def run_notification_retry_job() -> None:
    """
    APScheduler job: fetch pending notifications and attempt delivery.
    Runs every minute. Uses exponential backoff.
    """
    from app.database import AsyncSessionFactory
    from sqlalchemy import select
    from app.models.user import User

    async with AsyncSessionFactory() as db:
        repo = NotificationRepository(db)
        pending = await repo.get_pending_retries()

        sms_client = get_sms_client()
        email_client = get_email_client()

        for notif in pending:
            # Enforce backoff: skip if not enough time has passed since last attempt
            if notif.last_attempted_at is not None:
                attempt_idx = max(0, notif.attempt_count - 1)
                backoff = timedelta(minutes=_BACKOFF_MINUTES[min(attempt_idx, len(_BACKOFF_MINUTES) - 1)])
                if datetime.now(timezone.utc) < notif.last_attempted_at + backoff:
                    continue

            # Fetch user contact info
            result = await db.execute(select(User).where(User.id == notif.user_id))
            user = result.scalar_one_or_none()
            if user is None:
                await repo.update_attempt(notif.id, success=False, error_message="User not found")
                continue

            message = _build_message(notif.event_type, notif.booking_id)
            success = False
            error_msg = None

            try:
                if notif.channel == "sms" and user.phone:
                    success = await sms_client.send(phone=user.phone, message=message)
                elif notif.channel == "email" and user.email:
                    success = await email_client.send(
                        to_email=user.email,
                        subject=f"SRI Lab — {notif.event_type.replace('_', ' ').title()}",
                        body=message,
                    )
                else:
                    error_msg = f"No contact info for channel {notif.channel}"
            except Exception as exc:
                error_msg = str(exc)
                logger.error(
                    "notification_delivery_error: id=%s channel=%s error=%s",
                    notif.id,
                    notif.channel,
                    exc,
                )

            await repo.update_attempt(notif.id, success=success, error_message=error_msg)
            logger.info(
                "notification_attempt: id=%s channel=%s attempt=%d success=%s",
                notif.id,
                notif.channel,
                notif.attempt_count + 1,
                success,
            )

        await db.commit()


def _build_message(event_type: str, booking_id: uuid.UUID | None) -> str:
    templates = {
        "booking_confirmed": "Your booking has been confirmed. Booking ID: {booking_id}",
        "technician_assigned": "A technician has been assigned to your booking {booking_id}.",
        "report_ready": "Your lab report is ready. Please log in to download it.",
        "payment_confirmed": "Payment confirmed for booking {booking_id}. Thank you!",
        "booking_cancelled": "Your booking {booking_id} has been cancelled.",
        "booking_rescheduled": "Your booking {booking_id} has been rescheduled.",
    }
    template = templates.get(event_type, f"Update on your booking: {event_type}")
    return template.format(booking_id=str(booking_id) if booking_id else "N/A")
