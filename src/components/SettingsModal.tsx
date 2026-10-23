import React, { useState } from 'react';
import { useHospitalFlow } from '../context/HospitalFlowContext';
import { Settings, X, Save, ShieldCheck } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useHospitalFlow();

  const [billingOptional, setBillingOptional] = useState(settings.billingOptional);
  const [pendingDays, setPendingDays] = useState(settings.pendingPhotoExpiryDays);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      billingOptional,
      pendingPhotoExpiryDays: Number(pendingDays) || 7,
      approvedPhotoRetentionHours: 48,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="icon-badge-neutral">
              <Settings className="modal-icon" />
            </div>
            <div>
              <h3 id="settings-title" className="modal-title">
                Workflow & Retention Settings
              </h3>
              <p className="modal-subtitle">
                Configure operational prototype parameters and retention rules
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-form">
          <div className="settings-stack">
            {/* Setting 1: Billing Optional */}
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Make Billing / TPA Handoff Optional</span>
                <p className="setting-desc">
                  When enabled, Room Departure can be confirmed even if Billing / TPA clearance has not
                  been marked complete (treats billing as a non-blocking operational placeholder).
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={billingOptional}
                  onChange={(e) => setBillingOptional(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Approved retention is a fixed product policy. */}
            <div className="setting-row-input">
              <div className="setting-info">
                <span className="setting-label">Approved Photo Retention</span>
                <p className="setting-desc">
                  Approved bed photos are scheduled for deletion 48 hours after Coordinator approval.
                  This retention period is fixed for the prototype.
                </p>
              </div>
              <div className="setting-input-wrapper">
                <strong className="unit-label">48 hours</strong>
              </div>
            </div>

            {/* Setting 3: Pending Review Photo Expiry */}
            <div className="setting-row-input">
              <div className="setting-info">
                <span className="setting-label">Pending-Review Photo Expiry (Days)</span>
                <p className="setting-desc">
                  Time in days before an unreviewed housekeeping photo expires and requires a new capture.
                  Default is 7 days.
                </p>
              </div>
              <div className="setting-input-wrapper">
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="form-input number-input"
                  value={pendingDays}
                  onChange={(e) => setPendingDays(Number(e.target.value))}
                />
                <span className="unit-label">days</span>
              </div>
            </div>
          </div>

          <div className="privacy-compliance-box">
            <ShieldCheck className="box-icon" />
            <div>
              <strong>Prototype Retention Assumption</strong>
              <p>
                In a production cloud environment, scheduled Object Lifecycle Management (e.g. S3
                Lifecycle rules or Cloud Storage auto-delete) enforces server-side deletion. In this
                client prototype, the signed-in app checks the configured retention timestamps. A production deployment should add a server-side scheduled cleanup and monitor its results.
              </p>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save className="btn-icon" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
