"use client";

/**
 * Player registry: one renderer per block type. The lesson player looks
 * blocks up here, so adding a block type never touches the player.
 * Display-only blocks reuse their Studio preview renderer.
 */
import type { ComponentType } from "react";
import * as Preview from "@/content/blocks/previews";
import type { StudentBlock } from "@/content/blocks/grading";
import type { BlockType } from "@/content/blocks/schema";
import {
  ChecklistTaskPlayer,
  DragSortPlayer,
  EmbedSimPlayer,
  FillBlankPlayer,
  MatchPairsPlayer,
  MultipleChoiceExplorePlayer,
  PredictThenRevealPlayer,
  ReflectionPromptPlayer,
} from "./activity-players";
import { ExternalTaskPlayer } from "./external-task-player";
import { QuizPlayer } from "./quiz-player";
import { UploadWorkPlayer } from "./upload-player";
import { BlockErrorBoundary } from "./block-boundary";
import { TrackedVideo } from "./tracked-video";

type StudentBlockOf<T extends BlockType> = Extract<StudentBlock, { type: T }>;
type PlayerRegistry = { [T in BlockType]: ComponentType<{ block: StudentBlockOf<T> }> };

const NO_TOOLS: Preview.PreviewContext = { tools: {} };
const display =
  <T extends "rich_text" | "image" | "callout" | "key_points">(C: ComponentType<Preview.PreviewProps<T>>) =>
  // eslint-disable-next-line react/display-name
  ({ block }: { block: StudentBlockOf<T> }) => <C block={block as never} ctx={NO_TOOLS} />;

export const playerRegistry: PlayerRegistry = {
  drag_sort: DragSortPlayer,
  match_pairs: MatchPairsPlayer,
  fill_blank: FillBlankPlayer,
  predict_then_reveal: PredictThenRevealPlayer,
  multiple_choice_explore: MultipleChoiceExplorePlayer,
  embed_sim: EmbedSimPlayer,
  upload_work: UploadWorkPlayer,
  checklist_task: ChecklistTaskPlayer,
  external_task: ExternalTaskPlayer,
  reflection_prompt: ReflectionPromptPlayer,
  rich_text: display(Preview.RichTextPreview),
  video: ({ block }) => (
    <TrackedVideo provider={block.provider} url={block.url} title={block.title} captionsUrl={block.captions_url} transcript={block.transcript} />
  ),
  image: display(Preview.ImagePreview),
  callout: display(Preview.CalloutPreview),
  key_points: display(Preview.KeyPointsPreview),
  quiz: QuizPlayer,
};

export function BlockPlayer({ block }: { block: StudentBlock }) {
  const C = playerRegistry[block.type] as ComponentType<{ block: StudentBlock }>;
  return (
    <BlockErrorBoundary blockId={block.id}>
      <C block={block} />
    </BlockErrorBoundary>
  );
}

/** Blocks a student must interact with (vs. read/watch). */
export const INTERACTIVE_TYPES: ReadonlySet<BlockType> = new Set([
  "drag_sort",
  "match_pairs",
  "fill_blank",
  "predict_then_reveal",
  "multiple_choice_explore",
  "embed_sim",
  "upload_work",
  "checklist_task",
  "external_task",
  "reflection_prompt",
  "quiz",
]);
