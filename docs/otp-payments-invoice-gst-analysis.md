# Sri Health Plus — OTP, Payment Gateway, Invoice & GST Module Enhancement
## Phase 1: Codebase Analysis & Validation Report

Date: 2026-07-16 · Branch: `payment-gateway` (clean, no commits ahead of `main`)

Stack: FastAPI (async SQLAlchemy 2 + Alembic + PostgreSQL) backend in `backend/`,
standalone-component Angular app in `frontend/`. Layering is consistent:
`api/v1 router → service → repository → model`, Pydantic schemas, pydantic-settings
config, audit util, APScheduler background jobs.

---

## 1. Existing implementation

### 1.1 Authentication & OTP
- Full auth stack in `backend/app/services/auth_service.py` + `api/v1/auth.py`:
  password register/login (bcrypt, lockout after 5 failures), **passwordless OTP
  login** (`POST /auth/login-otp` → `POST /auth/verify-otp`), refresh-token
  sessions, session revocation, password reset, login-event tracking, audit log.
- `backend/app/services/otp_service.py` (41 lines): 6-digit OTP, 10-min TTL,
  single-use — stored in a **class-level in-process dict**. The OTP is only
  **logged to console**; it is never sent by SMS.
- SMS infrastructure exists separately in `notification_providers.py`:
  `SMSClientProtocol` + `MSG91SMSClient` + `MockSMSClient` factory (env-driven).
  Used by prescription flows — **not** by the OTP flow.
- Frontend already has OTP login UI: `features/auth/login` calls `loginOtp()`,
  navigates to `features/auth/otp-verify`.

### 1.2 Payments
- Models/tables (`payments`, `refunds`; migrations 0009/0010/0012):
  `Payment` (booking_id unique — one payment per booking, method, status,
  gateway_order_id, gateway_payment_id, amount, gst_amount, invoice_number,
  paid_at, notes) and `Refund` (amount, reason, gateway_refund_id, status,
  initiated_by/at, completed_at, remarks, transaction_reference).
- `PaymentService` (431 lines): initiate (GST calc, cash short-circuit,
  home-collection must pay online), HMAC-verified idempotent webhook that marks
  paid + syncs booking payment_status + generates invoice, admin manual refund,
  admin mark-cash-received, refund status state machine
  (initiated → approved → completed / failed).
- `gateway_client.py`: `GatewayClientProtocol` + `RazorpayGatewayClient` +
  `MockGatewayClient`, selected by `env_profile`. **The Razorpay client is a
  stub**: `create_order` fabricates an order id and returns a bogus
  `payment_url` pointing at `checkout.razorpay.com/v1/checkout.js` (a JS
  library, not a payment page); `initiate_refund` fabricates a refund id. Only
  webhook HMAC verification is real. No Razorpay SDK, no key_id/key_secret in
  config (only `payment_webhook_secret`).
- Frontend: checkout payment step (`payment-step-new.component.ts`) with
  Pay Online / Pay at Lab cards (home forces online), creates booking then
  `POST /payments/initiate` and does `window.location.href = payment_url` —
  a **dead end** in every environment (no `/mock-payment` page exists; the
  Razorpay URL is not a checkout page). Admin bookings drawer shows payment
  info, mark-paid form, and a refund-status progression form.
- Feature flags: `online_payment` is seeded but read nowhere. Checkout always
  charges the full amount.

### 1.3 Booking cancellation & refunds
- `CancellationSetting` (percentage | fixed) + admin UI
  (`admin/cancellation-config`) + `PUT/DELETE /admin/settings/cancellation`.
- `BookingService._cancellation_quote()` is the single source of truth: used by
  both `GET /bookings/{id}/cancellation-quote` (read-only preview) and the
  actual cancel, so quote and charge can never disagree. Charge applies only
  when a **paid** payment exists (in practice: home-collection paid online;
  lab visits pay at the counter so quote is zero). Fixed fee is capped at the
  amount paid.
- `BookingRepository.cancel_booking`: status guard
  ({booked, technician_assigned, accepted}), 2-hour cancellation window
  (admin bypass), slot count decrement, status history, and **auto-creates a
  Refund row (status="initiated")** for paid bookings — but never calls the
  gateway; an admin manually walks the refund forward.
- Frontend booking-detail already has the cancellation confirm dialog showing
  amount paid, cancellation charge, refund amount, and a "refunded to your
  original payment method" note. Missing vs. spec: payment method + estimated
  refund timeline (5–7 working days).

### 1.4 Invoices
- `InvoiceService` renders a PDF **on the fly** with reportlab (graceful
  fallback if missing); `GET /payments/{id}/invoice` (admin or owner).
- Invoice number `INV-<UTC timestamp>-<hex>` generated at payment-confirm time,
  unique column on `payments`.
- **Not persisted** — regenerated per request with "Invoice Date = today", so
  it is not a permanent record. No invoice settings, no company/GSTIN block,
  no adjustments/discounts, no admin invoice search, and **no download/print
  button anywhere in the frontend** (endpoint is unused by both patient and
  admin UIs).

### 1.5 GST
- `settings.gst_rate = 0.18` (env), used in payment initiate + PDF.
- Frontend checkout **hardcodes** `Math.round(subtotal * 0.18)`.
- No enable/disable, no GSTIN, no company billing details, no admin UI.

### 1.6 Admin settings & platform utilities
- Established settings pattern to copy: model (`models/settings.py`) →
  `SettingsRepository` → `api/v1/admin_settings.py` → standalone Angular
  component + `admin.routes.ts` entry (cancellation-config, contact-settings
  are complete examples).
- Reusable platform pieces: `storage_service` (local + S3, signed URLs),
  `analytics_service` (revenue today/month, revenue-by-method, daily revenue —
  most of the payment-dashboard math already exists), audit util, rate-limit
  middleware, APScheduler job wiring in `main.py`, confirm-dialog service and
  shared UI kit (button/input/alert/spinner/badge), `_enrich_detail` payment +
  refund enrichment on booking detail.
- Config/secrets: pydantic-settings reading `.env.local` / process env;
  docker-compose (dev) and `deploy/docker-compose.prod.yml` (env_file `.env`).
  No secrets manager — env vars are the existing convention.
- Tests: `backend/tests/test_integration.py` covers OTP register/verify,
  webhook-marks-paid + invoice, webhook idempotency, plus property tests.

---

## 2. Missing functionality

| Area | Gap |
|---|---|
| OTP | No real SMS delivery for OTPs (2Factor absent; MSG91 client exists but unused for OTP). No provider abstraction for OTP. No persistence of OTP or send/delivery stats. No admin OTP page. No OTP-specific rate limit. |
| OTP (bug) | In-memory OTP store breaks under `--workers 2` (prod compose): OTP generated in one worker fails verification in the other. Must move to DB-backed storage. |
| Payments | Real Razorpay Orders/Refunds/Fetch APIs; key config; frontend Razorpay Checkout integration; payment verification (return-flow signature check); real Razorpay webhook event format; webhook event log (last success/failure); settlement info; admin payment dashboard. |
| Refunds | Cancellation creates a DB refund but never calls the gateway — no automatic online refund. Quote lacks payment method + refund ETA. No `gateway_response` stored. |
| Invoices | Permanent storage (PDF + immutable record), invoice settings (enable/disable, prefix/numbering, company info, footer, logo toggle), admin invoice search module, patient/admin view + download + print UI, responsive viewer, manual adjustments (discounts/charges) end-to-end. |
| GST | Admin GST settings (enable/disable, %, GSTIN, company billing details), server-driven totals in checkout (currently hardcoded 18% client-side), hide GST everywhere when disabled. |
| Docs | `docs/otp/`, `docs/payments/`, `docs/architecture/` — none exist. |
| Help panels | Admin ⓘ help panels for OTP/payment pages — none exist. |

## 3. Reuse map

| Requirement | Reuse |
|---|---|
| OTP provider abstraction | Clone the `notification_providers.py` Protocol+factory pattern; keep `OTPService.generate/verify` API so `auth_service` barely changes; reuse `MSG91SMSClient`. |
| Payment gateway abstraction | Extend `GatewayClientProtocol` / `get_gateway_client()` — do not replace. |
| Invoice persistence | `storage_service` (local/S3) + existing `file_storage/` conventions. |
| Payment dashboard | `analytics_service` revenue queries + admin dashboard/analytics component patterns. |
| GST / invoice settings | `models/settings.py` + `SettingsRepository` + `admin_settings` router pattern. |
| Cancellation refunds | `_cancellation_quote`, cancel flow, refund state machine, admin refund UI, user confirm dialog — all extend in place. |
| Scheduled provider sync | APScheduler wiring in `main.py` (notification retry job as template). |
| Secrets | Env vars via pydantic-settings (existing convention). |

## 4. Components requiring modification

- `otp_service.py` — provider-backed send + DB-backed store (same public API).
- `auth_service.login_otp` — send via provider instead of logging.
- `gateway_client.py` — real Razorpay implementation (httpx, Basic auth
  key_id:key_secret), config-driven active gateway.
- `payment_service.py` — GST from DB settings; adjustments in totals; persist
  invoice on success; real webhook event parsing + event log; refund via
  gateway on cancellation.
- `booking_service.py` — quote gains payment method + refund ETA; cancel
  triggers gateway refund for online-paid bookings (refund creation moves up
  from repository to service so the gateway call sits outside row updates).
- `invoice_service.py` — settings-driven template (company, GSTIN, footer,
  adjustments, GST toggle), persistence.
- `config.py` — `razorpay_key_id/secret`, `twofactor_api_key`, provider
  selection defaults.
- Frontend: payment step (server-computed totals + Razorpay Checkout),
  booking-detail dialog (ETA + method), admin nav + new pages, invoice
  download buttons.

## 5. Database impact (new migrations, additive only)

1. `otp_codes` (phone, code_hash, purpose, expires_at, attempts, verified_at, provider) — fixes multi-worker bug.
2. `otp_send_events` (provider, phone, status, provider_message_id, error, created_at) — usage/delivery stats.
3. `provider_configs` (scope: 'otp' | 'payment'; active provider, non-secret config JSON, updated_by) — admin-selectable active provider; secrets stay in env.
4. `webhook_events` (gateway, event_type, gateway_event_id, status, error, payload jsonb, processed_at) — idempotency + last success/failure.
5. `invoices` (invoice_number, payment_id, booking_id, pdf_storage_key, amounts snapshot: subtotal/discounts/charges/gst_rate/gst_amount/total, company snapshot, issued_at) — permanent record.
6. `invoice_settings` / `billing_settings` (invoice enable, prefix + sequence, GST enable, gst percentage, gstin, company name/address/contact, footer, logo toggle).
7. `booking_adjustments` (booking_id, kind: discount|charge, label, amount, created_by) — manual adjustments.
8. `refunds` + `gateway_response` (jsonb) column.
9. `payments` + `gateway` (provider name) column.

No existing columns are altered or dropped.

## 6. Potential breaking changes & mitigations

| Risk | Mitigation |
|---|---|
| OTP store change | Same service API; DB-backed store is strictly more correct (fixes the prod 2-worker bug). |
| GST env → DB | Migration seeds `billing_settings` from current `gst_rate` env value; env stays as fallback. Zero behavioral change at cutover. |
| Frontend hardcoded 18% | Replace with a server-computed checkout quote (single source of truth with `initiate_payment`) so displayed and charged totals can't drift. |
| Webhook payload format | Real Razorpay events (`event`, `payload.payment.entity`) differ from the current simplified payload; keep the simplified path for mock/test mode, add the real parser — existing integration tests keep passing. |
| Invoice numbering | Existing `INV-…` numbers untouched; new configurable prefix/sequence applies to new invoices only. |
| Cash / pay-at-lab / mark-paid flows | Untouched; auto-refund applies only to gateway-paid payments — manual refund state machine remains for everything else. |

## 7. Recommended implementation plan

**Phase A — Foundations**: migrations above; `billing_settings` service + admin
API + public read endpoint; server-computed checkout totals endpoint.

**Phase B — OTP provider layer**: `app/services/otp/` package —
`OTPProviderProtocol` (send, capabilities: balance/delivery-report/dashboard
links), `TwoFactorProvider` (real, httpx), `MSG91Provider` (reuse client),
`MockProvider`; DB-backed OTP store; send/delivery event logging; OTP rate
limiting; admin OTP Management API + Angular page ("Not Supported" per missing
capability) + ⓘ help panel; wire `auth_service.login_otp`.

**Phase C — Real Razorpay**: real client (Orders, Refunds, payment fetch;
Basic-auth httpx), payment-verification endpoint for the Checkout return flow,
real webhook parsing + `webhook_events`; frontend Razorpay Checkout modal
(with local mock-payment page for dev); admin Payment Management dashboard
(analytics reuse + webhook status + refund stats) + ⓘ help panel.

**Phase D — Refund automation**: cancellation of an online-paid booking
auto-initiates the gateway refund (partial-refund aware, stores gateway
response); quote/dialog gains payment method + estimated refund timeline;
manual state machine kept as fallback/override.

**Phase E — Invoicing & GST**: persist invoices (record + PDF via
storage_service) on payment success; settings-driven branded PDF template;
patient + admin view/download/print UI + responsive viewer; admin invoice
search (booking/patient/invoice number/payment id/date); invoice settings UI;
manual adjustments end-to-end (checkout → payment → invoice); GST settings UI;
GST hidden app-wide when disabled.

**Phase F — Docs, tests, validation**: `docs/otp/2factor.md`,
`docs/otp/adding-new-provider.md`, `docs/payments/razorpay.md`,
`docs/payments/adding-new-payment-gateway.md`,
`docs/architecture/otp-provider-architecture.md`,
`docs/architecture/payment-provider-architecture.md`; unit + integration
tests; full regression pass; final validation report.

## 8. Open questions before implementation

1. **2Factor credentials** — none exist yet; module will run on the mock
   provider until an API key is supplied (env var).
2. **Refund ETA** — static configurable text ("5–7 working days") vs. deriving
   from Razorpay; recommend static config field in billing settings.
3. **Secrets** — recommend keeping env-var convention (API keys in env, only
   non-secret provider config + active-provider choice in DB).
