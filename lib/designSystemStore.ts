import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_TOKENS, type DesignTokens } from "./designSystem";

const TOKENS_PATH = path.resolve(process.cwd(), "data", "design-system.json");

let cache: DesignTokens | null = null;

function looksValid(t: unknown): t is DesignTokens {
  const x = t as DesignTokens | undefined;
  return Boolean(
    x &&
      x.fonts?.heading?.family &&
      x.colors?.brand?.primary &&
      x.colors?.neutral?.bg &&
      x.spacing?.base !== undefined &&
      x.radius?.base &&
      x.typeScale?.h1?.size,
  );
}

export async function loadTokens(): Promise<DesignTokens> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(TOKENS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!looksValid(parsed)) {
      // old-shape file from a previous version — reset to defaults.
      cache = DEFAULT_TOKENS;
      return cache;
    }
    cache = parsed;
    return cache;
  } catch {
    cache = DEFAULT_TOKENS;
    return cache;
  }
}

export async function saveTokens(tokens: DesignTokens): Promise<void> {
  await fs.mkdir(path.dirname(TOKENS_PATH), { recursive: true });
  await fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2), "utf8");
  cache = tokens;
}
