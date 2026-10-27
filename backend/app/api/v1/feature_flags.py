"""Feature flags router."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.services.feature_flag_service import FeatureFlagService

router = APIRouter(prefix="/feature-flags", tags=["feature-flags"])


class FeatureFlagOut(BaseModel):
    id: uuid.UUID
    key: str
    is_enabled: bool
    description: Optional[str]
    updated_by: Optional[uuid.UUID]
    updated_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class FeatureFlagUpsertRequest(BaseModel):
    key: str
    is_enabled: bool
    description: Optional[str] = None


class FeatureFlagUpdateRequest(BaseModel):
    """Partial update — the admin toggle sends only is_enabled."""

    is_enabled: Optional[bool] = None
    description: Optional[str] = None


@router.get("", response_model=list[FeatureFlagOut])
async def list_feature_flags(
    db: AsyncSession = Depends(get_db_session),
) -> list[FeatureFlagOut]:
    svc = FeatureFlagService(db)
    items = await svc.list_all()
    return [FeatureFlagOut.model_validate(item) for item in items]


@router.post("", response_model=FeatureFlagOut, status_code=201)
async def create_feature_flag(
    body: FeatureFlagUpsertRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> FeatureFlagOut:
    from app.utils.audit import audit

    svc = FeatureFlagService(db)
    result = await svc.upsert(
        key=body.key,
        is_enabled=body.is_enabled,
        description=body.description,
        updated_by=uuid.UUID(current_user["user_id"]),
    )
    await audit(
        db,
        action_type="FEATURE_FLAG_UPDATED",
        entity_type="feature_flag",
        entity_id=body.key,
        outcome="success",
        actor_id=uuid.UUID(current_user["user_id"]),
        actor_role=current_user["role"],
    )
    return FeatureFlagOut.model_validate(result)


@router.put("/{flag_id}", response_model=FeatureFlagOut)
async def update_feature_flag(
    flag_id: uuid.UUID,
    body: FeatureFlagUpdateRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> FeatureFlagOut:
    """Partial update of the flag addressed by the path id. (This used to
    require `key` in the body and upsert by key while ignoring the id — the
    admin toggle sends only `is_enabled`, so every toggle 422'd.)"""
    from app.utils.audit import audit

    svc = FeatureFlagService(db)
    result = await svc.update_flag(
        flag_id=flag_id,
        is_enabled=body.is_enabled,
        description=body.description,
        updated_by=uuid.UUID(current_user["user_id"]),
    )
    await audit(
        db,
        action_type="FEATURE_FLAG_UPDATED",
        entity_type="feature_flag",
        entity_id=result["key"],
        outcome="success",
        actor_id=uuid.UUID(current_user["user_id"]),
        actor_role=current_user["role"],
    )
    return FeatureFlagOut.model_validate(result)


@router.delete("/{flag_id}", status_code=204)
async def delete_feature_flag(
    flag_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    # Soft-disable rather than delete to preserve audit trail
    from sqlalchemy import update
    from app.models.audit import FeatureFlag
    from app.utils.audit import audit

    await db.execute(
        update(FeatureFlag)
        .where(FeatureFlag.id == flag_id)
        .values(is_enabled=False)
    )
    await audit(
        db,
        action_type="FEATURE_FLAG_UPDATED",
        entity_type="feature_flag",
        entity_id=str(flag_id),
        outcome="success",
        actor_id=uuid.UUID(current_user["user_id"]),
        actor_role=current_user["role"],
        metadata={"action": "disabled"},
    )
