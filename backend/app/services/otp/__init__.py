"""OTP provider abstraction package.

Adding a provider = implement OTPProviderProtocol (see base.py), register the
class in factory._PROVIDERS, document its env vars. Nothing in the auth flow
changes. See docs/otp/adding-new-provider.md.
"""
from app.services.otp.base import OTPProviderProtocol, OTPSendResult
from app.services.otp.factory import available_providers, get_otp_provider

__all__ = [
    "OTPProviderProtocol",
    "OTPSendResult",
    "available_providers",
    "get_otp_provider",
]
