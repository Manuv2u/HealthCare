# 2Factor OTP Provider — Setup Guide

2Factor (https://2factor.in) is the default SMS OTP provider for Sri Health Plus.
This guide covers account creation through production go-live.

## 1. Account creation

1. Sign up at https://2factor.in (email + Indian mobile number).
2. Verify your email and phone.
3. Buy an SMS OTP credit pack from **Billing** (transactional OTP credits;
   promotional credits will NOT deliver OTPs).

## 2. API key generation

1. Log in to the 2Factor dashboard → **API Keys** (or Settings → API).
2. Copy the key — it looks like a UUID, e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`.
3. Keep it secret. It is passed in the URL of every API call.

## 3. Sender ID configuration

- Default sender IDs (e.g. `OTPSMS`) work out of the box for OTP routes.
- For a branded sender ID (e.g. `SRILAB`), apply on the 2Factor dashboard under
  **Sender ID** — requires DLT registration (see below).

### DLT registration (mandatory in India)

Indian TRAI regulations require DLT (Distributed Ledger Technology) registration
for commercial SMS:

1. Register the business on a DLT portal (Jio/Airtel/Vodafone/BSNL — any one).
2. Register your **header** (sender ID) and **content template**.
3. Add the DLT template ID in the 2Factor dashboard.

Plain AUTOGEN OTP routes usually work without custom DLT templates, but branded
sender IDs and custom message text require it.

## 4. Template setup (optional)

The app sends the OTP value explicitly (`SMS/{phone}/{otp}` API). If you want a
custom message body:

1. In the 2Factor dashboard create an OTP template, e.g.
   `Your Sri Health Plus verification code is ##OTP##. Valid for 10 minutes.`
2. Note the template name.
3. Set `TWOFACTOR_TEMPLATE=<template name>` in the backend environment.

Leave `TWOFACTOR_TEMPLATE` empty to use 2Factor's default OTP message.

## 5. Environment variables

| Variable | Required | Example | Notes |
|---|---|---|---|
| `OTP_PROVIDER` | no (default `twofactor`) | `twofactor` | Env-level default; Admin → OTP Management can override at runtime. |
| `TWOFACTOR_API_KEY` | yes (for real sends) | `a1b2c3d4-…` | Without it the provider reports **Unconfigured**; local/test fall back to the mock provider. |
| `TWOFACTOR_TEMPLATE` | no | `SRIOTP` | Custom OTP template name. |
| `OTP_TTL_MINUTES` | no (default 10) | `10` | Code validity. |
| `OTP_MAX_VERIFY_ATTEMPTS` | no (default 5) | `5` | Wrong guesses before the code is destroyed. |
| `OTP_RESEND_COOLDOWN_SECONDS` | no (default 30) | `30` | Minimum gap between sends per phone. |
| `OTP_MAX_SENDS_PER_WINDOW` | no (default 5) | `5` | Send cap per phone per window. |
| `OTP_SEND_WINDOW_MINUTES` | no (default 15) | `15` | The rolling window for the cap. |

Set them in `backend/.env.local` (dev) or the deployment `.env` file (prod);
docker-compose passes them through automatically via `env_file`.

## 6. API calls used

| Purpose | Call |
|---|---|
| Send OTP (own code) | `GET https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}[/{template}]` |
| Balance | `GET https://2factor.in/API/V1/{api_key}/BAL/SMS` |

Responses: `{"Status": "Success" | "Error", "Details": "..."}`. The `Details`
of a successful send is the 2Factor session id and is stored as the
`provider_message_id` on the `otp_send_events` audit row.

## 7. Test environment

- With no `TWOFACTOR_API_KEY` and `ENV_PROFILE=local|test`, the app uses the
  **mock provider**: OTPs are written to the backend log
  (`🔑 OTP for <phone> → <code>`), and everything else behaves identically.
- To test real delivery pre-production, set the API key in `.env.local` — the
  factory then uses 2Factor even in the local profile.

## 8. Production setup checklist

1. `TWOFACTOR_API_KEY` set in the production `.env`.
2. `ENV_PROFILE` **not** `local`/`test`.
3. Admin → OTP Management shows provider **Active** with a credit balance.
4. Send yourself a login OTP; check *Last OTP Sent* updates and the SMS arrives.
5. Confirm credits: keep at least a week of headroom; recharge from the
   dashboard link on the OTP Management page.

## 9. Troubleshooting & common errors

| Symptom | Likely cause | Fix |
|---|---|---|
| Status "Unconfigured" | API key missing | Set `TWOFACTOR_API_KEY` and restart backend. |
| `Invalid API Key` in health detail | Wrong/rotated key | Regenerate on dashboard, update env. |
| OTP not received, send shows `sent` | DND number, telecom delay, DLT mismatch | Check delivery report on the 2Factor dashboard; verify DLT template. |
| Sends failing with balance error | Credits exhausted | Recharge (link on OTP Management page). |
| Users report "Too many OTP requests" | Rate limiting working as intended | Wait out the window, or raise `OTP_MAX_SENDS_PER_WINDOW`. |
| Works locally, not in prod | Prod env missing key or egress blocked | Check env + outbound HTTPS to 2factor.in. |

All send attempts (success and failure, with provider error text) are stored in
the `otp_send_events` table and drive the statistics on Admin → OTP Management.
