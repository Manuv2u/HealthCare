"""AuthService: registration, OTP verification, login, logout, token refresh."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repositories.user_repository import (
    LoginEventRepository,
    SessionRepository,
    UserRepository,
)
from app.services.otp_service import OTPService
from app.utils.user_agent import parse_user_agent
from app.utils.timezone import to_local_str
from app.utils.jwt import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    verify_refresh_token,
)

# passlib + bcrypt>=4.0 incompatibility: use bcrypt directly
def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode()[:72], _bcrypt.gensalt(rounds=12)).decode()

def _verify_password(password: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except Exception:
        return False


def _as_utc(dt: datetime) -> datetime:
    """Some drivers (e.g. SQLite, used only in tests) drop tzinfo on round-trip
    while Postgres/asyncpg preserves it — normalize before comparing."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)

_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail={"error_code": "INVALID_CREDENTIALS", "message": "Invalid credentials"},
)

# Login-attempt rate limit for normal users. Admins are exempt (no lockout,
# no cap) — see AuthService._enforce_login_rate_limit.
_MAX_LOGIN_ATTEMPTS_PER_HOUR = 35
_LOGIN_ATTEMPT_WINDOW_MINUTES = 60


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.user_repo = UserRepository(db)
        self.session_repo = SessionRepository(db)
        self.login_event_repo = LoginEventRepository(db)

    async def register(
        self,
        phone: str,
        name: str,
        email: str,
        password: str,
        device_identifier: str | None = None,
        ip_address: str | None = None,
    ) -> dict:
        """Register a new user with phone, email and password. Returns auth tokens."""
        if await self.user_repo.get_by_phone(phone) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "PHONE_ALREADY_REGISTERED", "message": "Phone number already registered"},
            )
        if await self.user_repo.get_by_email(email) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "EMAIL_ALREADY_REGISTERED", "message": "Email address already registered"},
            )

        pw_hash = _hash_password(password)
        try:
            user = await self.user_repo.create_user(
                name=name,
                phone=phone,
                email=email,
                password_hash=pw_hash,
                role="user",
            )
        except IntegrityError as exc:
            # The pre-checks above only see active users (deleted_at IS NULL);
            # phone/email UNIQUE constraints apply to soft-deleted rows too, so
            # a collision with a deleted account (or a concurrent registration)
            # still reaches the DB. Surface it as a clean 409 instead of a 500.
            await self.db.rollback()
            constraint = getattr(exc.orig, "constraint_name", None)
            if constraint == "users_phone_key":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"error_code": "PHONE_ALREADY_REGISTERED", "message": "Phone number already registered"},
                ) from exc
            if constraint == "users_email_key":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"error_code": "EMAIL_ALREADY_REGISTERED", "message": "Email address already registered"},
                ) from exc
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "ALREADY_REGISTERED", "message": "Phone or email already registered"},
            ) from exc

        from app.services.email_verification_service import EmailVerificationService
        await EmailVerificationService(self.db).send_verification_otp(user)
        return {
            "message": "Account created. Please check your email for a verification code.",
            "email": user.email,
        }

    async def verify_email_otp(
        self,
        email: str,
        otp: str,
        device_identifier: str | None = None,
        ip_address: str | None = None,
    ) -> dict:
        """Confirm the registration email-verification OTP, activate the
        account, and log the user in."""
        from app.services.email_verification_service import EmailVerificationService
        user = await EmailVerificationService(self.db).validate_otp(email, otp)
        return await self._create_session_and_tokens(user, device_identifier, ip_address)

    async def login_otp(self, phone: str) -> dict:
        """Send OTP to any existing user (user/admin/technician) for login."""
        user = await self.user_repo.get_by_phone(phone)
        if user is None or not user.is_active:
            # Return same message to avoid phone enumeration
            return {"message": "OTP sent if account exists"}
        # Delivery goes through the configured OTP provider (2Factor/MSG91/mock);
        # rate limiting + cooldown raise 429 from inside the service. The commit
        # here persists the OTP row and send-event even though the request
        # transaction commits later anyway — an SMS the user already received
        # must never reference a code a failed request rolled back.
        await OTPService(self.db).send_otp(phone, purpose="login")
        await self.db.commit()
        return {"message": "OTP sent"}

    async def verify_otp(
        self,
        phone: str,
        otp: str,
        name: str | None,
        device_identifier: str | None = None,
        ip_address: str | None = None,
    ) -> dict:
        """Verify OTP, create user + session, return tokens."""
        if not await OTPService(self.db).verify_otp(phone, otp, purpose="login"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_OTP", "message": "Invalid or expired OTP"},
            )
        # User may already exist (re-verify flow) or be new
        user = await self.user_repo.get_by_phone(phone)
        if user is None:
            resolved_name = name or "User"
            empty_pw_hash = _hash_password("")
            user = await self.user_repo.create_user(
                name=resolved_name,
                phone=phone,
                email=None,
                password_hash=empty_pw_hash,
                role="user",
            )
        return await self._create_session_and_tokens(user, device_identifier, ip_address)

    async def login(
        self,
        phone_or_email: str,
        password: str,
        device_identifier: str | None = None,
        ip_address: str | None = None,
    ) -> dict:
        """Find user by phone or email, verify password, return tokens."""
        from app.utils.audit import audit

        user = await self.user_repo.get_by_phone(phone_or_email)
        if user is None:
            user = await self.user_repo.get_by_email(phone_or_email)

        # Rate limit must be enforced before password verification — otherwise
        # a string of guesses never reaches this branch and the account is
        # never actually blocked from further guessing. Admins are exempt.
        if user is not None and user.role != "admin":
            await self._enforce_login_rate_limit(user)

        # Use identical error for wrong password vs unknown user (timing-safe)
        if user is None or not _verify_password(password, user.password_hash):
            if user is not None:
                await self._register_failed_login(user, device_identifier, ip_address)
            await audit(
                self.db,
                action_type="USER_LOGIN_FAILURE",
                entity_type="user",
                entity_id=phone_or_email,
                outcome="failure",
                source_ip=ip_address,
            )
            raise _INVALID_CREDENTIALS
        if not user.is_active:
            raise _INVALID_CREDENTIALS
        if user.email and user.email_verified_at is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "EMAIL_NOT_VERIFIED",
                    "message": "Please verify your email address before logging in.",
                },
            )

        result = await self._create_session_and_tokens(user, device_identifier, ip_address)
        result["is_temp_password"] = bool(getattr(user, "is_temp_password", False))
        await audit(
            self.db,
            action_type="USER_LOGIN_SUCCESS",
            entity_type="user",
            entity_id=str(user.id),
            outcome="success",
            actor_id=user.id,
            actor_role=user.role,
            source_ip=ip_address,
        )
        return result

    async def _enforce_login_rate_limit(self, user) -> None:
        """Cap a normal-user account to _MAX_LOGIN_ATTEMPTS_PER_HOUR login attempts
        (successful or failed) within a rolling-reset hourly window. Callers must
        skip this for admins, who have no login restrictions."""
        now = datetime.now(timezone.utc)
        count = getattr(user, "login_attempt_count", 0)
        window_expires = getattr(user, "login_window_expires_at", None)
        if window_expires is None or now >= _as_utc(window_expires):
            # No window yet, or the previous one lapsed — start a fresh one.
            count = 0
            window_expires = now + timedelta(minutes=_LOGIN_ATTEMPT_WINDOW_MINUTES)

        if count >= _MAX_LOGIN_ATTEMPTS_PER_HOUR:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error_code": "LOGIN_RATE_LIMITED",
                    "message": (
                        "Too many login attempts. "
                        f"Try again after {to_local_str(window_expires)}."
                    ),
                },
            )

        await self.user_repo.update(
            user.id, login_attempt_count=count + 1, login_window_expires_at=window_expires
        )
        # This attempt must count even if the password check right after this
        # fails and get_db_session rolls back the request transaction —
        # commit now so the counter actually persists.
        await self.db.commit()

    async def _register_failed_login(
        self,
        user,
        device_identifier: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Record a failed-login event for the admin audit timeline."""
        await self._record_login_event(user.id, "login_failed", device_identifier, ip_address)
        # get_db_session rolls back the whole request transaction when the
        # caller raises INVALID_CREDENTIALS right after this — commit now so
        # the event actually persists instead of being undone.
        await self.db.commit()

    async def _record_login_event(
        self,
        user_id: uuid.UUID,
        event_type: str,
        device_identifier: str | None,
        ip_address: str | None,
    ) -> None:
        """Persist a login/logout/failed event, parsing the User-Agent for context."""
        parsed = parse_user_agent(device_identifier)
        await self.login_event_repo.record(
            user_id=user_id,
            event_type=event_type,
            ip_address=ip_address,
            user_agent=device_identifier,
            browser=parsed.browser,
            os=parsed.os,
            device_type=parsed.device_type,
        )

    async def logout(self, session_id: uuid.UUID) -> None:
        """Revoke a specific session and record the logout event."""
        session = await self.session_repo.get_by_id(session_id)
        await self.session_repo.revoke_session(session_id)
        if session is not None:
            await self.user_repo.update(
                session.user_id, last_logout_at=datetime.now(timezone.utc)
            )
            await self._record_login_event(
                session.user_id, "logout", session.device_identifier,
                str(session.ip_address) if session.ip_address is not None else None,
            )

    async def refresh(self, refresh_token: str) -> dict:
        """Find session by hash, validate, issue new access token, update last_seen."""
        import hashlib
        lookup_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        session = await self.session_repo.get_by_refresh_token_hash(lookup_hash)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error_code": "INVALID_REFRESH_TOKEN", "message": "Invalid or expired refresh token"},
            )
        user = await self.user_repo.get_by_id(session.user_id)
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error_code": "ACCOUNT_DEACTIVATED", "message": "This account is no longer active"},
            )
        await self.session_repo.update_last_seen(session.id)
        access_token = create_access_token(str(user.id), user.role, user.name)
        return {"access_token": access_token, "token_type": "bearer"}

    async def logout_all(self, user_id: uuid.UUID) -> None:
        """Revoke all sessions for a user and invalidate any outstanding access tokens."""
        now = datetime.now(timezone.utc)
        await self.session_repo.revoke_all_user_sessions(user_id)
        await self.user_repo.update(
            user_id, tokens_invalidated_at=now, last_logout_at=now
        )
        await self._record_login_event(user_id, "logout", None, None)

    # TODO(TEMP_PASSWORD_AUTH): Remove this method when replacing password-based auth
    async def change_password(
        self, user_id: uuid.UUID, current_password: str, new_password: str
    ) -> None:
        """Verify current password, then update to new password."""
        if len(new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error_code": "WEAK_PASSWORD", "message": "Password must be at least 8 characters"},
            )
        user = await self.user_repo.get_by_id(user_id)
        if user is None or not _verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error_code": "INVALID_CREDENTIALS", "message": "Current password is incorrect"},
            )
        new_hash = _hash_password(new_password)
        await self.user_repo.update(
            user_id,
            password_hash=new_hash,
            is_temp_password=False,
            password_changed_at=datetime.now(timezone.utc),
        )

    async def _create_session_and_tokens(
        self,
        user,
        device_identifier: str | None,
        ip_address: str | None,
    ) -> dict:
        import hashlib
        refresh_token = generate_refresh_token()
        lookup_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
        await self.session_repo.create_session(
            user_id=user.id,
            refresh_token_hash=lookup_hash,
            device_identifier=device_identifier,
            ip_address=ip_address,
            expires_at=expires_at,
        )
        # Real login/activity tracking: bump the user's login summary and record
        # a login_success event so the admin console can render a login timeline.
        await self.user_repo.bump_login(user.id, datetime.now(timezone.utc))
        await self._record_login_event(user.id, "login_success", device_identifier, ip_address)
        access_token = create_access_token(str(user.id), user.role, user.name)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
