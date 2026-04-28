"use client";

import { useMemo, useState } from "react";
import type { SelectedElement } from "@/lib/previewInspector";
import type { UseChatResult } from "@/lib/useChat";

interface Props {
  workspace: string | null;
  element: SelectedElement;
  overrides: Record<string, string>;
  onOverrideChange: (next: Record<string, string>) => void;
  onClose: () => void;
  chat: UseChatResult;
}

const SELECT_OPTIONS: Record<string, string[]> = {
  display: [
    "block",
    "inline",
    "inline-block",
    "flex",
    "inline-flex",
    "grid",
    "inline-grid",
    "none",
  ],
  "flex-direction": ["row", "row-reverse", "column", "column-reverse"],
  "justify-content": [
    "flex-start",
    "flex-end",
    "center",
    "space-between",
    "space-around",
    "space-evenly",
  ],
  "align-items": ["flex-start", "flex-end", "center", "baseline", "stretch"],
  "text-align": ["left", "right", "center", "justify", "start", "end"],
  "font-weight": ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
};

const COLOR_FIELDS = new Set([
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
]);

interface FieldDef {
  prop: string;
  label?: string;
}

interface Section {
  label: string;
  fields: FieldDef[];
}

const SECTIONS: Section[] = [
  {
    label: "Color",
    fields: [
      { prop: "color", label: "Text" },
      { prop: "background-color", label: "Background" },
    ],
  },
  {
    label: "Typography",
    fields: [
      { prop: "font-size" },
      { prop: "font-weight" },
      { prop: "line-height" },
      { prop: "letter-spacing" },
      { prop: "text-align" },
      { prop: "font-family" },
    ],
  },
  {
    label: "Spacing",
    fields: [
      { prop: "padding-top", label: "Pad ↑" },
      { prop: "padding-right", label: "Pad →" },
      { prop: "padding-bottom", label: "Pad ↓" },
      { prop: "padding-left", label: "Pad ←" },
      { prop: "margin-top", label: "Mrg ↑" },
      { prop: "margin-right", label: "Mrg →" },
      { prop: "margin-bottom", label: "Mrg ↓" },
      { prop: "margin-left", label: "Mrg ←" },
      { prop: "gap" },
    ],
  },
  {
    label: "Border",
    fields: [
      { prop: "border-radius", label: "Radius" },
      { prop: "border-top-width", label: "Width ↑" },
      { prop: "border-right-width", label: "Width →" },
      { prop: "border-bottom-width", label: "Width ↓" },
      { prop: "border-left-width", label: "Width ←" },
      { prop: "border-top-color", label: "Color ↑" },
      { prop: "border-right-color", label: "Color →" },
      { prop: "border-bottom-color", label: "Color ↓" },
      { prop: "border-left-color", label: "Color ←" },
      { prop: "box-shadow", label: "Shadow" },
    ],
  },
  {
    label: "Layout",
    fields: [
      { prop: "display" },
      { prop: "flex-direction" },
      { prop: "justify-content" },
      { prop: "align-items" },
      { prop: "width" },
      { prop: "height" },
      { prop: "min-width" },
      { prop: "max-width" },
      { prop: "opacity" },
      { prop: "transform" },
    ],
  },
];

function rgbToHex(value: string): string | null {
  const m = value
    .replace(/\s+/g, "")
    .match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/i);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorForPicker(value: string): string {
  if (!value) return "#000000";
  if (value.startsWith("#")) {
    if (value.length === 4) {
      const [, r, g, b] = value;
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return value.slice(0, 7);
  }
  return rgbToHex(value) ?? "#000000";
}

export function ElementEditorPanel({
  workspace,
  element,
  overrides,
  onOverrideChange,
  onClose,
  chat,
}: Props) {
  const [comment, setComment] = useState("");

  const initial = element.css;

  const valueFor = useMemo(
    () => (prop: string) => overrides[prop] ?? initial[prop] ?? "",
    [overrides, initial],
  );

  const isOverridden = (prop: string) => overrides[prop] !== undefined;

  const setValue = (prop: string, value: string) => {
    const next = { ...overrides };
    const original = initial[prop] ?? "";
    if (value === "" || value === original) {
      delete next[prop];
    } else {
      next[prop] = value;
    }
    onOverrideChange(next);
  };

  const reset = (prop: string) => {
    if (!(prop in overrides)) return;
    const next = { ...overrides };
    delete next[prop];
    onOverrideChange(next);
  };

  const resetAll = () => onOverrideChange({});

  const submitComment = () => {
    const text = comment.trim();
    if (!text) return;
    setComment("");
    // Close immediately so the user sees the chat while AI works
    onClose();
    void chat.send(text, {
      selectedElement: element,
      styleOverrides: Object.keys(overrides).length ? overrides : null,
    });
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900/40">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[11px] text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
          &lt;{element.tag}
          {element.id ? `#${element.id}` : ""}
          {element.classList.length
            ? `.${element.classList.slice(0, 2).join(".")}`
            : ""}
          &gt;
        </span>
        <span
          className="truncate font-mono text-[10px] text-slate-500"
          title={element.selector}
        >
          {element.selector}
        </span>
        <button
          type="button"
          onClick={resetAll}
          disabled={!Object.keys(overrides).length}
          className="ml-auto rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Reset all overrides"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close element editor"
          title="Close (back to chat)"
          className="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ×
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {SECTIONS.map((section) => (
          <section key={section.label} className="space-y-1.5">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {section.label}
            </h3>
            <div className="space-y-1">
              {section.fields.map((f) => (
                <FieldRow
                  key={f.prop}
                  prop={f.prop}
                  label={f.label ?? f.prop}
                  value={valueFor(f.prop)}
                  initial={initial[f.prop] ?? ""}
                  overridden={isOverridden(f.prop)}
                  onChange={(v) => setValue(f.prop, v)}
                  onReset={() => reset(f.prop)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <form
        className="border-t border-slate-200 p-3 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          void submitComment();
        }}
      >
        <div className="relative rounded-md bg-slate-100 dark:bg-slate-900/60">
          <textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitComment();
              }
            }}
            placeholder="Tell AI what to change…"
            disabled={!workspace || chat.busy}
            rows={1}
            className="block max-h-[200px] w-full resize-none overflow-y-auto rounded-md bg-transparent px-3 py-1.5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!workspace || chat.busy || !comment.trim()}
            aria-label={chat.busy ? "Working" : "Send"}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-indigo-400 transition hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {chat.busy ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25H10a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.085l-1.414 4.926a.75.75 0 0 0 1.06.826l14-7a.75.75 0 0 0 0-1.342l-14-7a.75.75 0 0 0-.234-.056Z" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldRow({
  prop,
  label,
  value,
  initial,
  overridden,
  onChange,
  onReset,
}: {
  prop: string;
  label: string;
  value: string;
  initial: string;
  overridden: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const options = SELECT_OPTIONS[prop];
  const isColor = COLOR_FIELDS.has(prop);

  return (
    <div className="grid grid-cols-[7rem_1fr_auto] items-center gap-2">
      <label
        className={`truncate text-[11px] ${
          overridden ? "text-indigo-300" : "text-slate-400"
        }`}
        title={prop}
      >
        {label}
      </label>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`rounded border bg-white px-2 py-1 text-xs text-slate-900 dark:bg-slate-950/50 dark:text-slate-100 focus:outline-none ${
            overridden
              ? "border-indigo-500"
              : "border-slate-300 dark:border-slate-700 focus:border-indigo-500"
          }`}
        >
          <option value="">{initial || "—"}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : isColor ? (
        <ColorField
          value={value}
          initial={initial}
          overridden={overridden}
          onChange={onChange}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={initial || "—"}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className={`rounded border bg-white px-2 py-1 font-mono text-xs text-slate-900 dark:bg-slate-950/50 dark:text-slate-100 focus:outline-none ${
            overridden
              ? "border-indigo-500"
              : "border-slate-300 dark:border-slate-700 focus:border-indigo-500"
          }`}
        />
      )}
      <button
        type="button"
        onClick={onReset}
        disabled={!overridden}
        title="Reset to original"
        className="rounded px-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        ↺
      </button>
    </div>
  );
}

function ColorField({
  value,
  initial,
  overridden,
  onChange,
}: {
  value: string;
  initial: string;
  overridden: boolean;
  onChange: (v: string) => void;
}) {
  const display = value || initial;
  const swatch = colorForPicker(display);
  return (
    <div
      className={`flex items-center gap-1.5 rounded border bg-white px-2 py-1 dark:bg-slate-950/50 ${
        overridden ? "border-indigo-500" : "border-slate-300 dark:border-slate-700"
      }`}
    >
      <input
        type="color"
        value={swatch}
        onChange={(e) => onChange(e.target.value)}
        className="h-5 w-7 cursor-pointer rounded border border-slate-300 dark:border-slate-700 bg-transparent"
        aria-label="Color picker"
      />
      <input
        type="text"
        value={value}
        placeholder={initial || "—"}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="flex-1 bg-transparent font-mono text-xs text-slate-100 focus:outline-none"
      />
    </div>
  );
}

