import React from 'react';
import { useHospitalFlow } from '../context/HospitalFlowContext';
import {
  Bed,
  ShieldAlert,
  Clock,
  Settings,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { useDemoSession } from '../context/DemoSessionContext';
import { canManageBedWorkflows } from '../services/workflowAccess';

interface HeaderProps {
  showBedActions: boolean;
  onOpenCreate: () => void;
  onOpenSimulation: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  showBedActions,
  onOpenCreate,
  onOpenSimulation,
  onOpenSettings,
}) => {
  const { storageSummary, resetToInitialDemoData, isProcessing } = useHospitalFlow();
  const { profile } = useDemoSession();
  const canManageBeds = canManageBedWorkflows(profile?.role);
  const canManageSettings = !!profile && ['admin', 'coordinator'].includes(profile.role);
  const isAdmin = profile?.role === 'admin';

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Brand / Logo */}
        <div className="header-brand">
          <div className="brand-icon-box" aria-hidden="true">
            <Bed className="brand-icon" />
          </div>
          <div className="brand-text">
            <div className="brand-title-row">
              <h1 className="brand-title">HospitalFlow</h1>
              <span className="demo-badge">{profile?.isLocalDemo ? 'LOCAL BROWSER DEMO' : 'SYNTHETIC DEMO'}</span>
            </div>
            <p className="brand-subtitle">
              Hospital Resource Coordination • India Prototype
            </p>
          </div>
        </div>

        {/* Operational Safeguard Banner */}
        <div className="pii-guard-pill" title="Demo data is stored only in this browser. Use synthetic data only.">
          <ShieldAlert className="guard-icon" />
          <span className="guard-text">Local Browser Data • Synthetic Only • Not Shared</span>
        </div>

        {/* Global Action Buttons */}
        <div className="header-actions">
          {showBedActions && canManageBeds && <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenCreate}
              aria-label="Create New Room Readiness Case"
            >
              <PlusCircle className="btn-icon" />
              <span>Create Case</span>
            </button>

            {isAdmin && !profile?.isLocalDemo && <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenSimulation}
              title="Demo Time Travel and Storage Diagnostics"
              aria-label="Simulation & Storage Controls"
            >
              <Clock className="btn-icon" />
              <span className="hide-on-mobile">Demo Controls</span>
              <span className="badge-count" title={`${storageSummary.totalPhotos} facility photos in Firebase Storage`}>
                {storageSummary.totalPhotos} Cloud
              </span>
            </button>}

            {canManageSettings && <button
              type="button"
              className="btn btn-ghost"
              onClick={onOpenSettings}
              title="Configure Retention & Handoff Settings"
              aria-label="Workflow Settings"
            >
              <Settings className="btn-icon" />
              <span className="hide-on-tablet">Settings</span>
            </button>}

            {isAdmin && <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (window.confirm('Reset the local synthetic bed-turnaround demo data in this browser?')) {
                  resetToInitialDemoData();
                }
              }}
              disabled={isProcessing}
              title="Reset local synthetic bed-turnaround demo data"
              aria-label="Reset bed turnaround demo data"
            >
              <RefreshCw className={`btn-icon ${isProcessing ? 'spin' : ''}`} />
              <span className="hide-on-tablet">Reset</span>
            </button>}
          </>}
        </div>
      </div>
    </header>
  );
};
