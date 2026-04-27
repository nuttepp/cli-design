import { NextResponse } from "next/server";
import {
  readChatHistory,
  writeChatHistory,
  validateName,
  WorkspaceError,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ workspace: string }> },
) {
  const { workspace } = await ctx.params;
  try {
    validateName(workspace);
    const messages = await readChatHistory(workspace);
    return NextResponse.json({ messages });
  } catch (e) {
    if (e instanceof WorkspaceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ workspace: string }> },
) {
  const { workspace } = await ctx.params;
  try {
    validateName(workspace);
    const body = (await req.json()) as { messages?: unknown[] };
    if (!Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "messages array required" },
        { status: 400 },
      );
    }
    await writeChatHistory(workspace, body.messages);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof WorkspaceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
