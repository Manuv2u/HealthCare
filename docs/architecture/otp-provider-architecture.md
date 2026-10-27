# OTP Provider Architecture

## Goals

- OTP security behaviour (generation, hashing, expiry, attempt caps, rate
  limits) is identical no matter which SMS company delivers the code.
- Adding/switching providers requires no change to the authentication flow.
- Works correctly under multiple workers (the previous in-process dict store
  silently broke with `uvicorn --workers 2`).

## Folder structure

```
backend/app/services/otp/
 ├── __init__.py      # public exports
 ├── base.py          # OTPProviderProtocol + OTPSendResult
 ├── factory.py       # provider registry + runtime resolution
 ├── twofactor.py     # 2Factor implementation
 ├── msg91.py         # MSG91 implementation
 └── mock.py          # dev/test provider (logs the code)
backend/app/services/otp_service.py   # OTPService — the core logic
backend/app/repositories/otp_repository.py
backend/app/models/otp.py             # otp_codes, otp_send_events
backend/app/api/v1/admin_otp.py       # Admin → OTP Management API
```

## Layering

```
auth_service.login_otp / prescription flow
        │  send_otp(phone, purpose)
        ▼
OTPService  ──────────────  otp_codes (DB, hashed, TTL, attempts)
  • rate limits (cooldown + window cap)      otp_send_events (audit/stats)
  • generates code, stores SHA-256 hash
  • delegates DELIVERY only
        │  provider.send_otp(phone, code, ttl)
        ▼
factory.get_otp_provider(db)
  1. provider_configs row (scope='otp')   ← Admin → OTP Management switch
  2. OTP_PROVIDER env default
  3. local/test without creds → mock
        │
        ▼
TwoFactorProvider | MSG91Provider | MockOTPProvider
```

## Interfaces & patterns

- **Protocol** (`OTPProviderProtocol`): structural typing — providers don't
  inherit anything, they just implement the methods (same pattern as
  `notification_providers.py` and `gateway_client.py`).
- **Factory** (`factory.py`): single registry dict `_PROVIDERS`; runtime
  resolution order is admin DB override → env default → mock fallback.
- **Capability flags**: `capabilities: frozenset` lets the admin UI render
  "Not Supported" instead of erroring for balance/delivery-report features a
  provider lacks.
- **Result object, not exceptions**: `send_otp` returns
  `OTPSendResult(ok, message_id, error)` so a provider outage can never crash
  the login endpoint; failures are recorded in `otp_send_events`.

## OTP lifecycle

```
send_otp(phone)
  ├─ cooldown check      (429 OTP_COOLDOWN if too soon)
  ├─ window cap check    (429 OTP_RATE_LIMITED if too many)
  ├─ create otp_codes row: SHA-256(code), expires_at = now + TTL,
  │    replaces any previous active code (one pending OTP per phone+purpose)
  ├─ provider.send_otp(...)          # SMS goes out
  └─ record otp_send_events row      # sent | failed (+ provider error)

verify_otp(phone, code)
  ├─ no active row            → False
  ├─ expired                  → delete row, False
  ├─ attempts ≥ cap           → delete row, False   (code destroyed)
  ├─ hash mismatch            → attempts += 1, False
  └─ match                    → mark verified (single-use), True
```

Security properties: plaintext codes are never stored (only SHA-256), codes are
single-use, expire in `OTP_TTL_MINUTES`, allow `OTP_MAX_VERIFY_ATTEMPTS` wrong
guesses, and sends are throttled per phone. All of this is provider-independent.

## Admin dashboard data

`GET /api/v1/admin/otp/overview` composes, in one call: active provider, live
health check, live balance (when supported), usage stats from
`otp_send_events` (today / 7 days / 30 days with success/failure rates), last
OTP sent time, provider deep links, and the provider list for switching.
`PUT /api/v1/admin/otp/provider` persists a switch to `provider_configs`.

## Adding a provider

See `docs/otp/adding-new-provider.md`.
