"use client";

import { useState } from "react";
import type { ToolCall } from "./Message";

const MAX_PREVIEW_LINES = 20;

function extractPath(call: ToolCall): string {
  const i = call.input ?? {};
  return (
    (i as { file_path?: string }).file_path ??
    (i as { path?: string }).path ??
    "file"
  );
}

function InlineDiff({
  oldStr,
  newStr,
}: {
  oldStr: string;
  newStr: string;
}) {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  return (
    <pre className="mt-2 max-h-64 overflow-auto rounded bg-black/40 p-2 text-[11px] leading-snug">
      {oldLines.map((line, i) => (
        <div key={`o${i}`} className="bg-red-500/10 text-red-300">
          <span className="select-none opacity-50">- </span>
          {line}
        </div>
      ))}
      {newLines.map((line, i) => (
        <div key={`n${i}`} className="bg-emerald-500/10 text-emerald-300">
          <span className="select-none opacity-50">+ </span>
          {line}
        </div>
      ))}
    </pre>
  );
}

function ContentPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  const truncated = lines.length > MAX_PREVIEW_LINES;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? lines : lines.slice(0, MAX_PREVIEW_LINES);

  return (
    <div className="mt-2">
      <pre className="max-h-64 overflow-auto rounded bg-black/40 p-2 text-[11px] leading-snug text-emerald-200/80">
        {visible.join("\n")}
        {truncated && !expanded && "\n…"}
      </pre>
      {truncated && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[10px] text-slate-400 hover:text-slate-200"
        >
          {expanded
            ? "Show less"
            : `Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  );
}

export function DiffBlock({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const path = extractPath(call);
  const isEdit = call.name === "Edit" || call.name === "NotebookEdit";

  const oldStr = isEdit
    ? String((call.input as { old_string?: unknown }).old_string ?? "")
    : "";
  const newStr = isEdit
    ? String((call.input as { new_string?: unknown }).new_string ?? "")
    : "";
  const content = !isEdit
    ? String((call.input as { content?: unknown }).content ?? "")
    : "";

  const label = isEdit ? `Edit ${path}` : `Write ${path}`;

  const status = call.isError
    ? "border-red-500/40 bg-red-500/5 text-red-200"
    : call.result !== undefined
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-100"
      : "border-slate-700 bg-slate-800/40 text-slate-300";

  return (
    <div className={`rounded-md border px-3 py-2 text-xs font-mono ${status}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="truncate">
          <span className="opacity-60">{open ? "▾" : "▸"}</span> {label}
        </span>
        <span className="opacity-50">{call.name}</span>
      </button>
      {open && (
        <>
          {isEdit && oldStr && newStr ? (
            <InlineDiff oldStr={oldStr} newStr={newStr} />
          ) : isEdit && oldStr === newStr ? (
            <p className="mt-2 text-[11px] text-slate-400">No changes</p>
          ) : (
            <ContentPreview content={content} />
          )}
          {call.isError && call.result && (
            <pre className="mt-2 max-h-32 overflow-auto rounded bg-red-500/10 p-2 text-[11px] text-red-300">
              {call.result.slice(0, 2000)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
