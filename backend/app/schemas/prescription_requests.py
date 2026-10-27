"""Pydantic v2 schemas for the Upload Prescription lead-capture feature."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator


def _validate_indian_mobile(v: str) -> str:
    v = v.strip()
    if not v.isdigit() or len(v) != 10:
        raise ValueError("Mobile must be exactly 10 digits")
    return v


class SendOtpRequest(BaseModel):
    mobile: str

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        return _validate_indian_mobile(v)


class SendOtpResponse(BaseModel):
    message: str
    expires_in_seconds: int


class VerifyOtpRequest(BaseModel):
    mobile: str
    otp: str

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        return _validate_indian_mobile(v)

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class VerifyOtpResponse(BaseModel):
    verified: bool
    # Short-lived token proving the mobile was verified; must accompany the submit call.
    verification_token: str


class PrescriptionFileOut(BaseModel):
    id: uuid.UUID
    file_name: str
    content_type: str
    file_size: int
    uploaded_at: datetime
    download_url: str | None = None

    model_config = {"from_attributes": True}


class PrescriptionRequestOut(BaseModel):
    id: uuid.UUID
    request_number: str
    patient_name: str
    mobile: str
    email: str | None
    city: str
    callback_time: str | None
    remarks: str | None
    status: str
    otp_verified: bool
    source: str
    assigned_to: str | None
    created_at: datetime
    updated_at: datetime
    files: list[PrescriptionFileOut] = []

    model_config = {"from_attributes": True}


class PrescriptionRequestListResponse(BaseModel):
    items: list[PrescriptionRequestOut]
    total: int
    page: int
    page_size: int


class UpdatePrescriptionRequest(BaseModel):
    status: Literal["new", "called", "booked", "cancelled"] | None = None
    assigned_to: str | None = None
    remarks: str | None = None


class PrescriptionStatsOut(BaseModel):
    today_requests: int
    pending_calls: int
    booked_from_prescription: int
    conversion_rate: float  # 0-100, booked / total * 100


class PrescriptionSubmitResponse(BaseModel):
    id: uuid.UUID
    request_number: str
    message: str
