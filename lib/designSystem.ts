// Opinionated, focused design tokens — one value per role, not a generic
// scale to pick from. Spacing/radius/etc derive from a single base value.

export interface FontDefinition {
  family: string;
  weights: number[];
}

export interface TypeStyle {
  size: string;
  lineHeight: string;
  weight: number;
  letterSpacing?: string;
}

export type TypeScaleKey =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body"
  | "small"
  | "caption";

export const TYPE_SCALE_KEYS: TypeScaleKey[] = [
  "h1",
  "h2",
  "h3",
  "h4",
  "body",
  "small",
  "caption",
];

export interface DesignTokens {
  fonts: {
    heading: FontDefinition;
    body: FontDefinition;
    mono: FontDefinition;
  };
  typeScale: Record<TypeScaleKey, TypeStyle>;
  colors: {
    brand: { primary: string; secondary: string };
    semantic: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
    neutral: {
      bg: string;
      surface: string;
      text: string;
      textMuted: string;
      border: string;
    };
  };
  spacing: { base: number };
  radius: { base: string };
  border: { width: string };
  shadow: { sm: string; md: string; lg: string };
}

export const POPULAR_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Poppins",
  "Manrope",
  "Plus Jakarta Sans",
  "DM Sans",
  "Work Sans",
  "Nunito",
  "Montserrat",
  "Source Sans 3",
  "IBM Plex Sans",
  "Geist",
  "Space Grotesk",
];

export const POPULAR_MONO_FONTS = [
  "JetBrains Mono",
  "Fira Code",
  "IBM Plex Mono",
  "Source Code Pro",
  "Roboto Mono",
  "Geist Mono",
  "Space Mono",
];

export const DEFAULT_TOKENS: DesignTokens = {
  fonts: {
    heading: { family: "Inter", weights: [500, 600, 700] },
    body: { family: "Inter", weights: [400, 500] },
    mono: { family: "JetBrains Mono", weights: [400, 500] },
  },
  typeScale: {
    h1: { size: "2.25rem", lineHeight: "2.5rem", weight: 700, letterSpacing: "-0.02em" },
    h2: { size: "1.875rem", lineHeight: "2.25rem", weight: 700, letterSpacing: "-0.01em" },
    h3: { size: "1.5rem", lineHeight: "2rem", weight: 600 },
    h4: { size: "1.25rem", lineHeight: "1.75rem", weight: 600 },
    body: { size: "1rem", lineHeight: "1.5rem", weight: 400 },
    small: { size: "0.875rem", lineHeight: "1.25rem", weight: 400 },
    caption: { size: "0.75rem", lineHeight: "1rem", weight: 500, letterSpacing: "0.04em" },
  },
  colors: {
    brand: {
      primary: "#6366f1",
      secondary: "#0ea5e9",
    },
    semantic: {
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
      info: "#3b82f6",
    },
    neutral: {
      bg: "#0f172a",
      surface: "#1e293b",
      text: "#f1f5f9",
      textMuted: "#94a3b8",
      border: "#334155",
    },
  },
  spacing: { base: 8 },
  radius: { base: "8px" },
  border: { width: "1px" },
  shadow: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.2)",
    md: "0 4px 12px rgba(0, 0, 0, 0.25)",
    lg: "0 12px 32px rgba(0, 0, 0, 0.35)",
  },
};

export function googleFontsUrl(tokens: DesignTokens): string {
  const seen = new Map<string, Set<number>>();
  const add = (def: FontDefinition) => {
    if (!def.family) return;
    const w = seen.get(def.family) ?? new Set<number>();
    for (const x of def.weights) w.add(x);
    seen.set(def.family, w);
  };
  add(tokens.fonts.heading);
  add(tokens.fonts.body);
  add(tokens.fonts.mono);
  if (seen.size === 0) return "";
  const families = Array.from(seen.entries())
    .map(([family, weights]) => {
      const ws = Array.from(weights).sort((a, b) => a - b).join(";");
      return `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${ws}`;
    })
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export function spacingScale(base: number): Record<string, string> {
  const mults: Array<[string, number]> = [
    ["1", 0.5],
    ["2", 1],
    ["3", 1.5],
    ["4", 2],
    ["6", 3],
    ["8", 4],
    ["12", 6],
    ["16", 8],
  ];
  const out: Record<string, string> = {};
  for (const [k, m] of mults) out[k] = `${Math.round(base * m * 100) / 100}px`;
  return out;
}

function fontStack(family: string, fallback: string): string {
  return `'${family}', ${fallback}`;
}

export function buildGlobalCss(tokens: DesignTokens): string {
  const fontsUrl = googleFontsUrl(tokens);
  const spacing = spacingScale(tokens.spacing.base);

  const headingStack = fontStack(tokens.fonts.heading.family, "system-ui, sans-serif");
  const bodyStack = fontStack(tokens.fonts.body.family, "system-ui, sans-serif");
  const monoStack = fontStack(
    tokens.fonts.mono.family,
    'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  );

  const c = tokens.colors;
  const ts = tokens.typeScale;

  const typeRule = (sel: string, t: TypeStyle, family: string) => {
    const ls = t.letterSpacing ? `\n  letter-spacing: ${t.letterSpacing};` : "";
    return `${sel} {
  font-family: ${family};
  font-size: ${t.size};
  line-height: ${t.lineHeight};
  font-weight: ${t.weight};${ls}
}`;
  };

  const headingTypes = (["h1", "h2", "h3", "h4"] as const)
    .map((k) => typeRule(`.${k}, ${k}`, ts[k], headingStack))
    .join("\n\n");

  const bodyTypes = [
    typeRule(".body, p", ts.body, bodyStack),
    typeRule(".small", ts.small, bodyStack),
    typeRule(".caption", ts.caption, bodyStack),
  ].join("\n\n");

  return `/*
 * global.css — generated from the Design System tab.
 * DO NOT EDIT BY HAND. Custom workspace styles belong in style.css.
 */
${fontsUrl ? `@import url('${fontsUrl}');\n` : ""}
:root {
  /* Brand */
  --color-primary: ${c.brand.primary};
  --color-secondary: ${c.brand.secondary};

  /* Semantic */
  --color-success: ${c.semantic.success};
  --color-warning: ${c.semantic.warning};
  --color-error: ${c.semantic.error};
  --color-info: ${c.semantic.info};

  /* Neutrals */
  --color-bg: ${c.neutral.bg};
  --color-surface: ${c.neutral.surface};
  --color-text: ${c.neutral.text};
  --color-text-muted: ${c.neutral.textMuted};
  --color-border: ${c.neutral.border};

  /* Typography */
  --font-heading: ${headingStack};
  --font-body: ${bodyStack};
  --font-mono: ${monoStack};

  /* Spacing (8pt-style scale derived from base) */
  --space-1: ${spacing["1"]};
  --space-2: ${spacing["2"]};
  --space-3: ${spacing["3"]};
  --space-4: ${spacing["4"]};
  --space-6: ${spacing["6"]};
  --space-8: ${spacing["8"]};
  --space-12: ${spacing["12"]};
  --space-16: ${spacing["16"]};

  /* Radius (derived from base) */
  --radius-sm: calc(${tokens.radius.base} / 2);
  --radius: ${tokens.radius.base};
  --radius-lg: calc(${tokens.radius.base} * 1.5);
  --radius-xl: calc(${tokens.radius.base} * 2);
  --radius-full: 9999px;

  /* Borders & Shadows */
  --border-width: ${tokens.border.width};
  --shadow-sm: ${tokens.shadow.sm};
  --shadow-md: ${tokens.shadow.md};
  --shadow-lg: ${tokens.shadow.lg};
}

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font-body);
  font-size: ${ts.body.size};
  line-height: ${ts.body.lineHeight};
  background: var(--color-bg);
  color: var(--color-text);
}
code, pre, kbd, samp { font-family: var(--font-mono); }

/* Type scale */
${headingTypes}

${bodyTypes}

.muted { color: var(--color-text-muted); }

/* Surface utilities */
.bg-surface { background: var(--color-surface); }
.bg-primary { background: var(--color-primary); color: white; }
.bg-secondary { background: var(--color-secondary); color: white; }
.text-primary { color: var(--color-primary); }
.text-secondary { color: var(--color-secondary); }
.text-success { color: var(--color-success); }
.text-warning { color: var(--color-warning); }
.text-error { color: var(--color-error); }
.text-info { color: var(--color-info); }
.border-default { border: var(--border-width) solid var(--color-border); }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius);
  border: var(--border-width) solid transparent;
  font-family: var(--font-body);
  font-size: ${ts.body.size};
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}
.btn-secondary:hover:not(:disabled) { background: var(--color-border); }
.btn-ghost { background: transparent; color: var(--color-text); }
.btn-ghost:hover:not(:disabled) { background: var(--color-surface); }
.btn-danger { background: var(--color-error); color: white; }
.btn-danger:hover:not(:disabled) { filter: brightness(1.08); }

/* Form */
.input, .textarea, .select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  color: var(--color-text);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-size: ${ts.body.size};
  line-height: ${ts.body.lineHeight};
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.input::placeholder, .textarea::placeholder { color: var(--color-text-muted); }
.input:focus, .textarea:focus, .select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
}
.label {
  display: inline-block;
  margin-bottom: var(--space-1);
  font-size: ${ts.small.size};
  font-weight: 500;
  color: var(--color-text);
}
.help { font-size: ${ts.caption.size}; color: var(--color-text-muted); }

/* Card */
.card {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

/* Badge */
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: ${ts.caption.size};
  font-weight: 500;
}
.badge-neutral { background: var(--color-surface); color: var(--color-text-muted); border: var(--border-width) solid var(--color-border); }
.badge-success { background: color-mix(in srgb, var(--color-success) 15%, transparent); color: var(--color-success); }
.badge-warning { background: color-mix(in srgb, var(--color-warning) 15%, transparent); color: var(--color-warning); }
.badge-error { background: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error); }
.badge-info { background: color-mix(in srgb, var(--color-info) 15%, transparent); color: var(--color-info); }

/* Alert */
.alert {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  border-left: 3px solid var(--color-info);
  background: color-mix(in srgb, var(--color-info) 10%, transparent);
  color: var(--color-text);
}
.alert-success { border-left-color: var(--color-success); background: color-mix(in srgb, var(--color-success) 10%, transparent); }
.alert-warning { border-left-color: var(--color-warning); background: color-mix(in srgb, var(--color-warning) 10%, transparent); }
.alert-error { border-left-color: var(--color-error); background: color-mix(in srgb, var(--color-error) 10%, transparent); }

/* Tabs */
.tabs { display: flex; gap: var(--space-1); border-bottom: var(--border-width) solid var(--color-border); }
.tab {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: ${ts.body.size};
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tab:hover { color: var(--color-text); }
.tab[aria-selected="true"] { color: var(--color-primary); border-bottom-color: var(--color-primary); }

/* Avatar */
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--space-8));
  height: calc(var(--space-8));
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  font-weight: 600;
}

/* Spacing & layout helpers */
.stack > * + * { margin-top: var(--space-4); }
.row { display: flex; gap: var(--space-3); align-items: center; }
.grid-cards { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
`;
}
