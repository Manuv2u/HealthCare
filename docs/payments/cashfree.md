# Cashfree Payment Gateway — Setup Guide

Cashfree is a second `GatewayClientProtocol` implementation, added while
Razorpay was blocked by a bank-side issue. Admins can switch between the two
at runtime from **Admin → Payment Management** — see
`docs/payments/adding-new-payment-gateway.md` for how the abstraction works.

## 1. Account setup

1. Sign up at https://merchant.cashfree.com/merchants/signup.
2. Test Mode is available immediately, no KYC required. Full KYC (business
   PAN, bank account) is required before Live Mode API keys are issued.
3. **Payment Gateway (Orders API) must be explicitly enabled** on the account
   — API keys can exist without this, in which case `POST /orders` fails with
   a generic `{"code": "request_failed", "type": "api_error"}` even though the
   keys authenticate correctly on other endpoints (see Troubleshooting).

## 2. API key generation

Cashfree has two independent credential pairs, analogous to Razorpay's
`rzp_test_`/`rzp_live_` prefixes:

- **Test Mode** App ID (`TEST...`): sandbox only, no real money.
- **Live Mode** App ID (no `TEST` prefix): real money, requires KYC.

Generate under **Developers → API Keys**. You get:

- `App ID` (Client ID) — sent as the `x-client-id` header.
- `Secret Key` (Client Secret) — sent as `x-client-secret`; also the key used
  to verify webhook signatures (Cashfree has no separate webhook secret).

## 3. Environment variables

| Variable | Required | Example | Notes |
|---|---|---|---|
| `PAYMENT_GATEWAY` | no (default `razorpay`) | `cashfree` | Env default; Admin → Payment Management can override at runtime. |
| `CASHFREE_APP_ID` | yes | `TEST11166502d28c…` | Public client id. |
| `CASHFREE_SECRET_KEY` | yes | `cfsk_ma_test_…` | Server-only secret; also the webhook signing key. |
| `CASHFREE_API_VERSION` | no (default `2023-08-01`) | `2023-08-01` | Sent as `x-api-version` on every request. |

Mode is derived the same way as Razorpay: whenever `CASHFREE_APP_ID` starts
with `TEST`, the app treats it as sandbox — "Test mode" banner on checkout,
**TEST MODE** badge on Admin → Payment Management. Never put a non-`TEST`
(live) App ID in `.env.local`/`.env.staging`.

## 4. Test Mode

1. Set the `TEST...` App ID + Secret Key in the root `.env.local`, and set
   `PAYMENT_GATEWAY=cashfree` (or switch to Cashfree from Admin → Payment
   Management instead of changing the env default).
2. Book and choose **Pay Online** — the Cashfree Drop-in Checkout modal opens.
3. Pay with Cashfree's sandbox test instruments: card `4111 1111 1111 1111`
   (any future expiry, CVV `123`), or UPI ID `testsuccess@gocash`.
4. Verify: booking flips to *paid*, an invoice is issued, and Admin → Payment
   Management shows the transaction.

## 5. How a payment flows (verification steps)

Cashfree's flow differs from Razorpay's in one important way: **it never
hands the browser a signature to verify**. The Drop-in modal only reports
back an `order_id` when it closes.

1. `POST /api/v1/payments/initiate` creates a Cashfree **Order** (with
   `customer_details` — Cashfree requires at least phone at order-creation
   time, unlike Razorpay) and returns `checkout: {payment_session_id, order_id}`.
2. The frontend opens Cashfree's Drop-in modal with that session id.
3. On completion the browser calls `POST /api/v1/payments/verify` with just
   `gateway_order_id` (payment_id/signature are sent blank — Cashfree never
   signs anything client-side). The server's `verify_checkout_signature`
   resolves the *real* outcome by calling Cashfree's
   `GET /orders/{id}/payments` directly — the browser's report is never
   trusted on its own.
4. Independently, the `PAYMENT_SUCCESS_WEBHOOK` (HMAC-verified using the
   secret key over `timestamp + raw body`, base64-encoded) confirms the
   payment. Verify-vs-webhook is idempotent — first one wins.
5. Confirmation marks the payment paid, syncs the booking, and issues the
   immutable invoice — identical to the Razorpay path from here on.

## 6. Webhook configuration

1. Cashfree Dashboard → **Developers → Webhooks → Add Webhook**.
2. URL: `https://<your-domain>/api/v1/payments/webhook`
3. No separate secret to configure — Cashfree signs with the same
   `CASHFREE_SECRET_KEY` already set above.
4. Subscribe to: `PAYMENT_SUCCESS_WEBHOOK` (required), `PAYMENT_FAILED_WEBHOOK`,
   `PAYMENT_USER_DROPPED_WEBHOOK`, `REFUND_STATUS_WEBHOOK` (required — auto-
   completes refunds).

Cashfree doesn't send a dedicated event-id header the way Razorpay does, so
webhook retries aren't deduped in the `webhook_events` log table the same
way — this is cosmetic only: the actual payment/refund state transitions are
already idempotent (a webhook for an already-paid payment or already-completed
refund is a no-op regardless).

## 7. Refund configuration & flow

Cashfree's refund API is **order-scoped**, not payment-scoped (Razorpay's is
the other way round) — the gateway client uses the payment's stored
`gateway_order_id` for this, not `gateway_payment_id`. Otherwise identical to
Razorpay: cancelling a paid booking automatically calls the gateway refund;
failures leave the refund `initiated` with a **Retry Gateway Refund** button
in Admin → Bookings.

## 8. Known gaps vs. Razorpay

- **Settlements** are not wired up (`capabilities` omits `"settlements"`) —
  Admin → Payment Management shows "Not Supported" for Cashfree; check the
  Cashfree merchant dashboard directly for settlement reports.
- **`fetch_payment` by id alone** isn't implemented (Cashfree needs the order
  id too, which the current call sites don't have) — not currently called
  anywhere in the app, so this is a latent gap rather than a live bug.

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Gateway status "Unconfigured" | Keys missing | Set `CASHFREE_APP_ID`/`CASHFREE_SECRET_KEY`. |
| `GET` calls work (e.g. health check passes) but `POST /orders` returns `{"code": "request_failed", "type": "api_error"}` | Payment Gateway product not activated on the account, even though API keys exist | Cashfree Dashboard → activate/enable the Payment Gateway (Orders API) product for the account; this is an account-side setup step, not a code or payload issue. |
| Checkout modal doesn't open | SDK script blocked, or `payment_session_id` missing | Check browser console; confirm `/payments/initiate` actually returned a `payment_session_id`. |
| Payment succeeds but booking stays pending | `verify` call failed AND webhook not configured/signature mismatch | Check Webhook Status card; confirm the webhook secret matches `CASHFREE_SECRET_KEY`. |
| Refund fails immediately | Missing `gateway_order_id` on the payment row (shouldn't happen for payments created after this integration) | Refunds on pre-Cashfree payments were created under a different gateway and refund via that gateway's own client. |
