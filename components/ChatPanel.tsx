"use client";

import { useEffect, useRef, useState } from "react";
import { MessageView, type ChatMessage } from "./Message";
import type { UseChatResult } from "@/lib/useChat";
import type { SelectedElement } from "@/lib/previewInspector";
import type { ClarifyingQuestion } from "@/lib/clarifyingQuestions";

interface Props {
  workspace: string | null;
  chat: UseChatResult;
  selectedElement: SelectedElement | null;
  onClearSelection: () => void;
  onOpenBrief?: (messageId: string, questions: ClarifyingQuestion[]) => void;
}

export function ChatPanel({
  workspace,
  chat,
  selectedElement,
  onClearSelection,
  onOpenBrief,
}: Props) {
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, busy, activity, elapsed, send, stop } = chat;

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const submit = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const sentSelection = selectedElement;
    await send(text, { selectedElement: sentSelection });
    if (sentSelection) onClearSelection();
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900/40">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
        <span>Chat</span>
        {busy && (
          <span className="ml-auto flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </span>
            <span className="truncate max-w-[18rem]" title={activity}>
              {activity || "working…"}
            </span>
            <span className="tabular-nums text-slate-500">{elapsed}s</span>
            <button
              type="button"
              onClick={stop}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Stop
            </button>
          </span>
        )}
      </div>
      <div
        ref={scrollerRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {!workspace && (
          <p className="text-sm text-slate-500">
            Select or create a workspace to start chatting.
          </p>
        )}
        {messages.map((m: ChatMessage) => (
          <MessageView
            key={m.id}
            message={m}
            onAnswerQuestions={(text) => void send(text)}
            onOpenBrief={onOpenBrief}
          />
        ))}
      </div>
      <form
        className="border-t border-slate-200 p-3 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {selectedElement && (
          <SelectedElementChip
            element={selectedElement}
            onClear={onClearSelection}
          />
        )}
        <div className="relative rounded-md bg-slate-100 dark:bg-slate-900/60">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={
              !workspace
                ? "Pick a workspace first."
                : selectedElement
                  ? `Tell Claude what to change about <${selectedElement.tag}>…`
                  : "Describe a UI to build…"
            }
            disabled={!workspace || busy}
            rows={1}
            className="block max-h-[200px] w-full resize-none overflow-y-auto rounded-md bg-transparent px-3 py-1.5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!workspace || busy || !input.trim()}
            aria-label={busy ? "Working" : "Send"}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-indigo-400 transition hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25H10a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.085l-1.414 4.926a.75.75 0 0 0 1.06.826l14-7a.75.75 0 0 0 0-1.342l-14-7a.75.75 0 0 0-.234-.056Z" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

const CSS_GROUPS: Array<{ label: string; props: string[] }> = [
  {
    label: "Color",
    props: ["color", "background-color", "background-image"],
  },
  {
    label: "Typography",
    props: [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "letter-spacing",
      "text-align",
    ],
  },
  {
    label: "Box",
    props: [
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "border-top-width",
      "border-right-width",
      "border-bottom-width",
      "border-left-width",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
      "border-radius",
      "box-shadow",
    ],
  },
  {
    label: "Layout",
    props: [
      "display",
      "flex-direction",
      "justify-content",
      "align-items",
      "gap",
      "grid-template-columns",
      "grid-template-rows",
      "width",
      "height",
      "min-width",
      "max-width",
      "opacity",
      "transform",
    ],
  },
];

function SelectedElementChip({
  element,
  onClear,
}: {
  element: SelectedElement;
  onClear: () => void;
}) {
  const groups = CSS_GROUPS.map((g) => ({
    label: g.label,
    entries: g.props
      .filter((p) => element.css[p] !== undefined)
      .map((p) => [p, element.css[p]!] as [string, string]),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="mb-2 max-h-[40vh] overflow-y-auto rounded-md border border-indigo-500/40 bg-indigo-500/5 p-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[11px] text-indigo-200">
          &lt;{element.tag}
          {element.id ? `#${element.id}` : ""}
          {element.classList.length
            ? `.${element.classList.slice(0, 2).join(".")}`
            : ""}
          &gt;
        </span>
        <span
          className="truncate font-mono text-[11px] text-slate-400"
          title={element.selector}
        >
          {element.selector}
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="ml-auto rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          ×
        </button>
      </div>
      {groups.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer select-none text-[11px] text-slate-400 hover:text-slate-200">
            CSS context ({groups.reduce((n, g) => n + g.entries.length, 0)})
          </summary>
          <div className="mt-2 space-y-2">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {g.label}
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.entries.map(([prop, value]) => (
                    <CssChip key={prop} prop={prop} value={value} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer select-none text-[11px] text-slate-400 hover:text-slate-200">
          HTML
        </summary>
        <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-950/60 p-2 font-mono text-[10px] leading-snug text-slate-300">
          {element.html}
        </pre>
      </details>
    </div>
  );
}

const COLOR_PROPS = new Set([
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
]);

function CssChip({ prop, value }: { prop: string; value: string }) {
  const isColor = COLOR_PROPS.has(prop) && value !== "transparent";
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded border border-slate-700 bg-slate-900/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
      title={`${prop}: ${value}`}
    >
      {isColor && (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-600"
          style={{ background: value }}
        />
      )}
      <span className="text-slate-500">{prop}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}
