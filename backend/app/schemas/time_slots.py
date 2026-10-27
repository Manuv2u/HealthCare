"""Pydantic v2 schemas for time slots."""
from __future__ import annotations

import uuid
from datetime import datetime, time

from pydantic import BaseModel


class TimeSlotCreate(BaseModel):
    start_time: time
    end_time: time
    collection_type: str
    days_of_week: list[int]
    slot_capacity: int


class TimeSlotUpdate(BaseModel):
    start_time: time | None = None
    end_time: time | None = None
    collection_type: str | None = None
    days_of_week: list[int] | None = None
    slot_capacity: int | None = None
    is_active: bool | None = None


class TimeSlotOut(BaseModel):
    id: uuid.UUID
    start_time: time
    end_time: time
    collection_type: str
    days_of_week: list[int]
    slot_capacity: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AvailableSlotOut(BaseModel):
    id: uuid.UUID
    label: str
    start_time: time
    end_time: time
    collection_type: str
    slot_capacity: int
    confirmed_count: int
    remaining_capacity: int
    is_enabled: bool = True
