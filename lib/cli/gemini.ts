import { spawn } from "node:child_process";
import { streamJsonLines } from "./spawn";
import { SYSTEM_PROMPT } from "./systemPrompt";
import type { CliEvent, SpawnCliOptions } from "./types";

/**
 * Gemini stream-json event types:
 *   init     → { type: "init", session_id, model }
 *   message  → { type: "message", role: "user"|"assistant", content, delta? }
 *   tool_use → { type: "tool_use", name, id, input }
 *   tool_result → { type: "tool_result", tool_use_id, content }
 *   result   → { type: "result", status, stats }
 *
 * We normalize these into Claude's event format so useChat.ts works unchanged.
 */

interface GeminiEvent {
  type: string;
  session_id?: string;
  role?: string;
  content?: string;
  delta?: boolean;
  status?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  stats?: unknown;
}

function normalizeGeminiEvent(raw: GeminiEvent): CliEvent | null {
  switch (raw.type) {
    case "init":
      return {
        type: "system",
        subtype: "init",
        session_id: raw.session_id ?? "",
      };

    case "message":
      if (raw.role === "assistant" && raw.content) {
        return {
          type: "stream_event",
          delta: {
            type: "text_delta",
            text: raw.content,
          },
        };
      }
      return null;

    case "tool_use":
      return {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: raw.id ?? `tool-${Date.now()}`,
              name: raw.name ?? "tool",
              input: raw.input ?? {},
            },
          ],
        },
      };

    case "tool_result":
      return {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: raw.tool_use_id ?? "",
              content: String(raw.content ?? ""),
            },
          ],
        },
      };

    case "result":
      return {
        type: "result",
        result: "",
      };

    default:
      return null;
  }
}

export async function* spawnGemini(
  opts: SpawnCliOptions,
): AsyncGenerator<CliEvent, void, void> {
  const fullMessage = `<system_instructions>\n${SYSTEM_PROMPT}\n</system_instructions>\n\n${opts.message}`;

  const args: string[] = [
    "-p",
    "-",
    "--output-format",
    "stream-json",
    "--approval-mode",
    "yolo",
    "--skip-trust",
  ];
  if (opts.sessionId) {
    args.push("--resume", opts.sessionId);
  }

  const proc = spawn("gemini", args, {
    cwd: opts.cwd,
    env: { ...process.env, GEMINI_CLI_TRUST_WORKSPACE: "true" },
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  proc.stdin!.end(fullMessage);

  for await (const line of streamJsonLines(proc, opts.signal)) {
    try {
      const raw = JSON.parse(line) as GeminiEvent;
      const normalized = normalizeGeminiEvent(raw);
      if (normalized) yield normalized;
    } catch {
      // Skip non-JSON lines (e.g. "YOLO mode is enabled")
    }
  }
}
