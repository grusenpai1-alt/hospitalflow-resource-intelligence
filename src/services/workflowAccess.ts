import type { FacilityRole } from '../context/DemoSessionContext';
import type { ScenarioRoute } from './scenarioRouting';

const workflowRoles: Record<string, readonly FacilityRole[]> = {
  'bed-turnaround-cases-v1': ['admin', 'coordinator'],
  'workflow-settings-v1': ['admin', 'coordinator'],
  'hospital-flow-lab-reservations-v1': ['admin', 'coordinator', 'lab', 'resource_manager'],
  'hospital-flow-equipment-bookings-v1': ['admin', 'coordinator', 'operations', 'resource_manager', 'clinical', 'housekeeping'],
  'hospital-flow-camp-allocations-v1': ['admin', 'coordinator', 'operations', 'resource_manager'],
  'hospital-flow-pharmacy-v1': ['admin', 'coordinator', 'pharmacy'],
  'hospital-flow-trauma-bays-v1': ['admin', 'coordinator', 'operations', 'clinical'],
  'hospital-flow-clinicians-v1': ['admin', 'coordinator', 'clinical', 'resource_manager'],
  'hospital-flow-staff-coverage-v1': ['admin', 'coordinator', 'operations', 'resource_manager'],
  'hospital-flow-alerts-v1': [
    'admin', 'coordinator', 'operations', 'nurse', 'housekeeping', 'lab',
    'resource_manager', 'pharmacy', 'clinical', 'blood_bank', 'ambulance',
    'infection_control',
  ],
  'hospital-flow-blood-bank-v1': ['admin', 'coordinator', 'blood_bank', 'clinical'],
  'hospital-flow-ambulance-arrivals-v1': ['admin', 'coordinator', 'ambulance', 'operations'],
  'hospital-flow-isolation-rooms-v1': ['admin', 'coordinator', 'infection_control', 'clinical'],
  'bed-occupancy-board-v1': ['admin', 'coordinator'],
};

const scenarioWorkflowIds: Partial<Record<ScenarioRoute, string>> = {
  beds: 'bed-turnaround-cases-v1',
  labs: 'hospital-flow-lab-reservations-v1',
  equipment: 'hospital-flow-equipment-bookings-v1',
  occupancy: 'bed-occupancy-board-v1',
  camps: 'hospital-flow-camp-allocations-v1',
  pharmacy: 'hospital-flow-pharmacy-v1',
  trauma: 'hospital-flow-trauma-bays-v1',
  clinicians: 'hospital-flow-clinicians-v1',
  staff: 'hospital-flow-staff-coverage-v1',
  alerts: 'hospital-flow-alerts-v1',
  'blood-bank': 'hospital-flow-blood-bank-v1',
  ambulance: 'hospital-flow-ambulance-arrivals-v1',
  'infection-control': 'hospital-flow-isolation-rooms-v1',
};

export function canWriteWorkflowAsRole(workflowId: string, role: FacilityRole | undefined): boolean {
  return !!role && (workflowRoles[workflowId]?.includes(role) ?? false);
}

export function canManageBedWorkflows(role: FacilityRole | undefined): boolean {
  return role === 'admin' || role === 'coordinator';
}

export function canAccessScenarioRoute(route: ScenarioRoute, role: FacilityRole | undefined): boolean {
  if (route === 'home' || route === 'not-found') return true;
  const workflowId = scenarioWorkflowIds[route];
  return !!workflowId && canWriteWorkflowAsRole(workflowId, role);
}
