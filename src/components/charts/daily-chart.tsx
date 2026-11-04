"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { niceTicks, compact } from "./scale";

export type DailyPoint = { date: string; values: number[] };
export type Series = { label: string; color: "chart-1" | "chart-2" };

const H = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 40 };
const GAP = 2; // surface gap between stacked segments
const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * Daily stacked columns (dataviz method): ≤24px columns with a 4px rounded top,
 * 2px surface gap between segments, hairline grid, legend for ≥2 series,
 * per-column tooltip on hover AND keyboard focus, and a table view.
 */
export function DailyChart({
  title,
  series,
  data,
  unit,
  integer = false,
  format = (v) => `${compact(v)} ${unit}`,
}: {
  title: string;
  series: Series[];
  data: DailyPoint[];
  unit: string;
  /** Counts (e.g. students): whole-number axis ticks. */
  integer?: boolean;
  format?: (v: number) => string;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const ticks = niceTicks(Math.max(0, ...totals), 4, integer);
  const top = ticks[ticks.length - 1]!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(24, Math.max(3, band * 0.62));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 64))));
  const empty = totals.every((t) => t === 0);

  /** Column segment path: square bottom, 4px rounded top when it's the top segment. */
  function seg(x: number, y0: number, y1: number, roundTop: boolean) {
    const h = y0 - y1;
    if (h <= 0) return "";
    const r = roundTop ? Math.min(4, h, barW / 2) : 0;
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 + r} V${y0} Z`;
  }

  const a = active !== null ? data[active] : null;
  return (
    <figure className="space-y-3" aria-labelledby={`${id}-t`}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-t`} className="font-semibold">
          {title}
        </span>
        {series.length > 1 && (
          <span className="flex flex-wrap gap-4 text-sm text-muted-foreground" aria-hidden>
            {series.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm" style={{ background: `var(--${s.color})` }} />
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>

      <div ref={box} className="relative" onPointerLeave={() => setActive(null)}>
        {empty && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">No activity in this period.</p>}
        <svg width={width} height={H} role="img" aria-label={`${title}. Use Tab to step through days, or open the table below.`} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + i * band + (band - barW) / 2;
            let acc = 0;
            const lastNonZero = d.values.reduce((last, v, j) => (v > 0 ? j : last), -1);
            const segs = d.values.map((v, j) => {
              if (v <= 0) return null;
              const y0 = y(acc) - (acc > 0 ? GAP : 0);
              acc += v;
              return <path key={j} d={seg(x, y0, y(acc), j === lastNonZero)} fill={`var(--${series[j]!.color})`} opacity={active === null || active === i ? 1 : 0.7} />;
            });
            const label = `${fmtDay(d.date)}: ${series.map((s, j) => `${format(d.values[j] ?? 0)} ${s.label.toLowerCase()}`).join(", ")}`;
            return (
              <g key={d.date}>
                {segs}
                {/* Hit target: the whole band, focusable, bigger than the mark */}
                <rect
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={label}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none focus-visible:stroke-ring focus-visible:stroke-2"
                />
                {((i % labelEvery === 0 && data.length - 1 - i >= Math.ceil(labelEvery / 2)) || i === data.length - 1) && (
                  <text x={PAD.left + i * band + band / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {fmtDay(d.date)}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--chart-grid)" strokeWidth={1} />
        </svg>

        {a && active !== null && (() => {
          // Fixed-width tooltip beside the column; flips to the left near the right edge.
          const TIP = Math.min(300, width - 8);
          const cx = PAD.left + active * band + band / 2;
          const left = cx + 14 + TIP > width ? Math.max(0, cx - 14 - TIP) : cx + 14;
          return (
            <div role="status" className="pointer-events-none absolute top-1 z-10 rounded-lg border bg-card p-2 text-sm shadow-lg" style={{ left, width: TIP }}>
              <p className="mb-1 text-xs text-muted-foreground">{fmtDay(a.date)}</p>
              {series.map((s, j) => (
                <p key={s.label} className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="inline-block h-0.5 w-3 shrink-0 self-center rounded" style={{ background: `var(--${s.color})` }} aria-hidden />
                  <strong className="tabular-nums">{format(a.values[j] ?? 0)}</strong>
                  <span className="truncate text-muted-foreground">{s.label}</span>
                </p>
              ))}
            </div>
          );
        })()}
      </div>

      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer content-center font-medium text-primary">Show as table</summary>
        <div className="max-h-64 overflow-auto rounded-lg border">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th scope="col" className="p-2">
                  Date
                </th>
                {series.map((s) => (
                  <th key={s.label} scope="col" className="p-2 text-right">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t">
                  <td className="p-2">{fmtDay(d.date)}</td>
                  {series.map((s, j) => (
                    <td key={s.label} className="p-2 text-right">
                      {format(d.values[j] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}
