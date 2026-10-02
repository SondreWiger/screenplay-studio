'use client';

/**
 * Shared building blocks for every admin page, so sub-pages look and move like
 * the Overview: an animated page shell, header, stat tiles, trend panel,
 * toolbar, search, pills and empty states.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RANGES, bucketize, bucketizePrevious, compact, pctChange, resolveRange, type RangeKey } from '@/lib/admin/analytics';
import { AnimatedNumber, Delta, Panel, Segmented, fadeUp, stagger } from './motion';
import { Legend, SERIES, Sparkline, TimeChart, type ChartSeries } from './charts';

export { Panel, Segmented, AnimatedNumber, Delta, LiveDot, Shimmer, TabSkeleton } from './motion';
export { BarList, Heatmap, Meter, Funnel, Legend, Sparkline, TimeChart, SERIES } from './charts';

/** Page shell: children with `variants={fadeUp}` (Panel, StatGrid, …) cascade in. */
export function AdminPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className={cn('space-y-5', className)}>
      {children}
    </motion.div>
  );
}

/** Animated wrapper for arbitrary content inside an AdminPage. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div variants={fadeUp} className={className}>{children}</motion.div>;
}

export function PageHeader({ title, description, icon, actions, back, meta }: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  /** Optional element shown above the title (e.g. a back link). */
  back?: ReactNode;
  /** Small line under the description (e.g. "updated 2m ago"). */
  meta?: ReactNode;
}) {
  return (
    <motion.header variants={fadeUp} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {back && <div className="mb-2">{back}</div>}
        <div className="flex items-center gap-3">
          {icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-surface-800 bg-gradient-to-br from-surface-800/80 to-surface-900 text-brand-400 shadow-inner">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-white">{title}</h1>
            {description && <p className="mt-0.5 text-sm text-surface-400">{description}</p>}
          </div>
        </div>
        {meta && <div className="mt-2 flex items-center gap-2 text-xs text-surface-500">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

export type Tone = 'neutral' | 'brand' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'pink' | 'aqua';

const TONE_DOT: Record<Tone, string> = {
  neutral: 'rgb(var(--surface-500))',
  brand: 'rgb(var(--brand-500))',
  blue: SERIES.blue,
  green: '#22c55e',
  amber: '#f59e0b',
  red: SERIES.red,
  violet: SERIES.violet,
  pink: SERIES.magenta,
  aqua: SERIES.aqua,
};

const TONE_PILL: Record<Tone, string> = {
  neutral: 'bg-surface-800 text-surface-300 border-surface-700',
  brand: 'bg-brand-500/10 text-brand-300 border-brand-500/25',
  blue: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  red: 'bg-red-500/10 text-red-300 border-red-500/25',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
  pink: 'bg-pink-500/10 text-pink-300 border-pink-500/25',
  aqua: 'bg-teal-500/10 text-teal-300 border-teal-500/25',
};

/** Status / category pill. Always carries a text label, never color alone. */
export function Pill({ tone = 'neutral', children, dot = false, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold capitalize', TONE_PILL[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE_DOT[tone] }} />}
      {children}
    </span>
  );
}

export interface StatItem {
  label: string;
  value: number;
  format?: (n: number) => string;
  hint?: string;
  tone?: Tone;
  /** % change vs. previous period. */
  delta?: number | null;
  invertDelta?: boolean;
  spark?: number[];
  /** Makes the tile a filter button. */
  onClick?: () => void;
  active?: boolean;
}

export function StatTile({ item, layoutGroup }: { item: StatItem; layoutGroup?: string }) {
  const Tag = item.onClick ? motion.button : motion.div;
  const color = TONE_DOT[item.tone ?? 'neutral'];
  return (
    <Tag
      variants={fadeUp}
      onClick={item.onClick}
      whileHover={item.onClick ? { y: -2 } : undefined}
      whileTap={item.onClick ? { scale: 0.98 } : undefined}
      title={item.hint}
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface-900/60 p-3.5 text-left transition-colors',
        item.active ? 'border-transparent' : 'border-surface-800',
        item.onClick && !item.active && 'hover:border-surface-700',
      )}
    >
      {item.active && (
        <motion.span
          layoutId={layoutGroup ? `stat-active-${layoutGroup}` : undefined}
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ boxShadow: `inset 0 0 0 1px ${color}, 0 0 24px -10px ${color}` }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate">{item.label}</span>
      </span>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <AnimatedNumber value={item.value} format={item.format ?? compact} className="text-2xl font-bold text-white" />
        {item.delta !== undefined && <Delta value={item.delta} invert={item.invertDelta} />}
      </div>
      {item.spark && item.spark.length > 1 && <Sparkline values={item.spark} color={color} height={24} className="mt-2" />}
    </Tag>
  );
}

export function StatGrid({ items, cols = 4, layoutGroup }: { items: StatItem[]; cols?: 2 | 3 | 4 | 5 | 6; layoutGroup?: string }) {
  const grid = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6',
  }[cols];
  return (
    <motion.div variants={stagger} className={cn('grid gap-3', grid)}>
      {items.map((it) => <StatTile key={it.label} item={it} layoutGroup={layoutGroup} />)}
    </motion.div>
  );
}

/** Ranges offered by client-side trend panels (data already loaded in the browser). */
const TREND_RANGES: RangeKey[] = ['7d', '30d', '90d', '1y'];

export interface TrendSource<T> {
  key: string;
  label: string;
  color?: string;
  rows: T[];
  time: (r: T) => string | null | undefined;
}

/**
 * Activity-over-time panel computed from rows already loaded on the page.
 * Several sources share one axis; compare-to-previous when there's one source.
 */
export function TrendPanel({ title, subtitle, sources, defaultRange = '30d', id, className, action, stacked = false }: {
  title: ReactNode;
  /** Sources are parts of one whole (e.g. by type) — stack their columns. */
  stacked?: boolean;
  subtitle?: ReactNode;
  // Each source may hold a different row type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sources: TrendSource<any>[];
  defaultRange?: RangeKey;
  id: string;
  className?: string;
  action?: ReactNode;
}) {
  const [range, setRange] = useState<RangeKey>(defaultRange);
  const r = useMemo(() => resolveRange(range, Date.now()), [range]);
  const series = useMemo(() => sources.map((s, i) => ({
    key: s.key,
    label: s.label,
    color: s.color ?? [SERIES.blue, SERIES.orange, SERIES.aqua, SERIES.violet][i % 4],
    values: bucketize(s.rows, r.buckets, s.time),
    previous: bucketizePrevious(s.rows, r, s.time),
  })), [sources, r]);
  // Headline: parts of a whole add up; independent comparisons show the first series only
  const headline = stacked || series.length === 1 ? series : series.slice(0, 1);
  const total = headline.reduce((sum, s) => sum + s.values.reduce((a, b) => a + b, 0), 0);
  const prevTotal = headline.reduce((sum, s) => sum + (s.previous?.reduce((a, b) => a + b, 0) ?? 0), 0);
  const single = series.length === 1;
  // Low-volume data reads better as columns than as a smoothed area (and without the comparison overlay)
  const nonZero = series.reduce((n, s) => n + s.values.filter((v) => v > 0).length, 0);
  const sparse = nonZero < r.buckets.length * series.length * 0.5;
  const showPrev = single && !sparse && !!series[0].previous;
  const chart: ChartSeries[] = single
    ? [
        ...(showPrev ? [{ key: 'prev', label: 'Previous period', color: '', values: series[0].previous!, ghost: true }] : []),
        { key: series[0].key, label: series[0].label, color: series[0].color, values: series[0].values },
      ]
    : series.map((s) => ({ key: s.key, label: s.label, color: s.color, values: s.values }));

  return (
    <Panel
      className={className}
      title={title}
      subtitle={subtitle}
      action={
        <div className="flex items-center gap-2">
          {action}
          <Segmented
            id={`trend-${id}`}
            size="sm"
            value={range}
            onChange={setRange}
            options={TREND_RANGES.map((k) => ({ key: k, label: RANGES.find((x) => x.key === k)!.label }))}
          />
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <AnimatedNumber value={total} className="text-2xl font-bold text-white" />
          <Delta value={pctChange(total, prevTotal)} />
          <span className="pb-0.5 text-[11px] text-surface-500">
            {headline.length === 1 && series.length > 1 ? `${headline[0].label.toLowerCase()}, ` : ''}{RANGES.find((x) => x.key === range)!.long.toLowerCase()}
          </span>
        </div>
        <Legend
          items={single
            ? [{ label: series[0].label, color: series[0].color }, ...(showPrev ? [{ label: 'Previous period', color: '', dashed: true }] : [])]
            : series.map((s) => ({ label: s.label, color: s.color }))}
        />
      </div>
      <TimeChart animKey={`${id}-${range}`} buckets={r.buckets} unit={r.unit} height={200} series={chart} bars={sparse} stacked={stacked} />
    </Panel>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUp} className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      {children}
    </motion.div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-surface-800 bg-surface-900/60 px-3 py-2 text-surface-500 transition-colors focus-within:border-brand-500/50', className)}>
      <Search className="h-4 w-4 shrink-0" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-surface-600 focus:outline-none"
      />
      {value && (
        <button onClick={() => onChange('')} className="rounded p-0.5 hover:text-white" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-800 px-6 py-14 text-center"
    >
      {icon && <div className="mb-3 text-surface-600">{icon}</div>}
      <p className="text-sm font-semibold text-surface-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-surface-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

/** Animated list: items fade/slide in and animate out when removed. */
export function AnimatedList({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.ul variants={stagger} initial="hidden" animate="show" className={className}>{children}</motion.ul>;
}

export function AnimatedItem({ children, className, onClick, layout = true }: { children: ReactNode; className?: string; onClick?: () => void; layout?: boolean }) {
  return (
    <motion.li
      layout={layout ? 'position' : undefined}
      variants={fadeUp}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.li>
  );
}

/** Styled button matching the admin chrome. */
export function ActionButton({ children, onClick, variant = 'secondary', disabled, icon, title, type = 'button', className }: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
  icon?: ReactNode;
  title?: string;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles = {
    primary: 'border-brand-500/40 bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-600/20',
    secondary: 'border-surface-800 bg-surface-900/60 text-surface-200 hover:border-surface-700 hover:text-white',
    ghost: 'border-transparent text-surface-400 hover:bg-surface-800/50 hover:text-white',
    danger: 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
  }[variant];
  return (
    <motion.button
      type={type}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        styles,
        className,
      )}
    >
      {icon}
      {children}
    </motion.button>
  );
}

/** Spinner-free inline loading for buttons. */
export function Dots() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="h-1 w-1 rounded-full bg-current" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}

/** Count rows by key (string), sorted desc — handy for BarList. */
export function tally<T>(rows: T[], key: (r: T) => string | null | undefined): { label: string; count: number }[] {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const k = key(r) || 'Unknown';
    m.set(k, (m.get(k) || 0) + 1);
  });
  return Array.from(m.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/** Count of rows created within the last `days`, and the window before it. */
export function windowCounts<T>(rows: T[], time: (r: T) => string | null | undefined, days = 7) {
  const now = Date.now();
  const span = days * 86_400_000;
  let cur = 0;
  let prev = 0;
  rows.forEach((r) => {
    const raw = time(r);
    if (!raw) return;
    const t = Date.parse(raw);
    if (t >= now - span) cur++;
    else if (t >= now - 2 * span) prev++;
  });
  return { current: cur, previous: prev, delta: pctChange(cur, prev) };
}

/** Daily counts for the last `days` days — sparkline input. */
export function dailySpark<T>(rows: T[], time: (r: T) => string | null | undefined, days = 14): number[] {
  const r = resolveRange(days > 30 ? '90d' : '30d', Date.now()); // daily buckets
  return bucketize(rows, r.buckets, time).slice(-days);
}

/** Animated modal dialog. Closes on backdrop click and Escape. */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const width = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={cn('relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-surface-800 bg-surface-900 shadow-2xl', width)}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-surface-800 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">{title}</h2>
                {description && <p className="mt-0.5 text-xs text-surface-500">{description}</p>}
              </div>
              <button onClick={onClose} className="rounded-lg p-1 text-surface-500 hover:bg-surface-800 hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-surface-800 px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export const fieldClass = 'w-full rounded-xl border border-surface-800 bg-surface-950/60 px-3 py-2 text-sm text-white placeholder:text-surface-600 focus:border-brand-500/50 focus:outline-none';

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-surface-500">
        {label} {hint && <span className="font-normal normal-case tracking-normal text-surface-600">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
