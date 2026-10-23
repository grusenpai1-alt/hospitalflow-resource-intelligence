# HospitalFlow Architecture Assessment

**Assessment date:** 2026-10-24
**Scope:** Repository state inspected in the current VS Code workspace. This is a code/configuration review, not a production penetration test or legal assessment.

## Current architecture

- **Frontend:** React 19 + TypeScript, bundled with Vite 8; one client-rendered SPA.
- **Routing:** `src/App.tsx` selects workflows from `window.location.pathname`; route names and UI are client-side.
- **Application state:** React context for room-turnaround cases; local React state for resource workflows, persisted in versioned browser `localStorage`.
- **Persistence:** Workflow records and settings remain only in the current browser profile; they are not synced to Firestore or other devices. Bed photo evidence is unavailable.
- **Server/API:** No application API handlers or backend service were found in the inspected source. The app does not have server-side request validation or authorization.
- **Database:** The current UI does not use Firestore or any server API, ORM, or migration system. Legacy rules remain in the repository for possible future use.
- **Authentication/authorization:** No authentication or server authorization is used by the current UI. The demo role profile is client-side only and does not isolate users.
- **Deployment:** Vercel project `hospital-flow`; Vite static build (`npm run build`). No Vercel Functions/API implementation or committed `vercel.json` was found. Firebase environment variables are not required for the current browser-only mode.

## Relevant files

| Area | Files |
|---|---|
| Application shell and route selection | `src/App.tsx`, `src/main.tsx` |
| Room-turnaround state and operations | `src/context/HospitalFlowContext.tsx`, `src/types/index.ts` |
| Local demo session and browser persistence | `src/context/DemoSessionContext.tsx`, `src/context/FacilityDataContext.tsx`, `src/services/localWorkflowStorage.ts` |
| Firebase photo storage and synthetic seed data | `src/services/cloudPhotoStorage.ts`, `src/services/storage.ts` |
| Firebase rules and project configuration | `firestore.rules`, `storage.rules`, `firebase.json`, `.firebaserc` |
| Scenario workflows | `src/components/ScenarioWorkspace.tsx`, `src/components/EmergencyWorkspaces.tsx` |
| User-facing data boundary reminders | `src/components/Header.tsx`, `src/components/CreateCaseModal.tsx`, `src/components/CaseDetail.tsx` |
| Build and dependencies | `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json` |

## Existing features and dependencies

The prototype includes bed-readiness coordination, labs, equipment, beds, camps, pharmacy, trauma, clinicians, staff, alerts, blood-bank availability, ambulance arrivals, isolation-room availability, and a bed occupancy/cleaning crew board. Workflow records use browser-local storage. Seeded data and crew records are synthetic placeholders.

Runtime dependencies are React, React DOM, and Lucide icons. There is no database, authentication provider, API client, schema-validation library, or test runner in `package.json`.

## Data flow

1. The browser loads a static Vite bundle from Vercel.
2. React selects a workflow based on the URL path and renders its client-side UI.
3. Workflow state is loaded from and saved to versioned browser storage; no Firebase request is made for workflow data.
4. Client-side UI role checks are not an authorization boundary; a visitor can modify local state.
5. The Vercel static deployment does not provide an application API, granular role enforcement, scheduled retention, or live hospital-system synchronization.

## Authentication and authorization assessment

The current browser-only UI has no Firebase Auth session or server-side role validation. Its local demo profile only controls which demo screens are shown; local data can be edited by the browser user. The app must not be used for real patient or ABHA data.

## Database and deployment assessment

Firestore and Firebase Storage rules are retained as legacy configuration and are not used by the current application flow. Production use of sensitive workflows requires granular server-enforced authorization, complete validation, scheduled retention, audit, monitoring, and recovery controls.

The Vercel preview deployment completed with status READY on 2026-10-23. It was an isolated preview deployment. The production URL was not promoted or changed during this assessment.

## Security risks and technical debt

1. **Coarse role authorization:** Client role gates do not provide server security; non-viewer roles can write all workflow documents under a facility.
2. **Incomplete payload validation:** Security rules bound record sizes and validate selected fields but do not validate every nested workflow field.
3. **Photo data risk:** The bed-photo upload accepts user images. UI warnings and MIME/size checks do not prove that a photo is free of patient/staff identity, charts, screens, or other sensitive content.
4. **No server-side API or rate limiting:** Data access is directly from the browser Firebase SDK.
5. **Retention limitations:** Client-triggered cleanup is not a centrally enforced retention/deletion control.
6. **No automated test suite or rules emulator validation:** No test files or test script were found; Firebase rules have not been emulator-validated.
7. **No ABDM adapter or protocol contract:** No official integration, sandbox credentials, callbacks, or server-side protocol client were found.

## Proposed minimal-change architecture

1. Preserve the current static demo and its strict synthetic-data boundary.
2. Before collecting identity or health data, choose and approve an authentication provider, authorization model, backend runtime, database, hosting region/residency requirements, retention policy, and operational owner.
3. Add a server-side API boundary. Validate every request server-side, authenticate callers, authorize per organization/resource, and return generic errors without sensitive values.
4. Introduce a database only after data ownership, consent, identifier, audit, and retention requirements are agreed. Keep internal UUIDs separate from external identifiers; do not use ABHA as a primary key.
5. Add integration adapters on the server. Keep secrets and credentials out of browser bundles and preview deployments; test against a sandbox with approved synthetic test identities.
6. Add unit, API authorization, persistence, and integration-contract tests before any sensitive-data pilot.

This is a proposed direction, not an implementation claim.

## Dependencies and unresolved decisions

- Which ABDM capability is actually required: identity verification/linking, facility registration, or health-information exchange?
- Which organization/facility and participant role is eligible and authorized for that capability?
- Who owns clinical/privacy policy, consent, data retention, incident response, and production approvals?
- Which backend, identity provider, database, region, backup, and key-management system are approved?
- Is there an authorized sandbox enrollment and current official integration specification for the selected capability?
- Are there existing hospital-system interfaces or contractual requirements?

## Prioritized implementation backlog

| Priority | Work | Gate |
|---|---|---|
| P0 | Keep demo synthetic-only; do not enter patient, ABHA, or real photo data | Current |
| P1 | Product/security decisions for identity, hosting, database, access model, retention, and scope | Owner approval |
| P1 | Build server API, authentication, authorization, validation, and audit foundation | P1 decisions |
| P1 | Define database schema, migration/backup/retention model, and access policies | Backend selection |
| P2 | Add patient identity and consent workflows only for an approved use case | Security/privacy review |
| P2 | Verify current official ABDM contract and implement an isolated sandbox adapter | Sandbox access and contract |
| P3 | Controlled pilot, monitoring, operational readiness, independent security review, and production approval | All prior gates |

## Verification

Baseline run on 2026-10-23:

- `npm run build`: passed (TypeScript project build and Vite production bundle).
- `npm run lint`: exited successfully; five existing warnings in `CaseList.tsx`, `HospitalFlowContext.tsx`, and `CaseDetail.tsx`.
- Tests: no test script or test files were found.

## Official ABDM references checked

Checked 2026-10-23. The public sites are JavaScript applications; this assessment could verify the official portals exist, but could not retrieve readable, versioned API contracts from their public HTML responses.

- [ABDM official portal](https://abdm.gov.in/)
- [ABDM Sandbox](https://sandbox.abdm.gov.in/)
- [ABHA portal](https://abha.abdm.gov.in/)

**Not verified:** API endpoints, payloads, authentication schemes, callback signing, participant eligibility, production onboarding, or certification requirements. No integration behavior has been implemented or inferred from these links.
