# Play Data Safety — declaration crib

Google Play requires a Data Safety declaration, and Apple requires the
equivalent privacy "nutrition label". Both are rejected — or worse, pulled
after publication — when the declaration does not match what the app
actually does.

This file maps each form question to the code that answers it, so the
declaration can be filled in from evidence rather than memory. Re-check it
whenever a dependency that touches the network or storage is added.

---

## Data collection

| Play category | Collected? | Evidence |
|---|---|---|
| Name | **No** | No field anywhere asks for one |
| Email address | **No** | Anonymous auth only — `signInAnonymously` in `main.dart` |
| User IDs | **Yes** | Firebase anonymous uid |
| Address, phone | **No** | Never requested |
| Location (precise or approximate) | **No** | No location permission in `AndroidManifest.xml` |
| Financial info | **No** | No billing |
| Health, fitness | **No** | — |
| Photos, videos, audio, files | **No** | No storage permission; images are only downloaded, never read from the device |
| Contacts, calendar | **No** | — |
| App activity — searches | **Yes, on device only** | `search_recents` Hive box; the search term is sent to our backend to perform the lookup but is not stored against the user |
| App activity — other actions | **No** | No analytics SDK — verified: nothing matching `analytics\|crashlytics\|sentry` in `pubspec.yaml` |
| App info and performance | **No** | No crash-reporting SDK at present |
| Device or other IDs | **No** | App Check attests the app, not the device, and returns no identifier to us |

---

## For each "Yes"

### User IDs (Firebase anonymous uid)

- **Collected**, not "shared".
- **Purposes:** App functionality; Fraud prevention, security and
  compliance.
- **Optional?** No — required for the rate limiting that keeps the service
  running.
- **Encrypted in transit?** Yes — HTTPS throughout; the app refuses any
  non-`https` URL (`lib/core/security/safe_url.dart`).
- **Can the user request deletion?** **Yes** — `DeleteDataTile` calls
  `DataDeletionService.deleteEverything()`, which removes the Firestore
  records and deletes the account.

### App activity — search history

- Stored **on device only** (`search_recents`).
- The search term is transmitted to our backend to perform the lookup, but
  no per-user record of it is kept server-side. Only a per-figure counter
  (`lastRequestedAt`, `requestCount` in `functions/lib/store.js`).
- **Deletable:** yes, same control.

---

## Security practices to declare

| Question | Answer | Evidence |
|---|---|---|
| Encrypted in transit | **Yes** | HTTPS only, enforced client-side |
| Users can request deletion | **Yes** | `DeleteDataTile` |
| Follows the Families policy | N/A unless targeting children |
| Independent security review | **No** | Be honest — do not claim one |

---

## Before you submit

1. Fill in the contact address in `docs/PRIVACY.md`.
2. Host the policy at a public URL and put it in the store listing **and**
   in the Data Safety form.
3. Re-read the tables above against the current code. If a crash-reporting
   or analytics SDK has been added since, both this file and the policy
   must be updated **before** the build ships.
4. Test "Delete my data" on a real device against production Firebase, not
   just the emulator. The form claims it works.

## What would make this declaration wrong

The most likely way this becomes inaccurate is adding a package that
collects something quietly. Watch for:

- Any analytics or attribution SDK
- Crash reporting (collects device identifiers and stack traces)
- Any advertising or monetisation SDK
- A push-notification token, if alerts are added — that is a device
  identifier and must be declared
