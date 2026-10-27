"""
Seed script — creates an admin user (or promotes an existing one).

Usage (inside container):
    python -m app.scripts.seed_admin

Env vars (or .env.local):
    ADMIN_PHONE   — phone number  (default: 9999999999)
    ADMIN_EMAIL   — email         (default: admin@sri.local)
    ADMIN_NAME    — display name  (default: Admin)
    ADMIN_PASSWORD — password     (default: Admin@123)
"""
from __future__ import annotations

import asyncio
import os
import sys

import bcrypt


async def main() -> None:
    # Import here so env is loaded first
    from app.database import AsyncSessionFactory
    from app.models.user import User
    from sqlalchemy import select

    phone    = os.getenv("ADMIN_PHONE",    "9999999999")
    email    = os.getenv("ADMIN_EMAIL",    "admin@sri.local")
    name     = os.getenv("ADMIN_NAME",     "Admin")
    password = os.getenv("ADMIN_PASSWORD", "Admin@123")

    pw_hash = bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt(rounds=12)).decode()

    async with AsyncSessionFactory() as db:
        # Check if user already exists by phone or email
        result = await db.execute(
            select(User).where(
                (User.phone == phone) | (User.email == email)
            )
        )
        user = result.scalar_one_or_none()

        if user:
            user.role = "admin"
            user.password_hash = pw_hash
            user.is_active = True
            print(f"✅ Promoted existing user '{user.name}' ({user.phone}) to admin")
        else:
            user = User(
                phone=phone,
                email=email,
                name=name,
                password_hash=pw_hash,
                role="admin",
                is_active=True,
            )
            db.add(user)
            print(f"✅ Created admin user: phone={phone}  email={email}  password={password}")

        await db.commit()
        print("   Login at /auth/login with phone_or_email + password")


if __name__ == "__main__":
    asyncio.run(main())
