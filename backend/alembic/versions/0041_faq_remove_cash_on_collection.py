"""Remove the "Cash on collection" mention from the payments FAQ.

Booking now requires online payment for every collection type (Lab Visit and
Home Collection) — the "Pay at Lab" / cash-on-collection option was removed
from the booking flow and the backend no longer accepts it. The FAQ answer
seeded in 0023_faqs.py still told users cash on collection "may be available
for home visits", which is now false and needs correcting in place.

Revision ID: 0041
Revises: 0040
Create Date: 2026-08-07
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0041"
down_revision: Union[str, None] = "0040"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

QUESTION = "What payment methods do you accept?"
OLD_ANSWER = (
    "You can pay online during booking using UPI, cards and popular "
    "wallets. Cash on collection may be available for home visits in "
    "select areas."
)
NEW_ANSWER = (
    "We accept online payments only — UPI, cards, net banking and popular "
    "wallets. Payment is completed during booking for both Lab Visit and "
    "Home Collection; there is no pay-later or cash-on-collection option."
)


def upgrade() -> None:
    op.execute(
        text("UPDATE faqs SET answer = :answer WHERE question = :question").bindparams(
            answer=NEW_ANSWER, question=QUESTION
        )
    )


def downgrade() -> None:
    op.execute(
        text("UPDATE faqs SET answer = :answer WHERE question = :question").bindparams(
            answer=OLD_ANSWER, question=QUESTION
        )
    )
