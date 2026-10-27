"""Invoice letterhead accreditation fields; drop the now-unused QR toggle.

The redesigned invoice header prints NABL registration / ISO certification
only when an admin has actually entered them (nullable columns — never
fabricated). The QR code was removed from the invoice header entirely, so
`show_qr` no longer does anything and is dropped.

Revision ID: 0031
Revises: 0030
Create Date: 2026-07-16
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: Union[str, None] = "0030"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        "billing_settings", sa.Column("nabl_registration_number", sa.String(50), nullable=True)
    )
    op.add_column(
        "billing_settings", sa.Column("iso_certification", sa.String(50), nullable=True)
    )
    op.drop_column("billing_settings", "show_qr")


def downgrade() -> None:
    op.add_column(
        "billing_settings",
        sa.Column("show_qr", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.drop_column("billing_settings", "iso_certification")
    op.drop_column("billing_settings", "nabl_registration_number")
