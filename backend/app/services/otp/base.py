"""OTP provider interface.

A provider only delivers codes — generation, storage, expiry, attempt limits
and rate limiting all live in OTPService, so every provider gets them for free
and switching providers never changes security behaviour.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class OTPSendResult:
    ok: bool
    provider: str
    message_id: str | None = None
    error: str | None = None


class OTPProviderProtocol(Protocol):
    name: str
    # Capability flags drive the admin dashboard: anything a provider lacks is
    # rendered as "Not Supported" instead of erroring.
    # Known: "balance", "delivery_reports", "dashboard", "billing"
    capabilities: frozenset[str]

    async def send_otp(self, phone: str, code: str, ttl_minutes: int) -> OTPSendResult:
        """Deliver the code to the phone. Must never raise — report failures
        in the result so the caller can log/audit them."""
        ...

    async def get_balance(self) -> float | None:
        """Remaining SMS credits, or None when unsupported/unavailable."""
        ...

    async def health_check(self) -> dict:
        """{status: 'ok'|'error'|'unconfigured', detail: str}"""
        ...

    def links(self) -> dict:
        """Deep links for admins: {dashboard, recharge, billing} (subset ok)."""
        ...
