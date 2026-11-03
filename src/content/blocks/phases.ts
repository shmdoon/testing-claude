/** Lesson phases in order. Zod-free so the student player bundle stays small. */
export const PHASES = ["activity", "reflection", "module", "check"] as const;
export type Phase = (typeof PHASES)[number];
