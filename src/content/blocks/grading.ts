/**
 * Response validation + grading for interactive blocks. Pure and shared:
 * the browser uses it for instant feedback on activities, and the server
 * re-grades every submission from the stored block before saving (scores
 * from the browser are never trusted). Quiz answers are stripped before
 * blocks are sent to the browser (`sanitizeBlocksForStudent`) and only
 * graded on the server.
 */
import { z } from "zod";
import type { Block, BlockOf, BlockType } from "./schema";

const ids = z.array(z.string().max(40)).max(50);

export const responseSchemas = {
  drag_sort: z.object({ order: ids }),
  match_pairs: z.object({ matches: z.record(z.string().max(40), z.string().max(40)) }),
  fill_blank: z.object({ answers: z.array(z.string().max(60)).max(10) }),
  predict_then_reveal: z.object({ prediction: z.string().trim().min(1).max(500) }),
  multiple_choice_explore: z.object({ explored: ids.min(1) }),
  embed_sim: z.object({ done: z.literal(true) }),
  checklist_task: z.object({ checked: ids }),
  reflection_prompt: z.object({ text: z.string().trim().max(2000) }),
  quiz: z.object({ answers: z.record(z.string().max(40), z.union([z.string().max(200), z.boolean()])) }),
} as const;

export type GradableType = keyof typeof responseSchemas;
export const GRADABLE_TYPES = Object.keys(responseSchemas) as GradableType[];
export type ResponseOf<T extends GradableType> = z.infer<(typeof responseSchemas)[T]>;

export type QuizQuestionResult = { id: string; correct: boolean; explanation: string; correctAnswer: string };
export type GradeResult = {
  /** 0–100, or null for ungraded blocks (prediction, reflection…). */
  score: number | null;
  /** Counts towards lesson completion. Activities complete on any real attempt. */
  completed: boolean;
  feedback?: string;
  quiz?: { passed: boolean; results: QuizQuestionResult[] };
};

const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((num / den) * 100));
const norm = (s: string, caseSensitive: boolean) => {
  const t = s.trim().replace(/\s+/g, " ");
  return caseSensitive ? t : t.toLowerCase();
};

export function isGradable(type: BlockType): type is GradableType {
  return (GRADABLE_TYPES as string[]).includes(type);
}

export function gradeBlock(block: Block, rawResponse: unknown): { ok: true; result: GradeResult; response: unknown } | { ok: false; error: string } {
  if (!isGradable(block.type)) return { ok: false, error: `Block type ${block.type} is not graded here` };
  const parsed = responseSchemas[block.type].safeParse(rawResponse);
  if (!parsed.success) return { ok: false, error: "Invalid response" };
  const r = parsed.data;

  switch (block.type) {
    case "drag_sort": {
      const { order } = r as ResponseOf<"drag_sort">;
      const correct = block.items.map((i) => i.id);
      if (order.length !== correct.length || new Set(order).size !== order.length || !order.every((id) => correct.includes(id))) {
        return { ok: false, error: "Order must contain every item once" };
      }
      const score = pct(order.filter((id, i) => id === correct[i]).length, correct.length);
      return {
        ok: true,
        response: r,
        result: { score, completed: true, feedback: score === 100 ? block.feedback_correct : block.feedback_incorrect },
      };
    }
    case "match_pairs": {
      const { matches } = r as ResponseOf<"match_pairs">;
      const right = block.pairs.filter((p) => matches[p.id] === p.id).length;
      return { ok: true, response: r, result: { score: pct(right, block.pairs.length), completed: Object.keys(matches).length > 0 } };
    }
    case "fill_blank": {
      const { answers } = r as ResponseOf<"fill_blank">;
      const right = block.blanks.filter((b, i) =>
        b.answers.some((a) => norm(a, block.case_sensitive) === norm(answers[i] ?? "", block.case_sensitive)),
      ).length;
      return { ok: true, response: r, result: { score: pct(right, block.blanks.length), completed: answers.some((a) => a.trim()) } };
    }
    case "predict_then_reveal": {
      const { prediction } = r as ResponseOf<"predict_then_reveal">;
      if (block.options && !block.options.some((o) => o.id === prediction)) return { ok: false, error: "Unknown option" };
      return { ok: true, response: r, result: { score: null, completed: true } };
    }
    case "multiple_choice_explore": {
      const { explored } = r as ResponseOf<"multiple_choice_explore">;
      if (!explored.every((id) => block.options.some((o) => o.id === id))) return { ok: false, error: "Unknown option" };
      const score = block.correct_option_id ? (explored.includes(block.correct_option_id) ? 100 : 0) : null;
      return { ok: true, response: r, result: { score, completed: true } };
    }
    case "embed_sim":
      return { ok: true, response: r, result: { score: null, completed: true } };
    case "checklist_task": {
      const { checked } = r as ResponseOf<"checklist_task">;
      const valid = checked.filter((id) => block.steps.some((s) => s.id === id));
      const score = pct(new Set(valid).size, block.steps.length);
      return { ok: true, response: { checked: [...new Set(valid)] }, result: { score, completed: score === 100 } };
    }
    case "reflection_prompt": {
      const { text } = r as ResponseOf<"reflection_prompt">;
      return { ok: true, response: { text }, result: { score: null, completed: text.length >= block.min_chars } };
    }
    case "quiz":
      return { ok: true, response: r, result: gradeQuiz(block, (r as ResponseOf<"quiz">).answers) };
  }
}

export function gradeQuiz(block: BlockOf<"quiz">, answers: Record<string, string | boolean>): GradeResult {
  const results: QuizQuestionResult[] = block.questions.map((q) => {
    const a = answers[q.id];
    switch (q.kind) {
      case "mcq":
        return {
          id: q.id,
          correct: a === q.correct_option_id,
          explanation: q.explanation,
          correctAnswer: q.options.find((o) => o.id === q.correct_option_id)?.text ?? "",
        };
      case "true_false":
        return { id: q.id, correct: a === q.answer, explanation: q.explanation, correctAnswer: q.answer ? "True" : "False" };
      case "short_answer":
        return {
          id: q.id,
          correct: typeof a === "string" && q.accepted_answers.some((x) => norm(x, false) === norm(a, false)),
          explanation: q.explanation,
          correctAnswer: q.accepted_answers[0] ?? "",
        };
    }
  });
  const score = pct(results.filter((x) => x.correct).length, results.length);
  const passed = score >= block.passing_score;
  return { score, completed: passed, quiz: { passed, results } };
}

// ---------------------------------------------------------------------------
// What the browser is allowed to see
// ---------------------------------------------------------------------------
export type StudentQuizQuestion =
  | { kind: "mcq"; id: string; prompt: string; options: { id: string; text: string }[] }
  | { kind: "true_false"; id: string; statement: string }
  | { kind: "short_answer"; id: string; prompt: string };

export type StudentBlock =
  | Exclude<Block, { type: "quiz" }>
  | (Omit<BlockOf<"quiz">, "questions"> & { questions: StudentQuizQuestion[] });

/** Remove quiz answers + explanations; they're revealed by the server after submitting. */
export function sanitizeBlocksForStudent(blocks: Block[]): StudentBlock[] {
  return blocks.map((b) => {
    if (b.type !== "quiz") return b;
    return {
      ...b,
      questions: b.questions.map((q): StudentQuizQuestion => {
        if (q.kind === "mcq") return { kind: "mcq", id: q.id, prompt: q.prompt, options: q.options };
        if (q.kind === "true_false") return { kind: "true_false", id: q.id, statement: q.statement };
        return { kind: "short_answer", id: q.id, prompt: q.prompt };
      }),
    };
  });
}

/** Deterministic shuffle (so a student sees the same order after reload). */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // Never present a sorting task already solved.
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

