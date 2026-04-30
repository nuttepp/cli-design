"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { ElementEditorPanel } from "@/components/ElementEditorPanel";
import { PreviewPanel, type BriefTab } from "@/components/PreviewPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ClarifyingQuestion } from "@/lib/clarifyingQuestions";
import type { RuntimeError, SelectedElement } from "@/lib/previewInspector";
import { useChat } from "@/lib/useChat";

const CHAT_MIN_WIDTH = 200;
const CHAT_DEFAULT_WIDTH = 400;
const PREVIEW_MIN_WIDTH = 300;
const RESIZER_WIDTH = 4;

export default function StudioPage() {
  const params = useParams<{ workspace: string }>();
  const router = useRouter();
  const workspace = params?.workspace
    ? decodeURIComponent(params.workspace)
    : null;

  const [cliKey] = useState(() => {
    if (typeof window === "undefined") return "claude";
    try {
      return localStorage.getItem("selected-cli") ?? "claude";
    } catch { return "claude"; }
  });
  const cliName = { claude: "Claude Code", kilo: "Kilo Code", gemini: "Gemini CLI" }[cliKey] ?? cliKey;

  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("preview");
  const [fullscreen, setFullscreen] = useState(false);
  const [showEscHint, setShowEscHint] = useState(false);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_WIDTH);
  const resizingRef = useRef(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement | null>(null);
  const [liveOverrides, setLiveOverrides] = useState<Record<string, string>>({});
  const [brief, setBrief] = useState<BriefTab | null>(null);

  const openBrief = useCallback(
    (id: string, questions: ClarifyingQuestion[]) => {
      setBrief({ id, questions });
      setActiveTab("brief");
    },
    [],
  );

  const chat = useChat({
    workspace,
    cli: cliKey,
    model: selectedModel,
    onTurnComplete: () => setRefreshKey((k) => k + 1),
    onQuestionsDetected: openBrief,
  });

  // Reset inspector state when the workspace changes; keep selection
  // scoped to the workspace it was captured in.
  useEffect(() => {
    setInspectMode(false);
    setSelectedElement(null);
    setLiveOverrides({});
    setBrief(null);
  }, [workspace]);

  // Crosshair only makes sense while the Preview tab is visible.
  useEffect(() => {
    if (activeTab !== "preview" && inspectMode) setInspectMode(false);
  }, [activeTab, inspectMode]);

  // While fullscreen: ESC exits, and a hint panel appears briefly.
  useEffect(() => {
    if (!fullscreen) {
      setShowEscHint(false);
      return;
    }
    setShowEscHint(true);
    const hideTimer = window.setTimeout(() => setShowEscHint(false), 3500);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(hideTimer);
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  // A fresh selection always starts with no overrides.
  const handleElementSelect = useCallback((sel: SelectedElement) => {
    setSelectedElement(sel);
    setLiveOverrides({});
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedElement(null);
    setLiveOverrides({});
  }, []);

  const openFile = (path: string) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveTab(path);
  };
  const closeFile = (path: string) => {
    setOpenFiles((prev) => prev.filter((p) => p !== path));
    setActiveTab((cur) => (cur === path ? "preview" : cur));
  };

  const closeBrief = useCallback(() => {
    setBrief(null);
    setActiveTab((cur) => (cur === "brief" ? "preview" : cur));
  }, []);
  const submitBrief = useCallback(
    (text: string) => {
      void chat.send(text);
    },
    [chat],
  );

  const fixRuntimeErrors = useCallback(
    (errors: RuntimeError[]) => {
      if (!errors.length) return;
      const lines = errors.map((e, i) => {
        const loc = e.source
          ? ` (${e.source}${e.line != null ? `:${e.line}${e.col != null ? `:${e.col}` : ""}` : ""})`
          : "";
        const stack = e.stack ? `\n  ${e.stack.split("\n").join("\n  ")}` : "";
        return `${i + 1}. [${e.kind}] ${e.message}${loc}${stack}`;
      });
      const message = [
        "The preview is reporting the following runtime errors. Please investigate and fix the underlying cause in the workspace files:",
        "",
        ...lines,
      ].join("\n");
      void chat.send(message);
    },
    [chat],
  );

  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    resizingRef.current = true;
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
  }, []);

  const onResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizingRef.current) return;
    const desired = window.innerWidth - e.clientX;
    const max =
      window.innerWidth - RESIZER_WIDTH - PREVIEW_MIN_WIDTH;
    setChatWidth(Math.min(max, Math.max(CHAT_MIN_WIDTH, desired)));
  }, []);

  const onResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    resizingRef.current = false;
    (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <main className="flex h-screen flex-col">
      {!fullscreen && (
      <header className="flex items-center gap-3 border-b border-slate-200/60 bg-white/80 px-4 py-2 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/80">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Workspaces
        </Link>
        <WorkspaceTitle
          workspace={workspace}
          onRenamed={(next) =>
            router.replace(`/w/${encodeURIComponent(next)}`)
          }
        />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => {
              setFullscreen((v) => {
                if (!v) setActiveTab("preview");
                return !v;
              });
            }}
            aria-label={fullscreen ? "Exit fullscreen preview" : "Fullscreen preview"}
            title={fullscreen ? "Exit fullscreen preview" : "Fullscreen preview"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
          >
            {fullscreen ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>Exit fullscreen</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>Fullscreen</>
            )}
          </button>
        </div>
      </header>
      )}

      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: fullscreen
            ? "1fr"
            : `minmax(${PREVIEW_MIN_WIDTH}px, 1fr) ${RESIZER_WIDTH}px ${chatWidth}px`,
        }}
      >
        <div className="relative min-h-0">
          <PreviewPanel
            workspace={workspace}
            refreshKey={refreshKey}
            openFiles={openFiles}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onCloseFile={closeFile}
            hideTabs={fullscreen}
            inspectMode={inspectMode}
            onInspectToggle={setInspectMode}
            onElementSelect={handleElementSelect}
            liveSelector={selectedElement?.selector ?? null}
            liveOverrides={liveOverrides}
            brief={brief}
            onCloseBrief={closeBrief}
            onSubmitBrief={submitBrief}
            onOpenFile={openFile}
            onFixRuntimeErrors={fixRuntimeErrors}
          />
        </div>
        {fullscreen && (
          <div
            aria-live="polite"
            className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-opacity duration-500 ${showEscHint ? "opacity-100" : "opacity-0"}`}
          >
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-1.5 text-xs font-medium text-slate-700 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200">
              Press
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:border-slate-600 dark:bg-slate-800">Esc</kbd>
              to exit fullscreen
            </div>
          </div>
        )}
        {!fullscreen && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize chat panel"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
              onPointerCancel={onResizePointerUp}
              onDoubleClick={() => setChatWidth(CHAT_DEFAULT_WIDTH)}
              className="group relative cursor-col-resize touch-none select-none border-l border-slate-200/60 bg-slate-100 transition-colors hover:bg-indigo-500/40 dark:border-slate-800/60 dark:bg-slate-800/60 dark:hover:bg-indigo-500/40"
            >
              <span className="absolute inset-y-0 -left-1 -right-1" />
            </div>
            <div className="min-h-0 overflow-hidden">
              {selectedElement ? (
                <ElementEditorPanel
                  element={selectedElement}
                  overrides={liveOverrides}
                  onOverrideChange={setLiveOverrides}
                  onClose={clearSelection}
                  chat={chat}
                  workspace={workspace}
                />
              ) : (
                <ChatPanel
                  workspace={workspace}
                  chat={chat}
                  selectedElement={null}
                  onClearSelection={clearSelection}
                  onOpenBrief={openBrief}
                  cliName={cliName}
                  cli={cliKey}
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                />
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function WorkspaceTitle({
  workspace,
  onRenamed,
}: {
  workspace: string | null;
  onRenamed: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!workspace) {
    return <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">—</h1>;
  }

  const startEdit = () => {
    setDraft(workspace);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const submit = async () => {
    const next = draft.trim();
    if (!next || next === workspace) {
      cancel();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: next }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        name?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setEditing(false);
      onRenamed(data.name ?? next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        title="Rename workspace"
        className="rounded-lg px-2 py-0.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        {workspace}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        disabled={saving}
        autoFocus
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      <button
        type="submit"
        disabled={saving || !draft.trim()}
        className="rounded-lg border border-indigo-500 bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={saving}
        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-500 dark:text-red-400">{error}</span>}
    </form>
  );
}
