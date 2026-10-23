# VS Code build prompt — HospitalFlow Resource Intelligence

Paste this prompt into the VS Code coding assistant after opening the `HospitalFlow-Resource-Intelligence` folder.

```text
Build a working, responsive prototype called “HospitalFlow — Resource Intelligence Dashboard” based on the supplied project brief. It has four selectable scenarios in one resource dashboard:

A. University lab availability: instrument occupancy, reservation conflicts, and next available testing slots.
B. Shared pilot equipment booking: equipment utilization and transparent maintenance outages.
C. Community clinic bed-status board: available/occupied/cleaning beds, housekeeping photo submission, coordinator photo approval/rejection, and 48-hour photo expiry after approval.
D. Simulated health-camp resource allocation: capacity, allocated units, remaining units, and capacity/conflict flags.

This is a demo, not a production hospital system. Use synthetic data and do not add login, role management, patient identifiers, clinical records, live IoT, external APIs, cloud services, or third-party analytics. All controls can be demo-accessible. Make the scenario switcher obvious and keep an event feed with at least five initial resource updates, including a conflict and a capacity warning.

Required interactions:
- A: create a reservation; block or visibly flag a time-slot conflict without overwriting an existing reservation; compute the next open slot from the modeled schedule.
- B: create/restore a maintenance outage and show its effect on availability.
- C: update a bed status; upload a synthetic image; submit it for coordinator approval; approve or reject with a reason. Rejecting removes that image. Approval leaves a text approval notice in the event history and schedules image deletion exactly 48 hours after approval. Pending images expire after 7 days as a clearly labeled demo assumption. Add a demo-only immediate deletion control.
- D: allocate resource units; prevent allocation above capacity and flag resources at 80% or greater.
- All scenarios: show resource metrics, current state, update feed and clear success/error feedback. Persist synthetic metadata locally and photos only in IndexedDB. No photo bytes or object URLs in logs or exports. No service-worker caching of photos.

Design for phone and desktop; photo capture should work with a phone camera when browser-supported. Use semantic controls, accessible labels, visible focus and status text that does not depend on color alone. Explain that the current demo has no authentication and local browser deletion is not a production retention guarantee.

First inspect existing files and preserve the current prototype when possible. Work in small steps. Keep the implementation understandable for a student. Create a README with local run steps and an evidence checklist. Do not add or run automated tests unless requested. Do not claim prediction, AI, real-time IoT, security compliance, or successful deployment unless actually implemented and verified. Report changed files and what I should click to demonstrate A–D.
```
