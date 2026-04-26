import { NextResponse } from "next/server";
import {
  deleteWorkspace,
  renameWorkspace,
  WorkspaceError,
} from "@/lib/workspace";
import { clearSession, getSession, setSession } from "@/lib/sessionStore";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  try {
    await deleteWorkspace(name);
    clearSession(name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof WorkspaceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body?.name !== "string") {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 },
    );
  }
  try {
    const next = body.name.trim();
    await renameWorkspace(name, next);
    const sid = getSession(name);
    clearSession(name);
    if (sid && next !== name) setSession(next, sid);
    return NextResponse.json({ ok: true, name: next });
  } catch (e) {
    if (e instanceof WorkspaceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
