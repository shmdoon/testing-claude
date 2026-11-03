"use client";

import { useState, useTransition } from "react";
import { submitBlock, type SubmitResult } from "@/lib/learn/actions";
import type { GradeResult } from "@/content/blocks/grading";
import { usePlayer } from "./context";

/** Submit a block response to the server (which grades and saves it). */
export function useSubmit(blockId: string) {
  const { lessonId, responses, onSaved } = usePlayer();
  const saved = responses[blockId];
  const [result, setResult] = useState<GradeResult | undefined>(saved?.result);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(response: unknown, after?: (r: SubmitResult) => void) {
    setError(undefined);
    start(async () => {
      const res = await submitBlock(lessonId, blockId, response);
      if (res.ok) {
        setResult(res.result);
        onSaved(blockId, res, response);
      } else setError(res.error);
      after?.(res);
    });
  }
  return { saved, result, setResult, error, pending, submit };
}
