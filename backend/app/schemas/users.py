"""Pydantic v2 schemas for user and family member endpoints."""
from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timedelta

from pydantic import BaseModel, field_validator, model_validator
from typing import Any, Literal


def _validate_dob(v: date | None) -> date | None:
    if v is None:
        return v
    today = date.today()
    if v > today:
        raise ValueError("Date of birth cannot be in the future")
    if v < today - timedelta(days=130 * 365):
        raise ValueError("Date of birth is not valid")
    return v


class ChangeUserRoleRequest(BaseModel):
    # Deliberately excludes "admin" — role escalation to admin is a separate,
    # higher-risk action than the user<->technician toggle this endpoint serves.
    new_role: Literal["user", "technician"]


class UserProfileOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    date_of_birth: date | None
    gender: str | None
    role: str
    is_active: bool
    health_concerns: list[str] | None
    health_concern_prompt_dismissed: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    health_concerns: list[str] | None = None
    health_concern_prompt_dismissed: bool | None = None

    @field_validator("date_of_birth")
    @classmethod
    def _dob(cls, v: date | None) -> date | None:
        return _validate_dob(v)


class FamilyMemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    relationship: str
    date_of_birth: date | None
    gender: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def map_relationship_type(cls, data: Any) -> Any:
        # SQLAlchemy model uses `relationship_type` as Python attr (column is `relationship`)
        if hasattr(data, "relationship_type") and not hasattr(data, "relationship"):
            # Build a dict proxy
            return {
                "id": data.id,
                "user_id": data.user_id,
                "name": data.name,
                "relationship": data.relationship_type,
                "date_of_birth": data.date_of_birth,
                "gender": data.gender,
                "is_active": data.is_active,
                "created_at": data.created_at,
            }
        return data


#: Canonical relationship values. Mirrors frontend core/constants/relationships.ts.
#: Stored lowercase; the UI titlecases for display.
RELATIONSHIPS = {
    "spouse", "parent", "child", "sibling", "grandparent", "grandchild", "other",
}


def _normalise_relationship(v: str | None) -> str | None:
    """Fold case so the booking flow and the profile form can't disagree.

    They previously wrote "sibling" and "Sibling" to the same column, and the
    other form's dropdown then matched nothing and rendered blank.
    """
    if v is None:
        return None
    v = v.strip().lower()
    if v not in RELATIONSHIPS:
        raise ValueError(f"Relationship must be one of: {', '.join(sorted(RELATIONSHIPS))}")
    return v


class AddFamilyMemberRequest(BaseModel):
    name: str
    relationship: str
    date_of_birth: date | None = None
    gender: str | None = None

    @field_validator("relationship")
    @classmethod
    def validate_relationship(cls, v: str) -> str:
        return _normalise_relationship(v)  # type: ignore[return-value]

    @field_validator("date_of_birth")
    @classmethod
    def _dob(cls, v: date | None) -> date | None:
        return _validate_dob(v)


class UpdateFamilyMemberRequest(BaseModel):
    name: str | None = None
    relationship: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None

    @field_validator("relationship")
    @classmethod
    def validate_relationship(cls, v: str | None) -> str | None:
        return _normalise_relationship(v)

    @field_validator("date_of_birth")
    @classmethod
    def _dob(cls, v: date | None) -> date | None:
        return _validate_dob(v)


class UserAddressOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    label: str
    address_line1: str
    address_line2: str | None
    city: str
    state: str
    pincode: str
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


def _validate_pincode(v: str | None) -> str | None:
    if v is None:
        return v
    v = v.strip()
    # Indian PIN: exactly 6 digits, first digit 1-9
    if not re.fullmatch(r"[1-9][0-9]{5}", v):
        raise ValueError("Pincode must be a valid 6-digit Indian PIN code")
    return v


def _validate_place(v: str | None, field: str) -> str | None:
    if v is None:
        return v
    v = v.strip()
    if len(v) < 2:
        raise ValueError(f"{field} must be at least 2 characters")
    return v


class CreateAddressRequest(BaseModel):
    label: str
    address_line1: str
    address_line2: str | None = None
    city: str
    state: str
    pincode: str
    is_default: bool = False

    @field_validator("pincode")
    @classmethod
    def _pin(cls, v: str) -> str:
        return _validate_pincode(v)  # type: ignore[return-value]

    @field_validator("label", "address_line1")
    @classmethod
    def _required_text(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("This field is required")
        return v.strip()

    @field_validator("city")
    @classmethod
    def _city(cls, v: str) -> str:
        return _validate_place(v, "City")  # type: ignore[return-value]

    @field_validator("state")
    @classmethod
    def _state(cls, v: str) -> str:
        return _validate_place(v, "State")  # type: ignore[return-value]


class UpdateAddressRequest(BaseModel):
    label: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    is_default: bool | None = None

    @field_validator("pincode")
    @classmethod
    def _pin(cls, v: str | None) -> str | None:
        return _validate_pincode(v)

    @field_validator("city")
    @classmethod
    def _city(cls, v: str | None) -> str | None:
        return _validate_place(v, "City")

    @field_validator("state")
    @classmethod
    def _state(cls, v: str | None) -> str | None:
        return _validate_place(v, "State")


class UserAddressListResponse(BaseModel):
    items: list[UserAddressOut]
    total: int
    page: int
    page_size: int
