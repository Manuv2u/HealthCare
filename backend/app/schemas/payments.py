"""Pydantic schemas for payments."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PaymentInitiateRequest(BaseModel):
    booking_id: uuid.UUID
    method: str  # "online" | "card" | "upi" | "netbanking"


class CheckoutConfig(BaseModel):
    """What the frontend needs to open the active gateway's checkout."""

    gateway: str
    key_id: Optional[str] = None
    # "test" | "live" | "unknown" — drives the test-mode banner shown to the
    # patient so a sandbox checkout is never mistaken for a real one.
    mode: str = "unknown"
    currency: str = "INR"
    order_id: Optional[str] = None
    amount_paise: Optional[int] = None
    # Cashfree Drop-in Checkout needs this per-order token to open its modal.
    payment_session_id: Optional[str] = None


class PaymentInitiateResponse(BaseModel):
    payment_id: uuid.UUID
    order_id: str
    payment_url: Optional[str] = None  # hosted-redirect gateways only; None for Razorpay
    amount: float
    gst_amount: float
    totals: Optional[dict] = None  # full server-computed billing breakdown
    checkout: Optional[CheckoutConfig] = None


class PaymentVerifyRequest(BaseModel):
    """Checkout return flow (e.g. Razorpay modal success handler)."""

    booking_id: uuid.UUID
    gateway_order_id: str
    gateway_payment_id: str
    gateway_signature: str


class PaymentVerifyResponse(BaseModel):
    status: str
    payment_id: uuid.UUID


class RefundRequest(BaseModel):
    amount: float
    reason: str


class RefundResponse(BaseModel):
    refund_id: uuid.UUID
    payment_id: uuid.UUID
    amount: float
    status: str
