import type { ChildProcess } from "node:child_process";

/**
 * Stream newline-delimited JSON lines from a child process's stdout.
 * Handles buffering, stderr capture, signal-based abort, and error reporting.
 */
export async function* streamJsonLines(
  proc: ChildProcess,
  signal?: AbortSignal,
): AsyncGenerator<string, void, void> {
  const onAbort = () => {
    if (!proc.killed) proc.kill("SIGTERM");
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  let buf = "";
  const stderrChunks: string[] = [];
  const stderr = proc.stderr!;
  stderr.setEncoding("utf8");
  stderr.on("data", (chunk: string) => {
    stderrChunks.push(chunk);
  });

  const stdout = proc.stdout!;
  stdout.setEncoding("utf8");

  type Pending = {
    resolve: (v: string | null) => void;
    reject: (e: unknown) => void;
  };
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
      const stderrText = stderrChunks.join("").trim();
      errored = new Error(
        `CLI exited with code ${code}${stderrText ? `: ${stderrText}` : ""}`,
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
      yield line;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (!proc.killed) proc.kill("SIGTERM");
  }
}
