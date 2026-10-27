"""Add taluk and area columns to service_areas.

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-03
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column("service_areas", sa.Column("taluk", sa.String(100), nullable=True))
    op.add_column("service_areas", sa.Column("area", sa.String(150), nullable=True))


def downgrade() -> None:
    op.drop_column("service_areas", "area")
    op.drop_column("service_areas", "taluk")
