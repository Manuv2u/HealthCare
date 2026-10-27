"""Add health_concerns table, test/package mapping join tables, and users.health_concerns.

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-02
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None

_CONCERNS = [
    ("full_body_checkup", "Full Body Checkup", "accessibility_new", 1),
    ("diabetes", "Diabetes", "water_drop", 2),
    ("thyroid", "Thyroid", "psychology", 3),
    ("heart_health", "Heart Health", "favorite", 4),
    ("liver", "Liver", "eco", 5),
    ("kidney", "Kidney", "opacity", 6),
    ("fever_infection", "Fever & Infection", "sick", 7),
    ("vitamin_deficiency", "Vitamin Deficiency", "wb_sunny", 8),
    ("womens_health", "Women's Health", "spa", 9),
    ("mens_health", "Men's Health", "male", 10),
    ("pregnancy", "Pregnancy", "pregnant_woman", 11),
    ("childrens_health", "Children's Health", "child_care", 12),
    ("senior_citizen", "Senior Citizen", "elderly", 13),
    ("bone_health", "Bone Health", "fitness_center", 14),
    ("allergy", "Allergy", "air", 15),
    ("general_health", "General Health", "health_and_safety", 16),
]


def upgrade() -> None:
    op.create_table(
        "health_concerns",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("key", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(50), nullable=False),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )

    op.create_table(
        "test_health_concerns",
        sa.Column("test_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tests.id"), nullable=False),
        sa.Column(
            "health_concern_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("health_concerns.id"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("test_id", "health_concern_id"),
    )

    op.create_table(
        "package_health_concerns",
        sa.Column("package_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("packages.id"), nullable=False),
        sa.Column(
            "health_concern_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("health_concerns.id"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("package_id", "health_concern_id"),
    )

    op.add_column("users", sa.Column("health_concerns", postgresql.ARRAY(sa.String()), nullable=True))

    health_concerns_table = sa.table(
        "health_concerns",
        sa.column("key", sa.String),
        sa.column("name", sa.String),
        sa.column("icon", sa.String),
        sa.column("display_order", sa.Integer),
    )
    op.bulk_insert(
        health_concerns_table,
        [
            {"key": key, "name": name, "icon": icon, "display_order": order}
            for key, name, icon, order in _CONCERNS
        ],
    )


def downgrade() -> None:
    op.drop_column("users", "health_concerns")
    op.drop_table("package_health_concerns")
    op.drop_table("test_health_concerns")
    op.drop_table("health_concerns")
