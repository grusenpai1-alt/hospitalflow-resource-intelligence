export type ScenarioRoute =
  | 'home'
  | 'not-found'
  | 'labs'
  | 'equipment'
  | 'beds'
  | 'occupancy'
  | 'camps'
  | 'pharmacy'
  | 'trauma'
  | 'clinicians'
  | 'staff'
  | 'alerts'
  | 'blood-bank'
  | 'ambulance'
  | 'infection-control';

const scenarioRoutes = new Set<ScenarioRoute>([
  'labs',
  'equipment',
  'beds',
  'occupancy',
  'camps',
  'pharmacy',
  'trauma',
  'clinicians',
  'staff',
  'alerts',
  'blood-bank',
  'ambulance',
  'infection-control',
]);

export function getScenarioRoute(pathname: string): ScenarioRoute {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return 'home';
  if (parts.length !== 1) return 'not-found';
  const route = parts[0] as ScenarioRoute;
  return scenarioRoutes.has(route) ? route : 'not-found';
}
