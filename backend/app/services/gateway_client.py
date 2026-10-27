"""Payment gateway abstraction — provider-independent interface + implementation.

Adding a new gateway = implement GatewayClientProtocol, register it in
_PROVIDERS, and (optionally) select it from Admin → Payment Management.
Secrets stay in environment variables; the DB only records which provider is
active. See docs/payments/adding-new-payment-gateway.md.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import uuid
from typing import Any, Protocol

import httpx

from app.config import settings

logger = logging.getLogger("sri.gateway")

RAZORPAY_API_BASE = "https://api.razorpay.com/v1"
CASHFREE_SANDBOX_API_BASE = "https://sandbox.cashfree.com/pg"
CASHFREE_LIVE_API_BASE = "https://api.cashfree.com/pg"


class GatewayError(Exception):
    """Raised when the gateway rejects or fails a call; message is safe to log."""


class GatewayClientProtocol(Protocol):
    name: str
    # Capability flags let dashboards show "Not Supported" instead of erroring.
    capabilities: frozenset[str]  # of: "settlements", "fetch_payment", "dashboard"

    async def create_order(
        self,
        amount_paise: int,
        receipt: str,
        notes: dict | None = None,
        customer: dict | None = None,
    ) -> dict:
        """Create a payment order; returns at least {order_id, amount_paise, currency}.
        `customer` ({id, name, phone, email}) is required by gateways whose
        order-creation API mandates customer details (e.g. Cashfree); ignored
        by gateways that collect it in the checkout UI instead (e.g. Razorpay).
        """
        ...

    def verify_webhook_signature(
        self, payload: bytes, signature: str, timestamp: str | None = None
    ) -> bool:
        ...

    async def verify_checkout_signature(self, order_id: str, payment_id: str, signature: str) -> str:
        """Confirm the checkout the browser reports as complete. Returns the
        verified gateway payment id (proof the payment is real — never trust
        `payment_id` from the browser directly), or "" if unverified. Gateways
        that don't hand back a client-side signature (e.g. Cashfree) instead
        make an authenticated API call here to resolve the real payment id."""
        ...

    async def initiate_refund(
        self,
        gateway_payment_id: str,
        amount_paise: int,
        notes: dict | None = None,
        gateway_order_id: str | None = None,
    ) -> dict:
        """Initiate refund; returns {refund_id, status, raw}. `gateway_order_id`
        is required by gateways whose refund API is order-scoped rather than
        payment-scoped (e.g. Cashfree)."""
        ...

    async def fetch_payment(self, gateway_payment_id: str) -> dict | None:
        ...

    async def fetch_settlements(self, count: int = 10) -> list[dict] | None:
        ...

    async def health_check(self) -> dict:
        """{status: 'ok'|'error'|'unconfigured', detail: str}"""
        ...

    def checkout_config(self) -> dict:
        """Public config the frontend needs to open this gateway's checkout."""
        ...

    def dashboard_links(self) -> dict:
        """Deep links for admins (dashboard, settlements, reports) or {}."""
        ...

    def mode(self) -> str:
        """Which environment the configured keys point at:
        "test" (sandbox, no real money) | "live" (real money) |
        "unknown" (not configured)."""
        ...


class RazorpayGatewayClient:
    """Real Razorpay integration over its REST API (Basic auth key_id:key_secret)."""

    name = "razorpay"
    capabilities = frozenset({"settlements", "fetch_payment", "dashboard"})

    def __init__(self) -> None:
        self._key_id = settings.razorpay_key_id
        self._key_secret = settings.razorpay_key_secret
        self._webhook_secret = settings.razorpay_webhook_secret or settings.payment_webhook_secret

    @property
    def _auth(self) -> tuple[str, str]:
        return (self._key_id, self._key_secret)

    def _configured(self) -> bool:
        return bool(self._key_id and self._key_secret)

    async def _request(self, method: str, path: str, json: dict | None = None) -> Any:
        if not self._configured():
            raise GatewayError("Razorpay keys are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)")
        async with httpx.AsyncClient(base_url=RAZORPAY_API_BASE, auth=self._auth, timeout=15) as client:
            resp = await client.request(method, path, json=json)
        if resp.status_code >= 400:
            # Razorpay error bodies: {"error": {"code": ..., "description": ...}}
            try:
                desc = resp.json().get("error", {}).get("description", resp.text[:200])
            except Exception:
                desc = resp.text[:200]
            raise GatewayError(f"Razorpay {method} {path} failed ({resp.status_code}): {desc}")
        return resp.json()

    async def create_order(
        self,
        amount_paise: int,
        receipt: str,
        notes: dict | None = None,
        customer: dict | None = None,
    ) -> dict:
        # Razorpay Checkout collects customer details in its own UI, so
        # `customer` (needed by e.g. Cashfree) is unused here.
        data = await self._request(
            "POST",
            "/orders",
            json={
                "amount": amount_paise,
                "currency": "INR",
                # Razorpay caps receipt at 40 chars; a UUID is 36.
                "receipt": receipt[:40],
                "notes": notes or {},
            },
        )
        logger.info("razorpay_order_created: receipt=%s order_id=%s", receipt, data.get("id"))
        return {
            "order_id": data["id"],
            "amount_paise": data["amount"],
            "currency": data.get("currency", "INR"),
            # No redirect URL — Razorpay uses an in-page Checkout modal driven
            # by key_id + order_id (see checkout_config()).
            "payment_url": None,
            "raw": data,
        }

    def verify_webhook_signature(
        self, payload: bytes, signature: str, timestamp: str | None = None
    ) -> bool:
        # Razorpay's webhook HMAC covers only the raw body; timestamp is unused.
        if not signature:
            return False
        expected = hmac.new(self._webhook_secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def verify_checkout_signature(self, order_id: str, payment_id: str, signature: str) -> str:
        """Razorpay Checkout returns HMAC-SHA256(order_id|payment_id, key_secret)."""
        if not (order_id and payment_id and signature and self._key_secret):
            return ""
        msg = f"{order_id}|{payment_id}".encode()
        expected = hmac.new(self._key_secret.encode(), msg, hashlib.sha256).hexdigest()
        return payment_id if hmac.compare_digest(expected, signature) else ""

    async def initiate_refund(
        self,
        gateway_payment_id: str,
        amount_paise: int,
        notes: dict | None = None,
        gateway_order_id: str | None = None,
    ) -> dict:
        # Razorpay refunds are payment-scoped; gateway_order_id is unused here.
        data = await self._request(
            "POST",
            f"/payments/{gateway_payment_id}/refund",
            json={"amount": amount_paise, "speed": "normal", "notes": notes or {}},
        )
        logger.info(
            "razorpay_refund_initiated: payment_id=%s refund_id=%s status=%s",
            gateway_payment_id, data.get("id"), data.get("status"),
        )
        return {"refund_id": data["id"], "status": data.get("status", "pending"), "raw": data}

    async def fetch_payment(self, gateway_payment_id: str) -> dict | None:
        return await self._request("GET", f"/payments/{gateway_payment_id}")

    async def fetch_settlements(self, count: int = 10) -> list[dict] | None:
        data = await self._request("GET", f"/settlements?count={count}")
        return data.get("items", [])

    async def health_check(self) -> dict:
        if not self._configured():
            return {"status": "unconfigured", "detail": "Razorpay API keys are not set"}
        try:
            # Cheapest authenticated call: fetch 1 order.
            await self._request("GET", "/orders?count=1")
            return {"status": "ok", "detail": "Razorpay API reachable and credentials valid"}
        except GatewayError as exc:
            return {"status": "error", "detail": str(exc)}

    def mode(self) -> str:
        # Razorpay encodes the mode in the public key id itself, so this needs
        # no extra config and cannot drift from the keys actually in use.
        if not self._configured():
            return "unknown"
        return "test" if self._key_id.startswith("rzp_test_") else "live"

    def checkout_config(self) -> dict:
        return {
            "gateway": self.name,
            "key_id": self._key_id,
            "currency": "INR",
            "mode": self.mode(),
        }

    def dashboard_links(self) -> dict:
        return {
            "dashboard": "https://dashboard.razorpay.com/",
            "settlements": "https://dashboard.razorpay.com/app/settlements",
            "reports": "https://dashboard.razorpay.com/app/reports",
        }


class CashfreeGatewayClient:
    """Cashfree Payment Gateway (Orders API, api-version 2023-08-01).

    Unlike Razorpay's in-page Checkout (static key_id + client-computed
    signature), Cashfree's Drop-in Checkout needs a per-order
    `payment_session_id` from create_order, and hands back no signature after
    payment — the browser only returns an order_id, so verify_checkout_signature
    resolves the real outcome via an authenticated API call instead of local
    HMAC math. Refunds are order-scoped, not payment-scoped, so
    initiate_refund needs gateway_order_id (Razorpay's refund API doesn't).
    """

    name = "cashfree"
    # Settlements/fetch-by-id aren't wired up yet — omitted so the admin
    # dashboard honestly shows "Not Supported" instead of erroring.
    capabilities = frozenset({"dashboard"})

    def __init__(self) -> None:
        self._app_id = settings.cashfree_app_id
        self._secret_key = settings.cashfree_secret_key
        self._api_version = settings.cashfree_api_version or "2023-08-01"

    def _configured(self) -> bool:
        return bool(self._app_id and self._secret_key)

    def _base_url(self) -> str:
        return CASHFREE_SANDBOX_API_BASE if self.mode() != "live" else CASHFREE_LIVE_API_BASE

    def _headers(self) -> dict:
        return {
            "x-client-id": self._app_id,
            "x-client-secret": self._secret_key,
            "x-api-version": self._api_version,
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, json: dict | None = None) -> Any:
        if not self._configured():
            raise GatewayError("Cashfree keys are not configured (CASHFREE_APP_ID / CASHFREE_SECRET_KEY)")
        async with httpx.AsyncClient(base_url=self._base_url(), headers=self._headers(), timeout=15) as client:
            resp = await client.request(method, path, json=json)
        if resp.status_code >= 400:
            # Cashfree error bodies: {"message": ..., "code": ..., "type": ...}
            try:
                desc = resp.json().get("message", resp.text[:200])
            except Exception:
                desc = resp.text[:200]
            raise GatewayError(f"Cashfree {method} {path} failed ({resp.status_code}): {desc}")
        return resp.json()

    async def create_order(
        self,
        amount_paise: int,
        receipt: str,
        notes: dict | None = None,
        customer: dict | None = None,
    ) -> dict:
        if not customer or not customer.get("phone"):
            raise GatewayError("Cashfree requires a customer phone number to create an order")
        # Cashfree needs a client-supplied, globally-unique order_id per
        # attempt — reusing the booking id would collide on retry.
        cf_order_id = f"order_{uuid.uuid4().hex[:24]}"
        data = await self._request(
            "POST",
            "/orders",
            json={
                "order_id": cf_order_id,
                "order_amount": round(amount_paise / 100, 2),
                "order_currency": "INR",
                "customer_details": {
                    "customer_id": str(customer.get("id") or uuid.uuid4().hex[:16]),
                    "customer_phone": customer["phone"],
                    "customer_name": customer.get("name") or "",
                    "customer_email": customer.get("email") or "",
                },
                "order_meta": {
                    "return_url": f"{settings.frontend_url}/dashboard/bookings/{receipt}?payment=return",
                    "notify_url": f"{settings.public_api_base_url}/api/v1/payments/webhook",
                },
                "order_note": (notes or {}).get("booking_reference", receipt)[:200],
            },
        )
        logger.info("cashfree_order_created: receipt=%s order_id=%s", receipt, data.get("order_id"))
        return {
            "order_id": data["order_id"],
            "amount_paise": amount_paise,
            "currency": "INR",
            # Drop-in Checkout is an embedded modal, not a redirect.
            "payment_url": None,
            "checkout_extra": {"payment_session_id": data.get("payment_session_id")},
            "raw": data,
        }

    def verify_webhook_signature(
        self, payload: bytes, signature: str, timestamp: str | None = None
    ) -> bool:
        """Cashfree signs webhooks with base64(HMAC-SHA256(timestamp + body,
        secret_key)) — the secret key doubles as the webhook secret."""
        if not (signature and timestamp and self._secret_key):
            return False
        msg = (timestamp + payload.decode("utf-8")).encode("utf-8")
        digest = hmac.new(self._secret_key.encode(), msg, hashlib.sha256).digest()
        expected = base64.b64encode(digest).decode()
        return hmac.compare_digest(expected, signature)

    async def verify_checkout_signature(self, order_id: str, payment_id: str, signature: str) -> str:
        """Cashfree's return flow hands back only an order_id — resolve the
        real outcome by asking Cashfree directly rather than trusting the
        browser's payment_id/signature (which Cashfree never signs)."""
        if not order_id:
            return ""
        payments = await self._request("GET", f"/orders/{order_id}/payments")
        for p in payments or []:
            if p.get("payment_status") == "SUCCESS":
                return str(p.get("cf_payment_id", ""))
        return ""

    async def initiate_refund(
        self,
        gateway_payment_id: str,
        amount_paise: int,
        notes: dict | None = None,
        gateway_order_id: str | None = None,
    ) -> dict:
        if not gateway_order_id:
            raise GatewayError("Cashfree refunds require the order id")
        refund_id = f"refund_{uuid.uuid4().hex[:20]}"
        data = await self._request(
            "POST",
            f"/orders/{gateway_order_id}/refunds",
            json={
                "refund_amount": round(amount_paise / 100, 2),
                "refund_id": refund_id,
                "refund_note": (notes or {}).get("reason", "Booking cancellation refund"),
            },
        )
        logger.info(
            "cashfree_refund_initiated: order_id=%s cf_refund_id=%s status=%s",
            gateway_order_id, data.get("cf_refund_id"), data.get("refund_status"),
        )
        # "processed" is the sentinel PaymentService checks for immediate
        # completion (see _execute_gateway_refund) — map Cashfree's own
        # vocabulary onto it so that generic logic doesn't need a gateway check.
        status = "processed" if data.get("refund_status") == "SUCCESS" else "pending"
        # Store cf_refund_id (Cashfree's own id), not the merchant-supplied
        # refund_id — REFUND_STATUS_WEBHOOK matches refunds by cf_refund_id
        # (see _handle_cashfree_event), so this must be what gets persisted
        # as gateway_refund_id or the webhook can never find this refund.
        return {"refund_id": data.get("cf_refund_id") or refund_id, "status": status, "raw": data}

    async def fetch_payment(self, gateway_payment_id: str) -> dict | None:
        # Cashfree has no lookup-by-payment-id-alone endpoint (needs the
        # order id too); not advertised in capabilities, so never called.
        return None

    async def fetch_settlements(self, count: int = 10) -> list[dict] | None:
        # Not implemented — "settlements" is intentionally absent from
        # capabilities so the admin dashboard shows "Not Supported" honestly.
        return None

    async def health_check(self) -> dict:
        if not self._configured():
            return {"status": "unconfigured", "detail": "Cashfree API keys are not set"}
        try:
            # Cashfree has no dedicated ping endpoint; fetching a nonexistent
            # order authenticates the request either way: 404 means the
            # credentials were accepted, 401 means they were rejected.
            async with httpx.AsyncClient(base_url=self._base_url(), headers=self._headers(), timeout=15) as client:
                resp = await client.get(f"/orders/health-check-{uuid.uuid4().hex[:12]}")
            if resp.status_code == 401:
                return {"status": "error", "detail": "Cashfree rejected the configured credentials"}
            return {"status": "ok", "detail": "Cashfree API reachable and credentials valid"}
        except Exception as exc:  # noqa: BLE001 — health check must never raise
            return {"status": "error", "detail": str(exc)}

    def mode(self) -> str:
        # Cashfree sandbox App IDs are prefixed "TEST"; live ones aren't —
        # mirrors how Razorpay's rzp_test_ prefix is used above.
        if not self._configured():
            return "unknown"
        return "test" if self._app_id.startswith("TEST") else "live"

    def checkout_config(self) -> dict:
        return {
            "gateway": self.name,
            "currency": "INR",
            "mode": self.mode(),
        }

    def dashboard_links(self) -> dict:
        return {"dashboard": "https://merchant.cashfree.com/merchants/login"}


_PROVIDERS: dict[str, type] = {
    "razorpay": RazorpayGatewayClient,
    "cashfree": CashfreeGatewayClient,
}


def available_gateways() -> list[str]:
    return sorted(_PROVIDERS)


def build_gateway_client(name: str) -> GatewayClientProtocol:
    cls = _PROVIDERS.get(name)
    if cls is None:
        raise GatewayError(f"Unknown payment gateway '{name}'. Available: {available_gateways()}")
    return cls()  # type: ignore[return-value]


async def get_gateway_client(db=None) -> GatewayClientProtocol:  # type: ignore[no-untyped-def]
    """Resolve the active gateway: admin override in provider_configs first,
    then the PAYMENT_GATEWAY env default. Every profile talks to the real
    Razorpay API — local/staging use rzp_test_* keys (sandbox, no real money),
    production uses rzp_live_*."""
    name: str | None = None
    if db is not None:
        from app.repositories.settings_repository import SettingsRepository

        row = await SettingsRepository(db).get_provider_config("payment")
        if row is not None:
            name = row.active_provider
    if name is not None and name not in _PROVIDERS:
        # A stored override can name a provider that no longer exists (e.g. the
        # retired "mock" gateway). Fall back rather than 500 every payment.
        logger.warning(
            "unknown_gateway_override: stored=%s falling back to %s",
            name, settings.payment_gateway,
        )
        name = None
    if name is None:
        name = settings.payment_gateway
    return build_gateway_client(name)
