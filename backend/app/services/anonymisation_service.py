"""User anonymisation service — GDPR-style data erasure."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import FamilyMember, User

logger = logging.getLogger("sri.anonymisation")

_ANONYMISE_AFTER_DAYS = 30


class AnonymisationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def anonymise_user(self, user_id: uuid.UUID) -> None:
        """Anonymise PII for a user and their family members."""
        now = datetime.now(timezone.utc)

        # Anonymise family members
        await self.db.execute(
            update(FamilyMember)
            .where(FamilyMember.user_id == user_id)
            .values(
                name="[DELETED]",
                date_of_birth=None,
                gender=None,
            )
        )

        # Anonymise user
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                name="[DELETED]",
                phone=None,
                email=None,
                date_of_birth=None,
                deleted_at=now,
                is_active=False,
            )
        )
        await self.db.flush()

        from app.utils.audit import audit
        await audit(
            self.db,
            action_type="USER_ANONYMISED",
            entity_type="user",
            entity_id=str(user_id),
            outcome="success",
        )
        logger.info("user_anonymised: user_id=%s", user_id)

    async def process_pending_deletions(self) -> int:
        """Process users who requested deletion > 30 days ago."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=_ANONYMISE_AFTER_DAYS)
        result = await self.db.execute(
            select(User).where(
                User.deletion_requested_at.isnot(None),
                User.deletion_requested_at <= cutoff,
                User.deleted_at.is_(None),
            )
        )
        users = list(result.scalars().all())
        for user in users:
            try:
                await self.anonymise_user(user.id)
            except Exception as exc:
                logger.error("anonymisation_failed: user_id=%s error=%s", user.id, exc)
        return len(users)


async def run_anonymisation_job() -> None:
    """APScheduler entry point — daily."""
    from app.database import AsyncSessionFactory
    async with AsyncSessionFactory() as db:
        svc = AnonymisationService(db)
        count = await svc.process_pending_deletions()
        await db.commit()
        logger.info("anonymisation_job_complete: processed=%d", count)
