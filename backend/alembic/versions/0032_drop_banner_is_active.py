"""Drop banners.is_active: redundant with status ('published' already gates
homepage visibility), so the admin panel had two toggles doing the same job.

Revision ID: 0032
Revises: 0031
Create Date: 2026-07-17
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.drop_column("banners", "is_active")


def downgrade() -> None:
    op.add_column(
        "banners",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )
