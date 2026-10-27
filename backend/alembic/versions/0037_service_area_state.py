"""Add state column to service_areas.

Revision ID: 0037
Revises: 0036
Create Date: 2026-07-22
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0037"
down_revision: Union[str, None] = "0036"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column("service_areas", sa.Column("state", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("service_areas", "state")
