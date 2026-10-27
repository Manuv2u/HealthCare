"""Unit tests for EmailService's Mailtrap API delivery path."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.email_service import EmailService


@pytest.mark.asyncio
async def test_send_uses_mailtrap_api_when_token_configured() -> None:
    """With an API token configured, send() must go through mailtrap.MailtrapClient
    rather than smtplib — and never touch the network in this test."""
    svc = EmailService(api_token="test-token", sender="Sri Health Plus <noreply@srihealthplus.com>")

    with patch("mailtrap.MailtrapClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        ok = await svc.send("user@example.com", "Subject", "<p>html</p>", "text")

    assert ok is True
    mock_client_cls.assert_called_once()
    _, kwargs = mock_client_cls.call_args
    assert kwargs["token"] == "test-token"
    mock_client.send.assert_called_once()
    (mail_arg,) = mock_client.send.call_args.args
    assert mail_arg.sender.email == "noreply@srihealthplus.com"
    assert mail_arg.to[0].email == "user@example.com"
    assert mail_arg.html == "<p>html</p>"


@pytest.mark.asyncio
async def test_send_falls_back_to_smtp_without_api_token() -> None:
    """No API token configured -> SMTP path is used instead."""
    svc = EmailService(api_token="", host="localhost", port=1025)

    with patch("smtplib.SMTP") as mock_smtp_cls:
        mock_server = MagicMock()
        mock_smtp_cls.return_value = mock_server

        ok = await svc.send("user@example.com", "Subject", "<p>html</p>")

    assert ok is True
    mock_smtp_cls.assert_called_once_with("localhost", 1025, timeout=10)
    mock_server.send_message.assert_called_once()


@pytest.mark.asyncio
async def test_send_returns_false_on_delivery_failure() -> None:
    svc = EmailService(api_token="test-token")

    with patch("mailtrap.MailtrapClient") as mock_client_cls:
        mock_client_cls.return_value.send.side_effect = RuntimeError("boom")
        ok = await svc.send("user@example.com", "Subject", "<p>html</p>")

    assert ok is False
