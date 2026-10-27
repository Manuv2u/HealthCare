"""Pydantic v2 schemas for health concern endpoints."""
from __future__ import annotations

import uuid

from pydantic import BaseModel


class HealthConcernOut(BaseModel):
    id: uuid.UUID
    key: str
    name: str
    icon: str
    display_order: int

    model_config = {"from_attributes": True}


class HealthConcernMappingOut(BaseModel):
    test_ids: list[uuid.UUID]
    package_ids: list[uuid.UUID]


class SetMappingRequest(BaseModel):
    ids: list[uuid.UUID]
