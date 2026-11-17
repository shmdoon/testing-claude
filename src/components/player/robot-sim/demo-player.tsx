"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { BlockOf } from "@/content/blocks/schema";
import { ARENAS, type ArenaId } from "@/lib/sim/arena";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { PlayerContext, type PlayerCtx } from "../context";
import { RobotSimPlayer } from "./robot-sim-player";

const CHALLENGES: { arena: ArenaId; difficulty: number; min: number; pass: { max_seconds: number; max_bumps: number }; learner: "knn" | "mlp" }[] = [
  { arena: "open-field", difficulty: 1, min: 20, pass: { max_seconds: 30, max_bumps: 0 }, learner: "knn" },
  { arena: "wall-ahead", difficulty: 2, min: 40, pass: { max_seconds: 40, max_bumps: 3 }, learner: "knn" },
  { arena: "line-track", difficulty: 3, min: 60, pass: { max_seconds: 60, max_bumps: 2 }, learner: "mlp" },
];

/** The simulator with no account: graded in the browser, nothing saved. */
export function DemoPlayer() {
  const [i, setI] = useState(0);
  const [passed, setPassed] = useState(false);
  const c = CHALLENGES[i]!;
  const block = useMemo<BlockOf<"robot_sim">>(
    () => ({
      id: `demo-${c.arena}`,
      type: "robot_sim",
      phase: "activity",
      title: ARENAS[c.arena].name,
      goal: ARENAS[c.arena].blurb,
      arena: c.arena,
      difficulty: c.difficulty,
      mode: "demonstrate",
      learner: c.learner,
      min_examples: c.min,
      sensor_noise: 0,
      pass: c.pass,
      hints: ["Drive smoothly and reset to drive the route again.", "Train, test, then teach more where it went wrong."],
    }),
    [c],
  );
  const ctx = useMemo<PlayerCtx>(
    () => ({
      lessonId: "demo",
      responses: {},
      external: {},
      onSaved: (_id, res) => {
        if (res.result.completed) setPassed(true);
      },
      refresh: () => undefined,
      demo: true,
    }),
    [],
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("playground.pick")}>
        {CHALLENGES.map((ch, j) => (
          <button
            key={ch.arena}
            type="button"
            aria-pressed={i === j}
            onClick={() => {
              setI(j);
              setPassed(false);
            }}
            className={cn("min-h-11 rounded-xl border-2 px-4 text-sm font-semibold transition", i === j ? "border-primary bg-secondary text-secondary-foreground" : "bg-background hover:bg-muted")}
          >
            {j + 1}. {ARENAS[ch.arena].name}
          </button>
        ))}
      </div>
      <PlayerContext value={ctx}>
        <RobotSimPlayer key={block.id} block={block} />
      </PlayerContext>
      {passed && (
        <div className="animate-pop-in flex flex-wrap items-center gap-3 rounded-2xl border-2 border-accent bg-accent/15 p-4" data-testid="playground-passed">
          <p className="flex-1 font-semibold">{t("playground.passedCta")}</p>
          <Button asChild variant="accent">
            <Link href="/signup">{t("playground.signup")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/courses/physical-ai">{t("playground.seeCourse")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
