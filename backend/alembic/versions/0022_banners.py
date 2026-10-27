"""Add banners table for the homepage hero-carousel + admin banner management.

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-14
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.create_table(
        "banners",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("subtitle", sa.String(400), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cta_text", sa.String(80), nullable=True),
        sa.Column("cta_link", sa.String(500), nullable=True),
        sa.Column("cta2_text", sa.String(80), nullable=True),
        sa.Column("cta2_link", sa.String(500), nullable=True),
        sa.Column(
            "highlights",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "category", sa.String(50), server_default="packages", nullable=False
        ),
        sa.Column("desktop_image_key", sa.String(500), nullable=True),
        sa.Column("mobile_image_key", sa.String(500), nullable=True),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index(
        "ix_banners_display_order", "banners", ["display_order"]
    )
    op.create_index(
        "ix_banners_active_published",
        "banners",
        ["is_active", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_banners_active_published", table_name="banners")
    op.drop_index("ix_banners_display_order", table_name="banners")
    op.drop_table("banners")
