"""FeatureFlagService — TTL-cached feature flag lookups."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.feature_flag_repository import FeatureFlagRepository

_TTL_SECONDS = 60

# In-process cache: key -> (is_enabled, cached_at)
_cache: dict[str, tuple[bool, datetime]] = {}


class FeatureFlagService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = FeatureFlagRepository(db)

    async def is_enabled(self, key: str) -> bool:
        """Return flag value; use cache if fresh (< 60s old)."""
        now = datetime.now(timezone.utc)
        if key in _cache:
            value, cached_at = _cache[key]
            if now - cached_at < timedelta(seconds=_TTL_SECONDS):
                return value

        flag = await self.repo.get_by_key(key)
        result = flag.is_enabled if flag is not None else False
        _cache[key] = (result, now)
        return result

    async def list_all(self) -> list[dict]:
        flags = await self.repo.list_all()
        return [_flag_to_dict(f) for f in flags]

    async def upsert(
        self,
        key: str,
        is_enabled: bool,
        description: str | None = None,
        updated_by: uuid.UUID | None = None,
    ) -> dict:
        flag = await self.repo.upsert(
            key=key,
            is_enabled=is_enabled,
            description=description,
            updated_by=updated_by,
        )
        # Invalidate cache
        _cache.pop(key, None)
        return _flag_to_dict(flag)

    async def update_flag(
        self,
        flag_id: uuid.UUID,
        is_enabled: bool | None = None,
        description: str | None = None,
        updated_by: uuid.UUID | None = None,
    ) -> dict:
        """Partial update by id — what the admin toggle actually needs."""
        flag = await self.repo.update_by_id(
            flag_id=flag_id,
            is_enabled=is_enabled,
            description=description,
            updated_by=updated_by,
        )
        if flag is None:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "FLAG_NOT_FOUND", "message": "Feature flag not found"},
            )
        _cache.pop(flag.key, None)
        return _flag_to_dict(flag)

    async def seed_defaults(self) -> None:
        await self.repo.seed_defaults()


def _flag_to_dict(flag) -> dict:  # type: ignore[no-untyped-def]
    return {
        "id": flag.id,
        "key": flag.key,
        "is_enabled": flag.is_enabled,
        "description": flag.description,
        "updated_by": flag.updated_by,
        "updated_at": flag.updated_at,
        "created_at": flag.created_at,
    }
