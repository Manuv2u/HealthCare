"""Technicians router."""
from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import get_current_user, require_roles
from app.schemas.technicians import (
    AssignmentOut,
    AssignmentRespondRequest,
    AssignRequest,
    TechnicianAccountCreate,
    TechnicianAccountOut,
    TechnicianCreate,
    TechnicianListResponse,
    TechnicianOut,
    TechnicianUpdate,
    WorkloadItem,
)
from app.services.technician_service import TechnicianService

router = APIRouter(prefix="/technicians", tags=["technicians"])


@router.post("/create-account", response_model=TechnicianAccountOut, status_code=201)
async def create_technician_account(
    body: TechnicianAccountCreate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> TechnicianAccountOut:
    """Admin creates a user account with role=technician and a temporary password.

    The email is auto-verified here (unlike self-registration): the admin is
    typing it in directly and vouching for it, so there is no separate person
    on the other end to click a verification code — gating login on one would
    leave the account permanently unreachable.
    """
    import bcrypt as _bcrypt
    from datetime import datetime, timezone
    from app.repositories.user_repository import UserRepository
    from app.repositories.technician_repository import TechnicianRepository
    from fastapi import HTTPException, status as http_status

    user_repo = UserRepository(db)
    tech_repo = TechnicianRepository(db)

    if await user_repo.get_by_phone(body.phone):
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail={"error_code": "PHONE_ALREADY_REGISTERED", "message": "Phone number already registered"},
        )
    if await user_repo.get_by_email(body.email):
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail={"error_code": "EMAIL_ALREADY_REGISTERED", "message": "Email address already registered"},
        )

    pw_hash = _bcrypt.hashpw(body.password.encode()[:72], _bcrypt.gensalt(rounds=12)).decode()
    user = await user_repo.create_user(
        name=body.name,
        phone=body.phone,
        email=body.email,
        password_hash=pw_hash,
        role="technician",
        is_temp_password=True,
        email_verified_at=datetime.now(timezone.utc),
    )

    tech = await tech_repo.create(
        user_id=user.id,
        name=body.name,
        phone=body.phone,
        email=body.email,
    )
    await db.commit()

    return TechnicianAccountOut(
        id=tech.id,
        user_id=user.id,
        name=tech.name,
        phone=tech.phone,
        email=tech.email,
        is_active=tech.is_active,
        is_temp_password=user.is_temp_password,
        created_at=tech.created_at,
    )


@router.post("", response_model=TechnicianOut, status_code=201)
async def create_technician(
    body: TechnicianCreate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> TechnicianOut:
    svc = TechnicianService(db)
    result = await svc.create_technician(
        user_id=body.user_id,
        name=body.name,
        phone=body.phone,
        email=body.email,
    )
    return TechnicianOut.model_validate(result)


# NOTE: /workload and /assignments/* must be declared BEFORE /{technician_id}
@router.get("/workload", response_model=list[WorkloadItem])
async def get_workload(
    date: date,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> list[WorkloadItem]:
    svc = TechnicianService(db)
    items = await svc.get_workload(date)
    return [WorkloadItem.model_validate(item) for item in items]


@router.post("/assignments/{assignment_id}/accept", response_model=AssignmentOut)
async def accept_assignment(
    assignment_id: uuid.UUID,
    current_user: dict = Depends(require_roles("technician")),
    db: AsyncSession = Depends(get_db_session),
) -> AssignmentOut:
    """Technician accepts their assignment — booking moves to 'accepted'."""
    svc = TechnicianService(db)
    result = await svc.accept_assignment(
        assignment_id=assignment_id,
        technician_user_id=uuid.UUID(current_user["user_id"]),
    )
    return AssignmentOut.model_validate(result)


@router.post("/assignments/{assignment_id}/reject", response_model=AssignmentOut)
async def reject_assignment(
    assignment_id: uuid.UUID,
    body: AssignmentRespondRequest | None = None,
    current_user: dict = Depends(require_roles("technician")),
    db: AsyncSession = Depends(get_db_session),
) -> AssignmentOut:
    """Technician rejects their assignment — booking reverts to 'booked' for reassignment."""
    svc = TechnicianService(db)
    result = await svc.reject_assignment(
        assignment_id=assignment_id,
        technician_user_id=uuid.UUID(current_user["user_id"]),
        notes=body.notes if body else None,
    )
    return AssignmentOut.model_validate(result)


@router.get("", response_model=TechnicianListResponse)
async def list_technicians(
    page: int = 1,
    page_size: int = 20,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> TechnicianListResponse:
    svc = TechnicianService(db)
    result = await svc.list_technicians(page=page, page_size=page_size)
    return TechnicianListResponse.model_validate(result)


@router.get("/{technician_id}", response_model=TechnicianOut)
async def get_technician(
    technician_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> TechnicianOut:
    svc = TechnicianService(db)
    result = await svc.get_technician(technician_id)
    return TechnicianOut.model_validate(result)


@router.put("/{technician_id}", response_model=TechnicianOut)
async def update_technician(
    technician_id: uuid.UUID,
    body: TechnicianUpdate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> TechnicianOut:
    svc = TechnicianService(db)
    result = await svc.update_technician(
        technician_id, **body.model_dump(exclude_none=True)
    )
    return TechnicianOut.model_validate(result)


@router.delete("/{technician_id}", status_code=204)
async def delete_technician(
    technician_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = TechnicianService(db)
    await svc.delete_technician(technician_id)


@router.post("/{technician_id}/assign", response_model=AssignmentOut, status_code=201)
async def assign_technician(
    technician_id: uuid.UUID,
    body: AssignRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> AssignmentOut:
    svc = TechnicianService(db)
    result = await svc.assign_to_booking(
        technician_id=technician_id,
        booking_id=body.booking_id,
        assigned_by_id=uuid.UUID(current_user["user_id"]),
    )
    return AssignmentOut.model_validate(result)
