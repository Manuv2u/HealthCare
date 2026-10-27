"""Banners router: public carousel listing + admin banner management."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.schemas.banners import (
    BannerAdminOut,
    BannerCreate,
    BannerOut,
    BannerReorderRequest,
    BannerUpdate,
)
from app.services.banner_service import BannerService

router = APIRouter(prefix="/banners", tags=["banners"])


# ── Public ────────────────────────────────────────────────────────────────────
@router.get("", response_model=list[BannerOut])
async def list_banners(
    db: AsyncSession = Depends(get_db_session),
) -> list[BannerOut]:
    """Active + published banners inside their scheduling window, ordered."""
    svc = BannerService(db)
    return [BannerOut(**b) for b in await svc.list_live()]


# ── Admin ─────────────────────────────────────────────────────────────────────
@router.get("/admin", response_model=list[BannerAdminOut])
async def list_all_banners(
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> list[BannerAdminOut]:
    svc = BannerService(db)
    return [BannerAdminOut(**b) for b in await svc.list_all()]


@router.post("", response_model=BannerAdminOut, status_code=201)
async def create_banner(
    body: BannerCreate,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> BannerAdminOut:
    svc = BannerService(db)
    return BannerAdminOut(**await svc.create(body))


@router.put("/reorder", status_code=204)
async def reorder_banners(
    body: BannerReorderRequest,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = BannerService(db)
    await svc.reorder(body.items)


@router.put("/{banner_id}", response_model=BannerAdminOut)
async def update_banner(
    banner_id: uuid.UUID,
    body: BannerUpdate,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> BannerAdminOut:
    svc = BannerService(db)
    return BannerAdminOut(**await svc.update(banner_id, body))


@router.delete("/{banner_id}", status_code=204)
async def delete_banner(
    banner_id: uuid.UUID,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = BannerService(db)
    await svc.delete(banner_id)


@router.post("/{banner_id}/image", response_model=BannerAdminOut)
async def upload_banner_image(
    banner_id: uuid.UUID,
    variant: str,
    file: UploadFile = File(...),
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> BannerAdminOut:
    """Upload a desktop or mobile image (variant query param) for a banner."""
    svc = BannerService(db)
    return BannerAdminOut(**await svc.upload_image(banner_id, variant, file))
