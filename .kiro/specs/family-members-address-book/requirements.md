# Requirements Document

## Introduction

This feature covers the Family Members & Address Book capabilities for a diagnostic lab booking application. It encompasses four areas:

1. **Address Book** — a new full-stack feature allowing users to store and manage multiple delivery/collection addresses linked to their account.
2. **Profile Settings Tile Cleanup** — removing irrelevant tiles (About, Lab Locator) from the user-facing settings page and fixing the Manage Members route.
3. **Manage Members UX** — adding edit functionality to the existing Family Members screen so users can update member details in-place.
4. **Booking Wizard Patient Linkage** — ensuring the booking creation payload correctly sends `patient_id: null` when booking for self, and the family member's UUID when booking for a member.

---

## Glossary

- **System**: The diagnostic lab booking application (backend API + Angular frontend).
- **User**: An authenticated account holder interacting with the frontend.
- **FamilyMember**: A person linked to a User account for whom bookings can be made (stored in `family_members` table). Has an `is_active` boolean (default `true`) and a `deleted_at` timestamp for soft-delete. A soft-deleted FamilyMember retains its row so that existing booking FK references remain valid.
- **UserAddress**: A saved address record linked to a User account (to be stored in `user_addresses` table). Supports soft-delete via `deleted_at` timestamp.
- **AddressBook**: The collection of UserAddress records belonging to a User.
- **RelationshipType**: The allowed values for the FamilyMember `relationship` field: Father, Mother, Child, Spouse, Sibling, Grandparent, Grandchild, Other.
- **ProfileComponent**: The Angular settings/profile tile grid page at `/profile`.
- **FamilyMembersComponent**: The Angular page at `/profile/family` for managing family members.
- **AddressBookComponent**: The Angular page at `/profile/addresses` for managing saved addresses.
- **BookingWizardStore**: The NgRx Signals store that holds transient booking state across wizard steps.
- **PatientStepComponent**: The booking wizard step where the User selects who the booking is for.
- **CollectionAddressStepComponent**: The booking wizard step where the User selects or enters a home-collection address.
- **AddressRepository**: The backend repository class for UserAddress CRUD operations.
- **UserService**: The backend service class that orchestrates user, family member, and address operations.
- **UserApiService**: The Angular service that calls the backend `/users/me/*` endpoints.
- **PaginatedEnvelope**: A JSON response wrapper with shape `{ items: T[], total: number, page: number, page_size: number }` used by list endpoints to allow future pagination without breaking clients.

---

## Requirements

### Requirement 1: Address Book — Backend Data Model

**User Story:** As a user, I want my saved addresses to be persisted in the database, so that I can reuse them across bookings without re-entering them.

#### Acceptance Criteria

1. THE System SHALL store UserAddress records in a `user_addresses` table with columns: `id` (UUID PK), `user_id` (UUID FK → `users.id`), `label` (VARCHAR 100), `address_line1` (VARCHAR 255), `address_line2` (VARCHAR 255, nullable), `city` (VARCHAR 100), `state` (VARCHAR 100), `pincode` (VARCHAR 10), `is_default` (BOOLEAN, default false), `deleted_at` (TIMESTAMPTZ, nullable), `created_at` (TIMESTAMPTZ).
2. THE System SHALL enforce a foreign key constraint from `user_addresses.user_id` to `users.id`.
3. THE System SHALL enforce a unique partial index on `(user_id)` WHERE `is_default = true` AND `deleted_at IS NULL` at the database level, so that at most one non-deleted UserAddress per User can have `is_default = true`.
4. THE System SHALL provide an Alembic migration (revision `0006`) that creates the `user_addresses` table (including the partial unique index) and is chained from revision `0005`.
5. WHEN a User is soft-deleted, THE System SHALL retain the User's UserAddress records (no cascade delete), consistent with the existing soft-delete pattern for FamilyMember records.
6. THE System SHALL add an `is_active` (BOOLEAN, default `true`) column to the `family_members` table in the same migration or a separate migration, to support marking a member as inactive without removing the row.

---

### Requirement 2: Address Book — Backend API

**User Story:** As a user, I want a REST API to create, read, update, and delete my saved addresses, so that the frontend can manage my address book.

#### Acceptance Criteria

1. THE System SHALL expose a `GET /users/me/addresses` endpoint that returns a PaginatedEnvelope of all non-deleted UserAddress records for the authenticated User.
2. THE System SHALL expose a `POST /users/me/addresses` endpoint that creates a new UserAddress for the authenticated User and returns the created record with HTTP 201.
3. THE System SHALL expose a `PUT /users/me/addresses/{address_id}` endpoint that updates an existing UserAddress belonging to the authenticated User and returns the updated record.
4. THE System SHALL expose a `DELETE /users/me/addresses/{address_id}` endpoint that soft-deletes a UserAddress (sets `deleted_at` to the current UTC timestamp) belonging to the authenticated User and returns HTTP 204. Hard deletion of UserAddress records is not permitted.
5. IF a request targets a UserAddress that does not exist, is soft-deleted, or belongs to a different User, THEN THE System SHALL return HTTP 404 with error code `ADDRESS_NOT_FOUND`.
6. WHEN a `POST /users/me/addresses` request sets `is_default: true`, THE System SHALL set `is_default = false` on all other non-deleted UserAddress records for that User before saving the new record, so that the database partial unique constraint is satisfied.
7. WHEN a `PUT /users/me/addresses/{address_id}` request sets `is_default: true`, THE System SHALL set `is_default = false` on all other non-deleted UserAddress records for that User before saving the update.
8. THE System SHALL validate that `label`, `address_line1`, `city`, `state`, and `pincode` are non-empty strings in create and update requests; IF any required field is missing or empty, THEN THE System SHALL return HTTP 422.
9. THE System SHALL expose a `GET /users/me/family-members` endpoint and all family-member mutation endpoints under the `/users/me/family-members` path prefix. THE System SHALL expose all address endpoints under the `/users/me/addresses` path prefix. No alternative URL naming is permitted.

---

### Requirement 3: Address Book — Pydantic Schemas

**User Story:** As a developer, I want typed Pydantic v2 schemas for address endpoints, so that request validation and response serialisation are consistent with the rest of the API.

#### Acceptance Criteria

1. THE System SHALL define a `UserAddressOut` schema with fields: `id`, `user_id`, `label`, `address_line1`, `address_line2`, `city`, `state`, `pincode`, `is_default`, `created_at`, and `model_config = {"from_attributes": True}`.
2. THE System SHALL define a `CreateAddressRequest` schema with required fields `label`, `address_line1`, `city`, `state`, `pincode` and optional fields `address_line2` (default `None`) and `is_default` (default `False`).
3. THE System SHALL define an `UpdateAddressRequest` schema where all fields (`label`, `address_line1`, `address_line2`, `city`, `state`, `pincode`, `is_default`) are optional (default `None`).
4. THE System SHALL define a `UserAddressListResponse` schema that wraps a list of `UserAddressOut` in a PaginatedEnvelope shape (`items`, `total`, `page`, `page_size`) so the list endpoint response is extensible for future pagination.

---

### Requirement 4: Address Book — Frontend Component

**User Story:** As a user, I want a dedicated Address Book page in my profile, so that I can view, add, edit, and remove my saved addresses.

#### Acceptance Criteria

1. THE System SHALL provide an `AddressBookComponent` at the Angular route `/profile/addresses` that is protected by `authGuard`.
2. WHEN the `AddressBookComponent` initialises, THE System SHALL call `GET /users/me/addresses` and display the returned addresses as a list.
3. WHEN the address list is empty, THE System SHALL display an empty-state message: "No saved addresses yet."
4. THE System SHALL display each address showing: label, address_line1, address_line2 (if present), city, state, and pincode.
5. THE System SHALL display a "Default" badge on the address where `is_default` is `true`.
6. THE System SHALL provide an "Add Address" form with fields: Label, Address Line 1, Address Line 2 (optional), City, State, Pincode, and a "Set as default" toggle.
7. WHEN the user submits a valid "Add Address" form, THE System SHALL call `POST /users/me/addresses`, add the returned address to the list, and reset the form.
8. THE System SHALL provide a "Remove" action on each address card that, WHEN clicked, THE System SHALL display a confirmation dialog asking the user to confirm deletion before calling `DELETE /users/me/addresses/{id}`.
9. WHEN the user confirms deletion, THE System SHALL call `DELETE /users/me/addresses/{id}` and remove the card from the list on success.
10. WHEN a mutating operation (add, update, delete) succeeds, THE System SHALL display a toast/snackbar success notification.
11. IF an API call fails, THEN THE System SHALL display a toast/snackbar error notification describing the failure.
12. THE System SHALL perform inline form validation on the "Add Address" and edit address forms, displaying field-level error messages for required fields before the form is submitted.

---

### Requirement 5: Address Book — Frontend API Service

**User Story:** As a developer, I want `UserApiService` to include address CRUD methods, so that components can call the address API without duplicating HTTP logic.

#### Acceptance Criteria

1. THE System SHALL add a `getAddresses(): Observable<UserAddressListResponse>` method to `UserApiService` that calls `GET /users/me/addresses`.
2. THE System SHALL add an `addAddress(data: Partial<UserAddress>): Observable<UserAddress>` method that calls `POST /users/me/addresses`.
3. THE System SHALL add an `updateAddress(id: string, data: Partial<UserAddress>): Observable<UserAddress>` method that calls `PUT /users/me/addresses/{id}`.
4. THE System SHALL add a `deleteAddress(id: string): Observable<void>` method that calls `DELETE /users/me/addresses/{id}`.
5. THE System SHALL define a `UserAddress` interface in `api.types.ts` with fields: `id`, `user_id`, `label`, `address_line1`, `address_line2` (optional), `city`, `state`, `pincode`, `is_default`, `created_at`.
6. THE System SHALL define a `UserAddressListResponse` interface in `api.types.ts` with fields: `items: UserAddress[]`, `total: number`, `page: number`, `page_size: number`.

---

### Requirement 6: Profile Settings Tile Cleanup

**User Story:** As a user, I want the profile settings page to show only tiles relevant to me, so that I am not confused by options that do not apply to my role.

#### Acceptance Criteria

1. THE System SHALL remove the "About" tile (route `/about`) from the `ProfileComponent` tiles array.
2. THE System SHALL remove the "Lab Locator" tile (route `/labs`) from the `ProfileComponent` tiles array.
3. THE System SHALL update the "Manage Members" tile route from `/profile/members` to `/profile/family` to match the registered Angular route.
4. WHILE the user is on the profile settings page, THE System SHALL display exactly the following tiles in order: My Profile, Manage Members, Address Book, Download Reports, My Orders, Help, Contact Us.

---

### Requirement 7: Manage Members — Edit Functionality & Validation

**User Story:** As a user, I want to edit an existing family member's details, so that I can correct mistakes or update information without removing and re-adding the member.

#### Acceptance Criteria

1. THE System SHALL display an "Edit" button on each family member card in `FamilyMembersComponent`.
2. WHEN the user clicks "Edit" on a member card, THE System SHALL display an inline edit form pre-populated with that member's `name`, `relationship`, `date_of_birth`, and `gender` fields.
3. THE System SHALL require the `relationship` field when adding or editing a FamilyMember, and SHALL restrict accepted values to: Father, Mother, Child, Spouse, Sibling, Grandparent, Grandchild, Other.
4. WHEN the user submits the edit form, THE System SHALL call `PUT /users/me/family-members/{id}` with the updated fields and update the displayed card on success.
5. WHEN the user cancels the edit, THE System SHALL hide the edit form and restore the card to its read-only display without making an API call.
6. IF the edit API call fails, THEN THE System SHALL display a toast/snackbar error notification on the affected card.
7. WHEN a mutating operation on a family member (add, update, delete) succeeds, THE System SHALL display a toast/snackbar success notification.
8. THE System SHALL perform inline form validation on the add and edit family member forms, displaying field-level error messages for required fields (`name`, `relationship`) before the form is submitted.
9. THE System SHALL display a confirmation dialog before deleting a family member.
10. IF a `POST /users/me/family-members` request contains a `name` and `date_of_birth` combination that already exists for a non-deleted FamilyMember belonging to the same User, THEN THE System SHALL return HTTP 409 with error code `DUPLICATE_FAMILY_MEMBER`.

---

### Requirement 8: Family Member — Soft Delete & is_active Flag

**User Story:** As a user, I want deleting a family member to preserve historical booking data, so that past bookings remain accurate even after I remove a member from my list.

#### Acceptance Criteria

1. WHEN the user deletes a FamilyMember, THE System SHALL set `deleted_at` to the current UTC timestamp and set `is_active = false` on the FamilyMember record. Hard deletion of FamilyMember records is not permitted.
2. WHEN a FamilyMember is soft-deleted, THE System SHALL retain the row in the `family_members` table so that any existing `bookings.patient_id` foreign key reference remains valid.
3. THE System SHALL exclude FamilyMember records where `deleted_at IS NOT NULL` from the `GET /users/me/family-members` list response.
4. THE System SHALL include soft-deleted FamilyMember records when resolving `bookings.patient_id` FK lookups, so that booking history and reports continue to display the correct patient name.
5. THE FamilyMember model SHALL include an `is_active` boolean column (default `true`) that is set to `false` when the member is soft-deleted, consistent with the `is_active` pattern used on the User model.

---

### Requirement 9: Booking Wizard — Correct patient_id Handling

**User Story:** As a user, I want the booking to correctly record who the patient is, so that test results and reports are attributed to the right person.

#### Acceptance Criteria

1. WHEN the user selects "Myself" in `PatientStepComponent` and proceeds, THE System SHALL store `patientId: null` in `BookingWizardStore` (not the user's own UUID).
2. WHEN the user selects a FamilyMember in `PatientStepComponent` and proceeds, THE System SHALL store that FamilyMember's UUID as `patientId` in `BookingWizardStore`.
3. WHEN the booking creation request is submitted, THE System SHALL send `patient_id: null` in the `CreateBookingRequest` payload when the patient is the account holder (self).
4. WHEN the booking creation request is submitted, THE System SHALL send the FamilyMember's UUID as `patient_id` in the `CreateBookingRequest` payload when the patient is a family member.
5. THE System SHALL continue to store `patientName` in `BookingWizardStore` for display purposes regardless of whether the patient is self or a family member.
6. THE System SHALL only display FamilyMember options in `PatientStepComponent` where `is_active = true` and `deleted_at IS NULL`, so that soft-deleted members cannot be selected for new bookings.

---

### Requirement 10: Booking Wizard — Address Selection for Home Collection

**User Story:** As a user, I want to select a saved address during the home collection booking step, so that I do not have to re-enter my address for every booking.

#### Acceptance Criteria

1. WHEN the booking wizard reaches the `CollectionAddressStepComponent` and the collection type is home collection, THE System SHALL call `GET /users/me/addresses` and display the User's saved addresses as selectable options.
2. WHEN the address list is loaded, THE System SHALL pre-select the UserAddress where `is_default = true` as the default selection.
3. THE System SHALL allow the User to select any saved address from the list as the collection address for the booking.
4. THE System SHALL provide an option to enter a new address inline instead of selecting a saved address.
5. WHEN the User selects a saved address and proceeds, THE System SHALL populate the booking payload with the `pincode` from the selected UserAddress.
6. IF no saved addresses exist for the User, THE System SHALL display the manual address entry form directly without showing an empty address list.
