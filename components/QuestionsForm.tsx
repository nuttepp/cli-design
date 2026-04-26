"use client";

import { useState } from "react";
import type { ClarifyingQuestion } from "@/lib/clarifyingQuestions";

interface Props {
  questions: ClarifyingQuestion[];
  onSubmit: (text: string) => void;
  variant?: "inline" | "tab";
  disabled?: boolean;
}

interface AnswerState {
  selected: string[];
  other: string;
}

const OTHER = "__other__";

function emptyAnswer(): AnswerState {
  return { selected: [], other: "" };
}

function formatAnswer(q: ClarifyingQuestion, a: AnswerState): string {
  const otherText = a.other.trim();
  const includesOther = a.selected.includes(OTHER);
  if (q.type === "single" || q.type === "multi") {
    const picks = a.selected.filter((s) => s !== OTHER);
    if (includesOther && otherText) picks.push(`Other: ${otherText}`);
    return picks.join(", ");
  }
  return otherText;
}

export function QuestionsForm({
  questions,
  onSubmit,
  variant = "inline",
  disabled = false,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [submitted, setSubmitted] = useState(false);
  const isTab = variant === "tab";
  const locked = submitted || disabled;

  const getAnswer = (id: string) => answers[id] ?? emptyAnswer();
  const update = (id: string, patch: Partial<AnswerState>) => {
    setAnswers((prev) => {
      const cur = prev[id] ?? emptyAnswer();
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

  const filled = questions.filter(
    (q) => formatAnswer(q, getAnswer(q.id)).length > 0,
  ).length;
  const canSubmit = !locked && filled > 0;

  const submit = () => {
    if (!canSubmit) return;
    const lines = questions
      .map((q) => {
        const v = formatAnswer(q, getAnswer(q.id));
        return v ? `**${q.question}**\n${v}` : null;
      })
      .filter((s): s is string => Boolean(s));
    if (lines.length === 0) return;
    setSubmitted(true);
    onSubmit(lines.join("\n\n"));
  };

  return (
    <div
      className={
        isTab
          ? "mx-auto flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto p-6"
          : "space-y-3 rounded-md border border-indigo-500/30 bg-indigo-500/5 p-3"
      }
    >
      {isTab && (
        <header className="space-y-1">
          <h2 className="text-base font-semibold text-slate-100">
            Project brief
          </h2>
          <p className="text-xs text-slate-400">
            Answer what's relevant — leave the rest blank.
          </p>
        </header>
      )}
      {!isTab && (
        <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-300">
          A few questions to scope this
        </p>
      )}
      <div className={isTab ? "space-y-4" : "space-y-3"}>
        {questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            answer={getAnswer(q.id)}
            onChange={(patch) => update(q.id, patch)}
            disabled={locked}
            isTab={isTab}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitted ? "Sent" : "Send answers"}
        </button>
        <span className="text-[11px] text-slate-500">
          {filled}/{questions.length} answered
        </span>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  answer,
  onChange,
  disabled,
  isTab,
}: {
  question: ClarifyingQuestion;
  answer: AnswerState;
  onChange: (patch: Partial<AnswerState>) => void;
  disabled: boolean;
  isTab: boolean;
}) {
  const labelClass = isTab
    ? "block text-sm text-slate-200"
    : "block text-xs text-slate-200";
  const isChoice = question.type === "single" || question.type === "multi";
  const showOtherText = !isChoice || answer.selected.includes(OTHER);

  const toggle = (opt: string) => {
    if (question.type === "single") {
      onChange({ selected: answer.selected[0] === opt ? [] : [opt] });
      return;
    }
    if (question.type === "multi") {
      const has = answer.selected.includes(opt);
      onChange({
        selected: has
          ? answer.selected.filter((s) => s !== opt)
          : [...answer.selected, opt],
      });
    }
  };

  return (
    <div className="space-y-1.5">
      <span className={labelClass}>{question.question}</span>
      {isChoice && question.options && (
        <div className="flex flex-wrap gap-1.5">
          {question.options.map((opt) => (
            <OptionChip
              key={opt}
              label={opt}
              type={question.type as "single" | "multi"}
              checked={answer.selected.includes(opt)}
              disabled={disabled}
              onToggle={() => toggle(opt)}
            />
          ))}
          <OptionChip
            label="Other"
            type={question.type as "single" | "multi"}
            checked={answer.selected.includes(OTHER)}
            disabled={disabled}
            onToggle={() => toggle(OTHER)}
          />
        </div>
      )}
      {showOtherText && (
        <textarea
          value={answer.other}
          onChange={(e) => onChange({ other: e.target.value })}
          disabled={disabled}
          rows={isTab ? 2 : 2}
          placeholder={
            isChoice ? "Other (free text)…" : "Type your answer…"
          }
          className="block w-full resize-y rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
        />
      )}
    </div>
  );
}

function OptionChip({
  label,
  type,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  type: "single" | "multi";
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const shape = type === "single" ? "rounded-full" : "rounded";
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
        checked
          ? "border-indigo-400 bg-indigo-500/20 text-indigo-100"
          : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type={type === "single" ? "radio" : "checkbox"}
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`inline-flex h-3 w-3 shrink-0 items-center justify-center border ${shape} ${
          checked
            ? "border-indigo-400 bg-indigo-500 text-white"
            : "border-slate-500 bg-slate-950"
        }`}
      >
        {checked && type === "multi" && (
          <svg
            viewBox="0 0 12 12"
            className="h-2 w-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 6.5L5 9l4.5-5" />
          </svg>
        )}
        {checked && type === "single" && (
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        )}
      </span>
      <span>{label}</span>
    </label>
  );
}
