# Sri Health Plus — OTP, Payment Gateway, Invoice & GST Module Enhancement
## Final Implementation & Validation Report

Date: 2026-07-16 · Branch: `payment-gateway`
Companion documents: `docs/otp-payments-invoice-gst-analysis.md` (Phase 1 analysis),
`docs/otp/`, `docs/payments/`, `docs/architecture/`.

---

## 1. What was delivered

| Deliverable | Status |
|---|---|
| Codebase analysis & validation report | ✅ `docs/otp-payments-invoice-gst-analysis.md` |
| OTP provider abstraction + 2Factor | ✅ `app/services/otp/` (2Factor, MSG91, mock), DB-backed store |
| Payment gateway abstraction + real Razorpay | ✅ Orders/Checkout/verify/webhooks/refunds/settlements via REST |
| Admin OTP Management | ✅ `/admin/otp-management` — provider, health, credits, usage, links, switch, ⓘ help |
| Admin Payment Management | ✅ `/admin/payment-management` — gateway, analytics, refunds, settlements, webhooks, switch, ⓘ help |
| Automatic refunds on cancellation | ✅ gateway refund fired on cancel; webhook auto-completes; admin retry |
| Cancellation confirmation popup | ✅ amount paid, charge, refund, payment method, configurable ETA |
| Automatic invoice generation (permanent, PDF, print/download) | ✅ immutable `invoices` records + stored PDFs; patient & admin UI |
| Admin Invoice module + settings | ✅ `/admin/invoices` search + `/admin/billing-settings` |
| GST Management | ✅ enable/disable, %, GSTIN, company block; hidden app-wide when off |
| Manual adjustments (discounts/charges) | ✅ per-booking, admin drawer, flow into checkout/payment/invoice |
| Server-side billing engine | ✅ `BillingService` — frontend no longer computes any money figure |
| Database migrations | ✅ `0028` (applied cleanly to the dev PostgreSQL) |
| Documentation | ✅ 7 markdown docs (setup, extension, architecture) |
| Tests + regression | ✅ 29/29 backend tests pass; Angular build clean; live smoke tests pass |

## 2. Bugs found in the existing code and fixed

1. **GST double-count in refund money** (pre-existing, live): `payment.amount`
   was written inconsistently (subtotal at booking creation, GST-inclusive
   total after initiation) and the cancellation quote / refund cap / cancel
   refund computed `amount + gst_amount` — inflating refunds by the GST amount
   for online-paid bookings. `amount` is now canonically the gross amount
   collected, and all consumers read it directly.
2. **OTP store broken under multiple workers**: OTPs lived in an in-process
   dict while production runs `uvicorn --workers 2` — verification failed
   whenever it hit the other worker. Now DB-backed (hashed, single-use, TTL,
   attempt caps, rate limits).
3. **Dead admin config**: the Advance Payment page wrote feature flags nothing
   read, and displayed "enabled" by default while nothing was ever charged.
   The page, its flags and the whole advance-payment concept were removed
   entirely — checkout always charges the full total.
4. **Online payment dead-end**: "Pay Online" redirected to a JS library URL
   (not a checkout). Replaced with the real Razorpay Checkout modal +
   signature-verified confirmation, and an in-app `/mock-payment` simulator for
   local development.
5. **Invoices were not records**: PDFs were regenerated per download with
   "today" as the invoice date. Invoices are now immutable snapshots with
   permanently stored PDFs.

## 3. Files changed

### Backend — new (16)
- `alembic/versions/0028_billing_otp_gateway_tables.py`
- `app/models/billing.py`, `app/models/otp.py`
- `app/repositories/billing_repository.py`, `app/repositories/otp_repository.py`
- `app/services/billing_service.py`
- `app/services/otp/{__init__,base,factory,twofactor,msg91,mock}.py`
- `app/api/v1/{billing,invoices,admin_otp,admin_payments}.py`
- `app/schemas/{billing,invoices}.py`

### Backend — modified (22)
- `app/config.py` — Razorpay/2Factor/OTP-policy settings
- `app/models/{__init__,base,payment,settings}.py` — new models/columns, JSONBCompat
- `app/services/gateway_client.py` — real Razorpay client, capabilities, factory w/ DB override
- `app/services/payment_service.py` — billing-engine totals, verify flow, real webhook parsing + event log, auto/retryable refunds, balance settlement
- `app/services/invoice_service.py` — immutable issue/store/render pipeline (+legacy fallback)
- `app/services/otp_service.py` — DB-backed OTP with rate limiting
- `app/services/{auth_service,prescription_request_service}.py` — new OTP API
- `app/services/booking_service.py` — engine totals on create, quote +method/+ETA, auto-refund hook, refund gateway id in detail
- `app/services/storage_service.py` — `download()` on both backends
- `app/repositories/{booking,payment,settings,feature_flag}_repository.py`
- `app/api/v1/{payments,admin_settings}.py`, `app/schemas/{payments,bookings}.py`, `app/main.py`
- `tests/test_integration.py`, `tests/properties/{conftest,test_property_1_otp_creates_account}.py`

### Frontend — new (9)
- `core/api/services/billing-api.service.ts`, `core/api/services/provider-admin-api.service.ts`
- `core/utils/razorpay-checkout.service.ts`
- `shared/components/help-panel/help-panel.component.ts`
- `features/payments/mock-payment/mock-payment.component.ts`
- `features/admin/otp-management/`, `features/admin/payment-management/`,
  `features/admin/invoices/`, `features/admin/billing-settings/`

### Frontend — modified (9)
- `core/api/api.types.ts`, `core/api/services/payment-api.service.ts`
- `features/booking/steps-new/payment-step-new.component.ts` — server totals + Razorpay modal
- `features/bookings/booking-detail/booking-detail.component.ts` — ETA/method in dialog, invoice view/download
- `features/admin/bookings/admin-bookings.component.ts` — adjustments editor, refund retry, invoice actions
- `features/admin/{admin.routes,admin-shell.component}.ts`, `app.routes.ts`

## 4. Database migration (0028 — applied ✅)

New tables: `billing_settings` (seeded with historical defaults), `invoices`,
`booking_adjustments`, `otp_codes`, `otp_send_events`, `provider_configs`,
`webhook_events`; sequence `invoice_number_seq`; new columns
`payments.gateway`, `refunds.gateway_response`.
Everything is additive; full `downgrade()` provided.

## 5. APIs added / updated

**New:** `GET /billing/config` · `POST /billing/quote` ·
`GET /bookings/{id}/billing-summary` · `GET/POST/DELETE /bookings/{id}/adjustments` ·
`GET/PUT /admin/settings/billing` · `GET /payments/checkout-config` ·
`POST /payments/verify` · `POST /payments/refunds/{id}/retry` ·
`GET /invoices` · `GET /invoices/mine` · `GET /invoices/{id}` · `GET /invoices/{id}/pdf` ·
`GET /admin/otp/overview` · `PUT /admin/otp/provider` ·
`GET /admin/payments/overview` · `PUT /admin/payments/gateway`

**Updated:** `POST /payments/initiate` (now returns `totals` + `checkout`) ·
`POST /payments/webhook` (real Razorpay envelope + event-id idempotency; legacy
payload still accepted) · `GET /bookings/{id}/cancellation-quote`
(+`payment_method`, +`refund_eta_text`) · `POST /payments/{id}/mark-paid`.

## 6. Environment variables required

```bash
# Payments (Razorpay)
RAZORPAY_KEY_ID=rzp_live_xxx          # required for live payments
RAZORPAY_KEY_SECRET=xxx               # required for live payments
RAZORPAY_WEBHOOK_SECRET=xxx           # recommended (falls back to PAYMENT_WEBHOOK_SECRET)
PAYMENT_GATEWAY=razorpay              # optional default (admin can override)

# OTP (2Factor)
TWOFACTOR_API_KEY=xxx                 # required for real SMS
TWOFACTOR_TEMPLATE=                   # optional template name
OTP_PROVIDER=twofactor                # optional default (admin can override)
# Optional policy overrides: OTP_TTL_MINUTES, OTP_MAX_VERIFY_ATTEMPTS,
# OTP_RESEND_COOLDOWN_SECONDS, OTP_MAX_SENDS_PER_WINDOW, OTP_SEND_WINDOW_MINUTES
```

Without keys, `local`/`test` profiles fall back to mock providers automatically.

## 7. Manual setup steps

1. Add the env vars above to the deployment `.env`; restart backend
   (`alembic upgrade head` runs automatically on boot — 0028 applies then).
2. Razorpay dashboard: create the webhook →
   `https://<domain>/api/v1/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`,
   events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`.
3. 2Factor: buy transactional OTP credits; complete DLT if using a branded
   sender ID (see `docs/otp/2factor.md`).
4. Admin → Billing & GST Settings: fill company name/address/GSTIN/footer.
5. Verify on Admin → OTP Management and Admin → Payment Management that both
   show **Active** (not Unconfigured).

## 8. Test & validation results

- **Backend:** `pytest tests/` → **29 passed** (existing suites updated for the
  DB-backed OTP store; new coverage: billing engine math, GST toggle,
  adjustments, refund-quote GST fix, OTP attempt cap, OTP
  single-use/replay properties).
- **Frontend:** `ng build` → success (pre-existing CSS warnings only).
- **Migration:** `alembic upgrade head` applied cleanly to the running dev
  PostgreSQL.
- **Live smoke (dev stack):** `/api/v1/health` healthy ·
  `/billing/config` returns seeded settings · admin OTP + payment overviews
  render (mock providers active, no keys in dev) · OTP login end-to-end:
  send → structured 429 on immediate resend → verify returns JWT → replay
  rejected with `INVALID_OTP`.
- **Regression coverage by flow:** login (password + OTP), booking create
  (lab + home), checkout totals (server-driven), online payment (mock path
  live-tested; Razorpay path unit/signature-tested — needs test keys for an
  end-to-end run), offline/at-lab payment + admin mark-paid, cancellation with
  charge quote, full & partial refunds (auto + manual + retry), invoice
  issue/download, GST on/off, admin dashboards, responsive layouts (existing
  patterns + media queries on all new pages).

## 9. Known limitations

1. **Razorpay end-to-end with real keys** hasn't been exercised in this
   environment (no credentials). The client follows the documented REST/signature
   contracts; run one test-mode payment after setting `rzp_test_` keys.
2. **Invoice logo** renders as branded text (`show_logo` toggles the styled
   header); embedding an image asset in the PDF is a straightforward follow-up.
3. **OTP delivery reports** are surfaced as "Not Supported" for current
   providers; success rate reflects provider hand-off, not handset delivery.
4. **Rate-limit enumeration nuance**: a phone that never receives OTPs also
   never gets a 429; acceptable trade-off, documented here.
5. `qa/smoke_test.py` (existing) was not extended; live smoke was performed
   manually against the dev stack as recorded above.

## 10. Future extension points

- **New OTP provider** (Twilio, AWS SNS): implement
  `OTPProviderProtocol`, register in `app/services/otp/factory.py` —
  see `docs/otp/adding-new-provider.md`.
- **New payment gateway** (Cashfree, PhonePe, PayU, Stripe): implement
  `GatewayClientProtocol`, register in `gateway_client._PROVIDERS`, add a
  webhook parser branch if the envelope differs —
  see `docs/payments/adding-new-payment-gateway.md`.
- Both are switchable at runtime from the admin dashboards; secrets remain
  env-only by design.
