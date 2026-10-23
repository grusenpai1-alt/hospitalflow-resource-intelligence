# Database Design Proposal

**Status:** The current UI is a browser-only synthetic demo. Firebase Authentication and Firestore are not used for workflow access or persistence. This document is a conceptual proposal for a future patient-data system; it is not a migration or an approved clinical data model.

## Current storage

- Workflow records and settings are saved in versioned browser `localStorage`, scoped only by browser profile; there is no cloud sync or server-side authorization.
- Firebase Auth/Firestore/Storage are not used by the current UI flow. Legacy rules and SDK dependencies remain for possible future integration but do not protect local browser data.
- Bed-evidence upload and review are unavailable in local mode.
- Browser-local demo data is mutable, may be cleared by browser settings, and is not backed up or migrated from Firestore.
- No server API, ORM, or migration system is configured. Current validation and data integrity are not production-grade.

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
