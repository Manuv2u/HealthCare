# Razorpay Payment Gateway — Setup Guide

Razorpay is the default online payment gateway for Sri Health Plus. This guide covers
account setup through production go-live, webhooks, refunds and settlements.

## 1. Account setup

1. Sign up at https://dashboard.razorpay.com/signup.
2. Complete KYC (business PAN, bank account, address proof). Until KYC is
   approved you can only use **Test Mode**.
3. Activate the payment methods you want (cards, UPI, net-banking) under
   **Settings → Payment Methods**.

## 2. API key generation

Razorpay has two independent key pairs:

- **Test Mode** keys (`rzp_test_…`): no real money, use for staging/dev.
- **Live Mode** keys (`rzp_live_…`): real money, available after KYC approval.

Generate under **Settings → API Keys → Generate Key**. You get:

- `Key Id` — public, safe to expose to the browser (opens the Checkout modal).
- `Key Secret` — private, server-only. Shown once; store it immediately.

## 3. Environment variables

| Variable | Required | Example | Notes |
|---|---|---|---|
| `PAYMENT_GATEWAY` | no (default `razorpay`) | `razorpay` | Env default; Admin → Payment Management can override at runtime. |
| `RAZORPAY_KEY_ID` | yes | `rzp_test_AbC123…` | Public key id. |
| `RAZORPAY_KEY_SECRET` | yes | `xxxxxxxxxxxx` | Server-only secret. |
| `RAZORPAY_WEBHOOK_SECRET` | recommended | random string | Falls back to `PAYMENT_WEBHOOK_SECRET` when unset. |

There is no mock/simulated gateway — every profile talks to the real Razorpay
API. Non-production environments use `rzp_test_*` keys, which reach Razorpay's
sandbox only: no bank rail, no settlement, no real money. With no keys set at
all the gateway reports **Unconfigured** and online payments fail.

Whenever the configured key id starts with `rzp_test_`, the app says so in the
UI — a "Test mode — no real money will be charged" banner on the booking
checkout step, and a **TEST MODE** badge on Admin → Payment Management. The mode
is derived from the key id itself, so it can never drift from the keys in use.

## 4. Test Mode

1. Set the `rzp_test_` keys in `backend/.env.local`.
2. Book and choose **Pay Online** — the real Razorpay Checkout modal opens.
3. Pay with test instruments: card `4111 1111 1111 1111` (any CVV/future date),
   or `success@razorpay` UPI ID.
4. Verify: booking flips to *paid*, an invoice is issued, and Admin → Payment
   Management shows the transaction.

## 5. Live Mode

1. Swap to `rzp_live_` keys in the production `.env`; restart the backend.
2. Reconfigure the webhook (below) — webhooks are per-mode.
3. Make one real low-value payment end-to-end, then refund it from Admin.

## 6. Webhook configuration

Webhooks are the server-to-server backup that confirms payments even when the
patient closes the browser right after paying, and they complete refunds.

1. Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**.
2. URL: `https://<your-domain>/api/v1/payments/webhook`
3. **Secret**: generate a strong random string; set the same value as
   `RAZORPAY_WEBHOOK_SECRET` in the backend env.
4. Subscribe to events:
   - `payment.captured` (required — confirms payments)
   - `payment.failed` (recommended)
   - `refund.processed` (required — auto-completes refunds)
   - `refund.failed` (recommended)
   - `order.paid` (optional; handled same as captured)
5. Save, then check **Admin → Payment Management → Webhook Status** after the
   next payment: *Last Successful Webhook* should update.

Every delivery is recorded in the `webhook_events` table (payload, outcome,
error) with idempotency on Razorpay's `X-Razorpay-Event-Id` header — retried
deliveries are exact no-ops.

## 7. How a payment flows (verification steps)

1. `POST /api/v1/payments/initiate` creates a Razorpay **Order** for the exact
   server-computed amount (see the billing engine doc) and returns
   `checkout: {key_id, order_id, amount_paise}`.
2. The frontend opens the Checkout modal with that order.
3. On success the browser calls `POST /api/v1/payments/verify` with
   `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`; the server
   recomputes `HMAC-SHA256(order_id|payment_id, key_secret)` and only a match
   confirms the payment.
4. Independently, the `payment.captured` webhook (HMAC-verified with the
   webhook secret) confirms the payment. Verify-vs-webhook is idempotent —
   first one wins, the other is a no-op.
5. Confirmation marks the payment paid, syncs the booking, and issues the
   immutable invoice.

## 8. Refund configuration & flow

No dashboard configuration is needed — refunds are API-driven:

- Cancelling a paid booking automatically calls
  `POST /v1/payments/{payment_id}/refund` for the refundable amount (after the
  cancellation charge), `speed: normal`. Partial refunds are supported.
- The raw gateway response is stored on the refund row (`gateway_response`).
- `refund.processed` webhook moves the refund to **completed** automatically.
- If the gateway call fails, the refund stays **initiated** with the error in
  its remarks and a **Retry Gateway Refund** button appears on the booking in
  Admin → Bookings.
- Cash/at-lab payments keep the manual refund state machine
  (initiated → approved → completed / failed).

Money typically reaches the customer in 5–7 working days (bank dependent) —
that text is configurable in Admin → Billing & GST Settings.

## 9. Settlements explained

Razorpay collects customer money into your merchant balance and transfers
("settles") it to the clinic bank account on a cycle — standard **T+2 working
days** (T+1 available on request from Razorpay support). Fees + GST on fees are
deducted from settlements. Recent settlements appear on Admin → Payment
Management when the API is reachable; full reports are on the Razorpay
dashboard (linked from that page).

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Gateway status "Unconfigured" | Keys missing | Set `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`. |
| Checkout modal doesn't open | Browser blocked checkout.js, or wrong key id | Check console; verify key id matches mode (test/live). |
| Payment succeeds but booking stays pending | Webhook secret mismatch AND verify call failed | Check Webhook Status card for signature errors; fix `RAZORPAY_WEBHOOK_SECRET`. |
| `INVALID_SIGNATURE` on verify | key_secret mismatch (test vs live) | Keys and orders must be from the same mode. |
| Refund stuck "initiated" with gateway error | Razorpay outage / insufficient balance | Use Retry Gateway Refund; check merchant balance. |
| Refund stuck "approved" | Normal — gateway is processing | The `refund.processed` webhook completes it; verify webhooks are configured. |
| `BAD_REQUEST_ERROR: amount exceeds` on refund | Refunding more than captured | The app caps refunds at the amount collected; check for prior partial refunds. |
