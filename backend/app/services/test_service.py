"""Test service — business logic for test management."""
from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test import Test
from app.repositories.test_repository import TestRepository


def _effective_price(price: object, discount_percentage: object) -> float:
    p = float(price)
    d = float(discount_percentage)
    return round(p * (1 - d / 100), 2)


def _test_to_dict(test: Test) -> dict:
    return {
        "id": test.id,
        "name": test.name,
        "category": test.category,
        "description": test.description,
        "price": test.price,
        "discount_percentage": test.discount_percentage,
        "turnaround_hours": test.turnaround_hours,
        "is_active": test.is_active,
        "is_popular": test.is_popular,
        "effective_price": _effective_price(test.price, test.discount_percentage),
        "sample_type": test.sample_type,
        "recommended_for": test.recommended_for,
        "feature_cards": test.feature_cards or [],
        "faqs": test.faqs or [],
    }


class TestService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = TestRepository(db)

    async def create_test(
        self,
        name: str,
        category: str,
        description: str | None,
        price: Decimal,
        discount_percentage: Decimal,
        turnaround_hours: int,
        is_popular: bool = False,
        sample_type: str | None = None,
        recommended_for: list[str] | None = None,
        feature_cards: list[dict] | None = None,
        faqs: list[dict] | None = None,
    ) -> dict:
        test = await self.repo.create(
            name=name,
            category=category,
            description=description,
            price=price,
            discount_percentage=discount_percentage,
            turnaround_hours=turnaround_hours,
            is_popular=is_popular,
            sample_type=sample_type,
            recommended_for=recommended_for,
            feature_cards=feature_cards,
            faqs=faqs,
        )
        return _test_to_dict(test)

    async def get_test(self, test_id: uuid.UUID) -> dict:
        test = await self.repo.get_by_id(test_id)
        if test is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "TEST_NOT_FOUND", "message": "Test not found"},
            )
        return _test_to_dict(test)

    async def list_tests(
        self,
        q: str | None,
        category: str | None,
        page: int,
        page_size: int,
        include_deleted: bool,
        requester_role: str,
        health_concern: str | None = None,
    ) -> dict:
        # Only admins may request deleted records
        if include_deleted and requester_role != "admin":
            include_deleted = False

        # Non-admins only see active tests
        active_only = requester_role != "admin"

        test_ids = None
        if health_concern:
            from app.repositories.health_concern_repository import HealthConcernRepository

            keys = [k.strip() for k in health_concern.split(",") if k.strip()]
            test_ids = await HealthConcernRepository(self.db).keys_to_test_ids(keys)

        items, total = await self.repo.list(
            q=q,
            category=category,
            page=page,
            page_size=page_size,
            include_deleted=include_deleted,
            active_only=active_only,
            test_ids=test_ids,
        )
        return {
            "items": [_test_to_dict(t) for t in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def update_test(self, test_id: uuid.UUID, **fields: object) -> dict:
        test = await self.repo.get_by_id(test_id)
        if test is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "TEST_NOT_FOUND", "message": "Test not found"},
            )
        updated = await self.repo.update(test_id, **fields)
        return _test_to_dict(updated)  # type: ignore[arg-type]

    async def delete_test(self, test_id: uuid.UUID) -> None:
        test = await self.repo.get_by_id(test_id)
        if test is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "TEST_NOT_FOUND", "message": "Test not found"},
            )
        await self.repo.soft_delete(test_id)
