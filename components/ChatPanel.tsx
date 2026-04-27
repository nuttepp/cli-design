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
  cliName?: string;
}

export function ChatPanel({
  workspace,
  chat,
  selectedElement,
  onClearSelection,
  onOpenBrief,
  cliName,
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
    await send(text);
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900/40">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
        <span>Chat</span>
        {cliName && !busy && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {cliName}
          </span>
        )}
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


