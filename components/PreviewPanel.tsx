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
import { FilePanel } from "./FilePanel";
import { QuestionsForm } from "./QuestionsForm";
import { CodeEditor } from "./CodeEditor";
import type { ClarifyingQuestion } from "@/lib/clarifyingQuestions";
import { useTheme } from "@/lib/useTheme";
import {
  INSPECTOR_MARKER,
  injectInspectorScript,
  type RuntimeError,
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
  onOpenFile?: (path: string) => void;
  onFixRuntimeErrors?: (errors: RuntimeError[]) => void;
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
    <p>Empty workspace. Ask AI to build something.</p>
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
  onOpenFile,
  onFixRuntimeErrors,
}: Props) {
  const { theme } = useTheme();
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeError[]>([]);
  const [errorsCollapsed, setErrorsCollapsed] = useState(false);
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
    setEdits({});
    setDirty({});
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

  // Listen for events posted by the injected inspector script: element
  // selection and runtime errors from inside the preview iframe.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as
        | {
            [INSPECTOR_MARKER]?: boolean;
            type?: string;
            payload?: SelectedElement | RuntimeError;
          }
        | null;
      if (!d || d[INSPECTOR_MARKER] !== true) return;
      const iframe = previewContainerRef.current?.querySelector("iframe");
      if (iframe && e.source !== iframe.contentWindow) return;
      if (d.type === "select" && d.payload) {
        onElementSelect(d.payload as SelectedElement);
        onInspectToggle(false);
      } else if (d.type === "runtime_error" && d.payload) {
        const err = d.payload as RuntimeError;
        setRuntimeErrors((prev) => {
          if (prev.some((p) => p.message === err.message && p.source === err.source && p.line === err.line)) {
            return prev;
          }
          return [...prev, err].slice(-20);
        });
        setErrorsCollapsed(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onElementSelect, onInspectToggle]);

  // Clear collected runtime errors whenever the iframe reloads (workspace
  // change or post-turn refresh) — stale errors would be misleading.
  useEffect(() => {
    setRuntimeErrors([]);
  }, [workspace, refreshKey]);

  // Esc cancels inspect mode without selecting.
  useEffect(() => {
    if (!inspectMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onInspectToggle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspectMode, onInspectToggle]);

  // Detect workspace framework from files present.
  type SandpackTemplate = "static" | "react" | "vue" | "svelte" | "angular";
  const detectedTemplate: SandpackTemplate = useMemo(() => {
    if (!files) return "static";
    if (files["/App.js"] || files["/index.js"]) return "react";
    if (files["/App.vue"]) return "vue";
    if (files["/App.svelte"]) return "svelte";
    if (Object.keys(files).some((f) => f.endsWith(".component.ts") || f === "/angular.json")) return "angular";
    return "static";
  }, [files]);

  // Build the inspector-injected index.html. React uses /public/index.html,
  // everything else uses /index.html.
  const inspectorIndexHtml = useMemo(() => {
    const base = detectedTemplate === "react"
      ? (files?.["/public/index.html"] ?? FALLBACK_INDEX_HTML)
      : (files?.["/index.html"] ?? FALLBACK_INDEX_HTML);
    return injectInspectorScript(base);
  }, [files, detectedTemplate]);

  const sandpackFiles = useMemo(() => {
    if (!files) return null;
    const merged: Record<string, string> = { ...files, ...edits };
    if (detectedTemplate === "react") {
      merged["/public/index.html"] =
        edits["/public/index.html"] ?? inspectorIndexHtml;
    } else {
      merged["/index.html"] = edits["/index.html"] ?? inspectorIndexHtml;
    }
    return merged;
  }, [edits, files, inspectorIndexHtml, detectedTemplate]);

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center bg-white/80 text-sm text-slate-500 backdrop-blur-sm dark:bg-slate-950/80">
        No workspace selected.
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-white/80 p-4 text-sm text-red-500 backdrop-blur-sm dark:bg-slate-950/80 dark:text-red-400">
        Failed to load workspace files: {error}
      </div>
    );
  }
  if (!files || !sandpackFiles) {
    return (
      <div className="flex h-full items-center justify-center bg-white/80 text-sm text-slate-500 backdrop-blur-sm dark:bg-slate-950/80">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {!hideTabs && (
        <div className="flex items-end gap-1 overflow-x-auto border-b border-slate-200/60 bg-white/80 px-2 pt-2 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-950/80">
          <ChromeTab
            active={activeTab === "files"}
            onClick={() => onSelectTab("files")}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" /></svg>
            <span>Files</span>
          </ChromeTab>
          <ChromeTab
            active={activeTab === "preview"}
            onClick={() => onSelectTab("preview")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Preview</span>
          </ChromeTab>
          <ChromeTab
            active={activeTab === "design-system"}
            onClick={() => onSelectTab("design-system")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
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
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-sm transition ${
                  inspectMode
                    ? "border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
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
          className="absolute inset-0 overflow-hidden"
          style={{ display: activeTab === "files" ? "block" : "none" }}
        >
          <FilePanel
            workspace={workspace}
            refreshKey={refreshKey}
            onOpenFile={onOpenFile}
          />
        </div>
        <div
          className="absolute inset-0"
          style={{ display: activeTab === "preview" ? "block" : "none" }}
        >
          <SandpackProvider
            key={`${workspace}:${refreshKey}:${detectedTemplate}`}
            template={detectedTemplate}
            files={sandpackFiles}
            customSetup={detectedTemplate === "react" ? { dependencies: { "react-router-dom": "^7.5.0" } } : undefined}
            options={{ recompileMode: "delayed", recompileDelay: 200 }}
            theme="dark"
          >
            <SandpackLayout
              style={{ height: "100%", border: 0, borderRadius: 0 }}
            >
              <SandpackPreview
                style={{ height: "100%" }}
                showOpenInCodeSandbox={false}
                showRefreshButton={!hideTabs}
                showNavigator={false}
              />
            </SandpackLayout>
          </SandpackProvider>
          {runtimeErrors.length > 0 && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex justify-center">
              <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-xl border border-red-300 bg-white/95 shadow-lg backdrop-blur dark:border-red-500/40 dark:bg-slate-900/95">
                <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    {runtimeErrors.length} error{runtimeErrors.length > 1 ? "s" : ""} in preview
                  </span>
                  {onFixRuntimeErrors && (
                    <button
                      type="button"
                      onClick={() => {
                        onFixRuntimeErrors(runtimeErrors);
                        setRuntimeErrors([]);
                      }}
                      className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-500 bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-red-500"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                      </svg>
                      Fix with AI
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setErrorsCollapsed((v) => !v)}
                    className={`${onFixRuntimeErrors ? "" : "ml-auto "}rounded px-1.5 py-0.5 text-[10px] font-medium text-red-700 transition hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-500/20`}
                  >
                    {errorsCollapsed ? "Show" : "Hide"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuntimeErrors([])}
                    aria-label="Dismiss errors"
                    title="Dismiss"
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-700 transition hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-500/20"
                  >
                    Clear
                  </button>
                </div>
                {!errorsCollapsed && (
                  <div className="max-h-48 overflow-y-auto px-3 py-2 text-xs">
                    <ul className="space-y-2">
                      {runtimeErrors.map((err, i) => (
                        <li key={i} className="font-mono">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 inline-flex flex-shrink-0 items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-500/20 dark:text-red-300">
                              {err.kind}
                            </span>
                            <div className="min-w-0 flex-1 break-words text-slate-800 dark:text-slate-200">
                              <div>{err.message}</div>
                              {(err.source || err.line != null) && (
                                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                  {err.source ?? "<inline>"}{err.line != null ? `:${err.line}${err.col != null ? `:${err.col}` : ""}` : ""}
                                </div>
                              )}
                              {err.stack && (
                                <pre className="mt-1 whitespace-pre-wrap break-words text-[10px] text-slate-500 dark:text-slate-400">
                                  {err.stack}
                                </pre>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
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
          const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
          return (
            <div
              key={path}
              className="absolute inset-0"
              style={{ display: activeTab === path ? "block" : "none" }}
            >
              <CodeEditor
                value={content}
                onChange={(v) => handleEdit(path, v)}
                language={ext}
                dark={theme === "dark"}
              />
            </div>
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
      className={`group flex shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-slate-200/60 bg-white text-slate-900 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100"
          : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-300"
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
