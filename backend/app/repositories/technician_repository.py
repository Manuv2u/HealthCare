"""TechnicianRepository — CRUD and assignment logic for technicians."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking
from app.models.service import Technician, TechnicianAssignment, TechnicianServiceArea


class TechnicianRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── CRUD ──────────────────────────────────────────────────────────────────

    async def create(
        self,
        user_id: uuid.UUID,
        name: str,
        phone: str,
        email: str,
    ) -> Technician:
        tech = Technician(
            id=uuid.uuid4(),
            user_id=user_id,
            name=name,
            phone=phone,
            email=email,
            is_active=True,
        )
        self.db.add(tech)
        await self.db.flush()
        await self.db.refresh(tech)
        return tech

    async def get_by_id(self, technician_id: uuid.UUID) -> Technician | None:
        result = await self.db.execute(
            select(Technician).where(
                Technician.id == technician_id,
                Technician.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_user_id(self, user_id: uuid.UUID) -> Technician | None:
        result = await self.db.execute(
            select(Technician).where(
                Technician.user_id == user_id,
                Technician.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Technician], int]:
        base = select(Technician).where(Technician.deleted_at.is_(None))

        count_result = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            base.order_by(Technician.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def update(
        self,
        technician_id: uuid.UUID,
        **fields: object,
    ) -> Technician | None:
        tech = await self.get_by_id(technician_id)
        if tech is None:
            return None
        await self.db.execute(
            update(Technician).where(Technician.id == technician_id).values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(technician_id)

    async def soft_delete(self, technician_id: uuid.UUID) -> None:
        now = datetime.now(timezone.utc)
        await self.db.execute(
            update(Technician)
            .where(Technician.id == technician_id)
            .values(deleted_at=now, is_active=False)
        )
        await self.db.flush()

    # ── Service area assignment ───────────────────────────────────────────────

    async def assign_service_areas(
        self,
        technician_id: uuid.UUID,
        service_area_ids: list[uuid.UUID],
    ) -> None:
        await self.db.execute(
            delete(TechnicianServiceArea).where(
                TechnicianServiceArea.technician_id == technician_id
            )
        )
        for sa_id in service_area_ids:
            self.db.add(
                TechnicianServiceArea(
                    technician_id=technician_id,
                    service_area_id=sa_id,
                )
            )
        await self.db.flush()

    # ── Workload queries ──────────────────────────────────────────────────────

    async def get_daily_booking_count(
        self,
        technician_id: uuid.UUID,
        booking_date: date,
    ) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(TechnicianAssignment)
            .join(Booking, Booking.id == TechnicianAssignment.booking_id)
            .where(
                TechnicianAssignment.technician_id == technician_id,
                Booking.booking_date == booking_date,
                Booking.status != "cancelled",
            )
        )
        return result.scalar_one()

    async def get_workload_summary(self, booking_date: date) -> list[dict]:
        result = await self.db.execute(
            select(
                Technician.id.label("technician_id"),
                Technician.name,
                func.count(TechnicianAssignment.id).label("booking_count"),
            )
            .outerjoin(
                TechnicianAssignment,
                TechnicianAssignment.technician_id == Technician.id,
            )
            .outerjoin(
                Booking,
                (Booking.id == TechnicianAssignment.booking_id)
                & (Booking.booking_date == booking_date)
                & (Booking.status != "cancelled"),
            )
            .where(
                Technician.deleted_at.is_(None),
                Technician.is_active.is_(True),
            )
            .group_by(Technician.id, Technician.name)
            .order_by(Technician.name)
        )
        rows = result.all()
        return [
            {
                "technician_id": row.technician_id,
                "name": row.name,
                "booking_count": row.booking_count,
            }
            for row in rows
        ]

    # ── Auto-assign ───────────────────────────────────────────────────────────

    async def auto_assign(
        self,
        service_area_id: uuid.UUID,
        booking_date: date,
    ) -> Technician | None:
        """
        Find the active technician covering service_area_id with the minimum
        booking count for booking_date (max 20). Returns None if none available.
        """
        booking_count_sq = (
            select(
                TechnicianAssignment.technician_id,
                func.count(TechnicianAssignment.id).label("cnt"),
            )
            .join(Booking, Booking.id == TechnicianAssignment.booking_id)
            .where(
                Booking.booking_date == booking_date,
                Booking.status != "cancelled",
            )
            .group_by(TechnicianAssignment.technician_id)
            .subquery()
        )

        result = await self.db.execute(
            select(Technician)
            .join(
                TechnicianServiceArea,
                TechnicianServiceArea.technician_id == Technician.id,
            )
            .outerjoin(
                booking_count_sq,
                booking_count_sq.c.technician_id == Technician.id,
            )
            .where(
                Technician.deleted_at.is_(None),
                Technician.is_active.is_(True),
                TechnicianServiceArea.service_area_id == service_area_id,
                func.coalesce(booking_count_sq.c.cnt, 0) < 20,
            )
            .order_by(func.coalesce(booking_count_sq.c.cnt, 0).asc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    # ── Assignment CRUD ───────────────────────────────────────────────────────

    async def create_assignment(
        self,
        booking_id: uuid.UUID,
        technician_id: uuid.UUID,
        assigned_by: uuid.UUID,
    ) -> TechnicianAssignment:
        # Remove any existing assignment for this booking
        await self.db.execute(
            delete(TechnicianAssignment).where(
                TechnicianAssignment.booking_id == booking_id
            )
        )
        assignment = TechnicianAssignment(
            id=uuid.uuid4(),
            booking_id=booking_id,
            technician_id=technician_id,
            assigned_at=datetime.now(timezone.utc),
            assigned_by=assigned_by,
            status="pending",
        )
        self.db.add(assignment)
        await self.db.flush()
        await self.db.refresh(assignment)
        return assignment

    async def get_assignment_by_id(
        self,
        assignment_id: uuid.UUID,
    ) -> TechnicianAssignment | None:
        result = await self.db.execute(
            select(TechnicianAssignment).where(TechnicianAssignment.id == assignment_id)
        )
        return result.scalar_one_or_none()

    async def get_assignment_by_booking(
        self,
        booking_id: uuid.UUID,
    ) -> TechnicianAssignment | None:
        result = await self.db.execute(
            select(TechnicianAssignment).where(
                TechnicianAssignment.booking_id == booking_id
            )
        )
        return result.scalar_one_or_none()

    async def respond_to_assignment(
        self,
        assignment_id: uuid.UUID,
        new_status: str,
        notes: str | None = None,
    ) -> TechnicianAssignment | None:
        now = datetime.now(timezone.utc)
        await self.db.execute(
            update(TechnicianAssignment)
            .where(TechnicianAssignment.id == assignment_id)
            .values(status=new_status, notes=notes, responded_at=now)
        )
        await self.db.flush()
        return await self.get_assignment_by_id(assignment_id)
