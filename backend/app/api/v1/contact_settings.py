"""Public contact settings router — powers the call/WhatsApp/callback action cards."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.repositories.settings_repository import SettingsRepository
from app.schemas.contact_settings import ContactSettingsOut

router = APIRouter(tags=["contact-settings"])

# In-code fallback so the action cards never break even if the seeded row is missing
# (e.g. a fresh environment where the migration hasn't run yet).
_FALLBACK = ContactSettingsOut(
    phone_number="+91 77951 49207",
    whatsapp_number="917795149207",
    callback_enabled=True,
    working_hours="Mon–Sat, 7:00 AM – 9:00 PM",
    call_enabled=True,
    whatsapp_enabled=True,
)


@router.get("/contact-settings", response_model=ContactSettingsOut)
async def get_contact_settings(
    db: AsyncSession = Depends(get_db_session),
) -> ContactSettingsOut:
    """Public — no auth. Used by both the home page and every test detail page."""
    repo = SettingsRepository(db)
    setting = await repo.get_active_contact_setting()
    if setting is None:
        return _FALLBACK
    return ContactSettingsOut.model_validate(setting)
