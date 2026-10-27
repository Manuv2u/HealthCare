# Payment Provider Architecture

## Goals

- Booking/refund/invoice business logic is provider-independent — Razorpay is
  one implementation behind an interface, not a dependency of the domain.
- Every rupee figure is computed server-side by one engine (see
  `billing-engine-and-invoices.md`); gateways only move the money.
- Payments confirm reliably via two independent, idempotent paths (browser
  verify + webhook).

## Folder structure

```
backend/app/services/gateway_client.py   # protocol + Razorpay + Cashfree + factory
backend/app/services/payment_service.py  # provider-independent orchestration
backend/app/services/billing_service.py  # money math (single source of truth)
backend/app/services/invoice_service.py  # immutable invoices + PDF
backend/app/repositories/payment_repository.py  # payments, refunds, webhook_events
backend/app/api/v1/payments.py           # initiate / verify / webhook / refunds
backend/app/api/v1/admin_payments.py     # Admin → Payment Management API
backend/app/models/payment.py            # Payment, Refund, WebhookEvent
```

## Layering

```
booking flow / admin actions
        ▼
PaymentService                    BillingService (totals, GST, adjustments)
  initiate · verify · webhook ◄───┘
  refunds · mark-paid
        │ GatewayClientProtocol
        ▼
get_gateway_client(db)
  1. provider_configs row (scope='payment')  ← Admin switch
  2. PAYMENT_GATEWAY env default
  (an override naming an unregistered provider falls back to 2)
        │
        ▼
RazorpayGatewayClient | CashfreeGatewayClient   (PhonePe/PayU/Stripe later)
  mode() → "test" (rzp_test_*/TEST... keys) | "live" | "unknown"
```

## Payment sequence (Razorpay)

```
Patient          Frontend                Backend                    Razorpay
  │ confirm booking │                       │                          │
  │────────────────►│ POST /bookings        │                          │
  │                 │ POST /payments/initiate                          │
  │                 │──────────────────────►│ BillingService totals    │
  │                 │                       │ POST /v1/orders ────────►│
  │                 │◄── checkout{key_id,   │◄── order_id ─────────────│
  │                 │     order_id, paise}  │                          │
  │  Checkout modal │                       │                          │
  │◄───────────────►│◄────────────────────────────────────────────────►│  pays
  │                 │ POST /payments/verify (order, payment, signature)│
  │                 │──────────────────────►│ HMAC check → mark paid   │
  │                 │                       │ → issue invoice          │
  │                 │                       │◄── payment.captured ─────│ (webhook,
  │                 │                       │    idempotent no-op      │  backup path)
```

Signature rules:
- Checkout return: `HMAC-SHA256(order_id + "|" + payment_id, key_secret)`.
- Webhook: `HMAC-SHA256(raw_body, webhook_secret)`, plus per-event idempotency
  on `X-Razorpay-Event-Id` recorded in `webhook_events`.

## Refund sequence (cancellation-triggered)

```
cancel booking ──► quote (single source of truth, same math as charge)
              ──► booking cancelled + Refund row (status=initiated)
              ──► gateway-paid?  yes ─► POST /payments/{id}/refund ─► Razorpay
                       │                   ok: status=approved (+gateway_response)
                       │                   fail: stays initiated + remark
                       │                         ─► admin "Retry Gateway Refund"
                       no (cash) ─► manual state machine
refund.processed webhook ──► status=completed (+completed_at)
```

Money-handling invariants:
- `payments.amount` is always the **gross amount collected** (GST inclusive);
  `gst_amount` is its GST component.
- A refund can never exceed `amount` minus already-active refunds.
- The quoted charge and the applied charge come from the same function, so the
  confirm dialog can never disagree with the receipt.

## Webhook event log

Every delivery — processed, failed, ignored, duplicate — is a `webhook_events`
row with payload snapshot and error text. Admin → Payment Management surfaces
last-success/last-failure from it; a partial unique index on
`(gateway, gateway_event_id)` makes gateway retries exact no-ops.

## Runtime gateway switching

`provider_configs` (scope `payment`) stores the admin's choice. Secrets stay in
env vars. In-flight payments are safe across a switch: handlers resolve by the
payment's stored `gateway_order_id`/`gateway`, not the currently-active client.

## Adding a gateway

See `docs/payments/adding-new-payment-gateway.md`.
