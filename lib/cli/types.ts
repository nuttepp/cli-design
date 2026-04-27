export type CliEvent = Record<string, unknown> & { type?: string };

export interface SpawnCliOptions {
  cwd: string;
  message: string;
  sessionId?: string;
  signal?: AbortSignal;
}

export type CliAdapter = (
  opts: SpawnCliOptions,
) => AsyncGenerator<CliEvent, void, void>;
