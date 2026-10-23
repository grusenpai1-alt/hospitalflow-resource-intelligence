# HospitalFlow workflow inventory

This inventory describes the current application surfaces and delivered behavior. All records and names are synthetic. The current temporary mode requires no sign-in and stores workflows in browser-local storage; it does not use Firestore or Firebase Authentication. Bed-turnaround photo evidence is unavailable in this mode.

## Shared shell and navigation

| Route / surface | Current controls and behavior | Intended behavior | Status |
|---|---|---|---|
| `/` — All workflows | Sticky workflow navigation; 13 workflow cards; data-derived summary counts; privacy note. Cards and nav links use native anchors. | Show counts from workflow records; every card/nav item opens the right route; keyboard focus and active link are clear. | Implemented; local demo mode |
| Unknown or nested path — Not found | Unknown and nested paths resolve to a not-found state with a link back to All workflows. | Never imply an unknown URL is a valid workflow. | Implemented and route-unit-tested |
| Shared header | HospitalFlow brand and local-data warning; on `/beds`, Create Case, Settings, and local Reset actions. Cloud photo controls are hidden. | Keep data local, synthetic, and clearly labeled. | Implemented |
| Access | App opens without sign-in. | Do not request or store Firebase credentials in local demo mode. | Implemented |
| Global notifications | Success/error/info toast with dismiss button. | Keep actionable outcomes visible and dismissible; mutations must not claim success before browser storage saves. | Existing |

## Workflow routes

| Route | Visible controls and current behavior | Intended behavior | Status |
|---|---|---|---|
| `/labs` — Lab availability | Instrument/test/date/time/department form, available-slot summary, conflict feedback/next slot, reservation table, cancellation. | Validate required fields and future slots; transactionally prevent duplicate reservations; refresh summaries from saved state. | Implemented; rule-tested |
| `/equipment` — Equipment booking | Equipment/date/time/duration/department form; bookings and cancellations; outage reporting/restoration with reason and time window; availability and utilization. | Reject invalid ranges, overlapping bookings, and active outage conflicts; calculate utilization from booked hours / available shift hours for selected date. | Implemented; rule-tested |
| `/beds` — Clinic beds | Case queue/detail; case creation; handoffs, departure, cleaning, settings, local reset. Photo evidence and cloud retention controls are unavailable. | Keep turnaround data synthetic and local; no photo evidence in browser-only mode. | Implemented; workflow rules tested |
| `/occupancy` — Bed occupancy | Bed status cards; occupied-to-cleaning; assign crew; finish cleaning; approve/re-clean; activity feed and summary counts. | Enforce valid status transitions and unique on-shift crew assignment transactionally; require re-clean reason; update bed and crew counts. | Implemented; cloud behavior unverified |
| `/camps` — Health camp | Resource type, units, team form; capacity meter and allocation list; warning and release action. | Centralized capacity math; warn at 80%; reject over-capacity without write; restore capacity on release. | Implemented; rule-tested |
| `/pharmacy` — Emergency pharmacy | Synthetic stock table; search, category/status filters; signed integer adjustment with reason; updated time and bounded event history. | Compute low/critical thresholds; reject invalid/negative stock changes; persist atomically with history. | Implemented; rule-tested |
| `/trauma` — Emergency & trauma | Synthetic bay status transitions; mark unavailable with reason; restore; display update time and readiness counts. | Enforce valid transition graph and reasoned unavailability; no triage or patient records. | Implemented; rule-tested |
| `/clinicians` — Doctor schedule | Synthetic clinician roster; specialty/status filters; status selector; filtered availability/on-call counts. | Keep fictional names and shifts; do not add schedule editing or identity data. | Implemented; manually unverified |
| `/staff` — Staff availability | Synthetic aggregate department staffing; gap/covered filter; bounded on-duty count inputs; percentage and totals. | Reject counts outside integer 0..planned; recalculate filtered totals. | Implemented; rule-tested |
| `/alerts` — General alerts | Severity and acknowledgement filters; acknowledge one/all; active, urgent, and total counts; timestamps. | Idempotent acknowledgement; update saved status and expose save failures. | Implemented; rule-tested |
| `/blood-bank` — Blood products | Synthetic product table; reasoned signed whole-unit adjustment; timestamps and bounded adjustment history. | Prevent negative inventory; show demo and compatibility disclaimer; do not make clinical decisions. | Implemented; shared stock rule-tested |
| `/ambulance` — Incoming coordination | Fixed synthetic arrival list; inbound → arrived → handover complete; counts and status update timestamps. | Enforce progression and prevent advancing completed handovers; no patient details or live dispatch. | Implemented; rule-tested |
| `/infection-control` — Isolation rooms | Synthetic room list; available → occupied → cleaning → available; counts and status timestamps. | Enforce valid progression; status does not imply clinical clearance or diagnosis. | Implemented; rule-tested |

## Bed-turnaround dialogs and controls

| Surface | Controls and behavior | Intended behavior | Status |
|---|---|---|---|
| Create Case dialog | Ward, room, bed, bed type, priority; create/cancel. | Validate required synthetic room fields and prevent duplicate active bed cases. | Existing |
| Case Detail | Toggle nursing and billing handoffs; confirm departure; start cleaning; select/upload synthetic photo or generate synthetic photo; approve bed ready; request re-clean; inspect event history. | Enforce lifecycle order and reviewer/housekeeping roles; accept supported type and size; never log image bytes, paths, or URLs. Browser UI cannot verify whether a selected image is truly synthetic. | Existing |
| Rejection dialog | Select rejection category, optional note, confirm/delete photo or cancel. | Require a reason, remove the rejected image, preserve only minimal event metadata, permit replacement. | Existing |
| Demo Controls | Simulate elapsed time, inspect storage summary, delete photo now. | Keep admin-only; report deletion failure rather than implying deletion; keep actual expiry policy explicit. | Existing |
| Workflow Settings | Billing optional, pending-photo expiry, fixed approved-photo retention display (48 hours), purge interval. | Validate configured pending-photo bounds; approved-image expiry is fixed at 48 hours. | Existing |
| Reset | Browser confirmation; reset synthetic cases/photos for facility. | Keep admin-only, confirm destructive demo reset, and report errors. | Existing |
