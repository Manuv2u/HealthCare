"""Billing domain: billing/invoice settings, immutable invoices, manual adjustments."""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, JSONBCompat, TimestampMixin


class BillingSetting(TimestampMixin, Base):
    """Admin-configurable billing behaviour: GST, company identity, invoice policy.

    Versioned single-active rows (same pattern as CancellationSetting): an update
    deactivates the previous row and inserts a new one, keeping an audit trail.
    """

    __tablename__ = "billing_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    invoice_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    invoice_prefix: Mapped[str] = mapped_column(String(10), nullable=False, server_default="INV")
    gst_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    gst_percentage: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, server_default="18.00"
    )
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    company_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    company_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    invoice_footer: Mapped[str | None] = mapped_column(Text, nullable=True)
    show_logo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    refund_eta_text: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default="5–7 working days"
    )
    # Invoice layout options (0029) — which sections the rendered invoice shows.
    show_barcode: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    show_doctor: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    show_technician: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    show_patient_address: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    show_signature: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    show_report_info: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    # Scan-to-view QR code (links to the public invoice PDF) — opt-in, printed
    # in the letterhead alongside the barcode when enabled.
    show_qr_code: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    currency_symbol: Mapped[str] = mapped_column(String(8), nullable=False, server_default="₹")
    decimal_precision: Mapped[int] = mapped_column(Integer, nullable=False, server_default="2")
    company_website: Mapped[str | None] = mapped_column(String(200), nullable=True)
    company_cin: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # Real, admin-entered accreditation identifiers — nullable and printed on
    # the invoice letterhead only when set, so nothing is claimed unverified.
    nabl_registration_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    iso_certification: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


class Invoice(Base):
    """Immutable invoice record — a snapshot taken once, when payment succeeds.

    Every figure and party detail is copied onto this row (or into its JSONB
    snapshots) at issue time so later changes to settings, bookings or prices
    can never alter an issued invoice. There is deliberately no updated_at.
    """

    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False, unique=True
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    pdf_storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discount_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    charge_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default="0")
    gst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    company: Mapped[dict | None] = mapped_column(JSONBCompat, nullable=True)
    customer: Mapped[dict | None] = mapped_column(JSONBCompat, nullable=True)
    line_items: Mapped[list | None] = mapped_column(JSONBCompat, nullable=True)
    adjustments: Mapped[list | None] = mapped_column(JSONBCompat, nullable=True)
    payment_details: Mapped[dict | None] = mapped_column(JSONBCompat, nullable=True)
    technician: Mapped[dict | None] = mapped_column(JSONBCompat, nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class BookingAdjustment(Base):
    """Discount or extra charge on a booking (pre-payment).

    Either admin-added ('manual', created_by set) or applied at booking
    creation from a user-entered coupon code ('coupon', created_by null,
    coupon_id set — see CouponService). 'promotional' is a legacy source
    value from the retired banner-driven auto-apply mechanism; historical
    rows may still carry it, but nothing writes it anymore.
    """

    __tablename__ = "booking_adjustments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # 'discount' | 'charge'
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # 'manual' | 'promotional' (legacy) | 'coupon'
    source: Mapped[str] = mapped_column(String(20), nullable=False, server_default="manual")
    # SET NULL: deleting the coupon keeps this row's kind/label/amount/source,
    # so invoice + GST history stays intact without the coupon it came from.
    coupon_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coupons.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
