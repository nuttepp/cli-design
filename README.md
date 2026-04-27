# Claude Code Studio

A local generative-UI playground driven by the [Claude Code CLI](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview). Each **workspace** maps to a folder of plain HTML / CSS / JS files under `./workspaces/<name>/`. You describe UI changes in natural language, and Claude generates or updates the files in real time with a live in-browser preview powered by [Sandpack](https://sandpack.codesandbox.io/).

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Preview | `@codesandbox/sandpack-react` |
| Runtime | Node.js ≥ 20 |

## Prerequisites

- **Node.js 20+** — [download](https://nodejs.org/)
- **npm 10+** (bundled with Node 20)
- **Claude Code CLI** installed and authenticated — [docs](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview)

## Environment variables

Copy `.env.example` to `.env.local` and fill in any values you need:

```bash
cp .env.example .env.local
```

The app spawns the `claude` CLI as a subprocess, so there are no required API keys in `.env.local`. Authenticate the CLI once with:

```bash
claude auth login
```

Alternatively, set `ANTHROPIC_API_KEY` in `.env.local` and the CLI will pick it up automatically.

> `.env.local` is gitignored and never committed.

---

## Quick start

```bash
make setup   # install dependencies
make dev     # start the dev server → http://localhost:3000
```

---

## Makefile reference

Run `make help` (or just `make`) at any time to see this summary.

### `make setup`

Installs all npm dependencies.

```bash
make setup
```

Equivalent to `npm install`. Run this once after cloning, and again whenever `package.json` changes.

---

### `make dev`

Starts the Next.js development server with hot-reload.

```bash
make dev
```

Opens at **http://localhost:3000** by default. The server watches for file changes and refreshes automatically.

---

### `make test`

Runs all static quality checks: ESLint (`next lint`) and TypeScript type checking (`tsc --noEmit`). There is no runtime test suite — tests are enforced at the type and lint level.

```bash
make test
```

You can also run checks individually:

```bash
make lint        # ESLint only
make type-check  # TypeScript only
```

---

### `make clean`

Removes build artifacts **and** `node_modules`.

```bash
make clean
```

Use this for a full reset. Run `make setup` afterwards to reinstall dependencies.

If you only want to delete the build output without removing `node_modules`, use:

```bash
make clean-build
```

---

### `make build` / `make start`

Build and serve the production bundle locally:

```bash
make build   # compiles and optimises for production → .next/
make start   # starts the production server on http://localhost:3000
```

`make start` requires a successful `make build` first.

---

## Project structure

```
.
├── app/                  # Next.js App Router
│   ├── api/              # API routes (chat, workspaces, files, design-system)
│   ├── w/[workspace]/    # Per-workspace UI page
│   ├── layout.tsx        # Root HTML shell + theme bootstrap
│   └── page.tsx          # Home – workspace list
├── components/           # Shared React components
├── data/
│   └── design-system.json
├── lib/                  # Utility modules and custom hooks
├── workspaces/           # User-generated workspace folders (gitignored)
├── Makefile
└── README.md
```

## Workspaces

Each workspace is a named folder inside `./workspaces/`. The app creates and manages these via the `/api/workspaces` routes. Workspace contents are gitignored (only `workspaces/.gitkeep` is tracked).

## License

Private — all rights reserved.

<!-- @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=6 orderedList=false} -->
