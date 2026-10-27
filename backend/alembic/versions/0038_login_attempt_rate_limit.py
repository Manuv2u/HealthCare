"""Replace fixed failed-attempt lockout with a rolling-hour login attempt cap.

failed_login_attempts/locked_until tracked "5 wrong passwords locks the
account for 15 minutes". The new policy is "normal users get 35 login
attempts (success or failure) per rolling hour; admins are exempt" — so the
columns are renamed to reflect what they now count.

Revision ID: 0038
Revises: 0037
Create Date: 2026-07-24
"""
from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.alter_column("users", "failed_login_attempts", new_column_name="login_attempt_count")
    op.alter_column("users", "locked_until", new_column_name="login_window_expires_at")


def downgrade() -> None:
    op.alter_column("users", "login_attempt_count", new_column_name="failed_login_attempts")
    op.alter_column("users", "login_window_expires_at", new_column_name="locked_until")
