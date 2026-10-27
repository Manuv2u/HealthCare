"""Add user_addresses table and is_active to family_members.

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_addresses",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
            primary_key=True,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("label", sa.VARCHAR(100), nullable=False),
        sa.Column("address_line1", sa.VARCHAR(255), nullable=False),
        sa.Column("address_line2", sa.VARCHAR(255), nullable=True),
        sa.Column("city", sa.VARCHAR(100), nullable=False),
        sa.Column("state", sa.VARCHAR(100), nullable=False),
        sa.Column("pincode", sa.VARCHAR(10), nullable=False),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )

    op.create_index(
        "uq_user_addresses_one_default",
        "user_addresses",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true AND deleted_at IS NULL"),
    )

    op.add_column(
        "family_members",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("family_members", "is_active")
    op.drop_index("uq_user_addresses_one_default", table_name="user_addresses")
    op.drop_table("user_addresses")
