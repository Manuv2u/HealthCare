"""Service areas router."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import get_current_user, require_roles
from app.repositories.service_repository import ServiceAreaRepository, ServiceRequestRepository
from app.schemas.service_areas import (
    NotifyMeRequest,
    ServiceAreaCreate,
    ServiceAreaListResponse,
    ServiceAreaOut,
    ServiceAreaUpdate,
    ServiceabilityCheckRequest,
    ServiceabilityCheckResponse,
    ServiceabilityOut,
    ServiceRequestOut,
)
from app.services.serviceability_service import check_pincodes

router = APIRouter(prefix="/service-areas", tags=["service-areas"])


@router.post("", response_model=ServiceAreaOut, status_code=201)
async def create_service_area(
    body: ServiceAreaCreate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> ServiceAreaOut:
    repo = ServiceAreaRepository(db)
    area = await repo.create(
        state=body.state,
        district=body.district,
        taluk=body.taluk,
        city=body.city,
        area=body.area,
        pincode=body.pincode,
    )
    return ServiceAreaOut.model_validate(area)


@router.get("", response_model=ServiceAreaListResponse)
async def list_service_areas(
    page: int = 1,
    page_size: int = 20,
    active_only: bool = False,
    db: AsyncSession = Depends(get_db_session),
) -> ServiceAreaListResponse:
    repo = ServiceAreaRepository(db)
    items, total = await repo.list(page=page, page_size=page_size, active_only=active_only)
    return ServiceAreaListResponse(
        items=[ServiceAreaOut.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# NOTE: /serviceability must be declared BEFORE /{id} to avoid path conflict
@router.post("/serviceability", response_model=ServiceabilityCheckResponse)
async def check_serviceability(
    body: ServiceabilityCheckRequest,
    db: AsyncSession = Depends(get_db_session),
) -> ServiceabilityCheckResponse:
    """Are these pincodes serviceable for home collection, and if not, why?

    Batch so the booking step can badge a whole address list in one round trip.
    Public — matches the unauthenticated `GET /service-areas` listing, and the
    same coverage facts are already derivable from it.
    """
    verdicts = await check_pincodes(db, body.pincodes)
    return ServiceabilityCheckResponse(
        results=[ServiceabilityOut.model_validate(v) for v in verdicts]
    )


# NOTE: /notify-me must be declared BEFORE /{id} to avoid path conflict
@router.post("/notify-me", status_code=201)
async def notify_me(
    body: NotifyMeRequest,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    area_repo = ServiceAreaRepository(db)
    req_repo = ServiceRequestRepository(db)

    # Check if service area already active for this pincode
    existing_area = await area_repo.get_by_pincode(body.pincode)
    if existing_area:
        response.status_code = status.HTTP_200_OK
        return {"message": "Service already available"}

    user_id = uuid.UUID(current_user["user_id"])

    # Rate limit: max 5 requests per user in last 24h
    count = await req_repo.count_user_requests_last_24h(user_id)
    if count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error_code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests"},
            headers={"Retry-After": "86400"},
        )

    # Check for duplicate pending request
    existing_req = await req_repo.get_pending_request(user_id, body.pincode)
    if existing_req:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": "DUPLICATE_REQUEST", "message": "Request already pending"},
        )

    await req_repo.create_service_request(user_id=user_id, pincode=body.pincode)
    return {"message": "Notification request registered"}


@router.get("/{area_id}", response_model=ServiceAreaOut)
async def get_service_area(
    area_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> ServiceAreaOut:
    repo = ServiceAreaRepository(db)
    area = await repo.get_by_id(area_id)
    if not area:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "Service area not found"})
    return ServiceAreaOut.model_validate(area)


@router.put("/{area_id}", response_model=ServiceAreaOut)
@router.patch("/{area_id}", response_model=ServiceAreaOut)
async def update_service_area(
    area_id: uuid.UUID,
    body: ServiceAreaUpdate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> ServiceAreaOut:
    repo = ServiceAreaRepository(db)
    area = await repo.update(area_id, **body.model_dump(exclude_none=True))
    if not area:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "Service area not found"})
    return ServiceAreaOut.model_validate(area)


@router.delete("/{area_id}", status_code=204)
async def delete_service_area(
    area_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    repo = ServiceAreaRepository(db)
    area = await repo.get_by_id(area_id)
    if not area:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "Service area not found"})
    await repo.delete(area_id)
