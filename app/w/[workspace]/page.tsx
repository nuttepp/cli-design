"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { FilePanel } from "@/components/FilePanel";
import { PreviewPanel } from "@/components/PreviewPanel";

export default function StudioPage() {
  const params = useParams<{ workspace: string }>();
  const workspace = params?.workspace
    ? decodeURIComponent(params.workspace)
    : null;

  const [refreshKey, setRefreshKey] = useState(0);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("preview");
  const [fullscreen, setFullscreen] = useState(false);

  const openFile = (path: string) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveTab(path);
  };
  const closeFile = (path: string) => {
    setOpenFiles((prev) => prev.filter((p) => p !== path));
    setActiveTab((cur) => (cur === path ? "preview" : cur));
  };

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
        className={`grid min-h-0 flex-1 ${
          fullscreen ? "grid-cols-1" : "grid-cols-[260px_1fr_300px]"
        }`}
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
        <div className={`min-h-0 ${fullscreen ? "" : "border-r border-slate-800"}`}>
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
          <div className="min-h-0 overflow-hidden">
            <ChatPanel
              workspace={workspace}
              onTurnComplete={() => setRefreshKey((k) => k + 1)}
            />
          </div>
        )}
      </div>
    </main>
  );
}
