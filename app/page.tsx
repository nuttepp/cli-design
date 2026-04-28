"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { EmptyWorkspaceState } from "@/components/EmptyWorkspaceState";
import { Logo } from "@/components/Logo";
import { useCliHealth } from "@/lib/useCliHealth";
import type { HealthStatus } from "@/lib/useCliHealth";
import { readAllMeta, updateMeta, removeMeta, type WorkspaceMeta } from "@/lib/workspaceMeta";

type CliKey = keyof HealthStatus;

interface WorkspaceInfo {
  name: string;
  fileCount: number;
  lastModified: string;
}

const CLI_LIST: {
  key: CliKey;
  label: string;
  install: string;
  login: string;
  letter: string;
  logo: string;
  logoBg: string;
  logoText: string;
  gradient: string;
  selectedBorder: string;
  selectedBg: string;
  radioBg: string;
  accent: string;
}[] = [
  {
    key: "claude",
    label: "Claude Code",
    install: "npm i -g @anthropic-ai/claude-code",
    login: "claude login",
    letter: "C",
    logo: "/logos/claude.svg",
    logoBg: "#D97757",
    logoText: "text-white",
    gradient: "from-indigo-500 to-purple-600",
    selectedBorder: "border-indigo-500",
    selectedBg: "bg-indigo-50 dark:bg-indigo-500/10",
    radioBg: "border-indigo-500 bg-indigo-500",
    accent: "text-indigo-700 dark:text-indigo-300",
  },
  {
    key: "kilo",
    label: "Kilo Code",
    install: "npm i -g kilo-code",
    login: "kilo auth add",
    letter: "K",
    logo: "/logos/kilo.svg",
    logoBg: "#ffffff",
    logoText: "text-slate-800 dark:text-slate-100",
    gradient: "from-amber-500 to-orange-600",
    selectedBorder: "border-amber-500",
    selectedBg: "bg-amber-50 dark:bg-amber-500/10",
    radioBg: "border-amber-500 bg-amber-500",
    accent: "text-amber-700 dark:text-amber-300",
  },
  {
    key: "gemini",
    label: "Gemini CLI",
    install: "npm i -g @google/gemini-cli",
    login: "gemini auth",
    letter: "G",
    logo: "/logos/gemini.svg",
    logoBg: "#ffffff",
    logoText: "text-slate-800 dark:text-slate-100",
    gradient: "from-cyan-500 to-blue-600",
    selectedBorder: "border-cyan-500",
    selectedBg: "bg-cyan-50 dark:bg-cyan-500/10",
    radioBg: "border-cyan-500 bg-cyan-500",
    accent: "text-cyan-700 dark:text-cyan-300",
  },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function HomePage() {
  const router = useRouter();
  const [list, setList] = useState<WorkspaceInfo[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { health, loading: healthLoading, refreshHealth } = useCliHealth();
  const [selectedCli, setSelectedCli] = useState<CliKey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [clientMeta, setClientMeta] = useState<Record<string, WorkspaceMeta>>({});

  const refresh = async () => {
    const res = await fetch("/api/workspaces");
    if (!res.ok) {
      setList([]);
      return;
    }
    const data = (await res.json()) as { workspaces: WorkspaceInfo[] };
    setList(data.workspaces);
  };

  useEffect(() => {
    void refresh();
    setClientMeta(readAllMeta());
  }, []);

  // Auto-select: prefer last used CLI if still ready, otherwise first ready
  useEffect(() => {
    if (health) {
      try {
        const last = localStorage.getItem("selected-cli") as CliKey | null;
        if (last && health[last]?.ready) {
          setSelectedCli(last);
          return;
        }
      } catch {}
      const firstReady = CLI_LIST.find((c) => health[c.key].ready);
      if (firstReady) setSelectedCli(firstReady.key);
    }
  }, [health]);

  // Persist selected CLI to localStorage so workspace page can read it
  useEffect(() => {
    if (selectedCli) {
      try { localStorage.setItem("selected-cli", selectedCli); } catch {}
    }
  }, [selectedCli]);

  const selectedCliReady =
    selectedCli !== null && health?.[selectedCli]?.ready;

  const handleOpenWorkspace = useCallback((name: string) => {
    if (selectedCli) {
      updateMeta(name, selectedCli);
      setClientMeta(readAllMeta());
    }
    router.push(`/w/${encodeURIComponent(name)}`);
  }, [selectedCli, router]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !selectedCliReady) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      if (selectedCli) {
        updateMeta(name, selectedCli);
        setClientMeta(readAllMeta());
      }
      router.push(`/w/${encodeURIComponent(name)}`);
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const name = deleteTarget;
    setDeleteTarget(null);
    const res = await fetch(`/api/workspaces/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      removeMeta(name);
      setClientMeta(readAllMeta());
      await refresh();
    }
  };

  const noneReady =
    health !== null &&
    CLI_LIST.every((c) => !health[c.key].ready);

  return (
    <>
      <AnimatedBackground />
      <main className="relative min-h-screen overflow-y-auto text-slate-900 dark:text-slate-100">
        {/* Header */}
        <header className="border-b border-slate-200/60 bg-white/70 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/70">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <Logo className="h-8 w-8" />
              <h1 className="text-base font-bold tracking-tight">UX-CLI</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-10">
          {/* Hero */}
          <div className="mb-6 text-center">
            <h2 className="bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-cyan-400">
              UX-CLI
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-slate-500 dark:text-slate-400">
              Prototype UIs using AI coding agents. Select your CLI, create a workspace, and start building.
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            {/* Left Column — CLI Selection */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Select a CLI agent
                </h3>
                <button
                  type="button"
                  onClick={refreshHealth}
                  disabled={healthLoading}
                  aria-label="Re-check CLI status"
                  title="Re-check CLI status"
                  className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                >
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={healthLoading ? "animate-spin" : ""}
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                {CLI_LIST.map((cli) => {
                  const status = health?.[cli.key];
                  const isSelected = selectedCli === cli.key;
                  const isReady = status?.ready ?? false;
                  const isInstalled = status?.installed ?? false;

                  return (
                    <button
                      key={cli.key}
                      type="button"
                      onClick={() => isReady && setSelectedCli(cli.key)}
                      disabled={!isReady && health !== null}
                      className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50 shadow-sm dark:border-indigo-500 dark:bg-indigo-500/10"
                          : isReady
                            ? "border-slate-200 bg-white/80 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                            : "cursor-not-allowed border-slate-200/60 bg-slate-50/80 opacity-60 dark:border-slate-800/60 dark:bg-slate-900/30"
                      }`}
                    >
                      {/* Brand icon */}
                      <div
                        style={{ backgroundColor: cli.logoBg }}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 ${cli.logoText} ${
                          !isReady && health !== null ? "opacity-40" : ""
                        }`}
                      >
                        <img
                          src={cli.logo}
                          alt={cli.letter}
                          className="h-6 w-6 object-contain"
                          onError={(e) => {
                            // Fallback to letter if image fails to load
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).parentElement!.innerText = cli.letter;
                            (e.target as HTMLImageElement).parentElement!.className += ` bg-gradient-to-br ${cli.gradient} text-white font-bold text-sm`;
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isSelected ? "text-indigo-700 dark:text-indigo-300" : ""}`}>
                            {cli.label}
                          </span>
                        </div>
                        {health === null ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 animate-spin rounded-full border border-slate-300 border-t-slate-500" />
                            <span className="text-[11px] text-slate-400">Checking...</span>
                          </div>
                        ) : isReady ? (
                          <div className="mt-0.5">
                            <p className="truncate font-mono text-[11px] text-slate-400" title={status?.version ?? ""}>
                              {status?.version}
                            </p>
                          </div>
                        ) : isInstalled ? (
                          <div className="mt-0.5">
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">Not logged in</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              Run: <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{cli.login}</code>
                            </p>
                          </div>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {cli.install}
                            </code>
                          </p>
                        )}
                      </div>

                      {/* Status dot */}
                      {health !== null && (
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            isReady
                              ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                              : isInstalled
                                ? "bg-amber-500"
                                : "bg-slate-300 dark:bg-slate-600"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {noneReady && (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400">
                  No CLI agents ready. Install and log in to at least one to get started.
                </p>
              )}
            </div>

            {/* Right Column — Workspaces */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select a workspace
              </h3>
              {/* Create Workspace */}
              <div className="mb-6">
                <h3 className="text-base font-semibold">Create a new workspace</h3>
                {!selectedCli && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Select a CLI agent first.
                </p>
              )}
                <form onSubmit={create} className="mt-3 flex flex-col gap-2">
                  <div className="flex gap-3">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Use lowercase letters, digits, and dashes only (max 40 chars)"
                    disabled={!selectedCliReady}
                    className={`flex-1 rounded-lg border bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 ${
                      newName && !/^[a-z0-9][a-z0-9-]{0,39}$/.test(newName)
                        ? "border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500"
                        : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-slate-700"
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!newName.trim() || creating || !selectedCliReady || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(newName)}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {creating ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        New workspace
                      </>
                    )}
                  </button>
                  </div>
                  {newName && !/^[a-z0-9][a-z0-9-]{0,39}$/.test(newName) && (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      Use lowercase letters, digits, and dashes only (max 40 chars)
                    </p>
                  )}
                </form>
                {error && (
                  <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-400">
                    {error}
                  </p>
                )}
              </div>

              {/* Workspace List */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold">Your workspaces</h3>
                  {list && list.length > 0 && (
                    <span className="text-xs text-slate-400">
                      {list.length} workspace{list.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {list === null ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
                    Loading workspaces...
                  </div>
                ) : list.length === 0 ? (
                  <EmptyWorkspaceState />
                ) : (
                  <div className="space-y-2">
                    {list.map((ws) => {
                      const meta = clientMeta[ws.name];

                      return (
                        <div key={ws.name} className="group relative">
                          {selectedCliReady ? (
                            <button
                              type="button"
                              onClick={() => handleOpenWorkspace(ws.name)}
                              className="flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-left backdrop-blur-sm transition hover:border-indigo-500/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-500/40"
                            >
                              <WorkspaceCardContent ws={ws} meta={meta} />
                            </button>
                          ) : (
                            <div
                              title="Select a CLI agent first"
                              className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 opacity-50 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60"
                            >
                              <WorkspaceCardContent ws={ws} meta={meta} />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(ws.name)}
                            aria-label={`Delete ${ws.name}`}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-red-500/20 bg-white px-2 py-1 text-[10px] font-medium text-red-500 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-red-50 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-500/10"
                          >
                            Delete
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </main>

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        workspaceName={deleteTarget ?? ""}
        open={deleteTarget !== null}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function WorkspaceCardContent({
  ws,
  meta,
}: {
  ws: WorkspaceInfo;
  meta: WorkspaceMeta | undefined;
}) {
  return (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-500 dark:from-indigo-500/20 dark:to-purple-500/20">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" /></svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{ws.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
          <span>{ws.fileCount} file{ws.fileCount === 1 ? "" : "s"}</span>
          <span>Modified {relativeTime(ws.lastModified)}</span>
          {meta && (
            <span>Opened {relativeTime(meta.lastOpened)}</span>
          )}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-300 transition group-hover:text-indigo-500"><polyline points="9 18 15 12 9 6" /></svg>
    </>
  );
}
