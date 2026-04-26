// In-memory mapping of workspace name → most recent claude CLI session id.
// Process-local; resets on dev-server restart. Fine for a single-user local tool.

const store = new Map<string, string>();

export function getSession(workspace: string): string | undefined {
  return store.get(workspace);
}

export function setSession(workspace: string, sessionId: string): void {
  store.set(workspace, sessionId);
}

export function clearSession(workspace: string): void {
  store.delete(workspace);
}
