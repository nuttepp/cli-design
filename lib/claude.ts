import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type ClaudeEvent = Record<string, unknown> & { type?: string };

export interface SpawnClaudeOptions {
  cwd: string;
  message: string;
  sessionId?: string;
  signal?: AbortSignal;
}

const SYSTEM_PROMPT = [
  "You are operating inside a sandboxed workspace folder. The folder is served as a STATIC SITE to a live preview iframe.",
  "Conventions:",
  "- The project is plain HTML / CSS / JavaScript. NO React, NO TypeScript, NO JSX, NO Tailwind, NO bundler, NO npm/package.json, NO build step.",
  "- index.html is the entry rendered in the preview. Edit it (and add sibling files) to fulfil the user's request.",
  "- Link CSS via <link rel=\"stylesheet\" href=\"styles.css\"> and JS via <script src=\"script.js\"></script> using relative paths (no leading slash).",
  "- Use vanilla DOM APIs (document.querySelector, addEventListener, etc.). You may use modern ES2020+ JavaScript.",
  "- If the user wants a framework or TypeScript, politely refuse and explain this workspace is plain HTML/CSS/JS.",
  "- Allowed file extensions: .html, .css, .js, .svg, .json, .md, .txt. Do NOT create .tsx/.ts/.jsx files.",
  "- Keep things small and self-contained. Prefer one file per concern (e.g. components.css, app.js).",
  "- CRITICAL: NEVER produce markup that triggers Chrome / Safari / Firefox password manager prompts. This applies to EVERY <form> and <input> in the workspace, not only login forms. Rules:",
  "  • Every <form> MUST include autocomplete=\"off\".",
  "  • Every <input> MUST include autocomplete=\"off\" (use autocomplete=\"new-password\" specifically for type=\"password\" fields, since Chrome ignores \"off\" on password inputs).",
  "  • Password inputs MUST also include data-lpignore=\"true\", data-1p-ignore=\"true\", and data-form-type=\"other\".",
  "  • Do NOT use semantic name/id values like \"password\", \"username\", \"email\", \"login\". Use neutral names like \"field-1\", \"field-2\", etc.",
  "  • Do NOT pair an email/text input with a password input inside the same <form> using credential-like naming — Chrome heuristics will still offer to save. Keep names neutral.",
  "  • If the user explicitly asks for the password manager to work, you may relax these rules — otherwise apply them to ALL forms by default.",
].join("\n");

/**
 * Spawn `claude -p` and yield parsed stream-json events line by line.
 * Honors AbortSignal to kill the subprocess.
 */
export async function* spawnClaude(
  opts: SpawnClaudeOptions,
): AsyncGenerator<ClaudeEvent, void, void> {
  const args: string[] = [
    "-p",
    opts.message,
    "--output-format",
    "stream-json",
    "--input-format",
    "text",
    "--include-partial-messages",
    "--verbose",
    "--permission-mode",
    "acceptEdits",
    // Enable extended thinking so the UI can stream the model's reasoning.
    "--effort",
    "medium",
    "--append-system-prompt",
    SYSTEM_PROMPT,
  ];
  if (opts.sessionId) {
    args.push("--resume", opts.sessionId);
  }

  const proc: ChildProcessWithoutNullStreams = spawn("claude", args, {
    cwd: opts.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const onAbort = () => {
    if (!proc.killed) proc.kill("SIGTERM");
  };
  opts.signal?.addEventListener("abort", onAbort, { once: true });

  // Buffer for partial lines.
  let buf = "";
  const stderrChunks: string[] = [];
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (chunk: string) => {
    stderrChunks.push(chunk);
  });

  // Convert stdout into an async iterable of lines.
  const stdout = proc.stdout;
  stdout.setEncoding("utf8");

  type Pending = { resolve: (v: string | null) => void; reject: (e: unknown) => void };
  const queue: string[] = [];
  const waiters: Pending[] = [];
  let ended = false;
  let errored: unknown = null;

  const flushWaiter = () => {
    while (waiters.length && (queue.length || ended || errored)) {
      const w = waiters.shift()!;
      if (errored) w.reject(errored);
      else if (queue.length) w.resolve(queue.shift()!);
      else w.resolve(null);
    }
  };

  stdout.on("data", (chunk: string) => {
    buf += chunk;
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.trim()) queue.push(line);
    }
    flushWaiter();
  });

  stdout.on("end", () => {
    if (buf.trim()) queue.push(buf);
    buf = "";
    ended = true;
    flushWaiter();
  });

  proc.on("error", (err) => {
    errored = err;
    flushWaiter();
  });

  proc.on("close", (code) => {
    if (code !== 0 && code !== null && !errored) {
      const stderr = stderrChunks.join("").trim();
      errored = new Error(
        `claude CLI exited with code ${code}${stderr ? `: ${stderr}` : ""}`,
      );
    }
    ended = true;
    flushWaiter();
  });

  function nextLine(): Promise<string | null> {
    if (errored) return Promise.reject(errored);
    if (queue.length) return Promise.resolve(queue.shift()!);
    if (ended) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
    });
  }

  try {
    while (true) {
      const line = await nextLine();
      if (line === null) break;
      try {
        const evt = JSON.parse(line) as ClaudeEvent;
        yield evt;
      } catch {
        // Skip non-JSON lines (e.g. stray warnings).
      }
    }
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    if (!proc.killed) proc.kill("SIGTERM");
  }
}
