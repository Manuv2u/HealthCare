"""Promotional offer banners: banner_type/discount fields, banner_packages
link table, and system-applied booking adjustments.

Revision ID: 0030
Revises: 0029
Create Date: 2026-07-16
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    # ── banners: image-only content + promotional offer fields ──────────────
    op.alter_column("banners", "title", existing_type=sa.String(200), nullable=True)
    op.add_column(
        "banners",
        sa.Column(
            "banner_type", sa.String(30), server_default="advertisement", nullable=False
        ),
    )
    op.add_column("banners", sa.Column("discount_type", sa.String(10), nullable=True))
    op.add_column(
        "banners", sa.Column("discount_value", sa.Numeric(10, 2), nullable=True)
    )

    # ── banner_packages: applicable packages for a promotional offer ────────
    op.create_table(
        "banner_packages",
        sa.Column("banner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("package_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["banner_id"], ["banners.id"]),
        sa.ForeignKeyConstraint(["package_id"], ["packages.id"]),
        sa.PrimaryKeyConstraint("banner_id", "package_id"),
    )
    op.create_index(
        "ix_banner_packages_package_id", "banner_packages", ["package_id"]
    )

    # ── booking_adjustments: system-applied promotional discounts ───────────
    op.alter_column(
        "booking_adjustments", "created_by", existing_type=postgresql.UUID(as_uuid=True), nullable=True
    )
    op.add_column(
        "booking_adjustments",
        sa.Column("source", sa.String(20), server_default="manual", nullable=False),
    )
    op.add_column(
        "booking_adjustments",
        sa.Column("promotional_banner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_booking_adjustments_promotional_banner_id",
        "booking_adjustments",
        "banners",
        ["promotional_banner_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_booking_adjustments_promotional_banner_id",
        "booking_adjustments",
        type_="foreignkey",
    )
    op.drop_column("booking_adjustments", "promotional_banner_id")
    op.drop_column("booking_adjustments", "source")
    op.alter_column(
        "booking_adjustments", "created_by", existing_type=postgresql.UUID(as_uuid=True), nullable=False
    )

    op.drop_index("ix_banner_packages_package_id", table_name="banner_packages")
    op.drop_table("banner_packages")

    op.drop_column("banners", "discount_value")
    op.drop_column("banners", "discount_type")
    op.drop_column("banners", "banner_type")
    op.alter_column("banners", "title", existing_type=sa.String(200), nullable=False)


