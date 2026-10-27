"""Make tests.search_vector a generated tsvector column

The search_vector column was never populated (no trigger / no generated
expression), so full-text search on tests always matched zero rows. Convert
it to a GENERATED ALWAYS ... STORED column over name + category + description
so Postgres maintains it automatically on every insert/update.

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_TSVECTOR_EXPR = (
    "to_tsvector('english', "
    "coalesce(name, '') || ' ' || "
    "coalesce(category, '') || ' ' || "
    "coalesce(description, ''))"
)


def upgrade() -> None:
    # Drop the GIN index and the plain (never-populated) column, then recreate
    # the column as a generated tsvector and re-index it.
    op.execute("DROP INDEX IF EXISTS ix_tests_search_vector")
    op.execute("ALTER TABLE tests DROP COLUMN IF EXISTS search_vector")
    op.execute(
        f"ALTER TABLE tests ADD COLUMN search_vector tsvector "
        f"GENERATED ALWAYS AS ({_TSVECTOR_EXPR}) STORED"
    )
    op.execute(
        "CREATE INDEX ix_tests_search_vector ON tests USING gin (search_vector)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tests_search_vector")
    op.execute("ALTER TABLE tests DROP COLUMN IF EXISTS search_vector")
    op.execute("ALTER TABLE tests ADD COLUMN search_vector tsvector")
    op.execute(
        "CREATE INDEX ix_tests_search_vector ON tests USING gin (search_vector)"
    )
