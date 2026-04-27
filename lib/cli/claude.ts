import { spawn } from "node:child_process";
import { streamJsonLines } from "./spawn";
import { SYSTEM_PROMPT } from "./systemPrompt";
import type { CliEvent, SpawnCliOptions } from "./types";

export async function* spawnClaude(
  opts: SpawnCliOptions,
): AsyncGenerator<CliEvent, void, void> {
  const args: string[] = [
    "-p",
    "-",
    "--output-format",
    "stream-json",
    "--input-format",
    "text",
    "--include-partial-messages",
    "--verbose",
    "--permission-mode",
    "acceptEdits",
    "--effort",
    "medium",
    "--strict-mcp-config",
    "--append-system-prompt",
    SYSTEM_PROMPT,
  ];
  if (opts.sessionId) {
    args.push("--resume", opts.sessionId);
  }

  const proc = spawn("claude", args, {
    cwd: opts.cwd,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  proc.stdin!.end(opts.message);

  for await (const line of streamJsonLines(proc, opts.signal)) {
    try {
      yield JSON.parse(line) as CliEvent;
    } catch {
      // Skip non-JSON lines
    }
  }
}
