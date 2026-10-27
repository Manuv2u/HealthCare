"""LabBranchRepository."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking
from app.models.service import LabBranch


class LabBranchRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        name: str,
        address: str,
        city: str,
        pincode: str,
        phone: str,
        operating_hours: str,
    ) -> LabBranch:
        branch = LabBranch(
            id=uuid.uuid4(),
            name=name,
            address=address,
            city=city,
            pincode=pincode,
            phone=phone,
            operating_hours=operating_hours,
        )
        self.db.add(branch)
        await self.db.flush()
        await self.db.refresh(branch)
        return branch

    async def get_by_id(self, branch_id: uuid.UUID) -> LabBranch | None:
        result = await self.db.execute(
            select(LabBranch).where(LabBranch.id == branch_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        active_only: bool = True,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[LabBranch], int]:
        query = select(LabBranch)
        if active_only:
            query = query.where(LabBranch.is_active.is_(True))
        count_result = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar_one()
        offset = (page - 1) * page_size
        result = await self.db.execute(
            query.order_by(LabBranch.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def update(self, branch_id: uuid.UUID, **fields: object) -> LabBranch | None:
        if not fields:
            return await self.get_by_id(branch_id)
        await self.db.execute(
            update(LabBranch).where(LabBranch.id == branch_id).values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(branch_id)

    async def count_bookings(self, branch_id: uuid.UUID) -> int:
        """Bookings still pointing at this branch, which block a hard delete."""
        result = await self.db.execute(
            select(func.count())
            .select_from(Booking)
            .where(Booking.lab_branch_id == branch_id)
        )
        return result.scalar_one()

    async def delete(self, branch: LabBranch) -> None:
        await self.db.delete(branch)
        await self.db.flush()
