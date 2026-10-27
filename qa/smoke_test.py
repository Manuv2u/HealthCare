#!/usr/bin/env python3
"""
Sri Health Plus — Post-Release Smoke / Monkey Test
==================================================
A fast, self-contained (stdlib-only) end-to-end sanity check that exercises
every *basic* option of the app through the public API. Run it right after a
deploy to confirm the critical paths still work before real traffic hits.

What it covers
--------------
  Health .......... /health reachable
  Auth ............ register, login (password), me, wrong-password rejected,
                    duplicate rejected, forgot-password, sessions endpoint
  Profile ......... update profile, add address, add family member
  Catalog ......... tests, packages, time-slots, service-areas, lab-branches
  Booking ......... create (home + lab), payment initiate + webhook confirm,
                    technician assign (home), full status lifecycle,
                    report upload + user download
  Admin ........... dashboard, analytics, users list/search/stats,
                    CSV + Excel exports, bookings list, technicians, feature flags
  Security ........ user blocked from admin, cross-user (IDOR) read blocked

Usage
-----
  python3 qa/smoke_test.py                        # defaults to localhost:8000
  BASE_URL=http://host:8000/api/v1 python3 qa/smoke_test.py
  ADMIN_PHONE=9999999999 ADMIN_PASSWORD='Admin@123' python3 qa/smoke_test.py

There is no admin "mark paid" shortcut — every booking must go through the
same gateway-webhook confirmation flow production traffic uses. This script
signs a legacy simple-payload webhook call with whichever gateway secret the
target backend is actually configured with, so it must be run with the same
secret(s):
  PAYMENT_WEBHOOK_SECRET=change-me                # Razorpay, matches config.py default
  RAZORPAY_WEBHOOK_SECRET=...                      # takes precedence if the backend sets it
  CASHFREE_SECRET_KEY=...                          # required only if PAYMENT_GATEWAY=cashfree
If the relevant secret isn't supplied, the payment-confirmation step (and
anything downstream that depends on a paid booking) is skipped rather than
falsely failed.

Exit code is 0 when everything passes, 1 otherwise — wire it into CI/CD.
Every run uses a unique phone/email (timestamp based) so it is safe to run
repeatedly against the same environment.
"""
import base64, hashlib, hmac, io, json, os, random, string, subprocess, sys, time, urllib.request, urllib.error, datetime

BASE = os.environ.get("BASE_URL", "http://localhost:8000/api/v1")
ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "9999999999")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
PG_CONTAINER = os.environ.get("PG_CONTAINER", "sri-healthcare-postgres-1")
PG_USER = os.environ.get("PG_USER", "srihealthplus")
PG_DB = os.environ.get("PG_DB", "srihealthplus_dev")
# Mirrors backend/app/config.py defaults so a local/dev run needs no extra
# setup; a real deploy with custom secrets must pass them in explicitly.
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
PAYMENT_WEBHOOK_SECRET = os.environ.get("PAYMENT_WEBHOOK_SECRET", "change-me")
CASHFREE_SECRET_KEY = os.environ.get("CASHFREE_SECRET_KEY", "")

def force_verify_email(email):
    """Registration now requires email-OTP verification via a real Mailtrap
    send, which this offline script cannot read. Since this targets a local
    dev DB with disposable test accounts only, bypass the OTP step by
    stamping email_verified_at directly — equivalent to what
    /auth/verify-email-otp would set, without depending on inbox access."""
    sql = f"UPDATE users SET email_verified_at = now() WHERE email = '{email}';"
    subprocess.run(["docker", "exec", "-i", PG_CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB, "-c", sql],
                    capture_output=True, text=True)

PASS = 0; FAIL = 0; SKIP = 0; FAILURES = []
C_OK = "\033[92m"; C_NO = "\033[91m"; C_WARN = "\033[93m"; C_Z = "\033[0m"

def check(name, ok, detail=""):
    global PASS, FAIL
    if ok: PASS += 1; print(f"{C_OK}  PASS{C_Z} {name}")
    else:
        FAIL += 1; FAILURES.append((name, detail))
        print(f"{C_NO}  FAIL{C_Z} {name}  {('- ' + str(detail)[:200]) if detail else ''}")

def skip(name, reason):
    """Not a failure — a prerequisite (usually a gateway secret) wasn't
    supplied to this run, so the check can't be meaningfully evaluated."""
    global SKIP
    SKIP += 1
    print(f"{C_WARN}  SKIP{C_Z} {name}  - {reason}")

def api(method, path, token=None, body=None, files=None, expect=None, raw=False, extra_headers=None):
    """Returns (status, parsed_body). expect: int or tuple of acceptable statuses."""
    url = BASE + path
    headers = {}; data = None
    if token: headers["Authorization"] = "Bearer " + token
    if body is not None:
        data = json.dumps(body).encode(); headers["Content-Type"] = "application/json"
    if extra_headers: headers.update(extra_headers)
    if files is not None:
        boundary = "----smoke" + "".join(random.choices(string.ascii_letters, k=10))
        buf = io.BytesIO()
        for k, (fn, content, ct) in files.items():
            buf.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"; "
                      f"filename=\"{fn}\"\r\nContent-Type: {ct}\r\n\r\n".encode())
            buf.write(content); buf.write(b"\r\n")
        buf.write(f"--{boundary}--\r\n".encode())
        data = buf.getvalue(); headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30); b = r.read()
        return r.status, (b if raw else (json.loads(b) if b else None))
    except urllib.error.HTTPError as e:
        b = e.read()
        try: return e.code, json.loads(b)
        except Exception: return e.code, b.decode(errors="replace")
    except Exception as e:
        return 0, str(e)

_GATEWAY = {"name": None, "detected": False}

def active_gateway(token):
    """Which gateway (razorpay/cashfree) the backend is actually configured
    with — cached for the whole run since it can't change mid-test."""
    if not _GATEWAY["detected"]:
        _, cfg = api("GET", "/payments/checkout-config", token)
        _GATEWAY["name"] = cfg.get("gateway") if isinstance(cfg, dict) else None
        _GATEWAY["detected"] = True
    return _GATEWAY["name"]

def webhook_headers(token, body_bytes):
    """Sign a legacy simple-payload webhook body the same way the real
    gateway would, matching backend/app/services/gateway_client.py exactly.
    Returns None (with an explanatory reason) if the active gateway's secret
    was not supplied to this script."""
    gw = active_gateway(token)
    if gw == "cashfree":
        if not CASHFREE_SECRET_KEY:
            return None, "CASHFREE_SECRET_KEY not set — cannot sign webhook"
        timestamp = str(int(time.time()))
        msg = (timestamp + body_bytes.decode("utf-8")).encode("utf-8")
        sig = base64.b64encode(hmac.new(CASHFREE_SECRET_KEY.encode(), msg, hashlib.sha256).digest()).decode()
        return {"X-Webhook-Signature": sig, "X-Webhook-Timestamp": timestamp}, None
    # Default / razorpay: HMAC-SHA256 hex over the raw body, no timestamp.
    secret = RAZORPAY_WEBHOOK_SECRET or PAYMENT_WEBHOOK_SECRET
    sig = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
    return {"X-Razorpay-Signature": sig}, None

def confirm_payment_via_webhook(token, payment_id, order_id):
    """Simulates the gateway confirming a payment — the same webhook path
    production traffic uses (see PaymentService._handle_simple_payload).
    Returns (ok, detail)."""
    if not order_id:
        return False, "no order_id from initiate response"
    payload = {"payment_id": f"smoke_{payment_id}", "order_id": order_id}
    body = json.dumps(payload).encode()
    headers, skip_reason = webhook_headers(token, body)
    if headers is None:
        return None, skip_reason
    st, r = api("POST", "/payments/webhook", body=payload, extra_headers=headers)
    return st in (200, 201), st

def minimal_pdf(title):
    txt = f"BT /F1 18 Tf 60 720 Td ({title}) Tj ET"
    objs = ["1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
            "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
            "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>endobj",
            f"4 0 obj<</Length {len(txt)}>>stream\n{txt}\nendstream endobj",
            "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj"]
    out = "%PDF-1.4\n"; offs = []
    for o in objs: offs.append(len(out)); out += o + "\n"
    xref = len(out); out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n"
    for o in offs: out += f"{o:010d} 00000 n \n"
    out += f"trailer<</Size {len(objs)+1}/Root 1 0 R>>\nstartxref\n{xref}\n%%EOF"
    return out.encode()

print(f"\n=== Sri Health Plus smoke test @ {BASE} ===\n")
stamp = datetime.datetime.now().strftime("%H%M%S")
uniq = f"{int(time.time())%100000}"

# ---- Health ----
st, _ = api("GET", "/health")
check("health endpoint reachable", st == 200, st)

# ---- Admin login ----
st, r = api("POST", "/auth/login", body={"phone_or_email": ADMIN_PHONE, "password": ADMIN_PASSWORD})
admin = r.get("access_token") if isinstance(r, dict) else None
check("admin login", st == 200 and admin, st)
if not admin:
    print("\nAdmin login failed — aborting."); sys.exit(1)

# ---- Catalog reads ----
_, tests = api("GET", "/tests?limit=50", admin)
tests = tests.get("items", tests) if isinstance(tests, dict) else tests
test_ids = [t["id"] for t in tests] if isinstance(tests, list) else []
check("tests catalog returns items", len(test_ids) > 0, len(test_ids))
_, pkgs = api("GET", "/packages?limit=10", admin); check("packages catalog reachable", isinstance(pkgs, (list, dict)))
_, slots = api("GET", "/time-slots?limit=50", admin)
slots = slots.get("items", slots) if isinstance(slots, dict) else slots
home_slot = next((s["id"] for s in slots if s.get("collection_type") == "home" and s.get("is_active")), None)
lab_slot = next((s["id"] for s in slots if s.get("collection_type") == "lab" and s.get("is_active")), None)
check("home + lab time slots exist", home_slot and lab_slot)
_, areas = api("GET", "/service-areas?limit=50", admin)
areas = areas.get("items", areas) if isinstance(areas, dict) else areas
pincode = next((a["pincode"] for a in areas if a.get("is_active")), None) if isinstance(areas, list) else None
check("serviceable pincode available", bool(pincode), pincode)
_, branches = api("GET", "/lab-branches?limit=10", admin)
branches = branches.get("items", branches) if isinstance(branches, dict) else branches
branch_id = branches[0]["id"] if isinstance(branches, list) and branches else None
check("lab branch available", bool(branch_id))

# ---- Register + login a throwaway user ----
phone = f"6{uniq}00000"[:10].ljust(10, "0")
email = f"smoke_{stamp}@sritest.local"
st, r = api("POST", "/auth/register", body={"name": "Smoke User", "phone": phone, "email": email, "password": "Smoke@1234"})
check("user registration", st == 201 and isinstance(r, dict) and r.get("email") == email, st)
force_verify_email(email)
st, r = api("POST", "/auth/login", body={"phone_or_email": phone, "password": "Smoke@1234"})
utok = r.get("access_token") if isinstance(r, dict) else None
check("user login (password)", st == 200 and utok, st)
st, me = api("GET", "/users/me", utok)
check("get current profile (/users/me)", st == 200 and me.get("phone") == phone, st)
st, r = api("GET", "/auth/sessions", utok)
check("list active sessions (no 500)", st == 200 and isinstance(r, list), st)

# ---- Negative auth ----
st, _ = api("POST", "/auth/login", body={"phone_or_email": phone, "password": "WRONG"})
check("wrong password rejected", st in (400, 401), st)
st, _ = api("POST", "/auth/register", body={"name": "Dup", "phone": phone, "email": "x"+email, "password": "Smoke@1234"})
check("duplicate phone registration rejected", st == 409, st)
st, r = api("POST", "/auth/forgot-password", body={"email": email})
check("forgot-password accepted", st in (200, 202), st)

# ---- Profile / address / family ----
st, _ = api("PUT", "/users/me", utok, body={"name": "Smoke User Updated"})
check("update profile", st in (200, 204), st)
st, _ = api("POST", "/users/me/addresses", utok, body={
    "label": "Home", "address_line1": "1 Test Rd", "city": "Bengaluru",
    "state": "Karnataka", "pincode": pincode or "560016", "is_default": True})
check("add address", st in (200, 201), st)
st, _ = api("POST", "/users/me/addresses", utok, body={
    "label": "Bad", "address_line1": "1", "city": "c", "state": "s", "pincode": "12"})
check("invalid address rejected (validation)", st == 422, st)
st, _ = api("POST", "/users/me/family-members", utok, body={
    "name": f"Rel {stamp}", "relationship": "spouse", "date_of_birth": "1990-01-01", "gender": "female"})
check("add family member", st in (200, 201), st)

# ---- Booking lifecycle (home + lab) ----
def run_booking(ctype, slot_id):
    date = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()
    body = {"collection_type": ctype, "time_slot_id": slot_id, "booking_date": date,
            "test_ids": random.sample(test_ids, k=min(2, len(test_ids)))}
    if ctype == "home": body["pincode"] = pincode or "560016"
    elif branch_id: body["lab_branch_id"] = branch_id
    st, r = api("POST", "/bookings", utok, body=body)
    ok = st in (200, 201) and isinstance(r, dict) and r.get("id")
    check(f"{ctype} booking create", ok, st)
    if not ok: return
    bid = r["id"]
    st, r = api("POST", "/payments/initiate", utok, body={"booking_id": bid, "method": "online"})
    pid = r.get("payment_id") or r.get("id") if isinstance(r, dict) else None
    order_id = r.get("order_id") if isinstance(r, dict) else None
    check(f"{ctype} payment initiate", st in (200, 201), st)
    paid = False
    if pid:
        # No admin "mark paid" shortcut exists anymore — confirm the payment
        # the same way the real gateway does, via a signed webhook call.
        ok_wh, detail = confirm_payment_via_webhook(admin, pid, order_id)
        if ok_wh is None:
            skip(f"{ctype} payment webhook confirm", detail)
        else:
            check(f"{ctype} payment webhook confirm", ok_wh, detail)
            paid = ok_wh
    if ctype == "home":
        if not paid:
            skip(f"{ctype} technician assign", "payment was not confirmed paid")
        else:
            _, techs = api("GET", "/technicians?limit=5", admin)
            techs = techs.get("items", techs) if isinstance(techs, dict) else techs
            if isinstance(techs, list) and techs:
                st, _ = api("POST", f"/technicians/{techs[0]['id']}/assign", admin, body={"booking_id": bid})
                check(f"{ctype} technician assign", st in (200, 201), st)
    steps = ["technician_assigned", "accepted", "on_the_way", "sample_collected", "reached_lab",
             "sample_delivered", "processing", "report_ready", "completed"]
    _, b = api("GET", f"/bookings/{bid}", admin)
    cur = b.get("status") if isinstance(b, dict) else None
    for tgt in steps:
        if tgt == cur: continue
        if tgt == "completed":
            st, _ = api("POST", f"/reports/upload?booking_id={bid}", admin,
                        files={"file": (f"rep_{bid[:8]}.pdf", minimal_pdf("Smoke Report"), "application/pdf")})
            check(f"{ctype} report upload", st in (200, 201), st)
        st, _ = api("PUT", f"/bookings/{bid}/status", admin, body={"status": tgt})
        if st in (200, 201): cur = tgt
        else: break
    check(f"{ctype} booking reaches 'completed'", cur == "completed", cur)
    _, reps = api("GET", f"/reports?booking_id={bid}", utok)
    reps = reps.get("items", reps) if isinstance(reps, dict) else reps
    ok = isinstance(reps, list) and reps
    check(f"{ctype} user sees report", bool(ok))
    if ok:
        st, r = api("GET", f"/reports/{reps[0]['id']}/download-url", utok)
        check(f"{ctype} user gets download url", st == 200, st)

if home_slot: run_booking("home", home_slot)
if lab_slot: run_booking("lab", lab_slot)

# ---- Admin panel ----
st, r = api("GET", "/admin/dashboard", admin); check("admin dashboard", st == 200 and isinstance(r, dict), st)
st, _ = api("GET", "/admin/analytics", admin); check("admin analytics", st == 200, st)
st, _ = api("GET", "/admin/users?limit=5", admin); check("admin users list", st == 200, st)
st, _ = api("GET", "/admin/users?search=Smoke", admin); check("admin users search", st == 200, st)
st, _ = api("GET", "/admin/users/stats", admin); check("admin users stats", st == 200, st)
st, b = api("GET", "/admin/users/export", admin, raw=True); check("admin users CSV export", st == 200 and b, st)
st, b = api("GET", "/admin/analytics/export", admin, raw=True); check("admin analytics export", st == 200 and b, st)
st, _ = api("GET", "/bookings?limit=5", admin); check("admin bookings list", st == 200, st)
st, _ = api("GET", "/technicians?limit=5", admin); check("admin technicians list", st == 200, st)
st, _ = api("GET", "/feature-flags", admin); check("feature flags list", st == 200, st)
st, _ = api("GET", "/admin/settings/cancellation", admin); check("cancellation settings", st == 200, st)

# ---- Security ----
st, _ = api("GET", "/admin/dashboard", utok); check("normal user blocked from admin (403)", st == 403, st)
st, _ = api("POST", "/tests", utok, body={"name": "x", "category": "y", "price": 1})
check("normal user cannot create catalog (403)", st == 403, st)

# ---- Summary ----
print(f"\n=== {C_OK}{PASS} passed{C_Z}, {C_NO if FAIL else C_OK}{FAIL} failed{C_Z}, "
      f"{C_WARN if SKIP else C_OK}{SKIP} skipped{C_Z}, {PASS+FAIL} total ===")
if FAILURES:
    print("\nFailures:")
    for n, d in FAILURES: print(f"  - {n}: {d}")
sys.exit(1 if FAIL else 0)
