# Security and Privacy Assessment

**Assessment date:** 2026-10-23
**Purpose:** Record the current synthetic-demo boundary and remaining blockers. This is not legal advice, a compliance certification, or an independent penetration test.

## Data classification and storage

| Data class | Examples | Current handling |
|---|---|---|
| Direct identity / health data | Names, contact details, identifiers, diagnoses, prescriptions, clinical notes | No workflow is intended to collect these. Do not enter real data. |
| Operational data | Synthetic case references, ward/room/bed labels, status, assignments, timestamps, event summaries | Facility-scoped Firestore workflow documents. Operational data may still be sensitive. |
| Images | Bed readiness images, including user-selected files | Facility-scoped Firebase Storage; JPEG, PNG, and WebP, max 10 MB. UI guidance and MIME checks do not detect identifying content. |
| Account/security data | Firebase Auth account and user UID | Firebase Email/Password Auth; a trusted administrator provisions `users/{uid}` with `facilityId`, `facilityName`, and `role`. |
| Integration credentials | ABDM or hospital-system credentials | No integration is implemented. Never put privileged credentials in the frontend or source control. |

## Implemented safeguards

- App access is gated on Firebase configuration, authenticated sign-in, and a valid provisioned facility profile. There is no self-registration or browser-side profile creation.
- Firestore workflow records and Storage objects are scoped to a facility ID obtained from the profile document. Rules deny reads across facilities and use a workflow-by-workflow role allowlist for writes.
- Bed-turnaround case and occupancy-board writes are limited to admins and coordinators because those shared documents contain both staff actions and coordinator-only readiness approvals; other facility roles cannot safely write those shared records under the current data model.
- Firestore rules allowlist workflow IDs, validate the document envelope, bound collection sizes, and validate settings and occupancy board shapes.
- Storage rules constrain facility paths, image MIME types, maximum object size, and custom metadata fields.
- Image bytes and download URLs are not copied into Firestore workflow records or event history.
- Firebase configuration is supplied as `VITE_FIREBASE_*` build-time variables. These are public web-app configuration values, not privileged server credentials.
- Failed workflow loads and writes are shown in the UI; there is no browser-local persistence fallback.

These controls are an initial demo boundary, not a production security review. Rules have not been validated with the Firebase Emulator Suite or exercised against a provisioned cloud test account.

## Known limitations / production blockers

1. **Operation-level authorization is incomplete.** The workflow-level role matrix is enforced in Firestore rules, and client routes mirror it for usability. Bed-case and occupancy shared documents are coordinator/admin-only to prevent staff from bypassing approval gates. Other authorized roles can still replace their permitted workflow document, and nested operations are not individually authorized by the current document model. Use per-record documents or a trusted backend before enabling role-distinct operations in a shared record.
2. **Administrator provisioning is manual.** A privileged Firebase Console or Admin SDK operator must create the Auth user and `users/{uid}` profile. Operational access removal, account lifecycle, MFA, and privileged audit processes are not automated here.
3. **Client-controlled workflow payloads.** Firestore rules validate envelopes and selected shapes/limits, not all nested case, event, or workflow fields. A trusted server boundary and comprehensive schema validation are needed before relying on data integrity.
4. **Retention is not server-enforced.** The app checks and purges expired photos while an authorized client is active. There is no scheduled Cloud Function, bucket lifecycle rule, or verified deletion guarantee. Client fast-forward and reset controls are demo utilities.
5. **Image content is not inspected.** A valid image can still contain people, records, screens, or other identifiers. Use synthetic images only.
6. **No hardened audit pipeline or monitoring configuration.** Workflow event history is application data, not an immutable security audit log. Configure monitoring, alerting, backup/recovery, and incident response separately.
7. **No live hospital-system integration.** Firebase data is not reconciled with an authoritative bed directory, HIS/EMR, ADT feed, laboratory system, or ambulance dispatch system.
8. **No offline cache/migration contract.** Existing `localStorage`/IndexedDB demo state is not automatically migrated. The app intentionally reports remote data failures rather than silently falling back to browser state.

## Safe operating rules

- Use synthetic data only, including screenshots, issue reports, and test fixtures.
- Never enter patient, staff, or clinical information or upload real clinical images.
- Do not collect Aadhaar numbers, OTPs, identity documents, or ABHA credentials.
- Keep `.env.local` private and do not commit it. Firebase web configuration is public, but restrict API key usage in Google Cloud/Firebase settings.
- Review `firestore.rules`, `storage.rules`, facility role provisioning, and Firebase project selection before any rules deployment.
- Do not enable patient-data functionality in production before security, privacy, organizational, and regulatory requirements are reviewed and approved.

The legal basis, notice text, retention, correction/export/deletion rights, minor/guardian workflows, and ABDM consent requirements remain unresolved and require qualified product, privacy, and legal review against current official sources.

## Status

- **Implemented:** Firebase Auth gate, manual facility profiles, facility-scoped Firestore/Storage paths, allowlisted workflow records, workflow-level Firestore role rules, client-side route gating, synthetic-only warnings, occupancy and housekeeping workflows.
- **Not validated:** Emulator authorization matrix, live Firebase account and data lifecycle, deployment of the updated rules, scheduled cleanup, and deployment configuration.
- **Not implemented:** Per-operation server-enforced role permissions for shared workflows, comprehensive nested data validation, immutable audit pipeline, scheduled retention, live integrations, ABDM integration.
- **Not established:** Legal compliance, security certification, production readiness, verified cryptographic deletion, or ABHA/ABDM approval.

See [`architecture-assessment.md`](./architecture-assessment.md) for repository-level readiness context and [`deployment-and-rollback.md`](./deployment-and-rollback.md) for deployment boundaries.
