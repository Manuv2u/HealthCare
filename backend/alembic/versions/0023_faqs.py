"""Add faqs table for the general (application-wide) admin-managed FAQ.

Revision ID: 0023
Revises: 0022
Create Date: 2026-07-14
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.create_table(
        "faqs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("category", sa.String(50), server_default="general", nullable=False),
        sa.Column("question", sa.String(300), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
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
    )
    op.create_index("ix_faqs_display_order", "faqs", ["display_order"])
    op.create_index("ix_faqs_active", "faqs", ["is_active"])

    # Seed a starter set of common questions so the page isn't empty on first run.
    faqs = sa.table(
        "faqs",
        sa.column("category", sa.String),
        sa.column("question", sa.String),
        sa.column("answer", sa.Text),
        sa.column("display_order", sa.Integer),
    )
    op.bulk_insert(
        faqs,
        [
            {
                "category": "booking",
                "question": "How do I book a diagnostic test?",
                "answer": (
                    "Browse our Tests or Packages, add what you need, choose home "
                    "collection or a lab visit, pick a convenient time slot and "
                    "confirm. You'll receive a booking reference and updates by "
                    "SMS/email."
                ),
                "display_order": 1,
            },
            {
                "category": "home_collection",
                "question": "Is home sample collection available?",
                "answer": (
                    "Yes. A trained phlebotomist can collect your samples at home "
                    "at your chosen time. Availability depends on your pincode, "
                    "which is checked during booking."
                ),
                "display_order": 2,
            },
            {
                "category": "home_collection",
                "question": "Do I need to fast before my test?",
                "answer": (
                    "Some tests require fasting (typically 8–12 hours). The fasting "
                    "requirement, if any, is shown on each test's detail page and in "
                    "your booking confirmation."
                ),
                "display_order": 3,
            },
            {
                "category": "reports",
                "question": "When and how will I get my reports?",
                "answer": (
                    "Most reports are ready within 24–48 hours. You'll be notified "
                    "when they're available and can download them anytime from the "
                    "Reports section of your dashboard."
                ),
                "display_order": 4,
            },
            {
                "category": "payments",
                "question": "What payment methods do you accept?",
                "answer": (
                    "You can pay online during booking using UPI, cards and popular "
                    "wallets. Cash on collection may be available for home visits in "
                    "select areas."
                ),
                "display_order": 5,
            },
            {
                "category": "booking",
                "question": "Can I reschedule or cancel a booking?",
                "answer": (
                    "Yes. Open the booking from My Bookings to reschedule or cancel, "
                    "subject to our cancellation policy. Eligible refunds are "
                    "processed to your original payment method."
                ),
                "display_order": 6,
            },
            {
                "category": "general",
                "question": "Are your labs accredited?",
                "answer": (
                    "Our laboratories follow strict quality standards and are NABL "
                    "accredited, so you can trust the accuracy and reliability of "
                    "your results."
                ),
                "display_order": 7,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_faqs_active", table_name="faqs")
    op.drop_index("ix_faqs_display_order", table_name="faqs")
    op.drop_table("faqs")
