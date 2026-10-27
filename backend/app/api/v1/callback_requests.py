"""Callback requests router: public lead capture + admin queue."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.schemas.callback_requests import (
    CallbackRequestCreate,
    CallbackRequestListResponse,
    CallbackRequestOut,
    UpdateCallbackRequestStatus,
)
from app.services.callback_request_service import CallbackRequestService

router = APIRouter(prefix="/callback-requests", tags=["callback-requests"])


@router.post("", response_model=CallbackRequestOut, status_code=201)
async def create_callback_request(
    body: CallbackRequestCreate,
    db: AsyncSession = Depends(get_db_session),
) -> CallbackRequestOut:
    svc = CallbackRequestService(db)
    result = await svc.create(
        name=body.name,
        phone=body.phone,
        source=body.source,
        email=body.email,
        subject=body.subject,
        preferred_time=body.preferred_time,
        message=body.message,
    )
    return CallbackRequestOut.model_validate(result)


@router.get("", response_model=CallbackRequestListResponse)
async def list_callback_requests(
    status: str | None = Query(default=None),
    source: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> CallbackRequestListResponse:
    svc = CallbackRequestService(db)
    result = await svc.list(
        status_filter=status, source_filter=source, page=page, page_size=page_size
    )
    return CallbackRequestListResponse(
        items=[CallbackRequestOut.model_validate(i) for i in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.put("/{request_id}", response_model=CallbackRequestOut)
async def update_callback_request(
    request_id: uuid.UUID,
    body: UpdateCallbackRequestStatus,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> CallbackRequestOut:
    svc = CallbackRequestService(db)
    result = await svc.update_status(request_id, body.status, body.notes)
    return CallbackRequestOut.model_validate(result)
