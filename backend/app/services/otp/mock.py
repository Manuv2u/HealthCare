"""Mock OTP provider for local/test — logs the code instead of sending SMS."""
from __future__ import annotations

import logging

from app.services.otp.base import OTPSendResult

logger = logging.getLogger("sri.otp")


class MockOTPProvider:
    name = "mock"
    capabilities = frozenset()

    async def send_otp(self, phone: str, code: str, ttl_minutes: int) -> OTPSendResult:
        # ── DEV: print OTP to logs so local testing doesn't need SMS ──
        logger.warning("🔑 OTP for %s → %s (expires in %d min)", phone, code, ttl_minutes)
        return OTPSendResult(ok=True, provider=self.name, message_id="mock")

    async def get_balance(self) -> float | None:
        return None

    async def health_check(self) -> dict:
        return {"status": "ok", "detail": "Mock provider (OTPs are written to server logs)"}

    def links(self) -> dict:
        return {}
