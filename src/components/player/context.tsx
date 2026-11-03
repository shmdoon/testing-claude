"use client";

import { createContext, use } from "react";
import type { SubmitResult } from "@/lib/learn/actions";
import type { ExternalExtras, SavedResponse } from "@/lib/learn/queries";

export type PlayerCtx = {
  lessonId: string;
  responses: Record<string, SavedResponse>;
  external: Record<string, ExternalExtras>;
  /** Called after the server accepted a response (updates progress + gating). */
  onSaved: (blockId: string, res: Extract<SubmitResult, { ok: true }>, response: unknown) => void;
  /** Re-fetch server data (e.g. after an external submission). */
  refresh: () => void;
};

export const PlayerContext = createContext<PlayerCtx | null>(null);

export function usePlayer() {
  const ctx = use(PlayerContext);
  if (!ctx) throw new Error("usePlayer outside LessonPlayer");
  return ctx;
}
