"""Users router: profile and family members."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import get_current_user
from app.schemas.users import (
    AddFamilyMemberRequest,
    CreateAddressRequest,
    FamilyMemberOut,
    UpdateAddressRequest,
    UpdateFamilyMemberRequest,
    UpdateProfileRequest,
    UserAddressListResponse,
    UserAddressOut,
    UserProfileOut,
)
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfileOut)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserProfileOut:
    svc = UserService(db)
    user = await svc.get_profile(uuid.UUID(current_user["user_id"]))
    return UserProfileOut.model_validate(user)


@router.put("/me", response_model=UserProfileOut)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserProfileOut:
    svc = UserService(db)
    user = await svc.update_profile(
        uuid.UUID(current_user["user_id"]),
        **body.model_dump(exclude_none=True),
    )
    return UserProfileOut.model_validate(user)


@router.get("/me/family-members", response_model=list[FamilyMemberOut])
async def list_family_members(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[FamilyMemberOut]:
    svc = UserService(db)
    members = await svc.get_family_members(uuid.UUID(current_user["user_id"]))
    return [FamilyMemberOut.model_validate(m) for m in members]


@router.post("/me/family-members", response_model=FamilyMemberOut, status_code=201)
async def add_family_member(
    body: AddFamilyMemberRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> FamilyMemberOut:
    svc = UserService(db)
    member = await svc.add_family_member(
        user_id=uuid.UUID(current_user["user_id"]),
        name=body.name,
        relationship=body.relationship,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
    )
    return FamilyMemberOut.model_validate(member)


@router.put("/me/family-members/{member_id}", response_model=FamilyMemberOut)
async def update_family_member(
    member_id: uuid.UUID,
    body: UpdateFamilyMemberRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> FamilyMemberOut:
    svc = UserService(db)
    member = await svc.update_family_member(
        user_id=uuid.UUID(current_user["user_id"]),
        member_id=member_id,
        **body.model_dump(exclude_none=True),
    )
    return FamilyMemberOut.model_validate(member)


@router.delete("/me/family-members/{member_id}", status_code=204)
async def delete_family_member(
    member_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = UserService(db)
    await svc.delete_family_member(
        user_id=uuid.UUID(current_user["user_id"]),
        member_id=member_id,
    )


@router.get("/me/addresses", response_model=UserAddressListResponse)
async def list_addresses(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserAddressListResponse:
    svc = UserService(db)
    addresses = await svc.get_addresses(uuid.UUID(current_user["user_id"]))
    items = [UserAddressOut.model_validate(a) for a in addresses]
    return UserAddressListResponse(items=items, total=len(items), page=1, page_size=len(items))


@router.post("/me/addresses", response_model=UserAddressOut, status_code=201)
async def add_address(
    body: CreateAddressRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserAddressOut:
    svc = UserService(db)
    address = await svc.add_address(
        user_id=uuid.UUID(current_user["user_id"]),
        label=body.label,
        address_line1=body.address_line1,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
        address_line2=body.address_line2,
        is_default=body.is_default,
    )
    return UserAddressOut.model_validate(address)


@router.put("/me/addresses/{address_id}", response_model=UserAddressOut)
async def update_address(
    address_id: uuid.UUID,
    body: UpdateAddressRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserAddressOut:
    svc = UserService(db)
    address = await svc.update_address(
        user_id=uuid.UUID(current_user["user_id"]),
        address_id=address_id,
        **body.model_dump(exclude_none=True),
    )
    return UserAddressOut.model_validate(address)


@router.delete("/me/addresses/{address_id}", status_code=204)
async def delete_address(
    address_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = UserService(db)
    await svc.delete_address(
        user_id=uuid.UUID(current_user["user_id"]),
        address_id=address_id,
    )


@router.delete("/me", status_code=202)
async def request_account_deletion(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Enqueue account deletion — anonymisation runs within 30 days."""
    from datetime import datetime, timezone
    from sqlalchemy import update
    from app.models.user import User

    user_id = uuid.UUID(current_user["user_id"])
    now = datetime.now(timezone.utc)
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(deletion_requested_at=now)
    )
    return {"message": "Account deletion scheduled. Your data will be anonymised within 30 days."}
