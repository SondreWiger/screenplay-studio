/**
 * Time-range and bucketing helpers for the admin analytics dashboard.
 * Pure functions — shared by the API route and the client, and unit-tested.
 * All alignment is done in UTC so server and client agree on bucket edges.
 */

export type RangeKey = '1h' | '24h' | '7d' | '30d' | '90d' | '6m' | '1y' | 'all';
export type BucketUnit = '5m' | 'hour' | '6h' | 'day' | 'week' | 'month';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const RANGES: { key: RangeKey; label: string; long: string; ms: number | null; unit: BucketUnit }[] = [
  { key: '1h', label: '1H', long: 'Last hour', ms: HOUR, unit: '5m' },
  { key: '24h', label: '24H', long: 'Last 24 hours', ms: DAY, unit: 'hour' },
  { key: '7d', label: '7D', long: 'Last 7 days', ms: 7 * DAY, unit: '6h' },
  { key: '30d', label: '30D', long: 'Last 30 days', ms: 30 * DAY, unit: 'day' },
  { key: '90d', label: '90D', long: 'Last 90 days', ms: 90 * DAY, unit: 'day' },
  { key: '6m', label: '6M', long: 'Last 6 months', ms: 182 * DAY, unit: 'week' },
  { key: '1y', label: '1Y', long: 'Last 12 months', ms: 365 * DAY, unit: 'week' },
  { key: 'all', label: 'All', long: 'All time', ms: null, unit: 'month' },
];

export function isRangeKey(v: unknown): v is RangeKey {
  return typeof v === 'string' && RANGES.some((r) => r.key === v);
}

/** Round a timestamp down to the start of its bucket (UTC; weeks start Monday). */
export function floorTo(ms: number, unit: BucketUnit): number {
  const d = new Date(ms);
  switch (unit) {
    case '5m': return ms - (ms % (5 * MIN));
    case 'hour': return ms - (ms % HOUR);
    case '6h': return ms - (ms % (6 * HOUR));
    case 'day': return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    case 'week': {
      const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
      return day - dow * DAY;
    }
    case 'month': return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
}

export function addUnit(ms: number, unit: BucketUnit, n = 1): number {
  switch (unit) {
    case '5m': return ms + n * 5 * MIN;
    case 'hour': return ms + n * HOUR;
    case '6h': return ms + n * 6 * HOUR;
    case 'day': return ms + n * DAY;
    case 'week': return ms + n * 7 * DAY;
    case 'month': {
      const d = new Date(ms);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
    }
  }
}

export interface ResolvedRange {
  key: RangeKey;
  unit: BucketUnit;
  /** Inclusive window start (ms). */
  start: number;
  /** Window end (ms) — "now". */
  end: number;
  /** Start of the equally long window before `start`, or null for all-time. */
  prevStart: number | null;
  /** Bucket start times covering [start, end]. */
  buckets: number[];
}

/**
 * Resolve a range key into concrete window bounds and bucket edges.
 * `earliest` is the oldest data point; it anchors the all-time range.
 */
export function resolveRange(key: RangeKey, now: number, earliest?: number | null): ResolvedRange {
  const def = RANGES.find((r) => r.key === key) ?? RANGES[3];
  const unit = def.unit;
  let start: number;
  let prevStart: number | null;
  if (def.ms == null) {
    // All time: start at the first month with data (at least 6 months back so the chart has shape)
    const fallback = addUnit(floorTo(now, 'month'), 'month', -5);
    start = floorTo(Math.min(earliest ?? fallback, fallback), 'month');
    prevStart = null;
  } else {
    start = now - def.ms;
    prevStart = start - def.ms;
  }
  const buckets: number[] = [];
  for (let b = floorTo(start, unit); b <= now; b = addUnit(b, unit)) buckets.push(b);
  return { key: def.key, unit, start, end: now, prevStart, buckets };
}

/** Index of the bucket containing `t`, or -1 if outside the bucket span. */
export function bucketIndex(buckets: number[], t: number): number {
  if (!buckets.length || t < buckets[0]) return -1;
  // Binary search for the last bucket start <= t
  let lo = 0;
  let hi = buckets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (buckets[mid] <= t) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** Count (or sum `value`) per bucket. Rows outside the span are ignored. */
export function bucketize<T>(rows: T[], buckets: number[], time: (r: T) => string | number | null | undefined, value?: (r: T) => number): number[] {
  const out = new Array(buckets.length).fill(0);
  for (const r of rows) {
    const raw = time(r);
    if (raw == null) continue;
    const t = typeof raw === 'number' ? raw : Date.parse(raw);
    if (Number.isNaN(t)) continue;
    const i = bucketIndex(buckets, t);
    if (i >= 0) out[i] += value ? value(r) : 1;
  }
  return out;
}

/**
 * Same series for the previous window, aligned bucket-for-bucket with the
 * current one (shifted by the window length), so the two can be overlaid.
 */
export function bucketizePrevious<T>(rows: T[], range: ResolvedRange, time: (r: T) => string | number | null | undefined, value?: (r: T) => number): number[] | null {
  if (range.prevStart == null) return null;
  const shift = range.start - range.prevStart;
  return bucketize(rows, range.buckets, (r) => {
    const raw = time(r);
    if (raw == null) return null;
    const t = typeof raw === 'number' ? raw : Date.parse(raw);
    // Only rows inside the previous window, moved forward one window length
    return t >= range.prevStart! && t < range.start ? t + shift : null;
  }, value);
}

/** Percent change, rounded to 1 decimal. null when there's no baseline. */
export function pctChange(current: number, previous: number | null | undefined): number | null {
  if (previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Group rows by a key and count, sorted descending, with the tail folded into "Other". */
export function countBy<T>(rows: T[], key: (r: T) => string | null | undefined, limit = 8, value?: (r: T) => number): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = (key(r) || '').trim() || 'Unknown';
    map.set(k, (map.get(k) || 0) + (value ? value(r) : 1));
  }
  const sorted = Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit - 1);
  const other = sorted.slice(limit - 1).reduce((s, x) => s + x.count, 0);
  return [...head, { label: 'Other', count: other }];
}

/** 7×24 grid (Mon..Sun × hour UTC) of event counts. */
export function weekdayHourGrid(times: (string | number)[]): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const raw of times) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    grid[(d.getUTCDay() + 6) % 7][d.getUTCHours()] += 1;
  }
  return grid;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Short axis label for a bucket start. */
export function bucketLabel(ms: number, unit: BucketUnit): string {
  const d = new Date(ms);
  switch (unit) {
    case '5m':
    case 'hour': return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    case '6h': return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${pad(d.getUTCHours())}h`;
    case 'day':
    case 'week': return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
    case 'month': return `${MONTHS[d.getUTCMonth()]} ’${String(d.getUTCFullYear()).slice(2)}`;
  }
}

/** Longer tooltip label describing a whole bucket. */
export function bucketTitle(ms: number, unit: BucketUnit): string {
  const d = new Date(ms);
  const date = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  switch (unit) {
    case '5m':
    case 'hour':
    case '6h': return `${date} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
    case 'day': return date;
    case 'week': return `Week of ${date}`;
    case 'month': return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
}

/** Compact number: 1234 → 1.2K. */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
  return Math.round(n).toLocaleString('en-US');
}

/** Seconds → "3h 12m" / "45m" / "12s". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 100) return `${h}h ${m % 60}m`;
  return `${compact(h)}h`;
}
