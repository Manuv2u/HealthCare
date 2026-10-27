"""ReportRepository — CRUD for report records."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report

_RETENTION_DAYS = 90


class ReportRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        booking_id: uuid.UUID,
        storage_key: str,
        file_name: str,
        file_size_bytes: int,
        uploaded_by: uuid.UUID,
        uploader_role: str,
    ) -> Report:
        now = datetime.now(timezone.utc)
        report = Report(
            id=uuid.uuid4(),
            booking_id=booking_id,
            storage_key=storage_key,
            file_name=file_name,
            file_size_bytes=file_size_bytes,
            uploaded_by=uploaded_by,
            uploader_role=uploader_role,
            uploaded_at=now,
            retention_until=date.today() + timedelta(days=_RETENTION_DAYS),
        )
        self.db.add(report)
        await self.db.flush()
        await self.db.refresh(report)
        return report

    async def get_by_id(self, report_id: uuid.UUID) -> Report | None:
        result = await self.db.execute(
            select(Report).where(Report.id == report_id)
        )
        return result.scalar_one_or_none()

    async def list_by_booking(self, booking_id: uuid.UUID) -> list[Report]:
        result = await self.db.execute(
            select(Report)
            .where(Report.booking_id == booking_id)
            .order_by(Report.uploaded_at.desc(), Report.id.desc())
        )
        return list(result.scalars().all())

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[tuple[Report, str]], int]:
        from sqlalchemy import func
        from app.models.booking import Booking

        # A re-upload supersedes the previous report for that booking. The old
        # rows stay in the DB for the retention period (see the
        # enforce_report_retention trigger), but only the newest upload per
        # booking is the "current" report, so that is all this listing exposes.
        current = (
            select(Report.id)
            .join(Booking, Booking.id == Report.booking_id)
            .where(Booking.user_id == user_id)
            .distinct(Report.booking_id)
            .order_by(Report.booking_id, Report.uploaded_at.desc(), Report.id.desc())
            .subquery()
        )

        base = (
            select(Report, Booking.reference_number)
            .join(Booking, Booking.id == Report.booking_id)
            .where(Report.id.in_(select(current.c.id)))
        )
        count_result = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            base.order_by(Report.uploaded_at.desc(), Report.id.desc())
            .offset(offset)
            .limit(page_size)
        )
        return [(r, ref) for r, ref in result.all()], total
