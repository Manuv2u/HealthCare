"""Pydantic v2 schemas for service areas and service requests."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ServiceAreaCreate(BaseModel):
    state: str | None = None
    district: str
    taluk: str | None = None
    city: str
    area: str | None = None
    pincode: str


class ServiceAreaUpdate(BaseModel):
    state: str | None = None
    district: str | None = None
    taluk: str | None = None
    city: str | None = None
    area: str | None = None
    pincode: str | None = None
    is_active: bool | None = None


class ServiceAreaOut(BaseModel):
    id: uuid.UUID
    state: str | None = None
    district: str
    taluk: str | None = None
    city: str
    area: str | None = None
    pincode: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ServiceAreaListResponse(BaseModel):
    items: list[ServiceAreaOut]
    total: int
    page: int
    page_size: int


class NotifyMeRequest(BaseModel):
    pincode: str


class ServiceabilityOut(BaseModel):
    """One serviceability verdict. `message` is rendered verbatim by the client."""

    pincode: str
    serviceable: bool
    reason_code: str
    message: str
    area_label: str | None = None

    model_config = {"from_attributes": True}


class ServiceabilityCheckRequest(BaseModel):
    pincodes: list[str] = Field(min_length=1, max_length=50)


class ServiceabilityCheckResponse(BaseModel):
    results: list[ServiceabilityOut]


class ServiceRequestOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    pincode: str
    created_at: datetime

    model_config = {"from_attributes": True}
