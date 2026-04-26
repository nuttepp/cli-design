"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [list, setList] = useState<string[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/workspaces");
    if (!res.ok) {
      setList([]);
      return;
    }
    const { workspaces } = (await res.json()) as { workspaces: string[] };
    setList(workspaces);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      router.push(`/w/${encodeURIComponent(name)}`);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete workspace "${name}"? This removes all its files.`)) {
      return;
    }
    const res = await fetch(`/api/workspaces/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (res.ok) await refresh();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <h1 className="text-sm font-semibold">Claude Code Studio</h1>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Pick a workspace</h2>
        <p className="mt-2 text-sm text-slate-400">
          Each workspace is a folder of plain HTML / CSS / JS in{" "}
          <code className="text-slate-300">./workspaces/&lt;name&gt;/</code>.
        </p>

        <form onSubmit={create} className="mt-6 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="my-app"
            pattern="[a-z0-9][a-z0-9-]{0,39}"
            title="lowercase letters, digits and dashes; max 40 chars"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newName.trim() || creating}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "Creating…" : "+ New workspace"}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        <h3 className="mt-10 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Existing
        </h3>
        {list === null ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : list.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No workspaces yet — create one above.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {list.map((name) => (
              <li key={name} className="group relative">
                <Link
                  href={`/w/${encodeURIComponent(name)}`}
                  className="block rounded-md border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm hover:border-indigo-500/50 hover:bg-slate-900"
                >
                  <span className="text-slate-100">{name}</span>
                  <span className="ml-2 text-xs text-slate-500">→</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(name)}
                  aria-label={`Delete ${name}`}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-red-500/30 px-2 py-0.5 text-[10px] text-red-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
