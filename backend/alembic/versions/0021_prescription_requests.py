"""Add prescription_requests + prescription_files tables for the
Upload Prescription lead-capture feature, plus a sequence used to build
human-readable request numbers (SRI-YYYYMMDD-000123).

Revision ID: 0021
Revises: 0020
Create Date: 2026-07-11
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS prescription_request_number_seq START 1")

    op.create_table(
        "prescription_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("request_number", sa.String(30), nullable=False),
        sa.Column("patient_name", sa.String(255), nullable=False),
        sa.Column("mobile", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("city", sa.String(120), nullable=False),
        sa.Column("callback_time", sa.String(40), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column("otp_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("source", sa.String(50), nullable=False, server_default="website_homepage"),
        sa.Column("assigned_to", sa.String(120), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.UniqueConstraint("request_number", name="uq_prescription_requests_request_number"),
    )
    op.create_index("ix_prescription_requests_status", "prescription_requests", ["status"])
    op.create_index("ix_prescription_requests_created_at", "prescription_requests", ["created_at"])
    op.create_index("ix_prescription_requests_mobile", "prescription_requests", ["mobile"])

    op.create_table(
        "prescription_files",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("prescription_request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["prescription_request_id"],
            ["prescription_requests.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_prescription_files_request_id", "prescription_files", ["prescription_request_id"]
    )


def downgrade() -> None:
    op.drop_table("prescription_files")
    op.drop_table("prescription_requests")
    op.execute("DROP SEQUENCE IF EXISTS prescription_request_number_seq")
