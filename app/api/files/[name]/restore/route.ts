import { NextResponse } from "next/server";
import {
  restoreWorkspaceFiles,
  WorkspaceError,
  validateName,
  type FileMap,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  try {
    validateName(name);
    const body = (await req.json()) as { files?: FileMap };
    if (!body.files || typeof body.files !== "object") {
      return NextResponse.json(
        { error: "files object required" },
        { status: 400 },
      );
    }
    await restoreWorkspaceFiles(name, body.files);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof WorkspaceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
