import fs from "node:fs/promises";
import path from "node:path";
import { buildGlobalCss } from "./designSystem";
import { loadTokens } from "./designSystemStore";

export const WORKSPACES_ROOT = path.resolve(process.cwd(), "workspaces");

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

// Workspaces are plain HTML/CSS/JS static sites — no TS/JSX.
const TEXT_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".svg",
  ".md",
  ".txt",
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
      "Workspace name must match ^[a-z0-9][a-z0-9-]{0,39}$",
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

const STARTER_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preview</title>
    <link rel="stylesheet" href="global.css" />
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="hello">
      <h1>Hello from your workspace</h1>
      <p>Ask Claude in the chat panel to build something here.</p>
    </main>
    <script src="script.js"></script>
  </body>
</html>
`;

const STARTER_STYLE_CSS = `/*
 * style.css — your custom workspace styles.
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

const STARTER_SCRIPT_JS = `// Plain JavaScript — no bundler, no framework.
// Anything you do here runs inside the live preview iframe.
console.log("Workspace ready");
`;

const STARTER_README = `# Workspace

Plain HTML / CSS / JavaScript. No bundler, no framework — everything you put
in this folder is served directly to the live preview iframe.

- \`index.html\` is the entry; the preview renders this file.
- \`global.css\` is generated from the Design System tab — do not edit by
  hand. It exposes design tokens (colors, spacing, radii) as CSS variables.
- \`style.css\` is for your custom workspace styles.
- \`script.js\` is loaded by \`index.html\`.

Ask Claude in the chat panel to add features.
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
    fs.writeFile(path.join(dir, "style.css"), STARTER_STYLE_CSS, "utf8"),
    fs.writeFile(path.join(dir, "script.js"), STARTER_SCRIPT_JS, "utf8"),
    fs.writeFile(path.join(dir, "README.md"), STARTER_README, "utf8"),
  ]);
}

export async function deleteWorkspace(name: string): Promise<void> {
  const dir = workspacePath(name);
  await fs.rm(dir, { recursive: true, force: true });
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
