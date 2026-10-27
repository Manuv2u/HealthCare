"""Pydantic v2 schemas for bookings."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class BookingItemIn(BaseModel):
    item_type: str
    test_id: uuid.UUID | None = None
    package_id: uuid.UUID | None = None


class CreateBookingRequest(BaseModel):
    patient_id: uuid.UUID | None = None
    collection_type: str
    time_slot_id: uuid.UUID
    booking_date: date
    lab_branch_id: uuid.UUID | None = None
    address_id: uuid.UUID | None = None
    # Ignored for home collection: the pincode is derived from address_id so the
    # two can never disagree. Kept for lab-visit callers and older clients.
    pincode: str | None = None
    test_ids: list[uuid.UUID] = []
    package_ids: list[uuid.UUID] = []
    coupon_code: str | None = None


class RescheduleRequest(BaseModel):
    new_time_slot_id: uuid.UUID
    new_booking_date: date


class UpdateStatusRequest(BaseModel):
    status: str
    reason: str | None = None


class CancellationQuoteOut(BaseModel):
    """What the user is told before confirming a cancellation."""

    amount_paid: float
    cancellation_charge: float
    refund_amount: float
    fee_type: str | None = None
    charge_value: float | None = None
    has_charge: bool
    collection_type: str
    # How the booking was paid — shown in the confirm dialog so the user
    # knows where the refund lands.
    payment_method: str | None = None
    # Admin-configurable estimate, e.g. "5–7 working days".
    refund_eta_text: str | None = None


class CancelBookingRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Cancellation reason is required")
        return v.strip()


class AddRemarksRequest(BaseModel):
    notes: str


class BookingItemOut(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    item_type: str
    item_name: str = ""
    test_id: uuid.UUID | None
    package_id: uuid.UUID | None
    unit_price: Decimal

    model_config = {"from_attributes": True}


class BookingOut(BaseModel):
    id: uuid.UUID
    reference_number: str
    user_id: uuid.UUID
    patient_id: uuid.UUID | None
    collection_type: str
    time_slot_id: uuid.UUID
    booking_date: date
    lab_branch_id: uuid.UUID | None
    address_id: uuid.UUID | None = None
    pincode: str | None
    status: str
    payment_status: str
    collected_at: datetime | None
    processing_started_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    cancellation_reason: str | None = None
    cancelled_by: uuid.UUID | None = None
    cancellation_fee: float | None = None
    cancellation_fee_type: str | None = None
    technician_notes: str | None = None
    total_amount: float = 0
    created_at: datetime
    updated_at: datetime
    items: list[BookingItemOut] = []

    # ── Enriched detail fields (populated by GET /bookings/{id}) ──
    patient_name: str | None = None
    patient_gender: str | None = None
    patient_relationship: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    address: dict | None = None
    time_slot: dict | None = None
    lab_branch: dict | None = None
    payment: dict | None = None
    assigned_technician: dict | None = None
    status_history: list[dict] = []
    reports: list[dict] = []
    refund: dict | None = None

    model_config = {"from_attributes": True}


class BookingListResponse(BaseModel):
    items: list[BookingOut]
    total: int
    page: int
    page_size: int
