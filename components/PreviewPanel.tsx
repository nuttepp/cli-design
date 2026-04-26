"use client";

import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
} from "@codesandbox/sandpack-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DesignSystem } from "./DesignSystem";
import { QuestionsForm } from "./QuestionsForm";
import type { ClarifyingQuestion } from "@/lib/clarifyingQuestions";
import {
  INSPECTOR_MARKER,
  injectInspectorScript,
  type SelectedElement,
} from "@/lib/previewInspector";

export interface BriefTab {
  id: string;
  questions: ClarifyingQuestion[];
}

interface Props {
  workspace: string | null;
  refreshKey: number;
  openFiles: string[];
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onCloseFile: (path: string) => void;
  hideTabs?: boolean;
  inspectMode: boolean;
  onInspectToggle: (on: boolean) => void;
  onElementSelect: (sel: SelectedElement) => void;
  liveSelector: string | null;
  liveOverrides: Record<string, string>;
  brief?: BriefTab | null;
  onCloseBrief?: () => void;
  onSubmitBrief?: (text: string) => void;
}

const SAVE_DEBOUNCE_MS = 5000;

const FALLBACK_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Preview</title>
    <style>
      body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; color: #475569; }
    </style>
  </head>
  <body>
    <p>Empty workspace. Ask Claude to build something.</p>
  </body>
</html>
`;

export function PreviewPanel({
  workspace,
  refreshKey,
  openFiles,
  activeTab,
  onSelectTab,
  onCloseFile,
  hideTabs = false,
  inspectMode,
  onInspectToggle,
  onElementSelect,
  liveSelector,
  liveOverrides,
  brief = null,
  onCloseBrief,
  onSubmitBrief,
}: Props) {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const saveTimers = useRef<Map<string, number>>(new Map());
  const editsRef = useRef(edits);
  const dirtyRef = useRef(dirty);
  editsRef.current = edits;
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!workspace) {
      setFiles(null);
      setEdits({});
      setDirty({});
      return;
    }
    let cancelled = false;
    setError(null);
    fetch(`/api/files/${encodeURIComponent(workspace)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { files: Record<string, string> };
      })
      .then(({ files }) => {
        if (cancelled) return;
        setFiles(files);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [workspace, refreshKey]);

  const flushSave = useCallback(
    async (path: string) => {
      if (!workspace) return;
      const timers = saveTimers.current;
      const t = timers.get(path);
      if (t) {
        window.clearTimeout(t);
        timers.delete(path);
      }
      if (!dirtyRef.current[path]) return;
      const content = editsRef.current[path];
      if (content === undefined) return;
      try {
        const res = await fetch(
          `/api/files/${encodeURIComponent(workspace)}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ path, content }),
          },
        );
        if (!res.ok) return;
        setDirty((d) => ({ ...d, [path]: false }));
        setFiles((f) => (f ? { ...f, [path]: content } : f));
      } catch {
        // leave dirty so the next change retries
      }
    },
    [workspace],
  );

  // Flush pending save when active tab changes away from an editor tab.
  const prevActiveRef = useRef<string>(activeTab);
  useEffect(() => {
    const prev = prevActiveRef.current;
    if (prev !== activeTab && prev !== "preview") {
      void flushSave(prev);
    }
    prevActiveRef.current = activeTab;
  }, [activeTab, flushSave]);

  const handleEdit = (path: string, value: string) => {
    setEdits((e) => ({ ...e, [path]: value }));
    setDirty((d) => ({ ...d, [path]: true }));
    const timers = saveTimers.current;
    const existing = timers.get(path);
    if (existing) window.clearTimeout(existing);
    const id = window.setTimeout(() => {
      timers.delete(path);
      void flushSave(path);
    }, SAVE_DEBOUNCE_MS);
    timers.set(path, id);
  };

  const handleClose = (path: string) => {
    void flushSave(path);
    onCloseFile(path);
  };

  const postToIframe = useCallback((msg: Record<string, unknown>) => {
    const iframe = previewContainerRef.current?.querySelector("iframe");
    iframe?.contentWindow?.postMessage(msg, "*");
  }, []);

  // Sync inspect mode into the Sandpack iframe via postMessage. Also tear
  // down on unmount so a stale crosshair never sticks around.
  useEffect(() => {
    postToIframe({
      [INSPECTOR_MARKER]: true,
      type: inspectMode ? "activate" : "deactivate",
    });
    return () => {
      postToIframe({ [INSPECTOR_MARKER]: true, type: "deactivate" });
    };
  }, [inspectMode, postToIframe, refreshKey]);

  // Stream live style overrides from the Element Editor into the iframe so
  // form changes update the preview without re-saving the source. The
  // inspector script tracks which props it set, so an empty map clears them.
  const lastSelectorRef = useRef<string | null>(null);
  useEffect(() => {
    const prevSelector = lastSelectorRef.current;
    if (prevSelector && prevSelector !== liveSelector) {
      postToIframe({
        [INSPECTOR_MARKER]: true,
        type: "clear_styles",
        selector: prevSelector,
      });
    }
    if (liveSelector) {
      postToIframe({
        [INSPECTOR_MARKER]: true,
        type: "apply_style",
        selector: liveSelector,
        css: liveOverrides,
      });
    }
    lastSelectorRef.current = liveSelector;
  }, [liveSelector, liveOverrides, postToIframe, refreshKey]);

  // Listen for selection events posted by the injected inspector script.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as
        | { [INSPECTOR_MARKER]?: boolean; type?: string; payload?: SelectedElement }
        | null;
      if (!d || d[INSPECTOR_MARKER] !== true) return;
      if (d.type !== "select" || !d.payload) return;
      const iframe = previewContainerRef.current?.querySelector("iframe");
      if (iframe && e.source !== iframe.contentWindow) return;
      onElementSelect(d.payload);
      onInspectToggle(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onElementSelect, onInspectToggle]);

  // Esc cancels inspect mode without selecting.
  useEffect(() => {
    if (!inspectMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onInspectToggle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspectMode, onInspectToggle]);

  // Build the inspector-injected /index.html in a separate memo keyed only on
  // the base file. If we injected inside `sandpackFiles`, every keystroke in
  // an unrelated code tab would regenerate the HTML and remount Sandpack.
  const inspectorIndexHtml = useMemo(() => {
    const base = files?.["/index.html"] ?? FALLBACK_INDEX_HTML;
    return injectInspectorScript(base);
  }, [files]);

  const sandpackFiles = useMemo(() => {
    if (!files) return null;
    const merged: Record<string, string> = { ...files, ...edits };
    // Prefer a live edit to /index.html if the user is editing it; otherwise
    // serve the inspector-injected version so clicks in the preview can be
    // captured.
    merged["/index.html"] = edits["/index.html"] ?? inspectorIndexHtml;
    return merged;
  }, [edits, files, inspectorIndexHtml]);

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-sm text-slate-500 dark:bg-slate-950">
        No workspace selected.
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-4 text-sm text-red-500 dark:bg-slate-950 dark:text-red-400">
        Failed to load workspace files: {error}
      </div>
    );
  }
  if (!files || !sandpackFiles) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-sm text-slate-500 dark:bg-slate-950">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {!hideTabs && (
        <div className="flex items-end gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 pt-2 dark:border-slate-800 dark:bg-slate-950">
          <ChromeTab
            active={activeTab === "preview"}
            onClick={() => onSelectTab("preview")}
          >
            <span className="text-emerald-400">●</span>
            <span>Preview</span>
          </ChromeTab>
          <ChromeTab
            active={activeTab === "design-system"}
            onClick={() => onSelectTab("design-system")}
          >
            <span className="text-indigo-400">●</span>
            <span>Design System</span>
          </ChromeTab>
          {brief && (
            <ChromeTab
              active={activeTab === "brief"}
              onClick={() => onSelectTab("brief")}
              onClose={onCloseBrief}
              title="Project brief"
            >
              <span className="text-amber-400">●</span>
              <span>Brief</span>
            </ChromeTab>
          )}
          {openFiles.map((path) => {
            const name = path.slice(path.lastIndexOf("/") + 1);
            return (
              <ChromeTab
                key={path}
                active={activeTab === path}
                onClick={() => onSelectTab(path)}
                onClose={() => handleClose(path)}
                title={path}
              >
                <span className="max-w-[10rem] truncate">{name}</span>
                {dirty[path] && <span className="text-amber-400">•</span>}
              </ChromeTab>
            );
          })}
          {activeTab === "preview" && (
            <div className="ml-auto -mt-2 flex self-stretch items-center">
              <button
                type="button"
                onClick={() => onInspectToggle(!inspectMode)}
                title={
                  inspectMode
                    ? "Stop inspecting (Esc)"
                    : "Inspect element (click in preview)"
                }
                aria-pressed={inspectMode}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                  inspectMode
                    ? "border-indigo-400 bg-indigo-600 text-white hover:bg-indigo-500"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 3l7.07 17 2.51-7.42L20 10.07z" />
                </svg>
                {inspectMode ? "Inspecting…" : "Inspect"}
              </button>
            </div>
          )}
        </div>
      )}

      <div ref={previewContainerRef} className="relative min-h-0 flex-1 bg-white dark:bg-slate-950">
        <div
          className="absolute inset-0"
          style={{ display: activeTab === "preview" ? "block" : "none" }}
        >
          <SandpackProvider
            key={`${workspace}:${refreshKey}`}
            template="static"
            files={sandpackFiles}
            options={{ recompileMode: "delayed", recompileDelay: 200 }}
            theme="dark"
          >
            <SandpackLayout
              style={{ height: "100%", border: 0, borderRadius: 0 }}
            >
              <SandpackPreview
                style={{ height: "100%" }}
                showOpenInCodeSandbox={false}
                showRefreshButton
              />
            </SandpackLayout>
          </SandpackProvider>
        </div>
        <div
          className="absolute inset-0"
          style={{ display: activeTab === "design-system" ? "block" : "none" }}
        >
          <DesignSystem />
        </div>

        {brief && (
          <div
            className="absolute inset-0 overflow-hidden bg-white dark:bg-slate-950"
            style={{ display: activeTab === "brief" ? "block" : "none" }}
          >
            <QuestionsForm
              key={brief.id}
              questions={brief.questions}
              variant="tab"
              onSubmit={(text) => {
                onSubmitBrief?.(text);
                onCloseBrief?.();
              }}
            />
          </div>
        )}

        {openFiles.map((path) => {
          const content = edits[path] ?? files[path] ?? "";
          return (
            <textarea
              key={path}
              value={content}
              onChange={(e) => handleEdit(path, e.target.value)}
              spellCheck={false}
              className="absolute inset-0 h-full w-full resize-none bg-white p-3 font-mono text-[12px] leading-snug text-slate-900 focus:outline-none dark:bg-slate-950 dark:text-slate-100"
              style={{ display: activeTab === path ? "block" : "none" }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ChromeTab({
  active,
  onClick,
  onClose,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      title={title}
      className={`group flex shrink-0 items-center gap-2 rounded-t-md border border-b-0 px-3 py-1.5 text-xs ${
        active
          ? "border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-900/70"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2"
      >
        {children}
      </button>
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close tab"
          className="rounded px-1 text-slate-500 opacity-60 hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          ×
        </button>
      )}
    </div>
  );
}
