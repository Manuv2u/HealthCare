from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://srihealthplus:srihealthplus_secret@localhost:5432/srihealthplus_dev"

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_hours: int = 24
    refresh_token_expire_days: int = 7

    # File storage
    file_storage_backend: str = "local"  # "local" | "s3"
    file_storage_path: str = "/app/file_storage"

    # AWS / S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = ""
    aws_region: str = "ap-south-1"

    # Payments
    payment_webhook_secret: str = "change-me"
    # Which gateway to use when no admin override exists in provider_configs.
    # Every profile talks to the real gateway: local/staging with rzp_test_*
    # keys (sandbox, no real money), production with rzp_live_*.
    payment_gateway: str = "razorpay"
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    # Razorpay lets webhooks use a dedicated secret; falls back to
    # payment_webhook_secret when unset.
    razorpay_webhook_secret: str = ""
    # Cashfree Payment Gateway. App ID starting with "TEST" is sandbox;
    # anything else is treated as live (mirrors Razorpay's rzp_test_ prefix).
    # Webhooks are signed with the secret key itself — no separate secret.
    cashfree_app_id: str = ""
    cashfree_secret_key: str = ""
    cashfree_api_version: str = "2023-08-01"

    # OTP
    # Default OTP provider when no admin override exists: "twofactor" | "msg91" | "mock"
    otp_provider: str = "twofactor"
    twofactor_api_key: str = ""
    # Optional 2Factor OTP template name (uses AUTOGEN when blank)
    twofactor_template: str = ""
    otp_ttl_minutes: int = 10
    otp_max_verify_attempts: int = 5
    otp_resend_cooldown_seconds: int = 30
    otp_max_sends_per_window: int = 5
    otp_send_window_minutes: int = 15

    # SMTP (general notification delivery — bookings, reports, etc.)
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    # Mail (transactional auth email — password reset, via Mailtrap in dev).
    # Kept distinct from smtp_* above so the two delivery paths can point at
    # different providers/credentials without cross-wiring.
    mail_host: str = "localhost"
    mail_port: int = 587
    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = "Sri Health Plus <noreply@srihealthplus.com>"
    mail_secure: bool = False
    support_email: str = "support@srihealthplus.com"

    # Mailtrap Send API (https://mailtrap.io/sending/email_logs). Preferred over
    # the MAIL_* SMTP settings above when set — EmailService uses the `mailtrap`
    # SDK instead of smtplib whenever this token is non-empty.
    mailtrap_api_token: str = ""
    mailtrap_sandbox: bool = False
    mailtrap_inbox_id: str = ""

    # Password reset
    frontend_url: str = "http://localhost:4200"
    reset_token_expiry_minutes: int = 30
    # Max forgot-password requests allowed per IP within the window below.
    password_reset_rate_limit_max_attempts: int = 5
    password_reset_rate_limit_window_minutes: int = 15

    # Registration email verification (OTP)
    email_verification_otp_expiry_minutes: int = 10
    email_verification_max_attempts: int = 5
    # Minimum gap between resend requests for the same account.
    email_verification_resend_cooldown_seconds: int = 30

    # SMS
    sms_provider: str = "msg91"
    sms_api_key: str = ""

    # Logging
    log_level: str = "INFO"

    # Business rules
    gst_rate: float = 0.18
    lab_timezone: str = "Asia/Kolkata"

    # Environment
    env_profile: str = "local"

    # CORS
    cors_origins: list[str] = ["http://localhost:4200", "http://localhost:3000"]

    # Public base URL this backend is reachable at — used to build the absolute
    # invoice-verification link encoded in the invoice's QR code.
    public_api_base_url: str = "http://localhost:8000"

    # Admin seed (auto-created on startup)
    admin_phone: str = "9999999999"
    admin_email: str = "admin@sri.local"
    admin_name: str = "Admin"
    admin_password: str = "Admin@123"

    # Auth rate limiting (sliding window over /api/v1/auth/). Set
    # RATE_LIMIT_ENABLED=false in the environment to turn the limiter off entirely.
    rate_limit_enabled: bool = True
    rate_limit_window_minutes: int = 15
    rate_limit_max_attempts: int = 200

    @property
    def CORS_ORIGINS(self) -> list[str]:
        return self.cors_origins


settings = Settings()
