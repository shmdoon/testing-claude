/** YYYY-MM-DD for "today" in India time. */
export function istDate(d = new Date()): string {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dense series from sparse rows: one entry per day from..to (inclusive). */
export function fillDays<T extends { date: string }>(from: string, to: string, rows: T[], pick: (row: T | undefined) => number[]): { date: string; values: number[] }[] {
  const by = new Map(rows.map((r) => [r.date, r]));
  const out: { date: string; values: number[] }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, values: pick(by.get(d)) });
  return out;
}
