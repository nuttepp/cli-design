"use client";

const EXAMPLE_PROMPTS = [
  "Build a landing page with hero and pricing section",
  "Create a dashboard with charts and sidebar navigation",
  "Design a portfolio with project cards and contact form",
];

export function EmptyWorkspaceState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-white to-slate-50 px-8 py-12 text-center dark:border-slate-700 dark:from-slate-900/60 dark:to-slate-800/40">
      {/* Illustration */}
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-cyan-500/10 shadow-inner dark:from-indigo-500/20 dark:via-purple-500/20 dark:to-cyan-500/20">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </div>

      <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
        Get started in seconds
      </h4>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        Create a workspace above, then describe what you want to build. The AI will generate it for you.
      </p>

      {/* Example prompts */}
      <div className="mt-6 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Try asking
        </p>
        {EXAMPLE_PROMPTS.map((prompt) => (
          <div
            key={prompt}
            className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white/80 px-4 py-2.5 text-left text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
          >
            &ldquo;{prompt}&rdquo;
          </div>
        ))}
      </div>
    </div>
  );
}
