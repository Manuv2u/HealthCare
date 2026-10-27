"""Package repository class."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test import Package, PackageTest, Test


class PackageRepository:
    """Async CRUD operations for the packages table."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        name: str,
        description: str | None,
        original_price: float,
        discounted_price: float,
        is_popular: bool = False,
    ) -> Package:
        pkg = Package(
            id=uuid.uuid4(),
            name=name,
            description=description,
            original_price=original_price,
            discounted_price=discounted_price,
            is_popular=is_popular,
        )
        self.db.add(pkg)
        await self.db.flush()
        await self.db.refresh(pkg)
        return pkg

    async def get_by_id(
        self, package_id: uuid.UUID, include_deleted: bool = False
    ) -> Package | None:
        stmt = select(Package).where(Package.id == package_id)
        if not include_deleted:
            stmt = stmt.where(Package.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self,
        active_only: bool = True,
        page: int = 1,
        page_size: int = 20,
        package_ids: list[uuid.UUID] | None = None,
    ) -> tuple[list[Package], int]:
        base_query = select(Package)
        count_query = select(func.count()).select_from(Package)

        if active_only:
            base_query = base_query.where(Package.deleted_at.is_(None), Package.is_active.is_(True))
            count_query = count_query.where(Package.deleted_at.is_(None), Package.is_active.is_(True))
        else:
            base_query = base_query.where(Package.deleted_at.is_(None))
            count_query = count_query.where(Package.deleted_at.is_(None))

        if package_ids is not None:
            base_query = base_query.where(Package.id.in_(package_ids))
            count_query = count_query.where(Package.id.in_(package_ids))

        base_query = base_query.order_by(Package.created_at.desc())
        offset = (page - 1) * page_size
        base_query = base_query.limit(page_size).offset(offset)

        items_result = await self.db.execute(base_query)
        count_result = await self.db.execute(count_query)

        return list(items_result.scalars().all()), count_result.scalar_one()

    async def update(self, package_id: uuid.UUID, **fields: object) -> Package | None:
        if not fields:
            return await self.get_by_id(package_id)
        await self.db.execute(
            update(Package).where(Package.id == package_id).values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(package_id)

    async def soft_delete(self, package_id: uuid.UUID) -> None:
        await self.db.execute(
            update(Package)
            .where(Package.id == package_id)
            .values(deleted_at=datetime.now(timezone.utc), is_active=False)
        )
        await self.db.flush()

    async def add_tests(self, package_id: uuid.UUID, test_ids: list[uuid.UUID]) -> None:
        if not test_ids:
            return
        stmt = (
            pg_insert(PackageTest)
            .values([{"package_id": package_id, "test_id": tid} for tid in test_ids])
            .on_conflict_do_nothing()
        )
        await self.db.execute(stmt)
        await self.db.flush()

    async def set_tests(self, package_id: uuid.UUID, test_ids: list[uuid.UUID]) -> None:
        await self.db.execute(
            delete(PackageTest).where(PackageTest.package_id == package_id)
        )
        if test_ids:
            stmt = (
                pg_insert(PackageTest)
                .values([{"package_id": package_id, "test_id": tid} for tid in test_ids])
                .on_conflict_do_nothing()
            )
            await self.db.execute(stmt)
        await self.db.flush()

    async def remove_tests(self, package_id: uuid.UUID, test_ids: list[uuid.UUID]) -> None:
        if not test_ids:
            return
        await self.db.execute(
            delete(PackageTest).where(
                PackageTest.package_id == package_id,
                PackageTest.test_id.in_(test_ids),
            )
        )
        await self.db.flush()

    async def get_active_tests(self, package_id: uuid.UUID) -> list[Test]:
        result = await self.db.execute(
            select(Test)
            .join(PackageTest, PackageTest.test_id == Test.id)
            .where(
                PackageTest.package_id == package_id,
                Test.deleted_at.is_(None),
            )
        )
        return list(result.scalars().all())
