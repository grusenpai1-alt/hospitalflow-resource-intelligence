import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useFacilityData, useFacilityWorkflowSnapshot } from '../context/FacilityDataContext';
import {
  calculateCapacity,
  calculateEquipmentUtilization,
  canAllocate,
  checkLabSlot,
  checkMaintenanceWindow,
  findEquipmentConflict,
  type EquipmentBooking,
  type LabReservation,
  type MaintenanceWindow,
} from '../services/workflowRules';
import DotGrid from './DotGrid';
import {
  AlertTriangle,
  Biohazard,
  ArrowRight,
  BellRing,
  Bed,
  Boxes,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Droplets,
  HeartPulse,
  FlaskConical,
  Hospital,
  Layers3,
  PackageCheck,
  Plus,
  ShieldCheck,
  Stethoscope,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import {
  AlertsWorkspace,
  AmbulanceWorkspace,
  BloodBankWorkspace,
  CliniciansWorkspace,
  InfectionControlWorkspace,
  PharmacyWorkspace,
  StaffWorkspace,
  TraumaWorkspace,
} from './EmergencyWorkspaces';
import { OccupancyWorkspace } from './OccupancyWorkspace';
import type { ScenarioRoute } from '../services/scenarioRouting';
import './ScenarioWorkspace.css';

const routePaths: Record<ScenarioRoute, string> = {
  home: '/',
  'not-found': '/not-found',
  labs: '/labs',
  equipment: '/equipment',
  beds: '/beds',
  occupancy: '/occupancy',
  camps: '/camps',
  pharmacy: '/pharmacy',
  trauma: '/trauma',
  clinicians: '/clinicians',
  staff: '/staff',
  alerts: '/alerts',
  'blood-bank': '/blood-bank',
  ambulance: '/ambulance',
  'infection-control': '/infection-control',
};

const scenarios = [
  { id: 'labs', title: 'Lab availability', detail: 'Reserve diagnostic slots and resolve schedule conflicts.', icon: FlaskConical, tone: 'mint', path: routePaths.labs },
  { id: 'equipment', title: 'Equipment booking', detail: 'Book shared equipment and see maintenance outages.', icon: Wrench, tone: 'blue', path: routePaths.equipment },
  { id: 'beds', title: 'Clinic beds', detail: 'Coordinate housekeeping, review, and room readiness.', icon: Bed, tone: 'coral', path: routePaths.beds },
  { id: 'occupancy', title: 'Bed occupancy', detail: 'Track ward capacity, crew assignments, and bed readiness.', icon: Bed, tone: 'mint', path: '/occupancy' },
  { id: 'camps', title: 'Health camp', detail: 'Allocate resource units against camp capacity.', icon: Stethoscope, tone: 'gold', path: routePaths.camps },
  { id: 'pharmacy', title: 'Emergency pharmacy', detail: 'Monitor critical medicines, tools, and low-stock supplies.', icon: Boxes, tone: 'coral', path: routePaths.pharmacy },
  { id: 'trauma', title: 'Emergency & trauma', detail: 'See room readiness and available trauma bays at a glance.', icon: HeartPulse, tone: 'mint', path: routePaths.trauma },
  { id: 'clinicians', title: 'Doctor schedule', detail: 'Review on-duty clinicians and upcoming coverage.', icon: CalendarClock, tone: 'blue', path: routePaths.clinicians },
  { id: 'staff', title: 'Staff availability', detail: 'Check shift coverage across hospital departments.', icon: Users, tone: 'gold', path: routePaths.staff },
  { id: 'alerts', title: 'General alerts', detail: 'Review and acknowledge cross-team operational issues.', icon: BellRing, tone: 'coral', path: routePaths.alerts },
  { id: 'blood-bank', title: 'Blood bank', detail: 'Review blood group and product availability for coordination.', icon: Droplets, tone: 'coral', path: routePaths['blood-bank'] },
  { id: 'ambulance', title: 'Ambulance arrivals', detail: 'Coordinate incoming emergency vehicles and handover readiness.', icon: Truck, tone: 'blue', path: routePaths.ambulance },
  { id: 'infection-control', title: 'Isolation & infection control', detail: 'Check isolation room availability and cleaning status.', icon: Biohazard, tone: 'mint', path: routePaths['infection-control'] },
] as const;

const navigationItems = [
  { id: 'home', title: 'All workflows', icon: Layers3, path: routePaths.home },
  { id: 'labs', title: 'Labs', icon: FlaskConical, path: routePaths.labs },
  { id: 'equipment', title: 'Equipment', icon: Wrench, path: routePaths.equipment },
  { id: 'beds', title: 'Clinic beds', icon: Bed, path: routePaths.beds },
  { id: 'occupancy', title: 'Occupancy', icon: Bed, path: '/occupancy' },
  { id: 'camps', title: 'Health camps', icon: Stethoscope, path: routePaths.camps },
  { id: 'pharmacy', title: 'Pharmacy', icon: Boxes, path: routePaths.pharmacy },
  { id: 'trauma', title: 'Trauma', icon: HeartPulse, path: routePaths.trauma },
  { id: 'clinicians', title: 'Doctors', icon: CalendarClock, path: routePaths.clinicians },
  { id: 'staff', title: 'Staff', icon: Users, path: routePaths.staff },
  { id: 'alerts', title: 'Alerts', icon: BellRing, path: routePaths.alerts },
  { id: 'blood-bank', title: 'Blood bank', icon: Droplets, path: routePaths['blood-bank'] },
  { id: 'ambulance', title: 'Ambulances', icon: Truck, path: routePaths.ambulance },
  { id: 'infection-control', title: 'Isolation', icon: Biohazard, path: routePaths['infection-control'] },
] as const;

export function ScenarioNavigation({ currentRoute }: { currentRoute: ScenarioRoute }) {
  return (
    <nav className="scenario-nav" aria-label="Hospital workflows">
      <div className="scenario-nav-inner">
        {navigationItems.map(({ id, title, icon: Icon, path }) => (
          <a
            key={id}
            className={`scenario-nav-link${currentRoute === id ? ' is-active' : ''}`}
            href={path}
            aria-current={currentRoute === id ? 'page' : undefined}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{title}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

type CampAllocation = {
  id: string;
  resource: string;
  units: number;
  department: string;
};

function todayDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function localTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function usePersistentState<T>(key: string, initialValue: () => T) {
  return useFacilityData(key, initialValue);
}

function PageHeading({ eyebrow, title, description, icon: Icon }: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="scenario-heading">
      <div className="scenario-heading-icon"><Icon size={22} aria-hidden="true" /></div>
      <div>
        <p className="scenario-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="scenario-description">{description}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, note, tone = 'neutral' }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className={`scenario-metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="scenario-empty">{children}</p>;
}

function ScenarioHome() {
  const [dateLabel] = useState(() => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
  const cases = useFacilityWorkflowSnapshot<Array<{ status?: string }>>('bed-turnaround-cases-v1');
  const occupancy = useFacilityWorkflowSnapshot<{ beds?: Array<{ status?: string }> }>('bed-occupancy-board-v1');
  const pharmacy = useFacilityWorkflowSnapshot<unknown>('hospital-flow-pharmacy-v1');
  const alerts = useFacilityWorkflowSnapshot<Array<{ acknowledged?: boolean }>>('hospital-flow-alerts-v1');
  const ambulance = useFacilityWorkflowSnapshot<Array<{ status?: string }>>('hospital-flow-ambulance-arrivals-v1');

  const pharmacyItems = Array.isArray(pharmacy.value)
    ? pharmacy.value
    : pharmacy.value && typeof pharmacy.value === 'object' && 'items' in pharmacy.value && Array.isArray(pharmacy.value.items)
      ? pharmacy.value.items
      : null;
  const bedsToReview = (cases.value?.filter((item) => item.status === 'AWAITING_REVIEW').length ?? 0) +
    (occupancy.value?.beds?.filter((bed) => bed.status === 'Awaiting approval').length ?? 0);
  const lowStock = pharmacyItems?.filter((item) =>
    item && typeof item === 'object' && 'quantity' in item && 'parLevel' in item &&
    typeof item.quantity === 'number' && typeof item.parLevel === 'number' && item.quantity < item.parLevel,
  ).length;
  const needsAttention = alerts.value?.filter((alert) => !alert.acknowledged).length;
  const inbound = ambulance.value?.filter((arrival) => arrival.status === 'Inbound').length;
  const summariesReady = !cases.loading && !occupancy.loading && !pharmacy.loading && !alerts.loading && !ambulance.loading;
  const formatSummary = (value: number | undefined) => !summariesReady ? '…' : value === undefined ? 'Open workflow' : String(value);

  return (
    <section className="scenario-home">
      <div className="home-intro">
        <DotGrid
          className="home-intro-dots"
          baseColor="#72948b"
          activeColor="#0f766e"
          dotSize={3}
          gap={20}
          proximity={120}
          strength={0.22}
          bounce={0.35}
          tension={0.2}
          shockRadius={190}
          shockStrength={1}
          swell={0.3}
          stretch={0.15}
          glow={0.1}
          fade={0.55}
          opacity={0.32}
          clickShock={false}
        />
        <div>
          <p className="scenario-eyebrow">OPERATIONS DESK <span>•</span> TODAY</p>
          <h2>Where do you need to coordinate?</h2>
          <p>Choose a workflow to check availability, make a reservation, or allocate resources.</p>
        </div>
        <div className="home-date"><CalendarClock size={17} /> {dateLabel}</div>
      </div>
      <div className="scenario-metrics" aria-label="Live workflow summary">
        <Metric label="Beds awaiting review" value={formatSummary(bedsToReview)} note="Clinic beds and occupancy" tone="gold" />
        <Metric label="Low-stock items" value={formatSummary(lowStock)} note="Emergency pharmacy" tone="coral" />
        <Metric label="Unacknowledged alerts" value={formatSummary(needsAttention)} note="Operational alerts" tone="blue" />
        <Metric label="Inbound ambulances" value={formatSummary(inbound)} note="Synthetic arrivals" tone="mint" />
      </div>
      <div className="scenario-card-grid">
        {scenarios.map(({ id, title, detail, icon: Icon, tone, path }) => (
          <a className="scenario-card" href={path} key={id}>
            <span className={`scenario-card-icon tone-${tone}`}><Icon size={21} aria-hidden="true" /></span>
            <span className="scenario-card-copy">
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
            <ChevronRight size={19} className="scenario-card-arrow" aria-hidden="true" />
          </a>
        ))}
      </div>
      <div className="home-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Operational coordination only. Use synthetic information; do not enter patient-identifying data.</span>
      </div>
    </section>
  );
}

const labTimes = ['08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const labTests = ['Complete blood count', 'Basic metabolic panel', 'Liver function panel', 'Thyroid profile', 'X-ray', 'CT scan', 'MRI scan', 'Ultrasound scan'];
const labInstruments = [
  { id: 'analyzer-1', name: 'Hematology analyzer 01' },
  { id: 'analyzer-2', name: 'Biochemistry analyzer 01' },
  { id: 'xray-1', name: 'X-ray room 01' },
  { id: 'ct-1', name: 'CT scanner 01' },
  { id: 'mri-1', name: 'MRI scanner 01' },
  { id: 'ultrasound-1', name: 'Ultrasound room 01' },
];

function LabWorkspace() {
  const [reservations, , mutateReservations] = usePersistentState<LabReservation[]>('hospital-flow-lab-reservations-v1', () => [
    { id: 'lab-seed-1', instrumentId: 'analyzer-1', test: 'Complete blood count', date: todayDate(), time: '09:30', department: 'Outpatient clinic' },
    { id: 'lab-seed-2', instrumentId: 'analyzer-2', test: 'Basic metabolic panel', date: todayDate(), time: '11:30', department: 'Emergency department' },
  ]);
  const [test, setTest] = useState(labTests[0]);
  const [instrumentId, setInstrumentId] = useState(labInstruments[0].id);
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState(() => labTimes.find((slot) => slot > localTime() && slot !== '09:30' && slot !== '11:30') ?? labTimes[0]);
  const [department, setDepartment] = useState('Outpatient clinic');
  const [conflict, setConflict] = useState('');
  const [notice, setNotice] = useState('');
  const availableTimes = labTimes.filter((slot) => (date !== todayDate() || slot > localTime()) && !reservations.some((reservation) => (reservation.instrumentId ?? 'analyzer-1') === instrumentId && reservation.date === date && reservation.time === slot));
  const nextTime = availableTimes[0];

  async function reserveSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!department.trim() || date < todayDate() || (date === todayDate() && time <= localTime())) {
      setConflict('Choose a future slot and enter a requesting department.');
      return;
    }
    const reservation: LabReservation = {
      id: `lab-${Date.now()}`,
      instrumentId,
      test,
      date,
      time,
      department: department.trim(),
    };
    try {
      const result = await mutateReservations((current) => {
        const availability = checkLabSlot(current, reservation, labTimes.filter((slot) => date !== todayDate() || slot > localTime()));
        if (availability.conflict) return { next: current, result: availability, write: false };
        return { next: [reservation, ...current], result: availability };
      });
      if (result.conflict) {
        setConflict(`${time} on ${labInstruments.find((instrument) => instrument.id === instrumentId)?.name} was just reserved. ${result.nextAvailable ? `Next open slot: ${result.nextAvailable}.` : 'No slots remain on this date.'}`);
        setNotice('');
        return;
      }
      setConflict('');
      setNotice(`${labInstruments.find((instrument) => instrument.id === instrumentId)?.name} reserved for ${date} at ${time}.`);
    } catch (error) {
      setConflict(`Reservation could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
      setNotice('');
    }
  }

  function useNextSlot() {
    if (nextTime) {
      setTime(nextTime);
      setConflict('');
      setNotice(`Next available slot is ${nextTime}. Confirm the reservation when ready.`);
    }
  }

  async function cancelReservation(id: string) {
    try {
      await mutateReservations((current) => ({
        next: current.filter((reservation) => reservation.id !== id),
        result: undefined,
      }));
      setNotice('Reservation cancelled.');
    } catch (error) {
      setConflict(`Reservation could not be cancelled: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
    }
  }

  return (
    <section className="scenario-workspace">
      <PageHeading eyebrow="EMERGENCY DIAGNOSTICS" title="Lab availability" description="Coordinate urgent lab tests and imaging, including X-ray, CT, MRI, and ultrasound." icon={FlaskConical} />
      <div className="scenario-metrics">
        <Metric label="Available slots" value={String(availableTimes.length)} note="For selected instrument and date" tone="mint" />
        <Metric label="Reservations" value={String(reservations.filter((item) => item.date === date && (item.instrumentId ?? 'analyzer-1') === instrumentId).length)} note="For selected instrument and date" tone="blue" />
        <Metric label="Next open slot" value={nextTime ?? 'Full'} note={date === todayDate() ? 'Today' : 'Selected date'} tone="gold" />
      </div>
      <div className="workflow-columns">
        <section className="workflow-panel booking-panel">
          <div className="panel-heading"><div><p className="panel-kicker">NEW RESERVATION</p><h3>Reserve a lab slot</h3></div><span className="step-mark">01</span></div>
          <form className="workflow-form" onSubmit={reserveSlot}>
            <label>Lab or instrument<select value={instrumentId} onChange={(event) => { setInstrumentId(event.target.value); setConflict(''); setNotice(''); }}>{labInstruments.map((instrument) => <option key={instrument.id} value={instrument.id}>{instrument.name}</option>)}</select></label>
            <label>Test or service<select value={test} onChange={(event) => setTest(event.target.value)}>{labTests.map((item) => <option key={item}>{item}</option>)}</select></label>
            <div className="form-pair">
              <label>Date<input type="date" value={date} min={todayDate()} onChange={(event) => { setDate(event.target.value); setConflict(''); setNotice(''); const next = labTimes.find((slot) => (event.target.value !== todayDate() || slot > localTime()) && !reservations.some((reservation) => (reservation.instrumentId ?? 'analyzer-1') === instrumentId && reservation.date === event.target.value && reservation.time === slot)); if (next) setTime(next); }} required /></label>
              <label>Time<select value={time} onChange={(event) => { setTime(event.target.value); setConflict(''); setNotice(''); }}>{labTimes.map((slot) => <option key={slot} value={slot}>{slot}{reservations.some((reservation) => (reservation.instrumentId ?? 'analyzer-1') === instrumentId && reservation.date === date && reservation.time === slot) ? ' · booked' : ''}</option>)}</select></label>
            </div>
            <label>Requesting department<input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g. Outpatient clinic" maxLength={60} required /></label>
            {conflict && <div className="inline-alert alert-warning" role="alert"><AlertTriangle size={18} /><span>{conflict}</span></div>}
            {notice && <div className="inline-alert alert-success" role="status"><CheckCircle2 size={18} /><span>{notice}</span></div>}
            <div className="form-actions">
              <button className="btn btn-primary" type="submit"><CalendarClock size={16} /> Reserve slot</button>
              {conflict && nextTime && <button className="btn btn-secondary" type="button" onClick={useNextSlot}>Use {nextTime} <ArrowRight size={15} /></button>}
            </div>
          </form>
        </section>
        <section className="workflow-panel schedule-panel">
          <div className="panel-heading"><div><p className="panel-kicker">SCHEDULE</p><h3>Reserved lab slots</h3></div><span className="panel-count">{reservations.filter((item) => item.date === date).length} booked</span></div>
          {reservations.filter((item) => item.date === date).length ? (
            <div className="table-scroll"><table className="workflow-table"><thead><tr><th>Time</th><th>Instrument</th><th>Test</th><th>Department</th><th>Status</th><th>Action</th></tr></thead><tbody>
              {reservations.filter((item) => item.date === date).sort((a, b) => a.time.localeCompare(b.time)).map((reservation) => <tr key={reservation.id}><td><strong>{reservation.time}</strong></td><td>{labInstruments.find((instrument) => instrument.id === (reservation.instrumentId ?? 'analyzer-1'))?.name ?? 'Instrument'}</td><td>{reservation.test}</td><td>{reservation.department}</td><td><span className="status-pill status-confirmed"><Check size={13} /> Reserved</span></td><td><button type="button" className="btn btn-secondary btn-sm" onClick={() => void cancelReservation(reservation.id)}>Cancel</button></td></tr>)}
            </tbody></table></div>
          ) : <EmptyState>No slots are reserved for this date yet.</EmptyState>}
          <div className="panel-footnote"><Clock3 size={15} /> Slots are shown in local hospital time.</div>
        </section>
      </div>
    </section>
  );
}

const equipment = [
  { id: 'ultrasound', name: 'Portable ultrasound', location: 'Imaging · Level 2' },
  { id: 'ecg', name: '12-lead ECG', location: 'Diagnostics · Level 1' },
  { id: 'monitor', name: 'Transport monitor', location: 'Emergency · Level 1' },
  { id: 'infusion', name: 'Infusion pump set', location: 'Ward equipment pool' },
] as const;

const equipmentCategories = [
  {
    id: 'emergency-life-support',
    title: 'Emergency & Life Support',
    equipment: [
      { name: 'Defibrillators / AEDs', description: 'Restore normal heart rhythms during cardiac arrest.' },
      { name: 'Ventilators & Anesthesia Machines', description: 'Provide mechanical respiratory support and gas delivery.' },
      { name: 'Emergency Crash Cart', description: 'Mobile unit packed with resuscitation and airway tools.' },
      { name: 'Oxygen Cylinders & Concentrators', description: 'Supply continuous medical oxygen.' },
      { name: 'Suction Units', description: 'Clear blood, mucus, and airway obstructions.' },
    ],
  },
  {
    id: 'icu-ward-monitoring',
    title: 'Intensive Care Unit (ICU) & Ward Monitoring',
    equipment: [
      { name: 'Patient Vital Sign Monitors', description: 'Track heart rate, blood pressure, temperature, and SpO₂ continuously.' },
      { name: 'Infusion & Syringe Pumps', description: 'Regulate precise, continuous delivery of intravenous medications.' },
      { name: 'ECG Machines', description: 'Record electrical activity of the heart for cardiac diagnoses.' },
      { name: 'Hospital Beds & Stretchers', description: 'Adjustable platforms for patient care and safe intra-facility transport.' },
    ],
  },
  {
    id: 'operation-theatre-surgery',
    title: 'Operation Theatre (OT) & Surgery',
    equipment: [
      { name: 'OT Lights & Surgical Tables', description: 'Provide shadow-free illumination and multi-position patient control.' },
      { name: 'Electrosurgical Units (ESU)', description: 'Cut tissue and coagulate blood during operations.' },
      { name: 'Endoscopic Imaging Systems', description: 'Offer high-definition visual feedback for minimally invasive procedures.' },
      { name: 'Sterilization Equipment (Autoclaves)', description: 'Ensure complete decontamination of surgical instruments.' },
    ],
  },
  {
    id: 'diagnostic-imaging',
    title: 'Diagnostic & Imaging',
    equipment: [
      { name: 'X-Ray & Ultrasound Machines', description: 'Deliver real-time or structural skeletal and soft-tissue imaging.' },
      { name: 'CT Scanners & MRI Machines', description: 'Provide cross-sectional and high-resolution internal organ visualization.' },
      { name: 'Laboratory Analyzers', description: 'Process blood, biochemistry, and pathology samples (e.g., cell counters, centrifuges).' },
    ],
  },
];

type EquipmentWorkflowData = { bookings: EquipmentBooking[]; outages: MaintenanceWindow[] };
type EquipmentStoredData = EquipmentWorkflowData | EquipmentBooking[];

function normalizeEquipmentData(data: EquipmentStoredData): EquipmentWorkflowData {
  return Array.isArray(data) ? { bookings: data, outages: [] } : data;
}

function EquipmentWorkspace() {
  const [storedData, , mutateEquipment] = usePersistentState<EquipmentStoredData>('hospital-flow-equipment-bookings-v1', () => ({
    bookings: [
      { id: 'equipment-seed-1', equipmentId: 'ecg', date: todayDate(), time: '10:00', hours: 2, department: 'Outpatient clinic' },
      { id: 'equipment-seed-2', equipmentId: 'monitor', date: todayDate(), time: '12:00', hours: 1, department: 'Emergency department' },
    ],
    outages: [],
  }));
  const { bookings, outages } = normalizeEquipmentData(storedData);
  const [equipmentId, setEquipmentId] = useState('ultrasound');
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState('10:00');
  const [hours, setHours] = useState(1);
  const [department, setDepartment] = useState('Imaging');
  const [notice, setNotice] = useState<{ tone: string; text: string } | null>(null);
  const [outageDate, setOutageDate] = useState(todayDate());
  const [outageStart, setOutageStart] = useState('09:00');
  const [outageEnd, setOutageEnd] = useState('11:00');
  const [outageReason, setOutageReason] = useState('');
  const selectedEquipment = equipment.find((item) => item.id === equipmentId) ?? equipment[0];
  const candidate = { equipmentId, date, time, hours, department: department.trim() };
  const visibleConflict = findEquipmentConflict(bookings, outages, candidate);

  async function bookEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!department.trim() || date < todayDate()) {
      setNotice({ tone: 'warning', text: 'Choose a future date and enter a department.' });
      return;
    }
    const booking: EquipmentBooking = { id: `equipment-${Date.now()}`, ...candidate };
    try {
      const result = await mutateEquipment<ReturnType<typeof findEquipmentConflict>>((current) => {
        const data = normalizeEquipmentData(current);
        const conflict = findEquipmentConflict(data.bookings, data.outages, booking);
        if (conflict.kind !== 'none') return { next: current, result: conflict, write: false };
        return { next: { ...data, bookings: [booking, ...data.bookings] }, result: conflict };
      });
      if (result.kind === 'booking') {
        setNotice({ tone: 'warning', text: `This time overlaps a booking from ${result.booking.time} (${result.booking.hours} hour(s)).` });
        return;
      }
      if (result.kind === 'outage') {
        setNotice({ tone: 'warning', text: `Booking blocked during maintenance: ${result.outage.reason} (${result.outage.startTime}–${result.outage.endTime}).` });
        return;
      }
      if (result.kind === 'invalid') {
        setNotice({ tone: 'warning', text: 'Choose a valid start time and duration that ends before midnight.' });
        return;
      }
      setNotice({ tone: 'success', text: `${selectedEquipment.name} booked for ${date} at ${time}.` });
    } catch (error) {
      setNotice({ tone: 'warning', text: `Booking could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}` });
    }
  }

  async function cancelBooking(id: string) {
    try {
      await mutateEquipment((current) => {
        const data = normalizeEquipmentData(current);
        return { next: { ...data, bookings: data.bookings.filter((booking) => booking.id !== id) }, result: undefined };
      });
      setNotice({ tone: 'success', text: 'Equipment booking cancelled.' });
    } catch (error) {
      setNotice({ tone: 'warning', text: `Booking could not be cancelled: ${error instanceof Error ? error.message : 'Unexpected data error.'}` });
    }
  }

  async function reportOutage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (outageDate < todayDate() || !outageReason.trim() || outageStart >= outageEnd) {
      setNotice({ tone: 'warning', text: 'Enter a future/current date, a valid time range, and an operational reason.' });
      return;
    }
    const outage: MaintenanceWindow = {
      id: `outage-${Date.now()}`,
      equipmentId,
      date: outageDate,
      startTime: outageStart,
      endTime: outageEnd,
      reason: outageReason.trim(),
    };
    try {
      const result = await mutateEquipment<ReturnType<typeof checkMaintenanceWindow>>((current) => {
        const data = normalizeEquipmentData(current);
        const conflict = checkMaintenanceWindow(data.bookings, data.outages, outage);
        if (conflict.kind !== 'none') return { next: current, result: conflict, write: false };
        return { next: { ...data, outages: [outage, ...data.outages] }, result: conflict };
      });
      if (result.kind === 'booking') {
        setNotice({ tone: 'warning', text: `Outage overlaps an existing booking at ${result.booking.time}. Cancel or reschedule it first.` });
      } else if (result.kind === 'outage') {
        setNotice({ tone: 'warning', text: `This time overlaps a maintenance window (${result.outage.startTime}–${result.outage.endTime}).` });
      } else if (result.kind === 'invalid') {
        setNotice({ tone: 'warning', text: 'Maintenance window is invalid. Check its time range and reason.' });
      } else {
        setOutageReason('');
        setNotice({ tone: 'success', text: 'Maintenance outage recorded; overlapping bookings are blocked.' });
      }
    } catch (error) {
      setNotice({ tone: 'warning', text: `Outage could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}` });
    }
  }

  async function restoreOutage(id: string) {
    try {
      await mutateEquipment((current) => {
        const data = normalizeEquipmentData(current);
        return {
          next: {
            ...data,
            outages: data.outages.map((outage) => outage.id === id && !outage.restoredAt
              ? { ...outage, restoredAt: new Date().toISOString() }
              : outage),
          },
          result: undefined,
        };
      });
      setNotice({ tone: 'success', text: 'Equipment restored; future bookings are available outside other maintenance windows.' });
    } catch (error) {
      setNotice({ tone: 'warning', text: `Equipment could not be restored: ${error instanceof Error ? error.message : 'Unexpected data error.'}` });
    }
  }

  return (
    <section className="scenario-workspace">
      <PageHeading eyebrow="SHARED RESOURCES" title="Equipment booking" description="Book shared clinical equipment, check utilization, and keep maintenance outages visible." icon={Wrench} />
      <div className="scenario-metrics">
        <Metric label="Equipment items" value={String(equipment.length)} note="Across shared pools" tone="blue" />
        <Metric label="Active outages" value={String(outages.filter((outage) => !outage.restoredAt && outage.date === todayDate()).length)} note="Scheduled for today" tone="coral" />
        <Metric label="Bookings today" value={String(bookings.filter((item) => item.date === todayDate()).length)} note="All departments" tone="mint" />
      </div>
      {equipmentCategories.map((category) => (
        <section className="workflow-panel full-panel" key={category.id} aria-labelledby={`equipment-category-${category.id}`}>
          <div className="panel-heading">
            <div><p className="panel-kicker">CLINICAL EQUIPMENT</p><h3 id={`equipment-category-${category.id}`}>{category.title}</h3></div>
            <span className="panel-count">{category.equipment.length} equipment types</span>
          </div>
          <ul className="life-support-grid">
            {category.equipment.map((item) => (
              <li className="life-support-item" key={item.name}>
                <strong>{item.name}</strong>
                <p>{item.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="workflow-columns">
        <section className="workflow-panel booking-panel">
          <div className="panel-heading"><div><p className="panel-kicker">NEW BOOKING</p><h3>Book equipment</h3></div><span className="step-mark">01</span></div>
          <form className="workflow-form" onSubmit={bookEquipment}>
            <label>Equipment<select value={equipmentId} onChange={(event) => { setEquipmentId(event.target.value); setNotice(null); }}>{equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <div className="equipment-location"><Hospital size={15} /> {selectedEquipment.location}</div>
            {visibleConflict.kind === 'outage' && <div className="inline-alert alert-warning" role="status"><Wrench size={18} /><span>{visibleConflict.outage.reason}. Booking is blocked during {visibleConflict.outage.startTime}–{visibleConflict.outage.endTime}.</span></div>}
            {visibleConflict.kind === 'booking' && <div className="inline-alert alert-warning" role="status"><AlertTriangle size={18} /><span>This time overlaps a booking from {visibleConflict.booking.time}.</span></div>}
            <div className="form-pair">
              <label>Date<input type="date" value={date} min={todayDate()} onChange={(event) => setDate(event.target.value)} required /></label>
              <label>Start time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
            </div>
            <div className="form-pair">
              <label>Duration<select value={hours} onChange={(event) => setHours(Number(event.target.value))}><option value={1}>1 hour</option><option value={2}>2 hours</option><option value={4}>4 hours</option><option value={8}>Full shift · 8 hours</option></select></label>
              <label>Department<input value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={60} required /></label>
            </div>
            {notice && <div className={`inline-alert alert-${notice.tone}`} role="status">{notice.tone === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<span>{notice.text}</span></div>}
            <button className="btn btn-primary" type="submit"><PackageCheck size={16} /> Book equipment</button>
          </form>
        </section>
        <section className="workflow-panel utilization-panel">
          <div className="panel-heading"><div><p className="panel-kicker">RESOURCE STATUS</p><h3>Availability & utilization</h3></div></div>
          <div className="equipment-list">
            {equipment.map((item) => {
              const utilization = calculateEquipmentUtilization(bookings, outages, item.id, date);
              const unavailable = utilization.availableHours === 0;
              return <div className="equipment-row" key={item.id}>
                <div className="equipment-row-top"><div><strong>{item.name}</strong><small>{item.location}</small></div><span className={`status-pill ${unavailable ? 'status-maintenance' : 'status-confirmed'}`}>{unavailable ? 'Unavailable' : 'Available'}</span></div>
                <div className="utilization-line"><div className="utilization-track"><span style={{ width: `${utilization.percent}%` }} /></div><small>{utilization.percent}% · {utilization.bookedHours}/{utilization.availableHours} available shift hours</small></div>
              </div>;
            })}
          </div>
          <div className="panel-footnote">Utilization for {date}: booked hours ÷ available hours in the 08:00–16:00 shift, after maintenance outages.</div>
        </section>
      </div>
      <section className="workflow-panel full-panel">
        <div className="panel-heading"><div><p className="panel-kicker">SCHEDULE</p><h3>Equipment bookings</h3></div><label className="panel-count">Date <input type="date" value={date} min={todayDate()} onChange={(event) => setDate(event.target.value)} /></label></div>
        {bookings.filter((item) => item.date === date).length ? <div className="table-scroll"><table className="workflow-table"><thead><tr><th>Equipment</th><th>Time</th><th>Duration</th><th>Department</th><th>Action</th></tr></thead><tbody>{bookings.filter((item) => item.date === date).sort((a, b) => a.time.localeCompare(b.time)).map((booking) => <tr key={booking.id}><td><strong>{equipment.find((item) => item.id === booking.equipmentId)?.name}</strong></td><td>{booking.time}</td><td>{booking.hours} {booking.hours === 1 ? 'hour' : 'hours'}</td><td>{booking.department}</td><td><button type="button" className="btn btn-secondary btn-sm" onClick={() => void cancelBooking(booking.id)}>Cancel</button></td></tr>)}</tbody></table></div> : <EmptyState>No equipment bookings for this date.</EmptyState>}
      </section>
      <div className="workflow-columns">
        <section className="workflow-panel booking-panel">
          <div className="panel-heading"><div><p className="panel-kicker">MAINTENANCE</p><h3>Report equipment outage</h3></div></div>
          <form className="workflow-form" onSubmit={reportOutage}>
            <label>Equipment<select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}>{equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <div className="form-pair">
              <label>Date<input type="date" value={outageDate} min={todayDate()} onChange={(event) => setOutageDate(event.target.value)} required /></label>
              <label>Reason<input value={outageReason} onChange={(event) => setOutageReason(event.target.value)} maxLength={120} required /></label>
            </div>
            <div className="form-pair">
              <label>Start<input type="time" value={outageStart} onChange={(event) => setOutageStart(event.target.value)} required /></label>
              <label>End<input type="time" value={outageEnd} onChange={(event) => setOutageEnd(event.target.value)} required /></label>
            </div>
            <button className="btn btn-secondary" type="submit"><Wrench size={16} /> Record outage</button>
          </form>
        </section>
        <section className="workflow-panel schedule-panel">
          <div className="panel-heading"><div><p className="panel-kicker">OUTAGE LOG</p><h3>Maintenance windows</h3></div><span className="panel-count">{outages.length} records</span></div>
          {outages.length ? <div className="allocation-list">{outages.map((outage) => <div className="allocation-row" key={outage.id}><span className="allocation-icon"><Wrench size={17} /></span><div><strong>{equipment.find((item) => item.id === outage.equipmentId)?.name} · {outage.date}</strong><small>{outage.startTime}–{outage.endTime} · {outage.reason}{outage.restoredAt ? ` · Restored ${new Date(outage.restoredAt).toLocaleString()}` : ''}</small></div>{!outage.restoredAt && <button type="button" className="btn btn-secondary btn-sm" onClick={() => void restoreOutage(outage.id)}>Restore</button>}</div>)}</div> : <EmptyState>No maintenance outages have been reported.</EmptyState>}
        </section>
      </div>
    </section>
  );
}

const campCapacity = 120;

function CampWorkspace() {
  const [allocations, , mutateAllocations] = usePersistentState<CampAllocation[]>('hospital-flow-camp-allocations-v1', () => [
    { id: 'camp-seed-1', resource: 'Care kits', units: 72, department: 'Community health team' },
  ]);
  const [resource, setResource] = useState('Care kits');
  const [units, setUnits] = useState(12);
  const [department, setDepartment] = useState('Community health team');
  const [notice, setNotice] = useState<{ tone: string; text: string } | null>(null);
  const { allocated, remaining, percent, warning } = calculateCapacity(allocations, campCapacity);

  async function allocateResources(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!department.trim()) {
      setNotice({ tone: 'warning', text: 'Enter the allocating team before saving.' });
      return;
    }
    const allocation = { id: `camp-${Date.now()}`, resource, units, department: department.trim() };
    try {
      const result = await mutateAllocations((current) => {
        const currentCapacity = calculateCapacity(current, campCapacity);
        if (!canAllocate(units, currentCapacity.remaining)) {
          return { next: current, result: { ok: false, remaining: currentCapacity.remaining }, write: false };
        }
        return {
          next: [allocation, ...current],
          result: { ok: true, remaining: currentCapacity.remaining - units },
        };
      });
      if (!result.ok) {
        setNotice({ tone: 'warning', text: `Only ${result.remaining} whole units remain. This allocation was blocked; capacity was not changed.` });
        return;
      }
      setNotice({ tone: 'success', text: `${units} ${resource.toLowerCase()} allocated. ${result.remaining} units remain.` });
    } catch (error) {
      setNotice({ tone: 'warning', text: `Allocation could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}` });
    }
  }

  async function cancelAllocation(id: string) {
    try {
      await mutateAllocations((current) => ({
        next: current.filter((allocation) => allocation.id !== id),
        result: undefined,
      }));
      setNotice({ tone: 'success', text: 'Allocation released and capacity recalculated.' });
    } catch (error) {
      setNotice({ tone: 'warning', text: `Allocation could not be released: ${error instanceof Error ? error.message : 'Unexpected data error.'}` });
    }
  }

  return (
    <section className="scenario-workspace">
      <PageHeading eyebrow="COMMUNITY OUTREACH" title="Health camp" description="Allocate resource units to the camp while keeping the remaining capacity in view." icon={Stethoscope} />
      <section className="camp-capacity-panel">
        <div className="capacity-topline"><div><p className="panel-kicker">NORTHSIDE WELLNESS CAMP</p><h3>Resource capacity</h3></div><span className={`status-pill ${remaining === 0 ? 'status-maintenance' : 'status-confirmed'}`}>{remaining === 0 ? 'At capacity' : 'Open for allocation'}</span></div>
        <div className="capacity-numbers"><div><strong>{allocated}</strong><span>allocated</span></div><div className="capacity-divider">/</div><div><strong>{campCapacity}</strong><span>total units</span></div><div className="capacity-remaining"><strong>{remaining}</strong><span>remaining</span></div></div>
        <div className="capacity-track" role="progressbar" aria-label="Camp resource capacity" aria-valuemin={0} aria-valuemax={campCapacity} aria-valuenow={allocated}><span style={{ width: `${Math.min(100, allocated / campCapacity * 100)}%` }} /></div>
        <div className="capacity-caption"><span>0 units</span><span>{percent}% allocated · warning at 80%</span><span>{campCapacity} units</span></div>
      </section>
      {warning && <div className="inline-alert alert-warning capacity-alert" role="status"><AlertTriangle size={18} /><span>Camp capacity is at least 80% allocated. Review remaining units before adding more.</span></div>}
      <div className="workflow-columns">
        <section className="workflow-panel booking-panel">
          <div className="panel-heading"><div><p className="panel-kicker">RESOURCE PLANNING</p><h3>Allocate units</h3></div><span className="step-mark">01</span></div>
          <form className="workflow-form" onSubmit={allocateResources}>
            <label>Resource type<select value={resource} onChange={(event) => setResource(event.target.value)}><option>Care kits</option><option>Screening kits</option><option>Staff shifts</option><option>Transport units</option></select></label>
            <div className="form-pair">
              <label>Number of units<input type="number" min={1} step={1} value={units} onChange={(event) => setUnits(Number(event.target.value))} required /></label>
              <label>Allocating team<input value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={60} required /></label>
            </div>
            <p className="form-hint">Up to {remaining} units can be allocated without exceeding capacity.</p>
            {notice && <div className={`inline-alert alert-${notice.tone}`} role={notice.tone === 'warning' ? 'alert' : 'status'}>{notice.tone === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<span>{notice.text}</span></div>}
            <button className="btn btn-primary" type="submit" disabled={remaining === 0}><Plus size={16} /> Allocate resources</button>
          </form>
        </section>
        <section className="workflow-panel schedule-panel">
          <div className="panel-heading"><div><p className="panel-kicker">ALLOCATION LOG</p><h3>Resource units assigned</h3></div><span className="panel-count">{allocations.length} entries</span></div>
          {allocations.length ? <div className="allocation-list">{allocations.map((allocation) => <div className="allocation-row" key={allocation.id}><span className="allocation-icon"><PackageCheck size={17} /></span><div><strong>{allocation.resource}</strong><small>{allocation.department}</small></div><b>{allocation.units}<small> units</small></b><button type="button" className="btn btn-secondary btn-sm" onClick={() => void cancelAllocation(allocation.id)}>Release</button></div>)}</div> : <EmptyState>No resources have been allocated yet.</EmptyState>}
        </section>
      </div>
      {remaining === 0 && <div className="inline-alert alert-warning capacity-alert" role="status"><AlertTriangle size={18} /><span>Camp is at capacity. Additional allocations are blocked until units are released.</span></div>}
    </section>
  );
}

export function ScenarioWorkspace({ route }: { route: ScenarioRoute }) {
  if (route === 'home') return <ScenarioHome />;
  if (route === 'not-found') return (
    <section className="scenario-workspace" aria-labelledby="not-found-title">
      <PageHeading eyebrow="PAGE NOT FOUND" title="This workflow does not exist" description="The address may be incorrect or the workflow may have moved." icon={AlertTriangle} />
      <a className="btn btn-primary" href="/">Return to All workflows</a>
    </section>
  );
  if (route === 'labs') return <LabWorkspace />;
  if (route === 'equipment') return <EquipmentWorkspace />;
  if (route === 'occupancy') return <OccupancyWorkspace />;
  if (route === 'camps') return <CampWorkspace />;
  if (route === 'pharmacy') return <PharmacyWorkspace />;
  if (route === 'trauma') return <TraumaWorkspace />;
  if (route === 'clinicians') return <CliniciansWorkspace />;
  if (route === 'staff') return <StaffWorkspace />;
  if (route === 'alerts') return <AlertsWorkspace />;
  if (route === 'blood-bank') return <BloodBankWorkspace />;
  if (route === 'ambulance') return <AmbulanceWorkspace />;
  if (route === 'infection-control') return <InfectionControlWorkspace />;
  return null;
}
