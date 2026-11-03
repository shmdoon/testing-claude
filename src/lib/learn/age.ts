/**
 * Decision E3: we don't collect date of birth. Estimated age = class + 5
 * (Class 7 → 12), which under-estimates for most students — the safe side.
 */
export function estimatedAge(classLevel: number | null | undefined): number | null {
  return classLevel ? classLevel + 5 : null;
}

export type ToolForEligibility = { enabled: boolean; min_age: number };

/** Staff (no class level) preview everything; students need age ≥ tool minimum. */
export function canUseTool(tool: ToolForEligibility | undefined, role: string, classLevel: number | null): boolean {
  if (!tool || !tool.enabled) return false;
  if (role === "admin" || role === "content_editor") return true;
  const age = estimatedAge(classLevel);
  return age !== null && age >= tool.min_age;
}

/** Away time on an external site, capped at 2× the task's estimate (decision E6). */
export function capAwaySeconds(seconds: number, estimatedMinutes: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.min(Math.round(seconds), estimatedMinutes * 60 * 2);
}
