"use client";

import { useState, useTransition } from "react";
import { submitBlock, type SubmitResult } from "@/lib/learn/actions";
import { gradeBlock, type GradeResult } from "@/content/blocks/grading";
import type { Block } from "@/content/blocks/schema";
import { usePlayer } from "./context";

/**
 * Submit a block response to the server (which grades and saves it).
 * In the public playground (`demo`) the same grader runs in the browser and
 * nothing is stored; pass the block so it can be graded.
 */
export function useSubmit(blockId: string, block?: Block) {
  const { lessonId, responses, onSaved, demo } = usePlayer();
  const saved = responses[blockId];
  const [result, setResult] = useState<GradeResult | undefined>(saved?.result);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(response: unknown, after?: (r: SubmitResult) => void) {
    setError(undefined);
    start(async () => {
      const res: SubmitResult =
        demo && block
          ? (() => {
              const g = gradeBlock(block, response);
              return g.ok ? { ok: true, result: g.result, lessonStatus: "in_progress", activityAttempted: true } : { ok: false, error: g.error };
            })()
          : await submitBlock(lessonId, blockId, response);
      if (res.ok) {
        setResult(res.result);
        onSaved(blockId, res, response);
      } else setError(res.error);
      after?.(res);
    });
  }
  return { saved, result, setResult, error, pending, submit };
}
