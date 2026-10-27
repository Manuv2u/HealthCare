"""Add recommended_for/sample_type/feature_cards/faqs to tests, and contact_settings table.

Backs the enhanced Test Details page: admin-configurable recommended audience, sample
type, trust/feature cards and per-test FAQs, plus a site-wide (not per-test) contact
settings row driving the "Book via Call / Get a Callback / WhatsApp" action cards that
appear on both the home page and every test detail page. All new `tests` columns are
nullable or defaulted so existing rows are unaffected. The seeded `contact_settings` row
mirrors the phone/WhatsApp numbers previously hardcoded in home.component.ts so the home
page's behavior is unchanged until an admin edits it.

Revision ID: 0020
Revises: 0019
Create Date: 2026-07-10
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column("tests", sa.Column("sample_type", sa.String(50), nullable=True))
    op.add_column(
        "tests",
        sa.Column("recommended_for", postgresql.ARRAY(sa.String(10)), nullable=True),
    )
    op.add_column(
        "tests",
        sa.Column(
            "feature_cards",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "tests",
        sa.Column(
            "faqs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )

    op.create_table(
        "contact_settings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("phone_number", sa.String(20), nullable=False),
        sa.Column("whatsapp_number", sa.String(20), nullable=False),
        sa.Column(
            "callback_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Seed with the numbers previously hardcoded in home.component.ts so behavior is
    # unchanged until an admin edits it via the new Contact Settings admin page.
    op.execute(
        """
        INSERT INTO contact_settings (phone_number, whatsapp_number, callback_enabled, is_active)
        VALUES ('+91 77951 49207', '917795149207', true, true)
        """
    )


def downgrade() -> None:
    op.drop_table("contact_settings")
    op.drop_column("tests", "faqs")
    op.drop_column("tests", "feature_cards")
    op.drop_column("tests", "recommended_for")
    op.drop_column("tests", "sample_type")
