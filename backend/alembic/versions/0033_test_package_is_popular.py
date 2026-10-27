"""Add is_popular to tests and packages: the "Most Popular" badge was previously
positional (whatever sorted first got it), so it is now an explicit admin flag.
Defaults to false — existing rows are not grandfathered in.

Revision ID: 0033
Revises: 0032
Create Date: 2026-07-17
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    for table in ("tests", "packages"):
        op.add_column(
            table,
            sa.Column("is_popular", sa.Boolean(), server_default="false", nullable=False),
        )


def downgrade() -> None:
    for table in ("tests", "packages"):
        op.drop_column(table, "is_popular")
