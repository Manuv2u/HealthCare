# Homepage Banners & Coupons — QA Test Plan

## Live execution results (2026-08-07)

This plan has since been executed live against the running app (API-level suite `qa/banners_coupons_test.py`, 85/85 passing; E2E payment/invoice chain `qa/banners_coupons_e2e_payment_test.py`, 12/12 passing) plus a manual admin/homepage UI pass. Backend business logic (role checks, validation, discount math, atomic concurrency guard, full quote→booking→payment→invoice chain) is correct with no failures. Two real, verified bugs and one cosmetic issue were found in the UI/data layer:

1. **[BUG — confirmed live in production data] Admin "No coupon linked" badge conflates "never linked" with "linked but currently inactive/expired/exhausted."** `admin-banners.component.ts` line 393 (`couponBadge()`) checks `b.coupon` (the live-redeemable object) rather than `b.coupon_id` (the raw FK) to decide whether to render "No coupon linked". Since `banner_service.serialize()` nulls `coupon` for *any* non-live coupon regardless of viewer (banner_service.py line 38-45, shared by both the public and admin endpoints), an admin looking at the Homepage Banners list cannot tell "this banner was never linked to a coupon" apart from "this banner is linked to a coupon that has gone inactive." **Found live**: two currently-published homepage banners ("Save ₹100 on Your First Health Package", coupon_id → an inactive coupon; "Welcome Offer: ₹200 Off Health Checkups", coupon_id → a different inactive coupon) both show "No coupon linked" in the admin list, yet their subtitles advertise "Use code HEALTH100" / "Use code WELCOME200" to real site visitors. Confirmed via `POST /coupons/validate` that both codes currently return `COUPON_INACTIVE` — a live, customer-facing broken promotion that the admin UI actively hides rather than surfaces. Fix: the list badge should read `coupon_id` directly (or a dedicated "linked coupon is inactive" state) instead of the live-only `coupon` object.
2. **[BUG — confirmed via code + reproduced live] New banner `display_order` defaults to `banners().length + 1`, not `max(existing display_order) + 1`.** `admin-banners.component.ts` line 414 (`openCreate()`). After any prior banner deletion, this collides with an existing banner's order value. Reproduced in live data: two banners currently share `display_order = 1` (one published, one draft) and no banner holds `display_order = 2` — visible in the admin list as two rows both labeled position "1". Non-blocking today only because the colliding draft banner isn't published yet; publishing it would create an undefined tie-break in the live carousel's slide order.
3. **[Cosmetic]** The banner discount ribbon and admin list render `"10.00% off"` instead of `"10% off"` — `discountLabel()` in `hero-carousel.component.ts` doesn't strip trailing zeros from `discount_value`.

Everything else exercised in this plan (banner CRUD/validation/publish lifecycle, image upload MIME filtering, coupon CRUD/validation/discount math, concurrency guard, role enforcement, coupon-linked-banner staleness on the *public* endpoint, full E2E discount→payment→invoice chain) passed without issue. See the conversation/session notes for the full pass/fail breakdown; the open questions in §16 below remain unresolved product decisions, not bugs.

---

Scope: full-coverage manual test plan for the Homepage Banners feature and the Coupons feature, including Admin CRUD, all banner/coupon configuration options, click-through/navigation, discount computation, and the end-to-end booking → payment → invoice flow. Derived from a full code read of `backend/app/models,services,schemas,api/v1/{banners,coupons}.py` and `frontend/src/app/features/{admin/banners,admin/coupons,home,booking,packages}` as of 2026-08-07.

There is **no existing automated test coverage** for either feature (`backend/tests/` has zero banner/coupon tests) — treat every row below as previously unverified.

---

## 1. Read this first — actual system behavior

Test against what the code does, not generic assumptions about "typical" banner/coupon systems:

| Area | Actual behavior |
|---|---|
| Banner scheduling | **Does not exist.** `start_date`/`end_date` fields were added then removed (migration `0035`). Only `draft`/`published` status gates visibility. Do not test for a date-window scheduler unless product confirms it should exist. |
| Banner ↔ discount | Banners do **not** carry their own discount. A banner may optionally *display* a coupon's badge (`coupon_id` FK), but clicking the banner never auto-applies the coupon — the user must type/select the code at checkout. |
| Banner categories | `packages`, `home_collection`, `corporate`, `health_awareness`, `offers`, `diagnostics` — enforced **only in the Angular dropdown**, not by the DB or Pydantic (`category` is a plain string). Direct API calls can set anything. |
| Banner types | `advertisement` (title + subtitle required) and `promotional_offer` (image-only allowed, no text required). |
| Banner highlights | Fixed 9-item picklist, server-rejects anything outside it. |
| Image validation | MIME-type allowlist only (`image/jpeg`, `png`, `webp`, `gif`) checked via `Content-Type` header. **No file size or dimension limit anywhere** (frontend or backend) — bounded only by reverse-proxy body-size config. |
| Coupon scope | **Package-level only.** No test-only or category-wide coupons. A coupon with an empty package list can never validate successfully (empty intersection). |
| Coupon fields that don't exist | No `min_order_value`, no `max_discount_cap`. Don't write test cases expecting these unless product adds them. |
| Coupon codes | Case-insensitive — normalized to uppercase on both create and lookup. |
| Discount cap | `compute_discount()` always caps at `min(computed_amount, eligible_subtotal)` — a discount can never exceed or zero-out the order in a negative way. |
| Coupon redemption | Quote-time validation (`/coupons/validate`, checkout preview) is **read-only** — never increments usage. Only `BookingService.create_booking()` re-validates from scratch and calls `redeem_atomic()` inside the booking DB transaction. |
| Stale coupon on a banner | If a linked coupon expires/is deactivated/exhausted, the public `GET /banners` response silently drops the `coupon` badge object — but `coupon_id` on the row is untouched, and the banner itself stays valid/visible. |
| Roles | Banner & Coupon admin endpoints: `admin` only. `POST /coupons/validate`: `admin` **or** `user` — technicians are explicitly excluded. Public `GET /banners`: no auth. |

---

## 2. Test environment prerequisites

- Accounts: one `admin`, one `user`, one `technician` (for negative role tests), all with valid JWTs.
- Catalog data: at least 2 active packages, 1 inactive/archived package (for edge cases).
- At least one desktop-size and one mobile-size viewport (or browser devtools emulation) for device-visibility checks.
- A way to call the API directly (curl/Postman) in addition to the Admin UI, since several validations are client-side only and must be probed at the API layer.
- Cashfree sandbox credentials configured (per `docs/payments/cashfree.md`) for the E2E payment section.

---

## 3. Banner Admin — CRUD & Lifecycle

| ID | Type | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| BNR-ADM-01 | Positive | Create `advertisement` banner with all fields | Admin → Banners → New → fill title, subtitle, cta_text/link, cta2_text/link, highlights, category, both images → Save | Banner created as `draft`, appears in admin list, not on public homepage |
| BNR-ADM-02 | Positive | Create `promotional_offer` banner, image-only | New → type=promotional_offer, leave title/subtitle blank, upload image, link a coupon → Save | Saves successfully (no title/subtitle required for this type) |
| BNR-ADM-03 | Negative | Create `advertisement` banner missing title | New → type=advertisement, leave title blank, fill subtitle → Save | Client shows required-field error; if bypassed via API, server returns validation error (schema + service both enforce this) |
| BNR-ADM-04 | Negative | Create `advertisement` banner missing subtitle | Same as above, subtitle blank instead | Same rejection behavior |
| BNR-ADM-05 | Boundary | Title at exactly 200 chars / 201 chars | Submit title of length 200 (should pass), then 201 (should fail) | 200 accepted, 201 rejected with length error |
| BNR-ADM-06 | Boundary | Subtitle at 400/401 chars, cta_text at 80/81, cta_link at 500/501 | Submit each at boundary and boundary+1 | Boundary passes, boundary+1 rejected |
| BNR-ADM-07 | Negative | Highlight value outside the fixed picklist (via direct API) | POST /banners with `highlights: ["not_a_real_highlight"]` | 422/validation error, banner not created |
| BNR-ADM-08 | Edge | Category set to an arbitrary string via direct API (e.g. `"xyz123"`) | POST /banners with `category: "xyz123"` bypassing the UI dropdown | Currently **succeeds** (no server-side enum) — confirm with product whether this is acceptable; document as a gap if not |
| BNR-ADM-09 | Negative | banner_type set to an invalid value via API | POST /banners with `banner_type: "clickbait"` | 422 — pattern `^(advertisement\|promotional_offer)$` rejects it |
| BNR-ADM-10 | Positive | Edit existing banner — change title/subtitle/links/highlights | Edit → change several fields → Save | List and public payload (once published) reflect updated values |
| BNR-ADM-11 | Positive | Publish a draft banner | Draft banner → Publish action | `status` → `published`; now appears on public `GET /banners` and homepage |
| BNR-ADM-12 | Positive | Unpublish a published banner | Published banner → Unpublish | `status` → `draft`; disappears from public homepage immediately, still in admin list |
| BNR-ADM-13 | Positive | Delete a banner (draft) | Delete draft banner → confirm | Hard-deleted from DB; row gone from admin list; associated image best-effort removed from storage |
| BNR-ADM-14 | Positive | Delete a published banner | Delete a currently-live banner → confirm | Immediately removed from public homepage as well as admin list |
| BNR-ADM-15 | Edge | Delete a banner whose image cleanup fails (simulate storage error) | Force a storage failure during delete (or inspect code path) | Deletion still succeeds; failure is swallowed (verify no orphaned DB row, only possible orphaned storage object) |
| BNR-ADM-16 | Positive | Reorder banners via drag-and-drop | Admin list → drag banner from position 3 to position 1 → Save/auto-save | `display_order` values persist; public carousel order matches new order after refresh |
| BNR-ADM-17 | Edge | Reorder with only one banner present | Single banner in list, attempt drag | No-op, no error |
| BNR-ADM-18 | Negative | Reorder payload with a non-existent banner_id (via API) | PUT /banners/reorder with a bogus id mixed into the list | Should not corrupt ordering of valid banners; verify actual error behavior (may 404 or silently skip — confirm and document) |
| BNR-ADM-19 | Positive | Preview a banner before publishing | Create/edit modal → Preview | Renders in `HeroCarouselComponent` with `disableImageFallback=true`; an imageless banner previews blank, not a stock photo (this is intentional — verify it isn't mistaken for a bug) |
| BNR-ADM-20 | Negative | Attempt banner create/edit/delete/publish/reorder as `user` role | Call each admin endpoint with a `user` JWT | 403 Forbidden on every endpoint |
| BNR-ADM-21 | Negative | Attempt banner create/edit/delete/publish/reorder as `technician` role | Same, with `technician` JWT | 403 Forbidden on every endpoint |
| BNR-ADM-22 | Negative | Navigate directly to `/admin/banners` URL as `user` | Log in as user, paste `/admin/banners` in address bar | Redirected to the user's own home route, not shown a raw error page |
| BNR-ADM-23 | Negative | Access `/admin/banners` unauthenticated | Log out, navigate to `/admin/banners` | Redirected to login |

---

## 4. Banner Image Upload

| ID | Type | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| BNR-IMG-01 | Positive | Upload valid JPEG for desktop variant | Upload `.jpg` under `variant=desktop` | Accepted, `desktop_image_key` updated, signed URL renders correctly on homepage desktop view |
| BNR-IMG-02 | Positive | Upload valid PNG/WebP/GIF | Repeat for each allowed MIME type | All accepted |
| BNR-IMG-03 | Negative | Upload disallowed file type (e.g. `.pdf`, `.svg`, `.bmp`) | Upload non-image or unsupported image type | Rejected by server (`_ALLOWED_IMAGE_TYPES` check) |
| BNR-IMG-04 | Negative | Spoofed Content-Type (upload a `.exe` renamed with `Content-Type: image/png`) | Craft request directly via API with mismatched actual bytes vs header | Currently only the header is checked — **will likely be accepted**; flag as a security gap (content-type spoofing bypasses the filter) since there's no magic-byte sniffing |
| BNR-IMG-05 | Edge | Upload extremely large image (e.g. 50MB+) | Upload oversized file for desktop and mobile variant | No app-level limit exists; behavior is whatever the reverse proxy/body-size config allows — verify it fails gracefully (e.g. 413) rather than hanging/crashing the service |
| BNR-IMG-06 | Positive | Replace an existing image | Edit banner, upload a new desktop image over an existing one | Old image key is deleted (best-effort) after new key saved; homepage shows new image, no flash of broken image |
| BNR-IMG-07 | Edge | Old image deletion fails during replace (simulate) | Force storage delete failure during replace | New image still serves correctly even if old cleanup fails silently |
| BNR-IMG-08 | Positive | Upload desktop image only, leave mobile blank | Create banner with only `desktop_image_key` set | On mobile viewport, verify fallback behavior (stock photo fallback per category, since `disableImageFallback` only applies to admin preview) |
| BNR-IMG-09 | Positive | Upload mobile image only, leave desktop blank | Inverse of above | Desktop viewport shows fallback stock image for the banner's category |
| BNR-IMG-10 | Edge | No image uploaded at all, banner published | Publish a banner with neither image set | Homepage shows category-keyed stock fallback image on both desktop and mobile |

---

## 5. Banner Navigation / CTA Actions

| ID | Type | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| BNR-NAV-01 | Positive | Internal relative link (e.g. `/packages`) | Set `cta_link=/packages`, publish, click banner on homepage | `router.navigateByUrl('/packages')` — SPA navigation, no full page reload |
| BNR-NAV-02 | Positive | External absolute link (`https://...`) | Set `cta_link=https://example.com`, click | Opens in new tab via `window.open(link, '_blank', 'noopener')`; homepage tab remains open and unaffected |
| BNR-NAV-03 | Positive | Package-linked CTA via the "pick a package" dropdown | In admin modal, select a package from the linker dropdown | `cta_link` auto-populates as `/booking?package_id=<id>`; clicking the banner lands directly on that package's booking flow |
| BNR-NAV-04 | Boundary | `http://` (non-https) external link | Set `cta_link=http://example.com` | Still matches the `^https?://` pattern — opens externally, same as https |
| BNR-NAV-05 | Negative | Malformed/garbage link (no validation exists on `cta_link` format) | Set `cta_link` to something like `not a url` or `javascript:alert(1)` | No server-side URL-format validation exists — verify the frontend `go()` function's regex doesn't match `^https?://` so it falls through to internal `navigateByUrl`, and specifically confirm a `javascript:` URI **cannot execute** (Angular's router should treat it as an invalid route, but explicitly test this as an XSS-adjacent concern) |
| BNR-NAV-06 | Edge | Empty/blank `cta_link` with CTA text set | Set `cta_text="Learn more"`, leave `cta_link` blank, publish | Verify click behavior doesn't throw a JS error (e.g. `navigateByUrl(undefined)`) |
| BNR-NAV-07 | Positive | Secondary CTA (`cta2_text`/`cta2_link`) independent of primary | Set both CTA1 and CTA2 to different targets | Each button navigates independently to its own target |
| BNR-NAV-08 | Positive | Category-mapped banner (`category=diagnostics`) linking to a filtered listing | Set `cta_link=/packages?category=diagnostics` (or however category filtering is implemented) | Lands on packages list pre-filtered to that category — verify actual query-param contract used by the packages list page |
| BNR-NAV-09 | Edge | Link to an inactive/archived package | `cta_link=/booking?package_id=<archived_package_id>` | Verify booking page shows a sensible "unavailable" state rather than a crash or ability to book a delisted package |
| BNR-NAV-10 | Edge | Link to a non-existent package_id | `cta_link=/booking?package_id=00000000-0000-0000-0000-000000000000` | Booking page handles gracefully (not-found state), no unhandled exception |

---

## 6. Banner Display & Visibility

| ID | Type | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| BNR-DISP-01 | Positive | Only `published` banners appear publicly | Have a mix of draft + published banners | `GET /banners` (public) returns only published ones, ordered by `display_order`; draft ones only visible via `GET /banners/admin` |
| BNR-DISP-02 | Positive | Carousel ordering matches `display_order` | Set explicit order via reorder, reload homepage | Carousel slide order matches exactly |
| BNR-DISP-03 | Positive | Desktop viewport shows desktop image | Load homepage at desktop width | `desktop_image_key`'s signed URL is used |
| BNR-DISP-04 | Positive | Mobile viewport shows mobile image | Load homepage at mobile width (or resize/emulate) | `mobile_image_key`'s signed URL is used, distinct from desktop if both set |
| BNR-DISP-05 | Positive | Autoplay behavior | Load homepage with 2+ published banners, wait | Carousel auto-advances every 2s per slide |
| BNR-DISP-06 | Positive | Pause on hover | Hover over carousel | Autoplay pauses while hovered, resumes after mouse leaves |
| BNR-DISP-07 | Positive | Manual swipe (touch) navigation | On a touch device/emulator, swipe left/right | Slide changes accordingly, autoplay timer resets |
| BNR-DISP-08 | Positive | Keyboard arrow navigation | Focus carousel, press Left/Right arrow keys | Slide changes; verify focus outline/ARIA `aria-live` region updates for accessibility |
| BNR-DISP-09 | Positive | Infinite loop wraparound | Advance past the last slide | Wraps back to the first slide seamlessly, no blank frame |
| BNR-DISP-10 | Edge | Exactly one published banner | Only one published banner exists | Carousel renders single slide, no autoplay/arrow controls needed (or they no-op gracefully) — verify no crash from a 1-item loop |
| BNR-DISP-11 | Edge | Zero published banners | Unpublish/delete all banners | Homepage hero section handles empty state gracefully (no crash, sensible empty/hidden state) |
| BNR-DISP-12 | Positive | Discount ribbon renders for coupon-linked banner | Banner has a valid, currently-redeemable linked coupon | "₹X OFF" or "X% OFF" ribbon displays correctly per `discountLabel()` logic, matching the coupon's actual discount_type/value |
| BNR-DISP-13 | Edge | Discount ribbon absent when no coupon linked | Banner has `coupon_id=null` | No ribbon rendered, no layout gap/glitch |

---

## 7. Coupon-Linked Banner Staleness (important, non-obvious behavior)

| ID | Type | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| BNR-CPN-01 | Edge | Linked coupon expires while banner stays published | Link coupon with `valid_until` in the near future; wait for it to pass (or backdate it via admin edit) | Public banner payload's `coupon` field becomes null; ribbon disappears from the homepage; banner itself (image/CTA) remains fully functional |
| BNR-CPN-02 | Edge | Linked coupon is deactivated (`is_active=false`) | Deactivate the linked coupon in Coupons admin | Same as above — ribbon disappears, banner unaffected |
| BNR-CPN-03 | Edge | Linked coupon exhausts its usage limit | Drive `times_used` to `usage_limit` via real bookings (or DB) | Ribbon disappears once the coupon is no longer "live", even though `coupon_id` still points at it |
| BNR-CPN-04 | Edge | Admin edit view for a banner with a stale coupon link | Open the banner in the admin edit modal after its coupon expired | Verify whether the admin UI still shows the stale coupon selected (it should, since `coupon_id` is untouched) — confirm this doesn't mislead admins into thinking the promo is still live |
| BNR-CPN-05 | Positive | Reactivating the coupon restores the ribbon | Re-activate/extend the previously-stale coupon | Ribbon reappears on next homepage load, no banner edit needed |
| BNR-CPN-06 | Positive | Deleting a linked coupon | Delete the coupon referenced by a banner's `coupon_id` | FK is `ON DELETE SET NULL` — banner row survives with `coupon_id=null`; ribbon disappears; banner does not error out |
| BNR-CPN-07 | Behavioral (document, don't "fix") | Clicking a coupon-badged banner does not auto-apply the code | Click a banner showing "20% OFF" | User lands on the linked package/booking page but must still manually type/select the coupon code at checkout — confirm this matches product's intended UX (it's an explicit design choice per code comments, not a bug) |

---

## 8. Coupon Admin — CRUD & Lifecycle

| ID | Type | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| CPN-ADM-01 | Positive | Create percentage coupon with all fields | New coupon: code, type=percentage, value=20, valid_from/until, usage_limit, per_user_limit, applicable packages checked | Created, appears in list with correct discount summary badge |
| CPN-ADM-02 | Positive | Create fixed-amount coupon | type=fixed, value=500 | Created correctly |
| CPN-ADM-03 | Negative | Duplicate coupon code | Create a coupon with a code that already exists (case-different, e.g. existing `SAVE20`, new `save20`) | Rejected with `COUPON_CODE_TAKEN` — codes are uppercased before the uniqueness check, so case variants correctly collide |
| CPN-ADM-04 | Boundary | Code length 2 / 3 / 30 / 31 chars | Submit codes at each boundary | 2 chars rejected (`min_length=3`), 3 accepted, 30 accepted, 31 rejected (`max_length=30`) |
| CPN-ADM-05 | Negative | discount_value = 0 or negative | Submit `discount_value=0`, then `-10` | Both rejected (`gt=0` constraint) |
| CPN-ADM-06 | Negative | usage_limit / per_user_limit = 0 or negative | Submit each as `0` and `-1` | Rejected (`gt=0` when provided) |
| CPN-ADM-07 | Positive | usage_limit / per_user_limit left blank | Leave both null | Treated as unlimited — verify no cap is enforced during validation/booking |
| CPN-ADM-08 | Negative | discount_type set to invalid value via API | POST with `discount_type: "buy_one_get_one"` | 422 — pattern only allows `percentage`/`fixed` |
| CPN-ADM-09 | Edge | Percentage discount_value > 100 (e.g. 150) | Create coupon with `discount_type=percentage, value=150` | No explicit upper-bound validation found in schema — verify actual behavior; if accepted, confirm `compute_discount()`'s cap at `eligible_subtotal` still prevents an over-100% discount from producing a negative or absurd total |
| CPN-ADM-10 | Positive | Edit coupon — change value/dates/limits/applicable packages | Edit existing coupon, save changes | Updates persist; already-used history (past `BookingAdjustment` rows) unaffected |
| CPN-ADM-11 | Positive | Deactivate / Reactivate toggle | Toggle `is_active` off then on | Immediately blocks/unblocks new validations; doesn't affect coupons already redeemed on existing bookings |
| CPN-ADM-12 | Positive | Delete an unused coupon | Delete a coupon with `times_used=0` | Removed from list and DB |
| CPN-ADM-13 | Edge | Delete a coupon that has already been used on bookings | Delete a coupon with `times_used > 0` | Deletion succeeds (no FK block); existing `BookingAdjustment.coupon_id` set to null via `ON DELETE SET NULL`; past invoices for those bookings still display the correct historical discount label/amount |
| CPN-ADM-14 | Positive | "Expired" badge in admin list | View a coupon whose `valid_until` has passed | List UI shows an `Expired` badge (`isExpired()`), distinguishable from `is_active=false` |
| CPN-ADM-15 | Positive | Usage count display | View a coupon partially used | Shows `times_used / usage_limit` accurately, updates after each real booking redemption |
| CPN-ADM-16 | Positive | Applicable-packages checklist | Create/edit coupon, check 2 of N packages | Only those packages are eligible; verify `coupon_packages` join rows match exactly the checked set (no stale extra rows on edit) |
| CPN-ADM-17 | Edge | Coupon created with zero packages checked | Save with no applicable packages selected | Per code, this coupon can **never** validate successfully (`eligible_ids` empty → always `COUPON_PACKAGE_INELIGIBLE`) — verify the admin UI warns about this or at least that it's a known, reproducible dead-end rather than silent breakage |
| CPN-ADM-18 | Negative | Datetime handling for valid_from/valid_until across IST/UTC | Set a validity window near a day boundary in IST, verify stored/retrieved correctly | Confirms `ist.util.ts` conversion round-trips correctly (regression risk area per prior IST timezone bug fix in this repo) |
| CPN-ADM-19 | Negative | Non-admin attempts coupon CRUD | Call create/update/delete/list-admin with `user` and `technician` JWTs | 403 on all, for both roles |
| CPN-ADM-20 | Negative | Direct navigation to `/admin/coupons` as non-admin | As `user`, paste URL directly | Redirected to user's own home route |

---

## 9. Coupon Validation Logic (`POST /coupons/validate`)

Each row is an independent negative path through `CouponService.validate()`'s ordered checks — verify both the error code returned and that checkout UI surfaces a clear message for it.

| ID | Type | Scenario | Setup | Expected `error_code` / Result |
|---|---|---|---|---|
| CPN-VAL-01 | Negative | Unknown code | Submit a code that doesn't exist | `COUPON_NOT_FOUND` |
| CPN-VAL-02 | Positive | Case-insensitive match | Coupon stored as `SAVE20`, submit `save20` or `SaVe20` | Validates successfully — codes normalized to uppercase both sides |
| CPN-VAL-03 | Boundary | Leading/trailing whitespace in submitted code | Submit `" SAVE20 "` | Trimmed via `.strip()` before lookup — validates successfully |
| CPN-VAL-04 | Negative | Inactive coupon | `is_active=false` | `COUPON_INACTIVE` |
| CPN-VAL-05 | Negative | Not yet valid | `valid_from` in the future | `COUPON_NOT_YET_VALID` |
| CPN-VAL-06 | Boundary | Validate exactly at `valid_from` timestamp | Attempt right at/just after the boundary instant | Validates successfully once `now >= valid_from` |
| CPN-VAL-07 | Negative | Expired | `valid_until` in the past | `COUPON_EXPIRED` |
| CPN-VAL-08 | Boundary | Validate exactly at `valid_until` timestamp | Attempt right at/just after the boundary instant | Confirm exact inclusive/exclusive behavior of `valid_until < now` check — should still be valid at the exact instant, expired just after |
| CPN-VAL-09 | Edge | Both `valid_from` and `valid_until` left null | Coupon with no date restrictions | Always valid on the date-window check regardless of current date |
| CPN-VAL-10 | Negative | Package ineligible | Submit `package_ids` that don't intersect the coupon's applicable packages | `COUPON_PACKAGE_INELIGIBLE` |
| CPN-VAL-11 | Edge | Empty `package_ids` submitted (e.g. a test-only cart) | Submit `package_ids: []` against any coupon | Always `COUPON_PACKAGE_INELIGIBLE` — confirm with product this is intended (coupons cannot currently apply to test-only bookings) |
| CPN-VAL-12 | Positive | Package eligible (partial match) | Cart has 2 packages, coupon applies to 1 of them | Validates successfully; discount computed only against the eligible package's amount, not the full cart |
| CPN-VAL-13 | Negative | Global usage limit reached | `times_used >= usage_limit` | `COUPON_USAGE_LIMIT_REACHED` |
| CPN-VAL-14 | Boundary | `times_used == usage_limit - 1` | One redemption remaining | Validates successfully; the next real redemption should then hit the limit |
| CPN-VAL-15 | Negative | Per-user limit reached | Same user has already redeemed this coupon `per_user_limit` times via non-cancelled bookings | `COUPON_PER_USER_LIMIT_REACHED` |
| CPN-VAL-16 | Edge | Per-user limit not counted against cancelled bookings | User has a cancelled booking that used this coupon, at the per-user limit | Cancelled usage should **not** count — verify `count_uses_by_user()` correctly excludes cancelled bookings, allowing a fresh redemption |
| CPN-VAL-17 | Negative | Technician role calls `/coupons/validate` | Call with a `technician` JWT | 403 — only `admin`/`user` roles permitted |
| CPN-VAL-18 | Positive | Unauthenticated quote preview still blocked appropriately | Call `/coupons/validate` with no auth token | Confirm actual behavior — likely 401, since the route requires `require_roles("admin","user")` |
| CPN-VAL-19 | Edge | Validate does not increment usage | Call `/coupons/validate` repeatedly without booking | `times_used` in admin list stays unchanged after any number of validate-only calls |
| CPN-VAL-20 | Negative | SQL/format-breaking characters in code field | Submit code containing quotes, unicode, extremely long string beyond 30 chars | Handled safely (parameterized queries) — no 500 error, appropriate 404/422 |

---

## 10. Coupon Discount Calculation

| ID | Type | Scenario | Setup | Expected Result |
|---|---|---|---|---|
| CPN-CALC-01 | Positive | Percentage discount on eligible subtotal | Eligible subtotal ₹2000, coupon 10% | Discount = ₹200 |
| CPN-CALC-02 | Positive | Fixed discount less than subtotal | Eligible subtotal ₹2000, coupon fixed ₹500 | Discount = ₹500, net = ₹1500 |
| CPN-CALC-03 | Boundary | Fixed discount exactly equal to subtotal | Subtotal ₹500, coupon fixed ₹500 | Net total = ₹0 (or minimum payable floor if one exists — verify) |
| CPN-CALC-04 | Edge | Fixed discount greater than subtotal | Subtotal ₹300, coupon fixed ₹500 | Discount capped at ₹300 (per `min(amount, eligible_subtotal)`), net total = ₹0, never negative |
| CPN-CALC-05 | Edge | Percentage discount at 100% | Coupon `percentage`, value=100 | Discount = full eligible subtotal, net = ₹0 |
| CPN-CALC-06 | Edge | Percentage discount above 100% (if CPN-ADM-09 allowed creation) | Coupon `percentage`, value=150 | Still capped at eligible subtotal — confirm no negative total is produced |
| CPN-CALC-07 | Positive | Discount applies only to eligible packages in a mixed cart | Cart = Package A (eligible, ₹1000) + Package B (not eligible, ₹800) | Discount computed against ₹1000 only; Package B charged in full |
| CPN-CALC-08 | Positive | Quote reflects discount before booking commitment | Apply coupon at quote step | `compute_totals()` shows a `{"kind":"discount","label":"Coupon <CODE>"}` line item with correct amount, without redeeming |
| CPN-CALC-09 | Edge | Quote-time validation vs booking-time re-validation diverge | Apply coupon at quote time; before completing booking, admin deactivates the coupon or exhausts its limit elsewhere | Booking creation re-validates independently and must reject with the appropriate error (e.g. `409 COUPON_USAGE_LIMIT_REACHED`), rolling back the whole booking — the stale quote must not be trusted |
| CPN-CALC-10 | Positive | Remove applied coupon before booking | Apply coupon, then remove it in the UI | Totals re-quote without the discount; no phantom adjustment persists |
| CPN-CALC-11 | Boundary | Rounding behavior on percentage discount producing fractional currency | Subtotal ₹333, coupon 10% (=₹33.3) | Verify rounding rule (nearest paisa/rupee) is consistent between quote, booking, payment amount, and invoice — a mismatch anywhere in this chain is a high-severity bug |

---

## 11. Concurrency / Race Conditions

| ID | Type | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| CPN-CONC-01 | Edge | Two simultaneous bookings against a `usage_limit=1` coupon | Fire two booking-creation requests for the same coupon at effectively the same time (different users or same user with `per_user_limit` allowing it) | Exactly one succeeds and redeems the coupon; the other receives `409 COUPON_USAGE_LIMIT_REACHED` and its entire booking rolls back — verify via `increment_usage_atomic()`'s atomic `UPDATE ... RETURNING` guard, no double-redemption, no `times_used` overshoot |
| CPN-CONC-02 | Edge | N simultaneous bookings against `usage_limit=N-1` | Fire N concurrent requests where only N-1 slots remain | Exactly N-1 succeed, 1 fails cleanly with no partial/corrupt booking rows left behind |
| CPN-CONC-03 | Edge | Concurrent bookings hitting `per_user_limit` for the same user | Same user fires 2 simultaneous booking requests against a coupon with `per_user_limit=1` | Only one succeeds; confirm the per-user check is also race-safe (this one relies on counting existing `BookingAdjustment` rows — verify it's inside the same transaction or otherwise race-safe, since it's a separate mechanism from the atomic global-limit guard) |

---

## 12. Roles & Permissions Matrix

Run every endpoint below against all three roles (`admin`, `user`, `technician`) plus unauthenticated, and confirm actual vs. expected:

| Endpoint | admin | user | technician | unauthenticated |
|---|---|---|---|---|
| `GET /banners` (public) | 200 | 200 | 200 | 200 |
| `GET /banners/admin` | 200 | 403 | 403 | 401 |
| `POST /banners` | 200 | 403 | 403 | 401 |
| `PUT /banners/{id}` | 200 | 403 | 403 | 401 |
| `PUT /banners/reorder` | 200 | 403 | 403 | 401 |
| `DELETE /banners/{id}` | 200 | 403 | 403 | 401 |
| `POST /banners/{id}/image` | 200 | 403 | 403 | 401 |
| `GET /coupons/admin` | 200 | 403 | 403 | 401 |
| `POST /coupons` | 200 | 403 | 403 | 401 |
| `PUT /coupons/{id}` | 200 | 403 | 403 | 401 |
| `DELETE /coupons/{id}` | 200 | 403 | 403 | 401 |
| `POST /coupons/validate` | 200 | 200 | **403** | 401 |
| Frontend `/admin/banners` route | loads | redirect to user home | redirect to own home | redirect to login |
| Frontend `/admin/coupons` route | loads | redirect to user home | redirect to own home | redirect to login |

Confirm the technician-excluded row (`/coupons/validate`) specifically — it's the one asymmetric case and easy to regress if roles are ever refactored.

---

## 13. End-to-End: Banner → Package → Coupon → Booking → Payment → Invoice

| ID | Type | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| E2E-01 | Positive | Full happy path | 1) Admin creates a package-linked `promotional_offer` banner with a linked, valid, package-scoped coupon. 2) Publish. 3) As a user, view homepage, see banner with correct discount ribbon. 4) Click banner → land on the linked package's booking page. 5) Proceed through booking steps. 6) At payment step, see the suggested coupon chip, apply it. 7) Confirm discount reflected in totals. 8) Complete booking. 9) Pay via Cashfree sandbox. 10) View generated invoice. | Every step succeeds; invoice shows the correct discount line item (`"Coupon <CODE>"`), correct net total, and the amount actually charged via Cashfree matches the post-discount total exactly |
| E2E-02 | Positive | Suggested-coupon chip flow | On the package/checkout page, use `eligible_coupon` suggestion chip instead of typing the code | Clicking the chip fills the code field and applies it (still an explicit user action, not auto-applied on page load) |
| E2E-03 | Negative | Coupon becomes invalid between quote and booking | Apply coupon at quote step; in another session, admin exhausts/deactivates it; complete the booking attempt | Booking creation fails with the correct error, entire booking rolls back (no partial booking, no payment attempt initiated), user sees a clear error and can retry without the coupon |
| E2E-04 | Positive | Payment amount matches redeemed discount | After successful coupon redemption at booking time, inspect the amount sent to Cashfree | Matches `BillingService.booking_totals()` computed from the persisted `BookingAdjustment`, not any client-supplied figure |
| E2E-05 | Positive | Invoice reflects discount after payment completes | Complete payment, fetch/download invoice (PDF and/or JSON) | Discount line item, original subtotal, and net total are all correct and consistent with what was charged |
| E2E-06 | Edge | Booking cancelled after payment — coupon usage reconciliation | Cancel a booking that used a coupon | Verify whether `times_used`/per-user usage is decremented/released on cancellation, or intentionally retained — confirm actual behavior against product expectation (code shows per-user counting excludes cancelled bookings for *future* validation, but global `times_used` decrement behavior on cancellation should be explicitly checked) |
| E2E-07 | Edge | Delete the coupon after E2E-01's booking is complete | Admin deletes the now-used coupon | Past invoice for that booking is unaffected and still displays the historical discount correctly (FK `ON DELETE SET NULL` on `BookingAdjustment.coupon_id`) |
| E2E-08 | Positive | Banner → non-package internal link (e.g. `/packages?category=diagnostics`) → browse → book without any coupon | Full flow with no coupon involved | Confirms banners work standalone as pure navigational/marketing tools, independent of the coupon system |
| E2E-09 | Positive | External-link banner does not interfere with checkout of an unrelated package | Click an external-link banner (opens new tab), return to original tab, proceed to book any package normally | No state corruption from the external navigation |
| E2E-10 | Edge | Mixed cart: one coupon-eligible package + one ineligible package, through full checkout to invoice | Book both packages together with the coupon applied | Invoice correctly itemizes discount against only the eligible package; ineligible package appears at full price |

---

## 14. Security / API-Level Bypass Checks

Since several validations (banner category, cta_link format, image content-type sniffing) exist only in the Angular client, verify server behavior by calling the API directly, bypassing the UI:

| ID | Scenario | Expected server-side behavior |
|---|---|---|
| SEC-01 | POST /banners with `category` outside the known list | Currently accepted (no server constraint) — decide with product if this needs a fix; regardless, confirm it doesn't crash the public homepage renderer when an unrecognized category is encountered (e.g. stock-image fallback lookup by category) |
| SEC-02 | POST /banners with a `javascript:` or `data:` URI in `cta_link` | Confirm the Angular router cannot be coerced into executing it; treat any successful script execution as a critical finding |
| SEC-03 | POST /banners/{id}/image with mismatched Content-Type vs actual file bytes | Confirm whether this is exploitable (e.g. upload an HTML file labeled as `image/png` and see if it's ever served in a way a browser would execute it) |
| SEC-04 | Direct POST /coupons/validate replay after coupon deactivated mid-checkout-session | Confirm no stale client-side "applied" state lets a booking proceed with a discount that server-side re-validation would reject |
| SEC-05 | Attempt banner/coupon admin mutations with an expired/tampered JWT | 401, not 500 or silent success |
| SEC-06 | IDOR check: reference another tenant/user's booking or package id in `cta_link`/`package_ids` where access should be scoped | Confirm no cross-user data leakage through banner deep-links or coupon package_ids |

---

## 15. Regression Watch List (previously removed features)

These existed in the schema history and were deliberately removed — any reappearance or partial reintroduction is a regression signal, not a feature to test positively for:

- `Banner.is_active` (removed, migration `0032`) — superseded by `status`. If any code path still references `is_active` on banners, that's a bug.
- `Banner.start_date` / `end_date` scheduling (removed, migration `0035`) — no scheduling exists today.
- `Banner.discount_type` / `discount_value` (removed, migration `0035`, replaced by the independent Coupon model) — banners must never again carry their own discount fields; all discount logic must route through Coupon.

---

## 16. Open Questions for Product (resolve before finalizing test pass/fail criteria)

1. Is banner scheduling (auto publish/unpublish on a date window) actually expected? It doesn't exist today.
2. Should coupons support test-only bookings and/or category-wide scope, or is package-only intentional?
3. Should `min_order_value` / `max_discount_cap` be added, or is uncapped-by-order-value intentional?
4. Should `Banner.category` be server-validated against the fixed list (currently client-only)?
5. Is percentage `discount_value > 100` intended to be blocked at creation time, or is relying on the subtotal-cap at redemption time sufficient?
6. On booking cancellation, should global coupon `times_used` be decremented/released back to the pool?
