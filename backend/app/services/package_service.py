"""Package service — business logic for package management."""
from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.coupon import Coupon
from app.models.test import Package, Test
from app.repositories.coupon_repository import CouponRepository
from app.repositories.package_repository import PackageRepository
from app.services.test_service import _effective_price, _test_to_dict


def _package_to_dict(pkg: Package, tests: list[Test], eligible_coupon: Coupon | None = None) -> dict:
    return {
        "id": pkg.id,
        "name": pkg.name,
        "description": pkg.description,
        "original_price": pkg.original_price,
        "discounted_price": pkg.discounted_price,
        "is_active": pkg.is_active,
        "is_popular": pkg.is_popular,
        "tests": [_test_to_dict(t) for t in tests],
        "eligible_coupon": (
            {
                "code": eligible_coupon.code,
                "discount_type": eligible_coupon.discount_type,
                "discount_value": eligible_coupon.discount_value,
            }
            if eligible_coupon
            else None
        ),
    }


def _best_coupon(pkg: Package, coupons: list[Coupon]) -> Coupon | None:
    """When more than one live coupon covers a package, prefer whichever
    discounts it the most, tie-broken by the soonest expiry."""
    if not coupons:
        return None

    def _discount(c: Coupon) -> float:
        price = float(pkg.discounted_price)
        amount = price * float(c.discount_value) / 100 if c.discount_type == "percentage" else float(c.discount_value)
        return min(amount, price)

    return max(
        coupons,
        key=lambda c: (_discount(c), -(c.valid_until.timestamp() if c.valid_until else float("inf"))),
    )


class PackageService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = PackageRepository(db)
        self.coupon_repo = CouponRepository(db)

    async def create_package(
        self,
        name: str,
        description: str | None,
        original_price: Decimal,
        discounted_price: Decimal,
        is_popular: bool = False,
        test_ids: list[uuid.UUID] | None = None,
    ) -> dict:
        pkg = await self.repo.create(
            name=name,
            description=description,
            original_price=original_price,
            discounted_price=discounted_price,
            is_popular=is_popular,
        )
        if test_ids:
            await self.repo.add_tests(pkg.id, test_ids)
        tests = await self.repo.get_active_tests(pkg.id)
        return _package_to_dict(pkg, tests)

    async def get_package(self, package_id: uuid.UUID) -> dict:
        pkg = await self.repo.get_by_id(package_id)
        if pkg is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "PACKAGE_NOT_FOUND", "message": "Package not found"},
            )
        tests = await self.repo.get_active_tests(package_id)
        coupons_map = await self.coupon_repo.list_eligible_coupons_map([package_id])
        return _package_to_dict(pkg, tests, _best_coupon(pkg, coupons_map.get(package_id, [])))

    async def list_packages(
        self,
        page: int,
        page_size: int,
        active_only: bool = True,
        health_concern: str | None = None,
    ) -> dict:
        package_ids = None
        if health_concern:
            from app.repositories.health_concern_repository import HealthConcernRepository

            keys = [k.strip() for k in health_concern.split(",") if k.strip()]
            package_ids = await HealthConcernRepository(self.db).keys_to_package_ids(keys)

        items, total = await self.repo.list(
            active_only=active_only, page=page, page_size=page_size, package_ids=package_ids
        )
        coupons_map = await self.coupon_repo.list_eligible_coupons_map([pkg.id for pkg in items])
        result_items = []
        for pkg in items:
            tests = await self.repo.get_active_tests(pkg.id)
            result_items.append(_package_to_dict(pkg, tests, _best_coupon(pkg, coupons_map.get(pkg.id, []))))
        return {"items": result_items, "total": total, "page": page, "page_size": page_size}

    async def update_package(self, package_id: uuid.UUID, **fields: object) -> dict:
        pkg = await self.repo.get_by_id(package_id)
        if pkg is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "PACKAGE_NOT_FOUND", "message": "Package not found"},
            )
        test_ids = fields.pop("test_ids", None)
        updated = await self.repo.update(package_id, **fields)
        if test_ids is not None:
            await self.repo.set_tests(package_id, test_ids)  # type: ignore[arg-type]
        tests = await self.repo.get_active_tests(package_id)
        return _package_to_dict(updated, tests)  # type: ignore[arg-type]

    async def delete_package(self, package_id: uuid.UUID) -> None:
        pkg = await self.repo.get_by_id(package_id)
        if pkg is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "PACKAGE_NOT_FOUND", "message": "Package not found"},
            )
        await self.repo.soft_delete(package_id)

    async def add_tests(self, package_id: uuid.UUID, test_ids: list[uuid.UUID]) -> dict:
        pkg = await self.repo.get_by_id(package_id)
        if pkg is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "PACKAGE_NOT_FOUND", "message": "Package not found"},
            )
        await self.repo.add_tests(package_id, test_ids)
        tests = await self.repo.get_active_tests(package_id)
        return _package_to_dict(pkg, tests)

    async def remove_tests(self, package_id: uuid.UUID, test_ids: list[uuid.UUID]) -> dict:
        pkg = await self.repo.get_by_id(package_id)
        if pkg is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "PACKAGE_NOT_FOUND", "message": "Package not found"},
            )
        await self.repo.remove_tests(package_id, test_ids)
        tests = await self.repo.get_active_tests(package_id)
        return _package_to_dict(pkg, tests)
