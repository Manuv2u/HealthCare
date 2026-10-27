"""Pydantic v2 schemas for the general (application-wide) FAQ endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# Suggested categories for grouping on the public FAQ page. Free-form strings
# are accepted so admins can introduce new groups without a code change.
FAQ_CATEGORIES = (
    "general",
    "booking",
    "home_collection",
    "reports",
    "payments",
    "account",
)


class FaqBase(BaseModel):
    category: str = Field(default="general", max_length=50)
    question: str = Field(..., min_length=1, max_length=300)
    answer: str = Field(..., min_length=1)
    display_order: int = 0
    is_active: bool = True


class FaqCreate(FaqBase):
    pass


class FaqUpdate(BaseModel):
    category: str | None = Field(default=None, max_length=50)
    question: str | None = Field(default=None, min_length=1, max_length=300)
    answer: str | None = Field(default=None, min_length=1)
    display_order: int | None = None
    is_active: bool | None = None


class FaqReorderItem(BaseModel):
    id: uuid.UUID
    display_order: int


class FaqReorderRequest(BaseModel):
    items: list[FaqReorderItem]


class FaqOut(BaseModel):
    """Public-facing FAQ shape."""

    id: uuid.UUID
    category: str
    question: str
    answer: str
    display_order: int

    model_config = {"from_attributes": True}


class FaqAdminOut(FaqOut):
    """Admin view exposes management-only fields too."""

    is_active: bool
    created_at: datetime
    updated_at: datetime
