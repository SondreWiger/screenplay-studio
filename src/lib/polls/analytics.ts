/**
 * Poll analytics shared by the poll modal (what it reports), the admin
 * results route (what it computes) and the admin page (what it shows).
 * See supabase/migrations/20261020160000_poll_analytics.sql.
 */

export const POLL_SOURCES = ['popup', 'link', 'notification', 'email'] as const;
export type PollSource = (typeof POLL_SOURCES)[number];

export function cleanPollSource(s: unknown): PollSource | null {
  return typeof s === 'string' && (POLL_SOURCES as readonly string[]).includes(s) ? (s as PollSource) : null;
}

// Longest a single question / whole poll can count, so a forgotten tab doesn't skew averages
export const MAX_QUESTION_MS = 15 * 60 * 1000;
export const MAX_POLL_MS = 2 * 60 * 60 * 1000;

export interface PersonInfo {
  user_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
}

export interface RespondentAnswer {
  text: string | null;
  list: string[] | null;
  time_ms: number | null;
}

export interface Respondent extends PersonInfo {
  response_id: string;
  completed_at: string;
  started_at: string | null;
  duration_ms: number | null;
  source: string | null;
  resumed: boolean;
  /** question_id → answer */
  answers: Record<string, RespondentAnswer>;
}

/** Someone who saw the poll but hasn't finished it. */
export interface Dropout extends PersonInfo {
  first_shown_at: string;
  last_seen_at: string;
  max_step: number;
  view_count: number;
  dismiss_count: number;
  active_ms: number;
  source: string | null;
}

export interface QuestionTiming {
  question_id: string;
  answered: number;
  skipped: number;
  avg_ms: number | null;
  median_ms: number | null;
}

export interface PollAnalytics {
  /** Tracking only exists from the analytics migration on; older responses have no timings */
  tracked_since: string | null;
  views: number;
  started: number;
  completed: number;
  dismissed: number;
  median_ms: number | null;
  avg_ms: number | null;
  p90_ms: number | null;
  timed_responses: number;
  by_source: { label: string; count: number }[];
  /** How many people stopped on each step (0 = intro) without finishing */
  dropoff: { step: number; count: number }[];
  question_times: QuestionTiming[];
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

const mean = (v: number[]) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null);

/** "45s", "3m 20s", "1h 5m" */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function computePollAnalytics(
  questionIds: string[],
  respondents: Pick<Respondent, 'user_id' | 'duration_ms' | 'source' | 'answers'>[],
  views: Pick<Dropout, 'user_id' | 'first_shown_at' | 'max_step' | 'dismiss_count' | 'source'>[],
): PollAnalytics {
  const done = new Set(respondents.map((r) => r.user_id));
  const durations = respondents.map((r) => r.duration_ms).filter((d): d is number => d != null && d > 0);
  const unfinished = views.filter((v) => !done.has(v.user_id));

  // Everyone who answered counts as viewed and started, even from before tracking
  const viewers = new Set(views.map((v) => v.user_id).concat(Array.from(done)));
  const starters = new Set(views.filter((v) => v.max_step >= 1).map((v) => v.user_id).concat(Array.from(done)));

  const sources = new Map<string, number>();
  for (const r of respondents) {
    const k = r.source || 'unknown';
    sources.set(k, (sources.get(k) || 0) + 1);
  }

  const drop = new Map<number, number>();
  for (const v of unfinished) drop.set(v.max_step, (drop.get(v.max_step) || 0) + 1);

  const question_times = questionIds.map((qid) => {
    const times: number[] = [];
    let answered = 0;
    let skipped = 0;
    for (const r of respondents) {
      const a = r.answers[qid];
      const has = !!a && ((a.text != null && a.text.trim() !== '') || (Array.isArray(a.list) && a.list.length > 0));
      if (has) answered++; else skipped++;
      if (a?.time_ms != null && a.time_ms > 0) times.push(a.time_ms);
    }
    return { question_id: qid, answered, skipped, avg_ms: mean(times), median_ms: median(times) };
  });

  const firstShown = views.map((v) => v.first_shown_at).sort()[0] ?? null;

  return {
    tracked_since: firstShown,
    views: viewers.size,
    started: starters.size,
    completed: respondents.length,
    dismissed: views.filter((v) => v.dismiss_count > 0 && !done.has(v.user_id)).length,
    median_ms: median(durations),
    avg_ms: mean(durations),
    p90_ms: percentile(durations, 90),
    timed_responses: durations.length,
    by_source: Array.from(sources, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    dropoff: Array.from(drop, ([step, count]) => ({ step, count })).sort((a, b) => a.step - b.step),
    question_times,
  };
}

/** One row per respondent, one column per question — for the CSV download. */
export function respondentsToCSV(
  questions: { id: string; question_text: string }[],
  respondents: Respondent[],
): string {
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    // Leading =,+,-,@ would run as a formula in spreadsheet apps
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = ['Name', 'Username', 'Email', 'Completed', 'Time spent (s)', 'Source', ...questions.map((q) => q.question_text)];
  const rows = respondents.map((r) => [
    r.name, r.username, r.email, r.completed_at,
    r.duration_ms != null ? Math.round(r.duration_ms / 1000) : '',
    r.source,
    ...questions.map((q) => {
      const a = r.answers[q.id];
      if (!a) return '';
      return a.list ? a.list.join(' | ') : a.text;
    }),
  ]);
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}
