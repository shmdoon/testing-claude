"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { move } from "@/components/studio/reorder";
import type { BlockOf } from "@/content/blocks/schema";
import { ErrorText, Feedback, Prompt } from "./ui";
import { useSubmit } from "./use-submit";
import { t } from "@/i18n";

type P<T extends "drag_sort" | "match_pairs" | "fill_blank" | "predict_then_reveal" | "multiple_choice_explore" | "embed_sim" | "checklist_task" | "reflection_prompt"> = {
  block: BlockOf<T>;
};

// ---------------------------------------------------------------------------
export function DragSortPlayer({ block }: P<"drag_sort">) {
  const { saved, result, error, pending, submit } = useSubmit(block.id);
  const savedOrder = (saved?.response as { order?: string[] } | undefined)?.order;
  const [order, setOrder] = useState(() =>
    savedOrder?.length === block.items.length ? savedOrder.map((id) => block.items.find((i) => i.id === id)!).filter(Boolean) : block.items,
  );
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const shift = (from: number, to: number) => {
    setOrder((o) => move(o, from, to));
    setAnnounce(`${order[from]?.text} moved to position ${to + 1} of ${order.length}`);
  };
  return (
    <div className="space-y-4">
      <Prompt>{block.prompt}</Prompt>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <ol className="space-y-2" aria-label={t("player.sortList")}>
        {order.map((item, i) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom !== null) shift(dragFrom, i);
              setDragFrom(null);
            }}
            className="flex min-h-14 items-center gap-2 rounded-xl border-2 bg-background p-2 pl-3"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary font-bold text-secondary-foreground">{i + 1}</span>
            <GripVertical className="size-5 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
            <span className="flex-1 font-medium">{item.text}</span>
            <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => shift(i, i - 1)} aria-label={t("player.moveUp", { item: item.text })}>
              <ArrowUp aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={i === order.length - 1}
              onClick={() => shift(i, i + 1)}
              aria-label={t("player.moveDown", { item: item.text })}
            >
              <ArrowDown aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      <Button type="button" onClick={() => submit({ order: order.map((i) => i.id) })} disabled={pending}>
        <Check aria-hidden /> {t("player.checkOrder")}
      </Button>
      <ErrorText>{error}</ErrorText>
      {result && (
        <Feedback tone={result.score === 100 ? "good" : "try"}>
          <p className="font-semibold">{result.score === 100 ? t("player.allCorrect") : t("player.scoreCorrect", { score: result.score ?? 0 })}</p>
          {result.feedback && <p>{result.feedback}</p>}
        </Feedback>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function MatchPairsPlayer({ block }: P<"match_pairs">) {
  const { saved, result, error, pending, submit } = useSubmit(block.id);
  const [matches, setMatches] = useState<Record<string, string>>(
    () => (saved?.response as { matches?: Record<string, string> } | undefined)?.matches ?? {},
  );
  // Right-hand options in a stable, non-revealing order (alphabetical).
  const rights = [...block.pairs].sort((a, b) => a.right.localeCompare(b.right));
  const checked = Boolean(result);
  return (
    <div className="space-y-4">
      <Prompt>{block.prompt}</Prompt>
      <ul className="space-y-3">
        {block.pairs.map((p) => {
          const chosen = matches[p.id] ?? "";
          const right = checked && chosen === p.id;
          return (
            <li key={p.id} className="grid gap-2 rounded-xl border-2 bg-background p-3 sm:grid-cols-2 sm:items-center">
              <label htmlFor={`${block.id}-${p.id}`} className="font-medium">
                {p.left}
              </label>
              <div className="flex items-center gap-2">
                <select
                  id={`${block.id}-${p.id}`}
                  value={chosen}
                  onChange={(e) => {
                    const value = e.currentTarget.value; // read before the deferred updater runs
                    setMatches((m) => ({ ...m, [p.id]: value }));
                  }}
                  className={cn(
                    "h-12 w-full rounded-lg border-2 border-input bg-background px-3",
                    checked && chosen && (right ? "border-success" : "border-warning"),
                  )}
                >
                  <option value="">{t("player.choose")}</option>
                  {rights.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.right}
                    </option>
                  ))}
                </select>
                {checked && chosen && <span role="img" aria-label={right ? t("player.correct") : t("player.notYet")}>{right ? "✅" : "🔁"}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <Button type="button" onClick={() => submit({ matches })} disabled={pending || Object.keys(matches).length === 0}>
        <Check aria-hidden /> {t("player.checkMatches")}
      </Button>
      <ErrorText>{error}</ErrorText>
      {result && (
        <Feedback tone={result.score === 100 ? "good" : "try"}>
          {result.score === 100 ? t("player.allCorrect") : t("player.scoreCorrect", { score: result.score ?? 0 })}
        </Feedback>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function FillBlankPlayer({ block }: P<"fill_blank">) {
  const { saved, result, error, pending, submit } = useSubmit(block.id);
  const [answers, setAnswers] = useState<string[]>(
    () => (saved?.response as { answers?: string[] } | undefined)?.answers ?? block.blanks.map(() => ""),
  );
  const parts = block.text.split(/(\{\{\d+\}\})/);
  const listId = `${block.id}-bank`;
  return (
    <div className="space-y-4">
      {block.prompt && <Prompt>{block.prompt}</Prompt>}
      {block.word_bank && (
        <div role="group" className="flex flex-wrap gap-2" aria-label={t("player.wordBank")}>
          {block.word_bank.map((w) => (
            <span key={w} className="rounded-full border-2 px-3 py-1 font-medium">
              {w}
            </span>
          ))}
          <datalist id={listId}>
            {block.word_bank.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </div>
      )}
      <p className="text-lg leading-[3.25rem]">
        {parts.map((part, i) => {
          const m = part.match(/^\{\{(\d+)\}\}$/);
          if (!m) return <span key={i}>{part}</span>;
          const n = Number(m[1]);
          return (
            <Input
              key={i}
              aria-label={t("player.blank", { n: n + 1 })}
              list={block.word_bank ? listId : undefined}
              value={answers[n] ?? ""}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setAnswers((a) => a.map((x, j) => (j === n ? v : x)));
              }}
              placeholder={block.blanks[n]?.hint ?? "…"}
              autoCapitalize="off"
              className="mx-1 inline-flex h-11 w-36 align-middle"
            />
          );
        })}
      </p>
      <Button type="button" onClick={() => submit({ answers })} disabled={pending || answers.every((a) => !a.trim())}>
        <Check aria-hidden /> {t("player.checkAnswers")}
      </Button>
      <ErrorText>{error}</ErrorText>
      {result && (
        <Feedback tone={result.score === 100 ? "good" : "try"}>
          {result.score === 100 ? t("player.allCorrect") : t("player.scoreCorrect", { score: result.score ?? 0 })}
        </Feedback>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function PredictThenRevealPlayer({ block }: P<"predict_then_reveal">) {
  const { saved, error, pending, submit } = useSubmit(block.id);
  const [prediction, setPrediction] = useState(() => (saved?.response as { prediction?: string } | undefined)?.prediction ?? "");
  const [locked, setLocked] = useState(Boolean(saved));
  return (
    <div className="space-y-4">
      <Prompt>{block.prompt}</Prompt>
      {block.options ? (
        <fieldset className="grid gap-2" disabled={locked}>
          <legend className="sr-only">{block.prompt}</legend>
          {block.options.map((o) => (
            <label
              key={o.id}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 bg-background px-3 has-checked:border-primary has-checked:bg-secondary has-disabled:cursor-default"
            >
              <input type="radio" name={block.id} value={o.id} checked={prediction === o.id} onChange={() => setPrediction(o.id)} className="size-5" />
              {o.text}
            </label>
          ))}
        </fieldset>
      ) : (
        <textarea
          aria-label={t("player.yourPrediction")}
          value={prediction}
          disabled={locked}
          onChange={(e) => setPrediction(e.currentTarget.value)}
          rows={3}
          className="w-full rounded-xl border-2 border-input bg-background p-3"
        />
      )}
      {!locked && (
        <Button type="button" disabled={pending || !prediction.trim()} onClick={() => submit({ prediction }, (r) => r.ok && setLocked(true))}>
          <Lock aria-hidden /> {t("player.lockPrediction")}
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
      {locked && (
        <div className="space-y-3 rounded-xl bg-muted p-4" role="status">
          <p className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{t("player.reveal")}</p>
          <Markdown>{block.reveal}</Markdown>
          {block.reveal_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.reveal_image.src} alt={block.reveal_image.alt} className="rounded-lg" loading="lazy" />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function MultipleChoiceExplorePlayer({ block }: P<"multiple_choice_explore">) {
  const { saved, error, submit } = useSubmit(block.id);
  const [explored, setExplored] = useState<string[]>(() => (saved?.response as { explored?: string[] } | undefined)?.explored ?? []);
  const [current, setCurrent] = useState<string | null>(null);
  const choose = (id: string) => {
    setCurrent(id);
    const next = explored.includes(id) ? explored : [...explored, id];
    setExplored(next);
    submit({ explored: next });
  };
  const opt = block.options.find((o) => o.id === current);
  return (
    <div className="space-y-4">
      <Prompt>{block.prompt}</Prompt>
      <div className="grid gap-2 sm:grid-cols-2">
        {block.options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => choose(o.id)}
            aria-pressed={current === o.id}
            className={cn(
              "min-h-14 rounded-xl border-2 bg-background p-3 text-left font-medium transition hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              current === o.id && "border-primary bg-secondary",
              explored.includes(o.id) && current !== o.id && "border-dashed",
            )}
          >
            {o.text}
            {explored.includes(o.id) && <span className="sr-only"> ({t("player.explored")})</span>}
          </button>
        ))}
      </div>
      <ErrorText>{error}</ErrorText>
      {opt && <Feedback tone={block.correct_option_id ? (opt.id === block.correct_option_id ? "good" : "try") : "info"}>{opt.feedback}</Feedback>}
      <p className="text-sm text-muted-foreground">{t("player.exploredCount", { n: explored.length, total: block.options.length })}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function EmbedSimPlayer({ block }: P<"embed_sim">) {
  const { saved, error, pending, submit } = useSubmit(block.id);
  return (
    <div className="space-y-4">
      <Prompt>{block.title}</Prompt>
      {block.instructions && <Markdown>{block.instructions}</Markdown>}
      <iframe
        src={block.url}
        title={block.title}
        style={{ height: block.height }}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        className="w-full rounded-xl border-2 bg-white"
      />
      {saved ? (
        <Feedback tone="good">{t("player.simDone")}</Feedback>
      ) : (
        <Button type="button" onClick={() => submit({ done: true })} disabled={pending}>
          <Check aria-hidden /> {t("player.triedIt")}
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ChecklistTaskPlayer({ block }: P<"checklist_task">) {
  const { saved, error, submit } = useSubmit(block.id);
  const [checked, setChecked] = useState<string[]>(() => (saved?.response as { checked?: string[] } | undefined)?.checked ?? []);
  const toggle = (id: string) => {
    const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id];
    setChecked(next);
    submit({ checked: next });
  };
  const all = checked.length === block.steps.length;
  return (
    <div className="space-y-4">
      <Prompt>{block.prompt}</Prompt>
      <ul className="space-y-2">
        {block.steps.map((s, i) => (
          <li key={s.id}>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 bg-background px-3 has-checked:border-success has-checked:bg-success/10">
              <input type="checkbox" checked={checked.includes(s.id)} onChange={() => toggle(s.id)} className="size-6 shrink-0" />
              <span>
                <span className="font-semibold">{i + 1}. </span>
                {s.text}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <ErrorText>{error}</ErrorText>
      {all && <Feedback tone="good">{t("player.checklistDone")}</Feedback>}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ReflectionPromptPlayer({ block }: P<"reflection_prompt">) {
  const { saved, error, pending, submit } = useSubmit(block.id);
  const [text, setText] = useState(() => (saved?.response as { text?: string } | undefined)?.text ?? "");
  const [savedText, setSavedText] = useState(saved?.completed ? text : null);
  const enough = text.trim().length >= block.min_chars;
  const id = `${block.id}-text`;
  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-lg font-semibold sm:text-xl">
        {block.prompt}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        placeholder={block.placeholder}
        rows={4}
        maxLength={2000}
        aria-describedby={`${id}-count`}
        className="w-full rounded-xl border-2 border-input bg-background p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending || !enough || text === savedText} onClick={() => submit({ text }, (r) => r.ok && setSavedText(text))}>
          {savedText !== null && text !== savedText ? t("player.saveChanges") : t("player.saveAnswer")}
        </Button>
        <span id={`${id}-count`} className="text-sm text-muted-foreground">
          {enough ? t("player.charsOk") : t("player.charsNeeded", { n: block.min_chars - text.trim().length })}
        </span>
        {savedText !== null && text === savedText && <span className="text-sm font-medium text-success">✓ {t("player.saved")}</span>}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function RetryHint({ onRetry }: { onRetry: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onRetry}>
      <RotateCcw aria-hidden /> {t("player.tryAgain")}
    </Button>
  );
}
