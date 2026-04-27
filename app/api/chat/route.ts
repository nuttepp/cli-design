import { getAdapter, type CliEvent } from "@/lib/cli";
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
  cli?: string;
}

const FIRST_TURN_DIRECTIVE = `

<project_kickoff>
This is the user's FIRST message for a brand-new project. Before writing or
modifying any files, ask clarifying questions to scope the work. You MUST
cover all of these areas (tailor the specific wording to what the user said):

1. **Purpose & pages** — What is the app/site for? Which pages or features are needed?
2. **Design style** — What visual style do they want? (minimal, bold, corporate, playful, etc.)
3. **Color scheme** — Do they have brand/CI colors? Ask them to provide hex codes or describe the palette. Offer common presets.
4. **Light & dark mode** — Should the app support light mode, dark mode, or both?
5. **Theme mood** — What overall mood/tone? (professional, friendly, techy, elegant, etc.)
6. **Logo / branding** — Do they have a logo or brand assets? They can describe it or paste a URL. Ask about brand name and tagline if relevant.

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
  {
    "id": "purpose",
    "question": "What is this app for and which pages do you need?",
    "type": "text"
  },
  {
    "id": "style",
    "question": "What design style are you going for?",
    "type": "single",
    "options": ["Minimal & clean", "Bold & colorful", "Corporate & professional", "Playful & fun"]
  },
  {
    "id": "colors",
    "question": "Do you have brand or CI colors? Provide hex codes, or pick a preset palette.",
    "type": "single",
    "options": ["Blue & white (#3B82F6)", "Purple & indigo (#6366F1)", "Green & teal (#10B981)", "Red & orange (#EF4444)", "I have custom brand colors"]
  },
  {
    "id": "theme_mode",
    "question": "Which theme modes should be supported?",
    "type": "single",
    "options": ["Dark mode only", "Light mode only", "Both (with toggle)"]
  },
  {
    "id": "mood",
    "question": "What overall mood/tone should the UI convey?",
    "type": "single",
    "options": ["Professional & trustworthy", "Friendly & approachable", "Techy & modern", "Elegant & premium"]
  },
  {
    "id": "branding",
    "question": "Do you have a logo, brand name, or tagline? Describe or paste a URL.",
    "type": "text"
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
  const cli = body.cli ?? "claude";
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

  const sessionKey = `${body.workspace}:${cli}`;
  const sessionId = body.resetSession ? undefined : getSession(sessionKey);
  const adapter = getAdapter(cli);

  const encoder = new TextEncoder();
  const ac = new AbortController();
  req.signal.addEventListener("abort", () => ac.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CliEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        for await (const evt of adapter({
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
              sessionKey,
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
