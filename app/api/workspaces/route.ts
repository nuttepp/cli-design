import { NextResponse } from "next/server";
import {
  createWorkspace,
  listWorkspacesWithInfo,
  WorkspaceError,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspaces = await listWorkspacesWithInfo();
  return NextResponse.json({ workspaces });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = (body as { name?: unknown })?.name;
  if (typeof name !== "string") {
    return NextResponse.json(
      { error: "Missing 'name' string" },
      { status: 400 },
    );
  }
  try {
    await createWorkspace(name);
    return NextResponse.json({ name }, { status: 201 });
  } catch (e) {
    if (e instanceof WorkspaceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
