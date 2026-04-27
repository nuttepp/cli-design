"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { ElementEditorPanel } from "@/components/ElementEditorPanel";
import { FilePanel } from "@/components/FilePanel";
import { PreviewPanel, type BriefTab } from "@/components/PreviewPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ClarifyingQuestion } from "@/lib/clarifyingQuestions";
import type { SelectedElement } from "@/lib/previewInspector";
import { useChat } from "@/lib/useChat";

const CHAT_MIN_WIDTH = 200;
const CHAT_DEFAULT_WIDTH = 400;
const FILE_PANEL_WIDTH = 260;
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

  const [refreshKey, setRefreshKey] = useState(0);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("preview");
  const [fullscreen, setFullscreen] = useState(false);
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

  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    resizingRef.current = true;
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
  }, []);

  const onResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizingRef.current) return;
    const desired = window.innerWidth - e.clientX;
    const max =
      window.innerWidth - FILE_PANEL_WIDTH - RESIZER_WIDTH - PREVIEW_MIN_WIDTH;
    setChatWidth(Math.min(max, Math.max(CHAT_MIN_WIDTH, desired)));
  }, []);

  const onResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    resizingRef.current = false;
    (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950">
        <Link
          href="/"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ← Workspaces
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
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </header>

      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: fullscreen
            ? "1fr"
            : `${FILE_PANEL_WIDTH}px minmax(${PREVIEW_MIN_WIDTH}px, 1fr) ${RESIZER_WIDTH}px ${chatWidth}px`,
        }}
      >
        {!fullscreen && (
          <div className="min-h-0 overflow-hidden border-r border-slate-200 dark:border-slate-800">
            <FilePanel
              workspace={workspace}
              refreshKey={refreshKey}
              onOpenFile={openFile}
            />
          </div>
        )}
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
          />
        </div>
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
              className="group relative cursor-col-resize touch-none select-none border-l border-slate-200 bg-slate-200 transition-colors hover:bg-indigo-500/60 dark:border-slate-800 dark:bg-slate-800"
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
        className="rounded px-1 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
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
        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      <button
        type="submit"
        disabled={saving || !draft.trim()}
        className="rounded border border-indigo-500 bg-indigo-600 px-2 py-0.5 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={saving}
        className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-500 dark:text-red-400">{error}</span>}
    </form>
  );
}
