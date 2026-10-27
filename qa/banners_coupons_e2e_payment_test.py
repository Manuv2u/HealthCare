#!/usr/bin/env python3
"""
Coupon E2E — Quote -> Booking -> Cashfree Payment -> Invoice
==============================================================
Verifies a coupon discount survives correctly through the entire money
pipeline: /billing/quote -> booking creation (atomic redemption) -> payment
initiation -> gateway webhook confirmation -> billing-summary (invoice data).
Confirms the amount actually charged and the final invoice line item both
match the originally quoted discount, not just that each step independently
"succeeds".

Uses the same webhook-signing approach as qa/smoke_test.py. Requires the
active gateway's secret (defaults match backend/app/config.py + .env.local
for local/dev):
  CASHFREE_SECRET_KEY=...      # if PAYMENT_GATEWAY=cashfree (default here)
  PAYMENT_WEBHOOK_SECRET=...   # legacy/simple-payload fallback signer

This targets a local dev DB: registration requires email-OTP verification
which this offline script can't read from a real inbox, so it bypasses that
one step by stamping email_verified_at directly via `docker exec psql`
(equivalent to what /verify-email-otp would set). Never do this against a
real user account or a non-local environment.
"""
import base64, hashlib, hmac, json, os, subprocess, sys, time, urllib.request, urllib.error, datetime

BASE = os.environ.get("BASE_URL", "http://localhost:8000/api/v1")
ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "9999999999")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
CASHFREE_SECRET_KEY = os.environ.get("CASHFREE_SECRET_KEY", "")
PAYMENT_WEBHOOK_SECRET = os.environ.get("PAYMENT_WEBHOOK_SECRET", "change-me")
PG_CONTAINER = os.environ.get("PG_CONTAINER", "sri-healthcare-postgres-1")
PG_USER = os.environ.get("PG_USER", "srihealthplus")
PG_DB = os.environ.get("PG_DB", "srihealthplus_dev")

PASS = 0; FAIL = 0; FAILURES = []

def check(name, cond, detail=""):
    global PASS, FAIL
    if cond: PASS += 1; print(f"PASS  {name}")
    else:
        FAIL += 1; FAILURES.append((name, detail))
        print(f"FAIL  {name}  {('- ' + str(detail)[:300]) if detail else ''}")

def api(method, path, token=None, body=None, extra_headers=None):
    url = BASE + path
    headers = {}; data = None
    if token: headers["Authorization"] = "Bearer " + token
    if body is not None:
        data = json.dumps(body, default=str).encode(); headers["Content-Type"] = "application/json"
    if extra_headers: headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30); b = r.read()
        return r.status, (json.loads(b) if b else None)
    except urllib.error.HTTPError as e:
        b = e.read()
        try: return e.code, json.loads(b)
        except Exception: return e.code, b.decode(errors="replace")

def force_verify_email(email):
    sql = f"UPDATE users SET email_verified_at = now() WHERE email = '{email}';"
    subprocess.run(["docker", "exec", "-i", PG_CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB, "-c", sql],
                    capture_output=True, text=True)

print(f"\n=== Coupon E2E payment/invoice test @ {BASE} ===\n")
stamp = datetime.datetime.now().strftime("%H%M%S")

st, r = api("POST", "/auth/login", body={"phone_or_email": ADMIN_PHONE, "password": ADMIN_PASSWORD})
admin = r.get("access_token") if isinstance(r, dict) else None
if not admin:
    print("Admin login failed, aborting."); sys.exit(1)

email = f"e2e_{stamp}@sritest.local"
phone = f"7{int(time.time()) % 100000}00000"[:10].ljust(10, "0")
api("POST", "/auth/register", body={"name": "E2E User", "phone": phone, "email": email, "password": "Test@1234"})
force_verify_email(email)
st, r = api("POST", "/auth/login", body={"phone_or_email": phone, "password": "Test@1234"})
utok = r.get("access_token") if isinstance(r, dict) else None
check("test user ready", bool(utok), st)

_, pkgs = api("GET", "/packages?limit=5", admin)
pkgs = pkgs.get("items", pkgs) if isinstance(pkgs, dict) else pkgs
pkg = pkgs[0] if isinstance(pkgs, list) and pkgs else None
check("package available", bool(pkg), pkgs)

code = f"E2E{stamp}"
st, coupon = api("POST", "/coupons", admin, body={
    "code": code, "discount_type": "percentage", "discount_value": 20,
    "package_ids": [pkg["id"]] if pkg else [], "is_active": True})
check("20% coupon created", st == 201, (st, coupon))

st, quote = api("POST", "/billing/quote", utok, body={"package_ids": [pkg["id"]], "test_ids": [], "coupon_code": code})
check("quote reflects coupon discount", st == 200 and isinstance(quote, dict) and quote.get("discount_total", 0) > 0, (st, quote))
subtotal = quote.get("subtotal") if isinstance(quote, dict) else None
quoted_total = quote.get("total") if isinstance(quote, dict) else None
quoted_discount = quote.get("discount_total") if isinstance(quote, dict) else None
print(f"  quote: subtotal={subtotal} discount={quoted_discount} total={quoted_total}")
check("quoted discount is exactly 20% of subtotal", subtotal is not None and abs(quoted_discount - round(subtotal * 0.2, 2)) < 0.01, (subtotal, quoted_discount))

_, slots = api("GET", "/time-slots?limit=50", admin)
slots = slots.get("items", slots) if isinstance(slots, dict) else slots
lab_slot = next((s["id"] for s in slots if s.get("collection_type") == "lab" and s.get("is_active")), None) if isinstance(slots, list) else None
_, branches = api("GET", "/lab-branches?limit=10", admin)
branches = branches.get("items", branches) if isinstance(branches, dict) else branches
branch_id = branches[0]["id"] if isinstance(branches, list) and branches else None
check("lab slot + branch available", bool(lab_slot and branch_id), (lab_slot, branch_id))

date = (datetime.date.today() + datetime.timedelta(days=4)).isoformat()
st, booking = api("POST", "/bookings", utok, body={
    "collection_type": "lab", "time_slot_id": lab_slot, "booking_date": date,
    "package_ids": [pkg["id"]], "test_ids": [], "lab_branch_id": branch_id, "coupon_code": code})
check("booking created with coupon redeemed", st in (200, 201), (st, booking))
bid = booking.get("id") if isinstance(booking, dict) else None

st, pay = api("POST", "/payments/initiate", utok, body={"booking_id": bid, "method": "online"})
check("payment initiated", st in (200, 201), (st, pay))
pid = pay.get("payment_id") or pay.get("id") if isinstance(pay, dict) else None
order_id = pay.get("order_id") if isinstance(pay, dict) else None
charged_amount = pay.get("amount") if isinstance(pay, dict) else None
check("amount charged at payment step matches the redeemed discount total",
      charged_amount is not None and quoted_total is not None and abs(float(charged_amount) - float(quoted_total)) < 0.01,
      (charged_amount, quoted_total))

_, cfg = api("GET", "/payments/checkout-config", admin)
gateway = cfg.get("gateway") if isinstance(cfg, dict) else None

if gateway == "cashfree" and CASHFREE_SECRET_KEY and order_id:
    payload = {"payment_id": f"e2e_{pid}", "order_id": order_id}
    body_bytes = json.dumps(payload).encode()
    ts = str(int(time.time()))
    msg = (ts + body_bytes.decode("utf-8")).encode("utf-8")
    sig = base64.b64encode(hmac.new(CASHFREE_SECRET_KEY.encode(), msg, hashlib.sha256).digest()).decode()
    st, wh = api("POST", "/payments/webhook", body=payload,
                 extra_headers={"X-Webhook-Signature": sig, "X-Webhook-Timestamp": ts})
    check("Cashfree-signed webhook confirms payment", st in (200, 201), (st, wh))
elif order_id:
    secret = PAYMENT_WEBHOOK_SECRET
    payload = {"payment_id": f"e2e_{pid}", "order_id": order_id}
    body_bytes = json.dumps(payload).encode()
    sig = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
    st, wh = api("POST", "/payments/webhook", body=payload, extra_headers={"X-Razorpay-Signature": sig})
    check("signed webhook confirms payment", st in (200, 201), (st, wh))
else:
    check("webhook confirmation", False, "no order_id from payment initiate")

_, invoice = api("GET", f"/bookings/{bid}/billing-summary", admin)
has_coupon_line = isinstance(invoice, dict) and any("Coupon" in (a.get("label") or "") for a in invoice.get("adjustments", []))
check("invoice/billing-summary shows the coupon discount line item", has_coupon_line, invoice)
check("invoice total matches what was charged",
      isinstance(invoice, dict) and charged_amount is not None and abs(float(invoice.get("total", -1)) - float(charged_amount)) < 0.01,
      (invoice, charged_amount))

# Cleanup: remove the test coupon (booking/payment/invoice records are left
# in place intentionally — they're real, harmless historical records, same
# as any booking made through the UI during manual QA).
_, all_coupons = api("GET", "/coupons/admin", admin)
if isinstance(all_coupons, list):
    match = next((c for c in all_coupons if c["code"] == code), None)
    if match:
        api("DELETE", f"/coupons/{match['id']}", admin)

print(f"\n=== {PASS} passed, {FAIL} failed ===")
if FAILURES:
    print("\nFailures:")
    for n, d in FAILURES: print(f"  - {n}: {d}")
sys.exit(1 if FAIL else 0)
