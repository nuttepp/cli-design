"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCliHealth } from "@/lib/useCliHealth";
import type { HealthStatus } from "@/lib/useCliHealth";

type CliKey = keyof HealthStatus;

const CLI_LIST: { key: CliKey; label: string; install: string; login: string }[] = [
  { key: "claude", label: "Claude Code", install: "npm i -g @anthropic-ai/claude-code", login: "claude login" },
  { key: "kilo", label: "Kilo Code", install: "npm i -g kilo-code", login: "kilo auth add" },
  { key: "gemini", label: "Gemini CLI", install: "npm i -g @google/gemini-cli", login: "gemini auth" },
];

export default function HomePage() {
  const router = useRouter();
  const [list, setList] = useState<string[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { health, loading: healthLoading, refreshHealth } = useCliHealth();
  const [selectedCli, setSelectedCli] = useState<CliKey | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/workspaces");
    if (!res.ok) {
      setList([]);
      return;
    }
    const { workspaces } = (await res.json()) as { workspaces: string[] };
    setList(workspaces);
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Auto-select first ready CLI when health data arrives
  useEffect(() => {
    if (health) {
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
  const selectedCliLabel = selectedCli
    ? CLI_LIST.find((c) => c.key === selectedCli)?.label ?? selectedCli
    : null;

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
      router.push(`/w/${encodeURIComponent(name)}`);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete workspace "${name}"? This removes all its files.`)) {
      return;
    }
    const res = await fetch(`/api/workspaces/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (res.ok) await refresh();
  };

  const noneReady =
    health !== null &&
    CLI_LIST.every((c) => !health[c.key].ready);

  return (
    <main className="min-h-screen overflow-y-auto bg-gradient-to-b from-slate-50 to-white text-slate-900 dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-sm">
              C
            </div>
            <h1 className="text-sm font-semibold tracking-tight">CLI-D</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Hero */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Design with CLI</h2>
          <p className="mt-2 max-w-xl text-base text-slate-500 dark:text-slate-400">
            Prototype UIs using AI coding agents. Select your CLI, then create
            or open a workspace to start building.
          </p>
        </div>

        {/* Two Column Layout */}
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
                          ? "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                          : "cursor-not-allowed border-slate-200/60 bg-slate-50 opacity-60 dark:border-slate-800/60 dark:bg-slate-900/30"
                    }`}
                  >
                    {/* Radio indicator */}
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      )}
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

                    {/* Status dot: green=ready, amber=installed not authed, gray=not installed */}
                    {health !== null && (
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          isReady
                            ? "bg-emerald-500"
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
            {/* Create Workspace */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="text-base font-semibold">Create a new workspace</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Each workspace is an isolated project folder.
                {!selectedCli && " Select a CLI agent first."}
              </p>
              <form onSubmit={create} className="mt-3 flex gap-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-app"
                  pattern="[a-z0-9][a-z0-9-]{0,39}"
                  title="lowercase letters, digits and dashes; max 40 chars"
                  disabled={!selectedCliReady}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!newName.trim() || creating || !selectedCliReady}
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
                <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center dark:border-slate-800">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">No workspaces yet</p>
                  <p className="mt-1 text-xs text-slate-400">Create one above to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {list.map((name) => (
                    <div key={name} className="group relative">
                      {selectedCliReady ? (
                        <Link
                          href={`/w/${encodeURIComponent(name)}`}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-indigo-500/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-500/40"
                        >
                          <WorkspaceCardContent name={name} />
                        </Link>
                      ) : (
                        <div
                          title="Select a CLI agent first"
                          className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 opacity-50 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <WorkspaceCardContent name={name} />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void remove(name)}
                        aria-label={`Delete ${name}`}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-red-500/20 bg-white px-2 py-1 text-[10px] font-medium text-red-500 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-red-50 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function WorkspaceCardContent({ name }: { name: string }) {
  return (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-500 dark:from-indigo-500/20 dark:to-purple-500/20">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" /></svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-slate-400">workspaces/{name}/</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-300 transition group-hover:text-indigo-500"><polyline points="9 18 15 12 9 6" /></svg>
    </>
  );
}
