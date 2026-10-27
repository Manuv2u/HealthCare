"""Pydantic schemas for invoices."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class InvoiceOut(BaseModel):
    id: uuid.UUID
    invoice_number: str
    payment_id: uuid.UUID
    booking_id: uuid.UUID
    user_id: uuid.UUID
    subtotal: float
    discount_total: float
    charge_total: float
    gst_rate: float
    gst_amount: float
    total: float
    amount_paid: float
    payment_method: str
    company: Optional[dict[str, Any]] = None
    customer: Optional[dict[str, Any]] = None
    line_items: Optional[list[dict[str, Any]]] = None
    adjustments: Optional[list[dict[str, Any]]] = None
    payment_details: Optional[dict[str, Any]] = None
    technician: Optional[dict[str, Any]] = None
    issued_at: datetime
    has_pdf: bool = False

    model_config = {"from_attributes": True}


class InvoiceListOut(BaseModel):
    items: list[InvoiceOut]
    total: int
    page: int
    page_size: int
