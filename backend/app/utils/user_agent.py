"""Lightweight, dependency-free User-Agent parser.

Extracts a best-effort browser name, operating system, and device type from the raw
User-Agent header we already capture at login time. This is real parsing of a real
string — when the UA is missing or unrecognised the corresponding field is returned as
``None`` rather than a fabricated value.
"""
from __future__ import annotations

from typing import NamedTuple

# Ordered most-specific first: Edge/Opera/Brave impersonate Chrome, Chrome
# impersonates Safari, so the earlier match wins.
_BROWSERS: list[tuple[str, str]] = [
    ("Edg", "Edge"),
    ("OPR", "Opera"),
    ("Opera", "Opera"),
    ("SamsungBrowser", "Samsung Internet"),
    ("Brave", "Brave"),
    ("Vivaldi", "Vivaldi"),
    ("CriOS", "Chrome"),  # Chrome on iOS
    ("FxiOS", "Firefox"),  # Firefox on iOS
    ("Firefox", "Firefox"),
    ("Chrome", "Chrome"),
    ("Safari", "Safari"),
    ("MSIE", "Internet Explorer"),
    ("Trident", "Internet Explorer"),
]

# Ordered most-specific first: iPadOS/iOS before Mac, Android before Linux.
_OPERATING_SYSTEMS: list[tuple[str, str]] = [
    ("Windows NT 10.0", "Windows 10/11"),
    ("Windows NT 6.3", "Windows 8.1"),
    ("Windows NT 6.2", "Windows 8"),
    ("Windows NT 6.1", "Windows 7"),
    ("Windows", "Windows"),
    ("iPhone", "iOS"),
    ("iPad", "iPadOS"),
    ("iPod", "iOS"),
    ("Android", "Android"),
    ("CrOS", "ChromeOS"),
    ("Mac OS X", "macOS"),
    ("Macintosh", "macOS"),
    ("Linux", "Linux"),
]

_MOBILE_HINTS = ("Mobile", "iPhone", "iPod", "Android")
_TABLET_HINTS = ("iPad", "Tablet")
_BOT_HINTS = ("bot", "crawler", "spider", "curl", "wget", "python-requests", "httpx")


class ParsedUserAgent(NamedTuple):
    browser: str | None
    os: str | None
    device_type: str | None


def parse_user_agent(user_agent: str | None) -> ParsedUserAgent:
    """Return (browser, os, device_type) for a raw User-Agent string."""
    if not user_agent:
        return ParsedUserAgent(None, None, None)

    ua = user_agent
    ua_lower = ua.lower()

    if any(hint in ua_lower for hint in _BOT_HINTS):
        return ParsedUserAgent(None, None, "bot")

    browser = next((name for token, name in _BROWSERS if token in ua), None)
    os_name = next((name for token, name in _OPERATING_SYSTEMS if token in ua), None)

    if any(hint in ua for hint in _TABLET_HINTS):
        device_type = "tablet"
    elif any(hint in ua for hint in _MOBILE_HINTS):
        device_type = "mobile"
    else:
        device_type = "desktop"

    return ParsedUserAgent(browser, os_name, device_type)
