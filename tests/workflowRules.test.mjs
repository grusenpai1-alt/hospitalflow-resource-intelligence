import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acknowledgeOnce,
  adjustStock,
  calculateEquipmentUtilization,
  calculateCapacity,
  canAllocate,
  canApproveBedPhoto,
  canRejectBedPhoto,
  canTransitionAmbulance,
  canTransitionIsolation,
  canTransitionTrauma,
  checkMaintenanceWindow,
  checkLabSlot,
  classifyStock,
  findEquipmentConflict,
  isPhotoExpired,
  validateStaffCount,
} from '../src/services/workflowRules.ts';
import { getScenarioRoute } from '../src/services/scenarioRouting.ts';
import { getInitialLocalDemoCases } from '../src/services/storage.ts';
import {
  getLocalWorkflowStorageKey,
  readLocalWorkflow,
  writeLocalWorkflow,
} from '../src/services/localWorkflowStorage.ts';
import {
  canAccessScenarioRoute,
  canManageBedWorkflows,
  canWriteWorkflowAsRole,
} from '../src/services/workflowAccess.ts';

test('lab reservations detect an occupied instrument slot and return the next open slot', () => {
  const reservations = [
    { id: 'one', instrumentId: 'ct-1', date: '2026-10-24', time: '09:30', department: 'Imaging' },
    { id: 'two', instrumentId: 'ct-1', date: '2026-10-24', time: '10:30', department: 'Emergency' },
  ];
  assert.deepEqual(
    checkLabSlot(reservations, {
      instrumentId: 'ct-1',
      date: '2026-10-24',
      time: '09:30',
      department: 'Outpatient',
    }, ['09:30', '10:30', '11:30']),
    { conflict: true, nextAvailable: '11:30' },
  );
  assert.equal(checkLabSlot(reservations, {
    instrumentId: 'mri-1',
    date: '2026-10-24',
    time: '09:30',
    department: 'Outpatient',
  }, ['09:30']).conflict, false);
});

test('equipment booking rejects overlaps and active maintenance windows', () => {
  const candidate = {
    equipmentId: 'ultrasound',
    date: '2026-10-24',
    time: '10:30',
    hours: 1,
    department: 'Imaging',
  };
  const booking = {
    id: 'booking-1',
    ...candidate,
    time: '10:00',
    hours: 2,
  };
  assert.equal(findEquipmentConflict([booking], [], candidate).kind, 'booking');
  assert.equal(findEquipmentConflict([], [{
    id: 'outage-1',
    equipmentId: 'ultrasound',
    date: '2026-10-24',
    startTime: '10:00',
    endTime: '12:00',
    reason: 'Scheduled service',
  }], candidate).kind, 'outage');
  assert.equal(findEquipmentConflict([], [{
    id: 'outage-1',
    equipmentId: 'ultrasound',
    date: '2026-10-24',
    startTime: '10:00',
    endTime: '12:00',
    reason: 'Scheduled service',
    restoredAt: '2026-10-24T09:00:00.000Z',
  }], candidate).kind, 'none');
  assert.equal(findEquipmentConflict([], [], { ...candidate, time: '23:30' }).kind, 'invalid');
  assert.equal(checkMaintenanceWindow([], [], {
    equipmentId: 'ultrasound',
    date: '2026-10-24',
    startTime: '09:00',
    endTime: '11:00',
    reason: 'Service',
  }).kind, 'none');
  assert.equal(checkMaintenanceWindow([booking], [], {
    equipmentId: 'ultrasound',
    date: '2026-10-24',
    startTime: '09:00',
    endTime: '11:00',
    reason: 'Service',
  }).kind, 'booking');
  assert.deepEqual(calculateEquipmentUtilization([booking], [], 'ultrasound', '2026-10-24'), {
    availableHours: 8,
    bookedHours: 2,
    percent: 25,
  });
});

test('camp capacity warns at 80 percent and blocks invalid or over-capacity allocations', () => {
  assert.deepEqual(calculateCapacity([{ units: 96 }], 120), {
    allocated: 96,
    remaining: 24,
    percent: 80,
    warning: true,
  });
  assert.equal(canAllocate(24, 24), true);
  assert.equal(canAllocate(25, 24), false);
  assert.equal(canAllocate(1.5, 24), false);
});

test('stock adjustments require a reason and cannot produce negative stock', () => {
  assert.equal(adjustStock(2, -3, 'Correction').ok, false);
  assert.equal(adjustStock(2, -1, 'Count correction').quantity, 1);
  assert.equal(adjustStock(-1, 1, 'Invalid seed').ok, false);
  assert.equal(adjustStock(2, 1, '  ').ok, false);
  assert.equal(adjustStock(2, 0, 'No change').ok, false);
  assert.equal(classifyStock(3, 8), 'critical');
  assert.equal(classifyStock(7, 8), 'low');
  assert.equal(classifyStock(8, 8), 'in-stock');
});

test('bed photo approval and rejection require the pending review state and uploaded photo', () => {
  assert.equal(canApproveBedPhoto('AWAITING_REVIEW', true), true);
  assert.equal(canApproveBedPhoto('BED_READY', true), false);
  assert.equal(canApproveBedPhoto('AWAITING_REVIEW', false), false);
  assert.equal(canRejectBedPhoto('AWAITING_REVIEW', true, 'Linen issue'), true);
  assert.equal(canRejectBedPhoto('AWAITING_REVIEW', true, '  '), false);
  assert.equal(canRejectBedPhoto('BED_READY', true, 'Linen issue'), false);
});

test('approved photos expire at the configured deadline using a controllable clock', () => {
  const approvedAt = Date.parse('2026-10-24T10:00:00.000Z');
  const expiresAt = new Date(approvedAt + 48 * 60 * 60 * 1000).toISOString();
  assert.equal(isPhotoExpired(expiresAt, approvedAt + 48 * 60 * 60 * 1000 - 1), false);
  assert.equal(isPhotoExpired(expiresAt, approvedAt + 48 * 60 * 60 * 1000), true);
  assert.equal(isPhotoExpired(undefined, approvedAt + 49 * 60 * 60 * 1000), false);
  assert.equal(isPhotoExpired('invalid-date', approvedAt + 49 * 60 * 60 * 1000), false);
});

test('trauma transitions require a reason for unavailability and reject invalid transitions', () => {
  assert.equal(canTransitionTrauma('Available', 'Unavailable'), false);
  assert.equal(canTransitionTrauma('Available', 'Unavailable', 'Equipment check'), true);
  assert.equal(canTransitionTrauma('In use', 'Available'), false);
  assert.equal(canTransitionTrauma('Cleaning', 'Available'), true);
});

test('staff count is bounded by the planned requirement', () => {
  assert.equal(validateStaffCount(4, 5), true);
  assert.equal(validateStaffCount(6, 5), false);
  assert.equal(validateStaffCount(-1, 5), false);
  assert.equal(validateStaffCount(2.5, 5), false);
});

test('alert acknowledgement is idempotent', () => {
  const alert = { id: 'alert-1', acknowledged: false };
  const acknowledged = acknowledgeOnce(alert, '2026-10-24T10:00:00.000Z');
  assert.equal(acknowledged.acknowledged, true);
  assert.equal(acknowledged.acknowledgedAt, '2026-10-24T10:00:00.000Z');
  assert.equal(acknowledgeOnce(acknowledged, '2026-10-24T11:00:00.000Z'), acknowledged);
});

test('ambulance and isolation status progressions reject invalid transitions', () => {
  assert.equal(canTransitionAmbulance('Inbound', 'Arrived'), true);
  assert.equal(canTransitionAmbulance('Arrived', 'Handover complete'), true);
  assert.equal(canTransitionAmbulance('Handover complete', 'Inbound'), false);
  assert.equal(canTransitionIsolation('Available', 'Occupied'), true);
  assert.equal(canTransitionIsolation('Occupied', 'Cleaning'), true);
  assert.equal(canTransitionIsolation('Cleaning', 'Available'), true);
  assert.equal(canTransitionIsolation('Available', 'Cleaning'), false);
});

test('scenario routing recognizes workflow paths and rejects unknown or nested routes', () => {
  assert.equal(getScenarioRoute('/'), 'home');
  assert.equal(getScenarioRoute('/blood-bank'), 'blood-bank');
  assert.equal(getScenarioRoute('/infection-control'), 'infection-control');
  assert.equal(getScenarioRoute('/not-a-workflow'), 'not-found');
  assert.equal(getScenarioRoute('/labs/nested'), 'not-found');
});

test('workflow write access is restricted by facility role', () => {
  assert.equal(canWriteWorkflowAsRole('bed-turnaround-cases-v1', 'coordinator'), true);
  assert.equal(canWriteWorkflowAsRole('bed-turnaround-cases-v1', 'nurse'), false);
  assert.equal(canWriteWorkflowAsRole('bed-occupancy-board-v1', 'housekeeping'), false);
  assert.equal(canManageBedWorkflows('coordinator'), true);
  assert.equal(canManageBedWorkflows('housekeeping'), false);
  assert.equal(canWriteWorkflowAsRole('hospital-flow-pharmacy-v1', 'pharmacy'), true);
  assert.equal(canWriteWorkflowAsRole('hospital-flow-pharmacy-v1', 'nurse'), false);
  assert.equal(canWriteWorkflowAsRole('hospital-flow-pharmacy-v1', 'viewer'), false);
  assert.equal(canAccessScenarioRoute('pharmacy', 'pharmacy'), true);
  assert.equal(canAccessScenarioRoute('pharmacy', 'nurse'), false);
  assert.equal(canAccessScenarioRoute('home', 'viewer'), true);
});

test('local demo data never claims photo evidence that requires Firebase Storage', () => {
  const cases = getInitialLocalDemoCases();
  assert.ok(cases.length > 0);
  for (const item of cases) {
    assert.equal(item.photoUploaded, false);
    assert.equal(item.photoPurged, false);
    assert.equal(item.photoExpiresAt, undefined);
    assert.ok(!['AWAITING_REVIEW', 'BED_READY'].includes(item.status));
    assert.ok(item.events.every((event) =>
      !['PHOTO_UPLOADED', 'APPROVAL_NOTICE', 'PHOTO_PURGED', 'PHOTO_EXPIRED'].includes(event.type)
    ));
  }
});

test('local workflow storage persists versioned structured data without Firebase', () => {
  const values = new Map();
  const listeners = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    },
    dispatchEvent: (event) => {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
    addEventListener: (type, listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener: () => {},
  };

  const key = getLocalWorkflowStorageKey('hospital-flow-example-v1');
  assert.match(key, /^hospitalflow:browser-demo:v1:/);
  assert.equal(readLocalWorkflow('hospital-flow-example-v1'), null);
  const workflow = [{ id: 'sample', status: 'ready' }];
  writeLocalWorkflow('hospital-flow-example-v1', workflow);
  assert.deepEqual(readLocalWorkflow('hospital-flow-example-v1'), workflow);
});
