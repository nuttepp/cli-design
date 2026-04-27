"use client";

interface StepFlowGuideProps {
  currentStep: 1 | 2 | 3;
}

const steps = [
  { num: 1, label: "Select CLI", desc: "Pick your AI agent" },
  { num: 2, label: "Create workspace", desc: "Name your project" },
  { num: 3, label: "Start building", desc: "Design with AI" },
];

export function StepFlowGuide({ currentStep }: StepFlowGuideProps) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {steps.map((step, i) => {
        const isActive = step.num === currentStep;
        const isCompleted = step.num < currentStep;

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              {/* Circle */}
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  isCompleted
                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                    : isActive
                      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30 ring-4 ring-indigo-500/20"
                      : "border-2 border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500"
                }`}
              >
                {isCompleted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.num
                )}
              </div>
              {/* Label */}
              <p className={`mt-2 text-xs font-medium ${isActive || isCompleted ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}>
                {step.label}
              </p>
              <p className={`text-[10px] ${isActive || isCompleted ? "text-slate-500 dark:text-slate-400" : "text-slate-300 dark:text-slate-600"}`}>
                {step.desc}
              </p>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={`mx-4 mt-[-1.5rem] h-0.5 w-16 rounded-full ${
                  step.num < currentStep
                    ? "bg-indigo-500"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
