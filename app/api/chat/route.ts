import { spawnClaude, type ClaudeEvent } from "@/lib/claude";
import { formatSelectedElement } from "@/lib/inspectorContext";
import { getSession, setSession } from "@/lib/sessionStore";
import type { SelectedElement } from "@/lib/previewInspector";
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
  selectedElement?: SelectedElement | null;
  firstTurn?: boolean;
}

const FIRST_TURN_DIRECTIVE = `

<project_kickoff>
This is the user's FIRST message for a brand-new project. Before writing or
modifying any files, ask 3-6 clarifying questions to scope the work:
purpose / goal of the site, target audience and tone, required pages or
features, and any visual-style preferences. Tailor the specific questions
to what the user just said.

Output the questions inside a fenced code block with the language tag
"questions" containing a JSON array of objects shaped:
  {
    "id": string,
    "question": string,
    "type": "text" | "single" | "multi",   // optional, default "text"
    "options": string[]                    // required when type is single/multi
  }

Pick the type that fits each question:
- "single" (radio) — pick one from a short list of likely answers.
- "multi"  (checkbox) — pick any combination from a list of features/options.
- "text"   — open-ended; no options needed.
You do NOT need to add an "Other" option — the UI always shows an "Other"
free-text field automatically.

After the block, you may add a one-sentence note, but DO NOT create or edit
files in this turn — wait for the user's answers.

Example:
\`\`\`questions
[
  {"id": "purpose", "question": "What is this website for?"},
  {
    "id": "audience",
    "question": "Who is the primary audience?",
    "type": "single",
    "options": ["Consumers", "Businesses", "Internal team", "Developers"]
  },
  {
    "id": "features",
    "question": "Which features should it have?",
    "type": "multi",
    "options": ["Landing page", "Blog", "Contact form", "Pricing", "Auth"]
  }
]
\`\`\`
</project_kickoff>
`;

function isValidSelectedElement(v: unknown): v is SelectedElement {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.selector === "string" &&
    typeof o.tag === "string" &&
    typeof o.html === "string" &&
    typeof o.css === "object" &&
    o.css !== null
  );
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

  if (
    body.selectedElement != null &&
    !isValidSelectedElement(body.selectedElement)
  ) {
    return new Response(
      JSON.stringify({ error: "selectedElement is malformed" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  let finalMessage = body.selectedElement
    ? formatSelectedElement(body.selectedElement, body.message)
    : body.message;
  if (body.firstTurn) {
    finalMessage = `${finalMessage}${FIRST_TURN_DIRECTIVE}`;
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
          message: finalMessage,
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
