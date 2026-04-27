import fs from "node:fs/promises";
import path from "node:path";
import { buildGlobalCss } from "./designSystem";
import { loadTokens } from "./designSystemStore";

export const WORKSPACES_ROOT = path.resolve(process.cwd(), "workspaces");

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".jsx",
  ".mjs",
  ".json",
  ".svg",
  ".md",
  ".txt",
  ".vue",
  ".svelte",
  ".ts",
  ".tsx",
]);

const MAX_FILE_BYTES = 256 * 1024;
const MAX_FILES = 200;

export class WorkspaceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function validateName(name: string): string {
  if (!NAME_RE.test(name)) {
    throw new WorkspaceError(
      400,
      "Use lowercase letters, digits, and dashes only (max 40 chars)",
    );
  }
  return name;
}

export function workspacePath(name: string): string {
  validateName(name);
  const abs = path.resolve(WORKSPACES_ROOT, name);
  if (!abs.startsWith(WORKSPACES_ROOT + path.sep) && abs !== WORKSPACES_ROOT) {
    throw new WorkspaceError(400, "Path traversal detected");
  }
  return abs;
}

export async function ensureRoot(): Promise<void> {
  await fs.mkdir(WORKSPACES_ROOT, { recursive: true });
}

export async function listWorkspaces(): Promise<string[]> {
  await ensureRoot();
  const entries = await fs.readdir(WORKSPACES_ROOT, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && NAME_RE.test(e.name))
    .map((e) => e.name)
    .sort();
}

export interface WorkspaceInfo {
  name: string;
  fileCount: number;
  lastModified: string;
}

async function countFiles(dir: string, max: number): Promise<number> {
  let count = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (count >= max) break;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += await countFiles(abs, max - count);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext)) count++;
    }
  }
  return count;
}

export async function listWorkspacesWithInfo(): Promise<WorkspaceInfo[]> {
  await ensureRoot();
  const entries = await fs.readdir(WORKSPACES_ROOT, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && NAME_RE.test(e.name))
    .map((e) => e.name)
    .sort();

  return Promise.all(
    dirs.map(async (name) => {
      const dir = path.join(WORKSPACES_ROOT, name);
      const [stat, fileCount] = await Promise.all([
        fs.stat(dir),
        countFiles(dir, MAX_FILES),
      ]);
      return { name, fileCount, lastModified: stat.mtime.toISOString() };
    }),
  );
}

const STARTER_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <link rel="stylesheet" href="global.css" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main class="hello">
      <h1>Hello from your workspace</h1>
      <p>Ask AI in the chat panel to build something here.</p>
    </main>
    <script src="script.js"></script>
  </body>
</html>
`;

const STARTER_STYLES_CSS = `/*
 * styles.css — your custom workspace styles.
 * Design system tokens come from global.css (do not edit that file).
 */

.hello {
  min-height: 100vh;
  display: grid;
  place-items: center;
  text-align: center;
}

.hello h1 {
  font-size: 2rem;
  margin: 0 0 0.5rem;
}

.hello p {
  margin: 0;
  color: var(--color-text-muted);
}
`;

const STARTER_SCRIPT_JS = `// script.js — your workspace JavaScript.
// Add interactivity, DOM manipulation, or application logic here.
`;

const STARTER_README = `# Workspace

Plain HTML / CSS / JavaScript workspace. Everything here is served directly
to the live preview iframe via Sandpack.

- \`index.html\` — main entry point rendered in the preview.
- \`global.css\` — generated from the Design System tab — do not edit.
- \`styles.css\` — your custom workspace styles.
- \`script.js\` — your workspace JavaScript.

For multi-page sites, create separate .html files (e.g. about.html) and
link between them with <a href="about.html">. Use Web Components in
components.js for shared UI (nav, footer, etc.).

You can switch to React, Vue, or Svelte by asking AI in the chat panel.

Ask AI in the chat panel to add features.
`;

export async function createWorkspace(name: string): Promise<void> {
  const dir = workspacePath(name);
  try {
    await fs.mkdir(dir, { recursive: false });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") {
      throw new WorkspaceError(409, "Workspace already exists");
    }
    throw e;
  }
  const tokens = await loadTokens();
  await Promise.all([
    fs.writeFile(path.join(dir, "index.html"), STARTER_INDEX_HTML, "utf8"),
    fs.writeFile(path.join(dir, "global.css"), buildGlobalCss(tokens), "utf8"),
    fs.writeFile(path.join(dir, "styles.css"), STARTER_STYLES_CSS, "utf8"),
    fs.writeFile(path.join(dir, "script.js"), STARTER_SCRIPT_JS, "utf8"),
    fs.writeFile(path.join(dir, "README.md"), STARTER_README, "utf8"),
  ]);
}

export async function deleteWorkspace(name: string): Promise<void> {
  const dir = workspacePath(name);
  await fs.rm(dir, { recursive: true, force: true });
}

export async function renameWorkspace(
  from: string,
  to: string,
): Promise<void> {
  if (from === to) return;
  const src = workspacePath(from);
  const dst = workspacePath(to);
  try {
    await fs.access(src);
  } catch {
    throw new WorkspaceError(404, "Workspace not found");
  }
  try {
    await fs.access(dst);
    throw new WorkspaceError(409, "Workspace name already exists");
  } catch (e) {
    if (e instanceof WorkspaceError) throw e;
  }
  await fs.rename(src, dst);
}

export type FileMap = Record<string, string>;

export async function readWorkspaceFiles(name: string): Promise<FileMap> {
  const root = workspacePath(name);
  const out: FileMap = {};
  let count = 0;

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (count >= MAX_FILES) return;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(ext)) continue;

      const stat = await fs.stat(abs);
      if (stat.size > MAX_FILE_BYTES) continue;

      const rel = "/" + path.relative(root, abs).split(path.sep).join("/");
      out[rel] = await fs.readFile(abs, "utf8");
      count++;
    }
  }

  await walk(root);
  return out;
}

export async function restoreWorkspaceFiles(
  name: string,
  files: FileMap,
): Promise<void> {
  const root = workspacePath(name);
  const current = await readWorkspaceFiles(name);
  // Delete files on disk that are not in the restore set
  for (const relPath of Object.keys(current)) {
    if (!(relPath in files)) {
      const abs = path.resolve(root, "." + relPath);
      if (abs.startsWith(root + path.sep)) {
        await fs.unlink(abs).catch(() => {});
      }
    }
  }
  // Write all files from the snapshot
  for (const [relPath, content] of Object.entries(files)) {
    await writeWorkspaceFile(name, relPath, content);
  }
}

export async function writeWorkspaceFile(
  name: string,
  relPath: string,
  content: string,
): Promise<void> {
  const root = workspacePath(name);
  if (!relPath.startsWith("/")) {
    throw new WorkspaceError(400, "Path must start with /");
  }
  const ext = path.extname(relPath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) {
    throw new WorkspaceError(400, "File extension not allowed");
  }
  const abs = path.resolve(root, "." + relPath);
  if (!abs.startsWith(root + path.sep)) {
    throw new WorkspaceError(400, "Path traversal detected");
  }
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw new WorkspaceError(413, "File too large");
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

const CHAT_HISTORY_FILE = ".chat-history.json";

export async function readChatHistory(name: string): Promise<unknown[]> {
  const abs = path.join(workspacePath(name), CHAT_HISTORY_FILE);
  try {
    const raw = await fs.readFile(abs, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeChatHistory(
  name: string,
  messages: unknown[],
): Promise<void> {
  const abs = path.join(workspacePath(name), CHAT_HISTORY_FILE);
  await fs.writeFile(abs, JSON.stringify(messages), "utf8");
}
