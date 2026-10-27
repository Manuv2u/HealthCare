"""2Factor.in OTP provider.

API shape (see docs/otp/2factor.md):
  * Send own code:  GET {base}/API/V1/{api_key}/SMS/{phone}/{otp}[/{template}]
  * Balance:        GET {base}/API/V1/{api_key}/BAL/SMS
Responses: {"Status": "Success" | "Error", "Details": "..."}
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.services.otp.base import OTPSendResult

logger = logging.getLogger("sri.otp")

TWOFACTOR_BASE = "https://2factor.in"


class TwoFactorProvider:
    name = "twofactor"
    capabilities = frozenset({"balance", "dashboard", "billing"})

    def __init__(self) -> None:
        self._api_key = settings.twofactor_api_key
        self._template = settings.twofactor_template

    def _configured(self) -> bool:
        return bool(self._api_key)

    async def send_otp(self, phone: str, code: str, ttl_minutes: int) -> OTPSendResult:
        if not self._configured():
            return OTPSendResult(
                ok=False, provider=self.name,
                error="2Factor API key not configured (TWOFACTOR_API_KEY)",
            )
        path = f"/API/V1/{self._api_key}/SMS/{phone}/{code}"
        if self._template:
            path += f"/{self._template}"
        try:
            async with httpx.AsyncClient(base_url=TWOFACTOR_BASE, timeout=10) as client:
                resp = await client.get(path)
            data = resp.json()
            if resp.status_code == 200 and data.get("Status") == "Success":
                return OTPSendResult(
                    ok=True, provider=self.name, message_id=data.get("Details")
                )
            return OTPSendResult(
                ok=False, provider=self.name,
                error=f"2Factor error ({resp.status_code}): {data.get('Details', resp.text[:120])}",
            )
        except Exception as exc:  # network / JSON errors must not crash auth
            logger.error("twofactor_send_failed: phone=%s error=%s", phone, exc)
            return OTPSendResult(ok=False, provider=self.name, error=str(exc))

    async def get_balance(self) -> float | None:
        if not self._configured():
            return None
        try:
            async with httpx.AsyncClient(base_url=TWOFACTOR_BASE, timeout=10) as client:
                resp = await client.get(f"/API/V1/{self._api_key}/BAL/SMS")
            data = resp.json()
            if data.get("Status") == "Success":
                return float(data.get("Details", 0))
        except Exception as exc:
            logger.warning("twofactor_balance_failed: %s", exc)
        return None

    async def health_check(self) -> dict:
        if not self._configured():
            return {"status": "unconfigured", "detail": "2Factor API key is not set"}
        balance = await self.get_balance()
        if balance is None:
            return {"status": "error", "detail": "2Factor API not reachable or key invalid"}
        return {"status": "ok", "detail": f"2Factor reachable; {balance:.0f} SMS credits"}

    def links(self) -> dict:
        return {
            "dashboard": "https://2factor.in/v3/",
            "recharge": "https://2factor.in/v3/billing",
            "billing": "https://2factor.in/v3/billing",
        }
