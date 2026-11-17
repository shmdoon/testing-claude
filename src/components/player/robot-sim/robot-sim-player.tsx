"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Brain, Eraser, Flag, Play, RotateCcw, Square, Tag, Eye, Gamepad2, ChevronRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { Confetti } from "@/components/confetti";
import type { BlockOf } from "@/content/blocks/schema";
import { ACTIONS, type Action } from "@/lib/sim/physics";
import type { Example } from "@/lib/sim/learner";
import { play } from "@/lib/sound/sound";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { ErrorText, Feedback, Prompt } from "../ui";
import { usePlayer } from "../context";
import { useSubmit } from "../use-submit";
import { SimRunner, type SimPhase, type Snapshot } from "./runner";
import { Minimap } from "./minimap";
import { DPad, useKeyboardDrive } from "./controls";

const Scene = dynamic(() => import("./scene"), { ssr: false, loading: () => <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden /> });

const PHASE_ICON = { teach: Gamepad2, label: Tag, train: Brain, test: Flag } as const;

function phasesFor(mode: BlockOf<"robot_sim">["mode"]): SimPhase[] {
  return mode === "demonstrate" ? ["teach", "train", "test"] : mode === "label" ? ["label", "train", "test"] : ["teach", "label", "train", "test"];
}

const storageKey = (lessonId: string, blockId: string) => `sim:${lessonId}:${blockId}`;

export function RobotSimPlayer({ block }: { block: BlockOf<"robot_sim"> }) {
  const { lessonId } = usePlayer();
  const { saved, result, error, submit, pending } = useSubmit(block.id, block);
  const runner = useMemo(() => new SimRunner(block), [block]);
  const snap = useSyncExternalStore(runner.subscribe, runner.getSnapshot, runner.getSnapshot);
  const phases = useMemo(() => phasesFor(block.mode), [block.mode]);
  const [topView, setTopView] = useState(false);
  const [webgl, setWebgl] = useState(true);
  // The 3D scene (Three.js) loads only after the first tap: keeps the page light and focuses the viewport for keys.
  const [started, setStarted] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [burst, setBurst] = useState(0);
  const [announce, setAnnounce] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const recordCount = useRef(0);

  useEffect(() => runner.reseed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0), [runner]);

  // Examples survive a reload (per lesson + block), so a student can pick up where they left off.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(lessonId, block.id));
      if (raw) {
        const ex = JSON.parse(raw) as Example[];
        if (Array.isArray(ex) && ex.every((e) => Array.isArray(e.x) && ACTIONS.includes(e.y))) runner.loadExamples(ex);
      }
    } catch {
      /* ignore */
    }
  }, [runner, lessonId, block.id]);
  const persist = useCallback(() => {
    try {
      localStorage.setItem(storageKey(lessonId, block.id), JSON.stringify(runner.getExamples()));
    } catch {
      /* quota / private mode */
    }
  }, [runner, lessonId, block.id]);

  // Sounds + submission on events.
  useEffect(() => {
    runner.setOnEvent((e) => {
      if (e === "record") {
        if (++recordCount.current % 5 === 0) play("record");
      } else if (e === "labelled") {
        play("tick");
        persist();
      } else if (e === "bump") play("bump");
      else if (e === "trained") play("train");
      else if (e === "goal" || e === "fail") {
        const o = runner.getOutcome();
        const s = runner.getSnapshot();
        if (!o) return;
        setAnnounce(o.success ? t("sim.reachedFlag", { s: o.seconds, bumps: o.bumps }) : t(`sim.fail_${o.reason}` as never));
        submit(
          { examples: s.examples, accuracy: s.report?.accuracy ?? null, runs: s.runs, success: o.success, seconds: o.success ? o.seconds : null, bumps: o.bumps },
          (r) => {
            if (r.ok && r.result.completed) {
              play("levelup");
              setBurst((b) => b + 1);
            } else if (o.success) play("success");
            else play("error");
          },
        );
      }
    });
    return () => runner.setOnEvent(null);
  }, [runner, submit, persist]);

  // The clock.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      try {
        runner.tick((now - last) / 1000);
      } catch (e) {
        console.error("sim tick failed", e);
      }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [runner]);

  useEffect(() => {
    if (snap.phase === "teach" && snap.examples > 0 && snap.examples % 10 === 0) persist();
  }, [snap.phase, snap.examples, persist]);

  const setInput = useCallback((a: Action | null) => runner.setInput(a), [runner]);
  useKeyboardDrive(snap.phase === "teach" && focused, setInput);

  const onUnavailable = useCallback(() => setWebgl(false), []);
  const canTrain = snap.examples >= block.min_examples;
  const idx = phases.indexOf(snap.phase);

  return (
    <div
      ref={root}
      className="space-y-4"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      data-testid="robot-sim"
    >
      <Confetti burst={burst} />
      <Prompt>{block.title}</Prompt>
      <Markdown>{block.goal}</Markdown>

      <ol className="flex flex-wrap gap-2" aria-label={t("sim.steps")}>
        {phases.map((p, i) => {
          const Icon = PHASE_ICON[p];
          const reachable = p !== "test" || snap.hasModel || i <= idx;
          return (
            <li key={p} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runner.setPhase(p)}
                disabled={!reachable}
                aria-current={snap.phase === p ? "step" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold transition",
                  snap.phase === p ? "border-primary bg-secondary text-secondary-foreground" : "bg-background hover:bg-muted",
                  !reachable && "cursor-not-allowed opacity-60",
                )}
              >
                <span className="grid size-6 place-items-center rounded-full bg-muted text-xs">{i + 1}</span>
                <Icon className="size-4" aria-hidden /> {t(`sim.phase_${p}` as never)}
              </button>
              {i < phases.length - 1 && <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div
          ref={viewportRef}
          tabIndex={0}
          role="application"
          aria-label={t("sim.viewportLabel", { arena: runner.arena.name })}
          aria-describedby={`${block.id}-hint`}
          className="relative aspect-[16/10] max-h-[440px] w-full overflow-hidden rounded-2xl border-2 bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          {webgl && started ? (
            <Scene runner={runner} topView={topView} onUnavailable={onUnavailable} />
          ) : (
            <Minimap arena={runner.arena} pose={snap.pose} sensors={snap.sensors} trail={runner.live.trail} className="absolute inset-0 h-full w-full p-2" title={t("sim.mapLabel")} />
          )}
          {!started && (
            <div className="absolute inset-0 grid place-items-center bg-background/40 backdrop-blur-[2px]">
              <Button
                type="button"
                size="lg"
                variant="accent"
                className="animate-pop-in shadow-lg"
                onClick={() => {
                  setStarted(true);
                  viewportRef.current?.focus();
                }}
              >
                <Rocket aria-hidden /> {t("sim.start")}
              </Button>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 text-sm font-semibold">
            <span className="rounded-lg bg-background/85 px-2 py-1 backdrop-blur">
              {snap.phase === "test" && snap.running
                ? t("sim.hud_running", { s: snap.elapsed.toFixed(1), bumps: snap.bumps })
                : snap.phase === "teach"
                  ? t("sim.hud_examples", { n: snap.examples, min: block.min_examples })
                  : snap.phase === "label"
                    ? t("sim.hud_situation")
                    : runner.arena.name}
            </span>
            {webgl && started && (
              <Button type="button" size="sm" variant="outline" className="pointer-events-auto" aria-pressed={topView} onClick={() => setTopView((v) => !v)}>
                <Eye aria-hidden /> {topView ? t("sim.followView") : t("sim.topView")}
              </Button>
            )}
          </div>
          {snap.phase === "teach" && started && !focused && (
            <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-background/85 p-2 text-center text-sm backdrop-blur" id={`${block.id}-hint`}>
              {t("sim.focusHint")}
            </p>
          )}
          {(snap.phase !== "teach" || focused) && (
            <span id={`${block.id}-hint`} className="sr-only">
              {t("sim.keysHint")}
            </span>
          )}
        </div>

        <aside className="space-y-4">
          <Telemetry snap={snap} runner={runner} />
          {snap.phase === "teach" && (
            <TeachPanel block={block} snap={snap} runner={runner} setInput={setInput} onClear={() => {
              runner.clearExamples();
              persist();
            }} />
          )}
          {snap.phase === "label" && <LabelPanel snap={snap} runner={runner} block={block} />}
          {snap.phase === "train" && <TrainPanel block={block} snap={snap} runner={runner} canTrain={canTrain} />}
          {snap.phase === "test" && <TestPanel block={block} snap={snap} runner={runner} pending={pending} />}
        </aside>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <ErrorText>{error}</ErrorText>
      {result && snap.phase === "test" && !snap.running && (
        <Feedback tone={result.completed ? "good" : "try"}>
          <p className="font-semibold">{result.completed ? t("sim.passed") : t("sim.notYet")}</p>
          {result.feedback && <p>{result.feedback}</p>}
        </Feedback>
      )}
      {saved?.result?.completed && !result && (
        <p className="text-sm text-muted-foreground">
          {t("sim.passedBefore", { s: String((saved.response as { seconds?: number } | undefined)?.seconds ?? "—") })}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Bar({ label, value, signed }: { label: string; value: number | null; signed?: boolean }) {
  if (value === null) return null;
  const pct = signed ? 50 + value * 50 : value * 100;
  const tone = signed ? "bg-primary" : value < 0.3 ? "bg-coral" : value < 0.6 ? "bg-warning" : "bg-success";
  return (
    <div className="text-xs">
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{signed ? value.toFixed(2) : `${Math.round(value * 100)}%`}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label={label} aria-valuemin={signed ? -1 : 0} aria-valuemax={1} aria-valuenow={Number(value.toFixed(2))}>
        {signed ? (
          <div className={cn("absolute top-0 h-full", tone)} style={{ left: `${Math.min(50, pct)}%`, width: `${Math.abs(pct - 50)}%` }} />
        ) : (
          <div className={cn("h-full transition-[width] duration-100", tone)} style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}

function Telemetry({ snap, runner }: { snap: Snapshot; runner: SimRunner }) {
  const s = snap.sensors;
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 rounded-2xl border-2 bg-card p-3">
      <Minimap arena={runner.arena} pose={snap.pose} sensors={s} className="h-auto w-full rounded-lg" title={t("sim.mapLabel")} />
      <div className="space-y-1.5" aria-label={t("sim.sensors")}>
        <Bar label={t("sim.rayLeft")} value={s.left} />
        <Bar label={t("sim.rayFront")} value={s.front} />
        <Bar label={t("sim.rayRight")} value={s.right} />
        <Bar label={t("sim.lineSensor")} value={s.line} signed />
        <Bar label={t("sim.flagSide")} value={s.goalSin} signed />
      </div>
    </div>
  );
}

function CoverageChips({ snap }: { snap: Snapshot }) {
  const c = snap.coverage;
  return (
    <p className="flex flex-wrap gap-1.5 text-xs" aria-label={t("sim.coverage")}>
      {ACTIONS.map((a) => (
        <span key={a} className={cn("rounded-full px-2 py-0.5", c[a] ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>
          {t(`sim.${a}` as never)} · {c[a]}
        </span>
      ))}
    </p>
  );
}

function TeachPanel({ block, snap, runner, setInput, onClear }: { block: BlockOf<"robot_sim">; snap: Snapshot; runner: SimRunner; setInput: (a: Action | null) => void; onClear: () => void }) {
  const missing = ACTIONS.filter((a) => snap.coverage[a] === 0 && snap.examples >= 10);
  return (
    <div className="space-y-3 rounded-2xl border-2 bg-card p-3">
      <p className="text-sm">{t("sim.teachIntro")}</p>
      <DPad onInput={setInput} active={snap.action} />
      <p className="text-sm font-semibold" aria-live="polite">
        {t("sim.examplesCount", { n: snap.examples })}{" "}
        {snap.examples < block.min_examples ? (
          <span className="font-normal text-muted-foreground">{t("sim.needMore", { n: block.min_examples - snap.examples })}</span>
        ) : (
          <span className="text-success">{t("sim.enough")}</span>
        )}
      </p>
      <CoverageChips snap={snap} />
      {missing.length > 0 && <p className="text-xs text-warning-foreground">{t("sim.missingAction", { action: missing.map((a) => t(`sim.${a}` as never)).join(", ") })}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => runner.resetPose()}>
          <RotateCcw aria-hidden /> {t("sim.resetPosition")}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={snap.examples === 0} onClick={onClear}>
          <Eraser aria-hidden /> {t("sim.clearExamples")}
        </Button>
      </div>
      {block.hints.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">{t("sim.hints")}</summary>
          <ul className="mt-1 ml-5 list-disc space-y-1">
            {block.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LabelPanel({ snap, runner, block }: { snap: Snapshot; runner: SimRunner; block: BlockOf<"robot_sim"> }) {
  return (
    <div className="space-y-3 rounded-2xl border-2 bg-card p-3">
      <p className="text-sm">{t("sim.labelIntro")}</p>
      <p className="font-semibold">{t("sim.whatShouldItDo")}</p>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => (
          <Button key={a} type="button" variant="outline" onClick={() => runner.label(a)}>
            {t(`sim.${a}` as never)}
          </Button>
        ))}
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={() => runner.nextSituation()}>
        {t("sim.skipSituation")}
      </Button>
      <p className="text-sm font-semibold" aria-live="polite">
        {t("sim.labelledCount", { n: snap.labelled, total: snap.examples, min: block.min_examples })}
      </p>
      <CoverageChips snap={snap} />
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-10 w-full" role="img" aria-label={t("sim.lossChart", { from: values[0]!.toFixed(2), to: values.at(-1)!.toFixed(2) })}>
      <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TrainPanel({ block, snap, runner, canTrain }: { block: BlockOf<"robot_sim">; snap: Snapshot; runner: SimRunner; canTrain: boolean }) {
  const acc = snap.report?.accuracy;
  return (
    <div className="space-y-3 rounded-2xl border-2 bg-card p-3">
      <p className="text-sm">{block.learner === "knn" ? t("sim.trainIntroKnn") : t("sim.trainIntroMlp")}</p>
      <CoverageChips snap={snap} />
      {!canTrain && <p className="text-sm text-warning-foreground">{t("sim.needBeforeTrain", { n: block.min_examples - snap.examples })}</p>}
      <Button type="button" disabled={!canTrain || snap.training} onClick={() => void runner.train()} aria-busy={snap.training}>
        <Brain aria-hidden /> {snap.training ? t("sim.training") : snap.hasModel ? t("sim.trainAgain") : t("sim.train")}
      </Button>
      {block.learner === "mlp" && snap.losses.length > 1 && (
        <div>
          <p className="text-xs text-muted-foreground">{t("sim.loss")}</p>
          <Sparkline values={snap.losses} />
        </div>
      )}
      {snap.report && !snap.training && (
        <div className="animate-pop-in space-y-1 rounded-xl bg-muted p-3 text-sm" role="status">
          <p className="font-semibold">{t("sim.modelReady")}</p>
          <p>{acc === null || acc === undefined ? t("sim.accuracyNA") : t("sim.accuracy", { pct: Math.round(acc * 100), n: snap.report.testCount })}</p>
          {acc !== null && acc !== undefined && acc < 0.75 && <p className="text-warning-foreground">{t("sim.lowAccuracy")}</p>}
          <Button type="button" size="sm" className="mt-1" onClick={() => runner.setPhase("test")}>
            <Flag aria-hidden /> {t("sim.goTest")}
          </Button>
        </div>
      )}
    </div>
  );
}

function TestPanel({ block, snap, runner, pending }: { block: BlockOf<"robot_sim">; snap: Snapshot; runner: SimRunner; pending: boolean }) {
  const o = snap.outcome;
  return (
    <div className="space-y-3 rounded-2xl border-2 bg-card p-3">
      <p className="text-sm">{t("sim.testIntro", { s: block.pass.max_seconds, bumps: block.pass.max_bumps })}</p>
      {!snap.hasModel && <p className="text-sm text-warning-foreground">{t("sim.trainFirst")}</p>}
      <div className="flex flex-wrap gap-2">
        {snap.running ? (
          <Button type="button" variant="outline" onClick={() => runner.stopTest("stopped")}>
            <Square aria-hidden /> {t("sim.stop")}
          </Button>
        ) : (
          <Button type="button" disabled={!snap.hasModel || pending} onClick={() => runner.startTest()}>
            <Play aria-hidden /> {snap.runs ? t("sim.driveAgain") : t("sim.letItDrive")}
          </Button>
        )}
      </div>
      {o && !snap.running && (
        <div className="animate-pop-in rounded-xl bg-muted p-3 text-sm" role="status">
          <p className="font-semibold">{o.success ? t("sim.reachedFlag", { s: o.seconds, bumps: o.bumps }) : t(`sim.fail_${o.reason}` as never)}</p>
          {!o.success && (
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => runner.setPhase(block.mode === "label" ? "label" : "teach")}>
              {t("sim.teachMore")}
            </Button>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("sim.runs", { n: snap.runs })}</p>
    </div>
  );
}
