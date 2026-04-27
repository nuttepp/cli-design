import { spawn } from "node:child_process";
import { streamJsonLines } from "./spawn";
import { SYSTEM_PROMPT } from "./systemPrompt";
import type { CliEvent, SpawnCliOptions } from "./types";

/**
 * Kilo event types from --format json:
 *   step_start  → { type, sessionID, part: { id, sessionID, messageID, type: "step-start" } }
 *   text        → { type, sessionID, part: { text, type: "text" } }
 *   tool_call   → { type, sessionID, part: { name, input, type: "tool-call" } }
 *   tool_result → { type, sessionID, part: { content, type: "tool-result" } }
 *   step_finish → { type, sessionID, part: { reason, cost, tokens, type: "step-finish" } }
 *
 * We normalize these into Claude's event format so useChat.ts works unchanged.
 */

interface KiloPart {
  id?: string;
  sessionID?: string;
  messageID?: string;
  type?: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  reason?: string;
  cost?: number;
  tokens?: unknown;
}

interface KiloEvent {
  type: string;
  timestamp?: number;
  sessionID?: string;
  part?: KiloPart;
}

function normalizeKiloEvent(raw: KiloEvent): CliEvent | null {
  switch (raw.type) {
    case "step_start":
      return {
        type: "system",
        subtype: "init",
        session_id: raw.sessionID ?? "",
      };

    case "text":
      return {
        type: "stream_event",
        delta: {
          type: "text_delta",
          text: raw.part?.text ?? "",
        },
      };

    case "thinking":
      return {
        type: "stream_event",
        delta: {
          type: "thinking_delta",
          thinking: raw.part?.text ?? "",
        },
      };

    case "tool_call":
      return {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: raw.part?.id ?? `tool-${Date.now()}`,
              name: raw.part?.name ?? "tool",
              input: raw.part?.input ?? {},
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
              tool_use_id: raw.part?.id ?? "",
              content: String(raw.part?.content ?? ""),
            },
          ],
        },
      };

    case "step_finish":
      return {
        type: "result",
        result: "",
      };

    default:
      return null;
  }
}

export async function* spawnKilo(
  opts: SpawnCliOptions,
): AsyncGenerator<CliEvent, void, void> {
  // Kilo takes message as positional args, no stdin.
  // Prepend system prompt as context.
  const fullMessage = `<system_instructions>\n${SYSTEM_PROMPT}\n</system_instructions>\n\n${opts.message}`;

  const args: string[] = [
    "run",
    fullMessage,
    "--format",
    "json",
    "--auto",
    "--thinking",
    "--dir",
    opts.cwd,
  ];
  if (opts.sessionId) {
    args.push("--session", opts.sessionId, "--continue");
  }

  const proc = spawn("kilo", args, {
    cwd: opts.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  for await (const line of streamJsonLines(proc, opts.signal)) {
    try {
      const raw = JSON.parse(line) as KiloEvent;
      const normalized = normalizeKiloEvent(raw);
      if (normalized) yield normalized;
    } catch {
      // Skip non-JSON lines
    }
  }
}
