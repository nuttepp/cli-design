"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ToolCall } from "@/components/Message";
import type { SelectedElement } from "./previewInspector";

interface UseChatOptions {
  workspace: string | null;
  onTurnComplete: () => void;
}

interface SendOptions {
  selectedElement?: SelectedElement | null;
  styleOverrides?: Record<string, string> | null;
}

export interface UseChatResult {
  messages: ChatMessage[];
  busy: boolean;
  activity: string;
  elapsed: number;
  send: (text: string, opts?: SendOptions) => Promise<void>;
  stop: () => void;
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
  result?: string;
  error?: string;
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

export function useChat({
  workspace,
  onTurnComplete,
}: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const toolNamesRef = useRef<Map<string, string>>(new Map());

  const FILE_WRITING_TOOLS = new Set(["Write", "Edit", "NotebookEdit"]);

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

  // Reset transcript on workspace change. The server-side session is also
  // keyed per-workspace, so this just resets the visible view.
  useEffect(() => {
    setMessages([]);
  }, [workspace]);

  const updateAssistant = useCallback(
    (assistantId: string, mut: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? mut(m) : m)),
      );
    },
    [],
  );

  const send = useCallback(
    async (text: string, opts?: SendOptions) => {
      const trimmed = text.trim();
      if (!trimmed || !workspace || busy) return;

      const sentSelection = opts?.selectedElement ?? null;
      const styleOverrides = opts?.styleOverrides ?? null;

      let userText = trimmed;
      if (styleOverrides && Object.keys(styleOverrides).length > 0) {
        const overrideLines = Object.entries(styleOverrides)
          .map(([k, v]) => `  ${k}: ${v};`)
          .join("\n");
        userText = `${trimmed}\n\n<live_style_overrides>\nThe user has previewed these inline-style overrides on the selected element. Persist them in the source code (or further refine as requested):\n${overrideLines}\n</live_style_overrides>`;
      }

      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        text: trimmed,
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
      setBusy(true);
      setActivity("starting claude…");
      toolNamesRef.current.clear();

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspace,
            message: userText,
            selectedElement: sentSelection,
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

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
        if (evt.type === "system" && evt.subtype === "init") {
          setActivity("thinking…");
          return;
        }
        if (evt.type === "stream_event" && evt.delta?.type === "thinking_delta") {
          const t = evt.delta.thinking ?? "";
          if (t) {
            setActivity("thinking…");
            updateAssistant(id, (m) => ({ ...m, thinking: m.thinking + t }));
          }
          return;
        }
        if (evt.type === "stream_event" && evt.delta?.type === "text_delta") {
          const t = evt.delta.text ?? "";
          if (t) {
            setActivity("writing reply…");
            updateAssistant(id, (m) => ({ ...m, text: m.text + t }));
          }
          return;
        }
        if (evt.type === "assistant" && evt.message?.content) {
          for (const block of evt.message.content) {
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
              toolNamesRef.current.set(block.id, toolName);
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
              const toolName = toolNamesRef.current.get(block.tool_use_id);
              if (!isError && toolName && FILE_WRITING_TOOLS.has(toolName)) {
                onTurnComplete();
              }
            }
          }
          return;
        }
        if (evt.type === "result") {
          setActivity("finishing…");
          const finalText = typeof evt.result === "string" ? evt.result : "";
          if (finalText) {
            updateAssistant(id, (m) =>
              m.text.trim().length > 0 ? m : { ...m, text: finalText },
            );
          }
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
    },
    [busy, onTurnComplete, updateAssistant, workspace],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { messages, busy, activity, elapsed, send, stop };
}
