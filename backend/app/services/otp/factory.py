"""OTP provider factory — admin DB override first, then env default.

local/test profiles fall back to the mock provider when the selected provider
has no credentials, so development never needs an SMS account.
"""
from __future__ import annotations

from app.config import settings
from app.services.otp.base import OTPProviderProtocol
from app.services.otp.mock import MockOTPProvider
from app.services.otp.msg91 import MSG91Provider
from app.services.otp.twofactor import TwoFactorProvider

_PROVIDERS: dict[str, type] = {
    "twofactor": TwoFactorProvider,
    "msg91": MSG91Provider,
    "mock": MockOTPProvider,
}


def available_providers() -> list[str]:
    return sorted(_PROVIDERS)


def build_otp_provider(name: str) -> OTPProviderProtocol:
    cls = _PROVIDERS.get(name)
    if cls is None:
        raise ValueError(f"Unknown OTP provider '{name}'. Available: {available_providers()}")
    return cls()  # type: ignore[return-value]


def _has_credentials(name: str) -> bool:
    if name == "twofactor":
        return bool(settings.twofactor_api_key)
    if name == "msg91":
        return bool(settings.sms_api_key)
    return True


async def get_otp_provider(db=None) -> OTPProviderProtocol:  # type: ignore[no-untyped-def]
    name: str | None = None
    if db is not None:
        from app.repositories.settings_repository import SettingsRepository

        row = await SettingsRepository(db).get_provider_config("otp")
        if row is not None:
            name = row.active_provider
    if name is None:
        name = settings.otp_provider
    if settings.env_profile in ("local", "test") and not _has_credentials(name):
        name = "mock"
    return build_otp_provider(name)
