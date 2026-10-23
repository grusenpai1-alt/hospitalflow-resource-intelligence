# 36-hour rollout plan: HospitalFlow Resource Intelligence

## Project framing

This prototype follows **Track 2, Project 7: Hospital Bed & Resource Intelligence Dashboard** from the supplied Navadhara 2026 brief. The brief lists A–D as implementation options; this plan treats them as four selectable demo scenarios sharing one resource dashboard. That lets the team show the common engine and compare the scenarios without implying that hospitals use all four workflows in one deployment.

This is a challenge/demo scope. It does not replace the earlier market-validation work for a commercial HospitalFlow product.

## Demo objective

Show a clear central view of resource state, availability, utilization, reservations/outages, and capacity. Make at least five live resource updates visible and demonstrate conflict and capacity flags. Use transparent deterministic rules; do not call this predictive unless a forecast is implemented and evaluated.

## Shared model

Each resource has an ID, name, scenario, location, current status, capacity or utilization, last update time, and event history. Scenario-specific data is:

- **A:** instrument reservation time slots and next available slot.
- **B:** equipment booking status and maintenance-outage window.
- **C:** clinic bed state and temporary housekeeping photo evidence.
- **D:** camp resource type, units allocated and total capacity.

Common dashboard: scenario switcher, metric cards, resource list, event feed, conflict/capacity flags, and a clearly marked synthetic-data state.

## Schedule

| Time | Work | Exit evidence |
|---|---|---|
| 0–2 h | Confirm four modes, data boundary, screen layout, and demo story | One-page scope; named demo presenter; sample scenario values approved |
| 2–8 h | Build shell, scenario switcher, common resource model, synthetic seed and activity feed | Each A–D view renders; five initial updates visible |
| 8–15 h | Add interactions: reservations, conflict detection, outage, bed status/photo approval, camp allocation | Presenter can perform one meaningful state change in each scenario |
| 15–20 h | Add metric summaries, next-slot/capacity logic, warnings and event history | Conflict and capacity flags respond to changes; over-capacity action is blocked |
| 20–25 h | Responsive layout, accessibility pass, empty/error states, README | Core tasks usable at desktop and phone widths |
| 25–30 h | Rehearse end-to-end demo; fix confusing transitions; reset synthetic data | A 3–5 minute demo runs reliably from reset |
| 30–34 h | Capture screenshots/video and prepare evidence notes | Evidence includes five resource updates, conflict, capacity flag, A–D scenario changes |
| 34–36 h | Final review, backup copy, presenter handoff | Working local copy; known limitations and setup steps documented |

## Demo sequence

1. Open the overview and point out the five existing updates in the feed.
2. In **A**, reserve a slot already occupied on the PCR workstation; show the conflict warning and preserved original reservation. Then reserve an open slot and show the next available slot update.
3. In **B**, report a maintenance outage, show the resource no longer available, then restore it.
4. In **C**, show clinic bed statuses, upload a synthetic housekeeping photo, approve or reject it, and point out the 48-hour retention notice. The approval notice remains after photo deletion.
5. In **D**, allocate a camp resource until it reaches the 80% warning, then attempt to exceed total capacity and show the guardrail.
6. End by emphasizing that all values are synthetic and “real-time” in this demo means user-triggered local updates, not a live hospital feed.

## Evidence checklist from the brief

- [ ] At least five live resource updates.
- [ ] Reservation conflict flag.
- [ ] Capacity flag and blocked over-allocation.
- [ ] Demonstrable resource state update in each of options A, B, C and D.
- [ ] Desktop and mobile-width views.
- [ ] Photo approval notice and retention behavior demonstrated with synthetic image only.
- [ ] No claims of predictive performance, clinical accuracy, integration, security certification or customer validation.

## Decisions to revisit after the event

- Are options A–D intended to be four demo modes, or should the submitted pitch select one as the primary use case?
- Which scenario is the actual target customer and budget owner?
- What authoritative system would provide resource state and what integration is available?
- What does “real-time” mean for the buyer: manual update, periodic sync, API integration or IoT telemetry?
- Should the bed photo feature remain in the commercial product, and what exact retention policy does a pilot hospital approve?
