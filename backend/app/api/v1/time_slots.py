"""Time slots router."""
from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.repositories.time_slot_repository import TimeSlotRepository
from app.schemas.time_slots import (
    AvailableSlotOut,
    TimeSlotCreate,
    TimeSlotOut,
    TimeSlotUpdate,
)

router = APIRouter(prefix="/time-slots", tags=["time-slots"])


@router.post("", response_model=TimeSlotOut, status_code=201)
async def create_time_slot(
    body: TimeSlotCreate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> TimeSlotOut:
    repo = TimeSlotRepository(db)
    slot = await repo.create(
        start_time=body.start_time,
        end_time=body.end_time,
        collection_type=body.collection_type,
        days_of_week=body.days_of_week,
        slot_capacity=body.slot_capacity,
    )
    return TimeSlotOut.model_validate(slot)


@router.get("/available", response_model=list[AvailableSlotOut])
async def get_available_slots(
    date: date,
    collection_type: str,
    db: AsyncSession = Depends(get_db_session),
) -> list[AvailableSlotOut]:
    repo = TimeSlotRepository(db)
    slots = await repo.get_available_slots(booking_date=date, collection_type=collection_type)
    return [AvailableSlotOut(**s) for s in slots]


@router.get("", response_model=dict)
async def list_time_slots(
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    repo = TimeSlotRepository(db)
    items, total = await repo.list(page=page, page_size=page_size)
    return {
        "items": [TimeSlotOut.model_validate(s) for s in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{slot_id}", response_model=TimeSlotOut)
async def get_time_slot(
    slot_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> TimeSlotOut:
    repo = TimeSlotRepository(db)
    slot = await repo.get_by_id(slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "Time slot not found"})
    return TimeSlotOut.model_validate(slot)


@router.put("/{slot_id}", response_model=TimeSlotOut)
async def update_time_slot(
    slot_id: uuid.UUID,
    body: TimeSlotUpdate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> TimeSlotOut:
    repo = TimeSlotRepository(db)
    slot = await repo.update(slot_id, **body.model_dump(exclude_none=True))
    if not slot:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "Time slot not found"})
    return TimeSlotOut.model_validate(slot)


@router.delete("/{slot_id}", status_code=204)
async def delete_time_slot(
    slot_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    repo = TimeSlotRepository(db)
    slot = await repo.get_by_id(slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "Time slot not found"})
    await repo.delete(slot_id)
