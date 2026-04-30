import { NextResponse } from "next/server";
import { saveAttachment, WorkspaceError } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

interface AttachmentRequest {
  dataUrl?: string;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  let body: AttachmentRequest;
  try {
    body = (await req.json()) as AttachmentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dataUrl = body.dataUrl;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return NextResponse.json(
      { error: "dataUrl must be a base64 data URL" },
      { status: 400 },
    );
  }

  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return NextResponse.json(
      { error: "Only base64 data URLs are supported" },
      { status: 400 },
    );
  }
  const mime = match[1].toLowerCase();
  const ext = MIME_TO_EXT[mime];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported image MIME type: ${mime}` },
      { status: 400 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    return NextResponse.json({ error: "Invalid base64 payload" }, { status: 400 });
  }

  try {
    const { relPath } = await saveAttachment(name, buffer, ext);
    return NextResponse.json({ path: relPath });
  } catch (e) {
    if (e instanceof WorkspaceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
