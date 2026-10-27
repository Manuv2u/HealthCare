"""Admin OTP Management — provider status, credits, usage stats, provider switch."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.repositories.otp_repository import OtpRepository
from app.repositories.settings_repository import SettingsRepository
from app.services.otp import available_providers, get_otp_provider
from app.services.otp.factory import build_otp_provider

router = APIRouter(prefix="/admin/otp", tags=["admin-otp"])


class OtpProviderUpdate(BaseModel):
    provider: str


class OtpOverviewOut(BaseModel):
    active_provider: str
    provider_status: str  # ok | error | unconfigured
    provider_health_detail: str
    capabilities: list[str]
    # None + supported=False renders as "Not Supported" in the UI.
    sms_balance: Optional[float] = None
    balance_supported: bool
    delivery_reports_supported: bool
    usage: dict
    last_otp_sent_at: Optional[datetime] = None
    last_synced_at: datetime
    links: dict
    available_providers: list[str]


@router.get("/overview", response_model=OtpOverviewOut)
async def otp_overview(
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> OtpOverviewOut:
    """Everything the Admin → OTP Management dashboard shows, in one call.
    Provider APIs are queried live (health + balance) — this call is the
    'synchronisation' whose time is reported as last_synced_at."""
    provider = await get_otp_provider(db)
    health = await provider.health_check()

    balance_supported = "balance" in provider.capabilities
    balance = await provider.get_balance() if balance_supported else None

    repo = OtpRepository(db)
    usage = await repo.usage_stats()
    last_sent = await repo.last_send_at()

    return OtpOverviewOut(
        active_provider=provider.name,
        provider_status=health["status"],
        provider_health_detail=health["detail"],
        capabilities=sorted(provider.capabilities),
        sms_balance=balance,
        balance_supported=balance_supported,
        delivery_reports_supported="delivery_reports" in provider.capabilities,
        usage=usage,
        last_otp_sent_at=last_sent,
        last_synced_at=datetime.now(timezone.utc),
        links=provider.links(),
        available_providers=available_providers(),
    )


@router.put("/provider", response_model=OtpOverviewOut)
async def set_otp_provider(
    body: OtpProviderUpdate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> OtpOverviewOut:
    """Switch the active OTP provider. Credentials come from environment
    variables — switching to a provider whose keys are missing leaves it in
    'unconfigured' status (and local/test falls back to mock)."""
    if body.provider not in available_providers():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "UNKNOWN_PROVIDER",
                "message": f"Unknown provider '{body.provider}'. Available: {available_providers()}",
            },
        )
    # Validate instantiation before persisting the switch.
    build_otp_provider(body.provider)
    repo = SettingsRepository(db)
    await repo.upsert_provider_config(
        scope="otp",
        active_provider=body.provider,
        updated_by=uuid.UUID(current_user["user_id"]),
    )
    await db.commit()
    return await otp_overview(current_user=current_user, db=db)  # type: ignore[call-arg]
