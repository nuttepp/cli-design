export type ClarifyingInputType = "text" | "single" | "multi";

export interface ClarifyingQuestion {
  id: string;
  question: string;
  type?: ClarifyingInputType;
  options?: string[];
}

export interface ParsedQuestions {
  questions: ClarifyingQuestion[];
  cleanText: string;
}

const QUESTIONS_BLOCK_RE = /```questions\s*([\s\S]*?)```/;

export function parseClarifyingQuestions(text: string): ParsedQuestions | null {
  const m = text.match(QUESTIONS_BLOCK_RE);
  if (!m) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1].trim());
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const questions: ClarifyingQuestion[] = [];
  for (const raw of parsed) {
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof (raw as ClarifyingQuestion).id !== "string" ||
      typeof (raw as ClarifyingQuestion).question !== "string" ||
      !(raw as ClarifyingQuestion).question.trim()
    ) {
      continue;
    }
    const r = raw as ClarifyingQuestion;
    const opts = Array.isArray(r.options)
      ? r.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
      : undefined;
    let type: ClarifyingInputType | undefined = r.type;
    if (type !== "single" && type !== "multi" && type !== "text") {
      type = opts && opts.length > 0 ? "single" : "text";
    }
    questions.push({
      id: r.id,
      question: r.question,
      type,
      options: opts && opts.length > 0 ? opts : undefined,
    });
  }
  if (questions.length === 0) return null;
  const cleanText = text.replace(QUESTIONS_BLOCK_RE, "").trim();
  return { questions, cleanText };
}

export function formatAnswers(
  questions: ClarifyingQuestion[],
  answers: Record<string, string>,
): string {
  const lines = questions
    .map((q) => {
      const a = (answers[q.id] ?? "").trim();
      return a ? `**${q.question}**\n${a}` : null;
    })
    .filter((s): s is string => Boolean(s));
  return lines.join("\n\n");
}
