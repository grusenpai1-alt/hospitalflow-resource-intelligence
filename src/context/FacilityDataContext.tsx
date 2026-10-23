import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useFirebaseSession } from './FirebaseSessionContext';
import { firestore } from '../services/firebase';

type DataStatus = { loading: boolean; error: string | null };
type MutationResult<T, R> = { next: T; result: R; write?: boolean };
export type FacilityMutator<T> = <R>(mutate: (current: T) => MutationResult<T, R>) => Promise<R>;
type StatusContextValue = {
  statuses: Record<string, DataStatus>;
  setStatus: (key: string, status: DataStatus | null) => void;
};

const FacilityDataStatusContext = createContext<StatusContextValue | null>(null);

export function FacilityDataStatusProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<Record<string, DataStatus>>({});

  const setStatus = useCallback((key: string, status: DataStatus | null) => {
    setStatuses((current) => {
      if (status === null) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: status };
    });
  }, []);

  const value = useMemo(() => ({ statuses, setStatus }), [statuses, setStatus]);
  return <FacilityDataStatusContext.Provider value={value}>{children}</FacilityDataStatusContext.Provider>;
}

export function useFacilityDataStatus() {
  const context = useContext(FacilityDataStatusContext);
  if (!context) throw new Error('useFacilityDataStatus must be used within FacilityDataStatusProvider.');
  const entries = Object.entries(context.statuses);
  return {
    loading: entries.some(([, status]) => status.loading),
    errors: entries.flatMap(([key, status]) => status.error ? [{ key, message: status.error }] : []),
  };
}

function parseStoredData<T>(value: unknown): T {
  if (Array.isArray(value) || (value !== null && typeof value === 'object')) return value as T;
  throw new Error('The saved workflow data has an unsupported format.');
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected Firebase data error.';
}

export function useFacilityData<T>(
  key: string,
  initialValue: () => T,
): [T, Dispatch<SetStateAction<T>>, FacilityMutator<T>] {
  const { profile, user } = useFirebaseSession();
  const statusContext = useContext(FacilityDataStatusContext);
  if (!statusContext) throw new Error('useFacilityData must be used within FacilityDataStatusProvider.');

  const [value, setValue] = useState<T>(initialValue);
  const [status, setLocalStatus] = useState<DataStatus>({ loading: true, error: null });
  const initialValueRef = useRef(initialValue);
  const facilityId = profile?.facilityId;
  const setStatus = statusContext.setStatus;
  const documentRef = useMemo<DocumentReference | null>(() => {
    if (!firestore || !facilityId) return null;
    return doc(firestore, 'facilities', facilityId, 'workflows', key);
  }, [key, facilityId]);

  useEffect(() => {
    setStatus(key, status);
    return () => setStatus(key, null);
  }, [key, status, setStatus]);

  useEffect(() => {
    let active = true;

    if (!firestore || !documentRef || !user) {
      setLocalStatus({ loading: false, error: 'Firebase facility data is not available. Check setup and sign in again.' });
      return () => { active = false; };
    }

    const db = firestore;
    const unsubscribe = onSnapshot(documentRef, (snapshot) => {
      if (!active) return;
      if (snapshot.exists()) {
        try {
          const stored = parseStoredData<T>(snapshot.data().data);
          setValue(stored);
          setLocalStatus({ loading: false, error: null });
        } catch (error) {
          setLocalStatus({ loading: false, error: errorMessage(error) });
        }
        return;
      }

      void runTransaction<T>(db, async (transaction) => {
        const current = await transaction.get(documentRef);
        if (current.exists()) return parseStoredData<T>(current.data().data);

        const seed = initialValueRef.current();
        if (!Array.isArray(seed) && (seed === null || typeof seed !== 'object')) {
          throw new Error('Only structured workflow data can be initialized in Firestore.');
        }
        transaction.set(documentRef, {
          data: seed,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
        return seed;
      }).then((seeded) => {
        if (!active) return;
        setValue(seeded);
        setLocalStatus({ loading: false, error: null });
      }).catch((error: unknown) => {
        if (active) setLocalStatus({ loading: false, error: errorMessage(error) });
      });
    }, (error) => {
      if (active) setLocalStatus({ loading: false, error: errorMessage(error) });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [documentRef, user]);

  const mutate = useCallback<FacilityMutator<T>>(async <R,>(operation: (current: T) => MutationResult<T, R>) => {
    if (!firestore || !documentRef || !user) {
      const error = new Error('Cannot save workflow data without an authenticated facility session.');
      setLocalStatus({ loading: false, error: error.message });
      throw error;
    }

    const db = firestore;
    try {
      let updatedValue: T | undefined;
      const result = await runTransaction<R>(db, async (transaction) => {
        const snapshot = await transaction.get(documentRef);
        const current = snapshot.exists()
          ? parseStoredData<T>(snapshot.data().data)
          : initialValueRef.current();
        const outcome = operation(current);
        const next = outcome.next;

        if (!Array.isArray(next) && (next === null || typeof next !== 'object')) {
          throw new Error('Only structured workflow data can be saved in Firestore.');
        }
        if (outcome.write !== false) {
          transaction.set(documentRef, {
            data: next,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
          updatedValue = next;
        } else {
          updatedValue = current;
        }
        return outcome.result;
      });
      if (updatedValue !== undefined) setValue(updatedValue);
      setLocalStatus({ loading: false, error: null });
      return result;
    } catch (error) {
      setLocalStatus({ loading: false, error: errorMessage(error) });
      throw error;
    }
  }, [documentRef, user]);

  const update = useCallback<Dispatch<SetStateAction<T>>>((nextValue) => {
    void mutate((current) => ({
      next: typeof nextValue === 'function'
        ? (nextValue as (previous: T) => T)(current)
        : nextValue,
      result: undefined,
    })).catch(() => undefined);
  }, [mutate]);

  return [value, update, mutate];
}

export function useFacilityWorkflowSnapshot<T>(key: string) {
  const { profile, user } = useFirebaseSession();
  const statusContext = useContext(FacilityDataStatusContext);
  if (!statusContext) throw new Error('useFacilityWorkflowSnapshot must be used within FacilityDataStatusProvider.');

  const [value, setValue] = useState<T | null>(null);
  const [status, setLocalStatus] = useState<DataStatus>({ loading: true, error: null });
  const facilityId = profile?.facilityId;
  const statusKey = `overview:${key}`;
  const setStatus = statusContext.setStatus;
  const documentRef = useMemo<DocumentReference | null>(() => {
    if (!firestore || !facilityId) return null;
    return doc(firestore, 'facilities', facilityId, 'workflows', key);
  }, [facilityId, key]);

  useEffect(() => {
    setStatus(statusKey, status);
    return () => setStatus(statusKey, null);
  }, [setStatus, status, statusKey]);

  useEffect(() => {
    let active = true;
    if (!firestore || !documentRef || !user) {
      setLocalStatus({ loading: false, error: 'Firebase facility data is not available. Check setup and sign in again.' });
      return () => { active = false; };
    }

    const unsubscribe = onSnapshot(documentRef, (snapshot) => {
      if (!active) return;
      try {
        setValue(snapshot.exists() ? parseStoredData<T>(snapshot.data().data) : null);
        setLocalStatus({ loading: false, error: null });
      } catch (error) {
        setLocalStatus({ loading: false, error: errorMessage(error) });
      }
    }, (error) => {
      if (active) setLocalStatus({ loading: false, error: errorMessage(error) });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [documentRef, user]);

  return { value, loading: status.loading };
}
