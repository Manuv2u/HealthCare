# Requirements Document

## Introduction

SRI HEALTH PLUS — DIAGNOSTIC LABORATORY & HEALTH CARE is a full-stack diagnostic laboratory and healthcare platform built with FastAPI (backend), Angular (frontend), and PostgreSQL (database), deployed via Docker Compose. The platform enables patients to book lab tests online or schedule home sample collection, track their sample status, download reports, and manage family health records. Lab technicians can manage assigned bookings and upload reports. Admins have full control over tests, packages, pricing, service areas, technicians, and analytics.

## Glossary

- **System**: The Sri Health Plus — Diagnostic Laboratory & Health Care platform as a whole
- **Auth_Service**: The authentication and authorization subsystem handling JWT tokens, OTP, and role-based access
- **User**: A registered patient who books tests and downloads reports
- **Admin**: The platform owner with full system control
- **Technician**: A lab technician who collects samples and uploads reports
- **Booking**: A confirmed reservation for one or more lab tests or packages
- **Booking_Item**: An individual test or package line within a Booking
- **Test**: A single diagnostic test offered by the laboratory (e.g., CBC, HbA1c)
- **Package**: A predefined or custom bundle of Tests offered at a discounted price
- **Report**: A diagnostic result document (PDF) associated with a Booking
- **Service_Area**: A geographic region (district, city, or pincode) where home collection is available
- **Technician_Assignment**: The association between a Technician and a Booking for home collection
- **Payment**: A financial transaction associated with a Booking
- **Family_Member**: A patient profile linked to a User account for booking on behalf of others
- **Notification**: An SMS or email message sent to a User at key booking lifecycle events
- **OTP**: A one-time password used for phone-based registration and verification
- **JWT**: JSON Web Token used for stateless authentication
- **GST**: Goods and Services Tax applied to invoices
- **Time_Slot**: A defined time window (e.g., 08:00–09:00) during which bookings can be scheduled
- **Slot_Capacity**: The maximum number of Bookings permitted within a single Time_Slot
- **Lab_Branch**: A physical laboratory location where patients can visit for sample collection
- **Audit_Log**: An immutable record of a critical system action including actor, action type, timestamp, and affected entity
- **File_Storage**: The storage backend (local filesystem, S3-compatible object store, or cloud provider) used to persist Report files
- **Webhook**: An HTTP callback sent by a payment gateway to notify the System of a payment event
- **Refund**: A reversal of a completed Payment, returning funds to the User
- **Soft_Delete**: A logical deletion that marks a record as inactive without removing it from the database
- **Pagination**: A mechanism to return large result sets in fixed-size pages using limit/offset or cursor parameters
- **API_Version**: A URL-path prefix (e.g., `/api/v1/`) that identifies the version of the API contract in use
- **Health_Check**: An endpoint that reports the operational status of the System and its dependencies
- **Migration**: A versioned, incremental database schema change script managed by Alembic and applied in sequence to evolve the database schema without data loss
- **CI_CD_Pipeline**: An automated workflow (e.g., GitHub Actions) that builds, lints, tests, and packages the application on every code change before producing a deployable artefact
- **Feature_Flag**: A named boolean configuration record stored in the database that enables or disables a specific system feature at runtime without requiring a deployment
- **Archive**: A separate database table or cold storage destination used to store Booking, Payment, and related records that have exceeded the active retention window but must be preserved for compliance

---

## Requirements

### Requirement 1: User Registration

**User Story:** As a new patient, I want to register an account using my phone number or email, so that I can book tests and access my reports.

#### Acceptance Criteria

1. WHEN a user submits a registration request with a valid phone number, THE Auth_Service SHALL send an OTP to that phone number within 30 seconds.
2. WHEN a user submits a registration request with a valid email address, THE Auth_Service SHALL send a verification link to that email address within 60 seconds.
3. WHEN a user submits a valid OTP within 10 minutes of generation, THE Auth_Service SHALL create a User account and return a JWT access token.
4. IF a user submits an OTP that has expired or is incorrect, THEN THE Auth_Service SHALL return an error response with a descriptive message and SHALL NOT create an account.
5. IF a registration request is submitted with a phone number or email that already exists, THEN THE Auth_Service SHALL return a conflict error and SHALL NOT create a duplicate account.
6. THE Auth_Service SHALL store passwords using a one-way cryptographic hash (bcrypt with cost factor ≥ 12).

---

### Requirement 2: User Authentication

**User Story:** As a registered user, I want to log in and log out securely, so that my health data remains private.

#### Acceptance Criteria

1. WHEN a user submits valid credentials (phone/email and password), THE Auth_Service SHALL return a signed JWT access token with a 24-hour expiry and a refresh token with a 7-day expiry.
2. WHEN a user submits a valid refresh token, THE Auth_Service SHALL issue a new access token without requiring re-authentication.
3. WHEN a user logs out, THE Auth_Service SHALL invalidate the refresh token so it cannot be reused.
4. IF a user submits invalid credentials, THEN THE Auth_Service SHALL return an authentication error and SHALL NOT reveal whether the phone/email or password was incorrect.
5. THE Auth_Service SHALL enforce role-based access control, granting Admin, Technician, and User roles distinct permission sets.
6. IF a request is made to a protected endpoint without a valid JWT, THEN THE Auth_Service SHALL return a 401 Unauthorized response.
7. WHEN a login or OTP verification attempt is made, THE Auth_Service SHALL enforce a rate limit of 5 attempts per IP address per 15-minute window and SHALL return HTTP 429 with a `Retry-After` header indicating the reset time when the limit is exceeded.
8. THE System SHALL track active sessions per User, recording device identifier, IP address, and last-seen timestamp for each session.
9. WHEN a User requests to view active sessions, THE System SHALL return a list of all current sessions with device identifier, IP address, and last-seen timestamp.
10. WHEN a User revokes an individual session, THE Auth_Service SHALL invalidate that session's refresh token immediately.
11. WHEN a User selects "logout from all devices", THE Auth_Service SHALL invalidate all active refresh tokens for that User simultaneously.
12. THE System SHALL allow unauthenticated users to browse the test catalog and package listings without requiring login.
13. THE System SHALL require login only for protected actions: creating a booking, viewing reports, accessing profile/family members, and making payments.
14. WHEN an unauthenticated user attempts to access a protected route, THE System SHALL redirect them to the login page with a `returnUrl` query parameter preserving their intended destination, and SHALL redirect them back to that destination after successful login.

---

### Requirement 3: User Profile and Family Members

**User Story:** As a registered user, I want to manage my profile and add family members, so that I can book tests on behalf of my family.

#### Acceptance Criteria

1. THE System SHALL allow a User to update their name, date of birth, gender, and contact details.
2. THE System SHALL allow a User to add up to 10 Family_Member profiles linked to their account, each with a name, date of birth, gender, and relationship.
3. WHEN a User adds a Family_Member, THE System SHALL associate the Family_Member with the User's account and make it selectable during booking.
4. THE System SHALL allow a User to edit or remove a Family_Member profile.
5. IF a User attempts to add more than 10 Family_Member profiles, THEN THE System SHALL return a validation error.

---

### Requirement 4: Test Management

**User Story:** As an Admin, I want to create, update, and delete diagnostic tests with pricing and metadata, so that patients can browse and book accurate offerings.

#### Acceptance Criteria

1. THE System SHALL allow an Admin to create a Test with the following required fields: name, category, description, price, discount percentage, and turnaround time in hours.
2. THE System SHALL allow an Admin to update any field of an existing Test.
3. WHEN an Admin deletes a Test, THE System SHALL soft-delete the Test record and SHALL NOT remove it from existing Bookings.
4. THE System SHALL support the following test categories: Blood, Urine, Thyroid, Diabetes, Lipid, Liver, Kidney, Hormone, Vitamin, and Other.
5. WHEN a User searches for tests by name or category, THE System SHALL return matching results within 500ms for datasets up to 10,000 tests.
6. THE System SHALL display the discounted price when a discount percentage greater than 0 is set on a Test.
7. THE System SHALL maintain database indexes on test name (using full-text or trigram indexing), category, and associated pincode/service area fields to support sub-500ms search response times for datasets exceeding 10,000 records.

---

### Requirement 5: Health Packages

**User Story:** As an Admin, I want to create predefined and custom health packages, so that patients can book bundled tests at a discount.

#### Acceptance Criteria

1. THE System SHALL allow an Admin to create a Package with a name, description, list of included Tests, original price, and discounted price.
2. THE System SHALL allow an Admin to create a custom Package by selecting any combination of available Tests.
3. THE System SHALL allow a User to view all active Packages and their included Tests.
4. WHEN a User adds a Package to a Booking, THE System SHALL apply the Package's discounted price as the line-item cost.
5. THE System SHALL allow an Admin to enable or disable a Package without deleting it.
6. IF a Package contains a soft-deleted Test, THEN THE System SHALL exclude that Test from the Package's displayed contents but SHALL retain the historical record.

---

### Requirement 6: Service Area Management

**User Story:** As an Admin, I want to manage service areas by pincode, city, and district, so that home collection is only offered where the lab operates.

#### Acceptance Criteria

1. THE System SHALL allow an Admin to add a Service_Area record with district, city, and pincode fields.
2. THE System SHALL allow an Admin to enable or disable any Service_Area.
3. WHEN a User submits a pincode during booking, THE System SHALL check whether an active Service_Area record exists for that pincode.
4. IF no active Service_Area exists for the submitted pincode, THEN THE System SHALL return a "Service not available in your area" message and SHALL present a "Notify Me" option.
5. WHEN a User submits a "Notify Me" request for an unavailable pincode, THE System SHALL store a Service_Request record with the User's contact details and the requested pincode.
6. WHEN a Service_Area is enabled for a pincode that has pending Service_Request records, THE System SHALL send a Notification to each requesting User within 1 hour.
7. THE System SHALL display the list of currently supported locations including Shivamogga, Davanagere, and Chikkamagaluru.

---

### Requirement 7: Booking System

**User Story:** As a User, I want to book one or more tests or packages for myself or a family member, so that I can get diagnostic services at home or at the lab.

#### Acceptance Criteria

1. WHEN a User creates a Booking, THE System SHALL require selection of: patient (self or Family_Member), at least one Test or Package, collection type (home collection or lab visit), and a preferred Time_Slot on the chosen date.
2. WHERE home collection is selected, THE System SHALL require a valid active Service_Area pincode before confirming the Booking.
3. WHERE lab visit is selected, THE System SHALL require the User to select a Lab_Branch and SHALL display the branch address before confirming the Booking.
4. WHEN a User selects a date and collection type, THE System SHALL display only Time_Slots that have remaining capacity greater than zero.
5. WHEN a Booking is confirmed, THE System SHALL decrement the available capacity of the selected Time_Slot by one and assign a unique booking reference number with initial status "Booked".
6. IF a User attempts to book a Time_Slot whose capacity has reached the Slot_Capacity limit, THEN THE System SHALL return a validation error and SHALL NOT create the Booking.
7. THE System SHALL allow a User to cancel a Booking at least 2 hours before the scheduled collection time.
8. THE System SHALL allow a User to reschedule a Booking to a different date and Time_Slot at least 2 hours before the original scheduled time.
9. WHEN a Booking is cancelled or rescheduled, THE System SHALL restore the capacity of the original Time_Slot and send a Notification to the User within 5 minutes.
10. THE System SHALL allow an Admin to assign a Technician to a home-collection Booking.
11. IF a User attempts to book a Test that is soft-deleted, THEN THE System SHALL return a validation error and SHALL NOT create the Booking.
12. WHEN a Booking is created, THE System SHALL execute the capacity decrement and Booking record insertion within a single database transaction using serializable or repeatable-read isolation level to prevent double-booking race conditions.
13. THE System SHALL enforce a unique constraint at the database level on the combination of (time_slot_id, date, booking_count) to prevent concurrent transactions from exceeding Slot_Capacity.
14. THE System SHALL generate the booking reference number in the format `SRI-{YYYY}-{NNNNNN}` where `{YYYY}` is the four-digit booking year and `{NNNNNN}` is a six-digit zero-padded sequence number (e.g., SRI-2026-000123), generated atomically to guarantee uniqueness across concurrent requests.

---

### Requirement 8: Home Collection Status Tracking

**User Story:** As a User, I want to track the status of my home sample collection in real time, so that I know when my sample has been collected and when my report will be ready.

#### Acceptance Criteria

1. THE System SHALL track Booking status through the following ordered states: Booked → Collected → Processing → Completed.
2. WHEN a Technician updates a Booking status to "Collected", THE System SHALL record the collection timestamp and send a Notification to the User.
3. WHEN an Admin or Technician updates a Booking status to "Processing", THE System SHALL record the processing start timestamp.
4. WHEN a Report is uploaded for a Booking, THE System SHALL automatically update the Booking status to "Completed" and send a Notification to the User.
5. THE System SHALL allow a User to view the current status and status history of any of their Bookings.
6. IF a Technician attempts to set a Booking status to a state that does not follow the defined order, THEN THE System SHALL return a validation error.

---

### Requirement 9: Technician Management

**User Story:** As an Admin, I want to manage technician accounts, assignments, and workload, so that home collections are handled by qualified and available staff.

#### Acceptance Criteria

1. THE System SHALL allow an Admin to create a Technician account with name, phone number, email, and assigned service areas.
2. THE System SHALL allow an Admin to assign a Technician to one or more Service_Areas.
3. WHEN an Admin assigns a Technician to a Booking, THE System SHALL send a Notification to the Technician with booking details within 5 minutes.
4. THE System SHALL allow a Technician to view all Bookings assigned to them, filtered by date.
5. THE System SHALL allow an Admin to deactivate a Technician account without deleting historical assignment records.
6. IF an Admin attempts to assign a deactivated Technician to a Booking, THEN THE System SHALL return a validation error.
7. THE System SHALL enforce a maximum of 20 Bookings per Technician per calendar day and SHALL prevent assignment of a Booking to a Technician who has reached that limit.
8. WHEN an Admin requests auto-assignment for a home-collection Booking, THE System SHALL select the active Technician in the matching Service_Area who has the fewest Bookings on the requested date and assign that Technician to the Booking.
9. THE System SHALL allow an Admin to view a workload summary showing each Technician's assigned Booking count for a selected date.

---

### Requirement 10: Report Management

**User Story:** As a User, I want to download my diagnostic reports as PDFs, so that I can share them with my doctor.

#### Acceptance Criteria

1. THE System SHALL allow an Admin or Technician to upload a Report file (PDF, max 20 MB) and associate it with a Booking.
2. WHEN a Report is uploaded, THE System SHALL store the file in the configured File_Storage backend and generate a time-limited (24-hour) download URL for the User.
3. THE System SHALL allow a User to view and download all Reports associated with their Bookings.
4. THE System SHALL maintain a Report history showing upload timestamp, uploader role, and associated Booking reference.
5. IF a User attempts to access a Report that does not belong to their account, THEN THE System SHALL return a 403 Forbidden response.
6. WHERE the System generates a PDF report automatically, THE System SHALL include patient name, test name, result values, reference ranges, and report date.
7. THE System SHALL support configuring File_Storage as either a local filesystem path or an S3-compatible object store via environment variables, without requiring code changes.
8. THE System SHALL enforce that Report download URLs are signed or token-protected so that only the authenticated owning User can retrieve the file.

---

### Requirement 11: Payment and Billing

**User Story:** As a User, I want to pay for my bookings online or in cash, so that I can complete my booking conveniently.

#### Acceptance Criteria

1. THE System SHALL support the following payment methods: UPI, credit/debit card, and cash on collection.
2. WHEN a User selects an online payment method, THE System SHALL redirect to a payment gateway and record the transaction result.
3. WHEN a Payment is successfully completed, THE System SHALL update the Booking payment status to "Paid" and generate an invoice.
4. THE System SHALL generate an invoice with itemised Booking_Items, applicable GST amount, total amount, and a unique invoice number.
5. IF a Payment transaction fails, THEN THE System SHALL retain the Booking in "Pending Payment" status and allow the User to retry payment.
6. WHEN cash on collection is selected, THE System SHALL set the payment status to "Pending" and allow a Technician or Admin to mark it as "Paid" upon collection.
7. THE System SHALL allow a User to download their invoice as a PDF.
8. WHEN the payment gateway sends a Webhook event to the System's payment callback endpoint, THE System SHALL verify the event signature, update the corresponding Payment record, and return HTTP 200 within 5 seconds.
9. IF a Webhook event is received for a Payment that is already in "Paid" status, THEN THE System SHALL acknowledge the event with HTTP 200 and SHALL NOT create a duplicate payment record.
10. WHEN an Admin initiates a Refund for a completed Payment, THE System SHALL call the payment gateway refund API, record the Refund with amount, reason, and timestamp, and update the Booking payment status to "Refunded".
11. IF a Refund request to the payment gateway fails, THEN THE System SHALL retain the Payment in its current status, log the failure with error details, and return a descriptive error to the Admin.

---

### Requirement 12: Notifications

**User Story:** As a User, I want to receive SMS and email notifications at key stages of my booking, so that I stay informed without checking the app.

#### Acceptance Criteria

1. THE System SHALL send an SMS and email Notification to the User upon Booking confirmation.
2. THE System SHALL send an SMS and email Notification to the User when the sample is collected (status → "Collected").
3. THE System SHALL send an SMS and email Notification to the User when the Report is ready (status → "Completed").
4. THE System SHALL send an SMS and email Notification to the User when a Booking is cancelled or rescheduled.
5. IF a Notification delivery fails, THEN THE System SHALL retry delivery up to 3 times with exponential backoff before logging the failure.
6. THE System SHALL log all Notification attempts with timestamp, channel (SMS/email), status (sent/failed), and associated Booking reference.

---

### Requirement 13: Admin Dashboard and Analytics

**User Story:** As an Admin, I want a dashboard showing key metrics, so that I can monitor business performance.

#### Acceptance Criteria

1. THE System SHALL display on the Admin dashboard: total registered users, total bookings (today / this month), total revenue (today / this month), and pending bookings count.
2. THE System SHALL allow an Admin to filter analytics by date range, service area, and test category.
3. THE System SHALL display a breakdown of bookings by status (Booked, Collected, Processing, Completed, Cancelled).
4. THE System SHALL display a revenue breakdown by payment method (UPI, card, cash).
5. WHEN an Admin exports analytics data, THE System SHALL generate a CSV file containing the filtered dataset.

---

### Requirement 14: Role-Based Access Control

**User Story:** As a system owner, I want strict role-based access control, so that users can only perform actions appropriate to their role.

#### Acceptance Criteria

1. THE Auth_Service SHALL enforce that only Admin role tokens can access test management, package management, technician management, service area management, and analytics endpoints.
2. THE Auth_Service SHALL enforce that Technician role tokens can access assigned booking views, status update endpoints, and report upload endpoints only.
3. THE Auth_Service SHALL enforce that User role tokens can access their own profile, family members, bookings, reports, and payment endpoints only.
4. IF a request is made to an endpoint with a token whose role lacks the required permission, THEN THE Auth_Service SHALL return a 403 Forbidden response.
5. THE System SHALL log all 401 and 403 responses with the endpoint path, HTTP method, and timestamp for security auditing.

---

### Requirement 15: API Design and Data Serialization

**User Story:** As a developer, I want well-defined API contracts with consistent serialization and versioning, so that the frontend and backend integrate reliably across releases.

#### Acceptance Criteria

1. THE System SHALL expose all API endpoints under the versioned path prefix `/api/v1/`, so that future breaking changes can be introduced under `/api/v2/` without affecting existing clients.
2. THE System SHALL serialize and deserialize all API request and response bodies as JSON.
3. FOR ALL valid API request objects, serializing then deserializing SHALL produce an equivalent object (round-trip property).
4. THE System SHALL validate all incoming request payloads against defined schemas and return a 422 Unprocessable Entity response with field-level error details for invalid inputs.
5. THE System SHALL return consistent error response objects with the fields: `status_code`, `error_code`, `error`, and `message` for all 4xx and 5xx responses.
6. THE System SHALL provide an OpenAPI (Swagger) specification document accessible at `/docs`.
7. WHEN a list endpoint is called, THE System SHALL support `limit` (default 20, max 100) and `offset` query parameters and SHALL return a response envelope containing `total`, `limit`, `offset`, and `items` fields.
8. WHEN a list endpoint is called with a `sort_by` query parameter, THE System SHALL sort the result set by the specified field in the direction indicated by the `order` parameter (`asc` or `desc`).

---

### Requirement 16: Infrastructure and Deployment

**User Story:** As a DevOps engineer, I want the platform containerised with Docker Compose, so that it can be deployed consistently across environments.

#### Acceptance Criteria

1. THE System SHALL provide a `docker-compose.yml` that defines three services: `backend` (FastAPI), `frontend` (Angular), and `postgres` (PostgreSQL).
2. THE System SHALL configure the `postgres` service with a named volume for persistent data storage.
3. THE System SHALL configure all sensitive values (database credentials, JWT secret, payment gateway keys) as environment variables, not hardcoded values.
4. WHEN the `docker-compose up` command is executed, THE System SHALL start all three services and the backend SHALL be reachable within 60 seconds.
5. THE System SHALL include a health-check endpoint at `GET /health` that returns HTTP 200 when the backend and database connection are operational.
6. THE System SHALL support environment-specific configuration profiles (local, staging, production) loaded via separate `.env` files or environment variable prefixes, so that no code changes are required to switch between environments.
7. THE System SHALL include a CI/CD pipeline definition (e.g., a GitHub Actions workflow file) that executes build, lint, and test stages in sequence and produces a deployable Docker image only when all stages pass.
8. THE System SHALL manage database schema changes via Alembic migration files versioned in source control, and SHALL apply pending migrations automatically on container startup before the application begins serving requests.

---

### Requirement 17: Time Slot Management

**User Story:** As an Admin, I want to define available time slots with capacity limits, so that bookings are distributed evenly and overbooking is prevented.

#### Acceptance Criteria

1. THE System SHALL allow an Admin to create a Time_Slot with a start time, end time, collection type (home collection or lab visit), applicable days of the week, and a Slot_Capacity value.
2. THE System SHALL allow an Admin to update the Slot_Capacity of an existing Time_Slot.
3. THE System SHALL allow an Admin to enable or disable a Time_Slot without deleting it.
4. WHEN a User queries available Time_Slots for a given date and collection type, THE System SHALL return only Time_Slots that are enabled and have remaining capacity greater than zero.
5. THE System SHALL track the number of confirmed Bookings per Time_Slot per date and SHALL prevent the count from exceeding the defined Slot_Capacity.
6. IF a Booking is cancelled or rescheduled away from a Time_Slot, THE System SHALL increment the available capacity of that Time_Slot by one.
7. WHEN a Booking is rescheduled to a new Time_Slot, THE System SHALL atomically decrement the new slot's capacity and increment the original slot's capacity to prevent race conditions.

---

### Requirement 18: Lab Branch Management

**User Story:** As an Admin, I want to manage lab branch locations, so that patients choosing lab visits can select a branch and see its address.

#### Acceptance Criteria

1. THE System SHALL allow an Admin to create a Lab_Branch record with name, full address, city, pincode, phone number, and operating hours.
2. THE System SHALL allow an Admin to enable or disable a Lab_Branch without deleting it.
3. WHEN a User selects the lab visit collection type during booking, THE System SHALL display all active Lab_Branch records with their names and full addresses.
4. THE System SHALL require a User to select exactly one active Lab_Branch when creating a lab visit Booking.
5. WHEN a lab visit Booking is confirmed, THE System SHALL store the selected Lab_Branch reference on the Booking record.
6. THE System SHALL allow a User to view the Lab_Branch address and operating hours from their confirmed Booking details.

---

### Requirement 19: Audit Logging

**User Story:** As a system owner, I want immutable audit logs for critical actions, so that I can investigate security incidents and compliance issues.

#### Acceptance Criteria

1. THE System SHALL create an Audit_Log entry for each of the following actions: user login attempt (success or failure), report upload, test create/update/delete, payment status update, and refund initiation.
2. WHEN an Audit_Log entry is created, THE System SHALL record: actor identity (user ID and role), action type, affected entity type and ID, outcome (success or failure), source IP address, and UTC timestamp.
3. THE System SHALL store Audit_Log entries in an append-only manner so that existing entries cannot be modified or deleted through the application API.
4. THE System SHALL allow an Admin to query Audit_Log entries filtered by actor, action type, entity type, date range, and outcome, with Pagination support.
5. IF writing an Audit_Log entry fails, THEN THE System SHALL log the failure to the application error log and SHALL NOT block the originating operation.

---

### Requirement 20: Data Security and Compliance

**User Story:** As a system owner, I want data encrypted at rest and in transit, so that patient health information is protected against unauthorised access.

#### Acceptance Criteria

1. THE System SHALL enforce HTTPS for all client-facing endpoints by rejecting plain HTTP requests with a 301 redirect to the HTTPS equivalent.
2. THE System SHALL configure the PostgreSQL volume and any File_Storage backend to use encryption at rest, enabled via environment variable configuration.
3. THE System SHALL log every access to a Report download URL, recording the accessing User ID, Report ID, and UTC timestamp.
4. THE System SHALL log every access to patient personal data endpoints (profile, family members, booking details), recording the accessing User ID, endpoint path, and UTC timestamp.
5. THE System SHALL set the `Secure`, `HttpOnly`, and `SameSite=Strict` attributes on all authentication cookies.
6. THE System SHALL include `Content-Security-Policy`, `X-Content-Type-Options`, and `X-Frame-Options` HTTP response headers on all frontend responses.

---

### Requirement 21: Soft Delete Consistency

**User Story:** As an Admin, I want consistent soft delete behaviour across all major entities, so that historical data is preserved while inactive records are hidden from normal operations.

#### Acceptance Criteria

1. WHEN an Admin deletes a Test, Package, Technician, or User account, THE System SHALL set a `deleted_at` timestamp on the record and SHALL NOT physically remove the row from the database.
2. THE System SHALL exclude soft-deleted records from all list and search API responses by default.
3. THE System SHALL allow an Admin to retrieve soft-deleted records by passing an `include_deleted=true` query parameter on Admin-only list endpoints.
4. IF a soft-deleted entity is referenced in an existing Booking or historical record, THEN THE System SHALL retain the reference and display the entity's last known name and details in that historical context.
5. THE System SHALL prevent a soft-deleted Technician from being assigned to new Bookings and SHALL prevent a soft-deleted User from authenticating.

---

### Requirement 22: Notify Me Rate Limiting and Deduplication

**User Story:** As a system owner, I want the Notify Me feature to prevent duplicate requests and abuse, so that the notification queue remains manageable.

#### Acceptance Criteria

1. IF a User submits a "Notify Me" request for a pincode for which an active Service_Request already exists for that User, THEN THE System SHALL return a 409 Conflict response and SHALL NOT create a duplicate Service_Request record.
2. THE System SHALL enforce a rate limit of 5 "Notify Me" requests per User per 24-hour period across all pincodes.
3. IF a User exceeds the rate limit, THEN THE System SHALL return a 429 Too Many Requests response with a `Retry-After` header indicating when the limit resets.
4. THE System SHALL allow an Admin to view all pending Service_Request records grouped by pincode, showing the count of requesting Users per pincode.

---

### Requirement 23: Standardised Error Handling

**User Story:** As a developer, I want all API errors to follow a consistent format with defined error codes, so that the frontend can handle errors predictably.

#### Acceptance Criteria

1. THE System SHALL return all error responses in the following JSON structure: `{ "status_code": <integer>, "error_code": <string>, "error": <string>, "message": <string> }`.
2. THE System SHALL define and document a catalogue of application-level `error_code` values (e.g., `SLOT_CAPACITY_EXCEEDED`, `SERVICE_AREA_UNAVAILABLE`, `DUPLICATE_NOTIFY_REQUEST`) in the OpenAPI specification.
3. WHEN an unhandled exception occurs, THE System SHALL return a 500 Internal Server Error response using the standard error structure with `error_code` set to `INTERNAL_ERROR` and SHALL NOT expose stack traces or internal details to the client.
4. THE System SHALL handle all validation errors from request schema validation and return a 422 response with an `errors` array, where each element contains `field`, `error_code`, and `message`.
5. FOR ALL error responses, the `status_code` field in the response body SHALL match the HTTP status code of the response (consistency property).

---

### Requirement 24: System Monitoring and Logging

**User Story:** As a DevOps engineer, I want structured application logs and health monitoring, so that I can detect and diagnose issues in production.

#### Acceptance Criteria

1. THE System SHALL emit structured JSON log entries for every inbound HTTP request, including: HTTP method, path, response status code, response time in milliseconds, and UTC timestamp.
2. THE System SHALL emit a structured JSON log entry at ERROR level for every unhandled exception, including the exception type, message, and stack trace.
3. THE System SHALL expose a `/health` endpoint that returns HTTP 200 with a JSON body containing the status of the database connection and File_Storage connectivity.
4. THE System SHALL expose a `/metrics` endpoint (or equivalent) that reports request count, error rate, and average response time, compatible with Prometheus scraping format.
5. WHEN the database connection is unavailable, THE System SHALL return HTTP 503 from the `/health` endpoint and SHALL log a CRITICAL level entry.
6. THE System SHALL support configuring the minimum log level (DEBUG, INFO, WARNING, ERROR) via an environment variable without requiring a code change.

---

### Requirement 25: Backup and Recovery

**User Story:** As a system owner, I want automated database backups and a documented recovery procedure, so that patient data can be restored after a failure.

#### Acceptance Criteria

1. THE System SHALL include a scheduled backup mechanism that creates a full PostgreSQL dump once every 24 hours and stores it in a configurable backup destination (local volume or S3-compatible store).
2. THE System SHALL retain daily backups for a minimum of 7 days before automatic deletion.
3. THE System SHALL log the outcome (success or failure) of each backup operation with a timestamp and the size of the backup file in bytes.
4. IF a scheduled backup fails, THEN THE System SHALL emit an ERROR level log entry and SHALL send an alert Notification to the configured Admin email address.
5. THE System SHALL include a documented recovery procedure (in the project README) describing the steps to restore the database from a backup file, with an expected recovery time objective of 4 hours.

---

### Requirement 26: Frontend UX States

**User Story:** As a User, I want the frontend to clearly communicate loading, empty, and error states, so that I always understand what is happening and what actions are available.

#### Acceptance Criteria

1. WHILE an API request is in progress, THE System SHALL display a loading indicator on the relevant UI component and SHALL disable interactive controls that would trigger duplicate requests.
2. WHEN an API response returns an empty result set, THE System SHALL display a contextual empty-state message (e.g., "No bookings found") rather than a blank area.
3. WHEN an API response returns an error, THE System SHALL display a human-readable error message derived from the API error response `message` field and SHALL provide a retry action where applicable.
4. WHILE a User's pincode is not covered by an active Service_Area, THE System SHALL disable the home collection booking option and display a "Not available in your area" message with a "Notify Me" call-to-action.
5. WHEN a Time_Slot has no remaining capacity, THE System SHALL display it as unavailable in the slot selection UI and SHALL NOT allow the User to select it.
6. IF a session token expires during an active session, THEN THE System SHALL redirect the User to the login page and display a "Session expired, please log in again" message.

---

### Requirement 27: Data Retention Policy

**User Story:** As a system owner, I want a documented and enforced data retention policy, so that the platform complies with healthcare data regulations and manages storage costs.

#### Acceptance Criteria

1. THE System SHALL retain all Report files and associated Booking records for a minimum of 7 years from the date of the Booking to satisfy healthcare compliance requirements.
2. WHEN a Booking or Payment record exceeds 3 years of age, THE System SHALL automatically archive it to a separate archive table or cold storage destination and remove it from the primary operational tables.
3. THE System SHALL log each archival operation with the entity type, entity ID, archival timestamp, and destination.
4. IF an archival operation fails for any record, THEN THE System SHALL log the failure with the entity type, entity ID, and error details, and SHALL retry the operation in the next scheduled archival run.
5. THE System SHALL implement a documented data deletion policy: WHEN a User submits an account deletion request, THE System SHALL anonymise all personally identifiable fields on the User record and associated Family_Member records within 30 days, while retaining anonymised Booking and Payment records for the required retention period.
6. THE System SHALL prevent deletion of any Report or Booking record that is within its mandatory 7-year retention window through application-level and database-level constraints.

---

### Requirement 28: Feature Flags

**User Story:** As an Admin, I want to enable or disable named features at runtime, so that I can roll out or roll back functionality without requiring a new deployment.

#### Acceptance Criteria

1. THE System SHALL provide an Admin-accessible API to create, read, update, and delete Feature_Flag records, each identified by a unique string key (e.g., `home_collection`, `online_payment`, `notify_me`).
2. THE System SHALL store Feature_Flag state (enabled/disabled) in the database as the source of truth.
3. THE System SHALL cache Feature_Flag state in an in-process or shared cache with a maximum TTL of 60 seconds, so that flag changes propagate to all running instances within 60 seconds without requiring a restart.
4. WHEN a feature is controlled by a Feature_Flag and the flag is disabled, THE System SHALL return a 403 Forbidden response with `error_code` set to `FEATURE_DISABLED` for any request that attempts to use that feature.
5. WHEN an Admin updates a Feature_Flag, THE System SHALL create an Audit_Log entry recording the flag key, previous state, new state, and the Admin's identity.
6. THE System SHALL seed the database with default Feature_Flag records for `home_collection`, `online_payment`, and `notify_me` on first startup if those records do not already exist.
