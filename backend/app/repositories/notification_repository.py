"""NotificationRepository."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

_MAX_ATTEMPTS = 3


class NotificationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        user_id: uuid.UUID,
        event_type: str,
        channel: str,
        booking_id: uuid.UUID | None = None,
    ) -> Notification:
        notif = Notification(
            id=uuid.uuid4(),
            user_id=user_id,
            booking_id=booking_id,
            channel=channel,
            event_type=event_type,
            status="pending",
            attempt_count=0,
        )
        self.db.add(notif)
        await self.db.flush()
        await self.db.refresh(notif)
        return notif

    async def get_pending_retries(self) -> list[Notification]:
        """Return notifications that are pending/failed with attempt_count < MAX."""
        result = await self.db.execute(
            select(Notification).where(
                Notification.status.in_(["pending", "failed"]),
                Notification.attempt_count < _MAX_ATTEMPTS,
            )
        )
        return list(result.scalars().all())

    async def update_attempt(
        self,
        notification_id: uuid.UUID,
        success: bool,
        error_message: str | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        notif = result.scalar_one_or_none()
        if notif is None:
            return

        new_count = notif.attempt_count + 1
        if success:
            new_status = "sent"
            sent_at = now
        elif new_count >= _MAX_ATTEMPTS:
            new_status = "failed"
            sent_at = None
        else:
            new_status = "pending"
            sent_at = None

        values: dict = {
            "attempt_count": new_count,
            "last_attempted_at": now,
            "status": new_status,
            "error_message": error_message,
        }
        if sent_at:
            values["sent_at"] = sent_at

        await self.db.execute(
            update(Notification).where(Notification.id == notification_id).values(**values)
        )
        await self.db.flush()
