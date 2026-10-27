"""Record which address a home collection was actually booked for.

Bookings only ever stored a `pincode`. The address shown to the technician was
guessed at read time as "the user's current default address", which meant:

  * selecting a non-default address at booking sent the technician to the wrong
    house — the booking's own pincode and the displayed address could disagree;
  * adding or re-defaulting an address silently rewrote the address on bookings
    that had already been placed.

Storing the address the user actually chose fixes both. Nullable: lab visits
have no address, and rows created before this migration never captured one.

Revision ID: 0026
Revises: 0025
Create Date: 2026-07-15
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("address_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "bookings_address_id_fkey", "bookings", "user_addresses", ["address_id"], ["id"]
    )
    op.create_index("ix_bookings_address_id", "bookings", ["address_id"])
    # Existing rows keep address_id NULL on purpose: we cannot know which address
    # was chosen, and back-filling the current default would bake in the very
    # wrong-address bug this migration exists to fix. Those rows keep falling back
    # to the default-address lookup in BookingService._enrich_detail.


def downgrade() -> None:
    op.drop_index("ix_bookings_address_id", table_name="bookings")
    op.drop_constraint("bookings_address_id_fkey", "bookings", type_="foreignkey")
    op.drop_column("bookings", "address_id")
