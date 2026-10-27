# Adding a New OTP Provider

The OTP module is provider-agnostic. Generation, hashing, storage, expiry,
attempt limits and rate limiting all live in `OTPService`
(`backend/app/services/otp_service.py`) — a provider **only delivers a code to
a phone**. Adding a provider never touches the auth flow.

## The contract

Implement `OTPProviderProtocol` (`backend/app/services/otp/base.py`):

```python
class MyProvider:
    name = "myprovider"                       # unique slug, lowercase
    capabilities = frozenset({"balance", "dashboard"})  # what you support

    async def send_otp(self, phone: str, code: str, ttl_minutes: int) -> OTPSendResult:
        """Deliver the code. MUST NOT raise — return OTPSendResult(ok=False, error=...)"""

    async def get_balance(self) -> float | None:
        """Remaining credits, or None if unsupported/unavailable."""

    async def health_check(self) -> dict:
        """{'status': 'ok'|'error'|'unconfigured', 'detail': str}"""

    def links(self) -> dict:
        """{'dashboard': url, 'recharge': url, 'billing': url} — any subset."""
```

Capability flags drive the admin dashboard: anything you don't declare renders
as **Not Supported** — never an error. Known flags: `balance`,
`delivery_reports`, `dashboard`, `billing`.

## Steps

1. **Create the provider** — `backend/app/services/otp/myprovider.py`, using
   `twofactor.py` as the template. Read credentials from `app.config.settings`
   (add new fields to `config.py`; they map to environment variables).
2. **Register it** — add to `_PROVIDERS` in
   `backend/app/services/otp/factory.py`, and teach `_has_credentials()` how to
   detect that its keys are set (so local/test can fall back to mock).
3. **Frontend label (optional)** — add a friendly name in `providerLabel()` in
   `admin-otp-management.component.ts`.
4. **Document it** — add `docs/otp/myprovider.md` (copy the 2Factor doc's
   structure: account, keys, env vars, testing, troubleshooting).
5. **Test** — with the provider selected and keys set, send a login OTP; check
   `otp_send_events` records `provider="myprovider", status="sent"`, and the
   admin dashboard shows health/balance.

## Switching at runtime

Admins select the active provider on **Admin → OTP Management** (persisted in
the `provider_configs` table, scope `otp`). The env var `OTP_PROVIDER` is only
the default when no admin choice exists. Secrets always stay in environment
variables — the database never stores API keys.

## Planned providers

The abstraction is designed to accommodate (per product roadmap): 2Factor
(done), MSG91 (done), Twilio, AWS SNS. For Twilio/SNS the `send_otp`
implementation is a single API call; capabilities: Twilio supports
`delivery_reports` via status callbacks (would need a webhook route), SNS
supports neither balance nor delivery reports — declare only `dashboard`.
