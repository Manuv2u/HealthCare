"""Email verification service: OTP generation, delivery, and validation for
the registration email-verification gate (users can't log in until verified)."""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.repositories.user_repository import EmailVerificationOtpRepository, UserRepository
from app.services.email_service import EmailService

logger = logging.getLogger("sri.auth")

_GENERIC_RESEND_MESSAGE = "If this email is pending verification, a new code has been sent."

_INVALID_OTP = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail={"error_code": "INVALID_OTP", "message": "That code is incorrect or no longer valid."},
)
_EXPIRED_OTP = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail={"error_code": "EXPIRED_OTP", "message": "This code has expired. Please request a new one."},
)
_MAX_ATTEMPTS_EXCEEDED = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail={"error_code": "MAX_ATTEMPTS_EXCEEDED", "message": "Too many incorrect attempts. Please request a new code."},
)
_ALREADY_VERIFIED = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail={"error_code": "EMAIL_ALREADY_VERIFIED", "message": "This email is already verified. Please sign in."},
)


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class EmailVerificationService:
    def __init__(self, db: AsyncSession, email_service: EmailService | None = None) -> None:
        self.db = db
        self.user_repo = UserRepository(db)
        self.otp_repo = EmailVerificationOtpRepository(db)
        self.email_service = email_service or EmailService()

    async def send_verification_otp(self, user: User) -> None:
        """Generate and email a fresh OTP for this user. Never raises — a
        delivery failure is logged, not surfaced (the caller, e.g. register(),
        must not fail just because the email couldn't be sent)."""
        code = _generate_code()
        code_hash = _hash_code(code)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.email_verification_otp_expiry_minutes
        )
        await self.otp_repo.create(user.id, code_hash, expires_at)
        await self.db.commit()

        sent = await self.email_service.send_verification_otp_email(
            to_email=user.email,
            user_name=user.name,
            otp_code=code,
            expiry_minutes=settings.email_verification_otp_expiry_minutes,
        )
        # Never log the code itself — only the outcome.
        logger.info("verification_otp_dispatch: user_id=%s sent=%s", user.id, sent)

    async def resend_verification_otp(self, email: str) -> dict:
        """Always returns the same generic message, whether or not the email
        matches a pending account — same enumeration-prevention rationale as
        forgot-password."""
        user = await self.user_repo.get_by_email(email)
        if user is None or user.email_verified_at is not None:
            return {"message": _GENERIC_RESEND_MESSAGE}

        latest = await self.otp_repo.get_latest_for_user(user.id)
        if latest is not None:
            cooldown = timedelta(seconds=settings.email_verification_resend_cooldown_seconds)
            elapsed = datetime.now(timezone.utc) - _as_utc(latest.created_at)
            if elapsed < cooldown:
                retry_after = int((cooldown - elapsed).total_seconds())
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error_code": "RESEND_COOLDOWN",
                        "message": f"Please wait {retry_after} seconds before requesting another code.",
                    },
                )

        await self.send_verification_otp(user)
        return {"message": _GENERIC_RESEND_MESSAGE}

    async def validate_otp(self, email: str, code: str) -> User:
        """Validate the code and mark the user's email verified. Raises on any
        failure; returns the user on success (caller is responsible for
        issuing session tokens)."""
        user = await self.user_repo.get_by_email(email)
        if user is None:
            raise _INVALID_OTP
        if user.email_verified_at is not None:
            raise _ALREADY_VERIFIED

        otp = await self.otp_repo.get_latest_for_user(user.id)
        if otp is None or otp.verified_at is not None:
            raise _INVALID_OTP
        if otp.attempts >= settings.email_verification_max_attempts:
            raise _MAX_ATTEMPTS_EXCEEDED
        if _as_utc(otp.expires_at) <= datetime.now(timezone.utc):
            raise _EXPIRED_OTP
        if _hash_code(code) != otp.code_hash:
            await self.otp_repo.increment_attempts(otp.id)
            await self.db.commit()
            raise _INVALID_OTP

        now = datetime.now(timezone.utc)
        await self.otp_repo.mark_verified(otp.id)
        updated = await self.user_repo.update(user.id, email_verified_at=now)
        await self.db.commit()

        logger.info("email_verification_completed: user_id=%s", user.id)
        return updated
