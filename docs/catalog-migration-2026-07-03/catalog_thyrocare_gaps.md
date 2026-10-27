# Thyrocare Catalog Research — Gap Log

Source used: https://www.thyrocare.com and its subpages, accessed via a real browser session
(Playwright) on 2026-07-02/03, since plain HTTP fetching (WebFetch) was blocked (see below).
All data in `catalog_thyrocare_tests.json` and `catalog_thyrocare_packages.json` was read
directly off rendered pages; nothing was filled in from prior knowledge.

## 1. Plain HTTP fetch (WebFetch) blocked entirely
Every attempt to fetch thyrocare.com pages via the standard WebFetch tool returned
**HTTP 403 Forbidden** (homepage, `/profile/lipid profile`, `/profile/aarogyam-1_3-with-utsh`,
`/book-a-test`, etc.). This is consistent with bot/WAF protection. All data was instead
collected using a real headless-browser session (Playwright MCP), which was allowed through.

## 2. Aggressive pop-under/redirect ads hijacked the browser tab repeatedly
thyrocare.com's ad slots triggered automatic redirects of the active tab (and sometimes opened
new tabs) to unrelated third-party sites — observed redirects to `neubergdiagnostics.com`,
`lalpathlabs.com`, `metropolisindia.com`, and even `indiapost.gov.in`. This happened within
seconds of page load on several occasions and aborted in-flight navigations
(`net::ERR_ABORTED`) or caused the "current" page shown to actually be the competitor's site.
Mitigation used: navigate immediately followed by a snapshot in the same step, closing hijacked
tabs and re-navigating when this occurred. This made the session slow and unreliable, and is the
main reason full enumeration of the catalog (see below) was not completed.

## 3. Full catalog size vs. what was captured
The site's own "Browse Tests / Packages" page (`/book-a-test`) reports **476 single tests** and
**320 packages** (~796 catalog items total; the homepage separately claims "1200+ Test Menu",
likely including sub-parameters/add-ons not separately listed). The listing loads via
client-side infinite scroll with no visible page-number or "load more" control, so items had to
be pulled in batches by scrolling and re-snapshotting.
- **Captured: 42 packages** (11 with full descriptions + full included-parameter lists from
  their own detail pages; 31 more with name/price/partial-test-preview only, pulled from the
  browse-listing cards, cross-referenced against the detailed ones to avoid duplicates).
- **Captured: 49 individual tests** (48 pulled from the single-test browse listing + Lipid
  Profile from its own detail page).
- This is a representative sample, **not the full 476/320 catalog**. Continuing to scroll and
  paginate through the remaining ~430 single tests and ~280 packages was not completed due to
  time constraints and the tab-hijacking issue in item #2 slowing each round trip.

## 4. Dead / non-resolving URLs found during research
Several URLs surfaced by Google/web search or by guessing slug patterns did **not** resolve to
real content (site fell back to a generic "Thyrocare | Diagnostic & Preventive Health Care
Industry in India" shell or an "Oops!! Something went wrong ..." client error), so no data was
taken from them:
- `https://www.thyrocare.com/profile/aarogyam-b-with-utsh` and
  `https://www.thyrocare.com/offer/aarogyam-b-with-utsh` (Aarogyam B package — page dead/removed)
- `https://www.thyrocare.com/profile/extensive-full-body-health-checkup` (hyphenated slug —
  dead; the **working** URL uses literal spaces, url-encoded:
  `/profile/extensive%20full%20body%20health%20checkup`, which **was** captured successfully)
- `https://www.thyrocare.com/profile/senior-citizen-health-checkup-profile` (dead)
- `https://www.thyrocare.com/Cart/TestDetail?Test=FREE+TESTOSTERONE` and
  `https://www.thyrocare.com/Cart/TestDetail?Test=CERULOPLASMIN` (old-style cart URLs surfaced
  by search — dead on the current site; Free Testosterone price (₹1725) **was** later found via
  the working `/book-a-test?type=single-test` listing instead; Ceruloplasmin was not found again)
- `https://orders.thyrocare.com/Cart/ProfileDetail?Profile=EXTENSIVE_FULL_BODY_HEALTH_CHECKUP`,
  `...?Profile=HEALTHY_2025_PACKAGE`, `...?Profile=FREEDOM_HEALTHY_PACKAGE_2025` — the
  `orders.thyrocare.com` subdomain does **not resolve** at all (`net::ERR_NAME_NOT_RESOLVED`),
  so "Healthy 2025 Package" and "Freedom Healthy Package 2025" could not be verified/captured.
  (Note: a **different**, currently-live package called "HEALTHY 2026 PACKAGE" ₹2199 was found
  on the live site's browse listing and is included in the output.)
- `https://www.thyrocare.com/disease_v1/thyroid-disorders` and
  `https://www.thyrocare.com/disease/thyroid-disorders` (both disease/condition category pages
  linked from the homepage/footer) — both errored client-side ("Oops!! Something went wrong")
  rather than showing a test list, so the "Browse by Health Concern" category pages
  (Heart, Diabetes, Fever, Allergy, Cancer, Hair and Skin, STDs, HerCheck) could not be used to
  enumerate tests by disease category as originally planned.

## 5. Radiology / imaging tests not included
`https://radiology.thyrocare.com` (linked from the main nav as "Radiology") was not explored —
out of scope for the "diagnostic test / package" catalog request and not visited.

## 6. No pincode/location gating encountered
Unlike some competitor sites, thyrocare.com displayed prices without requiring pincode entry or
login, so this was not a blocker (worth noting since it removes one usual source of gaps).

## 7. Category labels mostly unavailable
The site rarely labels tests/packages with an explicit top-level "category" the way the task
requested (e.g. no visible "Category: Thyroid" tag on the Lipid Profile page). Where the site did
show a grouping (e.g. package sub-sections like "Lipid", "Liver", "Toxic Elements" inside a
package's parameter list, or "Package (from Browse Tests/Packages listing)" as the filter used to
find an entry) that label was used; otherwise `category` was left blank per the task's
instructions rather than invented.

## Summary of what's solid vs. partial
- **High confidence / complete detail**: Aarogyam 1.1 through 1.8, Aarogyam X, Aarogyam XL, and
  Extensive Full Body Health Checkup — each has full price, description, and complete
  included-parameter list pulled directly from its own detail page.
- **Partial**: 31 additional packages and 48 additional single tests have verified name + price
  (and for packages, a 4-item test-name preview + total count) but not a full parameter list or
  a dedicated per-item source URL — source_url for these points to the browse-listing page they
  were read from.
- **Not captured**: the remaining ~85% of the single-test catalog and ~90% of the package catalog
  (site claims 476 single tests / 320 packages total), disease-category test groupings, and any
  pricing that might vary by city/pincode (none was observed to vary, but this wasn't
  exhaustively tested across cities).
