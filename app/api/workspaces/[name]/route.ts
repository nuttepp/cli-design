import { NextResponse } from "next/server";
import { deleteWorkspace, WorkspaceError } from "@/lib/workspace";
import { clearSession } from "@/lib/sessionStore";

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
