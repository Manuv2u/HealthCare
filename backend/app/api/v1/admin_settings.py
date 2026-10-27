"""Admin settings router — cancellation charges and other configurable policies."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.repositories.billing_repository import BillingSettingsRepository
from app.repositories.settings_repository import SettingsRepository
from app.schemas.billing import BillingSettingsIn, BillingSettingsOut
from app.schemas.contact_settings import ContactSettingsIn, ContactSettingsOut

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


class CancellationSettingOut(BaseModel):
    id: uuid.UUID
    charge_type: str
    charge_value: float
    is_active: bool

    model_config = {"from_attributes": True}


class CancellationSettingIn(BaseModel):
    charge_type: Literal["percentage", "fixed"]
    charge_value: float

    @field_validator("charge_value")
    @classmethod
    def validate_charge_value(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Charge value cannot be negative")
        return v


@router.get("/cancellation", response_model=Optional[CancellationSettingOut])
async def get_cancellation_setting(
    current_user: dict = Depends(require_roles("admin", "user", "technician")),
    db: AsyncSession = Depends(get_db_session),
) -> Optional[CancellationSettingOut]:
    """Get the currently active cancellation charge setting."""
    repo = SettingsRepository(db)
    setting = await repo.get_active_cancellation_setting()
    if setting is None:
        return None
    return CancellationSettingOut.model_validate(setting)


@router.put("/cancellation", response_model=CancellationSettingOut)
async def update_cancellation_setting(
    body: CancellationSettingIn,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> CancellationSettingOut:
    """
    Set the cancellation charge. Replaces the previous setting.
    charge_type: 'percentage' (e.g. 10 = 10%) or 'fixed' (e.g. 100 = ₹100)
    """
    repo = SettingsRepository(db)
    setting = await repo.upsert_cancellation_setting(
        charge_type=body.charge_type,
        charge_value=body.charge_value,
        updated_by=uuid.UUID(current_user["user_id"]),
    )
    await db.commit()
    return CancellationSettingOut.model_validate(setting)


@router.delete("/cancellation", status_code=204)
async def disable_cancellation_charges(
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Disable all cancellation charges (full refund on cancel)."""
    repo = SettingsRepository(db)
    await repo.disable_cancellation_charges()
    await db.commit()


@router.get("/billing", response_model=BillingSettingsOut)
async def get_billing_settings(
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> BillingSettingsOut:
    """Current billing / invoice / GST configuration."""
    from app.services.billing_service import BillingService

    svc = BillingService(db)
    return BillingSettingsOut.model_validate(await svc.get_settings())


@router.put("/billing", response_model=BillingSettingsOut)
async def update_billing_settings(
    body: BillingSettingsIn,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> BillingSettingsOut:
    """Update billing settings. Partial updates are fine — omitted fields keep
    their current values. Changes apply to future quotes and invoices only;
    issued invoices are immutable."""
    from app.services.billing_service import BillingService

    repo = BillingSettingsRepository(db)
    fields = body.model_dump(exclude_unset=True)
    await repo.upsert(updated_by=uuid.UUID(current_user["user_id"]), **fields)
    await db.commit()
    svc = BillingService(db)
    return BillingSettingsOut.model_validate(await svc.get_settings())


@router.put("/contact", response_model=ContactSettingsOut)
async def update_contact_settings(
    body: ContactSettingsIn,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> ContactSettingsOut:
    """
    Set the site-wide phone/WhatsApp numbers, working hours and channel toggles.
    Powers the Book via Call / Get a Callback / WhatsApp action cards on the home
    page and every test detail page, plus the "Book via Call" fallback the booking
    flow offers when home collection is unavailable — future tests automatically
    inherit this setting.
    """
    repo = SettingsRepository(db)
    setting = await repo.upsert_contact_setting(
        phone_number=body.phone_number,
        whatsapp_number=body.whatsapp_number,
        callback_enabled=body.callback_enabled,
        working_hours=body.working_hours,
        call_enabled=body.call_enabled,
        whatsapp_enabled=body.whatsapp_enabled,
        updated_by=uuid.UUID(current_user["user_id"]),
    )
    await db.commit()
    return ContactSettingsOut.model_validate(setting)
