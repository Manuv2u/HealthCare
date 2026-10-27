"""Cancellation fields, technician accounts, remove advance payment flags.

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-22
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    # Add cancellation fields to bookings
    op.add_column("bookings", sa.Column("cancellation_reason", sa.Text, nullable=True))
    op.add_column("bookings", sa.Column("cancelled_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("bookings", sa.Column("cancellation_fee", sa.Numeric(10, 2), nullable=True))
    op.add_column("bookings", sa.Column("cancellation_fee_type", sa.String(20), nullable=True))

    # Add temporary password flag to users
    op.add_column("users", sa.Column("is_temp_password", sa.Boolean, server_default="false", nullable=False))
    op.add_column("users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True))

    # Remove advance payment feature flags
    op.execute(
        "DELETE FROM feature_flags WHERE key IN ('advance_payment_enabled', 'advance_payment_percentage', 'advance_payment_minimum_amount')"
    )


def downgrade() -> None:
    op.drop_column("bookings", "cancellation_reason")
    op.drop_column("bookings", "cancelled_by")
    op.drop_column("bookings", "cancellation_fee")
    op.drop_column("bookings", "cancellation_fee_type")
    op.drop_column("users", "is_temp_password")
    op.drop_column("users", "password_changed_at")
