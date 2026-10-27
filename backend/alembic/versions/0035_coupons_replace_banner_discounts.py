"""Coupons replace banner-driven discounts.

Banner loses its date-window fields (Advertisement no longer needs them, and
promotional_offer's validity now lives on the Coupon it links to) and its
discount fields (discount_type/discount_value/banner_packages) — a banner is
now a pure marketing visual that may optionally link to one Coupon via the
new coupon_id column, purely for display.

New coupons/coupon_packages tables hold the actual discount config: code,
discount type/value, applicable packages, validity window, usage limits,
active flag. booking_adjustments gains coupon_id (ON DELETE SET NULL, same
history-preserving pattern 0034 set up for promotional_banner_id) and drops
promotional_banner_id, since nothing populates it anymore.

Revision ID: 0035
Revises: 0034
Create Date: 2026-07-20
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0035"
down_revision: Union[str, None] = "0034"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    # --- Banner: drop date-window fields (Part A + promotional_offer too) ---
    op.drop_column("banners", "start_date")
    op.drop_column("banners", "end_date")

    # --- New coupons / coupon_packages tables ---
    op.create_table(
        "coupons",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("code", sa.String(30), nullable=False, unique=True),
        sa.Column("discount_type", sa.String(10), nullable=False),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("usage_limit", sa.Integer(), nullable=True),
        sa.Column("per_user_limit", sa.Integer(), nullable=True),
        sa.Column("times_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_table(
        "coupon_packages",
        sa.Column("coupon_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("package_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["coupon_id"], ["coupons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["packages.id"]),
        sa.PrimaryKeyConstraint("coupon_id", "package_id"),
    )
    op.create_index(
        "ix_coupon_packages_package_id", "coupon_packages", ["package_id"]
    )

    # --- Banner: drop discount fields + banner_packages, add coupon_id ---
    op.drop_table("banner_packages")
    op.drop_column("banners", "discount_type")
    op.drop_column("banners", "discount_value")
    op.add_column(
        "banners", sa.Column("coupon_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_banners_coupon_id",
        "banners",
        "coupons",
        ["coupon_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- booking_adjustments: coupon_id in, promotional_banner_id out ---
    op.drop_constraint(
        "fk_booking_adjustments_promotional_banner_id",
        "booking_adjustments",
        type_="foreignkey",
    )
    op.drop_column("booking_adjustments", "promotional_banner_id")
    op.add_column(
        "booking_adjustments",
        sa.Column("coupon_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_booking_adjustments_coupon_id",
        "booking_adjustments",
        "coupons",
        ["coupon_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_booking_adjustments_coupon_id", "booking_adjustments", type_="foreignkey"
    )
    op.drop_column("booking_adjustments", "coupon_id")
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
        ondelete="SET NULL",
    )

    op.drop_constraint("fk_banners_coupon_id", "banners", type_="foreignkey")
    op.drop_column("banners", "coupon_id")
    op.add_column("banners", sa.Column("discount_value", sa.Numeric(10, 2), nullable=True))
    op.add_column("banners", sa.Column("discount_type", sa.String(10), nullable=True))
    op.create_table(
        "banner_packages",
        sa.Column("banner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("package_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["banner_id"], ["banners.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["packages.id"]),
        sa.PrimaryKeyConstraint("banner_id", "package_id"),
    )

    op.drop_index("ix_coupon_packages_package_id", table_name="coupon_packages")
    op.drop_table("coupon_packages")
    op.drop_table("coupons")

    op.add_column(
        "banners", sa.Column("end_date", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "banners", sa.Column("start_date", sa.DateTime(timezone=True), nullable=True)
    )
