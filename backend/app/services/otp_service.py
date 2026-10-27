"""OTPService — database-backed OTP generation, delivery and verification.

Replaces the in-process dict store (which silently broke once the app ran
with more than one worker: the OTP generated in one process could not be
verified in another). Codes are stored hashed, are single-use, expire, have a
verification attempt limit, and sends are rate limited per phone. Delivery
goes through the pluggable OTP provider layer (app/services/otp/)."""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repositories.otp_repository import OtpRepository
from app.services.otp import get_otp_provider

logger = logging.getLogger("sri.otp")


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _aware(dt: datetime) -> datetime:
    """PostgreSQL returns tz-aware datetimes; SQLite (tests) returns naive UTC."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class OTPService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = OtpRepository(db)

    async def send_otp(
        self,
        phone: str,
        purpose: str = "login",
        ttl_minutes: int | None = None,
    ) -> dict:
        """Generate, store (hashed) and deliver an OTP. Raises 429 when the
        phone is over the resend cooldown or the per-window send cap."""
        now = datetime.now(timezone.utc)
        ttl = ttl_minutes or settings.otp_ttl_minutes

        # Resend cooldown — a user tapping "resend" repeatedly must wait.
        last = await self.repo.last_send_at(phone)
        if last is not None:
            elapsed = (now - _aware(last)).total_seconds()
            if elapsed < settings.otp_resend_cooldown_seconds:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error_code": "OTP_COOLDOWN",
                        "message": (
                            "Please wait "
                            f"{int(settings.otp_resend_cooldown_seconds - elapsed)}s "
                            "before requesting another OTP"
                        ),
                    },
                )

        # Send cap per rolling window.
        window_start = now - timedelta(minutes=settings.otp_send_window_minutes)
        sends = await self.repo.count_sends_since(phone, window_start)
        if sends >= settings.otp_max_sends_per_window:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error_code": "OTP_RATE_LIMITED",
                    "message": "Too many OTP requests. Please try again in a few minutes.",
                },
            )

        code = f"{secrets.randbelow(10**6):06d}"
        provider = await get_otp_provider(self.db)
        await self.repo.create_code(
            phone=phone,
            purpose=purpose,
            code_hash=_hash_code(code),
            provider=provider.name,
            expires_at=now + timedelta(minutes=ttl),
        )

        result = await provider.send_otp(phone, code, ttl)
        await self.repo.record_send(
            phone=phone,
            purpose=purpose,
            provider=result.provider,
            status="sent" if result.ok else "failed",
            provider_message_id=result.message_id,
            error=result.error,
        )
        if not result.ok:
            logger.error(
                "otp_send_failed: phone=%s provider=%s error=%s",
                phone, result.provider, result.error,
            )
        return {
            "sent": result.ok,
            "provider": result.provider,
            "expires_in_seconds": ttl * 60,
        }

    async def verify_otp(self, phone: str, otp: str, purpose: str = "login") -> bool:
        """Single-use verification with expiry and attempt cap."""
        row = await self.repo.get_active_code(phone, purpose)
        if row is None:
            return False
        now = datetime.now(timezone.utc)
        if now > _aware(row.expires_at):
            await self.repo.delete_code(row.id)
            return False
        if row.attempts >= settings.otp_max_verify_attempts:
            await self.repo.delete_code(row.id)
            logger.warning("otp_attempts_exceeded: phone=%s", phone)
            return False
        if _hash_code(otp) != row.code_hash:
            await self.repo.increment_attempts(row.id)
            return False
        await self.repo.mark_verified(row.id)
        return True
