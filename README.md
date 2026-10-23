# HospitalFlow Resource Intelligence Dashboard

Responsive local prototype for the four project options in the supplied Navadhara 2026 image:

- **A — University lab availability:** instrument occupancy, next slots and reservation conflict flags.
- **B — Shared equipment booking:** utilization and visible maintenance outages.
- **C — Community clinic beds:** bed status, housekeeping photo submission and coordinator approval.
- **D — Health camp allocation:** resource units, remaining capacity and capacity flags.

## Run locally

Open this folder in VS Code and launch `index.html` with the Live Server extension, or run `python -m http.server 4173` in this folder and visit `http://localhost:4173`.

Select A–D in the left navigation. The board starts with five synthetic live updates. Try these actions:

1. **A:** New reservation → choose PCR workstation → reserve its existing 09:00 slot to display a conflict; choose an open slot to reserve it.
2. **B:** Report outage on the pilot centrifuge, then restore it.
3. **C:** Select clinic beds → upload a synthetic room image to a bed in cleaning → approve or request re-clean.
4. **D:** Allocate another consultation station unit to see the 80% capacity flag update; try exceeding capacity to confirm the guardrail.

## Demo boundaries

Synthetic data only; no login, staff designations, backend, real-time network feed, hospital integration, or patient data. Resource updates are local browser interactions. Photos stay in IndexedDB and expire 48 hours after approval (or after 7 days while pending review) when the demo is open or next reopened. This is illustrative browser storage, not a production-grade deletion guarantee. Do not upload real hospital photos.

## Evidence to capture for a 36-hour project

- Show at least five resource updates in the feed, including one user-created update.
- Demonstrate an existing reservation conflict and a new reservation action.
- Demonstrate one equipment outage and restoration.
- Demonstrate bed turnover, photo approval/rejection and photo retention notice.
- Demonstrate a camp resource reaching the capacity threshold and a blocked over-allocation.
- Capture a desktop overview and a phone-width screen.
- Record which values are synthetic and avoid claiming prediction: this model uses transparent rules and displayed counts, not a validated forecasting model.
