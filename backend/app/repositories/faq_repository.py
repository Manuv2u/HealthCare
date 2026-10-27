"""FAQ repository: CRUD + ordered listings for the general FAQ."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.faq import Faq


class FaqRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_active(self) -> list[Faq]:
        result = await self.db.execute(
            select(Faq)
            .where(Faq.is_active.is_(True))
            .order_by(Faq.display_order.asc(), Faq.created_at.asc())
        )
        return list(result.scalars().all())

    async def list_all(self) -> list[Faq]:
        result = await self.db.execute(
            select(Faq).order_by(Faq.display_order.asc(), Faq.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, faq_id: uuid.UUID) -> Faq | None:
        result = await self.db.execute(select(Faq).where(Faq.id == faq_id))
        return result.scalar_one_or_none()

    async def create(self, **fields) -> Faq:
        faq = Faq(**fields)
        self.db.add(faq)
        await self.db.flush()
        await self.db.refresh(faq)
        return faq

    async def update(self, faq: Faq, **fields) -> Faq:
        for key, value in fields.items():
            setattr(faq, key, value)
        await self.db.flush()
        await self.db.refresh(faq)
        return faq

    async def delete(self, faq: Faq) -> None:
        await self.db.delete(faq)
        await self.db.flush()

    async def max_display_order(self) -> int:
        result = await self.db.execute(select(Faq.display_order))
        orders = list(result.scalars().all())
        return max(orders) if orders else 0
