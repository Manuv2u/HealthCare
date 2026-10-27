"""Token revocation stamp and login lockout fields on users.

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-01
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    # Access tokens issued before this timestamp are rejected — lets us
    # invalidate all outstanding JWTs for a user (deactivation, logout-all)
    # without a per-token blacklist.
    op.add_column("users", sa.Column("tokens_invalidated_at", sa.DateTime(timezone=True), nullable=True))

    # Account lockout after repeated failed password attempts.
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer, server_default="0", nullable=False))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "tokens_invalidated_at")
    op.drop_column("users", "failed_login_attempts")
    op.drop_column("users", "locked_until")
