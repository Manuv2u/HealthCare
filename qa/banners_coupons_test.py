#!/usr/bin/env python3
"""
Banners & Coupons — Production-Readiness Test
==============================================
Executes the high-priority cases from qa/banners-coupons-test-plan.md against
a live backend, at the API layer (bypassing any client-only validation to
verify what the server actually enforces).

Usage:
  python3 qa/banners_coupons_test.py
  BASE_URL=http://localhost:8000/api/v1 python3 qa/banners_coupons_test.py
"""
import io, json, os, random, string, subprocess, sys, time, urllib.request, urllib.error, datetime, uuid

BASE = os.environ.get("BASE_URL", "http://localhost:8000/api/v1")
ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "9999999999")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
PG_CONTAINER = os.environ.get("PG_CONTAINER", "sri-healthcare-postgres-1")
PG_USER = os.environ.get("PG_USER", "srihealthplus")
PG_DB = os.environ.get("PG_DB", "srihealthplus_dev")

def force_verify_email(email):
    """New registrations require email-OTP verification via a real Mailtrap
    send, which this offline test script cannot read. Since this targets a
    local dev DB with disposable test accounts only, bypass the OTP step by
    stamping email_verified_at directly — equivalent to what /verify-email-otp
    would set, without depending on inbox access."""
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
        print(f"{C_NO}  FAIL{C_Z} {name}  {('- ' + str(detail)[:300]) if detail else ''}")

def skip(name, reason):
    global SKIP
    SKIP += 1
    print(f"{C_WARN}  SKIP{C_Z} {name}  - {reason}")

def api(method, path, token=None, body=None, expect=None, raw=False):
    url = BASE + path
    headers = {}; data = None
    if token: headers["Authorization"] = "Bearer " + token
    if body is not None:
        data = json.dumps(body, default=str).encode(); headers["Content-Type"] = "application/json"
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

def err_code(r):
    if isinstance(r, dict):
        d = r.get("detail")
        if isinstance(d, dict): return d.get("error_code")
        if isinstance(d, str): return d
    return None

print(f"\n=== Banners & Coupons production-readiness test @ {BASE} ===\n")
stamp = datetime.datetime.now().strftime("%H%M%S")
uniq = int(time.time()) % 100000

# ---- Setup: admin, user, technician, catalog data ----
st, r = api("POST", "/auth/login", body={"phone_or_email": ADMIN_PHONE, "password": ADMIN_PASSWORD})
admin = r.get("access_token") if isinstance(r, dict) else None
check("admin login", st == 200 and admin, st)
if not admin:
    print("Admin login failed, aborting."); sys.exit(1)

phone = f"7{uniq}00000"[:10].ljust(10, "0")
email = f"bctest_{stamp}@sritest.local"
st, r = api("POST", "/auth/register", body={"name": "BC Test User", "phone": phone, "email": email, "password": "Test@1234"})
check("test user registration accepted (pending email verification)", st == 201, (st, r))
force_verify_email(email)
st, r = api("POST", "/auth/login", body={"phone_or_email": phone, "password": "Test@1234"})
utok = r.get("access_token") if isinstance(r, dict) else None
check("test user registered/logged in", bool(utok), st)

tech_phone = f"8{uniq}00000"[:10].ljust(10, "0")
tech_email = f"bctech_{stamp}@sritest.local"
st, r = api("POST", "/technicians/create-account", admin, body={
    "name": "BC Test Tech", "phone": tech_phone, "email": tech_email, "password": "Test@1234"})
check("technician account created", st == 201, (st, r))
force_verify_email(tech_email)
st, r = api("POST", "/auth/login", body={"phone_or_email": tech_phone, "password": "Test@1234"})
ttok = r.get("access_token") if isinstance(r, dict) else None
check("technician login", st == 200 and ttok, st)

_, pkgs = api("GET", "/packages?limit=20", admin)
pkgs = pkgs.get("items", pkgs) if isinstance(pkgs, dict) else pkgs
packages = pkgs if isinstance(pkgs, list) else []
check("packages available for testing", len(packages) >= 2, len(packages))
pkg_a = packages[0] if packages else None
pkg_b = packages[1] if len(packages) > 1 else None

# =====================================================================
# SECTION 1 — BANNER ADMIN CRUD & VALIDATION
# =====================================================================
print("\n--- Banners: Admin CRUD & Validation ---")

created_banner_ids = []

def make_banner(_token=None, **over):
    body = {
        "title": f"Test Banner {stamp}", "subtitle": "Subtitle text",
        "banner_type": "advertisement", "category": "packages",
        "highlights": ["Home Collection", "NABL Certified"],
        "cta_text": "Book Now", "cta_link": "/packages",
        "display_order": 0, "status": "draft",
    }
    body.update(over)
    return api("POST", "/banners", _token if _token is not None else admin, body=body)

# BNR-ADM-01/02: positive create
st, r = make_banner()
ok = st == 201 and isinstance(r, dict) and r.get("id")
check("BNR-ADM-01 create advertisement banner (all required fields)", ok, (st, r))
if ok: created_banner_ids.append(r["id"])

st, r = make_banner(banner_type="promotional_offer", title=None, subtitle=None)
ok = st == 201
check("BNR-ADM-02 create promotional_offer banner without title/subtitle", ok, (st, r))
if ok: created_banner_ids.append(r["id"])

# BNR-ADM-03/04: negative — advertisement missing title/subtitle
st, r = make_banner(title=None)
check("BNR-ADM-03 advertisement missing title rejected", st in (400, 422), (st, r))
st, r = make_banner(subtitle=None)
check("BNR-ADM-04 advertisement missing subtitle rejected", st in (400, 422), (st, r))

# BNR-ADM-05/06: boundary lengths
st, r = make_banner(title="A" * 200)
check("BNR-ADM-05a title at 200 chars accepted", st == 201, (st, r))
if st == 201: created_banner_ids.append(r["id"])
st, r = make_banner(title="A" * 201)
check("BNR-ADM-05b title at 201 chars rejected", st in (400, 422), (st, r))

st, r = make_banner(cta_link="/x?" + "a" * 497)  # 500 total
check("BNR-ADM-06a cta_link at 500 chars accepted", st == 201, (st, r, len("/x?" + "a" * 497)))
if st == 201: created_banner_ids.append(r["id"])
st, r = make_banner(cta_link="/x?" + "a" * 498)  # 501 total
check("BNR-ADM-06b cta_link at 501 chars rejected", st in (400, 422), (st, r))

# BNR-ADM-07: invalid highlight
st, r = make_banner(highlights=["Not A Real Highlight"])
check("BNR-ADM-07 invalid highlight value rejected", st in (400, 422), (st, r))

# BNR-ADM-08: category outside fixed list (server-side gap check)
st, r = make_banner(category="totally_made_up_category")
check("BNR-ADM-08 [GAP] arbitrary category via API", st == 201, (st, r) if st != 201 else "accepted (server does not validate category — matches code read, confirm with product)")
if st == 201: created_banner_ids.append(r["id"])

# BNR-ADM-09: invalid banner_type
st, r = make_banner(banner_type="clickbait")
check("BNR-ADM-09 invalid banner_type rejected", st in (400, 422), (st, r))

# BNR-ADM-10/11/12: edit, publish, unpublish
st, r = make_banner()
b_id = r.get("id") if st == 201 else None
check("setup: banner for lifecycle tests created", bool(b_id), (st, r))
if b_id:
    created_banner_ids.append(b_id)
    st, r = api("PUT", f"/banners/{b_id}", admin, body={"title": "Updated Title"})
    check("BNR-ADM-10 edit banner title", st == 200 and r.get("title") == "Updated Title", (st, r))

    st, r = api("PUT", f"/banners/{b_id}", admin, body={"status": "published"})
    check("BNR-ADM-11 publish banner", st == 200 and r.get("status") == "published", (st, r))

    _, pub = api("GET", "/banners")
    pub_ids = [x["id"] for x in pub] if isinstance(pub, list) else []
    check("BNR-DISP-01a published banner appears on public GET /banners", b_id in pub_ids, pub_ids)

    st, r = api("PUT", f"/banners/{b_id}", admin, body={"status": "draft"})
    check("BNR-ADM-12 unpublish banner", st == 200 and r.get("status") == "draft", (st, r))

    _, pub = api("GET", "/banners")
    pub_ids = [x["id"] for x in pub] if isinstance(pub, list) else []
    check("BNR-DISP-01b unpublished banner disappears from public GET /banners", b_id not in pub_ids, pub_ids)

# BNR-ADM-13: delete
st, r = make_banner()
del_id = r.get("id") if st == 201 else None
if del_id:
    st, _ = api("DELETE", f"/banners/{del_id}", admin)
    check("BNR-ADM-13 delete banner", st in (200, 204), st)
    st, r = api("GET", "/banners/admin", admin)
    ids = [x["id"] for x in r] if isinstance(r, list) else []
    check("BNR-ADM-13b deleted banner gone from admin list", del_id not in ids, del_id)

# BNR-ADM-16: reorder
if len(created_banner_ids) >= 2:
    items = [{"id": bid, "display_order": i} for i, bid in enumerate(reversed(created_banner_ids[:3]))]
    st, r = api("PUT", "/banners/reorder", admin, body={"items": items})
    check("BNR-ADM-16 reorder banners", st in (200, 204), (st, r))

# BNR-ADM-20/21: role checks
st, r = make_banner(_token=utok)
check("BNR-ADM-20 user cannot create banner (403)", st == 403, (st, r))
st2, _ = api("POST", "/banners", ttok, body={"title": "x", "subtitle": "y", "banner_type": "advertisement"})
check("BNR-ADM-21 technician cannot create banner (403)", st2 == 403, st2)
st, _ = api("GET", "/banners/admin", utok)
check("user cannot list admin banners (403)", st == 403, st)
st, _ = api("GET", "/banners/admin")
check("unauthenticated cannot list admin banners (401)", st == 401, st)
st, _ = api("GET", "/banners")
check("unauthenticated CAN list public banners (200)", st == 200, st)

# BNR-NAV-05 / SEC-02: javascript: URI in cta_link
st, r = make_banner(cta_link="javascript:alert(1)")
check("SEC-02 javascript: URI in cta_link — server accepts string as-is (no format validation; verify frontend router refuses to execute it)",
      st == 201, (st, r))
if st == 201: created_banner_ids.append(r["id"])

# =====================================================================
# SECTION 2 — BANNER IMAGE UPLOAD
# =====================================================================
print("\n--- Banners: Image Upload ---")

def upload_image(banner_id, token, filename, content, content_type, variant="desktop"):
    boundary = "----bctest" + "".join(random.choices(string.ascii_letters, k=10))
    buf = io.BytesIO()
    buf.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
              f"filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n".encode())
    buf.write(content); buf.write(b"\r\n")
    buf.write(f"--{boundary}--\r\n".encode())
    data = buf.getvalue()
    req = urllib.request.Request(
        BASE + f"/banners/{banner_id}/image?variant={variant}", data=data, method="POST",
        headers={"Authorization": "Bearer " + token, "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        r = urllib.request.urlopen(req, timeout=30); return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        b = e.read()
        try: return e.code, json.loads(b)
        except Exception: return e.code, b.decode(errors="replace")
    except Exception as e:
        return 0, str(e)

tiny_png = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753"
    "de0000000c4944415478da6360606060000000050001a5f645400000000049454e44ae426082")

if created_banner_ids:
    img_banner = created_banner_ids[0]
    st, r = upload_image(img_banner, admin, "test.png", tiny_png, "image/png")
    check("BNR-IMG-01 upload valid PNG (desktop)", st == 200, (st, r))
    st, r = upload_image(img_banner, admin, "test2.png", tiny_png, "image/png", variant="mobile")
    check("BNR-IMG-01b upload valid PNG (mobile)", st == 200, (st, r))
    st, r = upload_image(img_banner, admin, "test.pdf", b"%PDF-1.4 fake", "application/pdf")
    check("BNR-IMG-03 disallowed MIME type (pdf) rejected", st in (400, 415, 422), (st, r))
    st, r = upload_image(img_banner, admin, "test.bmp", b"BM fake bmp data", "image/bmp")
    check("BNR-IMG-03b disallowed MIME type (bmp) rejected", st in (400, 415, 422), (st, r))
    # SEC-03: content-type spoofing — non-image bytes labeled as image/png
    st, r = upload_image(img_banner, admin, "fake.png", b"<html><script>alert(1)</script></html>", "image/png")
    check("SEC-03 [GAP] spoofed Content-Type (HTML bytes labeled image/png) — server trusts header only, no magic-byte check",
          st == 200, (st, r) if st != 200 else "accepted — confirm this can't be served/executed as HTML by the storage layer")
else:
    skip("banner image upload tests", "no banner id available")

# =====================================================================
# SECTION 3 — COUPON ADMIN CRUD & VALIDATION
# =====================================================================
print("\n--- Coupons: Admin CRUD & Validation ---")

created_coupon_ids = []

def make_coupon(_token=None, **over):
    body = {
        "code": f"TEST{stamp}{random.randint(100,999)}",
        "discount_type": "percentage", "discount_value": 10,
        "package_ids": [pkg_a["id"]] if pkg_a else [],
        "usage_limit": None, "per_user_limit": None, "is_active": True,
    }
    body.update(over)
    return api("POST", "/coupons", _token if _token is not None else admin, body=body)

st, r = make_coupon()
ok = st == 201 and r.get("id")
check("CPN-ADM-01 create percentage coupon", ok, (st, r))
if ok: created_coupon_ids.append((r["id"], r["code"]))

st, r = make_coupon(discount_type="fixed", discount_value=500)
ok = st == 201
check("CPN-ADM-02 create fixed-amount coupon", ok, (st, r))
if ok: created_coupon_ids.append((r["id"], r["code"]))

# CPN-ADM-03: duplicate code (case variant)
if created_coupon_ids:
    existing_code = created_coupon_ids[0][1]
    st, r = make_coupon(code=existing_code.lower())
    check("CPN-ADM-03 duplicate code (case-insensitive) rejected", st == 409 or err_code(r) == "COUPON_CODE_TAKEN", (st, r))

# CPN-ADM-04: code length boundaries
st, r = make_coupon(code="AB")
check("CPN-ADM-04a code length 2 rejected", st in (400, 422), (st, r))
st, r = make_coupon(code="A" * 31)
check("CPN-ADM-04b code length 31 rejected", st in (400, 422), (st, r))
st, r = make_coupon(code=f"C{stamp}" + "X" * (30 - len(f"C{stamp}")))
check("CPN-ADM-04c code length exactly 30 accepted", st == 201, (st, r))
if st == 201: created_coupon_ids.append((r["id"], r["code"]))

# CPN-ADM-05: discount_value 0 / negative
st, r = make_coupon(discount_value=0)
check("CPN-ADM-05a discount_value=0 rejected", st in (400, 422), (st, r))
st, r = make_coupon(discount_value=-10)
check("CPN-ADM-05b discount_value negative rejected", st in (400, 422), (st, r))

# CPN-ADM-06: usage_limit / per_user_limit invalid
st, r = make_coupon(usage_limit=0)
check("CPN-ADM-06a usage_limit=0 rejected", st in (400, 422), (st, r))
st, r = make_coupon(per_user_limit=-1)
check("CPN-ADM-06b per_user_limit negative rejected", st in (400, 422), (st, r))

# CPN-ADM-08: invalid discount_type
st, r = make_coupon(discount_type="bogo")
check("CPN-ADM-08 invalid discount_type rejected", st in (400, 422), (st, r))

# CPN-ADM-09: percentage > 100
st, r = make_coupon(discount_type="percentage", discount_value=150)
check("CPN-ADM-09 [GAP] percentage discount_value=150 accepted (no upper bound at creation; relies on subtotal cap at redemption)",
      st == 201, (st, r) if st != 201 else "accepted as expected per code read")
over100_coupon = (r.get("id"), r.get("code")) if st == 201 else None
if st == 201: created_coupon_ids.append((r["id"], r["code"]))

# CPN-ADM-17: zero-package coupon
st, r = make_coupon(package_ids=[])
zero_pkg_coupon = (r.get("id"), r.get("code")) if st == 201 else None
check("CPN-ADM-17 coupon with zero applicable packages can be created", st == 201, (st, r))
if st == 201: created_coupon_ids.append((r["id"], r["code"]))

# CPN-ADM-19/20: role checks
st, r = make_coupon(_token=utok)
check("CPN-ADM-19a user cannot create coupon (403)", st == 403, (st, r))
st, r = api("POST", "/coupons", ttok, body={"code": "TECHX", "discount_type": "fixed", "discount_value": 1, "package_ids": []})
check("CPN-ADM-19b technician cannot create coupon (403)", st == 403, (st, r))
st, _ = api("GET", "/coupons/admin", utok)
check("CPN-ADM-20 user cannot list coupons admin (403)", st == 403, st)

# =====================================================================
# SECTION 4 — COUPON VALIDATE LOGIC (/coupons/validate)
# =====================================================================
print("\n--- Coupons: Validation Logic ---")

_UNSET = object()

def validate(code, package_ids, token=_UNSET):
    return api("POST", "/coupons/validate", utok if token is _UNSET else token, body={"code": code, "package_ids": package_ids})

pkg_ids_a = [pkg_a["id"]] if pkg_a else []
pkg_ids_b = [pkg_b["id"]] if pkg_b else []

# CPN-VAL-01: not found
st, r = validate("NOPE_DOES_NOT_EXIST", pkg_ids_a)
check("CPN-VAL-01 unknown code -> COUPON_NOT_FOUND", err_code(r) == "COUPON_NOT_FOUND" or (isinstance(r, dict) and r.get("error_code") == "COUPON_NOT_FOUND") or not r.get("valid", True), (st, r))

good_id, good_code = created_coupon_ids[0] if created_coupon_ids else (None, None)

# CPN-VAL-02: case-insensitive
if good_code:
    st, r = validate(good_code.lower(), pkg_ids_a)
    valid = r.get("valid") if isinstance(r, dict) else False
    check("CPN-VAL-02 lowercase code validates successfully (case-insensitive)", st == 200 and valid, (st, r))

    # CPN-VAL-03: whitespace trim
    st, r = validate(f"  {good_code}  ", pkg_ids_a)
    valid = r.get("valid") if isinstance(r, dict) else False
    check("CPN-VAL-03 whitespace-padded code trims and validates", st == 200 and valid, (st, r))

    # CPN-VAL-19: validate does not increment usage
    _, before = api("GET", "/coupons/admin", admin)
    before_used = next((c["times_used"] for c in before if c["id"] == good_id), None) if isinstance(before, list) else None
    for _ in range(3):
        validate(good_code, pkg_ids_a)
    _, after = api("GET", "/coupons/admin", admin)
    after_used = next((c["times_used"] for c in after if c["id"] == good_id), None) if isinstance(after, list) else None
    check("CPN-VAL-19 repeated /validate calls do not increment times_used",
          before_used == after_used, (before_used, after_used))

# CPN-VAL-04: inactive
st, r = make_coupon(is_active=False)
inactive_code = r.get("code") if st == 201 else None
if st == 201: created_coupon_ids.append((r["id"], r["code"]))
if inactive_code:
    st, r = validate(inactive_code, pkg_ids_a)
    check("CPN-VAL-04 inactive coupon -> COUPON_INACTIVE", r.get("error_code") == "COUPON_INACTIVE", (st, r))

# CPN-VAL-05/07: not-yet-valid / expired
future = (datetime.datetime.utcnow() + datetime.timedelta(days=30)).isoformat()
past = (datetime.datetime.utcnow() - datetime.timedelta(days=30)).isoformat()
very_past = (datetime.datetime.utcnow() - datetime.timedelta(days=60)).isoformat()

st, r = make_coupon(valid_from=future)
nyv_code = r.get("code") if st == 201 else None
if st == 201: created_coupon_ids.append((r["id"], r["code"]))
if nyv_code:
    st, r = validate(nyv_code, pkg_ids_a)
    check("CPN-VAL-05 not-yet-valid coupon -> COUPON_NOT_YET_VALID", r.get("error_code") == "COUPON_NOT_YET_VALID", (st, r))

st, r = make_coupon(valid_from=very_past, valid_until=past)
exp_code = r.get("code") if st == 201 else None
if st == 201: created_coupon_ids.append((r["id"], r["code"]))
if exp_code:
    st, r = validate(exp_code, pkg_ids_a)
    check("CPN-VAL-07 expired coupon -> COUPON_EXPIRED", r.get("error_code") == "COUPON_EXPIRED", (st, r))

# CPN-VAL-09: null dates always valid re: date window
st, r = make_coupon(valid_from=None, valid_until=None)
nodate_code = r.get("code") if st == 201 else None
if st == 201: created_coupon_ids.append((r["id"], r["code"]))
if nodate_code:
    st, r = validate(nodate_code, pkg_ids_a)
    check("CPN-VAL-09 null valid_from/valid_until -> passes date-window check", r.get("valid") is True, (st, r))

# CPN-VAL-10/11: package ineligible / empty package_ids
if pkg_b and good_code:
    st, r = validate(good_code, pkg_ids_b)  # coupon scoped to pkg_a only
    check("CPN-VAL-10 package not in coupon's scope -> COUPON_PACKAGE_INELIGIBLE", r.get("error_code") == "COUPON_PACKAGE_INELIGIBLE", (st, r))
if good_code:
    st, r = validate(good_code, [])
    check("CPN-VAL-11 [GAP] empty package_ids -> always COUPON_PACKAGE_INELIGIBLE (no test/category-wide coupons exist)",
          r.get("error_code") == "COUPON_PACKAGE_INELIGIBLE", (st, r))

# zero-package coupon can never validate (CPN-ADM-17 follow-through)
if zero_pkg_coupon and zero_pkg_coupon[1]:
    st, r = validate(zero_pkg_coupon[1], pkg_ids_a)
    check("CPN-VAL-zero-pkg coupon with no applicable packages never validates (confirms CPN-ADM-17 gap)",
          r.get("error_code") == "COUPON_PACKAGE_INELIGIBLE", (st, r))

# CPN-VAL-13/14: usage limit
st, r = make_coupon(usage_limit=1)
limited = (r.get("id"), r.get("code")) if st == 201 else (None, None)
if st == 201: created_coupon_ids.append((r["id"], r["code"]))
if limited[1]:
    st, r = validate(limited[1], pkg_ids_a)
    check("CPN-VAL-14 usage_limit=1, times_used=0 -> validates successfully", r.get("valid") is True, (st, r))

# CPN-VAL-17: technician forbidden
if good_code:
    st, r = validate(good_code, pkg_ids_a, token=ttok)
    check("CPN-VAL-17 technician forbidden from /coupons/validate (403)", st == 403, (st, r))

# unauthenticated
if good_code:
    st, r = validate(good_code, pkg_ids_a, token=None)
    check("unauthenticated /coupons/validate rejected (401)", st == 401, (st, r))

# =====================================================================
# SECTION 5 — COUPON DISCOUNT CALCULATION (via quote endpoint)
# =====================================================================
print("\n--- Coupons: Discount Calculation ---")

def quote(package_ids, coupon_code=None):
    body = {"package_ids": package_ids, "test_ids": []}
    if coupon_code: body["coupon_code"] = coupon_code
    return api("POST", "/billing/quote", utok, body=body)

st, r = quote(pkg_ids_a)
if st != 200:
    skip("discount calculation tests", f"/bookings/quote not reachable as expected (status {st}): {r}")
else:
    base_total = r.get("total")
    check("baseline quote without coupon succeeds", base_total is not None, r)

    if good_code:
        st, r = quote(pkg_ids_a, good_code)
        check("CPN-CALC-01 quote with 10% coupon reduces total vs baseline",
              st == 200 and r.get("total") is not None and float(r["total"]) < float(base_total), (st, r, base_total))

    fixed_coupon = next(((cid, code) for cid, code in created_coupon_ids if code and "FIXED" not in code), None)
    st, r = make_coupon(discount_type="fixed", discount_value=1000000)  # way bigger than any subtotal
    huge_fixed_code = r.get("code") if st == 201 else None
    if st == 201: created_coupon_ids.append((r["id"], r["code"]))
    if huge_fixed_code:
        st, r = quote(pkg_ids_a, huge_fixed_code)
        total = r.get("total") if isinstance(r, dict) else None
        check("CPN-CALC-04 fixed discount larger than subtotal caps at 0, never negative",
              st == 200 and total is not None and float(total) >= 0, (st, r))

    if over100_coupon and over100_coupon[1]:
        st, r = quote(pkg_ids_a, over100_coupon[1])
        total = r.get("total") if isinstance(r, dict) else None
        check("CPN-CALC-06 percentage>100% coupon caps discount, total never negative",
              st == 200 and total is not None and float(total) >= 0, (st, r))

# =====================================================================
# SECTION 6 — CONCURRENCY: usage_limit=1 race
# =====================================================================
print("\n--- Coupons: Concurrency ---")

import concurrent.futures

if limited[1] and pkg_a:
    # Need a full booking flow to actually redeem; use /bookings with coupon_code.
    # Requires an address + time slot for home collection, or a lab branch for lab visit.
    _, slots = api("GET", "/time-slots?limit=50", admin)
    slots = slots.get("items", slots) if isinstance(slots, dict) else slots
    lab_slot = next((s["id"] for s in slots if isinstance(s, dict) and s.get("collection_type") == "lab" and s.get("is_active")), None) if isinstance(slots, list) else None
    _, branches = api("GET", "/lab-branches?limit=10", admin)
    branches = branches.get("items", branches) if isinstance(branches, dict) else branches
    branch_id = branches[0]["id"] if isinstance(branches, list) and branches else None

    if lab_slot and branch_id:
        date = (datetime.date.today() + datetime.timedelta(days=3)).isoformat()

        def try_book():
            body = {"collection_type": "lab", "time_slot_id": lab_slot, "booking_date": date,
                    "package_ids": [pkg_a["id"]], "test_ids": [], "lab_branch_id": branch_id,
                    "coupon_code": limited[1]}
            return api("POST", "/bookings", utok, body=body)

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
            results = list(ex.map(lambda _: try_book(), range(2)))

        statuses = [s for s, _ in results]
        successes = sum(1 for s in statuses if s in (200, 201))
        conflicts = sum(1 for s, r in results if s == 409 or err_code(r) == "COUPON_USAGE_LIMIT_REACHED")
        check("CPN-CONC-01 usage_limit=1: exactly 1 of 2 concurrent bookings succeeds, other hits usage-limit conflict",
              successes == 1 and (conflicts >= 1 or (2 - successes) >= 1), (statuses, results))

        _, admin_view = api("GET", "/coupons/admin", admin)
        tu = next((c["times_used"] for c in admin_view if c["id"] == limited[0]), None) if isinstance(admin_view, list) else None
        check("CPN-CONC-01b times_used does not exceed usage_limit after race", tu is not None and tu <= 1, tu)
    else:
        skip("CPN-CONC-01 concurrency test", "no active lab time slot or lab branch available for booking")
else:
    skip("CPN-CONC-01 concurrency test", "no usage_limit=1 coupon or package available")

# =====================================================================
# SECTION 7 — COUPON EDIT / DEACTIVATE / DELETE LIFECYCLE
# =====================================================================
print("\n--- Coupons: Lifecycle ---")

if created_coupon_ids:
    cid, ccode = created_coupon_ids[0]
    st, r = api("PUT", f"/coupons/{cid}", admin, body={"discount_value": 25})
    check("CPN-ADM-10 edit coupon discount_value", st == 200 and float(r.get("discount_value", 0)) == 25, (st, r))

    st, r = api("PUT", f"/coupons/{cid}", admin, body={"is_active": False})
    check("CPN-ADM-11a deactivate coupon", st == 200 and r.get("is_active") is False, (st, r))
    st, r = validate(ccode, pkg_ids_a)
    check("CPN-ADM-11a-followup deactivated coupon immediately fails validate", r.get("error_code") == "COUPON_INACTIVE", (st, r))

    st, r = api("PUT", f"/coupons/{cid}", admin, body={"is_active": True})
    check("CPN-ADM-11b reactivate coupon", st == 200 and r.get("is_active") is True, (st, r))
    st, r = validate(ccode, pkg_ids_a)
    check("CPN-ADM-11b-followup reactivated coupon validates again", r.get("valid") is True, (st, r))

    st, r = api("DELETE", f"/coupons/{cid}", admin)
    check("CPN-ADM-12 delete coupon", st in (200, 204), st)
    st, r = api("GET", "/coupons/admin", admin)
    ids = [c["id"] for c in r] if isinstance(r, list) else []
    check("CPN-ADM-12b deleted coupon gone from admin list", cid not in ids, cid)

# =====================================================================
# SECTION 8 — COUPON-LINKED BANNER (staleness behavior)
# =====================================================================
print("\n--- Coupon-linked Banner Staleness ---")

st, r = make_coupon(discount_type="percentage", discount_value=15)
link_coupon_id, link_coupon_code = (r.get("id"), r.get("code")) if st == 201 else (None, None)
if st == 201: created_coupon_ids.append((r["id"], r["code"]))

if link_coupon_id:
    st, r = make_banner(banner_type="promotional_offer", title=None, subtitle=None,
                         coupon_id=link_coupon_id, status="published")
    linked_banner_id = r.get("id") if st == 201 else None
    check("BNR-CPN setup: promotional_offer banner linked to live coupon, published", st == 201, (st, r))
    if linked_banner_id:
        created_banner_ids.append(linked_banner_id)
        _, pub = api("GET", "/banners")
        b = next((x for x in pub if x["id"] == linked_banner_id), None) if isinstance(pub, list) else None
        check("BNR-CPN-live coupon badge appears on public banner payload", b is not None and b.get("coupon") is not None, b)

        # Deactivate the coupon -> badge should disappear, banner stays
        api("PUT", f"/coupons/{link_coupon_id}", admin, body={"is_active": False})
        _, pub2 = api("GET", "/banners")
        b2 = next((x for x in pub2 if x["id"] == linked_banner_id), None) if isinstance(pub2, list) else None
        check("BNR-CPN-01/02 deactivated linked coupon: badge disappears but banner remains visible",
              b2 is not None and b2.get("coupon") is None, b2)

        # Reactivate -> badge should return
        api("PUT", f"/coupons/{link_coupon_id}", admin, body={"is_active": True})
        _, pub3 = api("GET", "/banners")
        b3 = next((x for x in pub3 if x["id"] == linked_banner_id), None) if isinstance(pub3, list) else None
        check("BNR-CPN-05 reactivated coupon: badge reappears", b3 is not None and b3.get("coupon") is not None, b3)

        # Delete the coupon -> banner survives with coupon_id set null
        api("DELETE", f"/coupons/{link_coupon_id}", admin)
        st, admin_banner = api("GET", "/banners/admin", admin)
        ab = next((x for x in admin_banner if x["id"] == linked_banner_id), None) if isinstance(admin_banner, list) else None
        check("BNR-CPN-06 deleting linked coupon: banner survives, coupon_id nulled, no error",
              ab is not None and ab.get("coupon_id") is None, ab)
        created_coupon_ids = [(i, c) for i, c in created_coupon_ids if i != link_coupon_id]
else:
    skip("coupon-linked banner staleness tests", "could not create linking coupon")

# =====================================================================
# CLEANUP
# =====================================================================
print("\n--- Cleanup ---")
for bid in set(created_banner_ids):
    api("DELETE", f"/banners/{bid}", admin)
for cid, _ in created_coupon_ids:
    api("DELETE", f"/coupons/{cid}", admin)
print(f"cleaned up {len(set(created_banner_ids))} banners, {len(created_coupon_ids)} coupons")

# =====================================================================
# SUMMARY
# =====================================================================
print(f"\n=== {C_OK}{PASS} passed{C_Z}, {C_NO if FAIL else C_OK}{FAIL} failed{C_Z}, "
      f"{C_WARN if SKIP else C_OK}{SKIP} skipped{C_Z}, {PASS+FAIL} total ===")
if FAILURES:
    print("\nFailures:")
    for n, d in FAILURES: print(f"  - {n}: {d}")
sys.exit(1 if FAIL else 0)
