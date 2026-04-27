"use client";

import { useEffect, useMemo, useState } from "react";

interface Props {
  workspace: string | null;
  refreshKey: number;
  onOpenFile?: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  isFile: boolean;
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "/", path: "/", children: [], isFile: false };
  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1;
      let next = node.children.find((c) => c.name === part);
      if (!next) {
        next = {
          name: part,
          path: "/" + parts.slice(0, i + 1).join("/"),
          children: [],
          isFile: isLast,
        };
        node.children.push(next);
      }
      node = next;
    });
  }
  // Sort: directories first, then alpha
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

function fileIcon(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "tsx":
    case "jsx":
      return "⚛";
    case "ts":
    case "js":
      return "𝙅";
    case "css":
      return "✧";
    case "html":
      return "❮❯";
    case "json":
      return "{}";
    case "md":
      return "✎";
    default:
      return "•";
  }
}

function FileTree({
  node,
  depth,
  selected,
  onSelect,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
  onOpen?: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);

  if (node.isFile) {
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        onDoubleClick={() => onOpen?.(node.path)}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
          selected === node.path
            ? "bg-indigo-500/15 text-indigo-700 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-200"
            : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="w-4 text-center opacity-60">{fileIcon(node.name)}</span>
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  // Directory
  if (node.path === "/") {
    return (
      <div>
        {node.children.map((c) => (
          <FileTree
            key={c.path}
            node={c}
            depth={depth}
            selected={selected}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <span className="w-3 text-center">{open ? "▾" : "▸"}</span>
        <span className="opacity-60">▣</span>
        <span className="truncate">{node.name}</span>
      </button>
      {open &&
        node.children.map((c) => (
          <FileTree
            key={c.path}
            node={c}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        ))}
    </div>
  );
}

export function FilePanel({ workspace, refreshKey, onOpenFile }: Props) {
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) {
      setFiles(null);
      setSelected(null);
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
        setSelected((cur) => (cur && files[cur] ? cur : null));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [workspace, refreshKey]);

  const tree = useMemo(
    () => (files ? buildTree(Object.keys(files)) : null),
    [files],
  );
  const fileCount = files ? Object.keys(files).length : 0;

  return (
    <div className="flex h-full flex-col bg-white/60 backdrop-blur-sm dark:bg-slate-950/60">
      <div className="flex items-center gap-2 border-b border-slate-200/60 px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-800/60 dark:text-slate-300">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" /></svg>
        <span>Files</span>
        {workspace && (
          <span className="ml-auto text-xs text-slate-500">
            {fileCount} file{fileCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {!workspace ? (
        <div className="p-3 text-xs text-slate-500">No workspace selected.</div>
      ) : error ? (
        <div className="p-3 text-xs text-red-500 dark:text-red-400">{error}</div>
      ) : !tree ? (
        <div className="p-3 text-xs text-slate-500">Loading…</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          <FileTree
            node={tree}
            depth={0}
            selected={selected}
            onSelect={setSelected}
            onOpen={onOpenFile}
          />
          {fileCount === 0 && (
            <p className="px-3 py-2 text-xs text-slate-500">
              Empty. Ask AI to create something.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
