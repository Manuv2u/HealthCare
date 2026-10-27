"""FeatureFlagRepository."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import FeatureFlag

_DEFAULTS = [
    ("home_collection", True, "Enable home sample collection bookings"),
    ("online_payment", True, "Enable online payment gateway"),
    ("notify_me", True, "Enable Notify Me for uncovered pincodes"),
]


class FeatureFlagRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_key(self, key: str) -> FeatureFlag | None:
        result = await self.db.execute(
            select(FeatureFlag).where(FeatureFlag.key == key)
        )
        return result.scalar_one_or_none()

    async def list_all(self) -> list[FeatureFlag]:
        result = await self.db.execute(
            select(FeatureFlag).order_by(FeatureFlag.key)
        )
        return list(result.scalars().all())

    async def get_by_id(self, flag_id: uuid.UUID) -> FeatureFlag | None:
        result = await self.db.execute(
            select(FeatureFlag).where(FeatureFlag.id == flag_id)
        )
        return result.scalar_one_or_none()

    async def update_by_id(
        self,
        flag_id: uuid.UUID,
        is_enabled: bool | None = None,
        description: str | None = None,
        updated_by: uuid.UUID | None = None,
    ) -> FeatureFlag | None:
        """Partial update of an existing flag. Returns None when the id is unknown."""
        flag = await self.get_by_id(flag_id)
        if flag is None:
            return None
        values: dict = {"updated_by": updated_by, "updated_at": datetime.now(timezone.utc)}
        if is_enabled is not None:
            values["is_enabled"] = is_enabled
        if description is not None:
            values["description"] = description
        from sqlalchemy import update as sa_update

        await self.db.execute(
            sa_update(FeatureFlag).where(FeatureFlag.id == flag_id).values(**values)
        )
        await self.db.flush()
        return await self.get_by_id(flag_id)

    async def upsert(
        self,
        key: str,
        is_enabled: bool,
        description: str | None = None,
        updated_by: uuid.UUID | None = None,
    ) -> FeatureFlag:
        now = datetime.now(timezone.utc)
        stmt = (
            insert(FeatureFlag)
            .values(
                id=uuid.uuid4(),
                key=key,
                is_enabled=is_enabled,
                description=description,
                updated_by=updated_by,
                updated_at=now,
                created_at=now,
            )
            .on_conflict_do_update(
                index_elements=["key"],
                set_={
                    "is_enabled": is_enabled,
                    "updated_by": updated_by,
                    "updated_at": now,
                },
            )
        )
        await self.db.execute(stmt)
        await self.db.flush()
        return await self.get_by_key(key)  # type: ignore[return-value]

    async def seed_defaults(self) -> None:
        """INSERT defaults if they don't exist (ON CONFLICT DO NOTHING)."""
        now = datetime.now(timezone.utc)
        for key, enabled, desc in _DEFAULTS:
            stmt = (
                insert(FeatureFlag)
                .values(
                    id=uuid.uuid4(),
                    key=key,
                    is_enabled=enabled,
                    description=desc,
                    updated_at=now,
                    created_at=now,
                )
                .on_conflict_do_nothing(index_elements=["key"])
            )
            await self.db.execute(stmt)
        await self.db.flush()
