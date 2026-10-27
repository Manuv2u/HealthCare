"""TimeSlotRepository."""
from __future__ import annotations

import uuid
from datetime import date, time

from sqlalchemy import func, literal, outerjoin, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import BookingSlotCount
from app.models.service import TimeSlot
from app.utils import timezone as lab_tz


class TimeSlotRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        start_time: time,
        end_time: time,
        collection_type: str,
        days_of_week: list[int],
        slot_capacity: int,
    ) -> TimeSlot:
        slot = TimeSlot(
            id=uuid.uuid4(),
            start_time=start_time,
            end_time=end_time,
            collection_type=collection_type,
            days_of_week=days_of_week,
            slot_capacity=slot_capacity,
        )
        self.db.add(slot)
        await self.db.flush()
        await self.db.refresh(slot)
        return slot

    async def get_by_id(self, slot_id: uuid.UUID) -> TimeSlot | None:
        result = await self.db.execute(
            select(TimeSlot).where(TimeSlot.id == slot_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[TimeSlot], int]:
        query = select(TimeSlot)
        count_result = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar_one()
        offset = (page - 1) * page_size
        result = await self.db.execute(
            query.order_by(TimeSlot.start_time).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def update(self, slot_id: uuid.UUID, **fields: object) -> TimeSlot | None:
        if not fields:
            return await self.get_by_id(slot_id)
        await self.db.execute(
            update(TimeSlot).where(TimeSlot.id == slot_id).values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(slot_id)

    async def delete(self, slot_id: uuid.UUID) -> None:
        await self.db.execute(
            update(TimeSlot).where(TimeSlot.id == slot_id).values(is_active=False)
        )
        await self.db.flush()

    async def get_available_slots(
        self, booking_date: date, collection_type: str
    ) -> list[dict]:
        """Return active slots with remaining capacity > 0 for the given date and type."""
        day_of_week = booking_date.weekday()  # 0=Mon..6=Sun

        # Left join TimeSlot with BookingSlotCount for the specific date
        j = outerjoin(
            TimeSlot,
            BookingSlotCount,
            (BookingSlotCount.time_slot_id == TimeSlot.id)
            & (BookingSlotCount.booking_date == booking_date),
        )
        stmt = (
            select(
                TimeSlot.id,
                TimeSlot.start_time,
                TimeSlot.end_time,
                TimeSlot.collection_type,
                TimeSlot.slot_capacity,
                func.coalesce(BookingSlotCount.confirmed_count, 0).label("confirmed_count"),
            )
            .select_from(j)
            .where(
                TimeSlot.is_active.is_(True),
                TimeSlot.collection_type == collection_type,
                literal(day_of_week) == func.any_(TimeSlot.days_of_week),
            )
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        local_now = lab_tz.local_now()
        is_today = booking_date == local_now.date()

        available = []
        for row in rows:
            if is_today and row.start_time <= local_now.time():
                continue

            remaining = row.slot_capacity - row.confirmed_count
            if remaining > 0:
                # Format label e.g. "7:00 AM – 8:00 AM"
                def fmt(t: object) -> str:
                    from datetime import time as dtime
                    if isinstance(t, dtime):
                        h, m = t.hour, t.minute
                    else:
                        h, m = int(str(t).split(":")[0]), int(str(t).split(":")[1])
                    suffix = "AM" if h < 12 else "PM"
                    h12 = h % 12 or 12
                    return f"{h12}:{m:02d} {suffix}"

                label = f"{fmt(row.start_time)} – {fmt(row.end_time)}"
                available.append(
                    {
                        "id": row.id,
                        "label": label,
                        "start_time": row.start_time,
                        "end_time": row.end_time,
                        "collection_type": row.collection_type,
                        "slot_capacity": row.slot_capacity,
                        "confirmed_count": row.confirmed_count,
                        "remaining_capacity": remaining,
                        "is_enabled": True,
                    }
                )
        return available
