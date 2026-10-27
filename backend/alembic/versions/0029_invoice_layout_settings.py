"""Invoice layout options on billing_settings.

Admin-configurable switches for the redesigned diagnostic-centre invoice:
barcode / QR, doctor line, technician block, patient address, signature block,
report-information block, plus currency symbol, decimal precision and optional
company website / CIN for the letterhead. All default to the behaviour the
redesigned template ships with, so existing installs need no action.

Revision ID: 0029
Revises: 0028
Create Date: 2026-07-16
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None

_BOOL_COLUMNS: list[tuple[str, str]] = [
    ("show_barcode", "true"),
    ("show_qr", "true"),
    ("show_doctor", "true"),
    ("show_technician", "true"),
    ("show_patient_address", "true"),
    ("show_signature", "true"),
    ("show_report_info", "false"),
]


def upgrade() -> None:
    for name, default in _BOOL_COLUMNS:
        op.add_column(
            "billing_settings",
            sa.Column(name, sa.Boolean(), nullable=False, server_default=default),
        )
    op.add_column(
        "billing_settings",
        sa.Column("currency_symbol", sa.String(8), nullable=False, server_default="₹"),
    )
    op.add_column(
        "billing_settings",
        sa.Column("decimal_precision", sa.Integer(), nullable=False, server_default="2"),
    )
    op.add_column("billing_settings", sa.Column("company_website", sa.String(200), nullable=True))
    op.add_column("billing_settings", sa.Column("company_cin", sa.String(30), nullable=True))

    # Invoice snapshot extensions: gateway payment details and (for home
    # collection) the assigned technician, captured at issue time. Nullable —
    # invoices issued before 0029 simply render without those sections.
    op.add_column("invoices", sa.Column("payment_details", JSONB, nullable=True))
    op.add_column("invoices", sa.Column("technician", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("invoices", "technician")
    op.drop_column("invoices", "payment_details")
    for name in (
        "company_cin",
        "company_website",
        "decimal_precision",
        "currency_symbol",
        *[n for n, _ in reversed(_BOOL_COLUMNS)],
    ):
        op.drop_column("billing_settings", name)
