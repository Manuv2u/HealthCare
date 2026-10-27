"""User, Session, and FamilyMember repository classes."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import (
    AdminNote,
    EmailVerificationOtp,
    FamilyMember,
    LoginEvent,
    PasswordResetToken,
    Session,
    User,
)


class UserRepository:
    """Async CRUD operations for the users table."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_user(
        self,
        name: str,
        phone: str | None,
        email: str | None,
        password_hash: str,
        role: str = "user",
        is_temp_password: bool = False,
        email_verified_at: datetime | None = None,
    ) -> User:
        user = User(
            id=uuid.uuid4(),
            name=name,
            phone=phone,
            email=email,
            password_hash=password_hash,
            role=role,
            is_temp_password=is_temp_password,
            email_verified_at=email_verified_at,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def get_by_phone(self, phone: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.phone == phone, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(
                func.lower(User.email) == email.lower(), User.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def bump_login(self, user_id: uuid.UUID, at: datetime) -> None:
        """Atomically increment login_count and update login timestamps."""
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                login_count=User.login_count + 1,
                last_login_at=at,
                first_login_at=func.coalesce(User.first_login_at, at),
            )
        )
        await self.db.flush()

    async def soft_delete(self, user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(deleted_at=datetime.now(timezone.utc))
        )
        await self.db.flush()

    async def update(self, user_id: uuid.UUID, **fields: object) -> User | None:
        if not fields:
            return await self.get_by_id(user_id)
        await self.db.execute(
            update(User).where(User.id == user_id).values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(user_id)


class SessionRepository:
    """Async CRUD operations for the sessions table."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_session(
        self,
        user_id: uuid.UUID,
        refresh_token_hash: str,
        device_identifier: str | None,
        ip_address: str | None,
        expires_at: datetime,
    ) -> Session:
        session = Session(
            id=uuid.uuid4(),
            user_id=user_id,
            refresh_token_hash=refresh_token_hash,
            device_identifier=device_identifier,
            ip_address=ip_address,
            last_seen_at=datetime.now(timezone.utc),
            expires_at=expires_at,
        )
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)
        return session

    async def get_by_id(self, session_id: uuid.UUID) -> Session | None:
        result = await self.db.execute(select(Session).where(Session.id == session_id))
        return result.scalar_one_or_none()

    async def get_by_refresh_token_hash(self, token_hash: str) -> Session | None:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(Session).where(
                Session.refresh_token_hash == token_hash,
                Session.revoked_at.is_(None),
                Session.expires_at > now,
            )
        )
        return result.scalar_one_or_none()

    async def revoke_session(self, session_id: uuid.UUID) -> None:
        await self.db.execute(
            update(Session)
            .where(Session.id == session_id)
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await self.db.flush()

    async def revoke_all_user_sessions(self, user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(Session)
            .where(Session.user_id == user_id, Session.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await self.db.flush()

    async def update_last_seen(self, session_id: uuid.UUID) -> None:
        await self.db.execute(
            update(Session)
            .where(Session.id == session_id)
            .values(last_seen_at=datetime.now(timezone.utc))
        )
        await self.db.flush()

    async def list_user_sessions(self, user_id: uuid.UUID) -> list[Session]:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(Session).where(
                Session.user_id == user_id,
                Session.revoked_at.is_(None),
                Session.expires_at > now,
            )
        )
        return list(result.scalars().all())


class FamilyMemberRepository:
    """Async CRUD operations for the family_members table."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        user_id: uuid.UUID,
        name: str,
        relationship: str,
        date_of_birth: object = None,
        gender: str | None = None,
    ) -> FamilyMember:
        member = FamilyMember(
            id=uuid.uuid4(),
            user_id=user_id,
            name=name,
            relationship_type=relationship,
            date_of_birth=date_of_birth,
            gender=gender,
        )
        self.db.add(member)
        await self.db.flush()
        await self.db.refresh(member)
        return member

    async def get_by_id(self, member_id: uuid.UUID) -> FamilyMember | None:
        result = await self.db.execute(
            select(FamilyMember).where(
                FamilyMember.id == member_id,
                FamilyMember.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> list[FamilyMember]:
        result = await self.db.execute(
            select(FamilyMember).where(
                FamilyMember.user_id == user_id,
                FamilyMember.deleted_at.is_(None),
            )
        )
        return list(result.scalars().all())

    async def count_by_user(self, user_id: uuid.UUID) -> int:
        members = await self.list_by_user(user_id)
        return len(members)

    async def update(self, member_id: uuid.UUID, **fields: object) -> FamilyMember | None:
        if not fields:
            return await self.get_by_id(member_id)
        await self.db.execute(
            update(FamilyMember).where(FamilyMember.id == member_id).values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(member_id)

    async def soft_delete(self, member_id: uuid.UUID) -> None:
        await self.db.execute(
            update(FamilyMember)
            .where(FamilyMember.id == member_id)
            .values(deleted_at=datetime.now(timezone.utc))
        )
        await self.db.flush()

    async def find_by_name_and_dob(
        self, user_id: uuid.UUID, name: str, date_of_birth: object
    ) -> FamilyMember | None:
        from sqlalchemy import func
        result = await self.db.execute(
            select(FamilyMember).where(
                FamilyMember.user_id == user_id,
                func.lower(FamilyMember.name) == func.lower(name),
                FamilyMember.date_of_birth == date_of_birth,
                FamilyMember.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()


class LoginEventRepository:
    """Async operations for the login_events table."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def record(
        self,
        user_id: uuid.UUID,
        event_type: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        browser: str | None = None,
        os: str | None = None,
        device_type: str | None = None,
    ) -> LoginEvent:
        event = LoginEvent(
            id=uuid.uuid4(),
            user_id=user_id,
            event_type=event_type,
            ip_address=ip_address,
            user_agent=user_agent,
            browser=browser,
            os=os,
            device_type=device_type,
        )
        self.db.add(event)
        await self.db.flush()
        return event

    async def list_by_user(
        self, user_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> tuple[list[LoginEvent], int]:
        from sqlalchemy import func

        base = select(LoginEvent).where(LoginEvent.user_id == user_id)
        total = (
            await self.db.execute(select(func.count()).select_from(base.subquery()))
        ).scalar_one()
        result = await self.db.execute(
            base.order_by(LoginEvent.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total

    async def distinct_ips(self, user_id: uuid.UUID, limit: int = 20) -> list[dict]:
        """Distinct IPs the user has authenticated from, with last-seen timestamp."""
        from sqlalchemy import func

        result = await self.db.execute(
            select(
                LoginEvent.ip_address,
                func.max(LoginEvent.created_at).label("last_seen"),
                func.count().label("count"),
            )
            .where(LoginEvent.user_id == user_id, LoginEvent.ip_address.isnot(None))
            .group_by(LoginEvent.ip_address)
            .order_by(func.max(LoginEvent.created_at).desc())
            .limit(limit)
        )
        return [
            {"ip_address": str(row[0]), "last_seen": row[1], "count": row[2]}
            for row in result.all()
        ]


class AdminNoteRepository:
    """Async operations for the admin_notes table."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        user_id: uuid.UUID,
        author_id: uuid.UUID,
        note: str,
        is_internal: bool = True,
    ) -> AdminNote:
        row = AdminNote(
            id=uuid.uuid4(),
            user_id=user_id,
            author_id=author_id,
            note=note,
            is_internal=is_internal,
        )
        self.db.add(row)
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def list_by_user(self, user_id: uuid.UUID) -> list[AdminNote]:
        result = await self.db.execute(
            select(AdminNote)
            .where(AdminNote.user_id == user_id, AdminNote.deleted_at.is_(None))
            .order_by(AdminNote.created_at.desc())
        )
        return list(result.scalars().all())

    async def soft_delete(self, note_id: uuid.UUID) -> None:
        await self.db.execute(
            update(AdminNote)
            .where(AdminNote.id == note_id)
            .values(deleted_at=datetime.now(timezone.utc))
        )
        await self.db.flush()


# TODO(TEMP_PASSWORD_AUTH): Remove this class when replacing password-based auth
class PasswordResetTokenRepository:
    """Async CRUD for password_reset_tokens (temporary password auth)."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, user_id: uuid.UUID, token_hash: str, expires_at: datetime) -> PasswordResetToken:
        token = PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.db.add(token)
        await self.db.flush()
        await self.db.refresh(token)
        return token

    async def get_by_hash(self, token_hash: str) -> PasswordResetToken | None:
        """Fetch a token row regardless of expiry/used state, so callers can
        distinguish invalid vs. expired vs. already-used tokens."""
        result = await self.db.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def mark_used(self, token_id: uuid.UUID) -> None:
        await self.db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.id == token_id)
            .values(used_at=datetime.now(timezone.utc))
        )
        await self.db.flush()

    async def invalidate_user_tokens(self, user_id: uuid.UUID) -> None:
        """Mark all unused tokens for a user as used."""
        await self.db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
            .values(used_at=datetime.now(timezone.utc))
        )
        await self.db.flush()


class EmailVerificationOtpRepository:
    """Async CRUD for email_verification_otps (registration email verification)."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, user_id: uuid.UUID, code_hash: str, expires_at: datetime) -> EmailVerificationOtp:
        otp = EmailVerificationOtp(
            id=uuid.uuid4(),
            user_id=user_id,
            code_hash=code_hash,
            expires_at=expires_at,
        )
        self.db.add(otp)
        await self.db.flush()
        await self.db.refresh(otp)
        return otp

    async def get_latest_for_user(self, user_id: uuid.UUID) -> EmailVerificationOtp | None:
        """Most recent OTP row for this user, regardless of state — verification
        only ever checks against the latest one, so requesting a new code
        implicitly supersedes any earlier one."""
        result = await self.db.execute(
            select(EmailVerificationOtp)
            .where(EmailVerificationOtp.user_id == user_id)
            .order_by(EmailVerificationOtp.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def increment_attempts(self, otp_id: uuid.UUID) -> None:
        await self.db.execute(
            update(EmailVerificationOtp)
            .where(EmailVerificationOtp.id == otp_id)
            .values(attempts=EmailVerificationOtp.attempts + 1)
        )
        await self.db.flush()

    async def mark_verified(self, otp_id: uuid.UUID) -> None:
        await self.db.execute(
            update(EmailVerificationOtp)
            .where(EmailVerificationOtp.id == otp_id)
            .values(verified_at=datetime.now(timezone.utc))
        )
        await self.db.flush()
