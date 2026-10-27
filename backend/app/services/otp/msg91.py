"""MSG91 OTP provider — reuses the account already used for notification SMS."""
from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.services.otp.base import OTPSendResult

logger = logging.getLogger("sri.otp")


class MSG91Provider:
    name = "msg91"
    capabilities = frozenset({"dashboard", "billing"})

    def __init__(self) -> None:
        self._auth_key = settings.sms_api_key

    def _configured(self) -> bool:
        return bool(self._auth_key)

    async def send_otp(self, phone: str, code: str, ttl_minutes: int) -> OTPSendResult:
        if not self._configured():
            return OTPSendResult(
                ok=False, provider=self.name, error="MSG91 auth key not configured (SMS_API_KEY)"
            )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://control.msg91.com/api/v5/otp",
                    params={
                        "mobile": f"91{phone}" if len(phone) == 10 else phone,
                        "otp": code,
                        "otp_expiry": ttl_minutes,
                    },
                    headers={"authkey": self._auth_key},
                )
            data = resp.json()
            if resp.status_code == 200 and data.get("type") == "success":
                return OTPSendResult(
                    ok=True, provider=self.name, message_id=data.get("request_id")
                )
            return OTPSendResult(
                ok=False, provider=self.name,
                error=f"MSG91 error ({resp.status_code}): {data.get('message', resp.text[:120])}",
            )
        except Exception as exc:
            logger.error("msg91_send_failed: phone=%s error=%s", phone, exc)
            return OTPSendResult(ok=False, provider=self.name, error=str(exc))

    async def get_balance(self) -> float | None:
        return None  # MSG91 balance needs a per-route query; surfaced as Not Supported

    async def health_check(self) -> dict:
        if not self._configured():
            return {"status": "unconfigured", "detail": "MSG91 auth key is not set"}
        return {"status": "ok", "detail": "MSG91 configured (health probe not supported)"}

    def links(self) -> dict:
        return {
            "dashboard": "https://control.msg91.com/",
            "recharge": "https://control.msg91.com/user/index.php#billing",
            "billing": "https://control.msg91.com/user/index.php#billing",
        }
