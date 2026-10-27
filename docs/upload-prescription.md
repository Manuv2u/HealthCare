# Upload Prescription (lead capture)

Visitors who don't know which tests to book upload a doctor's prescription;
the healthcare team calls back within 30 minutes to help book the right tests.

## Public flow (no login)

1. `POST /api/v1/prescriptions/send-otp` — `{mobile}`. 6-digit OTP, 5-minute
   expiry, max 3 sends per mobile per 15 minutes. In dev the OTP is printed to
   the backend logs (`🔑 OTP for …`).
2. `POST /api/v1/prescriptions/verify-otp` — `{mobile, otp}` → returns a
   short-lived signed `verification_token` (30 min).
3. `POST /api/v1/prescriptions` — multipart form: `patient_name`, `mobile`,
   `city`, `verification_token` (required); `email`, `callback_time`,
   `remarks` (optional); `files` — 1–3 files, PDF/JPG/JPEG/PNG, ≤10 MB each.
   Returns a request number like `SRI-20260711-000123` (PostgreSQL sequence
   `prescription_request_number_seq`). Confirmation SMS/email are sent
   best-effort via the configured notification providers.

Files are stored through the pluggable storage backend
(`FILE_STORAGE_BACKEND=local|s3`) under `prescriptions/<request_id>/`; the
paths are stored in `prescription_files`.

## Admin (role `admin`)

- `GET /api/v1/prescriptions` — filter `status` (new/called/booked/cancelled),
  search `q` (name/mobile/city/request number), `sort`/`order`, pagination.
- `GET /api/v1/prescriptions/stats` — today's requests, pending calls, booked,
  conversion rate (drives the dashboard cards).
- `GET /api/v1/prescriptions/{id}` — detail incl. 24h signed download URLs
  (served by the existing `/api/v1/files/download/{token}` route).
- `PUT /api/v1/prescriptions/{id}` — status, `assigned_to`, remarks.
- `DELETE /api/v1/prescriptions/{id}` — removes DB rows and stored files.
- `GET /api/v1/prescriptions/export?format=xlsx|pdf` — respects the active
  filters.

Admin UI: **Admin → Prescription Requests** (list, detail drawer with file
downloads, assignment, status actions, exports). Dashboard shows a
"Prescription Requests" stat row.

## Frontend entry points

All open the same shared dialog (`UploadPrescriptionModalComponent`, state via
`PrescriptionModalService`): navbar button, home hero button, footer "Services"
link, and the homepage sticky bottom bar ("Need Help Booking Tests?" — green
bar, yellow *Request a Call Back* CTA, phone number from contact settings).
The sticky bar hides while the dialog is open and sits above the mobile bottom
nav.

## Schema

- `prescription_requests` — request_number (unique), patient details, status
  (`new|called|booked|cancelled`), `otp_verified`, `source`
  (default `website_homepage`), `assigned_to`, timestamps.
- `prescription_files` — FK → prescription_requests (CASCADE), file name/path/
  content type/size.
- Migration: `0021_prescription_requests`.
