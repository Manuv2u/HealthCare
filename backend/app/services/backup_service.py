"""Backup service — pg_dump + gzip, upload to storage, prune old backups."""
from __future__ import annotations

import asyncio
import gzip
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.config import settings

logger = logging.getLogger("sri.backup")

_BACKUP_RETENTION_DAYS = 7


async def run_backup_job() -> None:
    """Daily 02:00 UTC: dump DB, compress, upload, prune old backups."""
    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.sql.gz"
    backup_dir = Path(settings.file_storage_path) / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    dest_path = backup_dir / filename

    try:
        # Run pg_dump
        db_url = settings.database_url.replace("+asyncpg", "")
        proc = await asyncio.create_subprocess_exec(
            "pg_dump", db_url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise RuntimeError(f"pg_dump failed: {stderr.decode()}")

        # Compress
        compressed = gzip.compress(stdout)
        dest_path.write_bytes(compressed)
        file_size = len(compressed)

        logger.info(
            "backup_complete: file=%s size_bytes=%d",
            filename,
            file_size,
        )

        # Prune backups older than 7 days
        cutoff = now - timedelta(days=_BACKUP_RETENTION_DAYS)
        pruned = 0
        for f in backup_dir.glob("backup_*.sql.gz"):
            try:
                mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc)
                if mtime < cutoff:
                    f.unlink()
                    pruned += 1
            except Exception as exc:
                logger.warning("backup_prune_failed: file=%s error=%s", f.name, exc)

        if pruned:
            logger.info("backup_pruned: count=%d", pruned)

    except Exception as exc:
        logger.error("backup_failed: error=%s", exc)
        # Notify admin via notification service
        try:
            from app.database import AsyncSessionFactory
            from app.services.notification_service import NotificationService
            # Find admin users and notify
            from sqlalchemy import select
            from app.models.user import User
            async with AsyncSessionFactory() as db:
                result = await db.execute(
                    select(User).where(User.role == "admin", User.is_active.is_(True))
                )
                admins = result.scalars().all()
                for admin in admins:
                    svc = NotificationService(db)
                    await svc.enqueue(
                        user_id=admin.id,
                        event_type="backup_failed",
                        channels=["email"],
                    )
                await db.commit()
        except Exception as notify_exc:
            logger.error("backup_admin_notify_failed: %s", notify_exc)


# ── Restore Validation ────────────────────────────────────────────────────────

_KEY_TABLES = ["users", "bookings", "payments", "tests", "packages"]


def _find_most_recent_backup() -> Path | None:
    """Return the most recent backup file from local storage, or None."""
    backup_dir = Path(settings.file_storage_path) / "backups"
    if not backup_dir.exists():
        return None
    candidates = sorted(backup_dir.glob("backup_*.sql.gz"), reverse=True)
    return candidates[0] if candidates else None


async def _run_pg_restore(backup_path: Path, temp_db_url: str) -> tuple[int, str]:
    """
    Decompress backup and pipe into psql to restore into temp_db_url.
    Separated into its own coroutine so tests can override it easily.
    Returns (returncode, stderr_text).
    """
    import tempfile

    # Decompress to a temp file
    with tempfile.NamedTemporaryFile(suffix=".sql", delete=False) as tmp:
        tmp_path = Path(tmp.name)
        tmp_path.write_bytes(gzip.decompress(backup_path.read_bytes()))

    try:
        proc = await asyncio.create_subprocess_exec(
            "psql", temp_db_url, "-f", str(tmp_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        return proc.returncode, stderr.decode()
    finally:
        tmp_path.unlink(missing_ok=True)


async def _get_row_counts(db_url: str, tables: list[str]) -> dict[str, int]:
    """Return {table: row_count} for each table in *tables* using psql."""
    counts: dict[str, int] = {}
    for table in tables:
        proc = await asyncio.create_subprocess_exec(
            "psql", db_url,
            "-t", "-c", f"SELECT COUNT(*) FROM {table};",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        try:
            counts[table] = int(stdout.decode().strip())
        except ValueError:
            counts[table] = -1
    return counts


async def _notify_admin_restore_failure(reason: str) -> None:
    """Enqueue an email notification to all active admins about restore failure."""
    try:
        from app.database import AsyncSessionFactory
        from app.services.notification_service import NotificationService
        from sqlalchemy import select
        from app.models.user import User

        async with AsyncSessionFactory() as db:
            result = await db.execute(
                select(User).where(User.role == "admin", User.is_active.is_(True))
            )
            admins = result.scalars().all()
            for admin in admins:
                svc = NotificationService(db)
                await svc.enqueue(
                    user_id=admin.id,
                    event_type="restore_validation_failed",
                    channels=["email"],
                )
            await db.commit()
    except Exception as exc:
        logger.error("restore_validation_notify_failed: %s", exc)


async def run_restore_validation() -> None:
    """
    Monthly APScheduler job — restore most recent backup to a temporary DB,
    run schema sanity checks and row-count comparison, log result, notify
    admin on failure, then drop the temporary DB.

    Never raises — all errors are caught and logged so the scheduler stays alive.
    """
    start = datetime.now(timezone.utc)
    timestamp = start.strftime("%Y%m%d_%H%M%S")
    temp_db_name = f"sri_restore_validation_{timestamp}"

    # Parse production DB URL (strip async driver prefix)
    prod_url = settings.database_url.replace("+asyncpg", "")
    # Build temp DB URL by replacing the DB name at the end of the URL
    # e.g. postgresql://user:pass@host:5432/sri_lab  →  .../sri_restore_validation_...
    base_url = prod_url.rsplit("/", 1)[0]
    temp_db_url = f"{base_url}/{temp_db_name}"
    # Admin URL (connect to postgres maintenance DB to CREATE/DROP)
    admin_url = f"{base_url}/postgres"

    passed = False
    backup_path: Path | None = None
    row_counts_prod: dict[str, int] = {}
    row_counts_restored: dict[str, int] = {}

    try:
        # 1. Find most recent backup
        backup_path = _find_most_recent_backup()
        if backup_path is None:
            logger.error("restore_validation_failed: no backup file found")
            await _notify_admin_restore_failure("no backup file found")
            return

        # 2. Create temporary database
        create_proc = await asyncio.create_subprocess_exec(
            "psql", admin_url,
            "-c", f"CREATE DATABASE {temp_db_name};",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, create_stderr = await create_proc.communicate()
        if create_proc.returncode != 0:
            raise RuntimeError(f"CREATE DATABASE failed: {create_stderr.decode()}")

        try:
            # 3. Restore backup into temp DB
            rc, restore_stderr = await _run_pg_restore(backup_path, temp_db_url)
            if rc != 0:
                raise RuntimeError(f"pg_restore failed (rc={rc}): {restore_stderr}")

            # 4. Schema sanity check — verify key tables exist
            missing_tables: list[str] = []
            for table in _KEY_TABLES:
                check_proc = await asyncio.create_subprocess_exec(
                    "psql", temp_db_url,
                    "-t", "-c",
                    f"SELECT to_regclass('{table}');",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await check_proc.communicate()
                result = stdout.decode().strip()
                if not result or result.lower() in ("", "null", "-"):
                    missing_tables.append(table)

            if missing_tables:
                raise RuntimeError(f"Schema check failed — missing tables: {missing_tables}")

            # 5. Row-count comparison
            row_counts_prod = await _get_row_counts(prod_url, _KEY_TABLES)
            row_counts_restored = await _get_row_counts(temp_db_url, _KEY_TABLES)

            passed = True

        finally:
            # 7. Drop temporary DB (always, even on failure)
            drop_proc = await asyncio.create_subprocess_exec(
                "psql", admin_url,
                "-c", f"DROP DATABASE IF EXISTS {temp_db_name};",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, drop_stderr = await drop_proc.communicate()
            if drop_proc.returncode != 0:
                logger.warning(
                    "restore_validation_drop_failed: db=%s error=%s",
                    temp_db_name,
                    drop_stderr.decode(),
                )

    except Exception as exc:
        logger.error("restore_validation_failed: error=%s", exc)
        await _notify_admin_restore_failure(str(exc))
        passed = False

    # 6. Log result
    duration = (datetime.now(timezone.utc) - start).total_seconds()
    status_str = "pass" if passed else "fail"
    logger.info(
        "restore_validation_result: status=%s duration_seconds=%.1f "
        "backup=%s prod_counts=%s restored_counts=%s",
        status_str,
        duration,
        backup_path.name if backup_path is not None else "unknown",
        row_counts_prod,
        row_counts_restored,
    )

    if not passed:
        # Already notified inside the except block; log at ERROR level too
        logger.error(
            "restore_validation_failed: status=fail duration_seconds=%.1f",
            duration,
        )
