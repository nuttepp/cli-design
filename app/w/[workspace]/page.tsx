"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { FilePanel } from "@/components/FilePanel";
import { PreviewPanel } from "@/components/PreviewPanel";

const CHAT_MIN_WIDTH = 200;
const CHAT_DEFAULT_WIDTH = 400;
const FILE_PANEL_WIDTH = 260;
const PREVIEW_MIN_WIDTH = 300;
const RESIZER_WIDTH = 4;

export default function StudioPage() {
  const params = useParams<{ workspace: string }>();
  const workspace = params?.workspace
    ? decodeURIComponent(params.workspace)
    : null;

  const [refreshKey, setRefreshKey] = useState(0);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("preview");
  const [fullscreen, setFullscreen] = useState(false);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_WIDTH);
  const resizingRef = useRef(false);

  const openFile = (path: string) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveTab(path);
  };
  const closeFile = (path: string) => {
    setOpenFiles((prev) => prev.filter((p) => p !== path));
    setActiveTab((cur) => (cur === path ? "preview" : cur));
  };

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
      <header className="flex items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2">
        <Link
          href="/"
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          ← Workspaces
        </Link>
        <h1 className="text-sm font-semibold text-slate-100">
          {workspace ?? "—"}
        </h1>
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
          className="ml-auto rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
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
          <div className="min-h-0 overflow-hidden border-r border-slate-800">
            <FilePanel
              workspace={workspace}
              refreshKey={refreshKey}
              onOpenFile={openFile}
            />
          </div>
        )}
        <div className="min-h-0">
          <PreviewPanel
            workspace={workspace}
            refreshKey={refreshKey}
            openFiles={openFiles}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onCloseFile={closeFile}
            hideTabs={fullscreen}
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
              className="group relative cursor-col-resize touch-none select-none border-l border-slate-800 bg-slate-800 transition-colors hover:bg-indigo-500/60"
            >
              <span className="absolute inset-y-0 -left-1 -right-1" />
            </div>
            <div className="min-h-0 overflow-hidden">
              <ChatPanel
                workspace={workspace}
                onTurnComplete={() => setRefreshKey((k) => k + 1)}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
