export interface UndoSnapshot {
  userMessageId: string;
  files: Record<string, string>;
  timestamp: number;
}

const STORAGE_PREFIX = "undo-snapshots:";
const MAX_SNAPSHOTS = 3;

function storageKey(workspace: string): string {
  return `${STORAGE_PREFIX}${workspace}`;
}

export function getSnapshots(workspace: string): UndoSnapshot[] {
  try {
    const raw = localStorage.getItem(storageKey(workspace));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushSnapshot(
  workspace: string,
  snapshot: UndoSnapshot,
): void {
  const snapshots = getSnapshots(workspace);
  snapshots.push(snapshot);
  while (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.shift();
  }
  try {
    localStorage.setItem(storageKey(workspace), JSON.stringify(snapshots));
  } catch {
    // ignore quota errors
  }
}

export function popSnapshot(workspace: string): UndoSnapshot | null {
  const snapshots = getSnapshots(workspace);
  if (snapshots.length === 0) return null;
  const snapshot = snapshots.pop()!;
  try {
    localStorage.setItem(storageKey(workspace), JSON.stringify(snapshots));
  } catch {
    // ignore
  }
  return snapshot;
}

export function clearSnapshots(workspace: string): void {
  try {
    localStorage.removeItem(storageKey(workspace));
  } catch {
    // ignore
  }
}
