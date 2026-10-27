"""Pydantic v2 schemas for coupon endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

DISCOUNT_TYPES = ("percentage", "fixed")


class CouponSummaryOut(BaseModel):
    """Minimal shape embedded in Banner/Package responses for badge display."""

    code: str
    discount_type: str
    discount_value: Decimal

    model_config = {"from_attributes": True}


class CouponBase(BaseModel):
    code: str = Field(min_length=3, max_length=30)
    discount_type: str = Field(pattern="^(percentage|fixed)$")
    discount_value: Decimal = Field(gt=0)
    package_ids: list[uuid.UUID] = Field(default_factory=list)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    usage_limit: int | None = Field(default=None, gt=0)
    per_user_limit: int | None = Field(default=None, gt=0)
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()


class CouponCreate(CouponBase):
    pass


class CouponUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=3, max_length=30)
    discount_type: str | None = Field(default=None, pattern="^(percentage|fixed)$")
    discount_value: Decimal | None = Field(default=None, gt=0)
    package_ids: list[uuid.UUID] | None = None
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    usage_limit: int | None = Field(default=None, gt=0)
    per_user_limit: int | None = Field(default=None, gt=0)
    is_active: bool | None = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str | None) -> str | None:
        return v.strip().upper() if v is not None else v


class CouponOut(BaseModel):
    id: uuid.UUID
    code: str
    discount_type: str
    discount_value: Decimal
    package_ids: list[uuid.UUID]
    valid_from: datetime | None
    valid_until: datetime | None
    usage_limit: int | None
    per_user_limit: int | None
    times_used: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CouponValidateRequest(BaseModel):
    code: str
    package_ids: list[uuid.UUID] = Field(default_factory=list)


class CouponValidateResult(BaseModel):
    valid: bool
    error_code: str | None = None
    message: str | None = None
    coupon: CouponSummaryOut | None = None
    discount_amount: Decimal | None = None
