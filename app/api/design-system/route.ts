import { NextResponse } from "next/server";
import {
  buildGlobalCss,
  DEFAULT_TOKENS,
  type DesignTokens,
} from "@/lib/designSystem";
import { loadTokens, saveTokens } from "@/lib/designSystemStore";
import { listWorkspaces, writeWorkspaceFile } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const tokens = await loadTokens();
  return NextResponse.json({ tokens });
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tokens = (body as { tokens?: unknown })?.tokens;
  const result = validate(tokens);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await saveTokens(result.tokens);
  await regenerateGlobalCss(result.tokens);
  return NextResponse.json({ tokens: result.tokens });
}

export async function DELETE() {
  await saveTokens(DEFAULT_TOKENS);
  await regenerateGlobalCss(DEFAULT_TOKENS);
  return NextResponse.json({ tokens: DEFAULT_TOKENS });
}

async function regenerateGlobalCss(tokens: DesignTokens): Promise<void> {
  const css = buildGlobalCss(tokens);
  const names = await listWorkspaces();
  await Promise.all(
    names.map((n) =>
      writeWorkspaceFile(n, "/global.css", css).catch(() => undefined),
    ),
  );
}

function validate(
  raw: unknown,
):
  | { ok: true; tokens: DesignTokens }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "tokens must be an object" };
  }
  const t = raw as DesignTokens;

  const expectHex = (label: string, v: unknown) => {
    if (typeof v !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(v)) {
      return `${label} must be a hex color`;
    }
    return null;
  };
  const expectStr = (label: string, v: unknown) => {
    if (typeof v !== "string" || v.length === 0) return `${label} required`;
    return null;
  };

  const errors: string[] = [];

  if (!t.fonts?.heading?.family) errors.push("fonts.heading.family required");
  if (!t.fonts?.body?.family) errors.push("fonts.body.family required");
  if (!t.fonts?.mono?.family) errors.push("fonts.mono.family required");

  for (const colorPath of [
    ["colors.brand.primary", t.colors?.brand?.primary],
    ["colors.brand.secondary", t.colors?.brand?.secondary],
    ["colors.semantic.success", t.colors?.semantic?.success],
    ["colors.semantic.warning", t.colors?.semantic?.warning],
    ["colors.semantic.error", t.colors?.semantic?.error],
    ["colors.semantic.info", t.colors?.semantic?.info],
    ["colors.neutral.bg", t.colors?.neutral?.bg],
    ["colors.neutral.surface", t.colors?.neutral?.surface],
    ["colors.neutral.text", t.colors?.neutral?.text],
    ["colors.neutral.textMuted", t.colors?.neutral?.textMuted],
    ["colors.neutral.border", t.colors?.neutral?.border],
  ] as const) {
    const err = expectHex(colorPath[0], colorPath[1]);
    if (err) errors.push(err);
  }

  if (typeof t.spacing?.base !== "number" || t.spacing.base <= 0) {
    errors.push("spacing.base must be a positive number");
  }
  const radiusErr = expectStr("radius.base", t.radius?.base);
  if (radiusErr) errors.push(radiusErr);
  const borderErr = expectStr("border.width", t.border?.width);
  if (borderErr) errors.push(borderErr);

  for (const k of ["sm", "md", "lg"] as const) {
    const err = expectStr(`shadow.${k}`, t.shadow?.[k]);
    if (err) errors.push(err);
  }

  if (!t.typeScale) {
    errors.push("typeScale required");
  } else {
    for (const k of ["h1", "h2", "h3", "h4", "body", "small", "caption"] as const) {
      const ts = t.typeScale[k];
      if (!ts || typeof ts.size !== "string" || typeof ts.lineHeight !== "string" || typeof ts.weight !== "number") {
        errors.push(`typeScale.${k} requires size/lineHeight/weight`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join("; ") };
  }
  return { ok: true, tokens: t };
}
