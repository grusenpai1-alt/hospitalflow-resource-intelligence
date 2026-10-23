export type LabReservation = {
  id: string;
  instrumentId?: string;
  test?: string;
  date: string;
  time: string;
  department: string;
};

export type EquipmentBooking = {
  id: string;
  equipmentId: string;
  date: string;
  time: string;
  hours: number;
  department: string;
};

export type MaintenanceWindow = {
  id: string;
  equipmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  restoredAt?: string;
};

export type CapacityResult = {
  allocated: number;
  remaining: number;
  percent: number;
  warning: boolean;
};

function timeInMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function checkLabSlot(
  reservations: readonly LabReservation[],
  candidate: Omit<LabReservation, 'id'>,
  slots: readonly string[],
) {
  const instrumentId = candidate.instrumentId ?? 'default';
  const conflict = reservations.some((reservation) =>
    (reservation.instrumentId ?? 'default') === instrumentId &&
    reservation.date === candidate.date &&
    reservation.time === candidate.time,
  );
  const nextAvailable = slots.find((slot) =>
    (!conflict || slot !== candidate.time) &&
    !reservations.some((reservation) =>
      (reservation.instrumentId ?? 'default') === instrumentId &&
      reservation.date === candidate.date &&
      reservation.time === slot,
    ),
  );
  return { conflict, nextAvailable };
}

export function findEquipmentConflict(
  bookings: readonly EquipmentBooking[],
  outages: readonly MaintenanceWindow[],
  candidate: Omit<EquipmentBooking, 'id'>,
) {
  const start = timeInMinutes(candidate.time);
  const duration = candidate.hours * 60;
  if (start === null || !Number.isInteger(candidate.hours) || candidate.hours < 1 || start + duration > 1440) {
    return { kind: 'invalid' as const };
  }

  const booking = bookings.find((item) => {
    if (item.equipmentId !== candidate.equipmentId || item.date !== candidate.date) return false;
    const existingStart = timeInMinutes(item.time);
    if (existingStart === null || !Number.isFinite(item.hours) || item.hours <= 0) return false;
    return start < existingStart + item.hours * 60 && existingStart < start + duration;
  });
  if (booking) return { kind: 'booking' as const, booking };

  const outage = outages.find((item) => {
    if (item.equipmentId !== candidate.equipmentId || item.date !== candidate.date || item.restoredAt) return false;
    const outageStart = timeInMinutes(item.startTime);
    const outageEnd = timeInMinutes(item.endTime);
    return outageStart !== null && outageEnd !== null &&
      start < outageEnd && outageStart < start + duration;
  });
  return outage ? { kind: 'outage' as const, outage } : { kind: 'none' as const };
}

export function checkMaintenanceWindow(
  bookings: readonly EquipmentBooking[],
  outages: readonly MaintenanceWindow[],
  candidate: Omit<MaintenanceWindow, 'id'>,
) {
  const start = timeInMinutes(candidate.startTime);
  const end = timeInMinutes(candidate.endTime);
  if (start === null || end === null || start >= end || !candidate.reason.trim()) {
    return { kind: 'invalid' as const };
  }

  const booking = bookings.find((item) => {
    if (item.equipmentId !== candidate.equipmentId || item.date !== candidate.date) return false;
    const bookingStart = timeInMinutes(item.time);
    if (bookingStart === null || !Number.isFinite(item.hours) || item.hours <= 0) return false;
    return bookingStart < end && start < bookingStart + item.hours * 60;
  });
  if (booking) return { kind: 'booking' as const, booking };

  const outage = outages.find((item) => {
    if (item.equipmentId !== candidate.equipmentId || item.date !== candidate.date || item.restoredAt) return false;
    const outageStart = timeInMinutes(item.startTime);
    const outageEnd = timeInMinutes(item.endTime);
    return outageStart !== null && outageEnd !== null && start < outageEnd && outageStart < end;
  });
  return outage ? { kind: 'outage' as const, outage } : { kind: 'none' as const };
}

export function calculateEquipmentUtilization(
  bookings: readonly EquipmentBooking[],
  outages: readonly MaintenanceWindow[],
  equipmentId: string,
  date: string,
) {
  const shiftStart = 8 * 60;
  const shiftEnd = 16 * 60;
  const outageMinutes = outages.reduce((total, outage) => {
    if (outage.equipmentId !== equipmentId || outage.date !== date || outage.restoredAt) return total;
    const start = timeInMinutes(outage.startTime);
    const end = timeInMinutes(outage.endTime);
    if (start === null || end === null) return total;
    return total + Math.max(0, Math.min(shiftEnd, end) - Math.max(shiftStart, start));
  }, 0);
  const availableHours = Math.max(0, 8 - Math.min(8, outageMinutes / 60));
  const bookedHours = bookings.reduce((total, booking) => {
    if (booking.equipmentId !== equipmentId || booking.date !== date) return total;
    const start = timeInMinutes(booking.time);
    if (start === null || !Number.isFinite(booking.hours) || booking.hours <= 0) return total;
    return total + Math.max(0, Math.min(shiftEnd, start + booking.hours * 60) - Math.max(shiftStart, start)) / 60;
  }, 0);
  return {
    availableHours,
    bookedHours,
    percent: availableHours === 0 ? 0 : Math.min(100, Math.round((bookedHours / availableHours) * 100)),
  };
}

export function calculateCapacity(
  allocations: readonly { units: number }[],
  capacity: number,
  warningThreshold = 0.8,
): CapacityResult {
  const allocated = allocations.reduce((total, item) => total + item.units, 0);
  const remaining = Math.max(0, capacity - allocated);
  const percent = capacity > 0 ? Math.round((allocated / capacity) * 100) : 0;
  return { allocated, remaining, percent, warning: allocated >= capacity * warningThreshold && allocated < capacity };
}

export function canAllocate(units: number, remaining: number) {
  return Number.isInteger(units) && units > 0 && units <= remaining;
}

export function adjustStock(quantity: number, delta: number, reason: string) {
  if (!Number.isInteger(quantity) || quantity < 0) return { ok: false as const, error: 'Current stock must be a non-negative whole number.' };
  if (!Number.isInteger(delta) || delta === 0) return { ok: false as const, error: 'Enter a non-zero whole-number adjustment.' };
  if (!reason.trim()) return { ok: false as const, error: 'Enter a reason for the stock adjustment.' };
  if (quantity + delta < 0) return { ok: false as const, error: 'Adjustment blocked because stock cannot be negative.' };
  return { ok: true as const, quantity: quantity + delta };
}

export function classifyStock(quantity: number, parLevel: number) {
  if (quantity <= Math.floor(parLevel / 2)) return 'critical' as const;
  if (quantity < parLevel) return 'low' as const;
  return 'in-stock' as const;
}

export function canApproveBedPhoto(status: string, photoUploaded: boolean) {
  return status === 'AWAITING_REVIEW' && photoUploaded;
}

export function canRejectBedPhoto(status: string, photoUploaded: boolean, reason: string) {
  return status === 'AWAITING_REVIEW' && photoUploaded && Boolean(reason.trim());
}

export type TraumaStatus = 'Available' | 'In use' | 'Cleaning' | 'Unavailable';

const traumaTransitions: Record<TraumaStatus, readonly TraumaStatus[]> = {
  Available: ['In use', 'Unavailable'],
  'In use': ['Cleaning', 'Unavailable'],
  Cleaning: ['Available', 'Unavailable'],
  Unavailable: ['Available'],
};

export function canTransitionTrauma(status: TraumaStatus, next: TraumaStatus, reason = '') {
  if (!traumaTransitions[status].includes(next)) return false;
  return next !== 'Unavailable' || Boolean(reason.trim());
}

export function validateStaffCount(staffed: number, required: number) {
  return Number.isInteger(staffed) && staffed >= 0 && staffed <= required;
}

export function acknowledgeOnce<T extends { acknowledged: boolean }>(alert: T, acknowledgedAt: string) {
  if (alert.acknowledged) return alert;
  return { ...alert, acknowledged: true, acknowledgedAt };
}

export function isPhotoExpired(expiresAt: string | undefined, now = Date.now()) {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry <= now;
}

export type AmbulanceStatus = 'Inbound' | 'Arrived' | 'Handover complete';

const ambulanceTransitions: Record<AmbulanceStatus, readonly AmbulanceStatus[]> = {
  Inbound: ['Arrived'],
  Arrived: ['Handover complete'],
  'Handover complete': [],
};

export function canTransitionAmbulance(status: AmbulanceStatus, next: AmbulanceStatus) {
  return ambulanceTransitions[status].includes(next);
}

export type IsolationStatus = 'Available' | 'Occupied' | 'Cleaning';

const isolationTransitions: Record<IsolationStatus, readonly IsolationStatus[]> = {
  Available: ['Occupied'],
  Occupied: ['Cleaning'],
  Cleaning: ['Available'],
};

export function canTransitionIsolation(status: IsolationStatus, next: IsolationStatus) {
  return isolationTransitions[status].includes(next);
}
