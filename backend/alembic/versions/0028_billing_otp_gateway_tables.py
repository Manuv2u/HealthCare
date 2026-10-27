"""Billing engine, persistent invoices, DB-backed OTP, provider configs, webhook log.

Foundations for the OTP/payment/invoice/GST module work:

  * billing_settings — admin-configurable GST + company identity + invoice policy
    (versioned single-active rows, same pattern as cancellation_settings). Seeded
    from the current GST_RATE env default so behaviour is unchanged at cutover.
  * invoices — immutable snapshot per successful payment (was: PDF regenerated
    on every download with "today" as the invoice date).
  * booking_adjustments — manual admin discounts/charges that flow into totals.
  * otp_codes / otp_send_events — DB-backed OTP storage (the in-process dict
    store silently broke under multiple uvicorn workers) + delivery audit.
  * provider_configs — which OTP/payment provider is active; secrets stay in env.
  * webhook_events — every gateway webhook delivery, for idempotency + dashboard.
  * payments.gateway, refunds.gateway_response columns.
  * invoice_number_seq — a real sequence so invoice numbers survive settings
    changes and never collide or reset.

Revision ID: 0028
Revises: 0027
Create Date: 2026-07-16
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    # ── billing_settings ──────────────────────────────────────────────────────
    op.create_table(
        "billing_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("invoice_prefix", sa.String(10), nullable=False, server_default="INV"),
        sa.Column("gst_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("gst_percentage", sa.Numeric(5, 2), nullable=False, server_default="18.00"),
        sa.Column("gstin", sa.String(15), nullable=True),
        sa.Column("company_name", sa.String(200), nullable=True),
        sa.Column("company_address", sa.Text(), nullable=True),
        sa.Column("company_phone", sa.String(20), nullable=True),
        sa.Column("company_email", sa.String(200), nullable=True),
        sa.Column("invoice_footer", sa.Text(), nullable=True),
        sa.Column("show_logo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("refund_eta_text", sa.String(100), nullable=False, server_default="5–7 working days"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    # Seed one active row with the historical defaults (18% GST, invoices on,
    # company name matching the current PDF header) so nothing changes at cutover.
    op.execute(
        "INSERT INTO billing_settings (invoice_enabled, invoice_prefix, gst_enabled, gst_percentage, company_name, is_active) "
        "VALUES (true, 'INV', true, 18.00, 'Sri Health Plus — Diagnostic Laboratory & Health Care', true)"
    )

    # ── invoice number sequence ───────────────────────────────────────────────
    op.execute("CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1")

    # ── invoices ──────────────────────────────────────────────────────────────
    op.create_table(
        "invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_number", sa.String(50), nullable=False, unique=True),
        sa.Column("payment_id", UUID(as_uuid=True), sa.ForeignKey("payments.id"), nullable=False, unique=True),
        sa.Column("booking_id", UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("pdf_storage_key", sa.String(255), nullable=True),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.Column("discount_total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("charge_total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("gst_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("gst_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(10, 2), nullable=False),
        sa.Column("amount_paid", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_method", sa.String(20), nullable=False),
        sa.Column("company", JSONB(), nullable=True),
        sa.Column("customer", JSONB(), nullable=True),
        sa.Column("line_items", JSONB(), nullable=True),
        sa.Column("adjustments", JSONB(), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_invoices_booking_id", "invoices", ["booking_id"])
    op.create_index("ix_invoices_user_id", "invoices", ["user_id"])
    op.create_index("ix_invoices_issued_at", "invoices", ["issued_at"])

    # ── booking_adjustments ───────────────────────────────────────────────────
    op.create_table(
        "booking_adjustments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_booking_adjustments_booking_id", "booking_adjustments", ["booking_id"])

    # ── otp_codes / otp_send_events ───────────────────────────────────────────
    op.create_table(
        "otp_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False, server_default="login"),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("provider", sa.String(30), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_otp_codes_phone", "otp_codes", ["phone"])

    op.create_table(
        "otp_send_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False, server_default="login"),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("provider_message_id", sa.String(120), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_otp_send_events_created_at", "otp_send_events", ["created_at"])

    # ── provider_configs ──────────────────────────────────────────────────────
    op.create_table(
        "provider_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("scope", sa.String(20), nullable=False, unique=True),
        sa.Column("active_provider", sa.String(30), nullable=False),
        sa.Column("config", JSONB(), nullable=True),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── webhook_events ────────────────────────────────────────────────────────
    op.create_table(
        "webhook_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gateway", sa.String(30), nullable=False),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("gateway_event_id", sa.String(120), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("payload", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_webhook_events_created_at", "webhook_events", ["created_at"])
    # The same gateway event must never be processed twice; NULL ids (mock /
    # simplified payloads) are exempt from the uniqueness rule.
    op.create_index(
        "ux_webhook_events_gateway_event_id",
        "webhook_events",
        ["gateway", "gateway_event_id"],
        unique=True,
        postgresql_where=sa.text("gateway_event_id IS NOT NULL"),
    )

    # ── payments / refunds columns ────────────────────────────────────────────
    op.add_column("payments", sa.Column("gateway", sa.String(30), nullable=True))
    op.add_column("refunds", sa.Column("gateway_response", JSONB(), nullable=True))

    # The advance-payment feature was removed entirely; clear any of its old
    # flags so nothing orphaned lingers in feature_flags.
    op.execute(
        "DELETE FROM feature_flags WHERE key IN "
        "('advance_payment_enabled', 'advance_payment_percentage', 'advance_payment_minimum_amount')"
    )


def downgrade() -> None:
    op.drop_column("refunds", "gateway_response")
    op.drop_column("payments", "gateway")
    op.drop_index("ux_webhook_events_gateway_event_id", table_name="webhook_events")
    op.drop_index("ix_webhook_events_created_at", table_name="webhook_events")
    op.drop_table("webhook_events")
    op.drop_table("provider_configs")
    op.drop_index("ix_otp_send_events_created_at", table_name="otp_send_events")
    op.drop_table("otp_send_events")
    op.drop_index("ix_otp_codes_phone", table_name="otp_codes")
    op.drop_table("otp_codes")
    op.drop_index("ix_booking_adjustments_booking_id", table_name="booking_adjustments")
    op.drop_table("booking_adjustments")
    op.drop_index("ix_invoices_issued_at", table_name="invoices")
    op.drop_index("ix_invoices_user_id", table_name="invoices")
    op.drop_index("ix_invoices_booking_id", table_name="invoices")
    op.drop_table("invoices")
    op.execute("DROP SEQUENCE IF EXISTS invoice_number_seq")
    op.drop_table("billing_settings")
