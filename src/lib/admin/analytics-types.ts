import type { BucketUnit, RangeKey } from './analytics';

/** Metrics that have a time series (current window, plus previous window for comparison). */
export type SeriesKey =
  | 'signups' | 'projects' | 'scripts' | 'logins' | 'activeWriters' | 'writingSeconds'
  | 'communityPosts' | 'communityComments' | 'scriptComments' | 'tickets' | 'feedback' | 'xp' | 'proUpgrades';

/** Metrics with a period total — every series plus a few count-only tables. */
export type MetricKey = SeriesKey | 'elements' | 'scenes' | 'characters';

export interface Breakdown { label: string; count: number }

export interface AnalyticsResponse {
  range: { key: RangeKey; unit: BucketUnit; start: number; end: number; prevStart: number | null; buckets: number[] };
  generatedAt: string;
  live: { m5: number; m15: number; h1: number; dau: number; wau: number; mau: number };
  /** Users seen at least once inside the window. */
  activeInRange: number;
  totals: Record<string, number>;
  kpis: Record<MetricKey, { current: number; previous: number | null }>;
  series: Record<SeriesKey, { current: number[]; previous: number[] | null }>;
  cumulativeUsers: number[];
  funnel: { signedUp: number; createdProject: number; wrote: number; pro: number };
  /** Mon..Sun × 24 UTC hours. */
  heatmap: number[][];
  breakdowns: Record<
    'countries' | 'projectTypes' | 'scriptTypes' | 'formats' | 'loginMethods' | 'loginCountries'
    | 'workContexts' | 'ticketCategories' | 'ticketStatus' | 'feedbackTypes' | 'xpEvents',
    Breakdown[]
  >;
  leaders: {
    writers: { id: string; username: string | null; name: string; avatar: string | null; seconds: number }[];
    projects: { id: string; title: string; seconds: number; writers: number }[];
  };
  /** Tables whose scan hit the row cap — their numbers are lower bounds. */
  truncated: string[];
}
