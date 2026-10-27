# Catalog & Service Area Migration Report — 2026-07-03

Production DB: `srihealthplus` on OCI VM <VM_IP>.
Pre-migration backup: `/opt/srihealthplus/backups/pre_catalog_migration_20260702_192306.sql` (on the VM).
Migration ran as a single transaction; all duplicate checks returned 0.

## Summary counts

| Metric | Count |
|---|---|
| Old tests removed (hard delete) | 6 |
| Old packages removed (hard delete) | 4 |
| Old bookings removed (user-approved, incl. 4 booking items, payments/reports/history) | 2 |
| New tests added | 1,833 |
| New packages added | 139 |
| Package→test links created (verified name matches) | 626 |
| Shivamogga District PIN codes added | 52 (existing 10 non-Shivamogga areas preserved) |
| Records skipped (see import_skipped_log.md) | 68 |

## Sources actually used

| Provider | Tests | Packages | Coverage |
|---|---|---|---|
| Neuberg Diagnostics (public booking API, Bangalore pricing) | 1,720 | 35 | Near-complete |
| Metropolis Healthcare | 71 | 45 | Partial — many category pages unreachable; 37 tests skipped (no public price) |
| Thyrocare | 42 | 42 | ~10% sample — site advertises ~476 tests/320 packages; bot blocking prevented full crawl |
| Dr. Lal PathLabs | 0 | 17 | All 13 collected tests skipped (prices hidden for guest sessions); test directory returned "No Data Found" |
| Apollo Diagnostics / 24|7 | 0 | 0 | Not collected — research agent declined (ToS/proprietary-catalog concerns) |
| Tata 1mg Labs | 0 | 0 | Not collected — same reason |
| Orange Health Labs | 0 | 0 | Not collected — research run stopped before completion |
| India Post (api.postalpincode.in, cross-checked vs shivamogga.nic.in) | — | — | 52/52 district PINs, 357 post offices |

## Policies applied (user-approved)

- `turnaround_hours`: set to placeholder **24** for all tests (no provider publishes TAT) — adjust per-test in admin panel.
- `category`: source-site label where present; otherwise **"General"** (1,778 of 1,833 tests are "General").
- Tests without a verified public price: **skipped and logged** (60 records).
- Packages with only one listed price: `discounted_price = original_price` (no discount shown ≠ invented discount).
- Descriptions: imported verbatim from source sites where present (user's choice; IP concern was flagged).
- Dedup: case-insensitive normalized name within and across providers; DB-verified 0 duplicate test names, package names, and pincodes post-import.
- Contamination guard: records whose source URL didn't match the provider's own domain were rejected.

## Known gaps / follow-ups

1. **Health-concern mappings are now empty** — old test/package↔health-concern links were removed with the old catalog, and concern mappings are not published by providers. The 16 health concerns still exist; `?health_concern=` filters return 0 until re-mapped in the admin panel.
2. **971 package ingredient names unmatched** — package "included tests" that don't exist as standalone importable tests remain only in package descriptions, not as `package_tests` rows (626 links were created where names matched exactly).
3. **Pricing provenance is mixed** (Neuberg Bangalore-default, Thyrocare national, Metropolis listed) — treat imported prices as market reference, not final retail pricing.
4. Thyrocare/Metropolis/Lal coverage is partial; Apollo/1mg/Orange absent (see per-provider gap files in this folder).
5. Booking slot counters were reset along with booking deletion.

## Verification performed (live app)

- `GET /api/v1/tests?page_size=1` → total 1,833
- `GET /api/v1/tests?q=lipid` → 9; `q=thyroid` → 19 (full-text search vector populated on import)
- `GET /api/v1/tests?category=Heart Tests` → 14
- `GET /api/v1/packages` → 139; package detail returns its linked tests (e.g. Aarogyam 1.1 with UTSH → 9 tests)
- `GET /api/v1/service-areas` → 62 (52 Shivamogga, all active); frontend booking flow validates pincode against this list
- Duplicate checks (tests/packages/pincodes, case-insensitive): 0 / 0 / 0
- Frontend HTTP 200; all containers healthy
