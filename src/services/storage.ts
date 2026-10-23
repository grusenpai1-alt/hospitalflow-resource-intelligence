import type { HospitalCase, WorkflowSettings, EventLog } from '../types';

export const DEFAULT_SETTINGS: WorkflowSettings = {
  billingOptional: false,
  pendingPhotoExpiryDays: 7,
  approvedPhotoRetentionHours: 48,
  autoPurgeIntervalSeconds: 30,
};

/**
 * Generate a random synthetic case reference, e.g. "HF-8391"
 */
export function generateCaseRef(): string {
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `HF-${randNum}`;
}

/**
 * Creates default initial synthetic cases for India hospital demo context.
 * Strictly NO patient PII, ABHA, clinical data or diagnoses.
 */
export function getInitialSyntheticCases(): HospitalCase[] {
  const now = new Date();

  // Case 1: Awaiting Coordinator Approval
  const case1Created = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
  const case1Uploaded = new Date(now.getTime() - 12 * 60 * 1000).toISOString();
  const case1Expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const case1Events: EventLog[] = [
    {
      id: 'evt-101',
      caseRef: 'HF-2490',
      timestamp: case1Created,
      type: 'CASE_CREATED',
      actorLabel: 'Operations',
      summary: 'Operational turnaround initiated for Ward 4B, Room 402, Bed 1',
    },
    {
      id: 'evt-102',
      caseRef: 'HF-2490',
      timestamp: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
      type: 'NURSING_HANDOFF',
      actorLabel: 'Nursing',
      summary: 'Patient transfer complete, nursing handoff acknowledged',
    },
    {
      id: 'evt-103',
      caseRef: 'HF-2490',
      timestamp: new Date(now.getTime() - 35 * 60 * 1000).toISOString(),
      type: 'BILLING_HANDOFF',
      actorLabel: 'Billing / TPA',
      summary: 'Interim TPA clearance acknowledged (operational placeholder)',
    },
    {
      id: 'evt-104',
      caseRef: 'HF-2490',
      timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      type: 'ROOM_DEPARTURE',
      actorLabel: 'Operations',
      summary: 'Physical room departure confirmed. Bed transferred to Housekeeping',
    },
    {
      id: 'evt-105',
      caseRef: 'HF-2490',
      timestamp: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
      type: 'CLEANING_STARTED',
      actorLabel: 'Housekeeping',
      summary: 'Deep sanitisation and terminal linen replacement initiated',
    },
    {
      id: 'evt-106',
      caseRef: 'HF-2490',
      timestamp: case1Uploaded,
      type: 'PHOTO_UPLOADED',
      actorLabel: 'Housekeeping',
      summary: 'Sanitised bed verification photo submitted. Case awaiting coordinator review',
      // CRITICAL: Strictly no photo URLs, file names or bytes
    },
  ];

  const case1: HospitalCase = {
    id: 'case-synth-1',
    caseRef: 'HF-2490',
    ward: 'Ward 4B (Stepdown)',
    room: 'Room 402',
    bed: 'Bed 1',
    bedType: 'Motorised Fowler Bed',
    priority: 'HIGH_TURNOVER',
    status: 'AWAITING_REVIEW',
    createdAt: case1Created,
    nursingComplete: true,
    nursingCompletedAt: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
    billingComplete: true,
    billingCompletedAt: new Date(now.getTime() - 35 * 60 * 1000).toISOString(),
    departureConfirmed: true,
    departureConfirmedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    cleaningStarted: true,
    cleaningStartedAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
    photoUploaded: true,
    photoUploadedAt: case1Uploaded,
    photoExpiresAt: case1Expires,
    photoPurged: false,
    events: case1Events,
  };

  // Case 2: Handoffs Pending (New discharge)
  const case2Created = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const case2Events: EventLog[] = [
    {
      id: 'evt-201',
      caseRef: 'HF-6184',
      timestamp: case2Created,
      type: 'CASE_CREATED',
      actorLabel: 'Operations',
      summary: 'Discharge turnaround created for Ward 2A, Room 210, Bed 3',
    },
    {
      id: 'evt-202',
      caseRef: 'HF-6184',
      timestamp: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
      type: 'NURSING_HANDOFF',
      actorLabel: 'Nursing',
      summary: 'Discharge summary handed over; medication reconciliation completed',
    },
  ];

  const case2: HospitalCase = {
    id: 'case-synth-2',
    caseRef: 'HF-6184',
    ward: 'Ward 2A (Surgical Post-Op)',
    room: 'Room 210',
    bed: 'Bed 3',
    bedType: 'Standard Ward Bed',
    priority: 'NORMAL',
    status: 'HANDOFFS_PENDING',
    createdAt: case2Created,
    nursingComplete: true,
    nursingCompletedAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
    billingComplete: false,
    departureConfirmed: false,
    cleaningStarted: false,
    photoUploaded: false,
    photoPurged: false,
    events: case2Events,
  };

  // Case 3: Bed Ready (Approved 6 hours ago; retention countdown 42 hours remaining)
  const case3Created = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString();
  const case3Approved = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
  const case3PhotoExpiry = new Date(new Date(case3Approved).getTime() + 48 * 60 * 60 * 1000).toISOString();

  const case3Events: EventLog[] = [
    {
      id: 'evt-301',
      caseRef: 'HF-9315',
      timestamp: case3Created,
      type: 'CASE_CREATED',
      actorLabel: 'Operations',
      summary: 'Turnaround initiated for Ward 1 (Day Care & Dialysis), Room 105, Bed 2',
    },
    {
      id: 'evt-302',
      caseRef: 'HF-9315',
      timestamp: new Date(now.getTime() - 7 * 60 * 60 * 1000).toISOString(),
      type: 'ROOM_DEPARTURE',
      actorLabel: 'Operations',
      summary: 'Physical room departure confirmed',
    },
    {
      id: 'evt-303',
      caseRef: 'HF-9315',
      timestamp: new Date(now.getTime() - 6.5 * 60 * 60 * 1000).toISOString(),
      type: 'PHOTO_UPLOADED',
      actorLabel: 'Housekeeping',
      summary: 'Bed ready image uploaded for coordinator inspection',
    },
    {
      id: 'evt-304',
      caseRef: 'HF-9315',
      timestamp: case3Approved,
      type: 'APPROVAL_NOTICE',
      actorLabel: 'Coordinator (Simulated)',
      summary: 'Bed readiness approved. Workflow closed. Image retention set to 48 hours.',
      details: 'Case Ref: HF-9315 | Status: Bed Ready | Approver: Coordinator',
    },
  ];

  const case3: HospitalCase = {
    id: 'case-synth-3',
    caseRef: 'HF-9315',
    ward: 'Ward 1 (Day Care)',
    room: 'Room 105',
    bed: 'Bed 2',
    bedType: 'Day Care Recliner Bed',
    priority: 'URGENT',
    status: 'BED_READY',
    createdAt: case3Created,
    nursingComplete: true,
    nursingCompletedAt: new Date(now.getTime() - 7.5 * 60 * 60 * 1000).toISOString(),
    billingComplete: true,
    billingCompletedAt: new Date(now.getTime() - 7.2 * 60 * 60 * 1000).toISOString(),
    departureConfirmed: true,
    departureConfirmedAt: new Date(now.getTime() - 7 * 60 * 60 * 1000).toISOString(),
    cleaningStarted: true,
    cleaningStartedAt: new Date(now.getTime() - 6.8 * 60 * 60 * 1000).toISOString(),
    photoUploaded: true,
    photoUploadedAt: new Date(now.getTime() - 6.5 * 60 * 60 * 1000).toISOString(),
    photoExpiresAt: case3PhotoExpiry,
    photoPurged: false,
    approvedAt: case3Approved,
    approverLabel: 'Coordinator (Simulated)',
    events: case3Events,
  };

  return [case1, case2, case3];
}

export function getInitialLocalDemoCases(): HospitalCase[] {
  return getInitialSyntheticCases().map((caseData) => ({
    ...caseData,
    status: caseData.photoUploaded ? 'CLEANING_IN_PROGRESS' : caseData.status,
    photoUploaded: false,
    photoUploadedAt: undefined,
    photoExpiresAt: undefined,
    photoPurged: false,
    photoPurgedAt: undefined,
    approvedAt: undefined,
    approverLabel: undefined,
    events: caseData.events.filter((event) =>
      !['PHOTO_UPLOADED', 'APPROVAL_NOTICE', 'PHOTO_PURGED', 'PHOTO_EXPIRED'].includes(event.type)
    ),
  }));
}

/**
 * Generate a synthetic demo hospital room photo blob (pure SVG drawing rendered onto a Blob)
 * so initial demo cases and sample uploads have a realistic, clean, synthetic bed image
 * with zero real human imagery or identifiable medical information.
 */
export function generateSyntheticBedPhotoBlob(caseRef: string, bedLabel: string): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#f1f5f9" />
        <stop offset="100%" stop-color="#e2e8f0" />
      </linearGradient>
      <linearGradient id="wallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#f8fafc" />
        <stop offset="100%" stop-color="#cbd5e1" />
      </linearGradient>
      <linearGradient id="linenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#f8fafc" />
      </linearGradient>
      <linearGradient id="mattressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f766e" />
        <stop offset="100%" stop-color="#115e59" />
      </linearGradient>
    </defs>
    <!-- Room Background -->
    <rect width="800" height="600" fill="url(#bgGrad)" />
    <!-- Wall & Floor Divider -->
    <rect x="0" y="0" width="800" height="340" fill="url(#wallGrad)" />
    <line x1="0" y1="340" x2="800" y2="340" stroke="#94a3b8" stroke-width="3" />
    <rect x="0" y="340" width="800" height="260" fill="#e2e8f0" />
    
    <!-- Floor tiles perspective -->
    <line x1="120" y1="340" x2="40" y2="600" stroke="#cbd5e1" stroke-width="1.5" />
    <line x1="300" y1="340" x2="240" y2="600" stroke="#cbd5e1" stroke-width="1.5" />
    <line x1="500" y1="340" x2="560" y2="600" stroke="#cbd5e1" stroke-width="1.5" />
    <line x1="680" y1="340" x2="760" y2="600" stroke="#cbd5e1" stroke-width="1.5" />

    <!-- Wall Handrail / Fixtures -->
    <rect x="60" y="240" width="680" height="12" rx="6" fill="#94a3b8" />
    <!-- Oxygen / Medical Gas Outlets on wall (Standard simulated fixtures) -->
    <rect x="180" y="160" width="120" height="50" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
    <circle cx="210" cy="185" r="10" fill="#0d9488" />
    <circle cx="240" cy="185" r="10" fill="#e2e8f0" stroke="#64748b" />
    <circle cx="270" cy="185" r="10" fill="#f59e0b" />

    <!-- Hospital Bed Frame -->
    <!-- Headboard -->
    <rect x="220" y="220" width="360" height="100" rx="10" fill="#64748b" />
    <rect x="230" y="230" width="340" height="80" rx="6" fill="#94a3b8" />

    <!-- Mattress base -->
    <polygon points="180,390 620,390 660,430 140,430" fill="#334155" />
    <rect x="150" y="420" width="500" height="35" rx="8" fill="url(#mattressGrad)" />

    <!-- Bed Linen / Duvet (Pristine clean white hospital corners) -->
    <rect x="160" y="340" width="480" height="110" rx="12" fill="url(#linenGrad)" stroke="#cbd5e1" stroke-width="2" />
    <path d="M 160 380 Q 400 395 640 380 L 640 450 L 160 450 Z" fill="#ffffff" />

    <!-- Pillows (Clean & Sanitised) -->
    <rect x="260" y="300" width="130" height="65" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
    <rect x="410" y="300" width="130" height="65" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />

    <!-- Side Rails (Raised / Sanitised) -->
    <rect x="150" y="330" width="120" height="18" rx="6" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2" />
    <line x1="170" y1="348" x2="170" y2="400" stroke="#94a3b8" stroke-width="3" />
    <line x1="210" y1="348" x2="210" y2="400" stroke="#94a3b8" stroke-width="3" />
    <line x1="250" y1="348" x2="250" y2="400" stroke="#94a3b8" stroke-width="3" />

    <rect x="530" y="330" width="120" height="18" rx="6" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2" />
    <line x1="550" y1="348" x2="550" y2="400" stroke="#94a3b8" stroke-width="3" />
    <line x1="590" y1="348" x2="590" y2="400" stroke="#94a3b8" stroke-width="3" />
    <line x1="630" y1="348" x2="630" y2="400" stroke="#94a3b8" stroke-width="3" />

    <!-- Bed Legs & Castors -->
    <rect x="180" y="455" width="22" height="65" fill="#475569" />
    <circle cx="191" cy="525" r="14" fill="#1e293b" />
    <rect x="598" y="455" width="22" height="65" fill="#475569" />
    <circle cx="609" cy="525" r="14" fill="#1e293b" />

    <!-- Overbed Table (Sanitised & Cleared) -->
    <rect x="650" y="350" width="90" height="12" rx="4" fill="#0f766e" />
    <rect x="710" y="362" width="12" height="140" fill="#94a3b8" />
    <rect x="670" y="495" width="80" height="12" rx="4" fill="#64748b" />
    <circle cx="680" cy="512" r="7" fill="#334155" />
    <circle cx="740" cy="512" r="7" fill="#334155" />

    <!-- Synthetic Operational Watermark / Badge -->
    <rect x="25" y="25" width="310" height="64" rx="8" fill="#0f172a" fill-opacity="0.88" />
    <text x="40" y="50" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#38bdf8">
      HOSPITALFLOW SYNTHETIC PHOTO
    </text>
    <text x="40" y="72" font-family="system-ui, sans-serif" font-size="13" fill="#ffffff">
      Ref: ${caseRef} | ${bedLabel} [Sanitised]
    </text>

    <!-- Synthetic data boundary label -->
    <rect x="530" y="25" width="245" height="40" rx="6" fill="#14532d" fill-opacity="0.9" />
    <text x="545" y="50" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#bbf7d0">
      SYNTHETIC SCENE • NO REAL PATIENT DATA
    </text>
  </svg>`;

  return new Blob([svg], { type: 'image/svg+xml' });
}
