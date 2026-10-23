import { useState } from 'react';
import type { FormEvent } from 'react';
import { useFacilityData } from '../context/FacilityDataContext';
import {
  Activity,
  AlertTriangle,
  Biohazard,
  Bed,
  BellRing,
  Boxes,
  Check,
  ClipboardList,
  Clock3,
  Droplets,
  HeartPulse,
  Plus,
  Search,
  ShieldAlert,
  Stethoscope,
  Truck,
  Users,
  UserRoundCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  acknowledgeOnce,
  adjustStock,
  canTransitionAmbulance,
  canTransitionIsolation,
  canTransitionTrauma,
  classifyStock,
  validateStaffCount,
} from '../services/workflowRules';
import type { TraumaStatus } from '../services/workflowRules';
import './ScenarioWorkspace.css';

type PanelHeaderProps = { eyebrow: string; title: string; description: string; icon: LucideIcon };

function PanelHeader({ eyebrow, title, description, icon: Icon }: PanelHeaderProps) {
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

function useLocalRecords<T>(key: string, initialValue: () => T) {
  return useFacilityData(key, initialValue);
}

function currentTimestamp() {
  return new Date().toISOString();
}

function SummaryMetric({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return <div className={`scenario-metric metric-${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function StateTag({ children, tone = 'neutral' }: { children: string; tone?: string }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

function SectionTitle({ label, title, trailing }: { label: string; title: string; trailing?: string }) {
  return <div className="panel-heading"><div><p className="panel-kicker">{label}</p><h3>{title}</h3></div>{trailing && <span className="panel-count">{trailing}</span>}</div>;
}

type Medicine = { id: string; name: string; category: string; quantity: number; parLevel: number; unit: string; updatedAt?: string };
type StockEvent = { id: string; itemName: string; delta: number; reason: string; at: string };
type PharmacyData = { items: Medicine[]; events: StockEvent[] };
type PharmacyStoredData = PharmacyData | Medicine[];
type StockAdjustmentResult = { ok: true } | { ok: false; message: string };

const initialMedicines: Medicine[] = [
  { id: 'epi', name: 'Epinephrine injection', category: 'Emergency medicine', quantity: 18, parLevel: 24, unit: 'ampoules' },
  { id: 'saline', name: 'Normal saline 500 ml', category: 'IV fluids', quantity: 42, parLevel: 30, unit: 'bags' },
  { id: 'oxygen', name: 'Oxygen mask kit', category: 'Airway & oxygen', quantity: 11, parLevel: 16, unit: 'kits' },
  { id: 'dressing', name: 'Trauma dressing pack', category: 'Emergency supplies', quantity: 9, parLevel: 12, unit: 'packs' },
  { id: 'airway', name: 'Adult airway set', category: 'Airway & oxygen', quantity: 14, parLevel: 8, unit: 'sets' },
];

export function PharmacyWorkspace() {
  const [stored, , mutatePharmacy] = useLocalRecords<PharmacyStoredData>('hospital-flow-pharmacy-v1', () => ({
    items: initialMedicines,
    events: [],
  }));
  const data: PharmacyData = Array.isArray(stored) ? { items: stored, events: [] } : stored;
  const { items, events } = data;
  const [selectedItemId, setSelectedItemId] = useState(initialMedicines[0].id);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'Low stock' | 'In stock'>('All');
  const [notice, setNotice] = useState('');
  const lowStock = items.filter((item) => classifyStock(item.quantity, item.parLevel) !== 'in-stock').length;
  const criticalStock = items.filter((item) => classifyStock(item.quantity, item.parLevel) === 'critical').length;
  const totalUnits = items.reduce((total, item) => total + item.quantity, 0);
  const categories = [...new Set(items.map((item) => item.category))];
  const visibleItems = items.filter((item) => {
    const matchesSearch = `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesStock = stockFilter === 'All' || (stockFilter === 'Low stock' ? item.quantity < item.parLevel : item.quantity >= item.parLevel);
    return matchesSearch && matchesCategory && matchesStock;
  });

  async function recordAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) {
      setNotice('Enter an operational reason for this adjustment.');
      return;
    }
    const eventAt = new Date().toISOString();
    const eventId = `stock-${Date.now()}`;
    try {
      const result = await mutatePharmacy<StockAdjustmentResult>((current) => {
        const currentData = Array.isArray(current) ? { items: current, events: [] } : current;
        const selected = currentData.items.find((item) => item.id === selectedItemId);
        if (!selected) return { next: current, result: { ok: false as const, message: 'Select an inventory item.' }, write: false };
        const adjustment = adjustStock(selected.quantity, delta, reason);
        if (!adjustment.ok) return { next: current, result: { ok: false as const, message: adjustment.error }, write: false };
        const activity: StockEvent = { id: eventId, itemName: selected.name, delta, reason: reason.trim(), at: eventAt };
        return {
          next: {
            items: currentData.items.map((item) => item.id === selected.id
              ? { ...item, quantity: adjustment.quantity, updatedAt: eventAt }
              : item),
            events: [activity, ...currentData.events].slice(0, 200),
          },
          result: { ok: true as const },
        };
      });
      setNotice(result.ok ? 'Stock adjustment saved.' : result.message);
      if (result.ok) setReason('');
    } catch (error) {
      setNotice(`Stock adjustment could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
    }
  }

  return (
    <section className="scenario-workspace">
      <PanelHeader eyebrow="EMERGENCY SUPPLY" title="Pharmacy & emergency tools" description="Track critical medicines and resuscitation supplies. Low-stock items are flagged for replenishment." icon={Boxes} />
      <div className="scenario-metrics">
        <SummaryMetric label="Tracked items" value={String(items.length)} note="Emergency inventory" tone="blue" />
        <SummaryMetric label="Units on hand" value={String(totalUnits)} note="Across tracked items" tone="mint" />
        <SummaryMetric label="Below par level" value={String(lowStock)} note={`${criticalStock} critical (≤ 50% of par)`} tone={lowStock ? 'coral' : 'gold'} />
      </div>
      <section className="workflow-panel full-panel">
        <SectionTitle label="PHARMACY INVENTORY" title="Emergency medicines & tools" trailing={`${lowStock} reorder flags`} />
        <div className="alert-toolbar">
          <label className="sr-only" htmlFor="pharmacy-search">Search pharmacy items</label>
          <span className="search-input"><Search size={15} /><input id="pharmacy-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supply or category" /></span>
          <label>Category <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Stock status <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)}><option>All</option><option>Low stock</option><option>In stock</option></select></label>
        </div>
        <div className="table-scroll"><table className="workflow-table emergency-table"><thead><tr><th>Supply</th><th>Category</th><th>On hand</th><th>Par level</th><th>Last updated</th><th>Status</th></tr></thead><tbody>
          {visibleItems.map((item) => {
            const stockStatus = classifyStock(item.quantity, item.parLevel);
            return <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.category}</td><td>{item.quantity} {item.unit}</td><td>{item.parLevel} {item.unit}</td><td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Seeded demo value'}</td><td><StateTag tone={stockStatus === 'critical' ? 'maintenance' : stockStatus === 'low' ? 'warning' : 'confirmed'}>{stockStatus === 'critical' ? 'Critical' : stockStatus === 'low' ? 'Low stock' : 'In stock'}</StateTag></td></tr>;
          })}
        </tbody></table></div>
        {!visibleItems.length && <p className="scenario-empty">No supplies match these filters.</p>}
        <form className="workflow-form" onSubmit={recordAdjustment}>
          <div className="panel-heading"><div><p className="panel-kicker">STOCK CONTROL</p><h3>Record adjustment</h3></div></div>
          <div className="form-pair">
            <label>Supply<select value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Quantity change<input type="number" step={1} value={delta} onChange={(event) => setDelta(Number(event.target.value))} required /><small>Use positive quantities for receipts and negative quantities for corrections.</small></label>
          </div>
          <label>Operational reason<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={120} required /></label>
          {notice && <p role="status">{notice}</p>}
          <button className="btn btn-primary" type="submit"><Plus size={16} /> Save adjustment</button>
        </form>
        <div className="workflow-panel">
          <SectionTitle label="ACTIVITY" title="Recent stock adjustments" trailing={`${events.length} events`} />
          {events.length ? <ol className="occupancy-event-list">{events.slice(0, 10).map((activity) => <li key={activity.id}><span className="event-dot" /><div><strong>{activity.itemName} · {activity.delta > 0 ? '+' : ''}{activity.delta}</strong><small>{activity.reason} · {new Date(activity.at).toLocaleString()}</small></div></li>)}</ol> : <p className="scenario-empty">No stock adjustments have been recorded.</p>}
        </div>
        <div className="panel-footnote"><ShieldAlert size={15} /> Demo inventory only. Confirm quantities against the hospital pharmacy system.</div>
      </section>
    </section>
  );
}

type BayStatus = TraumaStatus;
type TraumaBay = { id: string; name: string; zone: string; status: BayStatus; unavailableReason?: string; lastUpdatedAt?: string };
const bayTransitions: Record<BayStatus, { label: string; next: BayStatus }> = {
  Available: { label: 'Start case', next: 'In use' },
  'In use': { label: 'Send to cleaning', next: 'Cleaning' },
  Cleaning: { label: 'Mark ready', next: 'Available' },
  Unavailable: { label: 'Restore ready', next: 'Available' },
};

const initialBays: TraumaBay[] = [
  { id: 'T-01', name: 'Trauma bay 01', zone: 'Resuscitation', status: 'In use' },
  { id: 'T-02', name: 'Trauma bay 02', zone: 'Resuscitation', status: 'Available' },
  { id: 'T-03', name: 'Trauma bay 03', zone: 'Major injuries', status: 'Cleaning' },
  { id: 'T-04', name: 'Trauma bay 04', zone: 'Major injuries', status: 'Available' },
  { id: 'E-05', name: 'Observation bed 05', zone: 'Emergency ward', status: 'In use' },
  { id: 'E-06', name: 'Observation bed 06', zone: 'Emergency ward', status: 'Available' },
];

export function TraumaWorkspace() {
  const [bays, , mutateBays] = useLocalRecords<TraumaBay[]>('hospital-flow-trauma-bays-v1', () => initialBays);
  const [selectedBayId, setSelectedBayId] = useState(initialBays[0].id);
  const [unavailableReason, setUnavailableReason] = useState('');
  const [notice, setNotice] = useState('');
  const available = bays.filter((bay) => bay.status === 'Available').length;
  const inUse = bays.filter((bay) => bay.status === 'In use').length;
  const cleaning = bays.filter((bay) => bay.status === 'Cleaning').length;
  const unavailable = bays.filter((bay) => bay.status === 'Unavailable').length;

  async function advanceBay(id: string, next: BayStatus, reason = '') {
    const timestamp = new Date().toISOString();
    try {
      const result = await mutateBays((current) => {
        const bay = current.find((item) => item.id === id);
        if (!bay || !canTransitionTrauma(bay.status, next, reason)) {
          return { next: current, result: false, write: false };
        }
        return {
          next: current.map((item) => item.id === id
            ? { ...item, status: next, unavailableReason: next === 'Unavailable' ? reason.trim() : undefined, lastUpdatedAt: timestamp }
            : item),
          result: true,
        };
      });
      setNotice(result ? `Space marked ${next.toLowerCase()}.` : 'That readiness transition is no longer available. Refresh and try again.');
    } catch (error) {
      setNotice(`Status could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
    }
  }

  async function markUnavailable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unavailableReason.trim()) {
      setNotice('Enter an operational reason before marking a space unavailable.');
      return;
    }
    await advanceBay(selectedBayId, 'Unavailable', unavailableReason);
    setUnavailableReason('');
  }

  return (
    <section className="scenario-workspace">
      <PanelHeader eyebrow="EMERGENCY DEPARTMENT" title="Emergency & trauma centre" description="See resuscitation bays and emergency ward beds by readiness. Advance each space through care, cleaning, and ready." icon={HeartPulse} />
      <div className="scenario-metrics">
        <SummaryMetric label="Ready now" value={`${available}`} note="Available bays & beds" tone="mint" />
        <SummaryMetric label="In use" value={`${inUse}`} note="Active care spaces" tone="coral" />
        <SummaryMetric label="Being cleaned" value={`${cleaning}`} note="Not yet ready" tone="gold" />
        <SummaryMetric label="Unavailable" value={`${unavailable}`} note="Blocked for operations" tone="coral" />
      </div>
      <section className="workflow-panel full-panel">
        <SectionTitle label="LIVE CAPACITY" title="Emergency spaces" trailing={`${available} of ${bays.length} ready`} />
        <div className="trauma-grid">{bays.map((bay) => <article className="trauma-bay" key={bay.id}>
          <div className={`trauma-bay-mark bay-${bay.status.toLowerCase().replace(' ', '-')}`}><Bed size={19} /></div>
          <div className="trauma-bay-copy"><strong>{bay.name}</strong><small>{bay.id} · {bay.zone}</small></div>
          <StateTag tone={bay.status === 'Available' ? 'confirmed' : bay.status === 'Cleaning' || bay.status === 'Unavailable' ? 'maintenance' : 'neutral'}>{bay.status}</StateTag>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void advanceBay(bay.id, bayTransitions[bay.status].next)}>{bayTransitions[bay.status].label}</button>
          {bay.unavailableReason && <small>{bay.unavailableReason}{bay.lastUpdatedAt ? ` · ${new Date(bay.lastUpdatedAt).toLocaleString()}` : ''}</small>}
        </article>)}</div>
        <form className="workflow-form" onSubmit={markUnavailable}>
          <div className="panel-heading"><div><p className="panel-kicker">CAPACITY BLOCKER</p><h3>Mark space unavailable</h3></div></div>
          <div className="form-pair">
            <label>Emergency space<select value={selectedBayId} onChange={(event) => setSelectedBayId(event.target.value)}>{bays.filter((bay) => bay.status !== 'Unavailable').map((bay) => <option key={bay.id} value={bay.id}>{bay.name} · {bay.status}</option>)}</select></label>
            <label>Operational reason<input value={unavailableReason} onChange={(event) => setUnavailableReason(event.target.value)} maxLength={120} required /></label>
          </div>
          <button className="btn btn-secondary" type="submit" disabled={!bays.some((bay) => bay.status !== 'Unavailable')}><ShieldAlert size={16} /> Mark unavailable</button>
          {notice && <p role="status">{notice}</p>}
        </form>
        <div className="panel-footnote"><Activity size={15} /> Use synthetic operational states only. Patient or case details are not shown here.</div>
      </section>
    </section>
  );
}

type Clinician = { id: string; name: string; specialty: string; shift: string; status: 'Available' | 'With patient' | 'On call' | 'Off shift' };
const initialClinicians: Clinician[] = [
  { id: 'DR-01', name: 'Dr. Meera S.', specialty: 'Emergency medicine', shift: '08:00–16:00', status: 'Available' },
  { id: 'DR-02', name: 'Dr. Arjun K.', specialty: 'Trauma surgery', shift: '08:00–20:00', status: 'With patient' },
  { id: 'DR-03', name: 'Dr. Sara P.', specialty: 'Radiology', shift: '10:00–18:00', status: 'Available' },
  { id: 'DR-04', name: 'Dr. Nikhil R.', specialty: 'Anaesthesia', shift: '12:00–20:00', status: 'On call' },
  { id: 'DR-05', name: 'Dr. Leena D.', specialty: 'Emergency medicine', shift: '20:00–08:00', status: 'Off shift' },
];
const clinicianStatuses: Clinician['status'][] = ['Available', 'With patient', 'On call', 'Off shift'];

export function CliniciansWorkspace() {
  const [clinicians, , mutateClinicians] = useLocalRecords<Clinician[]>('hospital-flow-clinicians-v1', () => initialClinicians);
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | Clinician['status']>('All');
  const [notice, setNotice] = useState('');
  const specialties = [...new Set(clinicians.map((person) => person.specialty))];
  const visibleClinicians = clinicians.filter((person) =>
    (departmentFilter === 'All' || person.specialty === departmentFilter) &&
    (statusFilter === 'All' || person.status === statusFilter),
  );
  const available = visibleClinicians.filter((person) => person.status === 'Available').length;
  const onCall = visibleClinicians.filter((person) => person.status === 'On call').length;

  async function updateStatus(id: string, status: Clinician['status']) {
    try {
      await mutateClinicians((current) => ({
        next: current.map((person) => person.id === id ? { ...person, status } : person),
        result: undefined,
      }));
      setNotice('Synthetic roster status updated.');
    } catch (error) {
      setNotice(`Status could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
    }
  }

  return (
    <section className="scenario-workspace">
      <PanelHeader eyebrow="CLINICAL COVERAGE" title="Doctor availability & schedule" description="Check clinician status, specialty, and shift times to coordinate emergency coverage." icon={Stethoscope} />
      <div className="scenario-metrics">
        <SummaryMetric label="Available now" value={String(available)} note="Ready for assignment" tone="mint" />
        <SummaryMetric label="On call" value={String(onCall)} note="Reachable for escalation" tone="blue" />
        <SummaryMetric label="Visible roster" value={String(visibleClinicians.length)} note="Matching selected filters" tone="gold" />
      </div>
      <section className="workflow-panel full-panel">
        <SectionTitle label="ON-CALL ROSTER" title="Emergency clinicians" trailing="Synthetic, read-only shifts" />
        <div className="alert-toolbar">
          <label>Department <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option>All</option>{specialties.map((specialty) => <option key={specialty}>{specialty}</option>)}</select></label>
          <label>Availability <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option>All</option>{clinicianStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        </div>
        {visibleClinicians.length ? <div className="roster-list">{visibleClinicians.map((person) => <article className="roster-row" key={person.id}>
          <span className="roster-avatar"><UserRoundCheck size={18} /></span>
          <div className="roster-person"><strong>{person.name}</strong><small>{person.specialty} · {person.id}</small></div>
          <div className="roster-shift"><Clock3 size={14} /> {person.shift}</div>
          <label className="roster-status"><span className="sr-only">{person.name} availability</span><select value={person.status} onChange={(event) => updateStatus(person.id, event.target.value as Clinician['status'])}>{clinicianStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        </article>)}</div> : <p className="scenario-empty">No clinicians match these filters.</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="panel-footnote"><ShieldAlert size={15} /> Synthetic roster. Verify real-time duty schedules through hospital administration.</div>
      </section>
    </section>
  );
}

type DepartmentCoverage = { id: string; department: string; staffed: number; required: number; roles: string };
const initialDepartments: DepartmentCoverage[] = [
  { id: 'ed', department: 'Emergency department', staffed: 8, required: 10, roles: 'Nursing · triage · support' },
  { id: 'trauma', department: 'Trauma centre', staffed: 6, required: 6, roles: 'Trauma team · theatre support' },
  { id: 'imaging', department: 'Imaging', staffed: 4, required: 5, roles: 'Radiographers · technicians' },
  { id: 'lab', department: 'Laboratory', staffed: 5, required: 5, roles: 'Lab technicians · phlebotomy' },
  { id: 'pharmacy', department: 'Emergency pharmacy', staffed: 2, required: 3, roles: 'Pharmacists · dispensary support' },
];

export function StaffWorkspace() {
  const [departments, , mutateDepartments] = useLocalRecords<DepartmentCoverage[]>('hospital-flow-staff-coverage-v1', () => initialDepartments);
  const [filter, setFilter] = useState<'All' | 'Coverage gap' | 'Covered'>('All');
  const [notice, setNotice] = useState('');
  const visibleDepartments = departments.filter((department) =>
    filter === 'All' || (filter === 'Coverage gap' ? department.staffed < department.required : department.staffed >= department.required),
  );
  const onDuty = visibleDepartments.reduce((total, department) => total + department.staffed, 0);
  const required = visibleDepartments.reduce((total, department) => total + department.required, 0);
  const shortDepartments = visibleDepartments.filter((department) => department.staffed < department.required).length;

  async function updateStaffing(id: string, staffed: number) {
    try {
      const result = await mutateDepartments((current) => {
        const department = current.find((item) => item.id === id);
        if (!department || !validateStaffCount(staffed, department.required)) {
          return { next: current, result: false, write: false };
        }
        return {
          next: current.map((item) => item.id === id ? { ...item, staffed } : item),
          result: true,
        };
      });
      setNotice(result ? 'Synthetic shift coverage updated.' : 'Staffed count must be a whole number between zero and the planned requirement.');
    } catch (error) {
      setNotice(`Coverage could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
    }
  }

  return (
    <section className="scenario-workspace">
      <PanelHeader eyebrow="SHIFT COVERAGE" title="Staff availability" description="Review on-duty coverage across emergency, trauma, imaging, laboratory, and pharmacy teams." icon={Users} />
      <div className="scenario-metrics">
        <SummaryMetric label="On duty" value={String(onDuty)} note="Across listed departments" tone="mint" />
        <SummaryMetric label="Planned coverage" value={String(required)} note="Current shift requirement" tone="blue" />
        <SummaryMetric label="Below requirement" value={String(shortDepartments)} note="Departments to review" tone={shortDepartments ? 'coral' : 'gold'} />
      </div>
      <section className="workflow-panel full-panel">
        <SectionTitle label="HOSPITAL-WIDE VIEW" title="Department coverage" trailing="Current shift" />
        <div className="alert-toolbar"><label>Coverage status <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option>All</option><option>Coverage gap</option><option>Covered</option></select></label></div>
        {visibleDepartments.length ? <div className="coverage-list">{visibleDepartments.map((department) => {
          const percentage = Math.min(100, Math.round(department.staffed / department.required * 100));
          const short = department.staffed < department.required;
          return <article className="coverage-row" key={department.id}>
            <div className="coverage-head"><div><strong>{department.department}</strong><small>{department.roles}</small></div><label className={`coverage-count${short ? ' is-short' : ''}`}><span className="sr-only">{department.department} synthetic staff on duty</span><input aria-label={`${department.department} synthetic staff on duty`} type="number" min={0} max={department.required} value={department.staffed} onChange={(event) => { if (event.target.value !== '') void updateStaffing(department.id, Number(event.target.value)); }} /><span> / {department.required}</span></label></div>
            <div className="utilization-track coverage-track"><span className={short ? 'coverage-low' : ''} style={{ width: `${percentage}%` }} /></div>
            <div className="coverage-foot"><span>{percentage}% covered</span>{short && <StateTag tone="maintenance">Coverage gap</StateTag>}</div>
          </article>;
        })}</div> : <p className="scenario-empty">No departments match this filter.</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="panel-footnote"><Users size={15} /> Staffing totals are synthetic planning examples, not a live HR feed.</div>
      </section>
    </section>
  );
}

type OperationalAlert = { id: string; severity: 'Urgent' | 'High' | 'Info'; area: string; title: string; detail: string; time: string; acknowledged: boolean; acknowledgedAt?: string };
const initialAlerts: OperationalAlert[] = [
  { id: 'alert-stock', severity: 'High', area: 'Pharmacy', title: 'Epinephrine below par level', detail: '18 ampoules available; target stock is 24.', time: '4 min ago', acknowledged: false },
  { id: 'alert-trauma', severity: 'Urgent', area: 'Trauma centre', title: 'Resuscitation bay 01 in use', detail: 'One of two resuscitation bays is currently occupied.', time: '8 min ago', acknowledged: false },
  { id: 'alert-imaging', severity: 'High', area: 'Imaging', title: 'Portable ultrasound maintenance', detail: 'Unavailable today; expected back tomorrow at 08:00.', time: '21 min ago', acknowledged: false },
  { id: 'alert-staff', severity: 'Info', area: 'Staffing', title: 'Emergency department coverage gap', detail: '8 of 10 planned staff are on duty for this shift.', time: '32 min ago', acknowledged: false },
  { id: 'alert-lab', severity: 'Info', area: 'Diagnostics', title: 'MRI schedule has open capacity', detail: 'Next available emergency imaging window is shown in Lab availability.', time: '46 min ago', acknowledged: true },
];

export function AlertsWorkspace() {
  const [alerts, , mutateAlerts] = useLocalRecords<OperationalAlert[]>('hospital-flow-alerts-v1', () => initialAlerts);
  const [filter, setFilter] = useState<'All' | OperationalAlert['severity']>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Needs acknowledgement' | 'Acknowledged'>('All');
  const [notice, setNotice] = useState('');
  const active = alerts.filter((alert) => !alert.acknowledged).length;
  const visibleAlerts = alerts.filter((alert) =>
    (filter === 'All' || alert.severity === filter) &&
    (statusFilter === 'All' || (statusFilter === 'Acknowledged' ? alert.acknowledged : !alert.acknowledged)),
  );

  async function acknowledge(id: string) {
    const acknowledgedAt = new Date().toISOString();
    try {
      await mutateAlerts((current) => {
        const target = current.find((alert) => alert.id === id);
        if (!target || target.acknowledged) return { next: current, result: undefined, write: false };
        return {
          next: current.map((alert) => alert.id === id ? acknowledgeOnce(alert, acknowledgedAt) : alert),
          result: undefined,
        };
      });
      setNotice('');
    } catch (error) {
      setNotice(`Alert could not be acknowledged: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
    }
  }
  async function acknowledgeAll() {
    const acknowledgedAt = new Date().toISOString();
    try {
      await mutateAlerts((current) => {
        if (!current.some((alert) => !alert.acknowledged)) return { next: current, result: undefined, write: false };
        return {
          next: current.map((alert) => acknowledgeOnce(alert, acknowledgedAt)),
          result: undefined,
        };
      });
      setNotice('');
    } catch (error) {
      setNotice(`Alerts could not be acknowledged: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
    }
  }

  return (
    <section className="scenario-workspace">
      <PanelHeader eyebrow="OPERATIONS FEED" title="General alerts" description="A shared view of pharmacy, trauma, equipment, diagnostics, and staffing issues that need attention." icon={BellRing} />
      <div className="scenario-metrics">
        <SummaryMetric label="Needs attention" value={String(active)} note="Unacknowledged alerts" tone={active ? 'coral' : 'mint'} />
        <SummaryMetric label="Urgent" value={String(alerts.filter((alert) => !alert.acknowledged && alert.severity === 'Urgent').length)} note="Escalate now" tone="coral" />
        <SummaryMetric label="All alerts" value={String(alerts.length)} note="Across operations" tone="blue" />
      </div>
      <section className="workflow-panel full-panel">
        <div className="panel-heading alerts-heading"><div><p className="panel-kicker">CROSS-TEAM NOTIFICATIONS</p><h3>Operational alerts</h3></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void acknowledgeAll()} disabled={active === 0}><Check size={14} /> Acknowledge all</button></div>
        <div className="alert-toolbar" role="group" aria-label="Filter alerts">{(['All', 'Urgent', 'High', 'Info'] as const).map((severity) => <button key={severity} type="button" className={`alert-filter${filter === severity ? ' is-selected' : ''}`} onClick={() => setFilter(severity)}>{severity}{severity === 'All' ? ` · ${alerts.length}` : ` · ${alerts.filter((alert) => alert.severity === severity).length}`}</button>)}</div>
        <label>Alert status <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option>All</option><option>Needs acknowledgement</option><option>Acknowledged</option></select></label>
        <div className="ops-alert-list">{visibleAlerts.map((alert) => <article className={`ops-alert${alert.acknowledged ? ' is-acknowledged' : ''}`} key={alert.id}>
          <div className={`ops-alert-icon severity-${alert.severity.toLowerCase()}`}>{alert.severity === 'Urgent' ? <AlertTriangle size={18} /> : alert.severity === 'High' ? <ShieldAlert size={18} /> : <ClipboardList size={18} />}</div>
          <div className="ops-alert-copy"><div className="ops-alert-top"><StateTag tone={alert.severity === 'Urgent' || alert.severity === 'High' ? 'maintenance' : 'neutral'}>{alert.severity}</StateTag><span>{alert.area} · {alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleString() : alert.time}</span></div><strong>{alert.title}</strong><p>{alert.detail}</p></div>
          <div className="ops-alert-action">{alert.acknowledged ? <StateTag tone="confirmed">Acknowledged</StateTag> : <button type="button" className="btn btn-secondary btn-sm" onClick={() => void acknowledge(alert.id)}><Check size={14} /> Acknowledge</button>}</div>
        </article>)}</div>
        {visibleAlerts.length === 0 && <p className="scenario-empty">No alerts match this filter.</p>}
        {notice && <p role="alert">{notice}</p>}
        <div className="panel-footnote"><BellRing size={15} /> Demo alerts are examples. Connect hospital systems for live notifications.</div>
      </section>
    </section>
  );
}

type BloodProduct = { id: string; group: string; component: string; units: number; updated?: string; updatedAt?: string };
type BloodEvent = { id: string; productLabel: string; delta: number; reason: string; at: string };
type BloodBankData = { products: BloodProduct[]; events: BloodEvent[] };
type BloodBankStoredData = BloodBankData | BloodProduct[];
const initialBloodProducts: BloodProduct[] = [
  { id: 'a-positive-rbc', group: 'A+', component: 'Red blood cells', units: 8, updated: '20 min ago' },
  { id: 'o-negative-rbc', group: 'O−', component: 'Red blood cells', units: 4, updated: '35 min ago' },
  { id: 'b-positive-plasma', group: 'B+', component: 'Plasma', units: 6, updated: '1 hr ago' },
  { id: 'ab-positive-platelets', group: 'AB+', component: 'Platelets', units: 3, updated: '2 hr ago' },
];

export function BloodBankWorkspace() {
  const [stored, , mutateBloodBank] = useLocalRecords<BloodBankStoredData>('hospital-flow-blood-bank-v1', () => ({
    products: initialBloodProducts,
    events: [],
  }));
  const data: BloodBankData = Array.isArray(stored) ? { products: stored, events: [] } : stored;
  const { products, events } = data;
  const [selectedId, setSelectedId] = useState(initialBloodProducts[0].id);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const totalUnits = products.reduce((total, product) => total + product.units, 0);
  const availableTypes = products.filter((product) => product.units > 0).length;

  async function recordAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const at = currentTimestamp();
    const eventId = `blood-${Date.now()}`;
    try {
      const result = await mutateBloodBank<StockAdjustmentResult>((current) => {
        const currentData = Array.isArray(current) ? { products: current, events: [] } : current;
        const selected = currentData.products.find((product) => product.id === selectedId);
        if (!selected) return { next: current, result: { ok: false, message: 'Select a blood product listing.' }, write: false };
        const adjustment = adjustStock(selected.units, delta, reason);
        if (!adjustment.ok) return { next: current, result: { ok: false, message: adjustment.error }, write: false };
        const productLabel = `${selected.group} ${selected.component}`;
        const activity: BloodEvent = { id: eventId, productLabel, delta, reason: reason.trim(), at };
        return {
          next: {
            products: currentData.products.map((product) => product.id === selectedId
              ? { ...product, units: adjustment.quantity, updatedAt: at }
              : product),
            events: [activity, ...currentData.events].slice(0, 200),
          },
          result: { ok: true },
        };
      });
      setNotice(result.ok ? 'Blood product inventory adjustment saved.' : result.message);
      if (result.ok) setReason('');
    } catch (error) {
      setNotice(`Inventory adjustment could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
    }
  }

  return (
    <section className="scenario-workspace">
      <PanelHeader eyebrow="BLOOD BANK COORDINATION" title="Blood & blood product availability" description="Review the demo inventory by blood group and component. Confirm compatibility and live stock with the blood bank before coordination." icon={Droplets} />
      <div className="scenario-metrics">
        <SummaryMetric label="Product units" value={String(totalUnits)} note="Across listed components" tone="blue" />
        <SummaryMetric label="Available listings" value={`${availableTypes} / ${products.length}`} note="With units on hand" tone="mint" />
        <SummaryMetric label="Stock feed" value="Demo" note="Not connected to a live blood bank" tone="gold" />
      </div>
      <section className="workflow-panel full-panel">
        <SectionTitle label="SYNTHETIC INVENTORY" title="Blood products on hand" trailing={`${products.length} listings`} />
        <div className="table-scroll"><table className="workflow-table"><thead><tr><th>Blood group</th><th>Component</th><th>Units</th><th>Updated</th><th>Status</th></tr></thead><tbody>
          {products.map((product) => <tr key={product.id}>
            <td><strong>{product.group}</strong></td><td>{product.component}</td><td>{product.units}</td><td>{product.updatedAt ? new Date(product.updatedAt).toLocaleString() : product.updated ?? 'Seeded demo value'}</td>
            <td><StateTag tone={product.units > 0 ? 'confirmed' : 'maintenance'}>{product.units > 0 ? 'Listed' : 'No units listed'}</StateTag></td>
          </tr>)}
        </tbody></table></div>
        <form className="workflow-form" onSubmit={recordAdjustment}>
          <div className="panel-heading"><div><p className="panel-kicker">INVENTORY CONTROL</p><h3>Record receipt or adjustment</h3></div></div>
          <div className="form-pair">
            <label>Blood product<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.group} · {product.component}</option>)}</select></label>
            <label>Quantity change<input type="number" step={1} value={delta} onChange={(event) => setDelta(Number(event.target.value))} required /><small>Use positive quantities for receipts; negative quantities for corrections.</small></label>
          </div>
          <label>Operational reason<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={120} required /></label>
          {notice && <p role="status">{notice}</p>}
          <button className="btn btn-primary" type="submit"><Plus size={16} /> Save adjustment</button>
        </form>
        <div className="workflow-panel">
          <SectionTitle label="ACTIVITY" title="Recent inventory adjustments" trailing={`${events.length} events`} />
          {events.length ? <ol className="occupancy-event-list">{events.slice(0, 10).map((activity) => <li key={activity.id}><span className="event-dot" /><div><strong>{activity.productLabel} · {activity.delta > 0 ? '+' : ''}{activity.delta}</strong><small>{activity.reason} · {new Date(activity.at).toLocaleString()}</small></div></li>)}</ol> : <p className="scenario-empty">No blood product adjustments have been recorded.</p>}
        </div>
        <div className="panel-footnote"><ShieldAlert size={15} /> Demo inventory only; verify compatibility, crossmatch, product status, and current quantities with authorized blood bank staff.</div>
      </section>
    </section>
  );
}

type AmbulanceStatus = 'Inbound' | 'Arrived' | 'Handover complete';
type IncomingAmbulance = { id: string; origin: string; eta: string; destination: string; status: AmbulanceStatus; statusUpdatedAt?: string };
const initialIncomingAmbulances: IncomingAmbulance[] = [
  { id: 'AMB-204', origin: 'North district', eta: '8 min', destination: 'Emergency bay 1', status: 'Inbound' },
  { id: 'AMB-207', origin: 'Central highway', eta: '15 min', destination: 'Trauma bay 2', status: 'Inbound' },
  { id: 'AMB-198', origin: 'East clinic', eta: 'Arrived', destination: 'Emergency bay 3', status: 'Arrived' },
];
const ambulanceTransitions: Record<AmbulanceStatus, { label: string; next: AmbulanceStatus }> = {
  Inbound: { label: 'Mark arrived', next: 'Arrived' },
  Arrived: { label: 'Complete handover', next: 'Handover complete' },
  'Handover complete': { label: 'Handover complete', next: 'Handover complete' },
};

export function AmbulanceWorkspace() {
  const [arrivals, , mutateArrivals] = useLocalRecords<IncomingAmbulance[]>('hospital-flow-ambulance-arrivals-v1', () => initialIncomingAmbulances);
  const [notice, setNotice] = useState('');
  const inbound = arrivals.filter((arrival) => arrival.status === 'Inbound').length;
  const arrived = arrivals.filter((arrival) => arrival.status === 'Arrived').length;

  async function advanceArrival(id: string) {
    const at = currentTimestamp();
    try {
      const updated = await mutateArrivals((current) => {
        const arrival = current.find((item) => item.id === id);
        if (!arrival) return { next: current, result: false, write: false };
        const nextStatus = ambulanceTransitions[arrival.status].next;
        if (!canTransitionAmbulance(arrival.status, nextStatus)) return { next: current, result: false, write: false };
        return {
          next: current.map((item) => item.id === id
            ? { ...item, status: nextStatus, eta: nextStatus === 'Arrived' ? 'Arrived' : item.eta, statusUpdatedAt: at }
            : item),
          result: true,
        };
      });
      setNotice(updated ? 'Synthetic arrival status updated.' : 'This arrival has already completed its handover.');
    } catch (error) {
      setNotice(`Arrival status could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
    }
  }

  return (
    <section className="scenario-workspace">
      <PanelHeader eyebrow="EMERGENCY TRANSPORT" title="Ambulance & incoming emergency coordination" description="Coordinate synthetic incoming vehicle ETAs, receiving locations, and arrival handovers with the emergency team." icon={Truck} />
      <div className="scenario-metrics">
        <SummaryMetric label="Inbound" value={String(inbound)} note="Vehicles en route" tone={inbound ? 'coral' : 'mint'} />
        <SummaryMetric label="Arrived" value={String(arrived)} note="Awaiting handover" tone="gold" />
        <SummaryMetric label="Tracked" value={String(arrivals.length)} note="Demo arrival entries" tone="blue" />
      </div>
      <section className="workflow-panel full-panel">
        <SectionTitle label="INCOMING COORDINATION" title="Expected emergency arrivals" trailing={`${inbound} inbound`} />
        <div className="table-scroll"><table className="workflow-table"><thead><tr><th>Vehicle</th><th>Origin</th><th>ETA / status</th><th>Receiving location</th><th>Coordination status</th><th>Action</th></tr></thead><tbody>
          {arrivals.map((arrival) => {
            const complete = arrival.status === 'Handover complete';
            return <tr key={arrival.id}>
              <td><strong>{arrival.id}</strong></td><td>{arrival.origin}</td><td>{arrival.eta}{arrival.statusUpdatedAt && <small> · Updated {new Date(arrival.statusUpdatedAt).toLocaleString()}</small>}</td><td>{arrival.destination}</td>
              <td><StateTag tone={complete ? 'confirmed' : arrival.status === 'Arrived' ? 'maintenance' : 'neutral'}>{arrival.status}</StateTag></td>
              <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => void advanceArrival(arrival.id)} disabled={complete}>{complete ? <Check size={14} /> : <Clock3 size={14} />}{ambulanceTransitions[arrival.status].label}</button></td>
            </tr>;
          })}
        </tbody></table></div>
        {notice && <p role="status">{notice}</p>}
        <div className="panel-footnote"><BellRing size={15} /> Synthetic coordination board; use dispatch radio and hospital procedures for real-time arrivals and clinical handover.</div>
      </section>
    </section>
  );
}

type IsolationStatus = 'Available' | 'Occupied' | 'Cleaning';
type IsolationRoom = { id: string; room: string; isolationType: string; status: IsolationStatus; statusUpdatedAt?: string };
const initialIsolationRooms: IsolationRoom[] = [
  { id: 'ISO-01', room: 'Isolation room 01', isolationType: 'Negative pressure', status: 'Available' },
  { id: 'ISO-02', room: 'Isolation room 02', isolationType: 'Single room', status: 'Occupied' },
  { id: 'ISO-03', room: 'Isolation room 03', isolationType: 'Negative pressure', status: 'Cleaning' },
  { id: 'ISO-04', room: 'Isolation room 04', isolationType: 'Single room', status: 'Available' },
];
const isolationTransitions: Record<IsolationStatus, { label: string; next: IsolationStatus }> = {
  Available: { label: 'Mark occupied', next: 'Occupied' },
  Occupied: { label: 'Send to cleaning', next: 'Cleaning' },
  Cleaning: { label: 'Mark ready', next: 'Available' },
};

export function InfectionControlWorkspace() {
  const [rooms, , mutateRooms] = useLocalRecords<IsolationRoom[]>('hospital-flow-isolation-rooms-v1', () => initialIsolationRooms);
  const [notice, setNotice] = useState('');
  const available = rooms.filter((room) => room.status === 'Available').length;
  const occupied = rooms.filter((room) => room.status === 'Occupied').length;
  const cleaning = rooms.filter((room) => room.status === 'Cleaning').length;

  async function advanceRoom(id: string) {
    const at = currentTimestamp();
    try {
      const updated = await mutateRooms((current) => {
        const room = current.find((item) => item.id === id);
        if (!room) return { next: current, result: false, write: false };
        const nextStatus = isolationTransitions[room.status].next;
        if (!canTransitionIsolation(room.status, nextStatus)) return { next: current, result: false, write: false };
        return {
          next: current.map((item) => item.id === id ? { ...item, status: nextStatus, statusUpdatedAt: at } : item),
          result: true,
        };
      });
      setNotice(updated ? 'Synthetic isolation-room status updated.' : 'This room status transition is no longer available.');
    } catch (error) {
      setNotice(`Room status could not be saved: ${error instanceof Error ? error.message : 'Unexpected data error.'}`);
    }
  }

  return (
    <section className="scenario-workspace">
      <PanelHeader eyebrow="INFECTION CONTROL" title="Isolation & bed availability" description="Review isolation-room readiness and cleaning status for operational coordination." icon={Biohazard} />
      <div className="scenario-metrics">
        <SummaryMetric label="Available" value={String(available)} note="Ready isolation rooms" tone="mint" />
        <SummaryMetric label="Occupied" value={String(occupied)} note="Currently in use" tone="coral" />
        <SummaryMetric label="Cleaning" value={String(cleaning)} note="Not yet available" tone="gold" />
      </div>
      <section className="workflow-panel full-panel">
        <SectionTitle label="ISOLATION CAPACITY" title="Room status" trailing={`${available} of ${rooms.length} available`} />
        <div className="table-scroll"><table className="workflow-table"><thead><tr><th>Room</th><th>Room type</th><th>Availability</th><th>Action</th></tr></thead><tbody>
          {rooms.map((room) => <tr key={room.id}>
            <td><strong>{room.room}</strong> <small>· {room.id}</small></td><td>{room.isolationType}</td>
            <td><StateTag tone={room.status === 'Available' ? 'confirmed' : room.status === 'Cleaning' ? 'maintenance' : 'neutral'}>{room.status}</StateTag>{room.statusUpdatedAt && <small> · Updated {new Date(room.statusUpdatedAt).toLocaleString()}</small>}</td>
            <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => void advanceRoom(room.id)}><Bed size={14} /> {isolationTransitions[room.status].label}</button></td>
          </tr>)}
        </tbody></table></div>
        {notice && <p role="status">{notice}</p>}
        <div className="panel-footnote"><ShieldAlert size={15} /> Demo room states only. Follow current infection-prevention guidance and local isolation, PPE, and terminal-cleaning protocols.</div>
      </section>
    </section>
  );
}
