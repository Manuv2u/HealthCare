# Catalog Cleanup & Standardization Report — 2026-07-03

Production DB `srihealthplus` on OCI VM <VM_IP>.
Pre-cleanup backup: `/opt/srihealthplus/backups/pre_cleanup_20260703_031652.sql` (on VM).
Applied as a single transaction; all validation checks returned 0.

## Headline numbers

| Metric | Value |
|---|---|
| Tests before → after | 1,833 → **476** |
| Tests removed | **1,357** |
| Tests renamed (cleaned) | 185 |
| Packages before → after | 139 → **20** |
| Packages removed | **119** (incl. all 74 empty ones) |
| Packages renamed / rebuilt | 20 (all new patient-friendly names) |
| Duplicate test records deleted | 20 |
| Categories in use | 22 (was effectively "General" + a few) |
| Health-concern mappings created | 630 test links + 22 package links across all 16 concerns |
| Empty packages remaining | 0 |

## What was removed (tests: 1,357 total)

| Reason | Count |
|---|---|
| Unclassifiable / not a common diagnostic test (obscure long tail) | 950 |
| Obscure / lab-only investigations (gene analysis, FISH, karyotype, HLA typing, biopsy, NGS, etc.) | 252 |
| Individual allergen variants folded into allergy profiles (Carob, Cocklebur, Cotton Wood…) | 92 |
| **Thyrocare-sourced tests + any Aarogyam-branded names (per request)** | 42 |
| Duplicate names after cleaning | 20 |
| Empty after name cleaning | 1 |

Full list with per-record reasons: `removed_tests.json` in this folder.

## Name standardization

All surviving names were cleaned deterministically:
- Stripped `#` prefixes (105 fixed), `KA-` prefixes, and provider brands (Neuberg/Metropolis/Thyrocare/Lal PathLabs/Aarogyam/SwasthFit/TruHealth).
- Removed lab-method tags (CMIA, CLIA, ELISA, FEIA, ECLIA…) and specimen suffixes (", Serum", ", EDTA Blood", ", Random Urine").
- Title-cased 308 ALL-CAPS names while preserving medical acronyms (CBC, TSH, HbA1c, HDL, PSA, IgG, RNA, PCR…).
- Reworded allergy tests to patient-friendly form (e.g. `# ALLERGY, CAROB` → `Carob Allergy`; `ALLERGY, COTTON WOOD, ImmunoCAP Specific IgE` → `Cotton Wood Allergy (IgE)`).

**Verification:** 0 test names contain `#`; 0 contain any provider/brand token.

## Categories (redistributed from "General")

Infection 75 · Kidney 42 · Diabetes 34 · General 33 · Anemia / Blood 31 · Liver 30 · Heart 28 · Thyroid 26 · Hormones 25 · Gastroenterology 22 · Vitamin 20 · Bone Health 18 · Neurology 14 · Fever 14 · Arthritis 12 · Pregnancy 12 · Women's Health 10 · Cancer Screening 9 · Allergy 8 · Men's Health 7 · Respiratory 3 · Fertility 3.

## Packages (139 → 20, all rebuilt)

Old branded/tiered packages (Aarogyam 1.1–XL, Neuberg/KA-/TruHealth variants, and 74 empty ones) were deleted and replaced with a curated set. Each has a patient-friendly name, a real member-test list drawn from the cleaned catalog, no duplicate test-sets, and no empties:

Basic / Comprehensive / Master / Executive / Annual Health Checkup · Women's / Men's / Senior Citizen Health Checkup · Diabetes Care · Heart Health · Kidney Health · Liver Health · Thyroid · Vitamin Profile · Fever Profile · Pregnancy Profile · PCOS Profile · Hair Fall Profile · Allergy Profile · Arthritis Profile.

**Pricing:** `original_price` = sum of member test prices (real data). `discounted_price` inherited from the best-matching source package's real price where one existed; for 6 packages with no source match, derived at ~70% of MRP (flagged: Diabetes Care, Kidney Health, Liver Health, Thyroid, Pregnancy Profile, Allergy Profile). Details in `clean_packages.json`.

## Health-concern mapping (rebuilt; no empty pages)

All 16 concerns return meaningful tests via the public `?health_concern=` filter:

full_body_checkup 60 · diabetes 34 · thyroid 26 · heart_health 28 · liver 30 · kidney 42 · fever_infection 92 · vitamin_deficiency 20 · womens_health 25 · mens_health 7 · pregnancy 12 · childrens_health 40 · senior_citizen 39 · bone_health 30 · allergy 8 · general_health 137. Packages mapped to full_body_checkup (5), womens_health (4), mens_health (2), and one each to the organ-specific concerns.

## Validation (live app, post-cleanup)

- Catalog totals: 476 tests, 20 packages.
- Search (`q=`): CBC→3, Blood Sugar→2, Thyroid→27, Vitamin D→16, Liver→31, Kidney→42, HbA1c→2, Lipid→8, Dengue→6, PSA→1. Full-text + trigram both working.
- Category filters: return correct counts for every category.
- Health-concern filters: all 16 non-empty.
- Package detail returns its member tests (e.g. Diabetes Care Package → 15 tests, ₹1,095.50).
- Test detail pages resolve; frontend HTTP 200; all containers healthy.
- DB checks: `#` names 0 · brand names 0 · duplicate tests 0 · duplicate packages 0 · empty packages 0.
- Bookings were empty before cleanup, so no order history was affected.

## Notes / follow-ups

- `turnaround_hours` remains a placeholder 24h for all tests (no provider publishes it) — tune per-test in the admin panel.
- Category `Anemia / Blood` uses a slash; rename in admin if a single-word label is preferred.
- Descriptions were dropped (they were copied provider prose); the admin panel or a later original-copy pass can add Sri-branded descriptions.
- Static frontend chips include a "Full Body" label that no test category matches (yields 0) — cosmetic; the real category chips are generated from data.
