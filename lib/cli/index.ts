import { spawnClaude } from "./claude";
import { spawnGemini } from "./gemini";
import { spawnKilo } from "./kilo";
import type { CliAdapter } from "./types";

const adapters: Record<string, CliAdapter> = {
  claude: spawnClaude,
  gemini: spawnGemini,
  kilo: spawnKilo,
};

export function getAdapter(cli: string): CliAdapter {
  const adapter = adapters[cli];
  if (!adapter) throw new Error(`Unknown CLI: ${cli}`);
  return adapter;
}

export type { CliEvent, SpawnCliOptions } from "./types";
