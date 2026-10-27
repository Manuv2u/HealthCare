"""HealthConcern repository: concern list + test/package mappings."""
from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health_concern import HealthConcern, PackageHealthConcern, TestHealthConcern


class HealthConcernRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_active(self) -> list[HealthConcern]:
        result = await self.db.execute(
            select(HealthConcern)
            .where(HealthConcern.is_active.is_(True))
            .order_by(HealthConcern.display_order.asc())
        )
        return list(result.scalars().all())

    async def list_all(self) -> list[HealthConcern]:
        result = await self.db.execute(
            select(HealthConcern).order_by(HealthConcern.display_order.asc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, concern_id: uuid.UUID) -> HealthConcern | None:
        result = await self.db.execute(
            select(HealthConcern).where(HealthConcern.id == concern_id)
        )
        return result.scalar_one_or_none()

    async def get_test_ids(self, concern_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.db.execute(
            select(TestHealthConcern.test_id).where(
                TestHealthConcern.health_concern_id == concern_id
            )
        )
        return list(result.scalars().all())

    async def get_package_ids(self, concern_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.db.execute(
            select(PackageHealthConcern.package_id).where(
                PackageHealthConcern.health_concern_id == concern_id
            )
        )
        return list(result.scalars().all())

    async def set_test_mappings(self, concern_id: uuid.UUID, test_ids: list[uuid.UUID]) -> None:
        await self.db.execute(
            delete(TestHealthConcern).where(TestHealthConcern.health_concern_id == concern_id)
        )
        if test_ids:
            stmt = pg_insert(TestHealthConcern).values(
                [{"health_concern_id": concern_id, "test_id": tid} for tid in test_ids]
            ).on_conflict_do_nothing()
            await self.db.execute(stmt)
        await self.db.flush()

    async def set_package_mappings(self, concern_id: uuid.UUID, package_ids: list[uuid.UUID]) -> None:
        await self.db.execute(
            delete(PackageHealthConcern).where(PackageHealthConcern.health_concern_id == concern_id)
        )
        if package_ids:
            stmt = pg_insert(PackageHealthConcern).values(
                [{"health_concern_id": concern_id, "package_id": pid} for pid in package_ids]
            ).on_conflict_do_nothing()
            await self.db.execute(stmt)
        await self.db.flush()

    async def keys_to_test_ids(self, keys: list[str]) -> list[uuid.UUID]:
        result = await self.db.execute(
            select(TestHealthConcern.test_id)
            .join(HealthConcern, HealthConcern.id == TestHealthConcern.health_concern_id)
            .where(HealthConcern.key.in_(keys))
            .distinct()
        )
        return list(result.scalars().all())

    async def keys_to_package_ids(self, keys: list[str]) -> list[uuid.UUID]:
        result = await self.db.execute(
            select(PackageHealthConcern.package_id)
            .join(HealthConcern, HealthConcern.id == PackageHealthConcern.health_concern_id)
            .where(HealthConcern.key.in_(keys))
            .distinct()
        )
        return list(result.scalars().all())
