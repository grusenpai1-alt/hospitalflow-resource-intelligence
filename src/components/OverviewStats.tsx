import React from 'react';
import { useHospitalFlow } from '../context/HospitalFlowContext';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';

export const OverviewStats: React.FC = () => {
  const { cases } = useHospitalFlow();

  const activeCases = cases.filter(
    (c) => c.status === 'HANDOFFS_PENDING' || c.status === 'CLEANING_IN_PROGRESS' || c.status === 'REJECTED_RECLEAN'
  ).length;

  const awaitingReview = cases.filter((c) => c.status === 'AWAITING_REVIEW').length;
  const bedsReady = cases.filter((c) => c.status === 'BED_READY').length;
  return (
    <div className="stats-grid" role="region" aria-label="Operational Turnaround Summary">
      {/* 1. Active Workflow Cases */}
      <div className="stat-card">
        <div className="stat-icon-wrapper blue">
          <Activity className="stat-icon" />
        </div>
        <div className="stat-content">
          <span className="stat-label">Active Flow Cases</span>
          <div className="stat-value-row">
            <span className="stat-number">{activeCases}</span>
            <span className="stat-subtext">Handoffs & Cleaning</span>
          </div>
        </div>
      </div>

      {/* 2. Awaiting Coordinator Approval */}
      <div className={`stat-card ${awaitingReview > 0 ? 'highlight-amber' : ''}`}>
        <div className="stat-icon-wrapper amber">
          <AlertCircle className="stat-icon" />
        </div>
        <div className="stat-content">
          <div className="stat-label-row">
            <span className="stat-label">Awaiting Photo Review</span>
            {awaitingReview > 0 && <span className="action-tag">Action Needed</span>}
          </div>
          <div className="stat-value-row">
            <span className="stat-number amber-text">{awaitingReview}</span>
            <span className="stat-subtext">Coordinator approval queue</span>
          </div>
        </div>
      </div>

      {/* 3. Bed Ready */}
      <div className="stat-card">
        <div className="stat-icon-wrapper green">
          <CheckCircle2 className="stat-icon" />
        </div>
        <div className="stat-content">
          <span className="stat-label">Approved Beds Ready</span>
          <div className="stat-value-row">
            <span className="stat-number green-text">{bedsReady}</span>
            <span className="stat-subtext">Turnaround complete</span>
          </div>
        </div>
      </div>

      {/* 4. Photo Retention & Purges */}
      <div className="stat-card">
        <div className="stat-icon-wrapper teal">
          <HardDrive className="stat-icon" />
        </div>
        <div className="stat-content">
          <div className="stat-label-row">
            <span className="stat-label">Photo Evidence</span>
            <span className="retention-rule-pill">Local demo</span>
          </div>
          <div className="stat-value-row">
            <span className="stat-number">Unavailable</span>
            <span className="stat-subtext">
              Photo uploads and cloud retention are disabled
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
