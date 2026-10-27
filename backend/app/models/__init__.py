# Models package — import all models here so Alembic can detect them
from app.models.base import Base, TimestampMixin
from app.models.user import (  # TODO(TEMP_PASSWORD_AUTH): remove PasswordResetToken
    AdminNote,
    EmailVerificationOtp,
    FamilyMember,
    LoginEvent,
    PasswordResetToken,
    Session,
    User,
    UserAddress,
)
from app.models.test import Package, PackageTest, Test
from app.models.service import (
    LabBranch,
    ServiceArea,
    ServiceRequest,
    Technician,
    TechnicianAssignment,
    TechnicianServiceArea,
    TimeSlot,
)
from app.models.booking import Booking, BookingItem, BookingSlotCount, BookingStatusHistory
from app.models.payment import Payment, Refund, WebhookEvent
from app.models.report import Report
from app.models.notification import Notification
from app.models.audit import AuditLog, FeatureFlag
from app.models.archive import BookingArchive, PaymentArchive
from app.models.settings import CancellationSetting, ProviderConfig
from app.models.billing import BillingSetting, BookingAdjustment, Invoice
from app.models.coupon import Coupon, CouponPackage
from app.models.otp import OtpCode, OtpSendEvent
from app.models.callback_request import CallbackRequest
from app.models.health_concern import HealthConcern
from app.models.prescription_request import PrescriptionFile, PrescriptionRequest
from app.models.banner import Banner
from app.models.faq import Faq

__all__ = [
    "Base",
    "TimestampMixin",
    "User",
    "Session",
    "FamilyMember",
    "UserAddress",
    "LoginEvent",
    "AdminNote",
    "PasswordResetToken",
    "EmailVerificationOtp",
    "Test",
    "Package",
    "PackageTest",
    "ServiceArea",
    "ServiceRequest",
    "LabBranch",
    "TimeSlot",
    "Technician",
    "TechnicianServiceArea",
    "TechnicianAssignment",
    "Booking",
    "BookingItem",
    "BookingSlotCount",
    "BookingStatusHistory",
    "Payment",
    "Refund",
    "WebhookEvent",
    "Report",
    "Notification",
    "AuditLog",
    "FeatureFlag",
    "BookingArchive",
    "PaymentArchive",
    "CancellationSetting",
    "ProviderConfig",
    "BillingSetting",
    "Invoice",
    "BookingAdjustment",
    "Coupon",
    "CouponPackage",
    "OtpCode",
    "OtpSendEvent",
    "CallbackRequest",
    "HealthConcern",
    "PrescriptionRequest",
    "PrescriptionFile",
    "Banner",
    "Faq",
]
