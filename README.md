# HospitalFlow — Room-Readiness Coordination Prototype

HospitalFlow is a responsive operational prototype designed for hospital room-turnaround and bed-readiness coordination in India. It streamlines the critical operational interval between patient discharge and new patient admission across **Operations**, **Nursing**, **Billing / TPA**, **Housekeeping**, and **Floor Coordinators**.

---

## 1. Architecture & Design Decisions

- **Architecture:** Client-side Single Page Application built with **React 19 + TypeScript + Vite**.
- **State Management & Persistence:**
  - Workflow records are saved in versioned browser `localStorage`; they remain on this device/browser and are not synced to Firebase or other visitors.
  - Firebase Authentication and Firestore are not used by the current demo UI. Bed-evidence upload and photo-retention controls are unavailable in local mode.
  - Existing Firestore data is not downloaded or migrated into browser storage.
- **Identity:** No sign-in or Firebase authorization is required for this local synthetic demo.
- **UI & Palette:** Calm operational SaaS interface adhering to the specified design system:
  - Deep navy text (`#0f172a`, `#1e293b`)
  - Restrained teal action accents (`#0f766e`, `#0d9488`)
  - Neutral backgrounds (`#f8fafc`, `#f1f5f9`, border `#e2e8f0`)
  - Amber for waiting / coordinator review queue (`#d97706`, `#fef3c7`)
  - Red strictly reserved for rejection notices and photo deletion (`#dc2626`, `#fee2e2`)
  - Green for completed checklists and Bed Ready status (`#15803d`, `#dcfce7`)
  - Visible text labels paired with status badges (not relying on color alone).
  - Responsive down to 320px phone widths with touch targets ≥ 44px, keyboard navigation, and `prefers-reduced-motion` compliance.

---

## 2. Operational & Security Boundaries

> [!IMPORTANT]
> **Prototype Data Boundary:** Use synthetic data only. Browser-local storage is editable and not protected by a server authorization boundary; it is not suitable for patient, staff, or clinical data. Data stays in the current browser and may be cleared by browser settings. Review [docs/security-and-privacy.md](./docs/security-and-privacy.md) before use.

> **Local demo mode:** The app opens without credentials and saves synthetic workflows only in the current browser. It does not connect to Firebase Auth or Firestore and does not sync with other users/devices.

---

## 3. Exact Windows Steps to Run Locally

### Prerequisites
- Node.js 22.12+ (Node.js 24.21.0 was used for the checks reported below)
- Windows PowerShell or Command Prompt

### Step-by-Step Instructions

1. Open PowerShell and navigate to the project directory:
   ```powershell
   cd "g:\hospital flow"
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Start the Vite local development server:
   ```powershell
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```
   *(Or the port displayed in your terminal)*

5. To build and preview production assets:
   ```powershell
   npm run build
   npm run preview
   ```

No Firebase project setup or `VITE_FIREBASE_*` environment variables are required for the local demo. Never add service-account credentials or other privileged keys to Vite variables.

Run focused rules tests with `npm test`. The test script uses Node's built-in TypeScript stripping, so use Node.js 22.12 or newer.

---

## 4. Manual Walkthrough & Workflow Verification

### Scenario A: Local Demo Bed Turnaround
1. **Create Case:** Click the **`+ Create Case`** button in the top navigation. Note the random synthetic reference (`HF-XXXX`). Select an operational ward (e.g., `Ward 4B (Stepdown ICU)`), room, bed, and priority. Click **Create Turnaround Case**. The case is saved only in this browser.
2. **Complete Handoffs:** In the case detail panel:
   - Click **`Mark Complete`** on **Nursing Handoff** (confirms chart reconciliation).
   - Click **`Mark Complete`** on **Billing / TPA Clearance** (operational placeholder).
   - *(Note: Billing can also be toggled optional via the **Settings** modal).*
3. **Confirm Departure:** Once handoffs are satisfied, the **`Confirm Room Departure & Start Housekeeping`** button becomes enabled. Click it. The previous occupant is recorded as departed, and the bed enters the Housekeeping queue.
4. **Housekeeping Cleaning:**
   - Under Step 3, note the prominent **Privacy Reminder Banner** (*"Frame only the room/bed area. Never photograph patients, healthcare workers, medical records, or screens"*).
   - Click **`Start Bed Sanitisation`**.
   - Local demo mode stops at cleaning: photo evidence upload and coordinator approval are unavailable.

The remaining photo evidence, approval, rejection, and retention walkthroughs below describe the role-based facility workflow. That login UI is temporarily unavailable; do not attempt those steps in the public guest session.

### Scenario B: Role-Based Coordinator Review (Unavailable in Guest Mode)
1. The case transitions to **Awaiting Coordinator Approval**.
   - Review the photo preview loaded from Firebase Storage, the capture timestamp, and the pending-review expiry countdown.
   - Click **`Approve Bed Ready`**.
   - The case status updates to **Bed Ready** with an approval seal.
   - An approval notice is posted in the **Operational Event History** containing the case reference, approver label (`Coordinator (Simulated)`), timestamp, and approved status (with **no photo URLs or binary bytes** in the log).
   - Retention countdown is automatically scheduled for **48 hours**.

### Scenario C: Role-Based Rejection & Re-clean Workflow (Unavailable in Guest Mode)
1. Select an active case in **Awaiting Coordinator Approval** (or upload a photo on a new case).
2. Click **`Request Re-clean / New Photo`**.
3. Select a rejection category (e.g., *"Linen unmade, wrinkled or stained"* or *"Privacy violation: Person, document, or monitor visible"*).
4. Enter an optional operational note and click **`Confirm Rejection & Delete Photo`**.
5. **Verify:**
   - The rejected image is **immediately deleted from Firebase Storage** (verifiable in Demo Controls: photo count decrements).
   - The case returns to **Re-clean Requested** state.
   - Housekeeping can upload a replacement photo.

### Scenario D: Role-Based 48-Hour Retention & Automatic Purge (Unavailable in Guest Mode)
1. Open a case marked **Bed Ready**.
2. Observe the demo control button: **`Delete Photo Now (Demo Control)`**.
3. Click **`Delete Photo Now (Demo Control)`**.
4. **Verify:**
   - The photo object is immediately deleted from Firebase Storage.
   - The preview updates to a permanent placeholder: *"Photo permanently purged per 48h retention policy. Approval status preserved."*
   - The bed remains marked **Bed Ready**.
   - The **Operational Event History** maintains the approval record and logs a retention purge event.
5. Alternatively, open **`Demo Controls`** in the header and click **`+48 Hours`** or **`+7 Days`** to simulate automatic scheduled expiration.

---

## 5. End-to-End Workflow Walkthroughs

All workflow records below are synthetic and stored in this browser's local storage. The app does not sync with Firebase or hospital systems. Directly open any route listed here or select it from the workflow navigation.

1. **Lab availability (`/labs`)** — Choose an instrument, test, future date/time, and requesting department; reserve the slot. A conflicting reservation is rejected with the next available slot. Cancel a listed reservation to release it.
2. **Equipment booking (`/equipment`)** — Select equipment and a time range to create a booking; overlapping bookings and active outage windows are rejected. Cancel bookings from the selected-date list. Report an outage with a reason and start/end time, then restore it when service is available. Utilization is shown against the displayed date's 08:00–16:00 shift hours after outages.
3. **Clinic beds (`/beds`)** — In local demo mode, create a synthetic case; complete handoffs; confirm departure; and start cleaning. Evidence uploads, coordinator review, and cloud retention controls are unavailable.
4. **Bed occupancy (`/occupancy`)** — Move a bed from occupied to cleaning, assign an on-shift crew member not assigned elsewhere, finish cleaning, and approve readiness. Coordinators can request re-clean with a reason. The board records status activity and updates capacity counts.
5. **Health camp (`/camps`)** — Allocate synthetic resource units. At 80% capacity the interface warns; an allocation above the 120-unit capacity is rejected without changing totals. Release an allocation to restore capacity.
6. **Emergency pharmacy (`/pharmacy`)** — Search or filter supplies; record a signed whole-unit adjustment with a reason. Negative resulting stock is blocked. Low/critical state, last-updated time, and recent synthetic adjustment history recalculate from saved stock.
7. **Trauma readiness (`/trauma`)** — Advance bays through use and cleaning. Mark a bay unavailable only with an operational reason, and restore it when ready. Readiness counts and update time reflect the saved state.
8. **Doctor schedule (`/clinicians`)** — Filter the synthetic roster by specialty and availability; update a demo status and confirm the filtered availability/on-call counts.
9. **Staff availability (`/staff`)** — Filter departments by coverage gap or covered status; change synthetic on-duty counts within each planned requirement and review totals and coverage percentages.
10. **General alerts (`/alerts`)** — Filter by severity and acknowledgement state; acknowledge one alert or all active alerts. Saved timestamps and the summary update; repeating an acknowledgement is idempotent.
11. **Blood bank (`/blood-bank`)** — Record a reasoned whole-unit receipt or correction. Negative stock is blocked; the saved inventory and recent adjustment history update. Always confirm real availability and compatibility outside this demo.
12. **Ambulance arrivals (`/ambulance`)** — Progress a synthetic arrival from inbound to arrived and handover complete. A completed handover cannot advance again; the saved timestamp and counts update.
13. **Isolation rooms (`/infection-control`)** — Progress synthetic rooms from available to occupied, cleaning, and available. Room counts and last-updated timestamps change with each valid transition. These statuses do not represent clinical clearance.

## 6. Scope & Remaining Production Needs

The `/occupancy` workspace includes a synthetic ward bed board, occupancy metrics, cleaning crew assignment, cleaning completion, readiness review/re-clean transitions, and a recent activity feed. Changes are stored in the same browser-local workflow store as the other scenarios.

The current local-only app does not enforce facility roles or connect to Firestore. Legacy Firebase rules remain in the repository but are not used by this UI. This prototype still uses synthetic/demo crew records and has no staff/bed directory synchronization or verified clinical source of truth.

## 7. Architecture, Privacy & Integration Readiness

Repository reconnaissance, current limitations, and a staged path toward secure backend and ABDM sandbox work are documented in [`docs/architecture-assessment.md`](./docs/architecture-assessment.md), [`docs/security-and-privacy.md`](./docs/security-and-privacy.md), and the other readiness documents under [`docs/`](./docs/).

HospitalFlow currently runs as a browser-local synthetic demo without Firebase authentication or cloud persistence. It is **not** production-ready for patient data, ABDM-integrated, certified, or legally approved. See [docs/security-and-privacy.md](./docs/security-and-privacy.md) for the current implementation boundary and outstanding controls.
