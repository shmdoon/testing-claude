/**
 * Read-only renderers used by the Studio preview and the public course page.
 * The interactive lesson-player renderers are added in Milestone 3 and are
 * registered alongside these in `registry.tsx`.
 */
import { CheckSquare, ExternalLink, GripVertical, ImageUp, Lightbulb, Info, TriangleAlert, Sparkles } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BlockOf, BlockType } from "./schema";
import { mediaUrl, videoEmbedUrl } from "./media";

export type ToolInfo = { id: string; name: string; base_url: string; min_age: number; enabled: boolean };
export type PreviewContext = { tools: Record<string, ToolInfo> };
export type PreviewProps<T extends BlockType> = { block: BlockOf<T>; ctx: PreviewContext };

const Prompt = ({ children }: { children: React.ReactNode }) => <p className="text-lg font-semibold">{children}</p>;
const Chip = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <li className={cn("flex min-h-11 items-center gap-2 rounded-xl border-2 bg-background px-3", className)}>{children}</li>
);

export function DragSortPreview({ block }: PreviewProps<"drag_sort">) {
  return (
    <div className="space-y-3">
      <Prompt>{block.prompt}</Prompt>
      <ol className="space-y-2">
        {block.items.map((i) => (
          <Chip key={i.id}>
            <GripVertical className="size-5 text-muted-foreground" aria-hidden />
            {i.text}
          </Chip>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">Shown in the correct order here; students see them shuffled.</p>
    </div>
  );
}

export function MatchPairsPreview({ block }: PreviewProps<"match_pairs">) {
  return (
    <div className="space-y-3">
      <Prompt>{block.prompt}</Prompt>
      <ul className="grid gap-2">
        {block.pairs.map((p) => (
          <Chip key={p.id} className="justify-between">
            <span>{p.left}</span>
            <span aria-hidden>↔</span>
            <span className="text-right">{p.right}</span>
          </Chip>
        ))}
      </ul>
    </div>
  );
}

export function FillBlankPreview({ block }: PreviewProps<"fill_blank">) {
  const parts = block.text.split(/(\{\{\d+\}\})/);
  return (
    <div className="space-y-3">
      {block.prompt && <Prompt>{block.prompt}</Prompt>}
      <p className="text-lg leading-loose">
        {parts.map((p, i) => {
          const m = p.match(/^\{\{(\d+)\}\}$/);
          if (!m) return <span key={i}>{p}</span>;
          return (
            <span key={i} className="mx-1 inline-block min-w-20 border-b-2 border-primary px-2 text-center font-semibold text-primary">
              {block.blanks[Number(m[1])]?.answers[0]}
            </span>
          );
        })}
      </p>
      {block.word_bank && (
        <div className="flex flex-wrap gap-2">
          {block.word_bank.map((w) => (
            <Badge key={w} variant="outline">
              {w}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function PredictThenRevealPreview({ block }: PreviewProps<"predict_then_reveal">) {
  return (
    <div className="space-y-3">
      <Prompt>{block.prompt}</Prompt>
      {block.options ? (
        <ul className="grid gap-2">
          {block.options.map((o) => (
            <Chip key={o.id}>{o.text}</Chip>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border-2 border-dashed p-3 text-muted-foreground">Student types a prediction…</p>
      )}
      <div className="rounded-xl bg-muted p-4">
        <p className="mb-1 text-sm font-semibold text-muted-foreground">Revealed after predicting</p>
        <Markdown>{block.reveal}</Markdown>
      </div>
    </div>
  );
}

export function MultipleChoiceExplorePreview({ block }: PreviewProps<"multiple_choice_explore">) {
  return (
    <div className="space-y-3">
      <Prompt>{block.prompt}</Prompt>
      <ul className="grid gap-2">
        {block.options.map((o) => (
          <li key={o.id} className="rounded-xl border-2 p-3">
            <p className="font-medium">
              {o.text} {o.id === block.correct_option_id && <Badge variant="success">target</Badge>}
            </p>
            <p className="text-sm text-muted-foreground">{o.feedback}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmbedSimPreview({ block }: PreviewProps<"embed_sim">) {
  return (
    <div className="space-y-3">
      <Prompt>{block.title}</Prompt>
      {block.instructions && <Markdown>{block.instructions}</Markdown>}
      <iframe
        src={block.url}
        title={block.title}
        height={block.height}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        className="w-full rounded-xl border-2"
      />
    </div>
  );
}

export function UploadWorkPreview({ block }: PreviewProps<"upload_work">) {
  return (
    <div className="space-y-3">
      <Prompt>{block.prompt}</Prompt>
      <div className="flex items-center gap-3 rounded-xl border-2 border-dashed p-4 text-muted-foreground">
        <ImageUp aria-hidden /> Upload {block.accept.join(" or ")} · up to {block.max_files} file{block.max_files > 1 ? "s" : ""}
      </div>
    </div>
  );
}

export function ChecklistTaskPreview({ block }: PreviewProps<"checklist_task">) {
  return (
    <div className="space-y-3">
      <Prompt>{block.prompt}</Prompt>
      <ul className="space-y-2">
        {block.steps.map((s) => (
          <Chip key={s.id}>
            <CheckSquare className="size-5 text-muted-foreground" aria-hidden />
            {s.text}
          </Chip>
        ))}
      </ul>
    </div>
  );
}

export function ExternalTaskPreview({ block, ctx }: PreviewProps<"external_task">) {
  const tool = ctx.tools[block.tool_id];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">External task · ~{block.estimated_minutes} min</Badge>
        {tool ? (
          <Badge variant={tool.enabled ? "outline" : "warning"}>
            {tool.name} · {tool.min_age}+{tool.enabled ? "" : " · disabled"}
          </Badge>
        ) : (
          <Badge variant="warning">Unknown tool</Badge>
        )}
      </div>
      <Prompt>{block.goal}</Prompt>
      <ol className="list-decimal space-y-2 pl-6">
        {block.steps.map((s) => (
          <li key={s.id}>
            {s.text}
            {s.screenshot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(s.screenshot.src)} alt={s.screenshot.alt} className="mt-2 max-h-48 rounded-lg border" loading="lazy" />
            )}
          </li>
        ))}
      </ol>
      {block.starter_prompts.map((p) => (
        <div key={p.id} className="rounded-xl bg-muted p-3">
          <p className="text-sm font-semibold">{p.label}</p>
          <p className="font-mono text-sm whitespace-pre-wrap">{p.text}</p>
        </div>
      ))}
      <p className="flex items-center gap-2 font-semibold text-primary">
        <ExternalLink className="size-5" aria-hidden /> Launch tool (opens in a new tab)
      </p>
      <p className="text-sm text-muted-foreground">Submit: {block.submission_types.join(", ")}</p>
      {block.fallback && (
        <div className="rounded-xl border-2 border-dashed p-3">
          <p className="text-sm font-semibold">Fallback ({block.fallback.kind.replace("_", " ")}) — shown if the tool is disabled or the student is under {tool?.min_age ?? "?"}</p>
          {"instructions" in block.fallback && block.fallback.instructions && <Markdown>{block.fallback.instructions}</Markdown>}
        </div>
      )}
    </div>
  );
}

export function ReflectionPromptPreview({ block }: PreviewProps<"reflection_prompt">) {
  return (
    <div className="space-y-3">
      <Prompt>{block.prompt}</Prompt>
      <div className="min-h-24 rounded-xl border-2 p-3 text-muted-foreground">{block.placeholder ?? "Type your answer…"}</div>
    </div>
  );
}

export function RichTextPreview({ block }: PreviewProps<"rich_text">) {
  return <Markdown>{block.markdown}</Markdown>;
}

export function VideoPreview({ block }: PreviewProps<"video">) {
  return (
    <figure className="space-y-2">
      <div className="aspect-video overflow-hidden rounded-xl border-2 bg-black">
        <iframe
          src={videoEmbedUrl(block.provider, block.url)}
          title={block.title}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          className="size-full"
        />
      </div>
      <figcaption className="text-sm text-muted-foreground">
        {block.title}
        {!block.captions_url && <Badge variant="warning" className="ml-2">no captions file</Badge>}
      </figcaption>
    </figure>
  );
}

export function ImagePreview({ block }: PreviewProps<"image">) {
  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaUrl(block.src)} alt={block.alt} loading="lazy" className="w-full rounded-xl border" />
      {block.caption && <figcaption className="text-sm text-muted-foreground">{block.caption}</figcaption>}
    </figure>
  );
}

const calloutStyle = {
  info: { icon: Info, cls: "border-primary/40 bg-primary/10" },
  tip: { icon: Lightbulb, cls: "border-teal/50 bg-teal/10" },
  warning: { icon: TriangleAlert, cls: "border-warning/60 bg-warning/15" },
  fun_fact: { icon: Sparkles, cls: "border-accent/60 bg-accent/15" },
} as const;

export function CalloutPreview({ block }: PreviewProps<"callout">) {
  const { icon: Icon, cls } = calloutStyle[block.variant];
  return (
    <aside className={cn("flex gap-3 rounded-2xl border-2 p-4", cls)}>
      <Icon className="mt-1 size-6 shrink-0" aria-hidden />
      <div>
        {block.title && <p className="font-bold">{block.title}</p>}
        <Markdown>{block.markdown}</Markdown>
      </div>
    </aside>
  );
}

export function KeyPointsPreview({ block }: PreviewProps<"key_points">) {
  return (
    <section className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
      <h3 className="mb-2 text-lg font-bold">{block.title}</h3>
      <ul className="list-disc space-y-1 pl-6">
        {block.points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </section>
  );
}

export function QuizPreview({ block }: PreviewProps<"quiz">) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-bold">
        {block.title} <Badge variant="outline">pass {block.passing_score}%</Badge>
      </h3>
      <ol className="list-decimal space-y-3 pl-6">
        {block.questions.map((q) => (
          <li key={q.id}>
            <p className="font-medium">{q.kind === "true_false" ? `True or false: ${q.statement}` : q.prompt}</p>
            <p className="text-sm text-muted-foreground">
              Answer:{" "}
              {q.kind === "mcq"
                ? q.options.find((o) => o.id === q.correct_option_id)?.text
                : q.kind === "true_false"
                  ? String(q.answer)
                  : q.accepted_answers.join(" / ")}{" "}
              — {q.explanation}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
