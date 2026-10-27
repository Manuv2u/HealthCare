"""AddressRepository for user_addresses table."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserAddress


class AddressRepository:
    """Async CRUD operations for the user_addresses table."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        user_id: uuid.UUID,
        label: str,
        address_line1: str,
        city: str,
        state: str,
        pincode: str,
        *,
        address_line2: str | None = None,
        is_default: bool = False,
    ) -> UserAddress:
        address = UserAddress(
            id=uuid.uuid4(),
            user_id=user_id,
            label=label,
            address_line1=address_line1,
            address_line2=address_line2,
            city=city,
            state=state,
            pincode=pincode,
            is_default=is_default,
        )
        self.db.add(address)
        await self.db.flush()
        await self.db.refresh(address)
        return address

    async def get_by_id(self, address_id: uuid.UUID) -> UserAddress | None:
        result = await self.db.execute(
            select(UserAddress).where(
                UserAddress.id == address_id,
                UserAddress.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> list[UserAddress]:
        result = await self.db.execute(
            select(UserAddress)
            .where(
                UserAddress.user_id == user_id,
                UserAddress.deleted_at.is_(None),
            )
            .order_by(UserAddress.created_at.desc())
        )
        return list(result.scalars().all())

    async def update(self, address_id: uuid.UUID, **fields: object) -> UserAddress | None:
        if not fields:
            return await self.get_by_id(address_id)
        await self.db.execute(
            update(UserAddress).where(UserAddress.id == address_id).values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(address_id)

    async def soft_delete(self, address_id: uuid.UUID) -> None:
        await self.db.execute(
            update(UserAddress)
            .where(UserAddress.id == address_id)
            .values(deleted_at=datetime.now(timezone.utc))
        )
        await self.db.flush()

    async def clear_defaults(self, user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(UserAddress)
            .where(
                UserAddress.user_id == user_id,
                UserAddress.deleted_at.is_(None),
            )
            .values(is_default=False)
        )
        await self.db.flush()
