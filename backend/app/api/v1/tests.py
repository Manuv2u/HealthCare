"""Tests router."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.schemas.tests import TestCreate, TestListResponse, TestOut, TestUpdate
from app.services.test_service import TestService
from app.utils.jwt import decode_access_token

router = APIRouter(prefix="/tests", tags=["tests"])

_optional_bearer = HTTPBearer(auto_error=False)


async def _optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> dict | None:
    """Return user dict if a valid token is present, else None (public access)."""
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


@router.post("", response_model=TestOut, status_code=201)
async def create_test(
    body: TestCreate,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> TestOut:
    svc = TestService(db)
    result = await svc.create_test(
        name=body.name,
        category=body.category,
        description=body.description,
        price=body.price,
        discount_percentage=body.discount_percentage,
        turnaround_hours=body.turnaround_hours,
        is_popular=body.is_popular,
        sample_type=body.sample_type,
        recommended_for=body.recommended_for,
        feature_cards=[c.model_dump() for c in body.feature_cards],
        faqs=[f.model_dump() for f in body.faqs],
    )
    return TestOut.model_validate(result)


@router.get("", response_model=TestListResponse)
async def list_tests(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    health_concern: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    include_deleted: bool = Query(default=False),
    include_inactive: bool = Query(default=False),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict | None = Depends(_optional_current_user),
) -> TestListResponse:
    svc = TestService(db)
    requester_role = current_user["role"] if current_user else "user"
    # include_inactive=true only works for admins (e.g. admin panel)
    if include_inactive and requester_role == "admin":
        effective_role = "admin"
    else:
        effective_role = "user"  # force active_only for public catalog
    result = await svc.list_tests(
        q=q,
        category=category,
        health_concern=health_concern,
        page=page,
        page_size=page_size,
        include_deleted=include_deleted,
        requester_role=effective_role,
    )
    return TestListResponse(
        items=[TestOut.model_validate(i) for i in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.get("/{test_id}", response_model=TestOut)
async def get_test(
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> TestOut:
    svc = TestService(db)
    result = await svc.get_test(test_id)
    return TestOut.model_validate(result)


@router.put("/{test_id}", response_model=TestOut)
async def update_test(
    test_id: uuid.UUID,
    body: TestUpdate,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> TestOut:
    svc = TestService(db)
    result = await svc.update_test(test_id, **body.model_dump(exclude_none=True))
    return TestOut.model_validate(result)


@router.delete("/{test_id}", status_code=204)
async def delete_test(
    test_id: uuid.UUID,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = TestService(db)
    await svc.delete_test(test_id)
