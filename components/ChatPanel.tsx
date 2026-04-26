"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageView, type ChatMessage, type ToolCall } from "./Message";

interface Props {
  workspace: string | null;
  onTurnComplete: () => void;
}

interface ChatStreamEvent {
  type?: string;
  subtype?: string;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      thinking?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
      tool_use_id?: string;
      content?: unknown;
    }>;
  };
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
  };
  index?: number;
  content_block?: {
    type?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    text?: string;
    thinking?: string;
  };
  result?: string;
  error?: string;
  is_error?: boolean;
  parent_tool_use_id?: string;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) =>
        typeof b === "string"
          ? b
          : b && typeof b === "object" && "text" in b
            ? String((b as { text?: unknown }).text ?? "")
            : "",
      )
      .join("\n");
  }
  return JSON.stringify(content);
}

export function ChatPanel({ workspace, onTurnComplete }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Tick a wall-clock counter while a turn is in flight, so the user can
  // tell the app is still alive even during long tool runs.
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [busy]);

  // Wipe transcript when switching workspaces (server-side session is also
  // keyed per-workspace, so this just resets the visible view).
  useEffect(() => {
    setMessages([]);
  }, [workspace]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const updateAssistant = useCallback(
    (assistantId: string, mut: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? mut(m) : m)),
      );
    },
    [],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !workspace || busy) return;

    const userMsg: ChatMessage = {
      id: newId(),
      role: "user",
      text,
      thinking: "",
      toolCalls: [],
    };
    const assistantId = newId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      text: "",
      thinking: "",
      toolCalls: [],
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setBusy(true);
    setActivity("starting claude…");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace, message: text }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload) as ChatStreamEvent;
            handleEvent(evt, assistantId);
          } catch {
            // Ignore malformed frames.
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      updateAssistant(assistantId, (m) => ({
        ...m,
        text: m.text + `\n\n[error: ${message}]`,
      }));
    } finally {
      updateAssistant(assistantId, (m) => ({ ...m, pending: false }));
      setBusy(false);
      setActivity("");
      abortRef.current = null;
      onTurnComplete();
    }

    function handleEvent(evt: ChatStreamEvent, id: string) {
      // System init — Claude is connected.
      if (evt.type === "system" && evt.subtype === "init") {
        setActivity("thinking…");
        return;
      }

      // Partial thinking deltas — surface reasoning as it streams.
      if (evt.type === "stream_event" && evt.delta?.type === "thinking_delta") {
        const t = evt.delta.thinking ?? "";
        if (t) {
          setActivity("thinking…");
          updateAssistant(id, (m) => ({ ...m, thinking: m.thinking + t }));
        }
        return;
      }

      // Partial text deltas (--include-partial-messages).
      if (evt.type === "stream_event" && evt.delta?.type === "text_delta") {
        const t = evt.delta.text ?? "";
        if (t) {
          setActivity("writing reply…");
          updateAssistant(id, (m) => ({ ...m, text: m.text + t }));
        }
        return;
      }

      // Full assistant message (arrives at end of a turn block).
      if (evt.type === "assistant" && evt.message?.content) {
        for (const block of evt.message.content) {
          // Capture thinking blocks even if partial deltas didn't arrive.
          if (block.type === "thinking" && block.thinking) {
            const full = block.thinking;
            updateAssistant(id, (m) =>
              m.thinking.length >= full.length ? m : { ...m, thinking: full },
            );
          }
          if (block.type === "tool_use" && block.id) {
            const toolName = block.name ?? "tool";
            const path =
              (block.input as { file_path?: string; path?: string } | undefined)
                ?.file_path ??
              (block.input as { path?: string } | undefined)?.path;
            setActivity(
              path ? `${toolName} → ${path}` : `running ${toolName}…`,
            );
            updateAssistant(id, (m) => {
              if (m.toolCalls.some((c) => c.id === block.id)) return m;
              const call: ToolCall = {
                id: block.id!,
                name: toolName,
                input: block.input ?? {},
              };
              return { ...m, toolCalls: [...m.toolCalls, call] };
            });
          }
        }
        return;
      }

      // Tool results come in as user messages with tool_result blocks.
      if (evt.type === "user" && evt.message?.content) {
        for (const block of evt.message.content) {
          if (block.type === "tool_result" && block.tool_use_id) {
            const result = toolResultText(block.content);
            const isError = Boolean(
              (block as unknown as { is_error?: boolean }).is_error,
            );
            setActivity(isError ? "tool errored, recovering…" : "thinking…");
            updateAssistant(id, (m) => ({
              ...m,
              toolCalls: m.toolCalls.map((c) =>
                c.id === block.tool_use_id ? { ...c, result, isError } : c,
              ),
            }));
          }
        }
        return;
      }

      if (evt.type === "result") {
        setActivity("finishing…");
        return;
      }

      if (evt.type === "error") {
        const msg = evt.error ?? "Unknown error";
        updateAssistant(id, (m) => ({
          ...m,
          text: m.text + `\n\n[error: ${msg}]`,
        }));
      }
    }
  }, [busy, input, onTurnComplete, updateAssistant, workspace]);

  const stop = () => abortRef.current?.abort();

  return (
    <div className="flex h-full flex-col bg-slate-900/40">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2 text-sm text-slate-400">
        <span>Chat</span>
        {busy && (
          <span className="ml-auto flex items-center gap-2 text-xs text-indigo-300">
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
              className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
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
        {messages.map((m) => (
          <MessageView key={m.id} message={m} />
        ))}
      </div>
      <form
        className="border-t border-slate-800 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={
              workspace
                ? "Describe a UI to build…"
                : "Pick a workspace first."
            }
            disabled={!workspace || busy}
            rows={2}
            className="flex-1 resize-none rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!workspace || busy || !input.trim()}
            className="self-end inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {busy ? "Working" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
