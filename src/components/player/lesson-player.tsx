"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, PartyPopper, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setPhase } from "@/lib/learn/actions";
import type { PlayerData } from "@/lib/learn/queries";
import { PHASES, type Phase } from "@/content/blocks/phases";
import { PlayerContext, type PlayerCtx } from "./context";
import { useActivityTracker } from "@/hooks/use-activity-tracker";
import { BlockPlayer, INTERACTIVE_TYPES } from "./registry";
import { t } from "@/i18n";

type Data = Extract<PlayerData, { kind: "ok" }>;
type Step = Phase | "done";

const STEP_LABEL: Record<Step, string> = {
  activity: "player.stepActivity",
  reflection: "player.stepReflection",
  module: "player.stepModule",
  check: "player.stepCheck",
  done: "player.stepDone",
};
const STEP_COLOR: Record<Step, string> = {
  activity: "bg-phase-activity",
  reflection: "bg-phase-reflection",
  module: "bg-phase-module",
  check: "bg-phase-check",
  done: "bg-accent",
};

export function LessonPlayer(props: Omit<Data, "kind" | "user">) {
  const router = useRouter();
  const [, startRefresh] = useTransition();

  // Server data can change (refresh after submissions/unlocks): keep local copies in sync.
  const [synced, setSynced] = useState(props);
  const [responses, setResponses] = useState(props.responses);
  const [status, setStatus] = useState(props.progress.status);
  const [activityAttempted, setActivityAttempted] = useState(props.progress.activity_attempted);
  if (props !== synced) {
    setSynced(props);
    setResponses(props.responses);
    setStatus(props.progress.status);
    setActivityAttempted(props.progress.activity_attempted);
  }

  const { blocks, lockedPhases, lesson } = props;
  const steps = useMemo<Step[]>(() => {
    const present = new Set<string>([...blocks.map((b) => b.phase), ...lockedPhases]);
    return [...PHASES.filter((p) => present.has(p)), "done"];
  }, [blocks, lockedPhases]);

  const [step, setStep] = useState<Step>(() => {
    if (props.progress.status === "completed") return "done";
    // Resume where work is still needed (e.g. a teacher asked for a revision),
    // otherwise where the student left off.
    const needsWork = firstOpenStep(steps, blocks, props.responses);
    if (props.progress.current_phase === "done" || (needsWork && steps.indexOf(needsWork) < steps.indexOf(props.progress.current_phase as Step))) {
      return needsWork ?? steps[0]!;
    }
    return steps.find((x) => x === props.progress.current_phase) ?? steps[0]!;
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Once the activity is attempted, fetch the held-back phases from the server.
  useEffect(() => {
    if (activityAttempted && lockedPhases.length > 0) startRefresh(() => router.refresh());
  }, [activityAttempted, lockedPhases.length, router]);

  const blocksOf = (p: Phase) => blocks.filter((b) => b.phase === p);
  const interactive = (p: Phase) => blocksOf(p).filter((b) => INTERACTIVE_TYPES.has(b.type));
  const attempted = (id: string) => Boolean(responses[id]);
  const completed = (id: string) => Boolean(responses[id]?.completed);

  /** Why the student can't move past `p` yet (null = free to continue). */
  function blocker(p: Step): string | null {
    if (p === "activity") {
      if (!lesson.require_activity_first) return null;
      return interactive("activity").every((b) => attempted(b.id)) ? null : t("player.tryActivityFirst");
    }
    if (p === "reflection") return interactive("reflection").every((b) => completed(b.id)) ? null : t("player.answerReflection");
    if (p === "check") return interactive("check").every((b) => completed(b.id)) ? null : t("player.passQuiz");
    return null;
  }

  function canEnter(target: Step): boolean {
    const ti = steps.indexOf(target);
    for (let i = 0; i < ti; i++) if (blocker(steps[i]!)) return false;
    if (target !== "activity" && target !== "done" && lockedPhases.includes(target)) return false;
    return true;
  }

  function go(target: Step) {
    if (!canEnter(target)) return;
    setStep(target);
    if (status !== "completed") void setPhase(lesson.id, target);
  }

  const ctx: PlayerCtx = {
    lessonId: lesson.id,
    responses,
    external: props.external,
    onSaved: (blockId, res, response) => {
      setResponses((r) => ({
        ...r,
        [blockId]: {
          response,
          score: res.result.score,
          completed: res.result.completed,
          attempts: (r[blockId]?.attempts ?? 0) + 1,
          result: res.result,
        },
      }));
      setStatus(res.lessonStatus);
      if (res.activityAttempted) setActivityAttempted(true);
    },
    refresh: () => startRefresh(() => router.refresh()),
  };

  // Active-time tracking for this lesson (block = first block of the current step).
  useActivityTracker({
    courseId: props.course.id,
    lessonId: lesson.id,
    blockId: step === "done" ? null : (blocksOf(step)[0]?.id ?? null),
  });

  const idx = steps.indexOf(step);
  const nextStep = steps[idx + 1];
  const block = step === "done" ? null : blocker(step);

  return (
    <PlayerContext value={ctx}>
      <div className="space-y-6">
        <nav aria-label={t("player.steps")}>
          <ol className="flex gap-1 overflow-x-auto pb-1 sm:gap-2">
            {steps.map((s, i) => {
              const enterable = canEnter(s);
              const current = s === step;
              return (
                <li key={s} className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => go(s)}
                    disabled={!enterable}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "flex w-full min-w-16 flex-col items-center gap-1 rounded-xl p-2 text-xs font-semibold transition sm:text-sm",
                      current ? "bg-card shadow-sm ring-2 ring-primary" : "hover:bg-muted",
                      !enterable && "cursor-not-allowed text-muted-foreground",
                    )}
                  >
                    <span className={cn("h-2 w-full rounded-full", i <= idx || status === "completed" ? STEP_COLOR[s] : "bg-muted")} aria-hidden />
                    <span className="flex items-center gap-1 truncate">
                      {!enterable && <Lock className="size-3" aria-hidden />}
                      {t(STEP_LABEL[s] as never)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {props.newerVersionAvailable && <p className="rounded-xl bg-muted p-3 text-sm">{t("player.olderVersion")}</p>}

        <section aria-labelledby="phase-h" className="space-y-6">
          <h2 id="phase-h" ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none sm:text-3xl">
            {t(`player.heading_${step}` as never)}
          </h2>

          {step === "done" ? (
            <Done
              status={status}
              quizScore={props.progress.quiz_score}
              courseSlug={props.course.slug}
              next={props.next}
              openStep={status === "completed" ? null : firstOpenStep(steps, blocks, responses)}
              onGo={go}
            />
          ) : (
            blocksOf(step).map((b) => (
              <div key={b.id} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                <BlockPlayer block={b} />
              </div>
            ))
          )}
        </section>

        {step !== "done" && (
          <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
            {idx > 0 && (
              <Button type="button" variant="ghost" onClick={() => go(steps[idx - 1]!)}>
                <ArrowLeft aria-hidden /> {t("common.back")}
              </Button>
            )}
            <p className="flex-1 text-sm text-muted-foreground" role="status">
              {block}
            </p>
            {nextStep && (
              <Button type="button" onClick={() => go(nextStep)} disabled={!canEnter(nextStep)}>
                {nextStep === "done" ? t("player.finish") : t("common.continue")} <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        )}
      </div>
    </PlayerContext>
  );
}

/** First step with an interactive block that isn't complete yet. */
function firstOpenStep(steps: Step[], blocks: Data["blocks"], responses: Data["responses"]): Step | null {
  for (const s of steps) {
    if (s === "done") continue;
    if (blocks.some((b) => b.phase === s && INTERACTIVE_TYPES.has(b.type) && !responses[b.id]?.completed)) return s;
  }
  return null;
}

function Done({
  status,
  quizScore,
  courseSlug,
  next,
  openStep,
  onGo,
}: {
  status: string;
  quizScore: number | null;
  courseSlug: string;
  next: { slug: string; title: string } | null;
  openStep: Step | null;
  onGo: (s: Step) => void;
}) {
  const complete = status === "completed";
  const waiting = status === "awaiting_review";
  return (
    <div className="space-y-5 rounded-3xl border-2 bg-card p-6 text-center sm:p-10">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-accent text-accent-foreground">
        {complete ? <PartyPopper className="size-8" aria-hidden /> : <Hourglass className="size-8" aria-hidden />}
      </div>
      <p className="text-2xl font-bold" role="status">
        {complete ? t("player.lessonComplete") : waiting ? t("player.waitingReview") : t("player.almostThere")}
      </p>
      {complete && quizScore !== null && <p className="text-muted-foreground">{t("player.quizScore", { score: quizScore })}</p>}
      {waiting && <p className="text-muted-foreground">{t("player.waitingReviewBody")}</p>}
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        {!complete && !waiting && openStep && (
          <Button size="lg" onClick={() => onGo(openStep)}>
            {t("player.goTo", { step: t(STEP_LABEL[openStep] as never) })}
          </Button>
        )}
        {next && (
          <Button asChild size="lg">
            <Link href={`/learn/${courseSlug}/${next.slug}`}>
              {t("player.nextLesson", { title: next.title })} <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" size="lg">
          <Link href={`/learn/${courseSlug}`}>{t("player.backToCourse")}</Link>
        </Button>
      </div>
    </div>
  );
}
