"""FAQ router: public listing of the general FAQ + admin CRUD management."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.schemas.faqs import (
    FaqAdminOut,
    FaqCreate,
    FaqOut,
    FaqReorderRequest,
    FaqUpdate,
)
from app.services.faq_service import FaqService

router = APIRouter(prefix="/faqs", tags=["faqs"])


# ── Public ────────────────────────────────────────────────────────────────────
@router.get("", response_model=list[FaqOut])
async def list_faqs(
    db: AsyncSession = Depends(get_db_session),
) -> list[FaqOut]:
    """Active FAQs, ordered, for the public /faq page and Contact section."""
    svc = FaqService(db)
    return [FaqOut.model_validate(f) for f in await svc.list_active()]


# ── Admin ─────────────────────────────────────────────────────────────────────
@router.get("/admin", response_model=list[FaqAdminOut])
async def list_all_faqs(
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> list[FaqAdminOut]:
    svc = FaqService(db)
    return [FaqAdminOut.model_validate(f) for f in await svc.list_all()]


@router.post("", response_model=FaqAdminOut, status_code=201)
async def create_faq(
    body: FaqCreate,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> FaqAdminOut:
    svc = FaqService(db)
    return FaqAdminOut.model_validate(await svc.create(body))


@router.put("/reorder", status_code=204)
async def reorder_faqs(
    body: FaqReorderRequest,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = FaqService(db)
    await svc.reorder(body.items)


@router.put("/{faq_id}", response_model=FaqAdminOut)
async def update_faq(
    faq_id: uuid.UUID,
    body: FaqUpdate,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> FaqAdminOut:
    svc = FaqService(db)
    return FaqAdminOut.model_validate(await svc.update(faq_id, body))


@router.delete("/{faq_id}", status_code=204)
async def delete_faq(
    faq_id: uuid.UUID,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = FaqService(db)
    await svc.delete(faq_id)
