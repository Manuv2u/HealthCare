"""CallbackRequestService: quick-help lead capture + admin queue."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.callback_request_repository import CallbackRequestRepository


class CallbackRequestService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = CallbackRequestRepository(db)

    async def create(
        self,
        name: str | None,
        phone: str,
        source: str = "callback",
        email: str | None = None,
        subject: str | None = None,
        preferred_time: str | None = None,
        message: str | None = None,
    ):
        return await self.repo.create(
            name=name,
            phone=phone,
            source=source,
            email=email,
            subject=subject,
            preferred_time=preferred_time,
            message=message,
        )

    async def list(
        self,
        status_filter: str | None,
        page: int,
        page_size: int,
        source_filter: str | None = None,
    ) -> dict:
        items, total = await self.repo.list(
            status=status_filter, source=source_filter, page=page, page_size=page_size
        )
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    async def update_status(self, request_id: uuid.UUID, new_status: str, notes: str | None):
        req = await self.repo.update_status(request_id, new_status, notes)
        if req is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "CALLBACK_REQUEST_NOT_FOUND", "message": "Callback request not found"},
            )
        return req
