"""HealthConcernService: concern list + admin test/package mapping."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.health_concern_repository import HealthConcernRepository


class HealthConcernService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = HealthConcernRepository(db)

    async def list_active(self):
        return await self.repo.list_active()

    async def get_mappings(self, concern_id: uuid.UUID) -> dict:
        concern = await self.repo.get_by_id(concern_id)
        if concern is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "HEALTH_CONCERN_NOT_FOUND", "message": "Health concern not found"},
            )
        return {
            "test_ids": await self.repo.get_test_ids(concern_id),
            "package_ids": await self.repo.get_package_ids(concern_id),
        }

    async def set_test_mappings(self, concern_id: uuid.UUID, test_ids: list[uuid.UUID]) -> None:
        concern = await self.repo.get_by_id(concern_id)
        if concern is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "HEALTH_CONCERN_NOT_FOUND", "message": "Health concern not found"},
            )
        await self.repo.set_test_mappings(concern_id, test_ids)

    async def set_package_mappings(self, concern_id: uuid.UUID, package_ids: list[uuid.UUID]) -> None:
        concern = await self.repo.get_by_id(concern_id)
        if concern is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "HEALTH_CONCERN_NOT_FOUND", "message": "Health concern not found"},
            )
        await self.repo.set_package_mappings(concern_id, package_ids)
