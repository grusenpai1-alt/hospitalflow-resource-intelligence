# Database Design Proposal

**Status:** Firebase Authentication, Firestore, and Firebase Storage client integration and initial rules are configured for the synthetic-data prototype. This document is a conceptual proposal for any future patient-data system; it is not a migration or an approved clinical data model.

## Current storage

- Workflow state and settings are stored in facility-scoped Firestore documents under `facilities/{facilityId}/workflows/{workflowId}`.
- Bed photo blobs are stored in facility-scoped Firebase Storage paths; download URLs and image bytes are not written into workflow records.
- Firebase Email/Password Authentication gates access; trusted administrators provision user facility profiles at `users/{uid}`.
- Firestore and Storage rules provide facility-scoped access and enforce workflow-level write roles. Bed-case and occupancy-board writes are limited to admins/coordinators because those shared records combine operations with privileged approval actions. Other workflow documents still need per-operation authorization or a trusted backend before real use.
- Existing localStorage/IndexedDB demo records are not migrated and the app has no browser-storage fallback.
- No server API, ORM, or migration system is configured. Current validation, role enforcement, and photo retention are not production-grade.

## Do not use current browser stores for patient data

Browser storage is user/device-local, mutable, not a server authorization boundary, and not suitable as the protected record of a multi-user healthcare system. The prototype must remain synthetic-data-only.

## Future conceptual entities

Implement only entities needed by an approved product workflow, after selecting a database and reviewing official requirements:

- **organizations/facilities:** tenant ownership and facility identifiers.
- **users/memberships/roles:** authenticated actors and scoped access grants.
- **patients:** immutable internal UUID, minimal approved demographics, organization ownership, timestamps, and record status.
- **patient_identifiers:** separate external identifier type/issuer/value reference, verification status and provenance; do not use ABHA as the internal key or store Aadhaar/OTP by default.
- **consent_records:** subject/representative, purpose, data categories, operation, notice/consent version, status, timestamps, expiration/revocation, and evidence/provenance as required by the approved workflow.
- **health_records / record_access_grants:** add only if an approved clinical or interoperability use case requires them.
- **audit_events:** actor, tenant, action, stable internal reference, timestamp, outcome, and integrity/retention controls; exclude secrets and unnecessary PII.

## Required controls before a migration is approved

- Database and region selection, tenant isolation, and least-privilege service identities.
- Server-side request validation and authorization in addition to relational constraints.
- Internal UUID relationships; protected external identifier lookup and uniqueness strategy.
- Encryption/key management and key-rotation approach appropriate to the selected provider.
- Bounded pagination and query limits.
- Backup, restore, migration, retention, correction/export/deletion, and audit procedures.
- Tests for cross-tenant/cross-patient access and unauthorized role escalation.

No schema migration should be generated or run until the product owner approves the use case, data model, provider, and privacy/security requirements.
