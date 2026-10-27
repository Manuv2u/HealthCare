"""Auto-seed the admin user on startup from env config."""
from __future__ import annotations

import logging

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User

logger = logging.getLogger("sri.admin_seed")


async def seed_admin_user(db: AsyncSession) -> None:
    """Create or update the admin user from env settings on every startup."""
    phone = settings.admin_phone
    email = settings.admin_email

    result = await db.execute(
        select(User).where((User.phone == phone) | (User.email == email))
    )
    user = result.scalar_one_or_none()

    pw_hash = bcrypt.hashpw(
        settings.admin_password.encode()[:72], bcrypt.gensalt(rounds=12)
    ).decode()

    if user:
        # Always sync password + role in case env changed
        user.role = "admin"
        user.password_hash = pw_hash
        user.is_active = True
        logger.info("✅ Admin user synced: phone=%s email=%s", phone, email)
    else:
        user = User(
            phone=phone,
            email=email,
            name=settings.admin_name,
            password_hash=pw_hash,
            role="admin",
            is_active=True,
        )
        db.add(user)
        logger.info("✅ Admin user created: phone=%s email=%s", phone, email)
