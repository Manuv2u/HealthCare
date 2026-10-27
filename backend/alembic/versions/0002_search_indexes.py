"""Search indexes — pg_trgm, GIN, trigram, BTREE, partial

Revision ID: 0002
Revises: 0001
Create Date: 2024-01-01 00:01:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pg_trgm extension for trigram similarity search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # GIN index on tests.search_vector for full-text search
    op.create_index(
        "ix_tests_search_vector",
        "tests",
        ["search_vector"],
        postgresql_using="gin",
    )

    # Trigram index on tests.name for ILIKE / similarity queries
    op.execute(
        "CREATE INDEX ix_tests_name_trgm ON tests USING gin (name gin_trgm_ops)"
    )

    # BTREE index on tests.category for category filter queries
    op.create_index(
        "ix_tests_category",
        "tests",
        ["category"],
        postgresql_using="btree",
    )

    # Partial index on service_areas.pincode WHERE is_active = true
    op.create_index(
        "ix_service_areas_pincode_active",
        "service_areas",
        ["pincode"],
        postgresql_where=sa.text("is_active = true"),
    )


def downgrade() -> None:
    op.drop_index("ix_service_areas_pincode_active", table_name="service_areas")
    op.drop_index("ix_tests_category", table_name="tests")
    op.execute("DROP INDEX IF EXISTS ix_tests_name_trgm")
    op.drop_index("ix_tests_search_vector", table_name="tests")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
