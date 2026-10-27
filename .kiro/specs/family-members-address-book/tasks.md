# Implementation Plan: Family Members & Address Book

## Overview

Implement full-stack address book CRUD, family member UX improvements (inline edit, relationship dropdown, duplicate guard, soft-delete `is_active` flag), and booking wizard corrections (`patientId: null` for self, active-only member filtering, saved-address selection in home collection step).

Backend: Python / FastAPI / SQLAlchemy async / PostgreSQL / Alembic / Pydantic v2.
Frontend: Angular 17+ standalone components, NgRx Signals, Angular Material.

## Tasks

- [x] 1. Create Alembic migration 0006
  - Create `backend/alembic/versions/0006_user_addresses_and_family_is_active.py`
  - `upgrade()`: `op.create_table("user_addresses", ...)` with all columns (id UUID PK, user_id FK→users.id, label VARCHAR(100), address_line1 VARCHAR(255), address_line2 VARCHAR(255) nullable, city VARCHAR(100), state VARCHAR(100), pincode VARCHAR(10), is_default BOOLEAN default false, deleted_at TIMESTAMPTZ nullable, created_at TIMESTAMPTZ default now())
  - `upgrade()`: `op.create_index("uq_user_addresses_one_default", "user_addresses", ["user_id"], unique=True, postgresql_where="is_default = true AND deleted_at IS NULL")`
  - `upgrade()`: `op.add_column("family_members", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))`
  - `downgrade()` reverses all three steps in reverse order
  - Set `revision = "0006"`, `down_revision = "0005"`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 8.5_

- [x] 2. Add `UserAddress` SQLAlchemy model and update `FamilyMember`
  - In `backend/app/models/user.py`, add `UserAddress` class with all columns matching the migration schema
  - Add `user: Mapped["User"]` back-ref relationship on `UserAddress`
  - Add `addresses: Mapped[list["UserAddress"]]` relationship to the `User` class
  - Add `is_active: Mapped[bool]` column (BOOLEAN, default `true`) to the `FamilyMember` class
  - _Requirements: 1.1, 1.2, 1.6, 8.5_

- [x] 3. Implement `AddressRepository`
  - Create `backend/app/repositories/address_repository.py` following the same pattern as `FamilyMemberRepository`
  - Implement `create(user_id, label, address_line1, city, state, pincode, *, address_line2=None, is_default=False) → UserAddress` — flush and refresh
  - Implement `get_by_id(address_id) → UserAddress | None` — exclude soft-deleted rows
  - Implement `list_by_user(user_id) → list[UserAddress]` — exclude soft-deleted, order by `created_at DESC`
  - Implement `update(address_id, **fields) → UserAddress | None`
  - Implement `soft_delete(address_id) → None` — sets `deleted_at = now()`
  - Implement `clear_defaults(user_id) → None` — sets `is_default = false` for all non-deleted addresses of that user
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7_

  - [ ]* 3.1 Write property test for address default invariant (Property 2)
    - **Property 2: At most one default address per user**
    - Create `backend/tests/properties/test_property_address_default_invariant.py`
    - Add `UserAddress` model stub to `conftest.py` (or inline in test file) following the same pattern as `FamilyMember`
    - Use `@settings(max_examples=100)` and tag `# Feature: family-members-address-book, Property 2: At most one default address per user`
    - For any sequence of create/update operations setting `is_default=True`, assert count of non-deleted defaults for that user is exactly 1
    - **Validates: Requirements 1.3, 2.6, 2.7**

  - [ ]* 3.2 Write property test for address list excludes deleted (Property 3)
    - **Property 3: List endpoint excludes soft-deleted addresses**
    - Create `backend/tests/properties/test_property_address_list_excludes_deleted.py`
    - Use `@settings(max_examples=100)` and tag `# Feature: family-members-address-book, Property 3: List excludes soft-deleted addresses`
    - For any mix of active and soft-deleted addresses, assert `list_by_user` returns only rows where `deleted_at IS NULL`
    - **Validates: Requirements 2.1**

  - [ ]* 3.3 Write property test for address create/delete round-trip (Property 4)
    - **Property 4: Address create/delete round-trip**
    - Create `backend/tests/properties/test_property_address_create_delete.py`
    - Use `@settings(max_examples=100)` and tag `# Feature: family-members-address-book, Property 4: Address create/delete round-trip`
    - After `create`, assert address appears in `list_by_user`; after `soft_delete`, assert it no longer appears
    - **Validates: Requirements 2.2, 2.4**

- [x] 4. Extend `UserService` with address methods and update family member methods
  - In `backend/app/services/user_service.py`, import `AddressRepository` and instantiate it in `__init__`
  - Add `get_addresses(user_id) → list[UserAddress]` — delegates to `AddressRepository.list_by_user`
  - Add `add_address(user_id, label, address_line1, city, state, pincode, *, address_line2=None, is_default=False)` — if `is_default=True`, call `clear_defaults` first (same transaction), then `create`
  - Add `update_address(user_id, address_id, **fields)` — ownership check → HTTP 404 `ADDRESS_NOT_FOUND`; if `is_default=True` in fields, call `clear_defaults` first; then `update`
  - Add `delete_address(user_id, address_id)` — ownership check → HTTP 404 `ADDRESS_NOT_FOUND`; call `soft_delete`
  - Update `delete_family_member`: after `soft_delete`, also call `family_repo.update(member_id, is_active=False)`
  - Update `add_family_member`: before creating, query for existing non-deleted member with same `(user_id, name, date_of_birth)`; raise HTTP 409 `DUPLICATE_FAMILY_MEMBER` if found
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.10, 8.1_

  - [ ]* 4.1 Write property test for duplicate family member guard (Property 16)
    - **Property 16: Duplicate name+DOB returns 409**
    - Create `backend/tests/properties/test_property_family_member_duplicate.py`
    - Use `@settings(max_examples=100)` and tag `# Feature: family-members-address-book, Property 16: Duplicate name+DOB returns 409`
    - For any user with an existing non-deleted member, assert that `add_family_member` with the same `(name, date_of_birth)` raises HTTP 409 with `DUPLICATE_FAMILY_MEMBER`
    - **Validates: Requirements 7.10**

  - [ ]* 4.2 Write property test for family member soft-delete flags (Property 17)
    - **Property 17: Soft-delete sets both deleted_at and is_active=false**
    - Create `backend/tests/properties/test_property_family_member_soft_delete.py`
    - Use `@settings(max_examples=100)` and tag `# Feature: family-members-address-book, Property 17: Soft-delete sets deleted_at and is_active=false`
    - After `delete_family_member`, assert the DB row has `deleted_at` non-null and `is_active = false`
    - **Validates: Requirements 8.1**

- [x] 5. Add Pydantic schemas for addresses
  - In `backend/app/schemas/users.py`, add `UserAddressOut` with fields: `id`, `user_id`, `label`, `address_line1`, `address_line2`, `city`, `state`, `pincode`, `is_default`, `created_at`, and `model_config = {"from_attributes": True}`
  - Add `CreateAddressRequest` with required fields `label`, `address_line1`, `city`, `state`, `pincode` and optional `address_line2` (default `None`) and `is_default` (default `False`)
  - Add `UpdateAddressRequest` where all fields are optional (default `None`)
  - Add `UserAddressListResponse` with `items: list[UserAddressOut]`, `total: int`, `page: int`, `page_size: int`
  - Also add `is_active: bool` to `FamilyMemberOut` schema
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Add address API endpoints to the users router
  - In `backend/app/api/v1/users.py`, import `UserAddressOut`, `CreateAddressRequest`, `UpdateAddressRequest`, `UserAddressListResponse`
  - Add `GET /users/me/addresses` → returns `UserAddressListResponse` (wraps list with `total`, `page=1`, `page_size=len`)
  - Add `POST /users/me/addresses` → calls `svc.add_address(...)`, returns `UserAddressOut` with status 201
  - Add `PUT /users/me/addresses/{address_id}` → calls `svc.update_address(...)`, returns `UserAddressOut`
  - Add `DELETE /users/me/addresses/{address_id}` → calls `svc.delete_address(...)`, returns 204
  - All endpoints use `Depends(get_current_user)` and `Depends(get_db_session)` consistent with existing endpoints
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.9_

- [x] 7. Checkpoint — ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add `UserAddress` and `UserAddressListResponse` types to `api.types.ts`
  - In `frontend/src/app/core/api/api.types.ts`, add `UserAddress` interface with fields: `id`, `user_id`, `label`, `address_line1`, `address_line2?`, `city`, `state`, `pincode`, `is_default`, `created_at`
  - Add `UserAddressListResponse` interface with `items: UserAddress[]`, `total: number`, `page: number`, `page_size: number`
  - Add `is_active: boolean` and `deleted_at?: string` fields to the `FamilyMember` interface
  - _Requirements: 5.5, 5.6, 9.6_

- [x] 9. Add address CRUD methods to `UserApiService`
  - In `frontend/src/app/core/api/services/user-api.service.ts`, add `getAddresses(): Observable<UserAddressListResponse>`
  - Add `addAddress(data: Partial<UserAddress>): Observable<UserAddress>`
  - Add `updateAddress(id: string, data: Partial<UserAddress>): Observable<UserAddress>`
  - Add `deleteAddress(id: string): Observable<void>`
  - Import `UserAddress` and `UserAddressListResponse` from `api.types`
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 10. Create `AddressBookComponent`
  - Create `frontend/src/app/features/profile/address-book/address-book.component.ts` as a standalone component
  - On init: call `getAddresses()`, populate `addresses` signal from `response.items`
  - Display each address card with label, address_line1, address_line2 (if present), city, state, pincode; show "Default" badge when `is_default === true`
  - Empty state: display "No saved addresses yet." when list is empty
  - "Add Address" form using `ReactiveFormsModule`: fields label, address_line1, address_line2 (optional), city, state, pincode, is_default toggle; inline `mat-error` validation for required fields
  - "Remove" button per card → `MatDialog` confirmation → `deleteAddress()` → remove from list signal → `MatSnackBar` success toast
  - On add success: push to list, reset form, show success toast; on any API error: show error toast
  - Use `*ngIf` / `*ngFor` (consistent with `FamilyMembersComponent`)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

- [x] 11. Register `/profile/addresses` route
  - In `frontend/src/app/features/profile/profile.routes.ts`, add route `{ path: 'addresses', loadComponent: () => import('./address-book/address-book.component').then(m => m.AddressBookComponent), canActivate: [authGuard] }`
  - _Requirements: 4.1_

- [x] 12. Update `FamilyMembersComponent` with inline edit, relationship dropdown, dialogs, and toasts
  - In `frontend/src/app/features/profile/family-members/family-members.component.ts`:
  - Add `editingId = signal<string | null>(null)` and an `editForm: FormGroup` pre-populated when edit is triggered
  - Add "Edit" button per card; clicking sets `editingId` and populates `editForm` with member's current values
  - Relationship field: `MatSelect` with options `['Father','Mother','Child','Spouse','Sibling','Grandparent','Grandchild','Other']` on both add and edit forms
  - "Cancel" clears `editingId`, no API call
  - "Save" calls `updateFamilyMember()`, updates list signal on success, shows `MatSnackBar` success toast
  - "Remove" button → `MatDialog` confirmation → `deleteFamilyMember()` → filter list → success toast
  - All API errors show error toast via `MatSnackBar`
  - Inline validation: `name` and `relationship` required, show `mat-error` before submit
  - Import `MatSelectModule`, `MatDialogModule`, `MatSnackBarModule`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

- [x] 13. Clean up `ProfileComponent` tiles
  - In `frontend/src/app/features/profile/profile/profile.component.ts`, update the `tiles` array:
  - Remove the "About" tile (route `/about`) and "Lab Locator" tile (route `/labs`)
  - Fix "Manage Members" route from `/profile/members` to `/profile/family`
  - Final order: My Profile (`/profile/edit`), Manage Members (`/profile/family`), Address Book (`/profile/addresses`), Download Reports (`/dashboard`), My Orders (`/dashboard`), Help (`/help`), Contact Us (`/contact`)
  - Remove any other tiles not in the final list (e.g. Wellness Watch)
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 14. Fix `PatientStepComponent` — correct `patientId` and active-only filter
  - In `frontend/src/app/features/booking/steps/patient-step.component.ts`:
  - In `onNext()`, when `selectedId === 'self'`, store `patientId: null` (not `profile()?.id`)
  - After loading family members, filter the list to only include members where `is_active === true` (and `deleted_at` is falsy)
  - _Requirements: 9.1, 9.2, 9.6_

- [x] 15. Add `selectedAddressId` to `BookingWizardStore`
  - In `frontend/src/app/core/store/booking-wizard.store.ts`, add `selectedAddressId: string | null` to `BookingWizardState` interface and `initialState` (default `null`)
  - _Requirements: 10.3, 10.5_

- [x] 16. Update `CollectionTypeStepComponent` to support saved address selection
  - In `frontend/src/app/features/booking/steps/collection-type-step.component.ts`:
  - When collection type is `'home'`, on init call `getAddresses()` and populate a `savedAddresses` signal
  - Pre-select the address where `is_default === true` as `selectedAddressId`
  - Show selectable address cards for each saved address; selecting one updates `selectedAddressId` and the local `pincode`
  - Provide an "Enter new address" option that shows the existing manual pincode input
  - If no saved addresses exist, show manual entry directly without an empty list
  - On proceed, call `patchState({ selectedAddressId, pincode, collectionType, labBranchId })`
  - Import `UserApiService` and `UserAddress` from api types
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 17. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness invariants; unit tests validate specific examples and edge cases
- The `conftest.py` in `backend/tests/properties/` must be updated to include `UserAddress` model stub and inject it into `sys.modules["app.models.user"]` before the PBT files can run
- The partial unique index for `is_default` is enforced at the DB level via the Alembic migration; `clear_defaults` in `AddressRepository` ensures the constraint is satisfied within the same SQLAlchemy session flush
