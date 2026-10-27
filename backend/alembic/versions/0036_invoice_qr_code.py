"""Invoice scan-to-view QR code.

Adds `show_qr_code` back to billing_settings — this time it is actually wired
into the invoice PDF. Unlike the old `show_qr` toggle dropped in 0031 (which
did nothing), the QR encodes a link to the public, unauthenticated invoice-PDF
view (`/invoices/public/{invoice_id}/pdf`), so scanning it opens that exact
invoice. Off by default: existing installs see no change until an admin opts
in under Billing, Invoice & GST Settings → Invoice Layout.

Revision ID: 0036
Revises: 0035
Create Date: 2026-07-22
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0036"
down_revision: Union[str, None] = "0035"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        "billing_settings",
        sa.Column("show_qr_code", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("billing_settings", "show_qr_code")
