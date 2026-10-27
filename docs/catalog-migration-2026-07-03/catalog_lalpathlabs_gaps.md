# Gap Log — Dr Lal PathLabs Catalog Research

Research date: 2026-07-03. Source: www.lalpathlabs.com only (no other domains used for data).

## Environment issue (disclosure, not a site limitation)
The shared browser automation tool available in this session was concurrently in use by
another process during this task (tabs repeatedly navigated themselves to thyrocare.com,
neubergdiagnostics.com, and metropolisindia.com mid-task). To guarantee no data was
accidentally cross-attributed from those competitor sites, all lalpathlabs.com data in the
output JSON files was collected via a separate, isolated Chrome instance launched directly
(via `playwright-core` + the system Chrome binary, fresh profile, own tabs), and every
extraction verified `location.href` contained `lalpathlabs.com` before recording data. No
data from thyrocare.com, neubergdiagnostics.com, or metropolisindia.com was captured or used.

## Major gaps

1. **Individual test prices are not shown to an anonymous/guest session.**
   Test detail pages (e.g. `/pathology-test/complete-blood-count`, `/pathology-test/hba1c`,
   `/pathology-test/lipid-profile-complete`, etc.) render the price field literally as `"--"`
   and "Parameters covered : 00" until a pincode/city is selected through the booking flow.
   Network inspection confirmed the SEO content API (`admin-api.lalpathlabs.com/api/seo/page/details`)
   only returns title/breadcrumb/article copy — no price/product data. The pricing/product
   lookup is a separate, session-bound API keyed by city/pincode that a scripted guest session
   could not reliably trigger (see #3). Result: **all 13 individual test records in
   `catalog_lalpathlabs_tests.json` have price left blank**, per the task's own instruction to
   leave price blank rather than guess.

2. **"Included tests" lists for packages are not shown pre-checkout.**
   Package detail pages (the "Know More" links, e.g. `/pathology-test/swasthfit-super-3-new`)
   also render as an empty template (no parameter list, no test breakdown) without a
   pincode/city selected. Only a summary stat ("N parameter(s) covered") is available from the
   package listing page itself. Result: **`included_tests` is an empty list for all 17
   packages** — this is a real gap, not an assumption; the itemized breakdown was never
   visible in any page fetched.

3. **Category/condition hub pages and the full test directory return "No Data Found."**
   `/test-menu`, `/package/list`, and all `/test-for-<condition>` pages (e.g.
   `/test-for-diabetes`, `/test-for-thyroid-function`, `/test-for-heart-diseases`,
   `/test-for-liver`, `/test-for-kidney`, `/test-for-allergy`, `/test-for-cancer`, etc.) are
   client-rendered search/listing screens that depend on a city/pincode context. In every
   attempt (fresh guest session, default "Delhi" city shown in UI chrome) these pages showed
   "Showing 0 result" / "No Data Found," and network capture showed **no search/listing API
   call was even made** — meaning the site requires an explicit user action (selecting a city
   from the location dropdown, or typing a pincode) that automated navigation did not
   successfully trigger. This is the single largest source of missing data: the site's full
   test catalog (very likely several hundred tests, organized under real site-labeled
   categories such as "Anemia," "Arthritis," "Bone & Mineral Metabolism," "Cancer,"
   "Cardiac disorders," "Celiac Disease," etc. — all confirmed as real category labels visible
   in the `/test-menu` sidebar) was **not enumerable** through these pages. Only the ~30
   "Popular Tests" shortcut links from the site header/footer were usable, and of those, only
   13 pointed to real, content-bearing `/pathology-test/*` detail pages — the rest
   (`/test-for-*`) are the broken hub pages described above.

4. **Category labels could not be attached to individual tests.**
   Because the category-filtered browsing (`/test-menu` sidebar categories) could not be
   made to return results (see #3), no individual test could be reliably tied to one of the
   site's own category labels. Per the task's instruction, `category` was left blank for all
   13 individual test records rather than guessed from the test name.

5. **Several guessed/likely test-page URL slugs did not exist.**
   To try to broaden coverage, a batch of plausible `/pathology-test/*` slugs was attempted
   (e.g. `thyroid-stimulating-hormone-tsh`, `vitamin-b12`, `widal-test`, `dengue-antigen-ns1`,
   `rheumatoid-factor-quantitative`, `hba1c-glycosylated-hemoglobin`,
   `urine-routine-examination`). These returned no SEO/product data (effectively 404 or
   redirected to home) and were **excluded entirely** from the output rather than being
   included with fabricated names — consistent with the "do not guess" rule.

6. **Package section labeling is inferred, not 100%-literal.**
   The SwasthFit packages page shows three visible carousel section headers in its accessible
   text ("Swasthfit Full Body Tests / Packages," "Swasthfit Diabetic Tests/Packages,"
   "Swasthfit Full Body Premium Packages") but a fourth section title ("Swasthfit Packages by
   Gender," visible only as an image-based carousel label with no accessible text) could not
   be captured verbatim. The `category` field for the 6 gender-specific packages (Senior
   Man/Woman, Active Man/Woman, Premium Male/Female split) was assigned by matching each
   package's own name against the visible section headers rather than pulled from a literal
   DOM label for that specific carousel — flagged here so this categorization is understood as
   a light inference, not a scraped label like the other three.

7. **Radiology/imaging tests not covered.**
   The task focused on pathology tests and checkup packages. `/radiology` and
   `/book-radiology-test` pages were noted in navigation but not explored — out of scope for
   this pass; flagging in case radiology pricing/catalog is wanted in a follow-up.

## What was reliably captured (high confidence, verified real content from lalpathlabs.com)

- 17 SwasthFit health-checkup packages from
  `https://www.lalpathlabs.com/swasth-fit-packages-full-body-checkups`, each with: exact
  name, original price, discounted price, percent off (derivable), parameter count, special
  instructions text, and its own detail-page URL — all scraped directly from the page's
  `.package-card` DOM elements (`.package-header`, `.prise-line`, `.for-actual-price`,
  `testpkgcard-top`), confirmed against raw HTML.
- 13 individual pathology tests with real names and (where present) description text pulled
  from the site's own SEO content API for that exact page slug.
- The site's real, own-labeled test category list from the `/test-menu` sidebar (30 category
  names, e.g. ABO Incompatibility, Acid Base Imbalance, Anemia, Arthritis, Autoimmune
  disorders, Blood Cancer, Bone & Mineral Metabolism, Cancer, Cardiac disorders, Celiac
  Disease, etc.) — captured but **not** used to tag individual tests since no test-to-category
  mapping could be retrieved (see gap #4).
