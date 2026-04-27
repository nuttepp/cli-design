"use client";

import { useCallback, useEffect, useState } from "react";

interface Props {
  selected: string | null;
  onSelect: (name: string | null) => void;
}

export function WorkspaceSelector({ selected, onSelect }: Props) {
  const [list, setList] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    if (!res.ok) return;
    const data = (await res.json()) as { workspaces: Array<{ name: string }> };
    const workspaces = data.workspaces.map((w) => w.name);
    setList(workspaces);
    if (selected && !workspaces.includes(selected)) {
      onSelect(workspaces[0] ?? null);
    } else if (!selected && workspaces.length > 0) {
      onSelect(workspaces[0]);
    }
  }, [onSelect, selected]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    setError(null);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setNewName("");
    setCreating(false);
    await refresh();
    onSelect(newName.trim());
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete workspace "${name}"? This removes all its files.`)) {
      return;
    }
    const res = await fetch(
      `/api/workspaces/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      if (selected === name) onSelect(null);
      await refresh();
    }
  };

  return (
    <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/60 px-4 py-2">
      <span className="text-sm text-slate-400">Workspace</span>
      <select
        value={selected ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">— select —</option>
        {list.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      {creating ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="my-app"
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName("");
              setError(null);
            }}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
        >
          + New
        </button>
      )}

      {selected && (
        <button
          type="button"
          onClick={() => void remove(selected)}
          className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
        >
          Delete
        </button>
      )}

      {error && <span className="text-xs text-red-400">{error}</span>}

      <span className="ml-auto text-xs text-slate-500">
        Files in <code>./workspaces/</code>
      </span>
    </div>
  );
}
