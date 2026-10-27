"""Pydantic v2 schemas for lab branches."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class LabBranchCreate(BaseModel):
    name: str
    address: str
    city: str
    pincode: str
    phone: str
    operating_hours: str


class LabBranchUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    city: str | None = None
    pincode: str | None = None
    phone: str | None = None
    operating_hours: str | None = None
    is_active: bool | None = None


class LabBranchOut(BaseModel):
    id: uuid.UUID
    name: str
    address: str
    city: str
    pincode: str
    phone: str
    operating_hours: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LabBranchDeleteResponse(BaseModel):
    """Reports whether the branch was removed outright or only deactivated."""

    action: Literal["deleted", "deactivated"]
    message: str


class LabBranchListResponse(BaseModel):
    items: list[LabBranchOut]
    total: int
    page: int
    page_size: int
