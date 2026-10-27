"""Add email_verification_otps table and backfill email_verified_at for
existing users.

New registrations must verify their email (6-digit OTP) before they can log
in. Existing accounts never went through this flow, so they're backfilled as
already-verified here — otherwise every current user (including the seeded
admin) would be locked out the moment the login gate ships.

Revision ID: 0039
Revises: 0038
Create Date: 2026-07-25
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_verification_otps",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_verification_otps_user_id", "email_verification_otps", ["user_id"])

    # Grandfather existing accounts in as verified so the new login gate
    # doesn't lock anyone out who signed up before this feature existed.
    op.execute(
        "UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at) "
        "WHERE email IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_email_verification_otps_user_id", table_name="email_verification_otps")
    op.drop_table("email_verification_otps")
