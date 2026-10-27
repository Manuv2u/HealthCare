"""PrescriptionRequest repository: upload-prescription lead capture."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prescription_request import PrescriptionFile, PrescriptionRequest


class PrescriptionRequestRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def next_request_number(self, now: datetime) -> str:
        seq = await self.db.execute(text("SELECT nextval('prescription_request_number_seq')"))
        return f"SRI-{now:%Y%m%d}-{seq.scalar_one():06d}"

    async def create(
        self,
        request_number: str,
        patient_name: str,
        mobile: str,
        city: str,
        email: str | None = None,
        callback_time: str | None = None,
        remarks: str | None = None,
        source: str = "website_homepage",
        otp_verified: bool = True,
    ) -> PrescriptionRequest:
        req = PrescriptionRequest(
            id=uuid.uuid4(),
            request_number=request_number,
            patient_name=patient_name,
            mobile=mobile,
            email=email,
            city=city,
            callback_time=callback_time,
            remarks=remarks,
            source=source,
            otp_verified=otp_verified,
        )
        self.db.add(req)
        await self.db.flush()
        await self.db.refresh(req)
        return req

    async def add_file(
        self,
        request_id: uuid.UUID,
        file_name: str,
        file_path: str,
        content_type: str,
        file_size: int,
    ) -> PrescriptionFile:
        f = PrescriptionFile(
            id=uuid.uuid4(),
            prescription_request_id=request_id,
            file_name=file_name,
            file_path=file_path,
            content_type=content_type,
            file_size=file_size,
        )
        self.db.add(f)
        await self.db.flush()
        return f

    async def get_by_id(self, request_id: uuid.UUID) -> PrescriptionRequest | None:
        result = await self.db.execute(
            select(PrescriptionRequest).where(PrescriptionRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        status: str | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 20,
        sort: str = "created_at",
        order: str = "desc",
    ) -> tuple[list[PrescriptionRequest], int]:
        base_query = select(PrescriptionRequest)
        count_query = select(func.count()).select_from(PrescriptionRequest)

        if status:
            base_query = base_query.where(PrescriptionRequest.status == status)
            count_query = count_query.where(PrescriptionRequest.status == status)
        if q:
            pattern = f"%{q.strip()}%"
            criteria = or_(
                PrescriptionRequest.patient_name.ilike(pattern),
                PrescriptionRequest.mobile.ilike(pattern),
                PrescriptionRequest.city.ilike(pattern),
                PrescriptionRequest.request_number.ilike(pattern),
            )
            base_query = base_query.where(criteria)
            count_query = count_query.where(criteria)

        sort_columns = {
            "created_at": PrescriptionRequest.created_at,
            "patient_name": PrescriptionRequest.patient_name,
            "city": PrescriptionRequest.city,
            "status": PrescriptionRequest.status,
        }
        col = sort_columns.get(sort, PrescriptionRequest.created_at)
        base_query = base_query.order_by(col.asc() if order == "asc" else col.desc())

        offset = (page - 1) * page_size
        base_query = base_query.limit(page_size).offset(offset)

        items_result = await self.db.execute(base_query)
        count_result = await self.db.execute(count_query)
        return list(items_result.scalars().all()), count_result.scalar_one()

    async def update(
        self,
        request_id: uuid.UUID,
        status: str | None = None,
        assigned_to: str | None = None,
        remarks: str | None = None,
    ) -> PrescriptionRequest | None:
        req = await self.get_by_id(request_id)
        if req is None:
            return None
        if status is not None:
            req.status = status
        if assigned_to is not None:
            req.assigned_to = assigned_to
        if remarks is not None:
            req.remarks = remarks
        await self.db.flush()
        await self.db.refresh(req)
        return req

    async def delete(self, request_id: uuid.UUID) -> bool:
        req = await self.get_by_id(request_id)
        if req is None:
            return False
        await self.db.delete(req)
        await self.db.flush()
        return True

    async def stats(self, today_start: datetime) -> dict:
        total = (
            await self.db.execute(select(func.count()).select_from(PrescriptionRequest))
        ).scalar_one()
        today = (
            await self.db.execute(
                select(func.count())
                .select_from(PrescriptionRequest)
                .where(PrescriptionRequest.created_at >= today_start)
            )
        ).scalar_one()
        pending = (
            await self.db.execute(
                select(func.count())
                .select_from(PrescriptionRequest)
                .where(PrescriptionRequest.status == "new")
            )
        ).scalar_one()
        booked = (
            await self.db.execute(
                select(func.count())
                .select_from(PrescriptionRequest)
                .where(PrescriptionRequest.status == "booked")
            )
        ).scalar_one()
        return {
            "today_requests": today,
            "pending_calls": pending,
            "booked_from_prescription": booked,
            "conversion_rate": round(booked / total * 100, 1) if total else 0.0,
        }
