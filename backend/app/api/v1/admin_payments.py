"""Admin Payment Management — gateway status, payment analytics, refunds,
settlements, webhook health, gateway switch."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.models.payment import Payment, Refund
from app.repositories.payment_repository import WebhookEventRepository
from app.repositories.settings_repository import SettingsRepository
from app.services.gateway_client import available_gateways, build_gateway_client, get_gateway_client

router = APIRouter(prefix="/admin/payments", tags=["admin-payments"])


class GatewayUpdate(BaseModel):
    gateway: str


class PaymentOverviewOut(BaseModel):
    active_gateway: str
    # "test" | "live" | "unknown" — surfaced as a badge so an admin can
    # never mistake a sandbox setup for one that moves real money.
    gateway_mode: str
    gateway_status: str
    gateway_health_detail: str
    capabilities: list[str]
    analytics: dict
    refunds: dict
    settlements: Optional[list[dict]] = None
    settlements_supported: bool
    webhooks: dict
    links: dict
    available_gateways: list[str]
    last_synced_at: datetime


async def _period_counts(db: AsyncSession, since: datetime | None) -> dict:
    stmt = select(Payment.status, func.count(), func.coalesce(func.sum(Payment.amount), 0))
    if since is not None:
        stmt = stmt.where(Payment.created_at >= since)
    rows = (await db.execute(stmt.group_by(Payment.status))).all()
    by_status = {r[0]: {"count": int(r[1]), "amount": float(r[2])} for r in rows}
    paid = by_status.get("paid", {"count": 0, "amount": 0.0})
    return {
        "transactions": sum(v["count"] for v in by_status.values()),
        "successful": paid["count"],
        "revenue": paid["amount"],
        "failed": by_status.get("failed", {"count": 0})["count"],
        "pending": by_status.get("pending", {"count": 0})["count"],
    }


@router.get("/overview", response_model=PaymentOverviewOut)
async def payment_overview(
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PaymentOverviewOut:
    gateway = await get_gateway_client(db)
    health = await gateway.health_check()

    now = datetime.now(timezone.utc)
    today_start = datetime.combine(date.today(), datetime.min.time(), tzinfo=timezone.utc)
    analytics = {
        "today": await _period_counts(db, today_start),
        "week": await _period_counts(db, now - timedelta(days=7)),
        "month": await _period_counts(db, now - timedelta(days=30)),
        "all_time": await _period_counts(db, None),
    }

    refund_rows = (
        await db.execute(
            select(Refund.status, func.count(), func.coalesce(func.sum(Refund.amount), 0))
            .group_by(Refund.status)
        )
    ).all()
    refunds = {
        r[0]: {"count": int(r[1]), "amount": float(r[2])} for r in refund_rows
    }
    refunds["total_refunded"] = refunds.get("completed", {"amount": 0.0})["amount"]

    settlements_supported = "settlements" in gateway.capabilities
    settlements: list[dict] | None = None
    if settlements_supported and health["status"] == "ok":
        try:
            raw = await gateway.fetch_settlements(count=5)
            settlements = [
                {
                    "id": s.get("id"),
                    "amount": (s.get("amount") or 0) / 100,
                    "status": s.get("status"),
                    "created_at": s.get("created_at"),
                }
                for s in (raw or [])
            ]
        except Exception:
            settlements = None

    webhook_repo = WebhookEventRepository(db)
    last_ok = await webhook_repo.last_by_status("processed")
    last_failed = await webhook_repo.last_by_status("failed")
    webhooks = {
        "last_successful_at": last_ok.created_at.isoformat() if last_ok else None,
        "last_successful_event": last_ok.event_type if last_ok else None,
        "last_failed_at": last_failed.created_at.isoformat() if last_failed else None,
        "last_failed_error": last_failed.error if last_failed else None,
    }

    return PaymentOverviewOut(
        active_gateway=gateway.name,
        gateway_mode=gateway.mode(),
        gateway_status=health["status"],
        gateway_health_detail=health["detail"],
        capabilities=sorted(gateway.capabilities),
        analytics=analytics,
        refunds=refunds,
        settlements=settlements,
        settlements_supported=settlements_supported,
        webhooks=webhooks,
        links=gateway.dashboard_links(),
        available_gateways=available_gateways(),
        last_synced_at=now,
    )


@router.put("/gateway", response_model=PaymentOverviewOut)
async def set_payment_gateway(
    body: GatewayUpdate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PaymentOverviewOut:
    """Switch the active payment gateway. Keys come from environment variables;
    a gateway without keys shows as 'unconfigured' and cannot take payments."""
    if body.gateway not in available_gateways():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "UNKNOWN_GATEWAY",
                "message": f"Unknown gateway '{body.gateway}'. Available: {available_gateways()}",
            },
        )
    build_gateway_client(body.gateway)
    repo = SettingsRepository(db)
    await repo.upsert_provider_config(
        scope="payment",
        active_provider=body.gateway,
        updated_by=uuid.UUID(current_user["user_id"]),
    )
    await db.commit()
    return await payment_overview(current_user=current_user, db=db)  # type: ignore[call-arg]
