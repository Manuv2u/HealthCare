"""Let admins delete a banner that's already been used.

Two FKs pointed at banners with NO ACTION, so any banner that had ever been
applied to a booking was undeletable:

  banner_packages.banner_id             -> CASCADE, the link rows are just
                                           membership and carry no history.
  booking_adjustments.promotional_banner_id
                                        -> SET NULL, the adjustment row keeps
                                           kind/label/amount/source, so the
                                           GST + invoice history survives on
                                           its own; the banner id is only a
                                           back-pointer to what caused it.

Revision ID: 0034
Revises: 0033
Create Date: 2026-07-19
"""
from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.drop_constraint(
        "banner_packages_banner_id_fkey", "banner_packages", type_="foreignkey"
    )
    op.create_foreign_key(
        "banner_packages_banner_id_fkey",
        "banner_packages",
        "banners",
        ["banner_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(
        "fk_booking_adjustments_promotional_banner_id",
        "booking_adjustments",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "fk_booking_adjustments_promotional_banner_id",
        "booking_adjustments",
        "banners",
        ["promotional_banner_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_booking_adjustments_promotional_banner_id",
        "booking_adjustments",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "fk_booking_adjustments_promotional_banner_id",
        "booking_adjustments",
        "banners",
        ["promotional_banner_id"],
        ["id"],
    )

    op.drop_constraint(
        "banner_packages_banner_id_fkey", "banner_packages", type_="foreignkey"
    )
    op.create_foreign_key(
        "banner_packages_banner_id_fkey",
        "banner_packages",
        "banners",
        ["banner_id"],
        ["id"],
    )
