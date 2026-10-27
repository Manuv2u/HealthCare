# Metropolis Healthcare catalog research — gap log

Research date: 2026-07-03. Source: https://www.metropolisindia.com (only).

## Critical infrastructure issue encountered

`www.metropolisindia.com` exhibited **unreliable, non-deterministic routing/redirect
behaviour** throughout this session. Requests to the same or similar URLs sometimes
returned genuine Metropolis Healthcare content and sometimes silently redirected to
completely unrelated third-party diagnostics sites, e.g.:

- `https://www.neubergdiagnostics.com/contact-us`
- `https://www.lalpathlabs.com/doctors`
- `https://www.thyrocare.com/...` (multiple `Aarogyam` package pages, incrementing
  each time — looked like a rotating ad/pop-under redirect)
- `https://www.indiapost.gov.in/` (completely unrelated government site)
- A guessed URL `/sitemap.html` returned a full alternate site (thyrocare.com) instead
  of a 404.
- A guessed URL `/test-directory` silently 200'd back to the homepage rather than a
  real test-directory listing.
- Same-origin `fetch()` calls made from within a loaded metropolisindia.com page also
  returned totally unrelated content (once returned a Dr Lal PathLabs page body with a
  metropolisindia.com URL).

**Handling:** every extraction in this task was done by (a) navigating directly to a
URL that was copied verbatim from a link already present in confirmed-genuine
metropolisindia.com page content (never a guessed path), and (b) checking
`location.href` still contained `metropolisindia.com` at the moment of data
extraction, discarding the result if not. Any page load that landed on a different
domain was treated as inaccessible and not used as a data source. This means some
real Metropolis pages were likely skipped simply because the redirect fired before
data could be captured — see specific gaps below.

## Pages / sections that could not be reliably accessed

1. **`/health-conditions/*` category pages** (Diabetes, Cancer, Pregnancy, STD, Vitamins,
   Anemia, Allergy, Arthritis, Alcoholism, Fever, Hepatitis, Hormones, Hypertension,
   Obesity) — 14 pages total. Every attempted navigation to these paths redirected to
   `thyrocare.com` (Aarogyam package pages) within the same request/evaluation cycle,
   even though the initial page title briefly confirmed genuine Metropolis content.
   Not one of these pages could be captured. This is likely where a further batch of
   categorized individual tests (e.g. HbA1c/diabetes-specific panels, cancer markers,
   STD panels, prenatal screens) would have been listed, similar to the `/health-risks/*`
   pages that did work. **Gap: full test list for these 14 condition categories is
   missing.**

2. **`/sitemap.html`** — intended to be used for a comprehensive URL inventory; instead
   returned an entirely different company's site content. No sitemap-based enumeration
   of test/package URLs was possible; discovery relied instead on links actually present
   in the DOM of pages that were confirmed genuine (homepage, category pages).

3. **Individual `/parameter/<slug>` pages beyond the ~24 actually visited.** The
   homepage's SEO footer block links to roughly 50 individual test pages by name+URL
   only (no price shown on that listing page itself). A representative sample of these
   was visited directly (CBC, Thyroid Profile, KFT, ECG, Testosterone Profile — prices
   and descriptions captured successfully), but visiting the remaining ~35 one-by-one
   was not completed because each navigation carried real risk of the auto-redirect
   firing before data could be extracted, and doing so for all ~50 would have required
   very many browser round-trips. These ~35 tests are included in
   `catalog_metropolis_tests.json` with **name and URL only — price and description
   left blank** per the task's instruction to leave fields blank rather than guess.

4. **`Package Included` tab / granular per-test breakdown for health packages.**
   Package pages (e.g. `/health-packages/truhealth-vital`) show a category-level
   breakdown (e.g. "Kidney (29 Parameters)", "Heart (9 Parameters)") but clicking the
   "Package Included" tab did not reveal a further list of individual test names — the
   site does not appear to expose that level of detail without an interactive
   drill-down (possibly requiring hover/expand actions not exercised here, or requiring
   a pincode/location selection). Only **1 of 45** TruHealth package pages
   (`truhealth-vital`) was visited for this category breakdown; the other 44 packages'
   `included_tests` field is left as an empty list. Their name, price (selling price and
   MRP where shown), and parameter/profile counts came from the package cards on the
   homepage, which is a reliable, genuinely-fetched source.

5. **"More Related Packages" sidebar items** (TruHealth Plus, Youth, Master, Senior,
   Senior Women, Senior Couple ×2, Smart, Total, Women — 10 items) were seen with name
   and price only on the `truhealth-vital` package page sidebar; their own product page
   URLs were not captured (they appear to belong to a different/older TruHealth naming
   series than the 45 packages found via the homepage cards), so no description or
   included-tests data is available for them.

6. **Location/pincode-dependent pricing.** Prices displayed default to a "Mumbai"
   location context (visible in the site header) without any pincode being entered.
   The task rules class pincode-gated content as inaccessible; here pricing was shown
   without requiring pincode entry, so it was captured, but it should be treated as
   **Mumbai-specific indicative pricing** — Metropolis states prices vary by city.

7. **One item lost to a regex-extraction miss:** the Thyroid Tests category page states
   "Tests: 10" but only 9 test cards matched the extraction pattern used (likely a
   10th item with slightly different formatting, e.g. missing "Add to Cart" or
   different parameter phrasing). Not recovered.

## Data quality notes (not gaps, but relevant caveats)

- No login, CAPTCHA, or pincode entry was required to view the pages that *did* load
  successfully — the only barrier encountered was the redirect/routing issue above.
- All prices captured are as literally displayed on the site (`Cost` field on test
  detail pages, or `₹` figures on category/homepage listing cards) at time of research.
- Categories in `catalog_metropolis_tests.json` are the site's own labels, taken from
  the `/health-risks/<category>` page titles ("Heart Tests", "Liver Tests", "Kidney
  Tests", "Thyroid Tests", "Bone and Joint Tests"). Where a test was only seen on the
  homepage's unlabeled "Popular Tests" carousel, category was left blank per
  instructions.
- Duplicate test names appearing on multiple pages (e.g. Lipid Profile Mini, Kidney
  Function Test/KFT, Thyroid Profile-1, TSH Ultrasensitive, Liver Function Test-1 Maxi)
  were merged into a single record with a `note` field documenting the cross-reference,
  per the "avoid duplicate entries" instruction.
