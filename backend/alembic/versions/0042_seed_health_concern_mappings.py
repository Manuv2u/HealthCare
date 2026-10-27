"""Seed health-concern -> test/package mappings for concerns with a clear catalog match.

The onboarding "personalize your experience" prompt and the /tests and
/packages `health_concern=` filters have been live since health_concerns was
seeded, but test_health_concerns and package_health_concerns were never
populated — every concern returned zero results. This seeds the mappings
that have an unambiguous match in the current catalog (by test category or
package name). Concerns with no matching catalog content today
(fever_infection, mens_health, pregnancy, childrens_health, senior_citizen,
bone_health, allergy, general_health) are intentionally left unmapped rather
than guessing — an admin can fill those in via Admin -> Health Concerns once
there's real content for them.

Revision ID: 0042
Revises: 0041
Create Date: 2026-08-07
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0042"
down_revision: Union[str, None] = "0041"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# test.category -> health_concern.key
TEST_CATEGORY_MAP = {
    "Diabetes": "diabetes",
    "Thyroid": "thyroid",
    "Heart": "heart_health",
    "Liver": "liver",
    "Kidney": "kidney",
    "Full Body": "full_body_checkup",
    "Vitamin": "vitamin_deficiency",
}

# package.name -> health_concern.key
PACKAGE_NAME_MAP = {
    "Basic Health Checkup": "full_body_checkup",
    "Comprehensive Full Body Checkup": "full_body_checkup",
    "Diabetes Care Package": "diabetes",
    "Heart Health Package": "heart_health",
    "Women's Wellness Package": "womens_health",
}


def upgrade() -> None:
    conn = op.get_bind()
    for category, key in TEST_CATEGORY_MAP.items():
        conn.execute(
            text(
                """
                INSERT INTO test_health_concerns (test_id, health_concern_id)
                SELECT t.id, hc.id
                FROM tests t, health_concerns hc
                WHERE hc.key = :key AND t.category = :category AND t.is_active = true
                ON CONFLICT DO NOTHING
                """
            ).bindparams(key=key, category=category)
        )
    for name, key in PACKAGE_NAME_MAP.items():
        conn.execute(
            text(
                """
                INSERT INTO package_health_concerns (package_id, health_concern_id)
                SELECT p.id, hc.id
                FROM packages p, health_concerns hc
                WHERE hc.key = :key AND p.name = :name AND p.is_active = true
                ON CONFLICT DO NOTHING
                """
            ).bindparams(key=key, name=name)
        )


def downgrade() -> None:
    conn = op.get_bind()
    for category, key in TEST_CATEGORY_MAP.items():
        conn.execute(
            text(
                """
                DELETE FROM test_health_concerns
                WHERE health_concern_id = (SELECT id FROM health_concerns WHERE key = :key)
                  AND test_id IN (SELECT id FROM tests WHERE category = :category)
                """
            ).bindparams(key=key, category=category)
        )
    for name, key in PACKAGE_NAME_MAP.items():
        conn.execute(
            text(
                """
                DELETE FROM package_health_concerns
                WHERE health_concern_id = (SELECT id FROM health_concerns WHERE key = :key)
                  AND package_id IN (SELECT id FROM packages WHERE name = :name)
                """
            ).bindparams(key=key, name=name)
        )
