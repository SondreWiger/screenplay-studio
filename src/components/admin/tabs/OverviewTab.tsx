'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { RANGES, compact, formatDuration, pctChange, type RangeKey } from '@/lib/admin/analytics';
import type { AnalyticsResponse, MetricKey, SeriesKey } from '@/lib/admin/analytics-types';
import { AnimatedNumber, Delta, LiveDot, Panel, Segmented, Shimmer, fadeUp, stagger, useNow } from '../motion';
import { BarList, Funnel, Heatmap, Legend, Meter, SERIES, Sparkline, TimeChart } from '../charts';

const RANGE_STORAGE_KEY = 'admin:overview:range';
const REFRESH_MS = 60_000;

interface MetricDef {
  key: MetricKey;
  label: string;
  color: string;
  /** Has a time series (count-only metrics don't). */
  series: boolean;
  format?: (n: number) => string;
  /** Lower is better. */
  invert?: boolean;
  hint?: string;
}

// Color follows the metric everywhere it appears.
const METRICS: MetricDef[] = [
  { key: 'signups', label: 'New users', color: SERIES.blue, series: true },
  { key: 'projects', label: 'New projects', color: SERIES.orange, series: true },
  { key: 'activeWriters', label: 'Active writers', color: SERIES.aqua, series: true, hint: 'Distinct users with tracked writing time' },
  { key: 'writingSeconds', label: 'Writing time', color: SERIES.violet, series: true, format: formatDuration },
  { key: 'logins', label: 'Sign-ins', color: SERIES.magenta, series: true },
  { key: 'scripts', label: 'New scripts', color: SERIES.yellow, series: true },
  { key: 'elements', label: 'Script lines', color: SERIES.blue, series: false, hint: 'Script elements created' },
  { key: 'scenes', label: 'Scenes', color: SERIES.orange, series: false },
  { key: 'characters', label: 'Characters', color: SERIES.aqua, series: false },
  { key: 'proUpgrades', label: 'Pro upgrades', color: SERIES.green, series: true },
  { key: 'communityPosts', label: 'Community posts', color: SERIES.violet, series: true },
  { key: 'communityComments', label: 'Community replies', color: SERIES.magenta, series: true },
  { key: 'scriptComments', label: 'Script comments', color: SERIES.yellow, series: true },
  { key: 'xp', label: 'XP awarded', color: SERIES.green, series: true },
  { key: 'tickets', label: 'Support tickets', color: SERIES.red, series: true, invert: true },
  { key: 'feedback', label: 'Feedback items', color: SERIES.red, series: true },
];
const metricDef = (k: MetricKey) => METRICS.find((m) => m.key === k)!;

function readStoredRange(): RangeKey {
  try {
    const v = localStorage.getItem(RANGE_STORAGE_KEY);
    if (v && RANGES.some((r) => r.key === v)) return v as RangeKey;
  } catch { /* storage unavailable */ }
  return '30d';
}

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export default function OverviewTab() {
  const [range, setRange] = useState<RangeKey>(() => (typeof window === 'undefined' ? '30d' : readStoredRange()));
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<SeriesKey>('signups');
  const [compare, setCompare] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [words, setWords] = useState<number | null>(null);
  const cacheRef = useRef(new Map<RangeKey, AnalyticsResponse>());
  const abortRef = useRef<AbortController | null>(null);
  const now = useNow(5000);

  const load = useCallback(async (key: RangeKey, fresh = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const cached = cacheRef.current.get(key);
    if (cached && !fresh) setData(cached);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${key}${fresh ? '&fresh=1' : ''}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
      const json: AnalyticsResponse = await res.json();
      cacheRef.current.set(key, json);
      setData(json);
      setError(null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      if (abortRef.current === ctrl) setPending(false);
    }
  }, []);

  useEffect(() => {
    load(range);
    try { localStorage.setItem(RANGE_STORAGE_KEY, range); } catch { /* ignore */ }
  }, [range, load]);

  // Auto-refresh while the page is visible
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(range); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [autoRefresh, range, load]);

  // Word count scans every script line — fetched once, separately, so it never blocks the dashboard.
  useEffect(() => {
    fetch('/api/admin/stats').then((r) => (r.ok ? r.json() : null)).then((j) => j && setWords(j.totalWords ?? null)).catch(() => {});
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const rangeDef = RANGES.find((r) => r.key === range)!;

  if (!data) {
    return error ? <ErrorState message={error} onRetry={() => load(range, true)} /> : <OverviewSkeleton />;
  }

  return (
    <div className="relative">
      {/* Top progress bar while a range is loading */}
      <AnimatePresence>
        {pending && (
          <motion.div
            className="fixed left-0 right-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-brand-500 via-sky-400 to-brand-500"
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 0.85, transition: { duration: 2.5, ease: 'easeOut' } }}
            exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.3 } }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Overview</h1>
          <p className="mt-1 flex items-center gap-2 text-xs text-surface-500">
            <LiveDot />
            {rangeDef.long} · updated {ago(now - Date.parse(data.generatedAt))}
            {error && <span className="text-red-400">· refresh failed</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented id="range" value={range} onChange={setRange} options={RANGES.map((r) => ({ key: r.key, label: r.label, title: r.long }))} />
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn('rounded-xl border px-3 py-2 text-xs font-semibold transition-colors', autoRefresh ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-surface-800 text-surface-400 hover:text-white')}
            title="Refresh every minute while this tab is visible"
          >
            Auto {autoRefresh ? 'on' : 'off'}
          </button>
          <button
            onClick={() => load(range, true)}
            className="rounded-xl border border-surface-800 p-2 text-surface-400 transition-colors hover:border-surface-700 hover:text-white"
            title="Refresh now"
            aria-label="Refresh now"
          >
            <motion.svg animate={{ rotate: pending ? 360 : 0 }} transition={pending ? { repeat: Infinity, duration: 0.9, ease: 'linear' } : { duration: 0 }} className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </motion.svg>
          </button>
        </div>
      </div>

      <motion.div
        key={range}
        variants={stagger}
        initial="hidden"
        animate="show"
        className={cn('space-y-5 transition-opacity duration-300', pending && 'opacity-80')}
      >
        <LiveStrip data={data} />

        {/* KPI tiles — click one to chart it */}
        <motion.div variants={stagger} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          {METRICS.map((m) => (
            <KpiTile
              key={m.key}
              def={m}
              data={data}
              selected={metric === m.key}
              onSelect={m.series ? () => setMetric(m.key as SeriesKey) : undefined}
            />
          ))}
        </motion.div>

        {/* Main chart + cumulative users */}
        <div className="grid gap-5 xl:grid-cols-3">
          <MainChart data={data} metric={metric} compare={compare} setCompare={setCompare} setMetric={setMetric} className="xl:col-span-2" />
          <Panel title="Total users" subtitle={`Cumulative, ${rangeDef.long.toLowerCase()}`}>
            <div className="mb-3 flex items-end gap-2">
              <AnimatedNumber value={data.totals.users} className="text-3xl font-bold text-white" />
              <Delta value={pctChange(data.totals.users, data.totals.users - data.kpis.signups.current)} />
            </div>
            <TimeChart
              animKey={`cum-${range}`}
              buckets={data.range.buckets}
              unit={data.range.unit}
              height={200}
              zeroBase={false}
              series={[{ key: 'users', label: 'Total users', color: SERIES.blue, values: data.cumulativeUsers }]}
            />
          </Panel>
        </div>

        {/* Funnel + heatmap */}
        <div className="grid gap-5 xl:grid-cols-5">
          <Panel title="Activation funnel" subtitle="Users who signed up in this period" className="xl:col-span-2">
            <Funnel
              steps={[
                { label: 'Signed up', value: data.funnel.signedUp },
                { label: 'Created a project', value: data.funnel.createdProject },
                { label: 'Started writing', value: data.funnel.wrote, hint: 'Has tracked writing time' },
                { label: 'Went Pro', value: data.funnel.pro },
              ]}
            />
          </Panel>
          <Panel title="When people work" subtitle="Writing sessions and sign-ins by weekday and hour" className="xl:col-span-3">
            <Heatmap grid={data.heatmap} label="sessions & sign-ins" />
          </Panel>
        </div>

        {/* Leaderboards */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Top writers" subtitle="By tracked writing time this period">
            <Leaderboard
              rows={data.leaders.writers.map((w) => ({
                id: w.id,
                href: w.username ? `/u/${w.username}` : null,
                lead: <Avatar src={w.avatar} name={w.name} size="sm" />,
                title: w.name,
                value: w.seconds,
              }))}
            />
          </Panel>
          <Panel title="Most active projects" subtitle="By tracked writing time this period">
            <Leaderboard
              rows={data.leaders.projects.map((p) => ({
                id: p.id,
                href: `/projects/${p.id}`,
                lead: <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-800 text-xs font-bold text-surface-300">{p.title.slice(0, 1).toUpperCase()}</span>,
                title: p.title,
                sub: `${p.writers} writer${p.writers === 1 ? '' : 's'}`,
                value: p.seconds,
              }))}
            />
          </Panel>
        </div>

        {/* Breakdowns */}
        <motion.div variants={stagger} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Panel title="Writing by area" subtitle="Share of writing time this period">
            <BarList items={data.breakdowns.workContexts} color={SERIES.violet} format={formatDuration} />
          </Panel>
          <Panel title="Sign-in methods" subtitle="This period">
            <BarList items={data.breakdowns.loginMethods} color={SERIES.magenta} labelFormat={(l) => l.replace(/^oauth_/, '').replace(/_/g, ' ')} />
          </Panel>
          <Panel title="Sign-ins by country" subtitle="This period">
            <BarList items={data.breakdowns.loginCountries} color={SERIES.magenta} />
          </Panel>
          <Panel title="Users by country" subtitle="All time, from profiles">
            <BarList items={data.breakdowns.countries} color={SERIES.blue} limit={10} />
          </Panel>
          <Panel title="Project types" subtitle="All time">
            <BarList items={data.breakdowns.projectTypes} color={SERIES.orange} />
          </Panel>
          <Panel title="Script types" subtitle="All time">
            <BarList items={data.breakdowns.scriptTypes} color={SERIES.yellow} />
          </Panel>
          <Panel title="XP sources" subtitle="XP awarded this period">
            <BarList items={data.breakdowns.xpEvents} color={SERIES.green} />
          </Panel>
          <Panel title="Support tickets" subtitle="Opened this period, by category">
            <BarList items={data.breakdowns.ticketCategories} color={SERIES.red} />
            {data.breakdowns.ticketStatus.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-surface-800 pt-3">
                {data.breakdowns.ticketStatus.map((s) => (
                  <span key={s.label} className="rounded-md bg-surface-800 px-2 py-0.5 text-[11px] capitalize text-surface-300">
                    {s.label.replace(/_/g, ' ')} <span className="font-semibold text-white">{s.count}</span>
                  </span>
                ))}
              </div>
            )}
            <Link href="/admin?tab=tickets" className="mt-3 inline-block text-[11px] font-semibold text-brand-400 hover:text-brand-300">
              {data.totals.openTickets} open now →
            </Link>
          </Panel>
          <Panel title="Feedback" subtitle="Submitted this period, by type">
            <BarList items={data.breakdowns.feedbackTypes} color={SERIES.red} />
            <Link href="/admin/feedback" className="mt-3 inline-block text-[11px] font-semibold text-brand-400 hover:text-brand-300">Open feedback →</Link>
          </Panel>
        </motion.div>

        <PlatformTotals data={data} words={words} />

        {data.truncated.length > 0 && (
          <p className="text-[11px] text-amber-400/80">
            Row cap reached for {data.truncated.join(', ')} — figures from these tables are lower bounds for this range.
          </p>
        )}
      </motion.div>
    </div>
  );
}

function LiveStrip({ data }: { data: AnalyticsResponse }) {
  const { live } = data;
  const stickiness = live.mau > 0 ? (live.dau / live.mau) * 100 : 0;
  const items: { label: string; value: number; hint: string; live?: boolean }[] = [
    { label: 'Online now', value: live.m5, hint: 'Seen in the last 5 minutes', live: true },
    { label: 'Last 15 min', value: live.m15, hint: 'Seen in the last 15 minutes' },
    { label: 'Last hour', value: live.h1, hint: 'Seen in the last hour' },
    { label: 'DAU', value: live.dau, hint: 'Seen in the last 24 hours' },
    { label: 'WAU', value: live.wau, hint: 'Seen in the last 7 days' },
    { label: 'MAU', value: live.mau, hint: 'Seen in the last 30 days' },
    { label: 'Active this period', value: data.activeInRange, hint: 'Seen since the start of the selected range' },
  ];
  return (
    <motion.div variants={fadeUp} className="relative overflow-hidden rounded-2xl border border-surface-800 bg-gradient-to-br from-surface-900 via-surface-900/80 to-brand-950/40 p-4">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {items.map((it) => (
          <div key={it.label} title={it.hint}>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-surface-500">
              {it.live && <LiveDot />}
              {it.label}
            </p>
            <AnimatedNumber value={it.value} className="mt-1 block text-2xl font-bold text-white" />
          </div>
        ))}
        <div title="DAU ÷ MAU — how many monthly users come back daily">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">Stickiness</p>
          <AnimatedNumber value={stickiness} format={(n) => `${n.toFixed(1)}%`} className="mt-1 block text-2xl font-bold text-white" />
          <div className="mt-1.5"><Meter value={stickiness} /></div>
        </div>
      </div>
    </motion.div>
  );
}

function KpiTile({ def, data, selected, onSelect }: { def: MetricDef; data: AnalyticsResponse; selected: boolean; onSelect?: () => void }) {
  const kpi = data.kpis[def.key];
  const values = def.series ? data.series[def.key as SeriesKey].current : null;
  const fmt = def.format ?? ((n: number) => compact(n));
  const Tag = onSelect ? motion.button : motion.div;
  return (
    <Tag
      variants={fadeUp}
      onClick={onSelect}
      whileHover={onSelect ? { y: -2 } : undefined}
      whileTap={onSelect ? { scale: 0.98 } : undefined}
      title={def.hint}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border bg-surface-900/60 p-3 text-left transition-colors',
        selected ? 'border-transparent' : 'border-surface-800',
        onSelect && !selected && 'hover:border-surface-700',
      )}
    >
      {selected && (
        <motion.span
          layoutId="kpi-selected"
          className="pointer-events-none absolute inset-0 rounded-xl ring-1"
          style={{ boxShadow: `inset 0 0 0 1px ${def.color}, 0 0 24px -8px ${def.color}` }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: def.color }} />
        <span className="truncate">{def.label}</span>
      </span>
      <AnimatedNumber value={kpi.current} format={fmt} className="mt-1.5 text-xl font-bold text-white" />
      <div className="mt-1 flex items-center gap-1.5" title={kpi.previous != null ? `Previous period: ${fmt(kpi.previous)}` : undefined}>
        <Delta value={pctChange(kpi.current, kpi.previous)} invert={def.invert} />
        {kpi.previous != null && <span className="hidden truncate text-[10px] text-surface-500 2xl:inline">vs {fmt(kpi.previous)}</span>}
      </div>
      {values && <Sparkline values={values} color={def.color} height={26} className="mt-2" />}
    </Tag>
  );
}

function MainChart({ data, metric, compare, setCompare, setMetric, className }: {
  data: AnalyticsResponse;
  metric: SeriesKey;
  compare: boolean;
  setCompare: (v: boolean) => void;
  setMetric: (k: SeriesKey) => void;
  className?: string;
}) {
  const def = metricDef(metric);
  const s = data.series[metric];
  const kpi = data.kpis[metric];
  const fmt = def.format ?? compact;
  const canCompare = s.previous != null;
  const peak = useMemo(() => {
    let best = 0;
    s.current.forEach((v, i) => { if (v > s.current[best]) best = i; });
    return { value: s.current[best] ?? 0 };
  }, [s]);
  const avg = s.current.length ? kpi.current / s.current.length : 0;

  return (
    <Panel
      className={className}
      title={
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as SeriesKey)}
          className="-ml-1 rounded-md bg-transparent px-1 text-sm font-semibold text-white outline-none hover:bg-surface-800 focus:ring-1 focus:ring-brand-500"
          aria-label="Metric"
        >
          {METRICS.filter((m) => m.series).map((m) => <option key={m.key} value={m.key} className="bg-surface-900">{m.label}</option>)}
        </select>
      }
      subtitle={def.hint}
      action={canCompare ? (
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-surface-400">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="accent-brand-500" />
          Compare to previous period
        </label>
      ) : null}
    >
      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <AnimatedNumber value={kpi.current} format={fmt} className="text-3xl font-bold text-white" />
          <span className="ml-2 align-middle"><Delta value={pctChange(kpi.current, kpi.previous)} invert={def.invert} /></span>
        </div>
        <Stat label="Previous period" value={kpi.previous != null ? fmt(kpi.previous) : '—'} />
        <Stat label="Avg / bucket" value={fmt(avg)} />
        <Stat label="Peak bucket" value={fmt(peak.value)} />
        <div className="ml-auto">
          <Legend items={[{ label: 'This period', color: def.color }, ...(compare && canCompare ? [{ label: 'Previous period', color: '', dashed: true }] : [])]} />
        </div>
      </div>
      <TimeChart
        animKey={`${data.range.key}-${metric}`}
        buckets={data.range.buckets}
        unit={data.range.unit}
        format={fmt}
        height={280}
        series={[
          ...(compare && s.previous ? [{ key: 'prev', label: 'Previous period', color: '', values: s.previous, ghost: true }] : []),
          { key: 'cur', label: def.label, color: def.color, values: s.current },
        ]}
      />
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-surface-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-surface-200">{value}</p>
    </div>
  );
}

function Leaderboard({ rows }: { rows: { id: string; href: string | null; lead: ReactNode; title: string; sub?: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-xs text-surface-500">No tracked writing time in this period</p>;
  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <motion.li key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
          <MaybeLink href={r.href} className="group relative flex items-center gap-3 overflow-hidden rounded-lg px-2 py-1.5 hover:bg-surface-800/50">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-lg bg-brand-500/[0.07]"
              initial={{ width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.05 * i }}
            />
            <span className="relative w-4 text-right text-[11px] font-bold tabular-nums text-surface-500">{i + 1}</span>
            <span className="relative">{r.lead}</span>
            <span className="relative min-w-0 flex-1">
              <span className="block truncate text-sm text-surface-100 group-hover:text-white">{r.title}</span>
              {r.sub && <span className="block text-[11px] text-surface-500">{r.sub}</span>}
            </span>
            <span className="relative text-xs font-semibold tabular-nums text-surface-300">{formatDuration(r.value)}</span>
          </MaybeLink>
        </motion.li>
      ))}
    </ol>
  );
}

function MaybeLink({ href, className, children }: { href: string | null; className?: string; children: ReactNode }) {
  return href ? <Link href={href} className={className}>{children}</Link> : <div className={className}>{children}</div>;
}

function PlatformTotals({ data, words }: { data: AnalyticsResponse; words: number | null }) {
  const t = data.totals;
  const groups: { title: string; items: { label: string; value: number | null; fmt?: (n: number) => string }[] }[] = [
    {
      title: 'People',
      items: [
        { label: 'Users', value: t.users },
        { label: 'Pro users', value: t.pro },
        { label: 'Pro rate', value: t.users ? (t.pro / t.users) * 100 : 0, fmt: (n) => `${n.toFixed(1)}%` },
        { label: 'Project members', value: t.members },
        { label: 'Avg members / project', value: t.projects ? t.members / t.projects : 0, fmt: (n) => n.toFixed(2) },
        { label: 'Push subscriptions', value: t.pushSubscriptions },
        { label: 'Contributors', value: t.contributors },
        { label: 'Badges awarded', value: t.badgesAwarded },
      ],
    },
    {
      title: 'Writing',
      items: [
        { label: 'Projects', value: t.projects },
        { label: 'Projects / user', value: t.users ? t.projects / t.users : 0, fmt: (n) => n.toFixed(2) },
        { label: 'Scripts', value: t.scripts },
        { label: 'Script lines', value: t.elements },
        { label: 'Words written', value: words },
        { label: 'Words / script', value: words != null && t.scripts ? words / t.scripts : null },
        { label: 'Characters', value: t.characters },
        { label: 'Locations', value: t.locations },
      ],
    },
    {
      title: 'Production & community',
      items: [
        { label: 'Scenes', value: t.scenes },
        { label: 'Shots', value: t.shots },
        { label: 'Ideas', value: t.ideas },
        { label: 'Idea boards', value: t.ideaBoards },
        { label: 'Mind map nodes', value: t.mindmapNodes },
        { label: 'Budget items', value: t.budgetItems },
        { label: 'Schedule events', value: t.scheduleEvents },
        { label: 'Script comments', value: t.scriptComments },
        { label: 'Community posts', value: t.communityPosts },
        { label: 'Blog posts', value: t.blogPosts },
        { label: 'Course enrollments', value: t.enrollments },
        { label: 'Tickets (all time)', value: t.tickets },
      ],
    },
  ];
  return (
    <Panel title="Platform totals" subtitle="All time">
      <div className="grid gap-6 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">{g.title}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {g.items.map((it) => (
                <div key={it.label} className="min-w-0">
                  <dt className="truncate text-[11px] text-surface-500">{it.label}</dt>
                  <dd className="text-base font-semibold text-white">
                    {it.value == null ? <Shimmer className="mt-1 h-4 w-14" /> : <AnimatedNumber value={it.value} format={it.fmt ?? compact} />}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading analytics">
      <div className="flex items-end justify-between">
        <div className="space-y-2"><Shimmer className="h-7 w-40" /><Shimmer className="h-3 w-56" /></div>
        <Shimmer className="h-9 w-80 rounded-xl" />
      </div>
      <Shimmer className="h-24 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 16 }).map((_, i) => <Shimmer key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Shimmer className="h-[380px] rounded-2xl xl:col-span-2" />
        <Shimmer className="h-[380px] rounded-2xl" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 py-16 text-center">
      <p className="text-sm font-semibold text-red-300">Couldn’t load analytics</p>
      <p className="mt-1 text-xs text-surface-500">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-surface-700">Try again</button>
    </div>
  );
}
