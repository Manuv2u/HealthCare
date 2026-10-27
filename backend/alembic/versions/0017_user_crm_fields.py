"""Add CRM fields to users (avatar, verification, account_status, login summary, tags).

Adds columns backing the enterprise admin customer-management view. All columns are
additive with safe defaults; existing rows are backfilled so the admin UI is never
blank for legacy users.

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-08
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_key", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("alternate_phone", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("account_status", sa.String(20), nullable=False, server_default="active"),
    )
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("last_logout_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("first_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("login_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("users", sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True))

    # Backfill account_status from the legacy is_active boolean.
    op.execute(
        "UPDATE users SET account_status = 'inactive' WHERE is_active = false"
    )

    # Backfill login summary from existing sessions (min/max/count of created_at).
    op.execute(
        """
        UPDATE users u
        SET first_login_at = s.first_login,
            last_login_at = s.last_login,
            login_count = s.cnt
        FROM (
            SELECT user_id,
                   MIN(created_at) AS first_login,
                   MAX(created_at) AS last_login,
                   COUNT(*) AS cnt
            FROM sessions
            GROUP BY user_id
        ) s
        WHERE u.id = s.user_id
        """
    )

    op.create_index("ix_users_account_status", "users", ["account_status"])
    op.create_index("ix_users_last_login_at", "users", ["last_login_at"])


def downgrade() -> None:
    op.drop_index("ix_users_last_login_at", table_name="users")
    op.drop_index("ix_users_account_status", table_name="users")
    op.drop_column("users", "tags")
    op.drop_column("users", "login_count")
    op.drop_column("users", "first_login_at")
    op.drop_column("users", "last_logout_at")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "account_status")
    op.drop_column("users", "phone_verified_at")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "alternate_phone")
    op.drop_column("users", "avatar_key")
