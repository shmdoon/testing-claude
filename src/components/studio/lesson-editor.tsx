"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { publishLesson, saveLessonDraft, type ActionState } from "@/lib/content/studio-actions";
import { blockRegistry, BlockPreview } from "@/content/blocks/registry";
import {
  BLOCK_TYPES,
  PHASES,
  allowedPhases,
  blockSchema,
  checkLessonForPublish,
  type BlockType,
  type Phase,
} from "@/content/blocks/schema";
import type { ToolInfo } from "@/content/blocks/previews";
import { move } from "./reorder";

type DraftBlock = { key: string; id: string; type: BlockType; phase: Phase; propsText: string };

const PHASE_LABEL: Record<Phase, string> = {
  activity: "1 · Activity",
  reflection: "2 · Reflection",
  module: "3 · Module",
  check: "4 · Quick check",
};
const PHASE_COLOR: Record<Phase, string> = {
  activity: "border-l-phase-activity",
  reflection: "border-l-phase-reflection",
  module: "border-l-phase-module",
  check: "border-l-phase-check",
};

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

function toDraft(raw: unknown): DraftBlock {
  const { id = "", type = "rich_text", phase = "module", ...props } = (raw ?? {}) as Record<string, unknown>;
  return {
    key: newKey(),
    id: String(id),
    type: type as BlockType,
    phase: phase as Phase,
    propsText: JSON.stringify(props, null, 2),
  };
}

function fromDraft(d: DraftBlock): { value?: unknown; jsonError?: string } {
  try {
    const props = JSON.parse(d.propsText) as unknown;
    if (typeof props !== "object" || props === null || Array.isArray(props)) return { jsonError: "Props must be a JSON object" };
    return { value: { ...props, id: d.id, type: d.type, phase: d.phase } };
  } catch (e) {
    return { jsonError: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

function uniqueId(base: string, taken: Set<string>) {
  let i = 1;
  while (taken.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

export function LessonEditor({
  lessonId,
  initialBlocks,
  tools,
  versions,
}: {
  lessonId: string;
  initialBlocks: unknown[];
  tools: ToolInfo[];
  versions: { id: string; version: number; published_at: string; blocks: unknown[] }[];
}) {
  const [blocks, setBlocks] = useState<DraftBlock[]>(() => initialBlocks.map(toDraft));
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [addType, setAddType] = useState<BlockType>("rich_text");
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const ctx = useMemo(() => ({ tools: Object.fromEntries(tools.map((t) => [t.id, t])) }), [tools]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Per-block validation, recomputed live.
  const evaluated = blocks.map((d) => {
    const { value, jsonError } = fromDraft(d);
    if (jsonError) return { d, value, errors: [jsonError] };
    const r = blockSchema.safeParse(value);
    return {
      d,
      value: r.success ? r.data : value,
      errors: r.success ? [] : r.error.issues.map((i) => `${i.path.join(".") || "block"}: ${i.message}`),
    };
  });
  const allValid = evaluated.every((e) => e.errors.length === 0);
  const lessonCheck = allValid ? checkLessonForPublish(evaluated.map((e) => e.value)) : null;

  function update(next: DraftBlock[]) {
    setBlocks(next);
    setDirty(true);
    setResult({});
  }

  function patch(key: string, p: Partial<DraftBlock>) {
    update(blocks.map((b) => (b.key === key ? { ...b, ...p } : b)));
  }

  function addBlock() {
    const def = blockRegistry[addType];
    const id = uniqueId(addType.split("_")[0]!, new Set(blocks.map((b) => b.id)));
    const draft = toDraft(def.template(id));
    // Insert after the last block of the same or an earlier phase to keep lesson order.
    const order = PHASES.indexOf(def.defaultPhase);
    let at = 0;
    blocks.forEach((b, i) => {
      if (PHASES.indexOf(b.phase) <= order) at = i + 1;
    });
    update([...blocks.slice(0, at), draft, ...blocks.slice(at)]);
  }

  function run(kind: "save" | "publish") {
    const values = evaluated.map((e) => e.value);
    startTransition(async () => {
      const res = kind === "save" ? await saveLessonDraft(lessonId, values) : await publishLesson(lessonId, values);
      setResult(res);
      if (res.ok) setDirty(false);
    });
  }

  function loadVersion(v: { version: number; blocks: unknown[] }) {
    if (dirty && !window.confirm(`Replace your unsaved changes with version ${v.version}?`)) return;
    update(v.blocks.map(toDraft));
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div role="tablist" aria-label="Editor view" className="flex rounded-lg bg-muted p-1">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md px-4 font-semibold",
                tab === t ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {t === "edit" ? <Pencil className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {t === "edit" ? "Edit blocks" : "Preview lesson"}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {dirty && <Badge variant="warning">Unsaved changes</Badge>}
        <Button type="button" variant="outline" disabled={pending || !allValid} onClick={() => run("save")}>
          Save draft
        </Button>
        <Button type="button" disabled={pending || !lessonCheck?.ok} onClick={() => run("publish")}>
          Publish
        </Button>
      </div>

      <Results result={result} lessonIssues={lessonCheck?.issues ?? []} allValid={allValid} />

      {tab === "preview" ? (
        <LessonPreview blocks={evaluated.filter((e) => e.errors.length === 0).map((e) => e.value)} ctx={ctx} />
      ) : (
        <>
          <ol className="space-y-4">
            {evaluated.map(({ d, errors }, i) => (
              <li key={d.key} className={cn("rounded-2xl border-2 border-l-8 bg-card p-4", PHASE_COLOR[d.phase], errors.length && "border-destructive/60")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{blockRegistry[d.type].label}</Badge>
                  <span className="flex-1" />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Move block ${d.id} up`} disabled={i === 0} onClick={() => update(move(blocks, i, i - 1))}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Move block ${d.id} down`}
                    disabled={i === blocks.length - 1}
                    onClick={() => update(move(blocks, i, i + 1))}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Duplicate block ${d.id}`}
                    onClick={() => {
                      const copy = { ...d, key: newKey(), id: uniqueId(`${d.id}-copy`, new Set(blocks.map((b) => b.id))) };
                      update([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]);
                    }}
                  >
                    <Copy aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Delete block ${d.id}`} onClick={() => update(blocks.filter((b) => b.key !== d.key))}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium">Block id</span>
                    <Input value={d.id} onChange={(e) => patch(d.key, { id: e.currentTarget.value })} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium">Phase</span>
                    <select
                      value={d.phase}
                      onChange={(e) => patch(d.key, { phase: e.currentTarget.value as Phase })}
                      className="h-12 w-full rounded-lg border-2 border-input bg-background px-3"
                    >
                      {allowedPhases(d.type).map((p) => (
                        <option key={p} value={p}>
                          {PHASE_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block space-y-1">
                  <span className="text-sm font-medium">Properties (JSON)</span>
                  <textarea
                    value={d.propsText}
                    onChange={(e) => patch(d.key, { propsText: e.currentTarget.value })}
                    spellCheck={false}
                    rows={Math.min(24, Math.max(4, d.propsText.split("\n").length + 1))}
                    aria-invalid={errors.length > 0}
                    className="w-full rounded-lg border-2 border-input bg-background p-3 font-mono text-sm outline-none focus-visible:border-ring aria-invalid:border-destructive"
                  />
                </label>
                {errors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm font-medium text-destructive" role="alert">
                    {errors.slice(0, 6).map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                )}
                {d.type === "external_task" && <ToolHelp tools={tools} />}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-end gap-3 rounded-2xl border-2 border-dashed p-4">
            <div className="flex-1 space-y-1">
              <label htmlFor="add-block-type" className="text-sm font-medium">
                Add a block
              </label>
              <select
                id="add-block-type"
                value={addType}
                onChange={(e) => setAddType(e.currentTarget.value as BlockType)}
                className="h-12 w-full rounded-lg border-2 border-input bg-background px-3"
              >
                {PHASES.map((p) => (
                  <optgroup key={p} label={PHASE_LABEL[p]}>
                    {BLOCK_TYPES.filter((t) => blockRegistry[t].defaultPhase === p).map((t) => (
                      <option key={t} value={t}>
                        {blockRegistry[t].label} — {blockRegistry[t].description}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <Button type="button" variant="secondary" onClick={addBlock}>
              <Plus aria-hidden /> Add block
            </Button>
          </div>
        </>
      )}

      {versions.length > 0 && (
        <section aria-labelledby="versions-h" className="space-y-2">
          <h2 id="versions-h" className="text-xl font-bold">
            Published versions
          </h2>
          <p className="text-sm text-muted-foreground">Versions are immutable. Students who started a lesson keep their version.</p>
          <ul className="divide-y rounded-2xl border bg-card">
            {versions.map((v, i) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="font-semibold">v{v.version}</span>
                {i === 0 && <Badge variant="success">live</Badge>}
                <span className="flex-1 text-sm text-muted-foreground">{new Date(v.published_at).toLocaleString("en-IN")}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => loadVersion(v)}>
                  Load into editor
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Results({ result, lessonIssues, allValid }: { result: ActionState; lessonIssues: { level: string; message: string }[]; allValid: boolean }) {
  const issues = result.issues?.length ? result.issues : lessonIssues;
  return (
    <div aria-live="polite" className="space-y-2">
      {result.error && <p className="rounded-lg bg-destructive/10 p-3 font-medium text-destructive">{result.error}</p>}
      {result.message && <p className="rounded-lg bg-success/10 p-3 font-medium text-success">{result.message}</p>}
      {!allValid && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">Some blocks have errors (shown in red).</p>}
      {issues.length > 0 && (
        <ul className="space-y-1 text-sm">
          {issues.map((i, j) => (
            <li key={j} className={i.level === "error" ? "font-medium text-destructive" : "text-warning-foreground dark:text-warning"}>
              {i.level === "error" ? "✗" : "⚠"} {i.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ToolHelp({ tools }: { tools: ToolInfo[] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="min-h-11 cursor-pointer content-center font-medium">Tool ids (copy into tool_id)</summary>
      <ul className="space-y-1">
        {tools.map((t) => (
          <li key={t.id} className="flex flex-wrap gap-2">
            <code className="rounded bg-muted px-1">{t.id}</code>
            <span>
              {t.name} · {t.min_age}+{t.enabled ? "" : " · disabled"}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Phase-grouped preview mirroring the lesson player's flow. */
export function LessonPreview({ blocks, ctx }: { blocks: unknown[]; ctx: { tools: Record<string, ToolInfo> } }) {
  return (
    <div className="space-y-6">
      {PHASES.map((p) => {
        const list = blocks.filter((b) => (b as { phase: Phase }).phase === p);
        if (list.length === 0) return null;
        return (
          <section key={p} className={cn("space-y-4 rounded-2xl border-2 border-l-8 bg-card p-4 sm:p-6", PHASE_COLOR[p])}>
            <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{PHASE_LABEL[p]}</h2>
            {list.map((b) => (
              <BlockPreview key={(b as { id: string }).id} block={b} ctx={ctx} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
