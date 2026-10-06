/**
 * Writing-goal maths for the Goals & Sprints page. Days are local calendar
 * days as YYYY-MM-DD strings (see localDay in hooks/useNovel).
 */

/** Parse YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') is UTC midnight). */
export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Words per day, summed across writers. */
export function wordsByDay(rows: { day: string; words: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.day, (m.get(r.day) || 0) + r.words);
  return m;
}

/**
 * Current streak: consecutive days with words, ending today — or yesterday,
 * so the streak isn't "broken" first thing in the morning.
 */
export function currentStreak(byDay: Map<string, number>, today: string): number {
  let day = (byDay.get(today) || 0) > 0 ? today : addDays(today, -1);
  let n = 0;
  while ((byDay.get(day) || 0) > 0) { n++; day = addDays(day, -1); }
  return n;
}

export function bestStreak(byDay: Map<string, number>): number {
  const days = Array.from(byDay.entries()).filter(([, w]) => w > 0).map(([d]) => d).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface Pace {
  remaining: number;
  daysLeft: number | null;
  /** Words a day needed to hit the deadline. */
  neededPerDay: number | null;
  /** Average over the last `window` days, counting days with no writing. */
  recentPerDay: number;
  /** Days with any writing in the window. */
  activeDays: number;
  /** When the target is reached at the recent pace — null until there are three writing days to go on. */
  projectedFinish: string | null;
}

export function pace(opts: {
  total: number; target: number; deadline?: string | null; today: string; byDay: Map<string, number>; window?: number;
}): Pace {
  const window = opts.window ?? 14;
  const remaining = Math.max(0, opts.target - opts.total);
  let recent = 0;
  let activeDays = 0;
  for (let i = 0; i < window; i++) {
    const w = opts.byDay.get(addDays(opts.today, -i)) || 0;
    recent += w;
    if (w > 0) activeDays++;
  }
  const recentPerDay = recent / window;
  // Inclusive of today: a deadline tomorrow leaves two writing days.
  const daysLeft = opts.deadline ? daysBetween(opts.today, opts.deadline) + 1 : null;
  return {
    remaining,
    daysLeft,
    neededPerDay: daysLeft !== null && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : null,
    recentPerDay,
    activeDays,
    projectedFinish: remaining === 0 ? opts.today
      : activeDays >= 3 ? addDays(opts.today, Math.ceil(remaining / recentPerDay)) : null,
  };
}
