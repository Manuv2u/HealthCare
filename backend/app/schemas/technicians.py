"""Pydantic schemas for technician endpoints."""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class TechnicianCreate(BaseModel):
    user_id: uuid.UUID | None = None
    name: str
    phone: str
    email: str


class TechnicianAccountCreate(BaseModel):
    """Admin creates a full technician account (user + profile) with a temporary password."""
    name: str
    phone: str
    email: str
    password: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^[0-9]{10}$", v):
            raise ValueError("Phone must be exactly 10 digits")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r"^[^@\s]+@[^@\s]+$", v):
            raise ValueError("Invalid email address")
        return v.lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class TechnicianAccountOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    phone: str
    email: str
    is_active: bool
    is_temp_password: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TechnicianUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class TechnicianOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = None
    name: str
    phone: str
    email: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TechnicianListResponse(BaseModel):
    items: list[TechnicianOut]
    total: int
    page: int
    page_size: int


class AssignRequest(BaseModel):
    booking_id: uuid.UUID


class AssignmentOut(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    technician_id: uuid.UUID
    assigned_at: datetime
    assigned_by: uuid.UUID
    status: str
    notes: Optional[str] = None
    responded_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AssignmentRespondRequest(BaseModel):
    notes: Optional[str] = None


class WorkloadItem(BaseModel):
    technician_id: uuid.UUID
    name: str
    booking_count: int
