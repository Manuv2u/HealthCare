"""Banner repository: CRUD + ordered listings for the hero carousel."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.banner import Banner


class BannerRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_live(self) -> list[Banner]:
        """Published banners."""
        result = await self.db.execute(
            select(Banner)
            .where(Banner.status == "published")
            .order_by(Banner.display_order.asc(), Banner.created_at.asc())
        )
        return list(result.scalars().all())

    async def list_all(self) -> list[Banner]:
        result = await self.db.execute(
            select(Banner).order_by(
                Banner.display_order.asc(), Banner.created_at.asc()
            )
        )
        return list(result.scalars().all())

    async def get_by_id(self, banner_id: uuid.UUID) -> Banner | None:
        result = await self.db.execute(select(Banner).where(Banner.id == banner_id))
        return result.scalar_one_or_none()

    async def create(self, **fields) -> Banner:
        banner = Banner(**fields)
        self.db.add(banner)
        await self.db.flush()
        await self.db.refresh(banner)
        return banner

    async def update(self, banner: Banner, **fields) -> Banner:
        for key, value in fields.items():
            setattr(banner, key, value)
        await self.db.flush()
        await self.db.refresh(banner)
        return banner

    async def delete(self, banner: Banner) -> None:
        await self.db.delete(banner)
        await self.db.flush()

    async def max_display_order(self) -> int:
        result = await self.db.execute(select(Banner.display_order))
        orders = [o for o in result.scalars().all()]
        return max(orders) if orders else 0

    async def count(self) -> int:
        result = await self.db.execute(select(Banner.id))
        return len(list(result.scalars().all()))
