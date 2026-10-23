import { createContext, useContext, type ReactNode } from 'react';

export type FacilityRole =
  | 'admin'
  | 'coordinator'
  | 'operations'
  | 'nurse'
  | 'housekeeping'
  | 'lab'
  | 'resource_manager'
  | 'pharmacy'
  | 'clinical'
  | 'blood_bank'
  | 'ambulance'
  | 'infection_control'
  | 'viewer';

type FacilityProfile = { facilityId: string; facilityName: string; role: FacilityRole; isLocalDemo: true };
type SessionState = { profile: FacilityProfile };

const DemoSessionContext = createContext<SessionState | null>(null);
const localDemoProfile: FacilityProfile = {
  facilityId: 'browser-demo',
  facilityName: 'Local Browser Demo',
  role: 'admin',
  isLocalDemo: true,
};

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  return (
    <DemoSessionContext.Provider value={{ profile: localDemoProfile }}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSession() {
  const context = useContext(DemoSessionContext);
  if (!context) throw new Error('useDemoSession must be used within DemoSessionProvider.');
  return context;
}
