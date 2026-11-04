/** "Nice" axis ticks: 0 → a round max with ≤ 5 steps (1/2/5 × 10^n). */
export function niceTicks(max: number, target = 4, integer = false): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  if (integer) step = Math.max(1, Math.round(step));
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** 1,284 / 12.9K — compact for axes that reach 10K. */
export function compact(n: number): string {
  return n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K` : n.toLocaleString("en-IN");
}

/** Seconds → "1 h 5 min" / "12 min" / "0 min". */
export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}
