# Forgot Password / Reset Password

Production email-based password reset for Sri Health Plus, delivered over
SMTP (Mailtrap in local/staging). This replaces the earlier stub, which only
logged the raw reset token to the console.

## Folder structure

```
backend/
  app/
    api/v1/auth.py                 # POST /forgot-password, /reset-password routes
    schemas/auth.py                 # ForgotPasswordRequest, ResetPasswordRequest
    services/
      password_reset_service.py     # Business logic: token issue/validate, session revoke
      email_service.py              # Reusable SMTP EmailService + HTML template
    repositories/user_repository.py # PasswordResetTokenRepository, SessionRepository
    models/user.py                  # PasswordResetToken ORM model
    middleware/rate_limit.py        # Per-IP sliding-window limiter (incl. forgot-password-specific)
    config.py                       # MAIL_*, FRONTEND_URL, RESET_TOKEN_EXPIRY_MINUTES settings
  alembic/versions/0008_password_reset_tokens.py  # password_reset_tokens table
  tests/properties/test_password_reset_flow.py    # Unit tests for the whole flow
  .env.example                      # All environment variables, documented

frontend/src/app/
  core/api/services/auth-api.service.ts        # forgotPassword() / resetPassword() HTTP calls
  features/auth/forgot-password/forgot-password.component.ts
  features/auth/reset-password/reset-password.component.ts
  features/auth/auth.routes.ts                 # /auth/forgot-password, /auth/reset-password
```

## API documentation

### `POST /api/v1/auth/forgot-password`

Request:
```json
{ "email": "user@example.com" }
```

Response (always `200`, identical whether or not the account exists):
```json
{ "message": "If an account exists with this email, a password reset link has been sent." }
```

Behavior:
- `email` is validated for format (`422` if malformed).
- If an active account with that email exists: any previous outstanding reset
  token for that user is invalidated, a new token is generated, hashed, and
  stored, and a reset email is sent.
- Rate limited at the IP level (see below); on `429` the response includes a
  `Retry-After` header.

### `POST /api/v1/auth/reset-password`

Request:
```json
{ "token": "<raw token from the emailed link>", "password": "NewStrongP@ss1", "confirm_password": "NewStrongP@ss1" }
```

Response on success (`200`):
```json
{ "message": "Password updated successfully" }
```

Error responses (`400`), one of:
| `error_code` | Meaning |
|---|---|
| `INVALID_RESET_TOKEN` | Token doesn't exist / was never issued |
| `EXPIRED_RESET_TOKEN` | Token existed but is past its expiry |
| `USED_RESET_TOKEN` | Token was already consumed by a prior reset |

`422` is returned by request validation for a weak password or a
`password`/`confirm_password` mismatch (checked both client- and
server-side).

On success the service also:
- Marks the token used (one-time use).
- Sets `password_changed_at` / clears `is_temp_password`.
- Revokes every session and refresh token for the user
  (`sessions.revoked_at`, `users.tokens_invalidated_at`) so a compromised
  credential can't keep a session alive after the owner resets their password.

## Environment variables

See `backend/.env.example` for the full list. The ones this feature owns:

| Variable | Default | Purpose |
|---|---|---|
| `MAIL_HOST` | `localhost` | SMTP host (Mailtrap: `sandbox.smtp.mailtrap.io`) |
| `MAIL_PORT` | `587` | SMTP port (Mailtrap sandbox: `2525`; use `465` with `MAIL_SECURE=true` for implicit TLS) |
| `MAIL_USERNAME` | — | SMTP auth username |
| `MAIL_PASSWORD` | — | SMTP auth password |
| `MAIL_FROM` | `Sri Health Plus <noreply@srihealthplus.com>` | `From:` header |
| `MAIL_SECURE` | `false` | `true` = implicit TLS (`SMTP_SSL`); `false` = STARTTLS |
| `SUPPORT_EMAIL` | `support@srihealthplus.com` | Shown in the email footer |
| `FRONTEND_URL` | `http://localhost:4200` | Base URL used to build the reset link |
| `RESET_TOKEN_EXPIRY_MINUTES` | `30` | Token lifetime |
| `PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS` | `5` | Forgot-password requests allowed per IP per window |
| `PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES` | `15` | Window for the above |

Credentials are never hardcoded — `EmailService` reads everything from
`app.config.settings`, which is a `pydantic-settings` `BaseSettings` sourced
from the environment / `.env.local`.

## SMTP / Mailtrap configuration

`EmailService` (`app/services/email_service.py`) supports two delivery
backends, chosen automatically:

- **Mailtrap Send API** (`mailtrap` SDK) — used whenever `MAILTRAP_API_TOKEN`
  is set. This is the default for local development.
- **Plain SMTP** (`smtplib`) using `MAIL_HOST`/`MAIL_PORT`/`MAIL_USERNAME`/
  `MAIL_PASSWORD` — used only when `MAILTRAP_API_TOKEN` is empty. Works with
  Mailtrap's own SMTP integration or any other provider.

Both paths run over a background thread (`asyncio.to_thread`) so a
slow/unreachable provider never blocks the event loop, and both never raise —
a delivery failure is logged and `forgot_password` still returns its generic
success message (so failures can't be used to probe which emails are
registered).

### Using the Mailtrap Send API (recommended)

1. Install the SDK (already added to `pyproject.toml`): `pip install mailtrap`.
2. In Mailtrap: **Settings → API Tokens** → create/copy a token.
3. Set in `.env.local`:
   ```
   MAILTRAP_API_TOKEN=<your token>
   MAILTRAP_SANDBOX=true          # false once using a verified Sending domain
   MAILTRAP_INBOX_ID=<inbox id>   # only needed when MAILTRAP_SANDBOX=true
   MAIL_FROM="Sri Health Plus <noreply@srihealthplus.com>"
   ```
   The sender address in `MAIL_FROM` must be a domain/address verified in
   Mailtrap (or match your sandbox inbox) — Mailtrap will reject sends from
   an unverified sender.
4. Trigger `/api/v1/auth/forgot-password` for a seeded user and check
   [mailtrap.io/sending/email_logs](https://mailtrap.io/sending/email_logs)
   (or the sandbox inbox) to confirm the email arrived with the reset link
   and HTML template rendering correctly.
5. For production, either keep using Mailtrap's Send API against a verified
   Sending domain, or switch to SMTP with any other provider — no code
   changes needed either way.

### Using plain SMTP instead

Leave `MAILTRAP_API_TOKEN` empty and set the SMTP block (also available from
Mailtrap's inbox under its "SMTP" integration tab):
```
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=<from Mailtrap>
MAIL_PASSWORD=<from Mailtrap>
MAIL_SECURE=false
```

## Database migration

The `password_reset_tokens` table already exists via
`backend/alembic/versions/0008_password_reset_tokens.py`:

```
password_reset_tokens
  id            uuid primary key
  user_id       uuid  -> users.id
  token_hash    varchar(64) unique   -- sha256 hex digest, never the raw token
  expires_at    timestamptz
  used_at       timestamptz null    -- null = unused; set = one-time-use flag + audit timestamp
  created_at    timestamptz
```

No new migration was needed for this feature — `used_at` doubles as both the
"used" flag and the audit timestamp of when it was used, which is what the
service and repository already relied on. Apply migrations as usual:

```bash
cd backend
alembic upgrade head
```

## Deployment steps

1. Set the environment variables above (`MAIL_*`, `FRONTEND_URL`,
   `RESET_TOKEN_EXPIRY_MINUTES`) in the target environment's secrets/config.
2. Run `alembic upgrade head` (table already present if this branch has been
   deployed before; harmless no-op otherwise).
3. Deploy the backend and frontend as usual — no new services or queues are
   required; email is sent synchronously within the request via a background
   thread.
4. Smoke test in the target environment: request a reset for a real test
   account, confirm the email arrives (Mailtrap inbox in staging, real inbox
   in production with live SMTP credentials), follow the link, and confirm
   the new password logs in and old sessions are logged out.

## Testing

`backend/tests/properties/test_password_reset_flow.py` covers:
- Token generation (≥32 bytes of entropy) and SHA-256 hashing at rest.
- Configurable expiry window.
- Email dispatch (mocked `EmailService`), including SMTP-failure resilience.
- Account-enumeration protection (unknown/inactive email ⇒ identical generic
  response, no token, no email).
- Superseding a previous outstanding token on a second request.
- Invalid / expired / already-used token rejection with distinct error codes.
- Successful reset: password updated, token marked used, all sessions and
  refresh tokens revoked.
- Schema-level password policy and confirm-password match validation.
- End-to-end HTTP checks against the FastAPI routes.

Run just this suite:
```bash
cd backend
python -m pytest tests/properties/test_password_reset_flow.py -v
```
