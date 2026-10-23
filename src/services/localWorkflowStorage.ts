export const LOCAL_WORKFLOW_UPDATED_EVENT = 'hospitalflow:local-workflow-updated';
const STORAGE_PREFIX = 'hospitalflow:browser-demo:v1:';

export function getLocalWorkflowStorageKey(workflowId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(workflowId)}`;
}

function getBrowserStorage(): Storage {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Browser storage is unavailable. Use a standard browser window with local storage enabled.');
  }
  return window.localStorage;
}

function parseWorkflowData<T>(value: unknown): T {
  if (Array.isArray(value) || (value !== null && typeof value === 'object')) return value as T;
  throw new Error('Saved workflow data has an unsupported format.');
}

export function readLocalWorkflow<T>(workflowId: string): T | null {
  const stored = getBrowserStorage().getItem(getLocalWorkflowStorageKey(workflowId));
  if (stored === null) return null;
  return parseWorkflowData<T>(JSON.parse(stored));
}

export function writeLocalWorkflow<T>(workflowId: string, value: T): void {
  if (!Array.isArray(value) && (value === null || typeof value !== 'object')) {
    throw new Error('Only structured workflow data can be saved in browser storage.');
  }
  getBrowserStorage().setItem(getLocalWorkflowStorageKey(workflowId), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(LOCAL_WORKFLOW_UPDATED_EVENT, { detail: { workflowId } }));
}
