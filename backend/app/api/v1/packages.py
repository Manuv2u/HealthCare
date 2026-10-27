"""Packages router."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.schemas.packages import PackageCreate, PackageListResponse, PackageOut, PackageUpdate
from app.services.package_service import PackageService
from app.utils.jwt import decode_access_token

router = APIRouter(prefix="/packages", tags=["packages"])

_optional_bearer = HTTPBearer(auto_error=False)


async def _optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> dict | None:
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        role = payload.get("role")
        if user_id and role:
            return {"user_id": user_id, "role": role}
    except Exception:
        pass
    return None


class _TestIdsBody(BaseModel):
    test_ids: list[uuid.UUID]


@router.post("", response_model=PackageOut, status_code=201)
async def create_package(
    body: PackageCreate,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PackageOut:
    svc = PackageService(db)
    result = await svc.create_package(
        name=body.name,
        description=body.description,
        original_price=body.original_price,
        discounted_price=body.discounted_price,
        is_popular=body.is_popular,
        test_ids=body.test_ids,
    )
    return PackageOut.model_validate(result)


@router.get("", response_model=PackageListResponse)
async def list_packages(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    include_inactive: bool = Query(default=False),
    health_concern: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict | None = Depends(_optional_current_user),
) -> PackageListResponse:
    svc = PackageService(db)
    requester_role = current_user["role"] if current_user else "user"
    # Only admins can request inactive packages
    active_only = not (include_inactive and requester_role == "admin")
    result = await svc.list_packages(
        page=page, page_size=page_size, active_only=active_only, health_concern=health_concern
    )
    return PackageListResponse(
        items=[PackageOut.model_validate(i) for i in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.get("/{package_id}", response_model=PackageOut)
async def get_package(
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> PackageOut:
    svc = PackageService(db)
    result = await svc.get_package(package_id)
    return PackageOut.model_validate(result)


@router.put("/{package_id}", response_model=PackageOut)
async def update_package(
    package_id: uuid.UUID,
    body: PackageUpdate,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PackageOut:
    svc = PackageService(db)
    result = await svc.update_package(package_id, **body.model_dump(exclude_none=True))
    return PackageOut.model_validate(result)


@router.delete("/{package_id}", status_code=204)
async def delete_package(
    package_id: uuid.UUID,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = PackageService(db)
    await svc.delete_package(package_id)


@router.post("/{package_id}/tests", response_model=PackageOut)
async def add_tests_to_package(
    package_id: uuid.UUID,
    body: _TestIdsBody,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PackageOut:
    svc = PackageService(db)
    result = await svc.add_tests(package_id, body.test_ids)
    return PackageOut.model_validate(result)


@router.delete("/{package_id}/tests", response_model=PackageOut)
async def remove_tests_from_package(
    package_id: uuid.UUID,
    body: _TestIdsBody,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PackageOut:
    svc = PackageService(db)
    result = await svc.remove_tests(package_id, body.test_ids)
    return PackageOut.model_validate(result)
