"use client";

import { useEffect, useRef, useState } from "react";

interface DeleteConfirmModalProps {
  workspaceName: string;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ workspaceName, open, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmText, setConfirmText] = useState("");
  const canConfirm = confirmText === "delete";

  useEffect(() => {
    if (!open) {
      setConfirmText("");
      return;
    }
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Warning icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>

        <h3 className="text-center text-lg font-semibold text-slate-900 dark:text-slate-100">
          Delete workspace
        </h3>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">&ldquo;{workspaceName}&rdquo;</span>?
          This will permanently remove all files in this workspace.
        </p>

        <div className="mt-4">
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Type <span className="font-semibold text-slate-700 dark:text-slate-200">delete</span> to confirm
          </label>
          <input
            ref={inputRef}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) onConfirm(); }}
            placeholder="delete"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
