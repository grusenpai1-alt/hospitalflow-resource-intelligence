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
import {
  getLocalWorkflowStorageKey,
  LOCAL_WORKFLOW_UPDATED_EVENT,
  readLocalWorkflow,
  writeLocalWorkflow,
} from '../services/localWorkflowStorage';

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
    loadingKeys: entries.filter(([, status]) => status.loading).map(([key]) => key),
    errors: entries.flatMap(([key, status]) => status.error ? [{ key, message: status.error }] : []),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected browser storage error.';
}

export function useFacilityData<T>(
  key: string,
  initialValue: () => T,
): [T, Dispatch<SetStateAction<T>>, FacilityMutator<T>] {
  const statusContext = useContext(FacilityDataStatusContext);
  if (!statusContext) throw new Error('useFacilityData must be used within FacilityDataStatusProvider.');

  const initialValueRef = useRef(initialValue);
  const [value, setValue] = useState<T>(initialValue);
  const localValueRef = useRef(value);
  const [status, setLocalStatus] = useState<DataStatus>({ loading: false, error: null });
  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);
  const setStatus = statusContext.setStatus;
  const storageKey = getLocalWorkflowStorageKey(key);

  useEffect(() => {
    setStatus(key, status);
    return () => setStatus(key, null);
  }, [key, status, setStatus]);

  useEffect(() => {
    let active = true;

    try {
      const saved = readLocalWorkflow<T>(key);
      const next = saved ?? initialValueRef.current();
      if (saved === null) writeLocalWorkflow(key, next);
      localValueRef.current = next;
      setValue(next);
      setLocalStatus({ loading: false, error: null });
    } catch (error) {
      setLocalStatus({ loading: false, error: errorMessage(error) });
    }

    const refreshFromStorage = () => {
      if (!active) return;
      try {
        const saved = readLocalWorkflow<T>(key);
        if (saved === null) return;
        localValueRef.current = saved;
        setValue(saved);
        setLocalStatus({ loading: false, error: null });
      } catch (error) {
        setLocalStatus({ loading: false, error: errorMessage(error) });
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) refreshFromStorage();
    };
    const handleLocalUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ workflowId?: string }>).detail;
      if (detail?.workflowId === key) refreshFromStorage();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(LOCAL_WORKFLOW_UPDATED_EVENT, handleLocalUpdate);

    return () => {
      active = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(LOCAL_WORKFLOW_UPDATED_EVENT, handleLocalUpdate);
    };
  }, [key, storageKey]);

  const mutate = useCallback<FacilityMutator<T>>(async <R,>(operation: (current: T) => MutationResult<T, R>) => {
    try {
      const current = readLocalWorkflow<T>(key) ?? localValueRef.current;
      const outcome = operation(current);
      if (outcome.write !== false) {
        writeLocalWorkflow(key, outcome.next);
        localValueRef.current = outcome.next;
        setValue(outcome.next);
      }
      setLocalStatus({ loading: false, error: null });
      return outcome.result;
    } catch (error) {
      setLocalStatus({ loading: false, error: errorMessage(error) });
      throw error;
    }
  }, [key]);

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
  const statusContext = useContext(FacilityDataStatusContext);
  if (!statusContext) throw new Error('useFacilityWorkflowSnapshot must be used within FacilityDataStatusProvider.');

  const [value, setValue] = useState<T | null>(null);
  const [status, setLocalStatus] = useState<DataStatus>({ loading: false, error: null });
  const statusKey = `overview:${key}`;
  const setStatus = statusContext.setStatus;
  const storageKey = getLocalWorkflowStorageKey(key);

  useEffect(() => {
    setStatus(statusKey, status);
    return () => setStatus(statusKey, null);
  }, [setStatus, status, statusKey]);

  useEffect(() => {
    const refreshFromStorage = () => {
      try {
        setValue(readLocalWorkflow<T>(key));
        setLocalStatus({ loading: false, error: null });
      } catch (error) {
        setLocalStatus({ loading: false, error: errorMessage(error) });
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) refreshFromStorage();
    };
    const handleLocalUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ workflowId?: string }>).detail;
      if (detail?.workflowId === key) refreshFromStorage();
    };
    refreshFromStorage();
    window.addEventListener('storage', handleStorage);
    window.addEventListener(LOCAL_WORKFLOW_UPDATED_EVENT, handleLocalUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(LOCAL_WORKFLOW_UPDATED_EVENT, handleLocalUpdate);
    };
  }, [key, storageKey]);

  return { value, loading: false };
}
