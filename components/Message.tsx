"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import {
  parseClarifyingQuestions,
  type ClarifyingQuestion,
} from "@/lib/clarifyingQuestions";

import { DiffBlock } from "./DiffBlock";

export type ChatRole = "user" | "assistant";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface ElementRef {
  tag: string;
  id: string | null;
  classList: string[];
  selector: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  thinking: string;
  toolCalls: ToolCall[];
  pending?: boolean;
  elementRef?: ElementRef;
  timestamp?: number;
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

interface MessageViewProps {
  message: ChatMessage;
  onOpenBrief?: (
    messageId: string,
    questions: ClarifyingQuestion[],
  ) => void;
  onUndo?: () => void;
}


export function MessageView({
  message,
  onOpenBrief,
  onUndo,
}: MessageViewProps) {
  const isUser = message.role === "user";
  const hasActivity =
    Boolean(message.thinking) || message.toolCalls.length > 0;

  const parsed =
    !isUser && !message.pending
      ? parseClarifyingQuestions(message.text)
      : null;
  const visibleText = parsed ? parsed.cleanText : message.text;

  const timeStr = message.timestamp
    ? (() => {
        const d = new Date(message.timestamp!);
        const now = new Date();
        const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        return isToday
          ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      })()
    : null;

  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && timeStr && (
        <span className="mb-1 shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{timeStr}</span>
      )}
      <div
        className={`max-w-[80%] space-y-2 rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-white text-slate-900 ring-1 ring-slate-200/60 dark:bg-slate-800/60 dark:text-slate-100 dark:ring-slate-700/40"
        }`}
      >
        {isUser && message.elementRef && (
          <div className="flex items-center gap-1.5 rounded bg-indigo-500/30 px-2 py-1 text-[11px]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M3 3l7.07 17 2.51-7.42L20 10.07z" /></svg>
            <span className="font-mono opacity-90">
              &lt;{message.elementRef.tag}
              {message.elementRef.id ? `#${message.elementRef.id}` : ""}
              {message.elementRef.classList.length
                ? `.${message.elementRef.classList.slice(0, 2).join(".")}`
                : ""}
              &gt;
            </span>
          </div>
        )}
        {!isUser && hasActivity && (
          <ActivityLog
            thinking={message.thinking}
            toolCalls={message.toolCalls}
            active={Boolean(message.pending)}
          />
        )}
        {visibleText && (
          <div className="leading-relaxed">
            <div className={`prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-pre:my-2 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-lg ${
              isUser
                ? "prose-invert prose-code:bg-white/15 prose-pre:bg-black/20"
                : "dark:prose-invert prose-code:bg-black/10 dark:prose-code:bg-white/10 prose-pre:bg-black/20 dark:prose-pre:bg-black/40"
            }`}>
              <Markdown>{visibleText}</Markdown>
            </div>
            {message.pending && (
              <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-current align-middle" />
            )}
          </div>
        )}
        {parsed && onOpenBrief && (
          <button
            type="button"
            onClick={() => onOpenBrief(message.id, parsed.questions)}
            className="inline-flex items-center gap-2 rounded-md border border-indigo-400/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20"
          >
            Open brief ({parsed.questions.length} questions) →
          </button>
        )}
        {onUndo && !message.pending && (
          <button
            type="button"
            onClick={onUndo}
            className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Undo this turn
          </button>
        )}
      </div>
      {isUser && timeStr && (
        <span className="mb-1 shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{timeStr}</span>
      )}
    </div>
  );
}

function CollapsedSteps({ calls }: { calls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-200/40 hover:text-slate-600 dark:hover:bg-slate-800/60 dark:hover:text-slate-300"
      >
        <span className="opacity-60">{expanded ? "▾" : "▸"}</span>
        {expanded ? "Hide" : "Show"} {calls.length} earlier {calls.length === 1 ? "step" : "steps"}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5">
          {calls.map((c) => {
            const isFileWrite = ["Write", "Edit", "NotebookEdit"].includes(c.name);
            return isFileWrite ? (
              <DiffBlock key={c.id} call={c} />
            ) : (
              <ToolBlock key={c.id} call={c} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityLog({
  thinking,
  toolCalls,
  active,
}: {
  thinking: string;
  toolCalls: ToolCall[];
  active: boolean;
}) {
  // Auto-open while pending so the user sees progress; collapses on completion.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? active;
  const count =
    (thinking ? 1 : 0) + toolCalls.length;
  const errored = toolCalls.some((c) => c.isError);
  const summaryLabel = active
    ? "Working…"
    : "Activity";

  return (
    <div
      className="rounded-md border border-slate-200 bg-white/60 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200"
    >
      <button
        type="button"
        onClick={() => setOpenOverride(!open)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="opacity-60">{open ? "▾" : "▸"}</span>
          <span className="font-medium">{summaryLabel}</span>
          {active && (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-300" />
          )}
        </span>
        <span className="tabular-nums opacity-50">
          {count} {count === 1 ? "step" : "steps"}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {thinking && (
            <ThinkingBlock text={thinking} active={active} />
          )}
          {(() => {
            const VISIBLE_TAIL = 3;
            const hiddenCount = active ? Math.max(0, toolCalls.length - VISIBLE_TAIL) : 0;
            const visibleCalls = active ? toolCalls.slice(hiddenCount) : toolCalls;
            return (
              <>
                {hiddenCount > 0 && (
                  <CollapsedSteps calls={toolCalls.slice(0, hiddenCount)} />
                )}
                {visibleCalls.map((c) => {
                  const isFileWrite = ["Write", "Edit", "NotebookEdit"].includes(c.name);
                  return isFileWrite ? (
                    <DiffBlock key={c.id} call={c} />
                  ) : (
                    <ToolBlock key={c.id} call={c} />
                  );
                })}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
