import React, { useState } from 'react';
import { HospitalFlowProvider, useHospitalFlow } from './context/HospitalFlowContext';
import { FacilityDataStatusProvider, useFacilityDataStatus } from './context/FacilityDataContext';
import { FirebaseSessionProvider } from './context/FirebaseSessionContext';
import { FirebaseGate } from './components/FirebaseGate';
import { Header } from './components/Header';
import { OverviewStats } from './components/OverviewStats';
import { CaseList } from './components/CaseList';
import { CaseDetail } from './components/CaseDetail';
import { CreateCaseModal } from './components/CreateCaseModal';
import { SimulationControlsModal } from './components/SimulationControlsModal';
import { SettingsModal } from './components/SettingsModal';
import {
  ScenarioNavigation,
  ScenarioWorkspace,
} from './components/ScenarioWorkspace';
import { getScenarioRoute } from './services/scenarioRouting';
import {
  Bed,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  ArrowLeft,
  Shield,
} from 'lucide-react';

const HospitalFlowDashboard: React.FC = () => {
  const {
    activeCase,
    setActiveCaseId,
    notification,
    clearNotification,
  } = useHospitalFlow();
  const dataStatus = useFacilityDataStatus();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSimOpen, setIsSimOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'queue' | 'detail'>('queue');
  const route = getScenarioRoute(window.location.pathname);

  const handleSelectCase = (id: string) => {
    setActiveCaseId(id);
    setMobileView('detail');
  };

  return (
    <div className="app-shell">
      {/* Top Operational Navigation */}
      <Header
        showBedActions={route === 'beds'}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenSimulation={() => setIsSimOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Global Toast Notification */}
      {notification && (
        <div className={`notification-toast ${notification.type}`} role="status">
          <div className="toast-content">
            {notification.type === 'success' && <CheckCircle2 className="toast-icon" />}
            {notification.type === 'error' && <AlertCircle className="toast-icon" />}
            {notification.type === 'info' && <Info className="toast-icon" />}
            <span className="toast-message">{notification.message}</span>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={clearNotification}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        <div className="content-container">
          <ScenarioNavigation currentRoute={route} />
          {dataStatus.loading ? (
            <div className="firebase-data-message" role="status">Loading secure facility workflows…</div>
          ) : dataStatus.errors.length > 0 ? (
            <div className="firebase-data-message firebase-data-error" role="alert">
              <strong>Facility data could not be loaded or saved.</strong>
              <p>{dataStatus.errors[0].message}</p>
              <p>Check the Firebase project setup and security rules, then reload. Changes are not stored locally as a fallback.</p>
            </div>
          ) : route === 'beds' ? (
            <>
              <OverviewStats />
              <div className={`operational-workspace mobile-${mobileView}`}>
                <div className="workspace-queue-pane">
                  <CaseList onSelectCase={handleSelectCase} />
                </div>

                <div className="workspace-detail-pane">
                  <div className="mobile-back-bar">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setMobileView('queue')}
                    >
                      <ArrowLeft className="btn-icon" />
                      <span>Back to Bed Queue</span>
                    </button>
                    {activeCase && (
                      <span className="mobile-active-ref">
                        Viewing {activeCase.caseRef} ({activeCase.bed})
                      </span>
                    )}
                  </div>

                  {activeCase ? (
                    <CaseDetail key={activeCase.id} caseData={activeCase} />
                  ) : (
                    <div className="no-case-selected-card">
                      <div className="no-case-icon-box">
                        <Bed size={40} />
                      </div>
                      <h3>No Turnaround Case Selected</h3>
                      <p>
                        Select an operational bed case from the queue on the left, or create a new case to
                        begin the turnaround workflow.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setIsCreateOpen(true)}
                      >
                        + Create New Case
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <ScenarioWorkspace route={route} />
          )}
            </div>
      </main>

      {/* Operational Footer */}
      <footer className="app-footer">
        <div className="footer-container">
          <div className="footer-left">
            <span className="footer-brand">HospitalFlow Prototype v1.0</span>
            <span className="footer-divider">•</span>
            <span>Hospital Resource Coordination</span>
            <span className="footer-divider">•</span>
            <span className="footer-tag">India Operational Concept</span>
          </div>
          <div className="footer-right">
            <Shield className="footer-shield" />
            <span>
              Synthetic Data Only • No Real Patient / ABHA Data • Facility-Scoped Firebase
            </span>
          </div>
        </div>
      </footer>

      {/* Dialog Modals */}
      {route === 'beds' && (
        <>
          <CreateCaseModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
          <SimulationControlsModal isOpen={isSimOpen} onClose={() => setIsSimOpen(false)} />
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
      )}
    </div>
  );
};

export function App() {
  return (
    <FirebaseSessionProvider>
      <FirebaseGate>
        <FacilityDataStatusProvider>
          <HospitalFlowProvider>
            <HospitalFlowDashboard />
          </HospitalFlowProvider>
        </FacilityDataStatusProvider>
      </FirebaseGate>
    </FirebaseSessionProvider>
  );
}

export default App;
