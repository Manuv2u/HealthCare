"""Password reset service: forgot-password and reset-password flows."""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repositories.user_repository import (
    PasswordResetTokenRepository,
    SessionRepository,
    UserRepository,
)
from app.services.email_service import EmailService

logger = logging.getLogger("sri.auth")

# Generic response for forgot-password: identical regardless of whether the
# account exists, to prevent email enumeration.
_GENERIC_FORGOT_PASSWORD_MESSAGE = (
    "If an account exists with this email, a password reset link has been sent."
)

_INVALID_RESET_TOKEN = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail={"error_code": "INVALID_RESET_TOKEN", "message": "This reset link is invalid."},
)
_EXPIRED_RESET_TOKEN = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail={"error_code": "EXPIRED_RESET_TOKEN", "message": "This reset link has expired. Please request a new one."},
)
_USED_RESET_TOKEN = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail={"error_code": "USED_RESET_TOKEN", "message": "This reset link has already been used."},
)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode()[:72], _bcrypt.gensalt(rounds=12)).decode()


def _as_utc(dt: datetime) -> datetime:
    """Values in this table are always stored as UTC, but some drivers (e.g.
    SQLite, used only in tests) drop tzinfo on round-trip while Postgres/asyncpg
    preserves it — normalize before comparing so both behave identically."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class PasswordResetService:
    def __init__(self, db: AsyncSession, email_service: EmailService | None = None) -> None:
        self.db = db
        self.user_repo = UserRepository(db)
        self.token_repo = PasswordResetTokenRepository(db)
        self.session_repo = SessionRepository(db)
        self.email_service = email_service or EmailService()

    async def forgot_password(self, email: str) -> dict:
        """Generate a reset token and email it. Always returns the same generic
        message regardless of whether the account exists (prevents enumeration)."""
        user = await self.user_repo.get_by_email(email)

        if user is None or not user.is_active:
            logger.info("password_reset_requested: no matching active account")
            return {"message": _GENERIC_FORGOT_PASSWORD_MESSAGE}

        # Invalidate any existing outstanding tokens for this user first, so at
        # most one reset link is ever live at a time.
        await self.token_repo.invalidate_user_tokens(user.id)

        raw_token = secrets.token_urlsafe(32)  # 32 random bytes, base64url-encoded
        token_hash = _hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.reset_token_expiry_minutes
        )
        await self.token_repo.create(user.id, token_hash, expires_at)
        await self.db.commit()

        reset_url = f"{settings.frontend_url}/auth/reset-password?token={raw_token}"
        sent = await self.email_service.send_password_reset_email(
            to_email=user.email,
            user_name=user.name,
            reset_url=reset_url,
            expiry_minutes=settings.reset_token_expiry_minutes,
        )
        # Never log the token itself — only the outcome.
        logger.info("password_reset_email_dispatch: user_id=%s sent=%s", user.id, sent)

        return {"message": _GENERIC_FORGOT_PASSWORD_MESSAGE}

    async def reset_password(self, raw_token: str, new_password: str) -> dict:
        """Validate the token and set the new password. Distinguishes invalid /
        expired / already-used tokens — safe to do once the caller already
        holds a token (unlike forgot-password, this can't be used to enumerate
        accounts by email)."""
        token_hash = _hash_token(raw_token)
        token = await self.token_repo.get_by_hash(token_hash)
        if token is None:
            raise _INVALID_RESET_TOKEN
        if token.used_at is not None:
            raise _USED_RESET_TOKEN
        if _as_utc(token.expires_at) <= datetime.now(timezone.utc):
            raise _EXPIRED_RESET_TOKEN

        new_hash = _hash_password(new_password)
        now = datetime.now(timezone.utc)
        await self.user_repo.update(
            token.user_id,
            password_hash=new_hash,
            is_temp_password=False,
            password_changed_at=now,
            tokens_invalidated_at=now,
        )
        await self.token_repo.mark_used(token.id)
        # Reset compromises whatever credential an attacker may have had —
        # revoke every existing session/refresh token for this user.
        await self.session_repo.revoke_all_user_sessions(token.user_id)
        await self.db.commit()

        logger.info("password_reset_completed: user_id=%s", token.user_id)
        return {"message": "Password updated successfully"}
