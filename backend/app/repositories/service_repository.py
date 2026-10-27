"""ServiceAreaRepository and ServiceRequestRepository."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import ServiceArea, ServiceRequest, TechnicianServiceArea


class ServiceAreaRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        district: str,
        city: str,
        pincode: str,
        state: str | None = None,
        taluk: str | None = None,
        area: str | None = None,
    ) -> ServiceArea:
        area = ServiceArea(
            id=uuid.uuid4(),
            state=state,
            district=district,
            taluk=taluk,
            city=city,
            area=area,
            pincode=pincode,
        )
        self.db.add(area)
        await self.db.flush()
        await self.db.refresh(area)
        return area

    async def get_by_id(self, area_id: uuid.UUID) -> ServiceArea | None:
        result = await self.db.execute(
            select(ServiceArea).where(ServiceArea.id == area_id)
        )
        return result.scalar_one_or_none()

    async def get_by_pincode(self, pincode: str) -> ServiceArea | None:
        """Return active service area for the given pincode (uses partial index)."""
        result = await self.db.execute(
            select(ServiceArea).where(
                ServiceArea.pincode == pincode,
                ServiceArea.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
        active_only: bool = False,
    ) -> tuple[list[ServiceArea], int]:
        query = select(ServiceArea)
        if active_only:
            query = query.where(ServiceArea.is_active.is_(True))
        count_result = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar_one()
        offset = (page - 1) * page_size
        result = await self.db.execute(
            query.order_by(ServiceArea.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def update(self, area_id: uuid.UUID, **fields: object) -> ServiceArea | None:
        if not fields:
            return await self.get_by_id(area_id)
        await self.db.execute(
            update(ServiceArea).where(ServiceArea.id == area_id).values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(area_id)

    async def soft_delete(self, area_id: uuid.UUID) -> None:
        await self.db.execute(
            update(ServiceArea).where(ServiceArea.id == area_id).values(is_active=False)
        )
        await self.db.flush()

    async def delete(self, area_id: uuid.UUID) -> None:
        """Hard-delete a service area, removing technician assignments first."""
        await self.db.execute(
            delete(TechnicianServiceArea).where(TechnicianServiceArea.service_area_id == area_id)
        )
        await self.db.execute(delete(ServiceArea).where(ServiceArea.id == area_id))
        await self.db.flush()


class ServiceRequestRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_service_request(
        self, user_id: uuid.UUID, pincode: str
    ) -> ServiceRequest:
        """Insert a new service request; return existing if unique constraint violated."""
        req = ServiceRequest(
            id=uuid.uuid4(),
            user_id=user_id,
            pincode=pincode,
        )
        self.db.add(req)
        try:
            await self.db.flush()
            await self.db.refresh(req)
            return req
        except IntegrityError:
            await self.db.rollback()
            # Return the existing pending request
            result = await self.db.execute(
                select(ServiceRequest).where(
                    ServiceRequest.user_id == user_id,
                    ServiceRequest.pincode == pincode,
                    ServiceRequest.notified_at.is_(None),
                )
            )
            existing = result.scalar_one()
            return existing

    async def get_pending_requests_by_pincode(
        self, pincode: str
    ) -> list[ServiceRequest]:
        result = await self.db.execute(
            select(ServiceRequest).where(
                ServiceRequest.pincode == pincode,
                ServiceRequest.notified_at.is_(None),
            )
        )
        return list(result.scalars().all())

    async def mark_notified(self, request_ids: list[uuid.UUID]) -> None:
        if not request_ids:
            return
        await self.db.execute(
            update(ServiceRequest)
            .where(ServiceRequest.id.in_(request_ids))
            .values(notified_at=datetime.now(timezone.utc))
        )
        await self.db.flush()

    async def count_user_requests_last_24h(self, user_id: uuid.UUID) -> int:
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        result = await self.db.execute(
            select(func.count()).where(
                ServiceRequest.user_id == user_id,
                ServiceRequest.created_at >= since,
            )
        )
        return result.scalar_one()

    async def get_pending_request(
        self, user_id: uuid.UUID, pincode: str
    ) -> ServiceRequest | None:
        result = await self.db.execute(
            select(ServiceRequest).where(
                ServiceRequest.user_id == user_id,
                ServiceRequest.pincode == pincode,
                ServiceRequest.notified_at.is_(None),
            )
        )
        return result.scalar_one_or_none()
