import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.config import settings

# Without this, the root logger defaults to WARNING and every logger.info()
# call across the app (OTP dispatch, email dispatch, notification outcomes)
# is silently dropped — LOG_LEVEL would otherwise have no effect at all.
# force=True ensures this wins even if uvicorn's own logging setup already
# attached a handler to the root logger before this module is imported.
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    force=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    """Application lifespan: startup and shutdown hooks."""
    # Startup — seed feature flags
    from app.database import AsyncSessionFactory
    from app.services.feature_flag_service import FeatureFlagService
    async with AsyncSessionFactory() as db:
        svc = FeatureFlagService(db)
        await svc.seed_defaults()
        await db.commit()

    # Startup — ensure admin user exists
    from app.services.admin_seed_service import seed_admin_user
    async with AsyncSessionFactory() as db:
        await seed_admin_user(db)
        await db.commit()

    # Startup — seed lab branches, service areas, time slots, and default
    # homepage banners/sample coupons. These are dev/demo fixtures meant to
    # give a fresh local database something to look at — never run them
    # against production, where real admin-entered data must be the only
    # source of truth (a wiped prod table should stay wiped, not silently
    # refill with placeholder content on the next restart).
    if settings.env_profile != "production":
        from app.scripts.seed_lab_data import seed_lab_branches, seed_service_areas, seed_time_slots
        async with AsyncSessionFactory() as db:
            await seed_lab_branches(db)
            await seed_service_areas(db)
            await seed_time_slots(db)
            await db.commit()

        from app.scripts.seed_banners import seed_banners
        async with AsyncSessionFactory() as db:
            await seed_banners(db)
            await db.commit()

    # Start APScheduler
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from app.services.notification_service import run_notification_retry_job
    from app.services.archival_service import run_archival_job
    from app.services.anonymisation_service import run_anonymisation_job
    from app.services.backup_service import run_backup_job, run_restore_validation

    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_notification_retry_job, "interval", minutes=1, id="notification_retry")
    scheduler.add_job(run_archival_job, CronTrigger(hour=2, minute=0), id="archival")
    scheduler.add_job(run_anonymisation_job, CronTrigger(hour=3, minute=0), id="anonymisation")
    scheduler.add_job(run_backup_job, CronTrigger(hour=2, minute=0), id="backup")
    scheduler.add_job(run_restore_validation, CronTrigger(day=1, hour=3, minute=0), id="restore_validation")
    scheduler.start()
    app.state.scheduler = scheduler

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    from app.database import engine
    await engine.dispose()


app = FastAPI(
    title="Sri Health Plus — Diagnostic Laboratory & Health Care",
    version="0.1.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)


# ── Middleware ────────────────────────────────────────────────────────────────

from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from app.middleware.rate_limit import RateLimitMiddleware  # noqa: E402
from app.middleware.audit import AuditMiddleware  # noqa: E402
from app.middleware.logging import RequestLoggingMiddleware  # noqa: E402
from app.middleware.security import SecurityHeadersMiddleware  # noqa: E402

# CORS must be added first so OPTIONS preflight is handled before other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)


# ── Global exception handler ──────────────────────────────────────────────────

def _error_envelope(error_code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error_code": error_code, "message": message, "details": details}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    import logging
    logging.getLogger("sri.api").exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_envelope(
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred.",
        ),
    )


# ── API v1 router ─────────────────────────────────────────────────────────────

from fastapi import APIRouter  # noqa: E402
from app.api.v1.auth import router as auth_router  # noqa: E402
from app.api.v1.users import router as users_router  # noqa: E402
from app.api.v1.tests import router as tests_router  # noqa: E402
from app.api.v1.packages import router as packages_router  # noqa: E402
from app.api.v1.lab_branches import router as lab_branches_router  # noqa: E402
from app.api.v1.time_slots import router as time_slots_router  # noqa: E402
from app.api.v1.admin import router as admin_router  # noqa: E402
from app.api.v1.bookings import router as bookings_router  # noqa: E402
from app.api.v1.technicians import router as technicians_router  # noqa: E402
from app.api.v1.reports import router as reports_router  # noqa: E402
from app.api.v1.payments import router as payments_router  # noqa: E402
from app.api.v1.feature_flags import router as feature_flags_router  # noqa: E402
from app.api.v1.health import router as health_router  # noqa: E402
from app.api.v1.admin_settings import router as admin_settings_router  # noqa: E402
from app.api.v1.service_areas import router as service_areas_router  # noqa: E402
from app.api.v1.health_concerns import router as health_concerns_router  # noqa: E402
from app.api.v1.callback_requests import router as callback_requests_router  # noqa: E402
from app.api.v1.contact_settings import router as contact_settings_router  # noqa: E402
from app.api.v1.prescription_requests import router as prescription_requests_router  # noqa: E402
from app.api.v1.banners import router as banners_router  # noqa: E402
from app.api.v1.coupons import router as coupons_router  # noqa: E402
from app.api.v1.faqs import router as faqs_router  # noqa: E402
from app.api.v1.billing import router as billing_router  # noqa: E402
from app.api.v1.invoices import router as invoices_router  # noqa: E402
from app.api.v1.admin_otp import router as admin_otp_router  # noqa: E402
from app.api.v1.admin_payments import router as admin_payments_router  # noqa: E402
from app.api.seo import router as seo_router  # noqa: E402

api_v1 = APIRouter(prefix="/api/v1")

api_v1.include_router(health_router)


api_v1.include_router(auth_router)
api_v1.include_router(users_router)
api_v1.include_router(tests_router)
api_v1.include_router(packages_router)
api_v1.include_router(lab_branches_router)
api_v1.include_router(time_slots_router)
api_v1.include_router(bookings_router)
api_v1.include_router(technicians_router)
api_v1.include_router(reports_router)
api_v1.include_router(payments_router)
api_v1.include_router(billing_router)
api_v1.include_router(invoices_router)
api_v1.include_router(feature_flags_router)
api_v1.include_router(admin_router)
api_v1.include_router(admin_settings_router)
api_v1.include_router(admin_otp_router)
api_v1.include_router(admin_payments_router)
api_v1.include_router(service_areas_router)
api_v1.include_router(health_concerns_router)
api_v1.include_router(callback_requests_router)
api_v1.include_router(contact_settings_router)
api_v1.include_router(prescription_requests_router)
api_v1.include_router(banners_router)
api_v1.include_router(coupons_router)
api_v1.include_router(faqs_router)

app.include_router(api_v1)
app.include_router(seo_router)
