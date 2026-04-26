"use client";

import { useState } from "react";

export type ChatRole = "user" | "assistant";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  thinking: string;
  toolCalls: ToolCall[];
  pending?: boolean;
}

function describeTool(call: ToolCall): string {
  const i = call.input ?? {};
  const path = (i as { file_path?: string; path?: string }).file_path ??
    (i as { path?: string }).path;
  switch (call.name) {
    case "Edit":
      return path ? `Edit ${path}` : "Edit file";
    case "Write":
      return path ? `Write ${path}` : "Write file";
    case "Read":
      return path ? `Read ${path}` : "Read file";
    case "Bash": {
      const cmd = (i as { command?: string }).command ?? "";
      return `Bash: ${cmd.slice(0, 80)}${cmd.length > 80 ? "…" : ""}`;
    }
    case "Glob":
    case "Grep":
      return `${call.name} ${(i as { pattern?: string }).pattern ?? ""}`.trim();
    default:
      return call.name;
  }
}

function ToolBlock({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const summary = describeTool(call);
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
          <span className="opacity-60">{open ? "▾" : "▸"}</span> {summary}
        </span>
        <span className="opacity-50">{call.name}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <pre className="max-h-48 overflow-auto rounded bg-black/40 p-2 text-[11px] leading-snug">
            {JSON.stringify(call.input, null, 2)}
          </pre>
          {call.result !== undefined && (
            <pre className="max-h-48 overflow-auto rounded bg-black/40 p-2 text-[11px] leading-snug">
              {call.result.slice(0, 4000)}
              {call.result.length > 4000 ? "\n…(truncated)" : ""}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ThinkingBlock({
  text,
  active,
}: {
  text: string;
  active: boolean;
}) {
  // Auto-open while the turn is in progress so the user can watch reasoning;
  // collapsed once the turn completes (still inspectable on click).
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? active;
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
      <button
        type="button"
        onClick={() => setOpenOverride(!open)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="opacity-60">{open ? "▾" : "▸"}</span>
          <span className="font-medium">Thinking</span>
          {active && (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
          )}
        </span>
        <span className="tabular-nums opacity-50">
          {text.length.toLocaleString()} chars
        </span>
      </button>
      {open && (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 font-mono text-[11px] leading-snug text-amber-50/90">
          {text || "…"}
        </pre>
      )}
    </div>
  );
}

export function MessageView({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] space-y-2 rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-slate-800/60 text-slate-100"
        }`}
      >
        {message.thinking && (
          <ThinkingBlock
            text={message.thinking}
            active={Boolean(message.pending)}
          />
        )}
        {message.text && (
          <div className="whitespace-pre-wrap leading-relaxed">
            {message.text}
            {message.pending && (
              <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-current align-middle" />
            )}
          </div>
        )}
        {message.toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {message.toolCalls.map((c) => (
              <ToolBlock key={c.id} call={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
