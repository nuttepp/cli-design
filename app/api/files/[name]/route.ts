import { NextResponse } from "next/server";
import {
  readWorkspaceFiles,
  WorkspaceError,
  writeWorkspaceFile,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  try {
    const files = await readWorkspaceFiles(name);
    return NextResponse.json({ files });
  } catch (e) {
    if (e instanceof WorkspaceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }
    throw e;
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  try {
    const body = (await req.json()) as { path?: string; content?: string };
    if (typeof body.path !== "string" || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "path and content required" },
        { status: 400 },
      );
    }
    await writeWorkspaceFile(name, body.path, body.content);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof WorkspaceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
