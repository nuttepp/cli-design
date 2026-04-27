"use client";

export interface WorkspaceMeta {
  lastOpened: string;
  cliUsed: string;
}

const META_KEY = "workspace-meta";

export function readAllMeta(): Record<string, WorkspaceMeta> {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, WorkspaceMeta>;
  } catch {
    return {};
  }
}

export function updateMeta(name: string, cli: string): void {
  try {
    const all = readAllMeta();
    all[name] = { lastOpened: new Date().toISOString(), cliUsed: cli };
    localStorage.setItem(META_KEY, JSON.stringify(all));
  } catch {
    // localStorage unavailable
  }
}

export function removeMeta(name: string): void {
  try {
    const all = readAllMeta();
    delete all[name];
    localStorage.setItem(META_KEY, JSON.stringify(all));
  } catch {
    // localStorage unavailable
  }
}
