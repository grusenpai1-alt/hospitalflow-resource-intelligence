# Security and Privacy Assessment

**Assessment date:** 2026-10-23
**Purpose:** Record the current synthetic-demo boundary and remaining blockers. This is not legal advice, a compliance certification, or an independent penetration test.

## Data classification and storage

| Data class | Examples | Current handling |
|---|---|---|
| Direct identity / health data | Names, contact details, identifiers, diagnoses, prescriptions, clinical notes | No workflow is intended to collect these. Do not enter real data. |
| Operational data | Synthetic case references, ward/room/bed labels, status, assignments, timestamps, event summaries | Versioned browser `localStorage` on the current device/browser only. It is mutable and not a security boundary. |
| Images | Bed readiness images, including user-selected files | Upload and review are unavailable in local demo mode. |
| Account/security data | Account credentials and user UID | No account or authentication is used by the current UI. |
| Integration credentials | ABDM or hospital-system credentials | No integration is implemented. Never put privileged credentials in the frontend or source control. |

## Implemented safeguards

- The current UI does not initialize Firebase Authentication or Firestore; workflow data is persisted in versioned browser storage.
- Browser storage errors are surfaced in the application instead of silently treating failed writes as successful.
- Bed-evidence upload, review, and cloud retention controls are unavailable in local demo mode.
- Firebase rules files remain in the repository as legacy configuration, but they are not used by the current application flow.

This is a local prototype, not a production security review. Browser storage is accessible to the user and may be cleared by the browser; there is no server-side identity, authorization, synchronization, or backup.

## Known limitations / production blockers

1. **No server authorization or shared persistence.** Anyone using the current browser profile can modify its local data. Data is not synchronized or backed up; clearing browser storage may delete it.
2. **No facility separation.** The local demo uses one synthetic workflow set per browser profile and does not provide tenant or user isolation.
3. **Evidence workflows are disabled.** Photo uploads, evidence review, and cloud retention are not available in browser-only mode.
4. **Legacy cloud rules are not in this app flow.** Firestore and Storage rule files do not protect browser-local data and have not been revalidated as part of this switch.

5. **No clinical-data safeguards.** This app has no server-side validation, immutable audit system, retention guarantees, backup/recovery, or live hospital-system integration.

## Safe operating rules

- Use synthetic data only, including screenshots, issue reports, and test fixtures.
- Never enter patient, staff, or clinical information or upload real clinical images.
- Do not collect Aadhaar numbers, OTPs, identity documents, or ABHA credentials.
- Use synthetic data only. Do not use the local browser demo to store real patient, staff, or operational information.
- The current local demo does not require Firebase environment variables. Do not deploy Firebase rules as a substitute for an application backend or authorization layer.
- Do not enable patient-data functionality in production before security, privacy, organizational, and regulatory requirements are reviewed and approved.

The legal basis, notice text, retention, correction/export/deletion rights, minor/guardian workflows, and ABDM consent requirements remain unresolved and require qualified product, privacy, and legal review against current official sources.

## Status

- **Implemented:** Browser-only demo access with no Firebase Auth/Firestore requests from the UI, versioned local workflow persistence, synthetic-only warnings, occupancy and housekeeping workflows.
- **Not validated:** Multi-device synchronization, browser-storage backup/recovery, or legacy Firestore/Storage rules in an emulator.
- **Not implemented:** Cloud persistence, user/facility identity, server-enforced permissions, photo evidence, comprehensive server-side validation, immutable audit pipeline, scheduled retention, live integrations, ABDM integration.
- **Not established:** Legal compliance, security certification, production readiness, verified cryptographic deletion, or ABHA/ABDM approval.

See [`architecture-assessment.md`](./architecture-assessment.md) for repository-level readiness context and [`deployment-and-rollback.md`](./deployment-and-rollback.md) for deployment boundaries.
