"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StudentBlock } from "@/content/blocks/grading";
import { ErrorText, Feedback } from "./ui";
import { RetryHint } from "./activity-players";
import { useSubmit } from "./use-submit";
import { t } from "@/i18n";

type QuizBlock = Extract<StudentBlock, { type: "quiz" }>;

/** Answers are graded on the server; correct answers/explanations arrive only after submitting. */
export function QuizPlayer({ block }: { block: QuizBlock }) {
  const { saved, result, setResult, error, pending, submit } = useSubmit(block.id);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>(
    () => (saved?.response as { answers?: Record<string, string | boolean> } | undefined)?.answers ?? {},
  );
  const graded = result?.quiz;
  const byId = new Map(graded?.results.map((r) => [r.id, r]));
  const allAnswered = block.questions.every((q) => answers[q.id] !== undefined && answers[q.id] !== "");
  const set = (id: string, v: string | boolean) => setAnswers((a) => ({ ...a, [id]: v }));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit({ answers });
      }}
    >
      <h3 className="text-xl font-bold">{block.title}</h3>
      <ol className="space-y-5">
        {block.questions.map((q, i) => {
          const r = byId.get(q.id);
          return (
            <li key={q.id} className={cn("space-y-3 rounded-xl border-2 bg-background p-4", r && (r.correct ? "border-success/60" : "border-warning/70"))}>
              <fieldset disabled={Boolean(graded)} className="space-y-2">
                <legend className="font-semibold">
                  {i + 1}. {q.kind === "true_false" ? t("player.trueOrFalse", { s: q.statement }) : q.prompt}
                </legend>
                {q.kind === "mcq" &&
                  q.options.map((o) => (
                    <label key={o.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 has-checked:border-primary has-checked:bg-secondary">
                      <input type="radio" name={`${block.id}-${q.id}`} checked={answers[q.id] === o.id} onChange={() => set(q.id, o.id)} className="size-5" />
                      {o.text}
                    </label>
                  ))}
                {q.kind === "true_false" && (
                  <div className="grid grid-cols-2 gap-2">
                    {[true, false].map((v) => (
                      <label key={String(v)} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 font-semibold has-checked:border-primary has-checked:bg-secondary">
                        <input type="radio" name={`${block.id}-${q.id}`} checked={answers[q.id] === v} onChange={() => set(q.id, v)} className="size-5" />
                        {v ? t("player.true") : t("player.false")}
                      </label>
                    ))}
                  </div>
                )}
                {q.kind === "short_answer" && (
                  <Input
                    aria-label={t("player.yourAnswer")}
                    value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                    onChange={(e) => set(q.id, e.currentTarget.value)}
                    autoCapitalize="off"
                    maxLength={200}
                  />
                )}
              </fieldset>
              {r && (
                <div role="status" className="space-y-1 text-sm">
                  <p className="font-semibold">{r.correct ? `✅ ${t("player.correct")}` : `🔁 ${t("player.answerWas", { a: r.correctAnswer })}`}</p>
                  <p className="text-muted-foreground">{r.explanation}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <ErrorText>{error}</ErrorText>
      {graded ? (
        <div className="space-y-3">
          <Feedback tone={graded.passed ? "good" : "try"}>
            <p className="font-semibold">
              {graded.passed ? t("player.quizPassed", { score: result?.score ?? 0 }) : t("player.quizNotYet", { score: result?.score ?? 0, pass: block.passing_score })}
            </p>
          </Feedback>
          {!graded.passed && (
            <RetryHint
              onRetry={() => {
                setResult(undefined);
                setAnswers({});
              }}
            />
          )}
        </div>
      ) : (
        <Button type="submit" disabled={pending || !allAnswered}>
          <Send aria-hidden /> {t("player.submitQuiz")}
        </Button>
      )}
    </form>
  );
}
