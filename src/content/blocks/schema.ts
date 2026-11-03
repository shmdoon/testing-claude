/**
 * Lesson block schemas — the contract between the content team and the platform.
 *
 * Every block: { id, type, phase, ...props }. Add a new block type by:
 *   1. adding its schema here and to `blockSchema`,
 *   2. adding a registry entry in `registry.tsx` (label, template, renderers).
 * The DB stores blocks as JSONB; everything is validated with these schemas
 * on save, on publish and again before rendering.
 *
 * Kept free of app imports so Node scripts (seed generator) can load it.
 */
import { z } from "zod";

export const PHASES = ["activity", "reflection", "module", "check"] as const;
export type Phase = (typeof PHASES)[number];

export const SUBMISSION_TYPES = ["url", "screenshot", "file", "text"] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

/** Hosts allowed for `embed_sim` iframes (see docs/DECISIONS.md C3). */
export const APPROVED_SIM_HOSTS = [
  "phet.colorado.edu",
  "www.geogebra.org",
  "scratch.mit.edu",
  "editor.p5js.org",
  "playground.tensorflow.org",
] as const;

const VIDEO_HOSTS = {
  youtube: ["www.youtube.com", "youtube.com", "youtu.be", "www.youtube-nocookie.com"],
  bunny: ["iframe.mediadelivery.net", "player.mediadelivery.net"],
  cloudflare_stream: ["iframe.videodelivery.net", "customer-*.cloudflarestream.com"],
} as const;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,40}$/, "Use letters, numbers, - or _ (max 40)");
const text = (max = 500) => z.string().trim().min(1, "Required").max(max);
const markdown = (max = 10_000) => z.string().trim().min(1, "Required").max(max);
const httpsUrl = z.url({ protocol: /^https$/, message: "Must be an https:// URL" });
/** Image source: https URL, a path in the public course-media bucket, or a bundled /public asset. */
const imageSrc = z.union([
  httpsUrl,
  z.string().regex(/^(course-media\/|\/(?!\/))[\w./-]+$/, "Use https://…, course-media/… or /…"),
]);

export function hostMatches(host: string, pattern: string): boolean {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();
  if (p.startsWith("*.")) return h.endsWith(p.slice(1)) && h.length > p.length - 1;
  if (p.includes("*")) {
    const re = new RegExp(`^${p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[a-z0-9-]+")}$`);
    return re.test(h);
  }
  return h === p;
}

function hostIn(url: string, patterns: readonly string[]) {
  try {
    const host = new URL(url).hostname;
    return patterns.some((p) => hostMatches(host, p));
  } catch {
    return false;
  }
}

const uniqueIds = <T extends { id: string }>(items: T[]) => new Set(items.map((i) => i.id)).size === items.length;

const base = <T extends string, P extends readonly Phase[]>(type: T, phases: P) =>
  z.object({
    id,
    type: z.literal(type),
    phase: z.enum(phases as unknown as [P[number], ...P[number][]]),
  });

const CONTENT_PHASES = ["activity", "reflection", "module"] as const;

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
export const dragSortBlock = base("drag_sort", ["activity"])
  .extend({
    prompt: text(),
    /** Items in the CORRECT order; the player shuffles them. */
    items: z.array(z.object({ id, text: text(120) })).min(2).max(12).refine(uniqueIds, "Item ids must be unique"),
    feedback_correct: text().optional(),
    feedback_incorrect: text().optional(),
  });

export const matchPairsBlock = base("match_pairs", ["activity"]).extend({
  prompt: text(),
  pairs: z
    .array(z.object({ id, left: text(120), right: text(120) }))
    .min(2)
    .max(10)
    .refine(uniqueIds, "Pair ids must be unique"),
});

export const fillBlankBlock = base("fill_blank", ["activity"])
  .extend({
    prompt: text().optional(),
    /** Text with numbered gaps: "A {{0}} learns from {{1}}." */
    text: text(2000),
    blanks: z
      .array(z.object({ answers: z.array(text(60)).min(1).max(10), hint: text(120).optional() }))
      .min(1)
      .max(10),
    word_bank: z.array(text(60)).max(20).optional(),
    case_sensitive: z.boolean().default(false),
  })
  .superRefine((b, ctx) => {
    const used = [...b.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const expected = b.blanks.map((_, i) => i);
    if (used.length !== expected.length || !expected.every((i) => used.includes(i))) {
      ctx.addIssue({ code: "custom", path: ["text"], message: `Text must contain {{0}}…{{${expected.length - 1}}} once each` });
    }
  });

export const predictThenRevealBlock = base("predict_then_reveal", ["activity"]).extend({
  prompt: text(),
  /** Omit for a free-text prediction. */
  options: z.array(z.object({ id, text: text(200) })).min(2).max(6).refine(uniqueIds).optional(),
  reveal: markdown(4000),
  reveal_image: z.object({ src: imageSrc, alt: text(200) }).optional(),
});

export const multipleChoiceExploreBlock = base("multiple_choice_explore", ["activity"]).extend({
  prompt: text(),
  options: z
    .array(z.object({ id, text: text(200), feedback: text(1000) }))
    .min(2)
    .max(6)
    .refine(uniqueIds, "Option ids must be unique"),
  /** Optional: if set, the student is nudged until they find it. */
  correct_option_id: id.optional(),
});

export const embedSimBlock = base("embed_sim", ["activity", "module"]).extend({
  title: text(120),
  url: httpsUrl.refine((u) => hostIn(u, APPROVED_SIM_HOSTS), {
    message: `Host must be one of: ${APPROVED_SIM_HOSTS.join(", ")}`,
  }),
  instructions: markdown(2000).optional(),
  height: z.number().int().min(240).max(900).default(480),
});

export const uploadWorkBlock = base("upload_work", ["activity"]).extend({
  prompt: text(),
  accept: z.array(z.enum(["image", "pdf"])).min(1).default(["image"]),
  max_files: z.number().int().min(1).max(5).default(1),
});

export const checklistTaskBlock = base("checklist_task", ["activity"]).extend({
  prompt: text(),
  steps: z.array(z.object({ id, text: text(300) })).min(1).max(15).refine(uniqueIds, "Step ids must be unique"),
});

const fallbackSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("demo_video"),
    title: text(120),
    provider: z.enum(["youtube", "bunny", "cloudflare_stream"]),
    url: httpsUrl,
    captions_url: httpsUrl.optional(),
    instructions: markdown(2000).optional(),
  }),
  z.object({ kind: z.literal("with_parent"), instructions: markdown(2000) }),
  z.object({ kind: z.literal("alternative_tool"), tool_id: z.uuid(), instructions: markdown(2000) }),
]);
export type ExternalTaskFallback = z.infer<typeof fallbackSchema>;

export const externalTaskBlock = base("external_task", ["activity"]).extend({
  tool_id: z.uuid(),
  goal: text(300),
  steps: z
    .array(
      z.object({
        id,
        text: text(500),
        screenshot: z.object({ src: imageSrc, alt: text(200) }).optional(),
      }),
    )
    .min(1)
    .max(15)
    .refine(uniqueIds, "Step ids must be unique"),
  starter_prompts: z
    .array(z.object({ id, label: text(80), text: text(2000) }))
    .max(5)
    .refine(uniqueIds)
    .default([]),
  estimated_minutes: z.number().int().min(1).max(180),
  submission_types: z.array(z.enum(SUBMISSION_TYPES)).min(1).refine((a) => new Set(a).size === a.length, "No duplicates"),
  fallback: fallbackSchema.optional(),
});

// ---------------------------------------------------------------------------
// Reflection
// ---------------------------------------------------------------------------
export const reflectionPromptBlock = base("reflection_prompt", ["reflection"]).extend({
  prompt: text(),
  placeholder: text(200).optional(),
  min_chars: z.number().int().min(0).max(500).default(20),
});

// ---------------------------------------------------------------------------
// Module / content
// ---------------------------------------------------------------------------
export const richTextBlock = base("rich_text", CONTENT_PHASES).extend({ markdown: markdown() });

export const videoBlock = base("video", ["module", "activity"])
  .extend({
    title: text(120),
    provider: z.enum(["youtube", "bunny", "cloudflare_stream"]),
    url: httpsUrl,
    /** WebVTT captions file (accessibility). */
    captions_url: httpsUrl.optional(),
    transcript: markdown(20_000).optional(),
    duration_seconds: z.number().int().positive().optional(),
  })
  .superRefine((b, ctx) => {
    if (!hostIn(b.url, VIDEO_HOSTS[b.provider])) {
      ctx.addIssue({ code: "custom", path: ["url"], message: `URL host is not a ${b.provider} host` });
    }
  });

export const imageBlock = base("image", CONTENT_PHASES).extend({
  src: imageSrc,
  alt: text(200),
  caption: text(300).optional(),
});

export const calloutBlock = base("callout", CONTENT_PHASES).extend({
  variant: z.enum(["info", "tip", "warning", "fun_fact"]).default("info"),
  title: text(120).optional(),
  markdown: markdown(2000),
});

export const keyPointsBlock = base("key_points", ["module", "check"]).extend({
  title: text(120).default("Key points"),
  points: z.array(text(300)).min(1).max(10),
});

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------
const quizQuestion = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("mcq"),
      id,
      prompt: text(),
      options: z.array(z.object({ id, text: text(200) })).min(2).max(6).refine(uniqueIds),
      correct_option_id: id,
      explanation: text(1000),
    })
    .refine((q) => q.options.some((o) => o.id === q.correct_option_id), {
      message: "correct_option_id must match an option",
      path: ["correct_option_id"],
    }),
  z.object({ kind: z.literal("true_false"), id, statement: text(), answer: z.boolean(), explanation: text(1000) }),
  z.object({
    kind: z.literal("short_answer"),
    id,
    prompt: text(),
    accepted_answers: z.array(text(100)).min(1).max(20),
    explanation: text(1000),
  }),
]);
export type QuizQuestion = z.infer<typeof quizQuestion>;

export const quizBlock = base("quiz", ["check"]).extend({
  title: text(120).default("Quick check"),
  passing_score: z.number().int().min(0).max(100).default(60),
  questions: z.array(quizQuestion).min(1).max(20).refine(uniqueIds, "Question ids must be unique"),
});

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------
export const blockSchema = z.discriminatedUnion("type", [
  dragSortBlock,
  matchPairsBlock,
  fillBlankBlock,
  predictThenRevealBlock,
  multipleChoiceExploreBlock,
  embedSimBlock,
  uploadWorkBlock,
  checklistTaskBlock,
  externalTaskBlock,
  reflectionPromptBlock,
  richTextBlock,
  videoBlock,
  imageBlock,
  calloutBlock,
  keyPointsBlock,
  quizBlock,
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

export const BLOCK_TYPES = blockSchema.options.map((o) => o.shape.type.value) as BlockType[];

export const ACTIVITY_TYPES = [
  "drag_sort",
  "match_pairs",
  "fill_blank",
  "predict_then_reveal",
  "multiple_choice_explore",
  "embed_sim",
  "upload_work",
  "checklist_task",
  "external_task",
] as const satisfies readonly BlockType[];

export function allowedPhases(type: BlockType): readonly Phase[] {
  const opt = blockSchema.options.find((o) => o.shape.type.value === type)!;
  return opt.shape.phase.options as readonly Phase[];
}

// ---------------------------------------------------------------------------
// Lesson-level validation
// ---------------------------------------------------------------------------
export const lessonBlocksSchema = z
  .array(blockSchema)
  .max(60, "A lesson can have at most 60 blocks")
  .superRefine((blocks, ctx) => {
    const seen = new Set<string>();
    blocks.forEach((b, i) => {
      if (seen.has(b.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `Duplicate block id "${b.id}"` });
      seen.add(b.id);
    });
    // Phases must appear in lesson order: activity → reflection → module → check.
    let last = 0;
    blocks.forEach((b, i) => {
      const p = PHASES.indexOf(b.phase);
      if (p < last) {
        ctx.addIssue({ code: "custom", path: [i, "phase"], message: `"${b.phase}" block after a later phase` });
      }
      last = Math.max(last, p);
    });
  });

export type LessonIssue = { level: "error" | "warning"; message: string; path?: (string | number)[] };

/** Full check used before publishing: schema errors + pedagogy warnings. */
export function checkLessonForPublish(input: unknown): { ok: boolean; blocks?: Block[]; issues: LessonIssue[] } {
  const parsed = lessonBlocksSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        level: "error",
        message: i.message,
        path: i.path.filter((p): p is string | number => typeof p !== "symbol"),
      })),
    };
  }
  const blocks = parsed.data;
  const issues: LessonIssue[] = [];
  const has = (phase: Phase) => blocks.some((b) => b.phase === phase);
  if (!has("activity")) issues.push({ level: "error", message: "Every lesson starts with an activity block." });
  if (!has("module")) issues.push({ level: "error", message: "Add at least one module (concept) block." });
  if (!has("reflection")) issues.push({ level: "warning", message: "No reflection prompt (\"What did you notice?\")." });
  if (!has("check")) issues.push({ level: "warning", message: "No quick check (quiz) at the end." });
  return { ok: !issues.some((i) => i.level === "error"), blocks, issues };
}
