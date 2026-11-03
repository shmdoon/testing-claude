/**
 * Block registry: everything the platform needs to know about each block type.
 * The lesson player (M3) and Studio look blocks up here — adding a type never
 * touches the player itself.
 */
import type { ComponentType } from "react";
import * as P from "./previews";
import { allowedPhases, blockSchema, type Block, type BlockOf, type BlockType, type Phase } from "./schema";

export type BlockDefinition<T extends BlockType> = {
  label: string;
  description: string;
  /** Default phase when added in the editor. */
  defaultPhase: Phase;
  /** A valid starter block (editor "Add block"). */
  template: (id: string) => BlockOf<T>;
  Preview: ComponentType<P.PreviewProps<T>>;
};

type Registry = { [T in BlockType]: BlockDefinition<T> };

const EXAMPLE_TOOL = "00000000-0000-4000-8000-000000009003";

export const blockRegistry: Registry = {
  drag_sort: {
    label: "Drag to sort",
    description: "Put items in the right order.",
    defaultPhase: "activity",
    template: (id) => ({
      id,
      type: "drag_sort",
      phase: "activity",
      prompt: "Put these in order.",
      items: [
        { id: "a", text: "First" },
        { id: "b", text: "Second" },
      ],
    }),
    Preview: P.DragSortPreview,
  },
  match_pairs: {
    label: "Match pairs",
    description: "Connect each item to its partner.",
    defaultPhase: "activity",
    template: (id) => ({
      id,
      type: "match_pairs",
      phase: "activity",
      prompt: "Match each pair.",
      pairs: [
        { id: "a", left: "Left 1", right: "Right 1" },
        { id: "b", left: "Left 2", right: "Right 2" },
      ],
    }),
    Preview: P.MatchPairsPreview,
  },
  fill_blank: {
    label: "Fill in the blanks",
    description: "Complete a sentence. Gaps are {{0}}, {{1}}, …",
    defaultPhase: "activity",
    template: (id) => ({
      id,
      type: "fill_blank",
      phase: "activity",
      text: "AI learns from {{0}}.",
      blanks: [{ answers: ["examples", "data"] }],
      case_sensitive: false,
    }),
    Preview: P.FillBlankPreview,
  },
  predict_then_reveal: {
    label: "Predict, then reveal",
    description: "Students commit to a guess before seeing the answer.",
    defaultPhase: "activity",
    template: (id) => ({
      id,
      type: "predict_then_reveal",
      phase: "activity",
      prompt: "What do you think will happen?",
      reveal: "Here's what happened…",
    }),
    Preview: P.PredictThenRevealPreview,
  },
  multiple_choice_explore: {
    label: "Explore choices",
    description: "Tap options to see feedback for each.",
    defaultPhase: "activity",
    template: (id) => ({
      id,
      type: "multiple_choice_explore",
      phase: "activity",
      prompt: "Which one…?",
      options: [
        { id: "a", text: "Option A", feedback: "Because…" },
        { id: "b", text: "Option B", feedback: "Because…" },
      ],
    }),
    Preview: P.MultipleChoiceExplorePreview,
  },
  embed_sim: {
    label: "Simulation",
    description: "An approved simulation in a sandboxed frame.",
    defaultPhase: "activity",
    template: (id) => ({
      id,
      type: "embed_sim",
      phase: "activity",
      title: "Simulation",
      url: "https://phet.colorado.edu/",
      height: 480,
    }),
    Preview: P.EmbedSimPreview,
  },
  upload_work: {
    label: "Upload work",
    description: "Photo or PDF of offline work.",
    defaultPhase: "activity",
    template: (id) => ({ id, type: "upload_work", phase: "activity", prompt: "Upload a photo of your work.", accept: ["image"], max_files: 1 }),
    Preview: P.UploadWorkPreview,
  },
  checklist_task: {
    label: "Checklist task",
    description: "Offline steps the student ticks off.",
    defaultPhase: "activity",
    template: (id) => ({ id, type: "checklist_task", phase: "activity", prompt: "Do these steps.", steps: [{ id: "s1", text: "Step one" }] }),
    Preview: P.ChecklistTaskPreview,
  },
  external_task: {
    label: "External tool task",
    description: "Work on another site (opens in a new tab), then submit.",
    defaultPhase: "activity",
    template: (id) => ({
      id,
      type: "external_task",
      phase: "activity",
      tool_id: EXAMPLE_TOOL,
      goal: "What should the student make?",
      steps: [{ id: "s1", text: "Click Launch tool." }],
      starter_prompts: [],
      estimated_minutes: 15,
      submission_types: ["url"],
    }),
    Preview: P.ExternalTaskPreview,
  },
  reflection_prompt: {
    label: "Reflection prompt",
    description: "\"What did you notice?\" — short text answer.",
    defaultPhase: "reflection",
    template: (id) => ({ id, type: "reflection_prompt", phase: "reflection", prompt: "What did you notice?", min_chars: 20 }),
    Preview: P.ReflectionPromptPreview,
  },
  rich_text: {
    label: "Text (Markdown)",
    description: "Explanation text.",
    defaultPhase: "module",
    template: (id) => ({ id, type: "rich_text", phase: "module", markdown: "## Heading\n\nExplain the idea here." }),
    Preview: P.RichTextPreview,
  },
  video: {
    label: "Video",
    description: "YouTube (unlisted), Bunny or Cloudflare Stream.",
    defaultPhase: "module",
    template: (id) => ({ id, type: "video", phase: "module", title: "Video", provider: "youtube", url: "https://www.youtube.com/watch?v=VIDEO_ID" }),
    Preview: P.VideoPreview,
  },
  image: {
    label: "Image",
    description: "Picture with required alt text.",
    defaultPhase: "module",
    template: (id) => ({ id, type: "image", phase: "module", src: "/seed/rules-vs-learning.svg", alt: "Describe the image" }),
    Preview: P.ImagePreview,
  },
  callout: {
    label: "Callout",
    description: "Tip, info, warning or fun fact.",
    defaultPhase: "module",
    template: (id) => ({ id, type: "callout", phase: "module", variant: "tip", markdown: "A helpful tip." }),
    Preview: P.CalloutPreview,
  },
  key_points: {
    label: "Key points",
    description: "Short summary list.",
    defaultPhase: "module",
    template: (id) => ({ id, type: "key_points", phase: "module", title: "Key points", points: ["Point one"] }),
    Preview: P.KeyPointsPreview,
  },
  quiz: {
    label: "Quiz",
    description: "MCQ, true/false and short answer with explanations.",
    defaultPhase: "check",
    template: (id) => ({
      id,
      type: "quiz",
      phase: "check",
      title: "Quick check",
      passing_score: 60,
      questions: [{ kind: "true_false", id: "q1", statement: "Statement", answer: true, explanation: "Why" }],
    }),
    Preview: P.QuizPreview,
  },
};

export function getBlockDefinition<T extends BlockType>(type: T): BlockDefinition<T> {
  return blockRegistry[type];
}

/** Renders a block's preview; unknown/invalid blocks render a visible notice instead of crashing. */
export function BlockPreview({ block, ctx }: { block: unknown; ctx: P.PreviewContext }) {
  const parsed = blockSchema.safeParse(block);
  if (!parsed.success) {
    return (
      <p role="alert" className="rounded-xl border-2 border-destructive/50 p-3 text-sm text-destructive">
        This block is invalid and is hidden from students.
      </p>
    );
  }
  const b: Block = parsed.data;
  const Preview = blockRegistry[b.type].Preview as ComponentType<{ block: Block; ctx: P.PreviewContext }>;
  return <Preview block={b} ctx={ctx} />;
}

export { allowedPhases };
