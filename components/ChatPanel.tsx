"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageView, type ChatMessage } from "./Message";
import type { UseChatResult } from "@/lib/useChat";
import type { SelectedElement } from "@/lib/previewInspector";
import type { ClarifyingQuestion } from "@/lib/clarifyingQuestions";

const PROMPT_SUGGESTIONS = [
  "Build a landing page with hero and pricing section",
  "Create a dashboard with charts and sidebar navigation",
  "Design a portfolio with project cards and contact form",
  "Make a blog layout with featured posts and categories",
  "Build a login page with social sign-in buttons",
  "Create a settings page with tabs and form inputs",
  "Design a product card grid with filters and sorting",
  "Build a chat interface with message bubbles and input",
  "Create a file upload page with drag-and-drop zone",
  "Design a calendar view with events and navigation",
  "Build a kanban board with draggable columns",
  "Create a notification center with grouped alerts",
  "Design a user profile page with avatar and stats",
  "Build a checkout flow with cart summary and payment",
  "Create a music player with playlist and controls",
  "Design a weather widget with forecast cards",
  "Build a recipe page with ingredients and steps",
  "Create a timeline component with milestones",
  "Design a pricing table with feature comparison",
  "Build a search results page with filters sidebar",
  "Create a multi-step form with progress indicator",
  "Design a photo gallery with lightbox preview",
  "Build a task list with checkboxes and priorities",
  "Create a navigation bar with dropdown menus",
  "Design a testimonial carousel with avatars",
  "Build a FAQ accordion with smooth animations",
  "Create a stats dashboard with KPI cards and charts",
  "Design an email template with header and footer",
  "Build a social media feed with posts and reactions",
  "Create a 404 error page with illustration",
];

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
  const randomPrompts = useMemo(() => {
    const shuffled = [...PROMPT_SUGGESTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, []);
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
    <div className="flex h-full flex-col bg-white/60 backdrop-blur-sm dark:bg-slate-900/40">
      <div className="flex items-center gap-2 border-b border-slate-200/60 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-800/60 dark:text-slate-300">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
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
              className="rounded-md border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
        {workspace && messages.length === 0 && !busy && (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-cyan-500/10 dark:from-indigo-500/20 dark:via-purple-500/20 dark:to-cyan-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              What would you like to build?
            </p>
            <p className="mt-1 max-w-[220px] text-xs text-slate-400 dark:text-slate-500">
              Describe a UI below and the AI will generate it in the preview.
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              {randomPrompts.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setInput(hint)}
                  className="whitespace-nowrap rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m: ChatMessage, i: number) => (
          <MessageView
            key={m.id}
            message={m}
            onOpenBrief={i === messages.length - 1 ? onOpenBrief : undefined}
          />
        ))}
      </div>
      <form
        className="border-t border-slate-200/60 p-3 dark:border-slate-800/60"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
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
            className="block max-h-[200px] w-full resize-none overflow-y-auto rounded-xl bg-transparent px-3 py-2 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!workspace || busy || !input.trim()}
            aria-label={busy ? "Working" : "Send"}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
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


