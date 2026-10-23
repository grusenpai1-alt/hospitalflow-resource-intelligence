import React, { useState } from 'react';
import { useHospitalFlow } from '../context/HospitalFlowContext';
import type { TurnaroundPriority } from '../types';
import { generateCaseRef } from '../services/storage';
import { PlusCircle, ShieldAlert, X, RefreshCw, Bed } from 'lucide-react';

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_WARDS = [
  'Ward 4B (Stepdown ICU)',
  'Ward 2A (Surgical Post-Op)',
  'Ward 3 (General Medical)',
  'Ward 1 (Day Care & Dialysis)',
  'Ward 5 (Paediatrics)',
  'ICU - Coronary Care',
];

const BED_TYPES = [
  'Standard Fowler Bed',
  'Motorised Electric Bed',
  'ICU Multi-Para Bed',
  'Day Care Recliner Bed',
  'Negative Pressure Isolation Bed',
];

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ isOpen, onClose }) => {
  const { createCase, isProcessing } = useHospitalFlow();

  const [previewRef, setPreviewRef] = useState(generateCaseRef());
  const [ward, setWard] = useState(COMMON_WARDS[0]);
  const [customWard, setCustomWard] = useState('');
  const [room, setRoom] = useState('Room 305');
  const [bed, setBed] = useState('Bed 1');
  const [bedType, setBedType] = useState(BED_TYPES[0]);
  const [priority, setPriority] = useState<TurnaroundPriority>('NORMAL');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReRollRef = () => {
    setPreviewRef(generateCaseRef());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const finalWard = ward === 'CUSTOM' ? customWard.trim() : ward;
    if (!finalWard) {
      setValidationError('Please select or specify an operational ward label.');
      return;
    }
    if (!room.trim()) {
      setValidationError('Please specify a room label (e.g. Room 402).');
      return;
    }
    if (!bed.trim()) {
      setValidationError('Please specify a bed label (e.g. Bed 1).');
      return;
    }

    const created = await createCase({
      ward: finalWard,
      room: room.trim(),
      bed: bed.trim(),
      bedType,
      priority,
    });

    if (created) onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="icon-badge-teal">
              <PlusCircle className="modal-icon" />
            </div>
            <div>
              <h3 id="create-title" className="modal-title">
                Create Room Readiness Case
              </h3>
              <p className="modal-subtitle">
                Operational coordinate for physical bed sanitisation and turnover
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Operational Boundary Banner */}
        <div className="modal-pii-alert" role="alert">
          <ShieldAlert className="alert-shield-icon" />
          <div className="alert-body">
            <strong>Strict Operational Data Boundary:</strong>
            <p>
              Use synthetic demo information only. Never enter patient or staff identifiers, ABHA IDs,
              clinical diagnoses, or insurance member codes. This browser-only prototype is not approved
              for real patient data.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {validationError && (
            <div className="form-error-banner" role="alert">
              {validationError}
            </div>
          )}

          {/* Synthetic Reference */}
          <div className="form-group">
            <div className="label-with-action">
              <label className="form-label">Operational Case Reference</label>
              <button
                type="button"
                className="btn-inline-action"
                onClick={handleReRollRef}
                title="Generate another random reference"
              >
                <RefreshCw size={13} />
                <span>Re-roll Ref</span>
              </button>
            </div>
            <div className="readonly-ref-box">
              <span className="ref-code">{previewRef}</span>
              <span className="ref-hint">Random synthetic identifier</span>
            </div>
          </div>

          {/* Ward Selection */}
          <div className="form-group">
            <label htmlFor="ward-select" className="form-label">
              Hospital Ward / Unit *
            </label>
            <select
              id="ward-select"
              className="form-select"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
            >
              {COMMON_WARDS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
              <option value="CUSTOM">Custom Ward...</option>
            </select>
          </div>

          {ward === 'CUSTOM' && (
            <div className="form-group">
              <label htmlFor="custom-ward" className="form-label">
                Custom Ward Label *
              </label>
              <input
                id="custom-ward"
                type="text"
                className="form-input"
                placeholder="e.g. Ward 6A (Post-Surgical)"
                value={customWard}
                onChange={(e) => setCustomWard(e.target.value)}
                required
              />
            </div>
          )}

          {/* Room and Bed Row */}
          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="room-input" className="form-label">
                Room Label *
              </label>
              <input
                id="room-input"
                type="text"
                className="form-input"
                placeholder="e.g. Room 304"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="bed-input" className="form-label">
                Bed Label *
              </label>
              <input
                id="bed-input"
                type="text"
                className="form-input"
                placeholder="e.g. Bed 1, Bed B"
                value={bed}
                onChange={(e) => setBed(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Bed Type and Priority Row */}
          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="bed-type-select" className="form-label">
                Bed Fixture Type
              </label>
              <select
                id="bed-type-select"
                className="form-select"
                value={bedType}
                onChange={(e) => setBedType(e.target.value)}
              >
                {BED_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority-select" className="form-label">
                Turnaround Priority
              </label>
              <select
                id="priority-select"
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TurnaroundPriority)}
              >
                <option value="NORMAL">Normal Turnaround</option>
                <option value="URGENT">Urgent (Upcoming Admission)</option>
                <option value="HIGH_TURNOVER">High Turnover Ward Target</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isProcessing}
            >
              <Bed className="btn-icon" />
              <span>Create Turnaround Case</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
