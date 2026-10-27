"""Lab branches router."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.repositories.lab_branch_repository import LabBranchRepository
from app.schemas.lab_branches import (
    LabBranchCreate,
    LabBranchDeleteResponse,
    LabBranchListResponse,
    LabBranchOut,
    LabBranchUpdate,
)

router = APIRouter(prefix="/lab-branches", tags=["lab-branches"])


@router.post("", response_model=LabBranchOut, status_code=201)
async def create_lab_branch(
    body: LabBranchCreate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> LabBranchOut:
    repo = LabBranchRepository(db)
    branch = await repo.create(
        name=body.name,
        address=body.address,
        city=body.city,
        pincode=body.pincode,
        phone=body.phone,
        operating_hours=body.operating_hours,
    )
    return LabBranchOut.model_validate(branch)


@router.get("", response_model=LabBranchListResponse)
async def list_lab_branches(
    page: int = 1,
    page_size: int = 20,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db_session),
) -> LabBranchListResponse:
    repo = LabBranchRepository(db)
    active_only = not include_inactive
    items, total = await repo.list(active_only=active_only, page=page, page_size=page_size)
    return LabBranchListResponse(
        items=[LabBranchOut.model_validate(b) for b in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{branch_id}", response_model=LabBranchOut)
async def get_lab_branch(
    branch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> LabBranchOut:
    repo = LabBranchRepository(db)
    branch = await repo.get_by_id(branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "Lab branch not found"})
    return LabBranchOut.model_validate(branch)


@router.put("/{branch_id}", response_model=LabBranchOut)
async def update_lab_branch(
    branch_id: uuid.UUID,
    body: LabBranchUpdate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> LabBranchOut:
    repo = LabBranchRepository(db)
    branch = await repo.update(branch_id, **body.model_dump(exclude_none=True))
    if not branch:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "Lab branch not found"})
    return LabBranchOut.model_validate(branch)


@router.delete("/{branch_id}", response_model=LabBranchDeleteResponse)
async def delete_lab_branch(
    branch_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> LabBranchDeleteResponse:
    """Remove a branch, keeping any booking history it is attached to.

    Bookings reference lab_branches.id, so hard-deleting a branch that has been
    booked would destroy that history. Such a branch is deactivated instead:
    it disappears from the default listing and stays unbookable, while its
    bookings keep resolving. A branch nobody ever booked is removed outright.
    """
    repo = LabBranchRepository(db)
    branch = await repo.get_by_id(branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "Lab branch not found"})
    booking_count = await repo.count_bookings(branch_id)
    if booking_count:
        await repo.update(branch_id, is_active=False)
        return LabBranchDeleteResponse(
            action="deactivated",
            message=(
                f'"{branch.name}" has {booking_count} booking(s), so it was deactivated '
                "rather than deleted. It is now hidden and unbookable, and its bookings are kept."
            ),
        )
    await repo.delete(branch)
    return LabBranchDeleteResponse(
        action="deleted", message=f'"{branch.name}" was permanently deleted.'
    )
