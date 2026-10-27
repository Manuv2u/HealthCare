"""Add notes/remarks/transaction_reference fields for cash payments and refund tracking.

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-01
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    # Admin-entered notes when manually recording a cash payment received at the lab.
    op.add_column("payments", sa.Column("notes", sa.Text(), nullable=True))

    # Admin notes on a refund status change, and a dedicated field for a manually
    # entered bank/UPI transaction reference — kept separate from gateway_refund_id,
    # which is populated by the payment gateway itself for online refunds.
    op.add_column("refunds", sa.Column("remarks", sa.Text(), nullable=True))
    op.add_column("refunds", sa.Column("transaction_reference", sa.String(100), nullable=True))

    op.create_index("ix_refunds_payment_id", "refunds", ["payment_id"])


def downgrade() -> None:
    op.drop_index("ix_refunds_payment_id", table_name="refunds")
    op.drop_column("refunds", "transaction_reference")
    op.drop_column("refunds", "remarks")
    op.drop_column("payments", "notes")
