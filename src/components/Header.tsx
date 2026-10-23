import React from 'react';
import { useHospitalFlow } from '../context/HospitalFlowContext';
import {
  Bed,
  ShieldAlert,
  Clock,
  Settings,
  PlusCircle,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { useFirebaseSession } from '../context/FirebaseSessionContext';
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
  const { profile, signOutUser } = useFirebaseSession();
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
              <span className="demo-badge">SYNTHETIC DEMO</span>
            </div>
            <p className="brand-subtitle">
              Hospital Resource Coordination • India Prototype
            </p>
          </div>
        </div>

        {/* Operational Safeguard Banner */}
        <div className="pii-guard-pill" title="Synthetic demo only. Do not enter real patient or staff data or upload real photos.">
          <ShieldAlert className="guard-icon" />
          <span className="guard-text">Synthetic Demo Only • No Real Patient Data</span>
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

            {isAdmin && <button
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
                if (window.confirm('Reset the synthetic bed-turnaround cases and photos for this facility?')) {
                  resetToInitialDemoData();
                }
              }}
              disabled={isProcessing}
              title="Reset synthetic bed-turnaround cases and photos"
              aria-label="Reset bed turnaround demo data"
            >
              <RefreshCw className={`btn-icon ${isProcessing ? 'spin' : ''}`} />
              <span className="hide-on-tablet">Reset</span>
            </button>}
          </>}
          <button type="button" className="btn btn-ghost" onClick={() => void signOutUser()} aria-label="Sign out">
            <LogOut className="btn-icon" />
            <span className="hide-on-tablet">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
