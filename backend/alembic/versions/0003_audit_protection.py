"""Audit log DB-level protection and report retention trigger

Revision ID: 0003
Revises: 0002
Create Date: 2024-01-01 00:02:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Report retention trigger — prevent early deletion of reports
    # ------------------------------------------------------------------
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_early_report_delete()
        RETURNS trigger AS $$
        BEGIN
            IF OLD.retention_until > NOW() THEN
                RAISE EXCEPTION 'Cannot delete report before retention_until';
            END IF;
            RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE TRIGGER enforce_report_retention
        BEFORE DELETE ON reports
        FOR EACH ROW EXECUTE FUNCTION prevent_early_report_delete();
        """
    )

    # ------------------------------------------------------------------
    # Revoke UPDATE and DELETE on audit_logs from the application DB user
    # The application user is 'sri' (matches docker-compose / .env.local)
    # ------------------------------------------------------------------
    op.execute("REVOKE UPDATE, DELETE ON audit_logs FROM CURRENT_USER")


def downgrade() -> None:
    # Restore permissions
    op.execute("GRANT UPDATE, DELETE ON audit_logs TO CURRENT_USER")

    # Drop trigger and function
    op.execute("DROP TRIGGER IF EXISTS enforce_report_retention ON reports")
    op.execute("DROP FUNCTION IF EXISTS prevent_early_report_delete()")
