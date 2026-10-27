"""Pydantic v2 schemas for the callback-request lead form and the contact form."""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

#: Which form the lead arrived from.
LeadSource = Literal["callback", "contact"]


class CallbackRequestCreate(BaseModel):
    name: str | None = None
    phone: str
    source: LeadSource = "callback"
    email: str | None = None
    subject: str | None = None
    preferred_time: str | None = None
    message: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # Visitors type "98765 43210" and "+91-98765 43210"; keep the digits.
        digits = re.sub(r"\D", "", v)
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        if len(digits) != 10:
            raise ValueError("Phone must be exactly 10 digits")
        return digits

    @field_validator("name", "subject", "preferred_time", "message")
    @classmethod
    def normalise_optional_text(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if not v:
            return None
        if not EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v


class CallbackRequestOut(BaseModel):
    id: uuid.UUID
    source: str
    name: str | None
    phone: str
    email: str | None
    subject: str | None
    preferred_time: str | None
    message: str | None
    status: str
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CallbackRequestListResponse(BaseModel):
    items: list[CallbackRequestOut]
    total: int
    page: int
    page_size: int


class UpdateCallbackRequestStatus(BaseModel):
    status: Literal["new", "contacted", "closed"]
    notes: str | None = None
