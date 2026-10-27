"""OtpRepository — DB-backed OTP codes and send-event audit/statistics."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.otp import OtpCode, OtpSendEvent
from app.utils.timezone import local_midnight


class OtpRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── codes ─────────────────────────────────────────────────────────────────

    async def create_code(
        self,
        phone: str,
        purpose: str,
        code_hash: str,
        provider: str | None,
        expires_at: datetime,
    ) -> OtpCode:
        """A new code replaces any previous active code for the phone+purpose —
        exactly one OTP can be pending at a time."""
        await self.db.execute(
            delete(OtpCode).where(
                OtpCode.phone == phone,
                OtpCode.purpose == purpose,
                OtpCode.verified_at.is_(None),
            )
        )
        code = OtpCode(
            id=uuid.uuid4(),
            phone=phone,
            purpose=purpose,
            code_hash=code_hash,
            provider=provider,
            expires_at=expires_at,
            attempts=0,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(code)
        await self.db.flush()
        return code

    async def get_active_code(self, phone: str, purpose: str) -> OtpCode | None:
        result = await self.db.execute(
            select(OtpCode)
            .where(
                OtpCode.phone == phone,
                OtpCode.purpose == purpose,
                OtpCode.verified_at.is_(None),
            )
            .order_by(OtpCode.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def increment_attempts(self, code_id: uuid.UUID) -> int:
        await self.db.execute(
            update(OtpCode).where(OtpCode.id == code_id).values(attempts=OtpCode.attempts + 1)
        )
        await self.db.flush()
        result = await self.db.execute(select(OtpCode.attempts).where(OtpCode.id == code_id))
        return result.scalar_one()

    async def mark_verified(self, code_id: uuid.UUID) -> None:
        await self.db.execute(
            update(OtpCode)
            .where(OtpCode.id == code_id)
            .values(verified_at=datetime.now(timezone.utc))
        )
        await self.db.flush()

    async def delete_code(self, code_id: uuid.UUID) -> None:
        await self.db.execute(delete(OtpCode).where(OtpCode.id == code_id))
        await self.db.flush()

    # ── send events ───────────────────────────────────────────────────────────

    async def record_send(
        self,
        phone: str,
        purpose: str,
        provider: str,
        status: str,
        provider_message_id: str | None = None,
        error: str | None = None,
    ) -> OtpSendEvent:
        event = OtpSendEvent(
            id=uuid.uuid4(),
            phone=phone,
            purpose=purpose,
            provider=provider,
            status=status,
            provider_message_id=provider_message_id,
            error=error,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(event)
        await self.db.flush()
        return event

    async def last_send_at(self, phone: str | None = None) -> datetime | None:
        stmt = select(func.max(OtpSendEvent.created_at))
        if phone is not None:
            stmt = stmt.where(OtpSendEvent.phone == phone)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def count_sends_since(self, phone: str, since: datetime) -> int:
        result = await self.db.execute(
            select(func.count()).where(
                OtpSendEvent.phone == phone, OtpSendEvent.created_at >= since
            )
        )
        return result.scalar_one()

    async def usage_stats(self) -> dict:
        """Counts + success/failure rates for today / last 7 days / last 30 days."""
        now = datetime.now(timezone.utc)
        windows = {
            # IST calendar day, not a UTC-midnight truncation — IST is UTC+5:30
            # so the two disagree for roughly a third of every day.
            "today": local_midnight(now),
            "week": now - timedelta(days=7),
            "month": now - timedelta(days=30),
        }
        stats: dict = {}
        for label, since in windows.items():
            result = await self.db.execute(
                select(OtpSendEvent.status, func.count())
                .where(OtpSendEvent.created_at >= since)
                .group_by(OtpSendEvent.status)
            )
            counts = dict(result.all())
            sent = int(counts.get("sent", 0))
            failed = int(counts.get("failed", 0))
            total = sent + failed
            stats[label] = {
                "total": total,
                "sent": sent,
                "failed": failed,
                "success_rate": round(sent / total * 100, 1) if total else None,
                "failure_rate": round(failed / total * 100, 1) if total else None,
            }
        return stats
