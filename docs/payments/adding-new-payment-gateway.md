# Adding a New Payment Gateway

The payment module is gateway-agnostic. Booking, billing, invoicing and refund
business logic never talk to a gateway directly — they go through
`GatewayClientProtocol` (`backend/app/services/gateway_client.py`). Adding a
gateway (Cashfree, PhonePe, PayU, Stripe, …) means implementing that protocol
and registering it; no business logic changes.

## The contract

```python
class MyGatewayClient:
    name = "mygateway"                        # unique slug, lowercase
    capabilities = frozenset({"fetch_payment", "dashboard"})  # subset of:
    # "settlements", "fetch_payment", "dashboard"

    async def create_order(self, amount_paise, receipt, notes=None) -> dict:
        # -> {"order_id", "amount_paise", "currency", "payment_url" | None, "raw"}
        # payment_url is for redirect-style gateways; modal-style gateways
        # (like Razorpay) return None and rely on checkout_config().

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool: ...
    def verify_checkout_signature(self, order_id, payment_id, signature) -> bool: ...

    async def initiate_refund(self, gateway_payment_id, amount_paise, notes=None) -> dict:
        # -> {"refund_id", "status", "raw"}; raise GatewayError on failure

    async def fetch_payment(self, gateway_payment_id) -> dict | None: ...
    async def fetch_settlements(self, count=10) -> list[dict] | None: ...
    async def health_check(self) -> dict:      # {"status": ok|error|unconfigured, "detail"}
    def checkout_config(self) -> dict:         # public config for the frontend
    def dashboard_links(self) -> dict:         # admin deep links, or {}
```

Rules that keep behaviour consistent:

- **Raise `GatewayError`** with a human-readable message for API failures on
  `create_order`/`initiate_refund`; the payment service translates it to a 502
  (initiate) or an admin-retryable refund state.
- **Never raise** from `health_check` — report status instead.
- Declare only capabilities you actually implement; the admin dashboard shows
  **Not Supported** for the rest.
- Amounts are integer paise everywhere at the gateway boundary.

## Steps

1. **Implement** the client in `gateway_client.py` (or a new module imported
   there), reading credentials from `app.config.settings` — add new fields to
   `config.py`; they map 1:1 to environment variables. Secrets never go in the DB.
2. **Register** it in `_PROVIDERS` in `gateway_client.py`.
3. **Webhook parsing** — if the gateway's webhook envelope differs from
   Razorpay's, extend `PaymentService._handle_gateway_event`
   (`payment_service.py`) with a per-gateway parser that maps events to the
   neutral actions: *payment captured*, *payment failed*, *refund processed*,
   *refund failed*. Pass the gateway's own event id into `handle_webhook` for
   idempotency (add a header alias on the `/payments/webhook` route if needed).
4. **Frontend checkout** — `checkout_config()` tells the frontend how to open
   the payment UI. For redirect gateways nothing is needed (`payment_url` is
   followed). For modal/SDK gateways add a small launcher service like
   `razorpay-checkout.service.ts` and branch on `checkout.gateway` in
   `payment-step-new.component.ts`.
5. **Label** — add a friendly name in `gatewayLabel()` in
   `admin-payment-management.component.ts`.
6. **Document** — add `docs/payments/mygateway.md` following the Razorpay doc.
7. **Test** — sandbox payment end-to-end: initiate → pay → verify/webhook →
   invoice issued → cancel → automatic refund → webhook completes refund.

## Switching at runtime

Admins pick the active gateway on **Admin → Payment Management** (persisted in
`provider_configs`, scope `payment`). `PAYMENT_GATEWAY` env is the default when
no admin choice exists. In-flight payments on the previous gateway still
complete: webhook and verify handlers resolve payments by their stored
`gateway_order_id`, and refunds use the payment's own stored gateway.
