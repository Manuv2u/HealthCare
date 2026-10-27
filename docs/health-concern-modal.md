# Health-Concern Welcome Modal — When It Shows

The "Welcome to Sri Health Plus" popup asks a patient to pick their health
concerns (Diabetes, Thyroid, Heart Health, …) so the app can personalise the
test and package catalog. This document describes when the modal appears for
each role and how the logic works.

**Code:** [`frontend/src/app/app.component.ts`](../frontend/src/app/app.component.ts)
(trigger logic) and
[`frontend/src/app/shared/components/health-concern-modal/health-concern-modal.component.ts`](../frontend/src/app/shared/components/health-concern-modal/health-concern-modal.component.ts)
(the modal UI).

---

## The rule in one sentence

> Show the modal **only to patients** who have **not yet saved any health
> concerns** on their profile and have **not skipped the prompt in the last
> 30 days** on this browser.

It is driven by *data*, not by logins or page refreshes — so refreshing the
browser never re-triggers it.

## Decision flow

```
Page load / login
      │
      ▼
Is the user authenticated? ──── no ──► never show (guests don't see it)
      │ yes
      ▼
Is the role "user" (patient)? ── no ──► never show (admin / technician)
      │ yes
      ▼
Skipped within last 30 days
on this browser? ─────────────── yes ─► don't show (snoozed)
      │ no
      ▼
Fetch profile (GET /users/me)
      │
      ▼
profile.health_concerns
already has entries? ─────────── yes ─► don't show (already answered, ever)
      │ no
      ▼
    SHOW MODAL
```

The check runs **once per app load** (guarded by an in-memory flag) and only
after authentication is confirmed, so it also fires correctly right after a
fresh login.

## What each button does

| Action | Effect |
|---|---|
| **Continue** (with concerns selected) | Saves the selection to the profile via `PUT /users/me` (`health_concerns`), clears any snooze, and navigates to `/tests?health_concern=…`. Because the answer now lives on the server, the modal **never appears again — on any device or browser**. |
| **Skip for Now** / **✕ (close)** | Writes a snooze timestamp to `localStorage` under `hc_prompt_snoozed_until:<userId>`. The modal stays hidden for **30 days on that browser**, then may appear again if the profile still has no concerns. |

Notes on the snooze:

- It is keyed **per user id**, so two patients sharing one browser don't
  suppress each other's prompt.
- It survives logout/login (intentional — "skip" means "stop asking me",
  not "ask me again next login").
- It is per browser. Skipping on a phone does not snooze the prompt on a
  laptop. Answering (Continue) suppresses it everywhere, because that state
  is server-side.
- The snooze length is the `HEALTH_CONCERN_SNOOZE_DAYS` constant in
  `app.component.ts` (currently `30`).

---

## Behaviour by role

### Normal user (patient, role `user`)

| Situation | Modal shown? |
|---|---|
| First login ever (no concerns saved, never skipped) | ✅ Yes |
| Browser refresh after seeing it once (no answer, no skip) | ✅ Yes — until they answer or skip once |
| Refresh / new login after pressing **Continue** | ❌ No — concerns are saved on the profile |
| Refresh / new login within 30 days of pressing **Skip** | ❌ No — snoozed |
| Same browser, more than 30 days after **Skip**, still no concerns saved | ✅ Yes — one gentle re-prompt |
| Different browser/device, previously skipped elsewhere, no concerns saved | ✅ Yes — snooze is per browser |
| Profile fetch fails (network/API error) | ❌ No — the app errs on the side of not interrupting |

Patients can still reach the same personalisation later without the modal:
the test catalog reads the saved `health_concerns` from the profile, and the
concern filter is available on the Tests page.

### Technician (role `technician`)

❌ **Never sees the modal.** The trigger requires role `user`, so technicians
go straight to their portal (`/technician`). Nothing is read from or written
to their profile or localStorage for this feature.

### Admin (role `admin`)

❌ **Never sees the modal.** Same role guard as technicians. Admins land in
the Admin Panel (`/admin`) uninterrupted.

Admins interact with health concerns in two other places instead:

- **Admin → Health Concerns** — manage the list of concerns (name, icon,
  display order) that patients choose from; served by `GET /health-concerns`.
- **Admin → Users → user detail** — view the concerns a patient selected
  (shown read-only in the user's profile details).

### Guests (not logged in)

❌ Never see the modal — it only triggers after authentication. (If this is
ever wanted for anonymous visitors, the snooze mechanism would need a
non-user-scoped key.)

---

## Why it used to appear on every refresh (fixed)

Previously the only guard was an in-memory `healthConcernChecked` flag inside
`AppComponent`. Every browser refresh restarts the Angular app, resetting the
flag, and the session restore from `localStorage` re-triggered the effect —
so the modal opened on **every page load**. The fix replaces "once per app
instance" with the persistent, data-driven rule described above.
