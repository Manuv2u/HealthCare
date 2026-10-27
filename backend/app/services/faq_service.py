"""FaqService: general application FAQ listing + admin CRUD."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.faq import Faq
from app.repositories.faq_repository import FaqRepository
from app.schemas.faqs import FaqCreate, FaqUpdate


class FaqService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = FaqRepository(db)

    async def list_active(self) -> list[Faq]:
        return await self.repo.list_active()

    async def list_all(self) -> list[Faq]:
        return await self.repo.list_all()

    async def get(self, faq_id: uuid.UUID) -> Faq:
        faq = await self.repo.get_by_id(faq_id)
        if faq is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "FAQ_NOT_FOUND", "message": "FAQ not found"},
            )
        return faq

    async def create(self, body: FaqCreate) -> Faq:
        fields = body.model_dump()
        if not fields.get("display_order"):
            fields["display_order"] = await self.repo.max_display_order() + 1
        return await self.repo.create(**fields)

    async def update(self, faq_id: uuid.UUID, body: FaqUpdate) -> Faq:
        faq = await self.get(faq_id)
        fields = body.model_dump(exclude_unset=True)
        return await self.repo.update(faq, **fields)

    async def delete(self, faq_id: uuid.UUID) -> None:
        faq = await self.get(faq_id)
        await self.repo.delete(faq)

    async def reorder(self, items: list) -> None:
        for item in items:
            faq = await self.repo.get_by_id(item.id)
            if faq:
                await self.repo.update(faq, display_order=item.display_order)
