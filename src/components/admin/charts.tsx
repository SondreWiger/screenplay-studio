'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { bucketLabel, bucketTitle, compact, type BucketUnit } from '@/lib/admin/analytics';
import { EASE } from './motion';

/**
 * Categorical palette, dark-surface steps, in validated fixed order (CVD-safe
 * on adjacent pairs). Assign by entity, never by rank.
 */
export const SERIES = {
  blue: '#3987e5',
  orange: '#d95926',
  aqua: '#199e70',
  yellow: '#c98500',
  magenta: '#d55181',
  green: '#008300',
  violet: '#9085e9',
  red: '#e66767',
} as const;
export const CATEGORICAL = Object.values(SERIES);
/** Sequential blue ramp (light → dark reads as low → high on a dark surface reversed). */
const SEQ = ['#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4'];
/** Previous-period comparison line. */
const GHOST = 'rgb(var(--surface-500))';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Monotone cubic interpolation (Fritsch–Carlson): smooth without overshooting the data. */
function monotonePath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push(dx[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const h = dx[i] / 3;
    d += `C${x0 + h},${y0 + t[i] * h} ${x1 - h},${y1 - t[i + 1] * h} ${x1},${y1}`;
  }
  return d;
}

/** "Nice" upper bound and tick step for a y axis. */
function niceScale(max: number, ticks = 4): { top: number; step: number } {
  if (max <= 0) return { top: ticks, step: 1 };
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const s = step < 1 ? 1 : step;
  return { top: Math.ceil(max / s) * s, step: s };
}

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
  /** Draw as a dashed comparison line with no fill. */
  ghost?: boolean;
}

/**
 * Area/line chart over time buckets with a hover crosshair and tooltip.
 * One y axis; series share a scale.
 */
export function TimeChart({ buckets, unit, series, height = 260, format = compact, fill = true, animKey, zeroBase = true, bars = false, stacked = false }: {
  buckets: number[];
  unit: BucketUnit;
  series: ChartSeries[];
  height?: number;
  format?: (n: number) => string;
  fill?: boolean;
  /** Changing this replays the draw-in animation. */
  animKey?: string;
  /** Start the y axis at 0 (default). Off for slow-moving totals, so the trend is visible. */
  zeroBase?: boolean;
  /** Draw columns instead of areas — better for sparse counts. Ghost series stay lines. */
  bars?: boolean;
  /** With `bars`: stack series (parts of one whole) instead of grouping them side by side. */
  stacked?: boolean;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  const pad = { top: 12, right: 12, bottom: 26, left: 44 };
  const w = Math.max(width - pad.left - pad.right, 10);
  const h = height - pad.top - pad.bottom;
  const n = buckets.length;

  const solidSeries = series.filter((s) => !s.ghost);
  // Stacked columns: the axis must fit each bucket's total
  const stackTotals = bars && stacked ? buckets.map((_, i) => solidSeries.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)) : [];
  const all = [...series.flatMap((s) => s.values), ...stackTotals];
  const max = Math.max(1, ...all);
  const min = all.length ? Math.min(...all) : 0;
  let lo = 0;
  let { top, step } = niceScale(max);
  if (!zeroBase && min > 0) {
    const span = Math.max(1, max - min);
    step = niceScale(span).step;
    lo = Math.max(0, Math.floor((min - span * 0.2) / step) * step);
    top = Math.max(lo + step, Math.ceil(max / step) * step);
  }
  const band = n > 0 ? w / n : w;
  const x = (i: number) => (bars ? (i + 0.5) * band : n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => h - ((v - lo) / (top - lo)) * h;

  const paths = useMemo(() => series.map((s) => {
    const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
    const line = monotonePath(pts);
    const area = pts.length ? `${line}L${x(pts.length - 1)},${h}L${x(0)},${h}Z` : '';
    return { ...s, line, area };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [series, w, h, top, lo, bars]);

  const yTicks: number[] = [];
  for (let v = lo; v <= top + 1e-9; v += step) yTicks.push(v);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 72))));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = bars ? Math.floor(px / band) : Math.round((px / w) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const tipLeft = hover != null ? pad.left + x(hover) : 0;
  const flip = hover != null && x(hover) > w * 0.6;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="overflow-visible" role="img" aria-label={series.map((s) => s.label).join(', ')}>
          <defs>
            {paths.map((p) => (
              <linearGradient key={p.key} id={`${gid}-${p.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={p.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={p.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={0} x2={w} y1={y(v)} y2={y(v)} stroke="rgb(var(--surface-800))" strokeDasharray={v === lo ? undefined : '2 4'} />
                <text x={-8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-surface-500 text-[10px] tabular-nums">{format(v)}</text>
              </g>
            ))}
            {buckets.map((b, i) => (i % labelEvery === 0 || i === n - 1) && (n - 1 - i >= labelEvery || i === n - 1) ? (
              <text key={b} x={x(i)} y={h + 18} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-surface-500 text-[10px]">
                {bucketLabel(b, unit)}
              </text>
            ) : null)}
            <g key={animKey}>
                {bars && !stacked && (() => {
                  const solid = paths.filter((p) => !p.ghost);
                  const gap = solid.length > 1 ? 1 : 0;
                  const bw = Math.max(1.5, (band * 0.72) / solid.length - gap);
                  return solid.map((p, k) => (
                    <g key={`grp-${p.key}`}>
                      {p.values.map((v, i) => {
                        if (v <= lo) return null;
                        const by = y(v);
                        return (
                          <motion.rect
                            key={i}
                            x={x(i) - band * 0.36 + k * (bw + gap)}
                            y={by}
                            width={bw}
                            height={Math.max(1, h - by)}
                            rx={Math.min(3, bw / 2)}
                            fill={p.color}
                            fillOpacity={hover == null || hover === i ? 0.95 : 0.5}
                            style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ duration: 0.5, ease: EASE, delay: Math.min(i, 60) * 0.008 }}
                          />
                        );
                      })}
                    </g>
                  ));
                })()}
                {bars && stacked && (() => {
                  const solid = paths.filter((p) => !p.ghost);
                  const bw = Math.max(2, band * 0.7);
                  return buckets.map((_, i) => {
                    let acc = 0;
                    return (
                      <g key={`col-${i}`}>
                        {solid.map((p, k) => {
                          const v = p.values[i] ?? 0;
                          if (v <= 0) return null;
                          const y0 = y(acc);
                          acc += v;
                          const y1 = y(acc);
                          // 2px surface gap between stacked segments
                          const gap = k > 0 && solid.slice(0, k).some((q) => (q.values[i] ?? 0) > 0) ? 2 : 0;
                          return (
                            <motion.rect
                              key={p.key}
                              x={x(i) - bw / 2}
                              y={y1}
                              width={bw}
                              height={Math.max(1, y0 - y1 - gap)}
                              rx={Math.min(3, bw / 2)}
                              fill={p.color}
                              fillOpacity={hover == null || hover === i ? 0.95 : 0.5}
                              style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
                              initial={{ scaleY: 0 }}
                              animate={{ scaleY: 1 }}
                              transition={{ duration: 0.5, ease: EASE, delay: Math.min(i, 60) * 0.008 }}
                            />
                          );
                        })}
                      </g>
                    );
                  });
                })()}
                {paths.filter((p) => !bars || p.ghost).map((p) => (
                  <g key={p.key}>
                    {fill && !p.ghost && (
                      <motion.path
                        d={p.area}
                        fill={`url(#${gid}-${p.key})`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, ease: EASE, delay: 0.25 }}
                      />
                    )}
                    <motion.path
                      d={p.line}
                      fill="none"
                      stroke={p.ghost ? GHOST : p.color}
                      strokeWidth={p.ghost ? 1.5 : 2}
                      strokeDasharray={p.ghost ? '4 4' : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={p.ghost ? { opacity: 0 } : { pathLength: 0 }}
                      animate={p.ghost ? { opacity: 0.7 } : { pathLength: 1 }}
                      transition={{ duration: p.ghost ? 0.6 : 1.1, ease: EASE }}
                    />
                  </g>
                ))}
            </g>
            {hover != null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="rgb(var(--surface-500))" strokeWidth={1} />
                {!bars && paths.filter((p) => !p.ghost).map((p) => (
                  <circle key={p.key} cx={x(hover)} cy={y(p.values[hover] ?? 0)} r={4.5} fill={p.color} stroke="rgb(var(--surface-900))" strokeWidth={2} />
                ))}
              </g>
            )}
            <rect
              width={w}
              height={h}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </g>
        </svg>
      )}
      <AnimatePresence>
        {hover != null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-lg border border-surface-700 bg-surface-950/95 px-3 py-2 shadow-xl backdrop-blur"
            style={{ left: tipLeft, transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
          >
            <p className="mb-1.5 text-[11px] font-medium text-surface-400">{bucketTitle(buckets[hover], unit)}</p>
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-surface-300">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.ghost ? GHOST : s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold tabular-nums text-white">{format(s.values[hover] ?? 0)}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Tiny trend line for stat tiles. No axes, no hover. */
export function Sparkline({ values, color = SERIES.blue, height = 32, className }: { values: number[]; color?: string; height?: number; className?: string }) {
  const gid = useId().replace(/:/g, '');
  if (values.length < 2) return <div style={{ height }} className={className} />;
  const W = 120;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, height - 2 - (v / max) * (height - 4)] as [number, number]);
  const line = monotonePath(pts);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={cn('w-full overflow-visible', className)} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path d={`${line}L${W},${height}L0,${height}Z`} fill={`url(#${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: EASE }} />
    </svg>
  );
}

/** Ranked horizontal bars with share-of-total. */
export function BarList({ items, color = SERIES.blue, format = compact, empty = 'No data in this period', limit, labelFormat }: {
  items: { label: string; count: number }[];
  color?: string;
  format?: (n: number) => string;
  empty?: string;
  limit?: number;
  labelFormat?: (label: string) => ReactNode;
}) {
  const rows = limit ? items.slice(0, limit) : items;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = items.reduce((s, r) => s + r.count, 0) || 1;
  if (!rows.length) return <p className="py-6 text-center text-xs text-surface-600">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate capitalize text-surface-300">{labelFormat ? labelFormat(r.label) : r.label.replace(/_/g, ' ')}</span>
            <span className="shrink-0 tabular-nums text-surface-400">
              <span className="font-semibold text-surface-100">{format(r.count)}</span>
              <span className="ml-1.5 text-surface-600">{Math.round((r.count / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${(r.count / max) * 100}%` }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.05 * i }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Weekday × hour activity grid (UTC). */
export function Heatmap({ grid, label = 'events' }: { grid: number[][]; label?: string }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...grid.flat());
  const shade = (v: number) => (v === 0 ? 'rgb(var(--surface-800) / 0.6)' : SEQ[Math.min(SEQ.length - 1, Math.floor((v / max) * (SEQ.length - 1)))]);
  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[520px]">
          <div className="ml-9 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px] pb-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <span key={h} className="text-center text-[9px] text-surface-600">{h % 3 === 0 ? h : ''}</span>
            ))}
          </div>
          {grid.map((row, d) => (
            <div key={d} className="mb-[3px] flex items-center">
              <span className="w-9 shrink-0 text-[10px] text-surface-500">{DAYS[d]}</span>
              <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
                {row.map((v, h) => (
                  <motion.div
                    key={h}
                    className="aspect-square rounded-[3px] ring-brand-400 hover:ring-1"
                    style={{ background: shade(v) }}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: (d * 24 + h) * 0.0018 }}
                    onPointerEnter={() => setHover({ d, h })}
                    onPointerLeave={() => setHover(null)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-surface-500">
        <span className="h-4">
          {hover ? (
            <><span className="font-semibold text-surface-200">{grid[hover.d][hover.h].toLocaleString()}</span> {label} · {DAYS[hover.d]} {String(hover.h).padStart(2, '0')}:00–{String(hover.h).padStart(2, '0')}:59 UTC</>
          ) : 'Hover a cell for details · times in UTC'}
        </span>
        <span className="flex items-center gap-1">
          Less
          {[0, 2, 4, 6, 9].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: i === 0 ? 'rgb(var(--surface-800) / 0.6)' : SEQ[i] }} />)}
          More
        </span>
      </div>
    </div>
  );
}

/** Step-down funnel with conversion from the first step. */
export function Funnel({ steps }: { steps: { label: string; value: number; hint?: string }[] }) {
  const first = steps[0]?.value || 0;
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const pct = first > 0 ? (s.value / first) * 100 : 0;
        const prev = i > 0 ? steps[i - 1].value : null;
        const stepPct = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-surface-300">
                <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-800 text-[9px] font-bold text-surface-400">{i + 1}</span>
                {s.label}
              </span>
              <span className="tabular-nums text-surface-400">
                <span className="font-semibold text-white">{s.value.toLocaleString()}</span>
                {i > 0 && <span className="ml-1.5">{first > 0 ? `${Math.round(pct)}%` : '—'}</span>}
              </span>
            </div>
            <div className="h-6 overflow-hidden rounded-md bg-surface-800/60">
              <motion.div
                className="flex h-full items-center rounded-md px-2 text-[10px] font-semibold text-white/90"
                style={{ background: `linear-gradient(90deg, ${SERIES.violet}, ${SERIES.blue})` }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(first > 0 ? pct : 0, s.value > 0 ? 3 : 0)}%` }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.1 * i }}
              >
                {stepPct != null && pct > 18 && <span>{stepPct}% of previous</span>}
              </motion.div>
            </div>
            {s.hint && <p className="mt-0.5 text-[10px] text-surface-600">{s.hint}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/** Single ratio meter, e.g. stickiness or Pro rate. */
export function Meter({ value, max = 100, color = SERIES.aqua }: { value: number; max?: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: EASE }} />
    </div>
  );
}

/** Legend row for multi-series charts. */
export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[11px] text-surface-400">
          {it.dashed
            ? <span className="w-4 border-t-2 border-dashed" style={{ borderColor: GHOST }} />
            : <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />}
          {it.label}
        </span>
      ))}
    </div>
  );
}
