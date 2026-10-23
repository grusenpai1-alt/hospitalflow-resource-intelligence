# HospitalFlow workflow acceptance matrix

All fixtures and example labels must be synthetic. The current browser-only demo stores workflow state in versioned localStorage and does not use Firebase Auth or Firestore. Photo upload and review are unavailable.

| Feature | Acceptance checks | Verification |
|---|---|---|
| Shared navigation and overview | Every registered path maps directly; active nav uses `aria-current`; unknown/nested paths show not-found; overview counts derive from local workflow snapshots; mobile navigation remains usable without sign-in. | Route helper tests; browser workflow verification |
| Lab reservations | Instrument/date/time required; same slot cannot be reserved twice across transaction retries; conflict suggests the next available slot; reservations can be cancelled; metrics and table derive from saved state. | Business-rule tests; Firestore interaction not emulator-tested |
| Equipment | Positive duration and valid time window required; overlaps and active maintenance block booking; outage requires reason/start/end; restore closes the outage; cancellation frees capacity; utilization is booked hours divided by available 08:00–16:00 shift hours for selected date. | Business-rule tests; Firestore interaction not emulator-tested |
| Clinic beds | Case lifecycle, handoffs, departure, and cleaning save locally; photo evidence and cloud retention controls are unavailable. | Workflow-rule tests; browser storage persistence test |
| Occupancy and crew | Occupied → cleaning → awaiting approval → available; re-clean requires a reason; off-shift/already-assigned crew cannot be assigned twice; counts/activity update transactionally. | Build and code path review; Firestore interaction not emulator-tested |
| Health camps | Capacity 120; warn at 80%; over-capacity blocked with no write; release restores capacity. | Business-rule tests; Firestore interaction not emulator-tested |
| Pharmacy | Low/critical classification derives from par level; non-zero signed whole-unit adjustments require a reason; stock cannot go negative; timestamp/history update; search/status/category filters work. | Business-rule tests; UI/cloud interaction not manually verified |
| Trauma readiness | Valid transitions only; unavailability requires reason; unavailable bays must be restored; readiness counts and last-updated time change. No patient details or triage logic. | Business-rule tests; Firestore interaction not emulator-tested |
| Doctor schedule | Synthetic clinician roster filters by specialty/status; filtered availability/on-call counts recalculate; existing status selector updates state. No schedule-overlap editing. | Build only; browser workflow not manually verified |
| Staff coverage | Counts are integers bounded by the staffing plan; coverage percentages and filtered totals derive from current records; no staff identity data. | Business-rule tests; Firestore interaction not emulator-tested |
| Alerts | Severity/status filters; acknowledge-one/all updates summary and timestamp; repeat acknowledgement is idempotent; save failure is visible. | Business-rule tests; Firestore interaction not emulator-tested |
| Blood products | Non-zero signed whole-unit adjustments require reason; no negative units; update timestamp and bounded history; compatibility/demo disclaimer remains. | Shared stock rule tests; Firestore interaction not emulator-tested |
| Ambulance coordination | Inbound → arrived → handover complete; counts and timestamp update; completed handovers cannot advance. Synthetic only. | Business-rule tests; Firestore interaction not emulator-tested |
| Isolation rooms | Available → occupied → cleaning → available; counts and timestamp update; status does not imply clinical clearance. | Business-rule tests; Firestore interaction not emulator-tested |
| Build and lint | TypeScript/Vite build, focused tests, and configured Oxlint run. | Build passed with a >500 kB chunk warning; 11 tests passed; Oxlint exited 0 with 22 React warnings (not baseline-compared), no lint errors. |

## Boundaries and limitations

- This is an operational demo, not a hospital source of truth or clinical decision-support system.
- The current local demo does not authenticate users or provide role isolation; its profile is only a client-side UI convenience.
- Browser/client-triggered cleanup is not a guaranteed server-side deletion schedule.
- No real patient, staff, contact, identity, clinical, dispatch, or hospital-integration data may be entered.
- Local storage is mutable, device-local, and not backed up; the current flow does not read Firebase or existing Firestore data.
- No image uploads are available in local demo mode.
