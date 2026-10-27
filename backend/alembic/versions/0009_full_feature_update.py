"""Full feature update: registration, booking statuses, technician workflow, cancellation charges

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Expand booking status fields to VARCHAR(30) to fit new status names
    op.alter_column("bookings", "status", type_=sa.String(30), existing_nullable=False)
    op.alter_column("booking_status_history", "from_status", type_=sa.String(30), existing_nullable=True)
    op.alter_column("booking_status_history", "to_status", type_=sa.String(30), existing_nullable=False)

    # 2. Add reason field to booking_status_history for admin overrides
    op.add_column("booking_status_history", sa.Column("reason", sa.Text, nullable=True))

    # 3. Add status, notes, responded_at to technician_assignments for accept/reject workflow
    op.add_column(
        "technician_assignments",
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
    )
    op.add_column("technician_assignments", sa.Column("notes", sa.Text, nullable=True))
    op.add_column(
        "technician_assignments",
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 4. Create cancellation_settings table
    op.create_table(
        "cancellation_settings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("charge_type", sa.String(20), nullable=False),
        sa.Column("charge_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("cancellation_settings")

    op.drop_column("technician_assignments", "responded_at")
    op.drop_column("technician_assignments", "notes")
    op.drop_column("technician_assignments", "status")

    op.drop_column("booking_status_history", "reason")

    op.alter_column("booking_status_history", "to_status", type_=sa.String(20), existing_nullable=False)
    op.alter_column("booking_status_history", "from_status", type_=sa.String(20), existing_nullable=True)
    op.alter_column("bookings", "status", type_=sa.String(20), existing_nullable=False)
