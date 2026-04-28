"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type DesignTokens,
  type FontDefinition,
  type TypeScaleKey,
  TYPE_SCALE_KEYS,
  POPULAR_FONTS,
  POPULAR_MONO_FONTS,
  googleFontsUrl,
  spacingScale,
} from "@/lib/designSystem";

type Tab = "foundations" | "components" | "patterns";

const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800];

export function DesignSystem() {
  const [tokens, setTokens] = useState<DesignTokens | null>(null);
  const [savedTokens, setSavedTokens] = useState<DesignTokens | null>(null);
  const [tab, setTab] = useState<Tab>("foundations");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/design-system")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { tokens: DesignTokens };
      })
      .then(({ tokens }) => {
        if (cancelled) return;
        setTokens(tokens);
        setSavedTokens(tokens);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Load Google Fonts dynamically so previews use the chosen typography.
  useEffect(() => {
    if (!tokens) return;
    const url = googleFontsUrl(tokens);
    if (!url) return;
    const id = "ds-google-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = url;
  }, [tokens]);

  const dirty = useMemo(
    () => JSON.stringify(tokens) !== JSON.stringify(savedTokens),
    [tokens, savedTokens],
  );

  const save = async () => {
    if (!tokens || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/design-system", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { tokens: saved } = (await res.json()) as { tokens: DesignTokens };
      setTokens(saved);
      setSavedTokens(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm("Reset to defaults? This regenerates global.css for every workspace.")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/design-system", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { tokens: t } = (await res.json()) as { tokens: DesignTokens };
      setTokens(t);
      setSavedTokens(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading…</div>;
  }
  if (!tokens) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-red-400">
        Failed to load: {error ?? "unknown error"}
      </div>
    );
  }

  const update = (mut: (t: DesignTokens) => DesignTokens) => {
    setTokens((t) => (t ? mut(t) : t));
  };

  return (
    <div className="flex h-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center gap-3 px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold">Design System</h1>
            <p className="text-xs text-slate-500">
              Source of truth for{" "}
              <code className="rounded bg-slate-100 px-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">global.css</code>{" "}
              in every workspace.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {error && <span className="text-xs text-red-400">{error}</span>}
            {dirty && !saving && <span className="text-xs text-amber-400">Unsaved</span>}
            <button
              onClick={reset}
              disabled={saving}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Reset
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <div className="flex gap-1 px-6">
          {(["foundations", "components", "patterns"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-3 py-2 text-xs font-medium capitalize ${
                tab === t
                  ? "text-indigo-300"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t}
              {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-indigo-500" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {tab === "foundations" && <Foundations tokens={tokens} update={update} />}
          {tab === "components" && <ComponentsPreview tokens={tokens} />}
          {tab === "patterns" && <PatternsPreview tokens={tokens} />}
        </div>
      </div>
    </div>
  );
}

// ─── Foundations tab ────────────────────────────────────────────────────────

function Foundations({
  tokens,
  update,
}: {
  tokens: DesignTokens;
  update: (mut: (t: DesignTokens) => DesignTokens) => void;
}) {
  const c = tokens.colors;

  const setColor = (path: string[], value: string) => {
    update((t) => {
      const next = structuredClone(t);
      let obj: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        obj = obj[path[i]] as Record<string, unknown>;
      }
      obj[path[path.length - 1]] = value;
      return next;
    });
  };

  return (
    <div className="space-y-10">
      <Section title="Colors" subtitle="One value per role — no shade ramps.">
        <div className="grid gap-4 md:grid-cols-2">
          <ColorGroup title="Brand">
            <ColorRow label="Primary" value={c.brand.primary} onChange={(v) => setColor(["colors", "brand", "primary"], v)} />
            <ColorRow label="Secondary" value={c.brand.secondary} onChange={(v) => setColor(["colors", "brand", "secondary"], v)} />
          </ColorGroup>
          <ColorGroup title="Semantic">
            <ColorRow label="Success" value={c.semantic.success} onChange={(v) => setColor(["colors", "semantic", "success"], v)} />
            <ColorRow label="Warning" value={c.semantic.warning} onChange={(v) => setColor(["colors", "semantic", "warning"], v)} />
            <ColorRow label="Error" value={c.semantic.error} onChange={(v) => setColor(["colors", "semantic", "error"], v)} />
            <ColorRow label="Info" value={c.semantic.info} onChange={(v) => setColor(["colors", "semantic", "info"], v)} />
          </ColorGroup>
          <ColorGroup title="Neutral">
            <ColorRow label="Background" value={c.neutral.bg} onChange={(v) => setColor(["colors", "neutral", "bg"], v)} />
            <ColorRow label="Surface" value={c.neutral.surface} onChange={(v) => setColor(["colors", "neutral", "surface"], v)} />
            <ColorRow label="Text" value={c.neutral.text} onChange={(v) => setColor(["colors", "neutral", "text"], v)} />
            <ColorRow label="Text muted" value={c.neutral.textMuted} onChange={(v) => setColor(["colors", "neutral", "textMuted"], v)} />
            <ColorRow label="Border" value={c.neutral.border} onChange={(v) => setColor(["colors", "neutral", "border"], v)} />
          </ColorGroup>
        </div>
      </Section>

      <Section title="Typography" subtitle="Pick fonts from Google Fonts; tune the type scale.">
        <div className="grid gap-3 md:grid-cols-3">
          {(["heading", "body", "mono"] as const).map((slot) => (
            <FontPicker
              key={slot}
              slot={slot}
              font={tokens.fonts[slot]}
              onChange={(next) =>
                update((t) => ({ ...t, fonts: { ...t.fonts, [slot]: next } }))
              }
            />
          ))}
        </div>
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Type scale</h3>
          <div className="grid gap-2">
            {TYPE_SCALE_KEYS.map((k) => (
              <TypeScaleRow
                key={k}
                slot={k}
                value={tokens.typeScale[k]}
                fontFamily={
                  k === "h1" || k === "h2" || k === "h3" || k === "h4"
                    ? tokens.fonts.heading.family
                    : tokens.fonts.body.family
                }
                onChange={(patch) =>
                  update((t) => ({
                    ...t,
                    typeScale: {
                      ...t.typeScale,
                      [k]: { ...t.typeScale[k], ...patch },
                    },
                  }))
                }
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Spacing" subtitle="One base unit drives the whole 8pt-style scale.">
        <div className="rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 p-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600 dark:text-slate-300">Base</label>
            <input
              type="number"
              min={2}
              step={1}
              value={tokens.spacing.base}
              onChange={(e) =>
                update((t) => ({
                  ...t,
                  spacing: { base: Math.max(2, Number(e.target.value) || 0) },
                }))
              }
              className="w-24 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-xs text-slate-500">px</span>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            {Object.entries(spacingScale(tokens.spacing.base)).map(([k, v]) => (
              <div key={k} className="flex flex-col items-center gap-1.5 text-xs text-slate-400">
                <div
                  style={{ width: parseFloat(v), height: parseFloat(v), backgroundColor: tokens.colors.brand.primary }}
                />
                <span className="font-mono">{k} · {v}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Radius & Borders" subtitle="A single base radius drives sm / md / lg / xl.">
        <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 p-4 md:grid-cols-2">
          <Field label="Base radius">
            <input
              value={tokens.radius.base}
              onChange={(e) => update((t) => ({ ...t, radius: { base: e.target.value } }))}
              placeholder="8px"
              className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </Field>
          <Field label="Border width">
            <input
              value={tokens.border.width}
              onChange={(e) => update((t) => ({ ...t, border: { width: e.target.value } }))}
              placeholder="1px"
              className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {[
            { name: "sm", value: `calc(${tokens.radius.base} / 2)` },
            { name: "base", value: tokens.radius.base },
            { name: "lg", value: `calc(${tokens.radius.base} * 1.5)` },
            { name: "xl", value: `calc(${tokens.radius.base} * 2)` },
            { name: "full", value: "9999px" },
          ].map((r) => (
            <div
              key={r.name}
              className="flex h-16 w-16 items-center justify-center text-xs"
              style={{
                borderRadius: r.value,
                background: `${tokens.colors.brand.primary}33`,
                border: `1px solid ${tokens.colors.brand.primary}66`,
              }}
            >
              {r.name}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shadows">
        <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 p-4 md:grid-cols-3">
          {(["sm", "md", "lg"] as const).map((k) => (
            <Field key={k} label={`Shadow ${k}`}>
              <input
                value={tokens.shadow[k]}
                onChange={(e) => update((t) => ({ ...t, shadow: { ...t.shadow, [k]: e.target.value } }))}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
              <div
                className="mt-2 h-12 w-full rounded"
                style={{ backgroundColor: tokens.colors.neutral.surface, boxShadow: tokens.shadow[k] }}
              />
            </Field>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ColorGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[7rem_2.5rem_1fr] items-center gap-2">
      <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
      <label className="relative h-9 w-10 overflow-hidden rounded border border-slate-700" style={{ backgroundColor: value }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
      />
    </div>
  );
}

function FontPicker({
  slot,
  font,
  onChange,
}: {
  slot: "heading" | "body" | "mono";
  font: FontDefinition;
  onChange: (next: FontDefinition) => void;
}) {
  const options = slot === "mono" ? POPULAR_MONO_FONTS : POPULAR_FONTS;
  const isCustom = !options.includes(font.family);
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{slot} font</h3>
      <select
        value={isCustom ? "__custom__" : font.family}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") return;
          onChange({ ...font, family: v });
        }}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
      >
        {options.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      <input
        value={font.family}
        onChange={(e) => onChange({ ...font, family: e.target.value })}
        placeholder="Google Font name"
        className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
      />
      <div className="mt-3">
        <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Weights</p>
        <div className="flex flex-wrap gap-1">
          {FONT_WEIGHTS.map((w) => {
            const on = font.weights.includes(w);
            return (
              <button
                key={w}
                type="button"
                onClick={() =>
                  onChange({
                    ...font,
                    weights: on ? font.weights.filter((x) => x !== w) : [...font.weights, w].sort((a, b) => a - b),
                  })
                }
                className={`rounded px-2 py-0.5 text-[10px] ${
                  on ? "bg-indigo-600 text-white" : "border border-slate-700 text-slate-400"
                }`}
              >
                {w}
              </button>
            );
          })}
        </div>
      </div>
      <div
        className="mt-3 truncate text-base text-slate-700 dark:text-slate-200"
        style={{ fontFamily: `'${font.family}', ${slot === "mono" ? "monospace" : "sans-serif"}` }}
      >
        Aa Bb Cc — The quick brown fox.
      </div>
    </div>
  );
}

function TypeScaleRow({
  slot,
  value,
  fontFamily,
  onChange,
}: {
  slot: TypeScaleKey;
  value: { size: string; lineHeight: string; weight: number; letterSpacing?: string };
  fontFamily: string;
  onChange: (patch: Partial<{ size: string; lineHeight: string; weight: number; letterSpacing: string }>) => void;
}) {
  return (
    <div className="grid grid-cols-[5rem_1fr_1fr_1fr_2fr] items-center gap-2">
      <code className="font-mono text-xs text-slate-400">.{slot}</code>
      <input
        value={value.size}
        onChange={(e) => onChange({ size: e.target.value })}
        placeholder="size"
        className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
      />
      <input
        value={value.lineHeight}
        onChange={(e) => onChange({ lineHeight: e.target.value })}
        placeholder="line-height"
        className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
      />
      <input
        type="number"
        value={value.weight}
        onChange={(e) => onChange({ weight: Number(e.target.value) || 400 })}
        className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
      />
      <span
        className="truncate text-slate-700 dark:text-slate-200"
        style={{
          fontFamily: `'${fontFamily}', sans-serif`,
          fontSize: value.size,
          lineHeight: value.lineHeight,
          fontWeight: value.weight,
          letterSpacing: value.letterSpacing,
        }}
      >
        The quick brown fox
      </span>
    </div>
  );
}

// ─── Components tab ─────────────────────────────────────────────────────────

function ComponentsPreview({ tokens }: { tokens: DesignTokens }) {
  const surface: React.CSSProperties = {
    backgroundColor: tokens.colors.neutral.bg,
    color: tokens.colors.neutral.text,
    fontFamily: `'${tokens.fonts.body.family}', sans-serif`,
  };
  return (
    <div className="space-y-6">
      <Section title="Buttons">
        <Surface tokens={tokens}>
          <div className="flex flex-wrap items-center gap-3">
            <Btn tokens={tokens} variant="primary">Primary</Btn>
            <Btn tokens={tokens} variant="secondary">Secondary</Btn>
            <Btn tokens={tokens} variant="ghost">Ghost</Btn>
            <Btn tokens={tokens} variant="danger">Danger</Btn>
            <Btn tokens={tokens} variant="primary" disabled>Disabled</Btn>
          </div>
        </Surface>
      </Section>

      <Section title="Form">
        <Surface tokens={tokens}>
          <div className="grid max-w-md gap-3" style={surface}>
            <Field label="Email" tokens={tokens}>
              <DSInput tokens={tokens} placeholder="you@example.com" />
            </Field>
            <Field label="Bio" tokens={tokens}>
              <DSTextarea tokens={tokens} rows={3} placeholder="Tell us about yourself" />
            </Field>
            <Field label="Role" tokens={tokens}>
              <DSSelect tokens={tokens}>
                <option>Designer</option>
                <option>Engineer</option>
                <option>Product</option>
              </DSSelect>
            </Field>
          </div>
        </Surface>
      </Section>

      <Section title="Badges">
        <Surface tokens={tokens}>
          <div className="flex flex-wrap gap-2">
            <Badge tokens={tokens} tone="neutral">Draft</Badge>
            <Badge tokens={tokens} tone="success">Live</Badge>
            <Badge tokens={tokens} tone="warning">Pending</Badge>
            <Badge tokens={tokens} tone="error">Failed</Badge>
            <Badge tokens={tokens} tone="info">Beta</Badge>
          </div>
        </Surface>
      </Section>

      <Section title="Card">
        <Surface tokens={tokens}>
          <div
            style={{
              backgroundColor: tokens.colors.neutral.surface,
              border: `${tokens.border.width} solid ${tokens.colors.neutral.border}`,
              borderRadius: `calc(${tokens.radius.base} * 1.5)`,
              padding: `${tokens.spacing.base * 3}px`,
              boxShadow: tokens.shadow.sm,
              maxWidth: 360,
              fontFamily: `'${tokens.fonts.body.family}', sans-serif`,
              color: tokens.colors.neutral.text,
            }}
          >
            <div style={{ fontFamily: `'${tokens.fonts.heading.family}', sans-serif`, fontSize: tokens.typeScale.h4.size, lineHeight: tokens.typeScale.h4.lineHeight, fontWeight: tokens.typeScale.h4.weight }}>
              Quarterly review
            </div>
            <p style={{ marginTop: 8, color: tokens.colors.neutral.textMuted, fontSize: tokens.typeScale.small.size, lineHeight: tokens.typeScale.small.lineHeight }}>
              Three things shipped, two are blocked. Open the dashboard to dig in.
            </p>
            <div style={{ marginTop: 16 }}>
              <Btn tokens={tokens} variant="primary">View dashboard</Btn>
            </div>
          </div>
        </Surface>
      </Section>

      <Section title="Alerts">
        <Surface tokens={tokens}>
          <div className="grid gap-2">
            {(["info", "success", "warning", "error"] as const).map((tone) => (
              <Alert key={tone} tokens={tokens} tone={tone}>
                <strong style={{ textTransform: "capitalize" }}>{tone}</strong> — this is the {tone} alert tone.
              </Alert>
            ))}
          </div>
        </Surface>
      </Section>

      <Section title="Tabs & Avatars">
        <Surface tokens={tokens}>
          <DSTabs tokens={tokens} />
          <div className="mt-4 flex items-center gap-3">
            {["AB", "CD", "EF"].map((s) => (
              <div
                key={s}
                style={{
                  width: tokens.spacing.base * 5,
                  height: tokens.spacing.base * 5,
                  borderRadius: 9999,
                  background: tokens.colors.brand.primary,
                  color: "white",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontFamily: `'${tokens.fonts.body.family}', sans-serif`,
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </Surface>
      </Section>
    </div>
  );
}

function Surface({ tokens, children }: { tokens: DesignTokens; children: React.ReactNode }) {
  return (
    <div
      className="rounded-md p-6"
      style={{
        backgroundColor: tokens.colors.neutral.bg,
        border: `${tokens.border.width} solid ${tokens.colors.neutral.border}`,
        color: tokens.colors.neutral.text,
        fontFamily: `'${tokens.fonts.body.family}', sans-serif`,
      }}
    >
      {children}
    </div>
  );
}

function Btn({
  tokens,
  variant,
  disabled,
  children,
}: {
  tokens: DesignTokens;
  variant: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { colors, radius, border, spacing, fonts, typeScale } = tokens;
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: spacing.base,
    padding: `${spacing.base}px ${spacing.base * 2}px`,
    borderRadius: radius.base,
    border: `${border.width} solid transparent`,
    fontFamily: `'${fonts.body.family}', sans-serif`,
    fontSize: typeScale.body.size,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    lineHeight: 1,
  };
  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? { background: colors.brand.primary, color: "white" }
      : variant === "secondary"
        ? { background: colors.neutral.surface, color: colors.neutral.text, borderColor: colors.neutral.border }
        : variant === "ghost"
          ? { background: "transparent", color: colors.neutral.text }
          : { background: colors.semantic.error, color: "white" };
  return <button style={{ ...baseStyle, ...variantStyle }} disabled={disabled}>{children}</button>;
}

function Field({
  label,
  children,
  tokens,
}: {
  label: string;
  children: React.ReactNode;
  tokens?: DesignTokens;
}) {
  return (
    <label className="block">
      <span
        className="mb-1 block text-xs font-medium"
        style={tokens ? { color: tokens.colors.neutral.text, fontFamily: `'${tokens.fonts.body.family}', sans-serif` } : { color: "#cbd5e1" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(tokens: DesignTokens): React.CSSProperties {
  return {
    width: "100%",
    padding: `${tokens.spacing.base}px ${tokens.spacing.base * 1.5}px`,
    background: tokens.colors.neutral.surface,
    color: tokens.colors.neutral.text,
    border: `${tokens.border.width} solid ${tokens.colors.neutral.border}`,
    borderRadius: tokens.radius.base,
    fontFamily: `'${tokens.fonts.body.family}', sans-serif`,
    fontSize: tokens.typeScale.body.size,
    lineHeight: tokens.typeScale.body.lineHeight,
    outline: "none",
  };
}

function DSInput({ tokens, ...rest }: { tokens: DesignTokens } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <input style={inputStyle(tokens)} {...rest} />;
}
function DSTextarea({ tokens, ...rest }: { tokens: DesignTokens } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea style={{ ...inputStyle(tokens), resize: "vertical" }} {...rest} />;
}
function DSSelect({ tokens, children, ...rest }: { tokens: DesignTokens; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select style={inputStyle(tokens)} {...rest}>{children}</select>;
}

function Badge({
  tokens,
  tone,
  children,
}: {
  tokens: DesignTokens;
  tone: "neutral" | "success" | "warning" | "error" | "info";
  children: React.ReactNode;
}) {
  const color =
    tone === "neutral"
      ? tokens.colors.neutral.textMuted
      : tokens.colors.semantic[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `2px ${tokens.spacing.base}px`,
        borderRadius: 9999,
        fontSize: tokens.typeScale.caption.size,
        fontWeight: 500,
        color,
        background: `${color}22`,
        border: tone === "neutral" ? `${tokens.border.width} solid ${tokens.colors.neutral.border}` : "none",
        fontFamily: `'${tokens.fonts.body.family}', sans-serif`,
      }}
    >
      {children}
    </span>
  );
}

function Alert({
  tokens,
  tone,
  children,
}: {
  tokens: DesignTokens;
  tone: "success" | "warning" | "error" | "info";
  children: React.ReactNode;
}) {
  const color = tokens.colors.semantic[tone];
  return (
    <div
      style={{
        padding: `${tokens.spacing.base * 1.5}px ${tokens.spacing.base * 2}px`,
        borderRadius: tokens.radius.base,
        borderLeft: `3px solid ${color}`,
        background: `${color}1a`,
        color: tokens.colors.neutral.text,
        fontFamily: `'${tokens.fonts.body.family}', sans-serif`,
        fontSize: tokens.typeScale.small.size,
      }}
    >
      {children}
    </div>
  );
}

function DSTabs({ tokens }: { tokens: DesignTokens }) {
  const [active, setActive] = useState("overview");
  const tabs = ["overview", "billing", "members"];
  return (
    <div style={{ borderBottom: `${tokens.border.width} solid ${tokens.colors.neutral.border}`, display: "flex", gap: tokens.spacing.base }}>
      {tabs.map((t) => {
        const on = active === t;
        return (
          <button
            key={t}
            onClick={() => setActive(t)}
            style={{
              padding: `${tokens.spacing.base}px ${tokens.spacing.base * 2}px`,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: on ? tokens.colors.brand.primary : tokens.colors.neutral.textMuted,
              borderBottom: `2px solid ${on ? tokens.colors.brand.primary : "transparent"}`,
              marginBottom: -1,
              textTransform: "capitalize",
              fontFamily: `'${tokens.fonts.body.family}', sans-serif`,
              fontSize: tokens.typeScale.body.size,
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

// ─── Patterns tab ───────────────────────────────────────────────────────────

function PatternsPreview({ tokens }: { tokens: DesignTokens }) {
  return (
    <div className="space-y-6">
      <Section title="Empty state">
        <Surface tokens={tokens}>
          <div style={{ textAlign: "center", padding: tokens.spacing.base * 6, fontFamily: `'${tokens.fonts.body.family}', sans-serif` }}>
            <div
              style={{
                width: tokens.spacing.base * 8,
                height: tokens.spacing.base * 8,
                borderRadius: 9999,
                background: `${tokens.colors.brand.primary}22`,
                margin: "0 auto",
              }}
            />
            <h3
              style={{
                fontFamily: `'${tokens.fonts.heading.family}', sans-serif`,
                fontSize: tokens.typeScale.h4.size,
                marginTop: tokens.spacing.base * 2,
                color: tokens.colors.neutral.text,
              }}
            >
              No projects yet
            </h3>
            <p style={{ color: tokens.colors.neutral.textMuted, marginTop: tokens.spacing.base, fontSize: tokens.typeScale.small.size }}>
              Create your first project to get started.
            </p>
            <div style={{ marginTop: tokens.spacing.base * 3 }}>
              <Btn tokens={tokens} variant="primary">+ New project</Btn>
            </div>
          </div>
        </Surface>
      </Section>

      <Section title="Search & filter">
        <Surface tokens={tokens}>
          <div className="flex gap-2">
            <DSInput tokens={tokens} placeholder="Search…" />
            <DSSelect tokens={tokens}>
              <option>All</option>
              <option>Active</option>
              <option>Archived</option>
            </DSSelect>
            <Btn tokens={tokens} variant="primary">Search</Btn>
          </div>
        </Surface>
      </Section>

      <Section title="Form with validation">
        <Surface tokens={tokens}>
          <div className="grid max-w-md gap-3">
            <Field label="Email" tokens={tokens}>
              <DSInput tokens={tokens} defaultValue="not-an-email" />
              <span style={{ color: tokens.colors.semantic.error, fontSize: tokens.typeScale.caption.size, marginTop: 4, display: "block" }}>
                Must be a valid email address.
              </span>
            </Field>
            <Field label="Password" tokens={tokens}>
              <DSInput tokens={tokens} type="password" defaultValue="•••••••" />
              <span style={{ color: tokens.colors.neutral.textMuted, fontSize: tokens.typeScale.caption.size, marginTop: 4, display: "block" }}>
                At least 8 characters.
              </span>
            </Field>
            <div className="flex gap-2">
              <Btn tokens={tokens} variant="primary">Sign in</Btn>
              <Btn tokens={tokens} variant="ghost">Cancel</Btn>
            </div>
          </div>
        </Surface>
      </Section>

      <Section title="Dashboard cards">
        <Surface tokens={tokens}>
          <div style={{ display: "grid", gap: tokens.spacing.base * 2, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {[
              { label: "Revenue", value: "$24,500", tone: "success" as const },
              { label: "Active users", value: "1,284", tone: "info" as const },
              { label: "Errors", value: "12", tone: "error" as const },
              { label: "Pending", value: "5", tone: "warning" as const },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: tokens.colors.neutral.surface,
                  border: `${tokens.border.width} solid ${tokens.colors.neutral.border}`,
                  borderRadius: tokens.radius.base,
                  padding: tokens.spacing.base * 2,
                  fontFamily: `'${tokens.fonts.body.family}', sans-serif`,
                }}
              >
                <div style={{ fontSize: tokens.typeScale.caption.size, color: tokens.colors.neutral.textMuted }}>
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: `'${tokens.fonts.heading.family}', sans-serif`,
                    fontSize: tokens.typeScale.h3.size,
                    color: tokens.colors.semantic[s.tone],
                    marginTop: tokens.spacing.base,
                    fontWeight: tokens.typeScale.h3.weight,
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </Section>
    </div>
  );
}

// ─── shared ─────────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
