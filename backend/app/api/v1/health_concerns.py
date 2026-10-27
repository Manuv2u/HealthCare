"""Health concerns router: public listing + admin test/package mapping."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.schemas.health_concerns import HealthConcernMappingOut, HealthConcernOut, SetMappingRequest
from app.services.health_concern_service import HealthConcernService

router = APIRouter(prefix="/health-concerns", tags=["health-concerns"])


@router.get("", response_model=list[HealthConcernOut])
async def list_health_concerns(
    db: AsyncSession = Depends(get_db_session),
) -> list[HealthConcernOut]:
    svc = HealthConcernService(db)
    concerns = await svc.list_active()
    return [HealthConcernOut.model_validate(c) for c in concerns]


@router.get("/{concern_id}/mappings", response_model=HealthConcernMappingOut)
async def get_health_concern_mappings(
    concern_id: uuid.UUID,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> HealthConcernMappingOut:
    svc = HealthConcernService(db)
    result = await svc.get_mappings(concern_id)
    return HealthConcernMappingOut(**result)


@router.put("/{concern_id}/tests", status_code=204)
async def set_health_concern_tests(
    concern_id: uuid.UUID,
    body: SetMappingRequest,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = HealthConcernService(db)
    await svc.set_test_mappings(concern_id, body.ids)


@router.put("/{concern_id}/packages", status_code=204)
async def set_health_concern_packages(
    concern_id: uuid.UUID,
    body: SetMappingRequest,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = HealthConcernService(db)
    await svc.set_package_mappings(concern_id, body.ids)
