import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useFacilityData } from './FacilityDataContext';
import { useFirebaseSession } from './FirebaseSessionContext';
import type {
  HospitalCase,
  CaseStatus,
  WorkflowSettings,
  TurnaroundPriority,
  RejectionReasonCategory,
  EventLog,
} from '../types';
import { cloudPhotoStorage } from '../services/cloudPhotoStorage';
import {
  DEFAULT_SETTINGS,
  getInitialSyntheticCases,
  generateCaseRef,
  generateSyntheticBedPhotoBlob,
} from '../services/storage';
import { canApproveBedPhoto, canRejectBedPhoto } from '../services/workflowRules';
import { canManageBedWorkflows } from '../services/workflowAccess';

interface HospitalFlowContextType {
  cases: HospitalCase[];
  activeCaseId: string | null;
  activeCase: HospitalCase | null;
  settings: WorkflowSettings;
  storageSummary: {
    totalPhotos: number;
    totalSizeBytes: number;
    pendingCount: number;
    approvedCount: number;
  };
  isProcessing: boolean;
  notification: { type: 'success' | 'error' | 'info'; message: string } | null;
  setActiveCaseId: (id: string | null) => void;
  createCase: (params: {
    ward: string;
    room: string;
    bed: string;
    bedType: string;
    priority: TurnaroundPriority;
  }) => Promise<HospitalCase | null>;
  toggleNursingHandoff: (caseId: string) => Promise<void>;
  toggleBillingHandoff: (caseId: string) => Promise<void>;
  confirmRoomDeparture: (caseId: string) => Promise<void>;
  startCleaning: (caseId: string) => Promise<void>;
  uploadPhoto: (
    caseId: string,
    file: File | Blob,
    mimeType?: string
  ) => Promise<{ success: boolean; error?: string }>;
  approveBedReady: (caseId: string) => Promise<{ success: boolean; error?: string }>;
  rejectBedPhoto: (
    caseId: string,
    reason: RejectionReasonCategory,
    details?: string
  ) => Promise<{ success: boolean; error?: string }>;
  purgePhotoNow: (caseId: string) => Promise<{ success: boolean; error?: string }>;
  simulateTimeFastForward: (hours: number) => Promise<{ purgedCount: number; error?: string }>;
  updateSettings: (newSettings: Partial<WorkflowSettings>) => void;
  resetToInitialDemoData: () => Promise<void>;
  refreshStorageSummary: () => Promise<void>;
  clearNotification: () => void;
}

const HospitalFlowContext = createContext<HospitalFlowContextType | undefined>(undefined);

export const HospitalFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useFirebaseSession();
  const [cases, , mutateCases] = useFacilityData<HospitalCase[]>('bed-turnaround-cases-v1', getInitialSyntheticCases);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [settings, setSettings] = useFacilityData<WorkflowSettings>('workflow-settings-v1', () => DEFAULT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [storageSummary, setStorageSummary] = useState({
    totalPhotos: 0,
    totalSizeBytes: 0,
    pendingCount: 0,
    approvedCount: 0,
  });
  const syntheticPhotoSeedInProgress = useRef(new Set<string>());

  const showNotification = useCallback(
    (type: 'success' | 'error' | 'info', message: string) => {
      setNotification({ type, message });
    },
    []
  );

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const refreshStorageSummary = useCallback(async () => {
    if (!profile?.facilityId) return;
    try {
      const summary = await cloudPhotoStorage.getStorageSummary(profile.facilityId);
      setStorageSummary(summary);
    } catch (error) {
      showNotification('error', `Could not load photo storage summary: ${error instanceof Error ? error.message : 'Firebase Storage error.'}`);
    }
  }, [profile?.facilityId, showNotification]);

  // Resolve only after the facility-scoped Firestore transaction commits.
  const updateCases = useCallback(
    async (updater: (prev: HospitalCase[]) => HospitalCase[]): Promise<boolean> => {
      if (!canManageBedWorkflows(profile?.role)) {
        showNotification('error', 'Bed-case changes are restricted to facility administrators and coordinators.');
        return false;
      }
      try {
        await mutateCases((current) => ({
          next: updater(current),
          result: undefined,
        }));
        return true;
      } catch (error) {
        showNotification(
          'error',
          `Bed workflow could not be saved: ${error instanceof Error ? error.message : 'Firebase data error.'}`
        );
        return false;
      }
    },
    [mutateCases, profile?.role, showNotification]
  );

  // Periodic and on-load auto-purge check
  const runAutoPurge = useCallback(async () => {
    if (!profile?.facilityId || !canManageBedWorkflows(profile.role)) return;
    try {
      const { purgedCaseIds, errors } = await cloudPhotoStorage.purgeExpiredPhotos(profile.facilityId);

      if (errors.length > 0) {
        console.error('[HospitalFlow AutoPurge] Errors occurred during purge:', errors);
        showNotification('error', `Photo retention error: ${errors[0]}`);
      }

      if (purgedCaseIds.length > 0) {
        const saved = await updateCases((prevCases) =>
          prevCases.map((c) => {
            if (!purgedCaseIds.includes(c.id)) return c;
            const isPending = c.status === 'AWAITING_REVIEW';
            const purgeEvt: EventLog = {
              id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              caseRef: c.caseRef,
              timestamp: new Date().toISOString(),
              type: isPending ? 'PHOTO_EXPIRED' : 'PHOTO_PURGED',
              actorLabel: 'Retention Engine (Auto)',
              summary: isPending
                ? 'Pending-review photo expired (7-day prototype limit exceeded). New photo required.'
                : 'Approved photo permanently purged per 48h retention policy. Approval status preserved.',
            };

            return {
              ...c,
              photoPurged: true,
              photoPurgedAt: new Date().toISOString(),
              status: isPending ? 'REJECTED_RECLEAN' as CaseStatus : c.status,
              photoUploaded: isPending ? false : c.photoUploaded,
              events: [purgeEvt, ...c.events],
            };
          })
        );
        if (!saved) return;

        await refreshStorageSummary();
        showNotification(
          'info',
          `Automated retention policy executed: ${purgedCaseIds.length} expired photo(s) deleted from Firebase Storage.`
        );
      }
    } catch (error) {
      showNotification('error', `Photo retention check failed: ${error instanceof Error ? error.message : 'Firebase Storage error.'}`);
    }
  }, [profile?.facilityId, profile?.role, refreshStorageSummary, showNotification, updateCases]);

  // The first facility visit initializes records in Firestore through useFacilityData.
  useEffect(() => {
    if (cases.length > 0) setActiveCaseId((current) => current ?? cases[0].id);
  }, [cases]);

  useEffect(() => {
    if (!profile?.facilityId || !canManageBedWorkflows(profile.role)) return;
    void refreshStorageSummary();
  }, [profile?.facilityId, refreshStorageSummary]);

  useEffect(() => {
    if (!profile?.facilityId) return;
    const candidates = cases.filter((item) =>
      item.id.startsWith('case-synth-') &&
      item.photoUploaded &&
      !item.photoPurged &&
      (item.status === 'AWAITING_REVIEW' || item.status === 'BED_READY')
    );
    for (const item of candidates) {
      if (syntheticPhotoSeedInProgress.current.has(item.id)) continue;
      syntheticPhotoSeedInProgress.current.add(item.id);
      void cloudPhotoStorage.hasPhoto(profile.facilityId, item.id).then(async (exists) => {
        if (exists) return;
        const blob = generateSyntheticBedPhotoBlob(item.caseRef, item.bed);
        const result = await cloudPhotoStorage.savePhoto(
          profile.facilityId,
          item.id,
          blob,
          'image/svg+xml',
          item.photoExpiresAt ?? new Date(Date.now() + 7 * 86400000).toISOString(),
          item.status === 'BED_READY' ? 'approved' : 'pending',
        );
        if (!result.success) throw new Error(result.error ?? 'Could not seed the synthetic demonstration image.');
        await refreshStorageSummary();
      }).catch((error: unknown) => {
        showNotification('error', `Could not initialize synthetic bed photo: ${error instanceof Error ? error.message : 'Firebase Storage error.'}`);
      }).finally(() => {
        syntheticPhotoSeedInProgress.current.delete(item.id);
      });
    }
  }, [cases, profile?.facilityId, profile?.role, refreshStorageSummary, showNotification]);

  // Periodic purge timer
  useEffect(() => {
    const intervalMs = (settings.autoPurgeIntervalSeconds || 30) * 1000;
    const timer = setInterval(() => {
      runAutoPurge();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [settings.autoPurgeIntervalSeconds, runAutoPurge]);

  const activeCase = cases.find((c) => c.id === activeCaseId) || null;

  // 1. Create Case
  const createCase = useCallback(
    async ({
      ward,
      room,
      bed,
      bedType,
      priority,
    }: {
      ward: string;
      room: string;
      bed: string;
      bedType: string;
      priority: TurnaroundPriority;
    }): Promise<HospitalCase | null> => {
      const caseRef = generateCaseRef();
      const nowIso = new Date().toISOString();

      const newEvt: EventLog = {
        id: `evt-${Date.now()}`,
        caseRef,
        timestamp: nowIso,
        type: 'CASE_CREATED',
        actorLabel: 'Operations',
        summary: `Room readiness workflow opened for ${ward}, ${room}, ${bed} (${bedType})`,
      };

      const newCase: HospitalCase = {
        id: `case-${Date.now()}`,
        caseRef,
        ward,
        room,
        bed,
        bedType,
        priority,
        status: 'HANDOFFS_PENDING',
        createdAt: nowIso,
        nursingComplete: false,
        billingComplete: false,
        departureConfirmed: false,
        cleaningStarted: false,
        photoUploaded: false,
        photoPurged: false,
        events: [newEvt],
      };

      const saved = await updateCases((prev) => [newCase, ...prev]);
      if (!saved) return null;
      setActiveCaseId(newCase.id);
      showNotification('success', `Case ${caseRef} created successfully.`);
      return newCase;
    },
    [showNotification, updateCases]
  );

  // 2. Toggle Nursing Handoff
  const toggleNursingHandoff = useCallback(
    async (caseId: string) => {
      const nowIso = new Date().toISOString();
      await updateCases((prev) =>
        prev.map((c) => {
          if (c.id !== caseId) return c;
          const nextState = !c.nursingComplete;
          const evt: EventLog = {
            id: `evt-${Date.now()}`,
            caseRef: c.caseRef,
            timestamp: nowIso,
            type: 'NURSING_HANDOFF',
            actorLabel: 'Nursing',
            summary: nextState
              ? 'Nursing handover confirmed: Clinical charts & medications reconciled'
              : 'Nursing handover checklist marked incomplete',
          };
          return {
            ...c,
            nursingComplete: nextState,
            nursingCompletedAt: nextState ? nowIso : undefined,
            events: [evt, ...c.events],
          };
        })
      );
    },
    [updateCases]
  );

  // 3. Toggle Billing / TPA Handoff
  const toggleBillingHandoff = useCallback(
    async (caseId: string) => {
      const nowIso = new Date().toISOString();
      await updateCases((prev) =>
        prev.map((c) => {
          if (c.id !== caseId) return c;
          const nextState = !c.billingComplete;
          const evt: EventLog = {
            id: `evt-${Date.now()}`,
            caseRef: c.caseRef,
            timestamp: nowIso,
            type: 'BILLING_HANDOFF',
            actorLabel: 'Billing / TPA',
            summary: nextState
              ? 'Interim clearance acknowledged (Operational placeholder / TPA pre-auth check)'
              : 'Billing clearance reset to pending',
          };
          return {
            ...c,
            billingComplete: nextState,
            billingCompletedAt: nextState ? nowIso : undefined,
            events: [evt, ...c.events],
          };
        })
      );
    },
    [updateCases]
  );

  // 4. Confirm Room Departure (Starts Housekeeping)
  const confirmRoomDeparture = useCallback(
    async (caseId: string) => {
      const nowIso = new Date().toISOString();
      const saved = await updateCases((prev) =>
        prev.map((c) => {
          if (c.id !== caseId) return c;
          if (c.departureConfirmed) return c;

          const evt: EventLog = {
            id: `evt-${Date.now()}`,
            caseRef: c.caseRef,
            timestamp: nowIso,
            type: 'ROOM_DEPARTURE',
            actorLabel: 'Operations',
            summary: 'Physical room departure confirmed. Room vacated and released for Housekeeping.',
          };

          return {
            ...c,
            departureConfirmed: true,
            departureConfirmedAt: nowIso,
            status: 'CLEANING_IN_PROGRESS',
            events: [evt, ...c.events],
          };
        })
      );
      if (saved) showNotification('success', 'Room departure confirmed. Housekeeping notified.');
    },
    [showNotification, updateCases]
  );

  // 5. Housekeeping Starts Cleaning
  const startCleaning = useCallback(
    async (caseId: string) => {
      const nowIso = new Date().toISOString();
      await updateCases((prev) =>
        prev.map((c) => {
          if (c.id !== caseId) return c;
          const evt: EventLog = {
            id: `evt-${Date.now()}`,
            caseRef: c.caseRef,
            timestamp: nowIso,
            type: 'CLEANING_STARTED',
            actorLabel: 'Housekeeping',
            summary: 'Terminal cleaning, sanitisation, and linen replacement initiated.',
          };
          return {
            ...c,
            cleaningStarted: true,
            cleaningStartedAt: nowIso,
            status: 'CLEANING_IN_PROGRESS',
            events: [evt, ...c.events],
          };
        })
      );
    },
    [updateCases]
  );

  // 6. Housekeeping Uploads Photo
  const uploadPhoto = useCallback(
    async (
      caseId: string,
      file: File | Blob,
      mimeType: string = 'image/jpeg'
    ): Promise<{ success: boolean; error?: string }> => {
      setIsProcessing(true);
      try {
        if (!profile?.facilityId) throw new Error('No facility photo-storage session is available.');
        if (file instanceof File) {
          const val = cloudPhotoStorage.validateFile(file);
          if (!val.valid) {
            setIsProcessing(false);
            showNotification('error', val.error || 'Invalid photo file');
            return { success: false, error: val.error };
          }
          mimeType = file.type;
        }

        // Compute 7-day pending expiry timestamp
        const expiryDays = settings.pendingPhotoExpiryDays || 7;
        const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
        const nowIso = new Date().toISOString();

        const saveRes = await cloudPhotoStorage.savePhoto(profile.facilityId, caseId, file, mimeType, expiresAt, 'pending');
        if (!saveRes.success) {
          setIsProcessing(false);
          showNotification('error', `Storage Error: ${saveRes.error || 'Failed to write photo'}`);
          return saveRes;
        }

        // Update case state (strictly no photo bytes or URLs stored in case/events!)
        const saved = await updateCases((prev) =>
          prev.map((c) => {
            if (c.id !== caseId) return c;
            const evt: EventLog = {
              id: `evt-${Date.now()}`,
              caseRef: c.caseRef,
              timestamp: nowIso,
              type: 'PHOTO_UPLOADED',
              actorLabel: 'Housekeeping',
              summary: 'Room readiness photo captured & uploaded. Case queued for coordinator review.',
            };
            return {
              ...c,
              photoUploaded: true,
              photoUploadedAt: nowIso,
              photoExpiresAt: expiresAt,
              photoPurged: false,
              photoPurgedAt: undefined,
              status: 'AWAITING_REVIEW',
              events: [evt, ...c.events],
            };
          })
        );
        if (!saved) {
          const cleanup = await cloudPhotoStorage.deletePhoto(profile.facilityId, caseId);
          const message = cleanup.success
            ? 'Case save failed; the uploaded photo was removed from storage.'
            : `Case save failed and uploaded photo cleanup failed: ${cleanup.error ?? 'Storage error.'}`;
          await refreshStorageSummary();
          showNotification('error', message);
          setIsProcessing(false);
          return { success: false, error: message };
        }

        await refreshStorageSummary();
        showNotification('success', 'Photo uploaded. Case is now awaiting coordinator approval.');
        setIsProcessing(false);
        return { success: true };
      } catch (err: unknown) {
        setIsProcessing(false);
        const msg = err instanceof Error ? err.message : 'Unexpected upload failure';
        showNotification('error', msg);
        return { success: false, error: msg };
      }
    },
    [profile?.facilityId, settings.pendingPhotoExpiryDays, showNotification, updateCases, refreshStorageSummary]
  );

  // 7. Coordinator Approves Bed Ready
  const approveBedReady = useCallback(
    async (caseId: string): Promise<{ success: boolean; error?: string }> => {
      const c = cases.find((item) => item.id === caseId);
      if (!c) return { success: false, error: 'Case not found' };

      if (!canApproveBedPhoto(c.status, c.photoUploaded)) {
        showNotification('error', 'Only a bed awaiting coordinator review with an uploaded synthetic photo can be approved.');
        return { success: false, error: 'The case is not ready for photo approval.' };
      }

      setIsProcessing(true);
      try {
        const nowIso = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        if (!profile?.facilityId) throw new Error('No facility photo-storage session is available.');
        const updateRes = await cloudPhotoStorage.updateExpiryAndStatus(profile.facilityId, caseId, expiresAt, 'approved');
        if (!updateRes.success) throw new Error(`Could not apply the approved-photo retention policy: ${updateRes.error ?? 'Firebase Storage error.'}`);

        // Case approval event log: Strictly caseRef, approverLabel, approval timestamp, approved status.
        // NO image URLs, file names or binary bytes.
        const approvalNoticeEvt: EventLog = {
          id: `evt-${Date.now()}`,
          caseRef: c.caseRef,
          timestamp: nowIso,
          type: 'APPROVAL_NOTICE',
          actorLabel: 'Coordinator (Simulated)',
          summary: `Bed verified ready for admission. Workflow completed.`,
          details: `Case Ref: ${c.caseRef} | Ward: ${c.ward} | Bed: ${c.bed} | Status: Bed Ready | Approver: Coordinator | Expiry: 48h scheduled deletion`,
        };

        const saved = await updateCases((prev) =>
          prev.map((item) => {
            if (item.id !== caseId) return item;
            return {
              ...item,
              status: 'BED_READY',
              approvedAt: nowIso,
              approverLabel: 'Coordinator (Simulated)',
              photoExpiresAt: expiresAt,
              events: [approvalNoticeEvt, ...item.events],
            };
          })
        );
        if (!saved) {
          const rollback = await cloudPhotoStorage.updateExpiryAndStatus(
            profile.facilityId,
            caseId,
            c.photoExpiresAt ?? new Date(Date.now() + (settings.pendingPhotoExpiryDays || 7) * 86400000).toISOString(),
            'pending',
          );
          const message = rollback.success
            ? 'Case approval could not be saved; the photo was restored to pending review. Please retry approval.'
            : `Case approval could not be saved and photo metadata could not be restored: ${rollback.error ?? 'Storage error.'}`;
          showNotification('error', message);
          setIsProcessing(false);
          return { success: false, error: message };
        }

        await refreshStorageSummary();
        showNotification('success', `Bed ${c.bed} marked Bed Ready! Photo retention scheduled for 48h.`);
        setIsProcessing(false);
        return { success: true };
      } catch (err: unknown) {
        setIsProcessing(false);
        const msg = err instanceof Error ? err.message : 'Approval failed';
        showNotification('error', msg);
        return { success: false, error: msg };
      }
    },
    [cases, profile?.facilityId, settings.pendingPhotoExpiryDays, showNotification, updateCases, refreshStorageSummary]
  );

  // 8. Coordinator Requests Re-clean / Rejects Photo
  const rejectBedPhoto = useCallback(
    async (
      caseId: string,
      reason: RejectionReasonCategory,
      details?: string
    ): Promise<{ success: boolean; error?: string }> => {
      const c = cases.find((item) => item.id === caseId);
      if (!c) return { success: false, error: 'Case not found' };
      if (!canRejectBedPhoto(c.status, c.photoUploaded, reason)) {
        showNotification('error', 'A bed photo awaiting coordinator review and a rejection reason are required.');
        return { success: false, error: 'The case is not ready for re-clean review.' };
      }

      setIsProcessing(true);
      try {
        const nowIso = new Date().toISOString();

        if (!profile?.facilityId) throw new Error('No facility photo-storage session is available.');
        const rejectedPhoto = await cloudPhotoStorage.getPhoto(profile.facilityId, caseId);
        if (!rejectedPhoto) throw new Error('The uploaded photo could not be found for the re-clean request.');
        const delRes = await cloudPhotoStorage.deletePhoto(profile.facilityId, caseId);
        if (!delRes.success) {
          setIsProcessing(false);
          showNotification('error', `Deletion error: ${delRes.error || 'Failed to remove rejected photo'}`);
          return { success: false, error: delRes.error };
        }

        const reasonLabels: Record<RejectionReasonCategory, string> = {
          LINEN_UNMADE: 'Linen unmade, wrinkled or stained',
          SURFACE_UNCLEAN: 'Surface/floor uncleanness or visible spill',
          TRASH_REMAINS: 'Discarded items / PPE present in room',
          PRIVACY_ISSUE_DETECTED: 'Privacy issue: Person, document, or monitor visible',
          BLURRY_OR_IMPROPER_ANGLE: 'Photo blurry, underexposed, or improper room angle',
          OTHER_OPERATIONAL: 'Other operational deficit',
        };

        const rejEvt: EventLog = {
          id: `evt-${Date.now()}`,
          caseRef: c.caseRef,
          timestamp: nowIso,
          type: 'REJECTION_NOTICE',
          actorLabel: 'Coordinator (Simulated)',
          summary: `Re-clean requested: ${reasonLabels[reason]}. Rejected photo deleted immediately.`,
          details: details ? `Notes: ${details}` : undefined,
        };

        const saved = await updateCases((prev) =>
          prev.map((item) => {
            if (item.id !== caseId) return item;
            return {
              ...item,
              status: 'REJECTED_RECLEAN',
              photoUploaded: false,
              photoUploadedAt: undefined,
              photoExpiresAt: undefined,
              rejectionReason: reasonLabels[reason],
              rejectionDetails: details,
              rejectedAt: nowIso,
              events: [rejEvt, ...item.events],
            };
          })
        );
        if (!saved) {
          const restored = await cloudPhotoStorage.savePhoto(
            profile.facilityId,
            caseId,
            rejectedPhoto.blob,
            rejectedPhoto.mimeType,
            c.photoExpiresAt ?? new Date(Date.now() + (settings.pendingPhotoExpiryDays || 7) * 86400000).toISOString(),
            'pending',
          );
          const message = restored.success
            ? 'Case save failed; the rejected photo has been restored. Please retry the re-clean request.'
            : `Case save failed and photo restoration failed: ${restored.error ?? 'Storage error.'}`;
          await refreshStorageSummary();
          showNotification('error', message);
          setIsProcessing(false);
          return { success: false, error: message };
        }

        await refreshStorageSummary();
        showNotification(
          'info',
          `Re-clean requested. Rejected image removed from storage. Housekeeping notified.`
        );
        setIsProcessing(false);
        return { success: true };
      } catch (err: unknown) {
        setIsProcessing(false);
        const msg = err instanceof Error ? err.message : 'Rejection failed';
        showNotification('error', msg);
        return { success: false, error: msg };
      }
    },
    [cases, profile?.facilityId, settings.pendingPhotoExpiryDays, showNotification, updateCases, refreshStorageSummary]
  );

  // 9. Demo-only Control: Delete Photo Now (Test 48h Retention Policy Immediately)
  const purgePhotoNow = useCallback(
    async (caseId: string): Promise<{ success: boolean; error?: string }> => {
      const c = cases.find((item) => item.id === caseId);
      if (!c) return { success: false, error: 'Case not found' };

      setIsProcessing(true);
      try {
        const nowIso = new Date().toISOString();
        if (!profile?.facilityId) throw new Error('No facility photo-storage session is available.');
        const delRes = await cloudPhotoStorage.deletePhoto(profile.facilityId, caseId);
        if (!delRes.success) {
          setIsProcessing(false);
          showNotification('error', `Failed to purge photo: ${delRes.error || 'Storage error'}`);
          return { success: false, error: delRes.error };
        }

        const purgeEvt: EventLog = {
          id: `evt-${Date.now()}`,
          caseRef: c.caseRef,
          timestamp: nowIso,
          type: 'PHOTO_PURGED',
          actorLabel: 'Demo Control (Simulated 48h Purge)',
          summary: 'Photo permanently purged via demo retention control. Bed Ready approval notice preserved.',
        };

        const saved = await updateCases((prev) =>
          prev.map((item) => {
            if (item.id !== caseId) return item;
            return {
              ...item,
              photoPurged: true,
              photoPurgedAt: nowIso,
              events: [purgeEvt, ...item.events],
            };
          })
        );
        if (!saved) {
          const message = 'The photo was deleted, but its purge record could not be saved.';
          await refreshStorageSummary();
          showNotification('error', message);
          setIsProcessing(false);
          return { success: false, error: message };
        }

        await refreshStorageSummary();
        showNotification(
          'success',
          `[Demo Control] Photo for case ${c.caseRef} permanently deleted from Firebase Storage. Bed-ready audit notice remains intact.`
        );
        setIsProcessing(false);
        return { success: true };
      } catch (err: unknown) {
        setIsProcessing(false);
        const msg = err instanceof Error ? err.message : 'Purge error';
        showNotification('error', msg);
        return { success: false, error: msg };
      }
    },
    [cases, profile?.facilityId, showNotification, updateCases, refreshStorageSummary]
  );

  // 10. Demo Simulation: Fast-Forward Time
  const simulateTimeFastForward = useCallback(
    async (hours: number): Promise<{ purgedCount: number; error?: string }> => {
      if (!profile?.facilityId || !canManageBedWorkflows(profile.role)) {
        const error = profile?.facilityId
          ? 'Bed-retention controls are restricted to facility administrators and coordinators.'
          : 'No facility photo-storage session is available.';
        showNotification('error', error);
        return { purgedCount: 0, error };
      }
      try {
        const simulatedFutureTime = new Date(Date.now() + hours * 3600 * 1000);
        const { purgedCaseIds, errors } = await cloudPhotoStorage.purgeExpiredPhotos(profile.facilityId, simulatedFutureTime);

        if (errors.length > 0) showNotification('error', `Fast-forward purge error: ${errors[0]}`);

        if (purgedCaseIds.length > 0) {
          const saved = await updateCases((prev) =>
            prev.map((c) => {
              if (!purgedCaseIds.includes(c.id)) return c;
              const isPending = c.status === 'AWAITING_REVIEW';
              const evt: EventLog = {
                id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                caseRef: c.caseRef,
                timestamp: new Date().toISOString(),
                type: isPending ? 'PHOTO_EXPIRED' : 'PHOTO_PURGED',
                actorLabel: `Demo Simulation (+${hours}h)`,
                summary: isPending
                  ? `Pending review photo expired under simulated +${hours}h time jump. New photo required.`
                  : `Photo purged per simulated +${hours}h retention period. Approval audit preserved.`,
              };

              return {
                ...c,
                photoPurged: true,
                photoPurgedAt: new Date().toISOString(),
                status: isPending ? 'REJECTED_RECLEAN' as CaseStatus : c.status,
                photoUploaded: isPending ? false : c.photoUploaded,
                events: [evt, ...c.events],
              };
            })
          );
          if (!saved) {
            const message = 'Expired photos were deleted, but the case records could not be updated.';
            await refreshStorageSummary();
            showNotification('error', message);
            return { purgedCount: 0, error: message };
          }
        }

        await refreshStorageSummary();
        showNotification(
          'info',
          `Simulated +${hours} hours: ${purgedCaseIds.length} photo(s) exceeded retention threshold and were purged.`
        );
        return { purgedCount: purgedCaseIds.length };
      } catch (error) {
        const message = `Fast-forward purge failed: ${error instanceof Error ? error.message : 'Firebase Storage error.'}`;
        showNotification('error', message);
        return { purgedCount: 0, error: message };
      }
    },
    [profile?.facilityId, refreshStorageSummary, showNotification, updateCases]
  );

  // 11. Update Settings
  const updateSettings = useCallback((newSettings: Partial<WorkflowSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings, approvedPhotoRetentionHours: 48 }));
  }, [setSettings]);

  // 12. Reset to Initial Demo Data
  const resetToInitialDemoData = useCallback(async () => {
    setIsProcessing(true);
    try {
      if (!profile?.facilityId) throw new Error('No facility photo-storage session is available.');
      if (profile.role !== 'admin') throw new Error('Only a facility administrator can reset the synthetic demo data.');
      const freshCases = getInitialSyntheticCases();
      const case1Blob = generateSyntheticBedPhotoBlob(freshCases[0].caseRef, freshCases[0].bed);
      const case3Blob = generateSyntheticBedPhotoBlob(freshCases[2].caseRef, freshCases[2].bed);
      const seeds = await Promise.all([
        cloudPhotoStorage.savePhoto(
          profile.facilityId, freshCases[0].id, case1Blob, 'image/svg+xml',
          freshCases[0].photoExpiresAt || new Date(Date.now() + 7 * 86400000).toISOString(), 'pending'
        ),
        cloudPhotoStorage.savePhoto(
          profile.facilityId, freshCases[2].id, case3Blob, 'image/svg+xml',
          freshCases[2].photoExpiresAt || new Date(Date.now() + 48 * 3600000).toISOString(), 'approved'
        ),
      ]);
      const seedError = seeds.find((result) => !result.success)?.error;
      if (seedError) throw new Error(`Could not initialize demo photos: ${seedError}`);
      const freshCaseIds = new Set(freshCases.map((item) => item.id));
      const deletions = await Promise.all(cases
        .filter((item) => !freshCaseIds.has(item.id))
        .map((item) => cloudPhotoStorage.deletePhoto(profile.facilityId, item.id)));
      const deletionError = deletions.find((result) => !result.success)?.error;
      if (deletionError) throw new Error(`Could not clear the current bed cases' photos: ${deletionError}`);
      await mutateCases(() => ({ next: freshCases, result: undefined }));
      setActiveCaseId(freshCases[0].id);

      await refreshStorageSummary();
      showNotification('success', 'Demo data reset to clean initial state.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset demo data';
      showNotification('error', msg);
    } finally {
      setIsProcessing(false);
    }
  }, [cases, mutateCases, profile?.facilityId, profile?.role, refreshStorageSummary, showNotification]);

  return (
    <HospitalFlowContext.Provider
      value={{
        cases,
        activeCaseId,
        activeCase,
        settings,
        storageSummary,
        isProcessing,
        notification,
        setActiveCaseId,
        createCase,
        toggleNursingHandoff,
        toggleBillingHandoff,
        confirmRoomDeparture,
        startCleaning,
        uploadPhoto,
        approveBedReady,
        rejectBedPhoto,
        purgePhotoNow,
        simulateTimeFastForward,
        updateSettings,
        resetToInitialDemoData,
        refreshStorageSummary,
        clearNotification,
      }}
    >
      {children}
    </HospitalFlowContext.Provider>
  );
};

export const useHospitalFlow = () => {
  const context = useContext(HospitalFlowContext);
  if (!context) {
    throw new Error('useHospitalFlow must be used within a HospitalFlowProvider');
  }
  return context;
};
