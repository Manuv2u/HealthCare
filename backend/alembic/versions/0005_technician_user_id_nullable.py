"""Make technician user_id nullable and drop unique constraint.

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the unique constraint on user_id
    op.drop_constraint("technicians_user_id_key", "technicians", type_="unique")
    # Make user_id nullable
    op.alter_column("technicians", "user_id", nullable=True)


def downgrade() -> None:
    op.alter_column("technicians", "user_id", nullable=False)
    op.create_unique_constraint("technicians_user_id_key", "technicians", ["user_id"])
