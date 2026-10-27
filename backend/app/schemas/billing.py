"""Pydantic schemas for the billing engine, billing settings and adjustments."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class AdjustmentOut(BaseModel):
    kind: Literal["discount", "charge"]
    label: str
    amount: float

    model_config = {"from_attributes": True}


class BillingTotalsOut(BaseModel):
    """Server-computed money summary. The frontend renders these numbers as-is."""

    subtotal: float
    discount_total: float
    charge_total: float
    taxable_amount: float
    gst_enabled: bool
    gst_percentage: float
    gst_amount: float
    total: float
    adjustments: list[AdjustmentOut]
    refund_eta_text: str


class BillingQuoteRequest(BaseModel):
    test_ids: list[uuid.UUID] = Field(default_factory=list)
    package_ids: list[uuid.UUID] = Field(default_factory=list)
    coupon_code: str | None = None


class BillingConfigPublic(BaseModel):
    """Non-sensitive billing display config for the storefront."""

    gst_enabled: bool
    gst_percentage: float
    refund_eta_text: str
    company_name: Optional[str] = None


class BillingSettingsOut(BaseModel):
    invoice_enabled: bool
    invoice_prefix: str
    gst_enabled: bool
    gst_percentage: float
    gstin: Optional[str] = None
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    invoice_footer: Optional[str] = None
    show_logo: bool
    refund_eta_text: str
    show_barcode: bool = True
    show_doctor: bool = True
    show_technician: bool = True
    show_patient_address: bool = True
    show_signature: bool = True
    show_report_info: bool = False
    show_qr_code: bool = False
    currency_symbol: str = "₹"
    decimal_precision: int = 2
    company_website: Optional[str] = None
    company_cin: Optional[str] = None
    nabl_registration_number: Optional[str] = None
    iso_certification: Optional[str] = None


class BillingSettingsIn(BaseModel):
    invoice_enabled: Optional[bool] = None
    invoice_prefix: Optional[str] = Field(default=None, max_length=10)
    gst_enabled: Optional[bool] = None
    gst_percentage: Optional[float] = None
    gstin: Optional[str] = Field(default=None, max_length=15)
    company_name: Optional[str] = Field(default=None, max_length=200)
    company_address: Optional[str] = None
    company_phone: Optional[str] = Field(default=None, max_length=20)
    company_email: Optional[str] = Field(default=None, max_length=200)
    invoice_footer: Optional[str] = None
    show_logo: Optional[bool] = None
    refund_eta_text: Optional[str] = Field(default=None, max_length=100)
    show_barcode: Optional[bool] = None
    show_doctor: Optional[bool] = None
    show_technician: Optional[bool] = None
    show_patient_address: Optional[bool] = None
    show_signature: Optional[bool] = None
    show_report_info: Optional[bool] = None
    show_qr_code: Optional[bool] = None
    currency_symbol: Optional[str] = Field(default=None, max_length=8)
    decimal_precision: Optional[int] = Field(default=None, ge=0, le=4)
    company_website: Optional[str] = Field(default=None, max_length=200)
    company_cin: Optional[str] = Field(default=None, max_length=30)
    nabl_registration_number: Optional[str] = Field(default=None, max_length=50)
    iso_certification: Optional[str] = Field(default=None, max_length=50)

    @field_validator("gst_percentage")
    @classmethod
    def validate_gst_percentage(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0 <= v <= 100):
            raise ValueError("GST percentage must be between 0 and 100")
        return v

    @field_validator("invoice_prefix")
    @classmethod
    def validate_prefix(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip().upper()
            if not v or not v.replace("-", "").isalnum():
                raise ValueError("Invoice prefix must be alphanumeric")
        return v


class BookingAdjustmentIn(BaseModel):
    kind: Literal["discount", "charge"]
    label: str = Field(min_length=1, max_length=120)
    amount: float = Field(gt=0)


class BookingAdjustmentOut(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    kind: str
    label: str
    amount: float
    created_at: datetime

    model_config = {"from_attributes": True}
