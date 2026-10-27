"""Pydantic schemas for the site-wide contact settings (call / WhatsApp / callback)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ContactSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    phone_number: str
    whatsapp_number: str
    callback_enabled: bool
    working_hours: str | None = None
    call_enabled: bool = True
    whatsapp_enabled: bool = True


class ContactSettingsIn(BaseModel):
    phone_number: str
    whatsapp_number: str
    callback_enabled: bool = True
    working_hours: str | None = None
    call_enabled: bool = True
    whatsapp_enabled: bool = True
