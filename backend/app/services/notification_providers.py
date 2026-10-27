"""SMS and Email provider clients."""
from __future__ import annotations

import logging
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Protocol

from app.config import settings

logger = logging.getLogger("sri.notification")

# (filename, content, mime subtype) e.g. ("INV-1.pdf", b"...", "pdf")
Attachment = tuple[str, bytes, str]


class SMSClientProtocol(Protocol):
    async def send(self, phone: str, message: str) -> bool:
        ...


class EmailClientProtocol(Protocol):
    async def send(
        self, to_email: str, subject: str, body: str,
        attachments: list[Attachment] | None = None,
    ) -> bool:
        ...


class MSG91SMSClient:
    """MSG91 SMS provider."""

    async def send(self, phone: str, message: str) -> bool:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.msg91.com/api/v5/flow/",
                    json={
                        "flow_id": "sri_notification",
                        "sender": "SRILAB",
                        "mobiles": phone,
                        "message": message,
                    },
                    headers={"authkey": settings.sms_api_key},
                    timeout=10,
                )
            return resp.status_code == 200
        except Exception as exc:
            logger.error("sms_send_failed: phone=%s error=%s", phone, exc)
            return False


class SMTPEmailClient:
    """SMTP email provider."""

    async def send(
        self, to_email: str, subject: str, body: str,
        attachments: list[Attachment] | None = None,
    ) -> bool:
        try:
            if attachments:
                msg: MIMEMultipart | MIMEText = MIMEMultipart()
                msg.attach(MIMEText(body, "html"))
                for filename, content, subtype in attachments:
                    part = MIMEApplication(content, _subtype=subtype)
                    part.add_header("Content-Disposition", "attachment", filename=filename)
                    msg.attach(part)
            else:
                msg = MIMEText(body, "html")
            msg["Subject"] = subject
            msg["From"] = settings.mail_from
            msg["To"] = to_email

            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.starttls()
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
            return True
        except Exception as exc:
            logger.error("email_send_failed: to=%s error=%s", to_email, exc)
            return False


class MockSMSClient:
    async def send(self, phone: str, message: str) -> bool:
        logger.info("mock_sms: phone=%s message=%s", phone, message)
        return True


class MockEmailClient:
    async def send(
        self, to_email: str, subject: str, body: str,
        attachments: list[Attachment] | None = None,
    ) -> bool:
        logger.info(
            "mock_email: to=%s subject=%s attachments=%s",
            to_email, subject, [a[0] for a in attachments or []],
        )
        return True


def get_sms_client() -> MSG91SMSClient | MockSMSClient:
    if settings.env_profile in ("local", "test") or not settings.sms_api_key:
        return MockSMSClient()
    return MSG91SMSClient()


def get_email_client() -> SMTPEmailClient | MockEmailClient:
    if settings.env_profile in ("local", "test") or not settings.smtp_user:
        return MockEmailClient()
    return SMTPEmailClient()
