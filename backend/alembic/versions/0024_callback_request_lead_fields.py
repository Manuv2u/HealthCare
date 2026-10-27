"""Give callback_requests first-class lead columns so the contact form can share it.

Until now the lead's message and preferred time were folded into `notes`, which
admins also overwrite when they update a status. Split them into their own
columns and add the fields the contact ("Send a message") form collects.

Revision ID: 0024
Revises: 0023
Create Date: 2026-07-15
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        "callback_requests",
        sa.Column("source", sa.String(20), nullable=False, server_default="callback"),
    )
    op.add_column("callback_requests", sa.Column("email", sa.String(255), nullable=True))
    op.add_column("callback_requests", sa.Column("subject", sa.String(50), nullable=True))
    op.add_column("callback_requests", sa.Column("preferred_time", sa.String(100), nullable=True))
    op.add_column("callback_requests", sa.Column("message", sa.Text(), nullable=True))
    op.create_index("ix_callback_requests_source", "callback_requests", ["source"])
    # Existing rows keep whatever is in `notes` as-is: that column holds a mix of
    # folded-in lead messages and admin notes that cannot be told apart safely.


def downgrade() -> None:
    op.drop_index("ix_callback_requests_source", table_name="callback_requests")
    op.drop_column("callback_requests", "message")
    op.drop_column("callback_requests", "preferred_time")
    op.drop_column("callback_requests", "subject")
    op.drop_column("callback_requests", "email")
    op.drop_column("callback_requests", "source")
