"""Test and Package repository classes."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test import Package, PackageTest, Test


class TestRepository:
    """Async CRUD operations for the tests table."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        name: str,
        category: str,
        description: str | None,
        price: float,
        discount_percentage: float,
        turnaround_hours: int,
        is_popular: bool = False,
        sample_type: str | None = None,
        recommended_for: list[str] | None = None,
        feature_cards: list[dict] | None = None,
        faqs: list[dict] | None = None,
    ) -> Test:
        test = Test(
            id=uuid.uuid4(),
            name=name,
            category=category,
            description=description,
            price=price,
            discount_percentage=discount_percentage,
            turnaround_hours=turnaround_hours,
            is_popular=is_popular,
            sample_type=sample_type,
            recommended_for=recommended_for,
            feature_cards=feature_cards or [],
            faqs=faqs or [],
        )
        self.db.add(test)
        await self.db.flush()
        await self.db.refresh(test)
        return test

    async def get_by_id(self, test_id: uuid.UUID) -> Test | None:
        result = await self.db.execute(
            select(Test).where(Test.id == test_id, Test.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        q: str | None = None,
        category: str | None = None,
        page: int = 1,
        page_size: int = 20,
        include_deleted: bool = False,
        active_only: bool = False,
        test_ids: list[uuid.UUID] | None = None,
    ) -> tuple[list[Test], int]:
        base_query = select(Test)
        count_query = select(func.count()).select_from(Test)

        filters = []
        if not include_deleted:
            filters.append(Test.deleted_at.is_(None))
        # Non-admin users only see active tests
        if active_only:
            filters.append(Test.is_active.is_(True))
        if category:
            filters.append(Test.category == category)
        if test_ids is not None:
            filters.append(Test.id.in_(test_ids))

        if q:
            tsquery = func.plainto_tsquery("english", q)
            fts_condition = Test.search_vector.op("@@")(tsquery)
            trigram_condition = func.similarity(Test.name, q) > 0.2
            filters.append(or_(fts_condition, trigram_condition))

        for f in filters:
            base_query = base_query.where(f)
            count_query = count_query.where(f)

        if q:
            tsquery = func.plainto_tsquery("english", q)
            base_query = base_query.order_by(
                func.ts_rank(Test.search_vector, tsquery).desc()
            )
        else:
            base_query = base_query.order_by(Test.created_at.desc())

        offset = (page - 1) * page_size
        base_query = base_query.limit(page_size).offset(offset)

        items_result = await self.db.execute(base_query)
        count_result = await self.db.execute(count_query)

        items = list(items_result.scalars().all())
        total = count_result.scalar_one()
        return items, total

    async def update(self, test_id: uuid.UUID, **fields: object) -> Test | None:
        if not fields:
            return await self.get_by_id(test_id)
        await self.db.execute(
            update(Test).where(Test.id == test_id).values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(test_id)

    async def soft_delete(self, test_id: uuid.UUID) -> None:
        await self.db.execute(
            update(Test)
            .where(Test.id == test_id)
            .values(deleted_at=datetime.now(timezone.utc), is_active=False)
        )
        await self.db.flush()
