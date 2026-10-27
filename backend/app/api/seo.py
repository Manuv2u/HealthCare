"""Root-level SEO endpoints: /sitemap.xml and /robots.txt.

Deliberately not under the /api/v1 prefix — search engines expect both files
at the domain root. Registered directly on the FastAPI app in main.py.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.test import Test

router = APIRouter(tags=["seo"])

SITE_URL = "https://www.srihealthplus.com"

# Fully static, code-defined public pages (kept in sync manually with
# frontend/src/app/app.routes.ts). Blog reuses the hardcoded Health Tips
# content with no backend, so its slugs are listed here too — add a line
# whenever a new article is added to health-articles.data.ts.
STATIC_ROUTES: list[tuple[str, str]] = [
    ("/", "1.0"),
    ("/tests", "0.9"),
    ("/packages", "0.9"),
    ("/home-sample-collection", "0.9"),
    ("/blog", "0.7"),
    ("/blog/5-early-warning-signs-of-diabetes", "0.5"),
    ("/blog/why-your-lipid-profile-test-matters", "0.5"),
    ("/blog/common-signs-of-thyroid-disorders", "0.5"),
    ("/blog/vitamin-deficiencies-every-woman-should-know", "0.5"),
    ("/blog/why-annual-health-checkups-can-save-lives", "0.5"),
    ("/blog/high-blood-pressure-the-silent-killer", "0.5"),
    ("/blog/how-to-keep-your-liver-healthy", "0.5"),
    ("/blog/protect-your-kidneys-before-problems-begin", "0.5"),
    ("/about", "0.7"),
    ("/contact", "0.7"),
    ("/faq", "0.6"),
    ("/lab-locations", "0.5"),
    ("/available-locations", "0.5"),
    ("/privacy-policy", "0.3"),
    ("/terms-of-service", "0.3"),
    ("/refund-and-cancellation", "0.3"),
    ("/disclaimer", "0.3"),
]

DISALLOWED_PREFIXES = [
    "/dashboard", "/booking", "/profile", "/payments", "/bookings",
    "/admin", "/technician", "/auth", "/reports",
]


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap(db: AsyncSession = Depends(get_db_session)) -> Response:
    urls: list[str] = []

    for path, priority in STATIC_ROUTES:
        urls.append(
            f"<url><loc>{SITE_URL}{path}</loc><priority>{priority}</priority></url>"
        )

    test_rows = (
        await db.execute(
            select(Test.id, Test.updated_at).where(
                Test.is_active.is_(True), Test.deleted_at.is_(None)
            )
        )
    ).all()
    for test_id, updated_at in test_rows:
        urls.append(
            f"<url><loc>{SITE_URL}/tests/{test_id}</loc>"
            f"<lastmod>{updated_at.date().isoformat()}</lastmod><priority>0.6</priority></url>"
        )

    # Packages have no dedicated detail URL today (shown in an in-page modal
    # on /packages), so only the listing page above is included.

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(urls)
        + "</urlset>"
    )
    return Response(content=xml, media_type="application/xml")


@router.get("/robots.txt", include_in_schema=False)
async def robots_txt() -> Response:
    lines = ["User-agent: *"]
    lines += [f"Disallow: {prefix}" for prefix in DISALLOWED_PREFIXES]
    lines += ["Allow: /", "", f"Sitemap: {SITE_URL}/sitemap.xml"]
    return Response(content="\n".join(lines), media_type="text/plain")
