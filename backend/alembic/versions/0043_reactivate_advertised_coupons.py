"""Reactivate coupons still advertised on live homepage banners.

HEALTH100 and WELCOME200 are both referenced by "Save Rs.100..." / "Welcome
Offer..." homepage promo banners, but were sitting with is_active=false with
no expiry window set (valid_from/valid_until both null) — nothing marks them
as a deliberately-ended promo, so a customer following the banner's
instructions got a live "this coupon is no longer active" rejection at
checkout. Reactivating them so checkout honors what the banners promise.

Revision ID: 0043
Revises: 0042
Create Date: 2026-08-07
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0043"
down_revision: Union[str, None] = "0042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CODES = ("HEALTH100", "WELCOME200")


def upgrade() -> None:
    op.execute(
        text("UPDATE coupons SET is_active = true WHERE code = ANY(:codes)").bindparams(codes=list(CODES))
    )


def downgrade() -> None:
    op.execute(
        text("UPDATE coupons SET is_active = false WHERE code = ANY(:codes)").bindparams(codes=list(CODES))
    )
