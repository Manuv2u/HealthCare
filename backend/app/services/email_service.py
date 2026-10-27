"""EmailService — reusable transactional email delivery (Mailtrap in dev/staging).

Two delivery backends, selected automatically:
  - Mailtrap Send API (via the `mailtrap` SDK) when MAILTRAP_API_TOKEN is set —
    preferred; this is what's configured for local development.
  - Plain SMTP (via smtplib) using the MAIL_* settings otherwise — lets this
    run against any SMTP provider without the mailtrap SDK as a hard dependency.

Kept separate from app.services.notification_providers (which handles booking
lifecycle notifications) because auth email — password reset today, future
verification/welcome emails — has its own delivery contract: it must run
synchronously with the request (the caller needs to know whether the send
succeeded) rather than going through the notification retry queue.
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import parseaddr

from app.config import settings

logger = logging.getLogger("sri.email")


class EmailService:
    """Sends transactional emails via the Mailtrap Send API (preferred, when
    MAILTRAP_API_TOKEN is set) or plain SMTP using the configured MAIL_* settings."""

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        username: str | None = None,
        password: str | None = None,
        sender: str | None = None,
        use_ssl: bool | None = None,
        api_token: str | None = None,
    ) -> None:
        self._host = host if host is not None else settings.mail_host
        self._port = port if port is not None else settings.mail_port
        self._username = username if username is not None else settings.mail_username
        self._password = password if password is not None else settings.mail_password
        self._sender = sender if sender is not None else settings.mail_from
        self._use_ssl = use_ssl if use_ssl is not None else settings.mail_secure
        self._api_token = api_token if api_token is not None else settings.mailtrap_api_token

    async def send(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str | None = None,
    ) -> bool:
        """Send an HTML email. Returns True on success, False on any delivery
        failure (never raises — callers must not let a delivery outage break
        the request)."""
        try:
            if self._api_token:
                await asyncio.to_thread(
                    self._send_via_mailtrap_api, to_email, subject, html_body, text_body
                )
            else:
                await asyncio.to_thread(
                    self._send_via_smtp, to_email, subject, html_body, text_body
                )
            return True
        except Exception as exc:
            logger.error("email_send_failed: to_domain=%s error=%s", to_email.split("@")[-1], exc)
            return False

    def _send_via_mailtrap_api(
        self, to_email: str, subject: str, html_body: str, text_body: str | None
    ) -> None:
        import mailtrap as mt

        sender_name, sender_email = parseaddr(self._sender)
        mail = mt.Mail(
            sender=mt.Address(email=sender_email, name=sender_name or None),
            to=[mt.Address(email=to_email)],
            subject=subject,
            html=html_body,
            text=text_body,
            category="Password Reset",
        )
        client = mt.MailtrapClient(
            token=self._api_token,
            sandbox=settings.mailtrap_sandbox,
            inbox_id=settings.mailtrap_inbox_id or None,
        )
        client.send(mail)

    def _send_via_smtp(
        self, to_email: str, subject: str, html_body: str, text_body: str | None
    ) -> None:
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = self._sender
        message["To"] = to_email
        if text_body:
            message.attach(MIMEText(text_body, "plain"))
        message.attach(MIMEText(html_body, "html"))

        if self._use_ssl:
            server = smtplib.SMTP_SSL(self._host, self._port, timeout=10)
        else:
            server = smtplib.SMTP(self._host, self._port, timeout=10)
        try:
            if not self._use_ssl:
                server.starttls()
            if self._username and self._password:
                server.login(self._username, self._password)
            server.send_message(message)
        finally:
            server.quit()

    async def send_password_reset_email(
        self,
        to_email: str,
        user_name: str,
        reset_url: str,
        expiry_minutes: int,
    ) -> bool:
        subject = "Reset Your Sri Health Plus Password"
        html_body = _render_password_reset_html(
            user_name=user_name, reset_url=reset_url, expiry_minutes=expiry_minutes
        )
        text_body = _render_password_reset_text(
            user_name=user_name, reset_url=reset_url, expiry_minutes=expiry_minutes
        )
        return await self.send(to_email, subject, html_body, text_body)

    async def send_verification_otp_email(
        self,
        to_email: str,
        user_name: str,
        otp_code: str,
        expiry_minutes: int,
    ) -> bool:
        subject = "Verify Your Sri Health Plus Email Address"
        html_body = _render_verification_otp_html(
            user_name=user_name, otp_code=otp_code, expiry_minutes=expiry_minutes
        )
        text_body = _render_verification_otp_text(
            user_name=user_name, otp_code=otp_code, expiry_minutes=expiry_minutes
        )
        return await self.send(to_email, subject, html_body, text_body)


def _render_password_reset_text(user_name: str, reset_url: str, expiry_minutes: int) -> str:
    return (
        f"Hello {user_name},\n\n"
        "We received a request to reset your Sri Health Plus account password.\n\n"
        f"Reset your password using this link:\n{reset_url}\n\n"
        f"This link expires in {expiry_minutes} minutes.\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "Regards,\nSri Health Plus Team"
    )


def _render_password_reset_html(user_name: str, reset_url: str, expiry_minutes: int) -> str:
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset Your Sri Health Plus Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f6f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f6f5;padding:32px 0;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<tr>
<td style="background-color:#0f766e;padding:28px 32px;text-align:center;">
<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">Sri Health Plus</span>
</td>
</tr>

<tr>
<td style="padding:36px 32px 8px 32px;">
<h1 style="margin:0 0 20px 0;font-size:20px;color:#0f172a;">Reset Your Password</h1>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Hello {user_name},</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
We received a request to reset your Sri Health Plus account password. Click the button below to choose a new one.
</p>
</td>
</tr>

<tr>
<td align="center" style="padding:8px 32px 28px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="border-radius:8px;background-color:#0f766e;">
<a href="{reset_url}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Reset Password</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="padding:0 32px 28px 32px;">
<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
<p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;word-break:break-all;">
<a href="{reset_url}" style="color:#0f766e;">{reset_url}</a>
</p>
<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#64748b;">This link expires in {expiry_minutes} minutes.</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">If you did not request this, you can safely ignore this email — your password will not be changed.</p>
</td>
</tr>

<tr>
<td style="padding:24px 32px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
<p style="margin:0 0 6px 0;font-size:13px;color:#334155;">Regards,<br/>Sri Health Plus Team</p>
<p style="margin:12px 0 0 0;font-size:12px;color:#94a3b8;">
Need help? Contact us at <a href="mailto:{settings.support_email}" style="color:#0f766e;">{settings.support_email}</a>
</p>
<p style="margin:12px 0 0 0;font-size:11px;color:#94a3b8;">&copy; {_current_year()} Sri Health Plus. All rights reserved.</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
"""


def _render_verification_otp_text(user_name: str, otp_code: str, expiry_minutes: int) -> str:
    return (
        f"Hello {user_name},\n\n"
        "Thanks for signing up for Sri Health Plus. Use the code below to verify your email address:\n\n"
        f"{otp_code}\n\n"
        f"This code expires in {expiry_minutes} minutes.\n\n"
        "If you did not create this account, you can safely ignore this email.\n\n"
        "Regards,\nSri Health Plus Team"
    )


def _render_verification_otp_html(user_name: str, otp_code: str, expiry_minutes: int) -> str:
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verify Your Sri Health Plus Email Address</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f6f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f6f5;padding:32px 0;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<tr>
<td style="background-color:#0f766e;padding:28px 32px;text-align:center;">
<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">Sri Health Plus</span>
</td>
</tr>

<tr>
<td style="padding:36px 32px 8px 32px;">
<h1 style="margin:0 0 20px 0;font-size:20px;color:#0f172a;">Verify Your Email Address</h1>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Hello {user_name},</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
Thanks for signing up for Sri Health Plus. Enter the code below to verify your email address and activate your account.
</p>
</td>
</tr>

<tr>
<td align="center" style="padding:8px 32px 28px 32px;">
<div style="display:inline-block;padding:16px 36px;border-radius:10px;background-color:#f0fdfa;border:1.5px dashed #0f766e;">
<span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#0f766e;">{otp_code}</span>
</div>
</td>
</tr>

<tr>
<td style="padding:0 32px 28px 32px;">
<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#64748b;">This code expires in {expiry_minutes} minutes.</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">If you did not create this account, you can safely ignore this email.</p>
</td>
</tr>

<tr>
<td style="padding:24px 32px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
<p style="margin:0 0 6px 0;font-size:13px;color:#334155;">Regards,<br/>Sri Health Plus Team</p>
<p style="margin:12px 0 0 0;font-size:12px;color:#94a3b8;">
Need help? Contact us at <a href="mailto:{settings.support_email}" style="color:#0f766e;">{settings.support_email}</a>
</p>
<p style="margin:12px 0 0 0;font-size:11px;color:#94a3b8;">&copy; {_current_year()} Sri Health Plus. All rights reserved.</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
"""


def _current_year() -> int:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).year
