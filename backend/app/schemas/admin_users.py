"""Pydantic v2 schemas for the admin customer-management endpoints."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, field_validator

from app.schemas.users import _validate_dob


# ── list ─────────────────────────────────────────────────────────────────────

class AdminUserRow(BaseModel):
    id: uuid.UUID
    name: str
    email: Optional[str]
    phone: Optional[str]
    role: str
    avatar_url: Optional[str] = None
    is_active: bool
    account_status: str
    email_verified: bool
    phone_verified: bool
    created_at: datetime
    last_login_at: Optional[datetime]
    last_active_at: Optional[datetime]
    is_online: bool
    total_bookings: int
    total_tests: int
    total_packages: int
    total_spent: float
    pending_reports: int
    completed_reports: int
    preferred_collection_type: Optional[str]
    city: Optional[str]
    state: Optional[str]
    tags: list[str] = []


class AdminUserListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[AdminUserRow]


# ── detail ───────────────────────────────────────────────────────────────────

class UserAggregates(BaseModel):
    total_bookings: int
    pending_bookings: int
    completed_bookings: int
    cancelled_bookings: int
    home_collections: int
    lab_visits: int
    total_tests: int
    total_packages: int
    total_amount_paid: float
    refund_amount: float


class AdminUserDetail(BaseModel):
    id: uuid.UUID
    name: str
    email: Optional[str]
    phone: Optional[str]
    alternate_phone: Optional[str]
    role: str
    gender: Optional[str]
    date_of_birth: Optional[date]
    avatar_url: Optional[str] = None
    is_active: bool
    account_status: str
    email_verified: bool
    email_verified_at: Optional[datetime]
    phone_verified: bool
    phone_verified_at: Optional[datetime]
    health_concerns: list[str] = []
    tags: list[str] = []
    created_at: datetime
    updated_at: datetime
    first_login_at: Optional[datetime]
    last_login_at: Optional[datetime]
    last_logout_at: Optional[datetime]
    last_active_at: Optional[datetime]
    is_online: bool
    login_count: int
    login_attempt_count: int
    login_window_expires_at: Optional[datetime]
    preferred_collection_type: Optional[str]
    aggregates: UserAggregates


# ── sub-resources ────────────────────────────────────────────────────────────

class LoginEventOut(BaseModel):
    id: uuid.UUID
    event_type: str
    ip_address: Optional[str]
    browser: Optional[str]
    os: Optional[str]
    device_type: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginActivityResponse(BaseModel):
    events: list[LoginEventOut]
    total: int
    ip_history: list[dict]


class AdminNoteOut(BaseModel):
    id: uuid.UUID
    note: str
    is_internal: bool
    author_id: uuid.UUID
    author_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── action request bodies ────────────────────────────────────────────────────

class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None

    @field_validator("date_of_birth")
    @classmethod
    def _dob(cls, v: Optional[date]) -> Optional[date]:
        return _validate_dob(v)


class SetTagsRequest(BaseModel):
    tags: list[str]


class BlockUserRequest(BaseModel):
    reason: Optional[str] = None


class CreateNoteRequest(BaseModel):
    note: str
    is_internal: bool = True


class NotifyUserRequest(BaseModel):
    event_type: str
    channels: list[Literal["sms", "email", "whatsapp", "push"]]
    message: Optional[str] = None
