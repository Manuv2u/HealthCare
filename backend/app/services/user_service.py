"""UserService: profile management and family members."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.address_repository import AddressRepository
from app.repositories.user_repository import FamilyMemberRepository, UserRepository

_MAX_FAMILY_MEMBERS = 10


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.user_repo = UserRepository(db)
        self.family_repo = FamilyMemberRepository(db)
        self.address_repo = AddressRepository(db)

    async def get_profile(self, user_id: uuid.UUID):
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "USER_NOT_FOUND", "message": "User not found"},
            )
        return user

    async def update_profile(self, user_id: uuid.UUID, **fields):
        allowed = {k: v for k, v in fields.items() if k in ("name", "email", "date_of_birth", "gender", "health_concerns", "health_concern_prompt_dismissed") and v is not None}
        user = await self.user_repo.update(user_id, **allowed)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "USER_NOT_FOUND", "message": "User not found"},
            )
        return user

    async def get_family_members(self, user_id: uuid.UUID):
        return await self.family_repo.list_by_user(user_id)

    async def add_family_member(
        self,
        user_id: uuid.UUID,
        name: str,
        relationship: str,
        date_of_birth=None,
        gender: str | None = None,
    ):
        if date_of_birth is not None:
            existing = await self.family_repo.find_by_name_and_dob(user_id, name, date_of_birth)
            if existing is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "error_code": "DUPLICATE_FAMILY_MEMBER",
                        "message": "A family member with this name and date of birth already exists",
                    },
                )
        count = await self.family_repo.count_by_user(user_id)
        if count >= _MAX_FAMILY_MEMBERS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "FAMILY_MEMBER_LIMIT_EXCEEDED",
                    "message": f"Cannot add more than {_MAX_FAMILY_MEMBERS} family members",
                },
            )
        return await self.family_repo.create(
            user_id=user_id,
            name=name,
            relationship=relationship,
            date_of_birth=date_of_birth,
            gender=gender,
        )

    async def update_family_member(self, user_id: uuid.UUID, member_id: uuid.UUID, **fields):
        member = await self.family_repo.get_by_id(member_id)
        if member is None or member.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "FAMILY_MEMBER_NOT_FOUND", "message": "Family member not found"},
            )
        allowed: dict = {}
        for k, v in fields.items():
            if v is None:
                continue
            if k == "relationship":
                # SQLAlchemy model uses relationship_type as the Python attr name
                allowed["relationship_type"] = v
            elif k in ("name", "date_of_birth", "gender"):
                allowed[k] = v
        return await self.family_repo.update(member_id, **allowed)

    async def delete_family_member(self, user_id: uuid.UUID, member_id: uuid.UUID) -> None:
        member = await self.family_repo.get_by_id(member_id)
        if member is None or member.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "FAMILY_MEMBER_NOT_FOUND", "message": "Family member not found"},
            )
        await self.family_repo.soft_delete(member_id)
        await self.family_repo.update(member_id, is_active=False)

    async def get_addresses(self, user_id: uuid.UUID):
        return await self.address_repo.list_by_user(user_id)

    async def add_address(
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
    ):
        if is_default:
            await self.address_repo.clear_defaults(user_id)
        return await self.address_repo.create(
            user_id=user_id,
            label=label,
            address_line1=address_line1,
            city=city,
            state=state,
            pincode=pincode,
            address_line2=address_line2,
            is_default=is_default,
        )

    async def update_address(self, user_id: uuid.UUID, address_id: uuid.UUID, **fields):
        address = await self.address_repo.get_by_id(address_id)
        if address is None or address.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "ADDRESS_NOT_FOUND", "message": "Address not found"},
            )
        if fields.get("is_default"):
            await self.address_repo.clear_defaults(user_id)
        allowed = {k: v for k, v in fields.items() if k in ("label", "address_line1", "address_line2", "city", "state", "pincode", "is_default") and v is not None}
        return await self.address_repo.update(address_id, **allowed)

    async def delete_address(self, user_id: uuid.UUID, address_id: uuid.UUID) -> None:
        address = await self.address_repo.get_by_id(address_id)
        if address is None or address.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "ADDRESS_NOT_FOUND", "message": "Address not found"},
            )
        await self.address_repo.soft_delete(address_id)
