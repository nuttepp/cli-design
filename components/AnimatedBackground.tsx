"use client";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900" />

      {/* Animated gradient blobs */}
      <div className="animate-blob absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-600/10" />
      <div className="animate-blob animation-delay-2000 absolute -top-16 -right-32 h-[450px] w-[450px] rounded-full bg-purple-400/20 blur-3xl dark:bg-purple-600/10" />
      <div className="animate-blob animation-delay-4000 absolute -bottom-32 left-1/3 h-[450px] w-[450px] rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-600/8" />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]" />
    </div>
  );
}
