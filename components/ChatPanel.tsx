"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageView, type ChatMessage } from "./Message";
import type { UseChatResult } from "@/lib/useChat";
import type { SelectedElement } from "@/lib/previewInspector";
import type { ClarifyingQuestion } from "@/lib/clarifyingQuestions";
import { useModels } from "@/lib/useModels";

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
  cli?: string;
  selectedModel?: string;
  onModelChange?: (model: string | undefined) => void;
}

export function ChatPanel({
  workspace,
  chat,
  selectedElement,
  onClearSelection,
  onOpenBrief,
  cliName,
  cli = "claude",
  selectedModel,
  onModelChange,
}: Props) {
  const { models, defaultModel, loading: modelsLoading, refreshModels } = useModels(cli);
  const effectiveModel = selectedModel ?? defaultModel;

  // Auto-select default model when models load
  useEffect(() => {
    if (defaultModel && !selectedModel) {
      onModelChange?.(defaultModel);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultModel]);
  const [input, setInput] = useState("");
  type Attachment = {
    id: string;
    path: string;
    previewUrl: string;
    name: string;
    uploading: boolean;
    error?: string;
  };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const randomPrompts = useMemo(() => {
    const shuffled = [...PROMPT_SUGGESTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, []);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, busy, activity, elapsed, send, stop } = chat;

  const uploadImage = useCallback(
    async (file: File) => {
      if (!workspace) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      const placeholder: Attachment = {
        id,
        path: "",
        previewUrl,
        name: file.name || "pasted-image",
        uploading: true,
      };
      setAttachments((prev) => [...prev, placeholder]);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const res = await fetch(
          `/api/workspaces/${encodeURIComponent(workspace)}/attachments`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ dataUrl }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          path?: string;
          error?: string;
        };
        if (!res.ok || !data.path) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, path: data.path!, uploading: false } : a,
          ),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, uploading: false, error: msg } : a,
          ),
        );
      }
    },
    [workspace],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!workspace) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const images: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) images.push(f);
        }
      }
      if (images.length === 0) return;
      e.preventDefault();
      images.forEach((f) => void uploadImage(f));
    },
    [workspace, uploadImage],
  );

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
    const ready = attachments.filter((a) => !a.uploading && !a.error && a.path);
    if (!text && ready.length === 0) return;
    if (attachments.some((a) => a.uploading)) return;
    let composed = text;
    if (ready.length > 0) {
      const lines = ready.map((a) => `- ${a.path}`);
      const header = ready.length === 1 ? "Attached image:" : "Attached images:";
      composed = [header, ...lines, "", text].filter(Boolean).join("\n");
    }
    setInput("");
    attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
    await send(composed);
  };

  return (
    <div className="flex h-full flex-col bg-white/60 backdrop-blur-sm dark:bg-slate-900/40">
      <div className="flex items-center gap-2 border-b border-slate-200/60 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-800/60 dark:text-slate-300">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>Chat</span>
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
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-slate-200/60 px-2 py-2 dark:border-slate-700/60">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="group relative h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                  title={a.error ? `Failed: ${a.error}` : a.path || a.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.previewUrl} alt={a.name} className="h-full w-full object-cover" />
                  {a.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    </div>
                  )}
                  {a.error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-600/70 text-[9px] font-bold text-white">
                      ERROR
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    aria-label="Remove attachment"
                    className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/80 text-[10px] leading-none text-white opacity-0 transition group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
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
            onPaste={onPaste}
            placeholder={
              !workspace
                ? "Pick a workspace first."
                : "Describe a UI to build… (paste an image to attach)"
            }
            disabled={!workspace || busy}
            rows={1}
            className="block max-h-[200px] w-full resize-none overflow-y-auto rounded-xl bg-transparent px-3 py-2 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={
              !workspace ||
              busy ||
              attachments.some((a) => a.uploading) ||
              (!input.trim() && attachments.filter((a) => a.path && !a.error).length === 0)
            }
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
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          {models.length > 0 ? (
            <div className="flex items-center gap-1">
              <select
                value={effectiveModel}
                onChange={(e) => onModelChange?.(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {models.filter((m) => m !== "default").map((m) => (
                  <option key={m} value={m}>{m}{m === defaultModel ? " (default)" : ""}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={refreshModels}
                disabled={modelsLoading}
                aria-label="Refresh models"
                title="Refresh models"
                className="rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={modelsLoading ? "animate-spin" : ""}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </div>
          ) : (
            <span />
          )}
          <div className="ml-auto flex items-center gap-2">
            {busy ? (
              <span className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                </span>
                <span className="truncate max-w-[14rem]" title={activity}>
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
            ) : cliName ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {cliName}
              </span>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}


