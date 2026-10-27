from datetime import datetime

from sqlalchemy import JSON, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, MappedColumn, mapped_column
from sqlalchemy.sql import func

# JSONB on PostgreSQL, plain JSON elsewhere — keeps the SQLite-backed test
# suite able to create these tables (JSONB has no SQLite DDL rendering).
JSONBCompat = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """Mixin that adds created_at and updated_at TIMESTAMPTZ columns."""

    created_at: MappedColumn[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: MappedColumn[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
