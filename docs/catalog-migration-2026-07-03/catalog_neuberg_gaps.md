# Neuberg Diagnostics Catalog Research — Gap Log

Source used for all records: https://www.neubergdiagnostics.com/book-a-test

## Why this approach was needed
The marketing pages of neubergdiagnostics.com (e.g. `/packages`, `/neutest`) are
client-side rendered and, for an unauthenticated/no-pincode session, largely
redirect to `/contact-us` or render only a header shell — a plain HTTP fetch
returns almost no content. The actual test/package catalog is loaded into the
`/book-a-test` page at runtime by browser JavaScript calling the site's own
public data API at `pweb.neubergdiagnostics.com` (no login, no key, no CORS
restriction — the same calls the page itself makes). A headless browser was
used to load `/book-a-test` (default location: Bangalore 560016) and issue the
identical `fetch()` calls the page issues, requesting the full result set
instead of the paginated ~10-per-page chunks used in the UI. All data in the
two output files came verbatim from those JSON responses; nothing was
inferred, estimated, or filled in from prior knowledge.

Endpoints used (all public, unauthenticated, same-origin to the booking page):
- `GET /master/api/service/{cityId}?tests=true&limit=2000` — full individual test catalog (1,824 raw records)
- `GET /master/api/service/{cityId}?package=true&limit=2000` — full package catalog (36 raw records)
- `GET /master/api/service/v2/popular/package/city/{cityId}` — the 35 real packages with MRP, offer price, and the list of top-level tests each package includes (used as the primary package source since it has richer data than the plain `package=true` listing)
- `GET /master/api/service/v2/frequentBookedService/{cityId}` — 20 "frequently booked" individual tests (cross-check only; all 20 already existed in the main 1,824-record test catalog, so no new rows were added from this endpoint)
- `GET /master/api/disease/{cityId}?limit=100` — a set of 25 "health concern" icons (Fever, Diabetes, Kidneys, Liver, ...) used for on-site navigation/filtering, not as a "category" field attached to individual test/package records — see note below.

## Gaps / things that could not be captured

1. **No site-labeled "category" field exists on test or package records.**
   The API payload for every test and every package has no `category` (or
   equivalent) attribute. The site does show a set of ~25 "health concern"
   icons (Fever, Diabetes, Kidneys, Liver, Thyroid, Heart, PCOD, etc. — see
   `/master/api/disease/...` above) used to filter/browse, but these are not
   attached to individual test/package JSON records as a category label, so
   per the task's "leave blank if not labeled" rule, `category` was left
   blank for all 1,721 tests and 35 packages rather than guessing a mapping.

2. **Pricing and catalog are location-dependent.** The site defaults to
   Bangalore (pincode 560016) for an unauthenticated visitor; other
   pincodes/cities may show different prices, different active tests, or
   additional packages. Only the Bangalore-default catalog was captured. This
   was not cross-checked against other cities.

3. **Static marketing pages could not be fetched directly.** Plain
   (non-browser) fetches to `https://www.neubergdiagnostics.com`,
   `/packages`, and `/neutest` returned only the page `<title>` — the body is
   populated by client-side JS, so a plain WebFetch/curl could not see any
   test/package content on those URLs. The only reason full data was
   obtainable at all is that a headless browser could execute the page's own
   JS/API calls. If browser automation had not been available, this task
   would have produced near-zero real data (no fabrication was used to fill
   that gap).

4. **`/packages` URL redirects.** Navigating directly to
   `https://www.neubergdiagnostics.com/packages` redirected to
   `/contact-us` in this session (no packages content rendered there); the
   working catalog surface was `/book-a-test` instead.

5. **Per-city/per-location package detail pages not individually crawled.**
   A web search surfaced a separate pattern of location-specific package
   pages, e.g. `https://www.neubergdiagnostics.com/packages_details/chennai/cardiac-care-basic`
   and `.../kolkata/immunity-health-checkup`. These were not opened
   individually — the 35 packages captured via the API already appear to be
   the same underlying catalog (same names, e.g. "Cardiac C.A.R.E" family,
   "Immunity Health Checkup") surfaced per-city. Treat any of these page URLs
   as a cross-reference of the same package data already captured, not a
   confirmed source of additional/different packages.

6. **International/subsidiary sites and sub-portals not covered.** Links
   found in the site footer to `dos.neubergdiagnostics.com` (Directory of
   Service / test brochures), `neubergdiagnostics.ae` (UAE), `ncgmus.com`
   (USA), and `neubergglobal.com` (South Africa) were not crawled — out of
   scope (task specifies neubergdiagnostics.com and its subpages; these are
   either a login-gated sub-portal or separate country domains).

7. **`amount: null` items excluded.** All 1,721 individual test records
   returned by the API had a non-null price, so no test needed a blank
   price field. No packages had a missing/blank offer price either. Nothing
   was omitted for lack of a visible price.

8. **Aliases not treated as separate tests.** Many tests carry an
   `aliasName` field (e.g. "Complete Blood Count | HAE | Hemogram | HOBC |
   PS study" as an alias for "Haemogram (CBC)"). These are alternate names
   for the same single catalog entry, not separate tests, and were not
   expanded into extra rows.
