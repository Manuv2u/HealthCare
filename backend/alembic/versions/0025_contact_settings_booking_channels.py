"""Let admins publish working hours and switch the call/WhatsApp channels off.

The booking flow offers "Book via Call" as the escape hatch when home collection
is unavailable, so the number needs an advertised availability window, and admins
need to hide a channel they cannot staff rather than send users to a dead line.

Revision ID: 0025
Revises: 0024
Create Date: 2026-07-15
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        "contact_settings", sa.Column("working_hours", sa.String(100), nullable=True)
    )
    op.add_column(
        "contact_settings",
        sa.Column("call_enabled", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "contact_settings",
        sa.Column(
            "whatsapp_enabled", sa.Boolean(), nullable=False, server_default="true"
        ),
    )
    # Existing rows default to both channels on, matching the behaviour before
    # this migration, where neither could be turned off.


def downgrade() -> None:
    op.drop_column("contact_settings", "whatsapp_enabled")
    op.drop_column("contact_settings", "call_enabled")
    op.drop_column("contact_settings", "working_hours")
