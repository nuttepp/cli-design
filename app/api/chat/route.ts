import { spawnClaude, type ClaudeEvent } from "@/lib/claude";
import { getSession, setSession } from "@/lib/sessionStore";
import {
  workspacePath,
  WorkspaceError,
  validateName,
} from "@/lib/workspace";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ChatRequest {
  workspace: string;
  message: string;
  resetSession?: boolean;
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (typeof body?.workspace !== "string" || typeof body?.message !== "string") {
    return new Response(
      JSON.stringify({ error: "workspace and message are required strings" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  let cwd: string;
  try {
    validateName(body.workspace);
    cwd = workspacePath(body.workspace);
    await fs.access(cwd);
  } catch (e) {
    const status = e instanceof WorkspaceError ? e.status : 404;
    const message =
      e instanceof WorkspaceError ? e.message : "Workspace not found";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  const sessionId = body.resetSession ? undefined : getSession(body.workspace);

  const encoder = new TextEncoder();
  const ac = new AbortController();
  req.signal.addEventListener("abort", () => ac.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ClaudeEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        for await (const evt of spawnClaude({
          cwd,
          message: body.message,
          sessionId,
          signal: ac.signal,
        })) {
          // Capture the session id from the init event so subsequent turns
          // can --resume the conversation.
          if (
            evt.type === "system" &&
            (evt as { subtype?: string }).subtype === "init" &&
            typeof (evt as { session_id?: unknown }).session_id === "string"
          ) {
            setSession(
              body.workspace,
              (evt as { session_id: string }).session_id,
            );
          }
          send(evt);
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
