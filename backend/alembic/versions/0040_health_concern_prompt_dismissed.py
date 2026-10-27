"""Add users.health_concern_prompt_dismissed.

The health-concern onboarding modal previously inferred "never show again"
from `health_concerns` being non-empty — there was no way for a user to
dismiss the prompt permanently without actually picking a concern. This adds
an explicit, independent "Don't show this again" flag the user can set from
the modal (or later from Profile -> Health Preferences) without being forced
to select anything.

Revision ID: 0040
Revises: 0039
Create Date: 2026-07-25
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0040"
down_revision: Union[str, None] = "0039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "health_concern_prompt_dismissed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "health_concern_prompt_dismissed")
