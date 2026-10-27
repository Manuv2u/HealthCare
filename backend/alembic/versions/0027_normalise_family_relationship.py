"""Fold family_members.relationship to canonical lowercase.

The booking flow wrote "sibling" while the profile form wrote "Sibling", and the
API accepted both. Editing a member created by the other form then showed an
empty relationship dropdown, because the stored value matched no <option>.

Values are now normalised on write (see app/schemas/users.py); this backfills the
rows written before that.

Revision ID: 0027
Revises: 0026
Create Date: 2026-07-15
"""
from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None

CANONICAL = ("spouse", "parent", "child", "sibling", "grandparent", "grandchild", "other")


def upgrade() -> None:
    # Lowercase everything that already maps onto a canonical value.
    op.execute(
        """
        UPDATE family_members
        SET relationship = lower(trim(relationship))
        WHERE lower(trim(relationship)) IN {values}
          AND relationship <> lower(trim(relationship))
        """.format(values=CANONICAL)
    )
    # Anything else is junk from unvalidated writes (e.g. API scratch data);
    # park it on 'other' so the dropdown can render and the row stays editable.
    op.execute(
        """
        UPDATE family_members
        SET relationship = 'other'
        WHERE lower(trim(relationship)) NOT IN {values}
        """.format(values=CANONICAL)
    )


def downgrade() -> None:
    # Original casing wasn't recorded, so this is intentionally one-way.
    pass
