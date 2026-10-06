/**
 * Engagement scoring: who is actually using Screenplay Studio for real work,
 * who is only trying it out, and who has gone quiet.
 *
 * The signals are hard to fake by clicking around:
 * - work time comes from the editor's 30-second heartbeats (`work_sessions`),
 *   which only count while someone is working in a project and skip idle time;
 * - an "active day" needs at least ACTIVE_DAY_SECONDS of that work time;
 * - content edits are rows the person created or edited (script elements,
 *   scenes, characters, shots, ideas, documents).
 *
 * Thresholds are written per 30 days and scale with the window.
 */

export type EngagementTier = 'committed' | 'active' | 'trying' | 'dormant' | 'never';

export interface EngagementInput {
  /** Work seconds per UTC date (YYYY-MM-DD) inside the window. */
  workByDay: Record<string, number>;
  /** Distinct projects with work time inside the window. */
  projects: number;
  /** Content rows created or edited inside the window. */
  contentEdits: number;
  /** Work seconds in the lookback period before the window. */
  priorWorkSeconds: number;
  /** Content edits in the lookback period before the window. */
  priorContentEdits: number;
  /** Most recent work, edit or visit (ISO), if any. */
  lastActiveAt: string | null;
}

export interface EngagementResult {
  tier: EngagementTier;
  /** 0–100, comparable across people in the same window. */
  score: number;
  activeDays: number;
  activeWeeks: number;
  workHours: number;
  contentEdits: number;
  projects: number;
  daysSinceActive: number | null;
}

/** A day counts as active with at least this much verified work time. */
export const ACTIVE_DAY_SECONDS = 5 * 60;

/** Per-30-day thresholds for each tier. */
export const TIER_RULES = {
  committed: { days: 8, hours: 6, weeks: 3, edits: 50 },
  active: { days: 3, hours: 1, weeks: 2, edits: 10 },
  /** Dormant: did at least this much before the window, nothing in it. */
  dormant: { hours: 1, edits: 10 },
} as const;

export const TIER_META: Record<EngagementTier, { label: string; description: string }> = {
  committed: { label: 'Committed', description: 'Works most weeks, for hours, and writes real material.' },
  active: { label: 'Active', description: 'Comes back on several days across weeks and produces work.' },
  trying: { label: 'Trying out', description: 'Some activity in the window, but short, one-off or with little output.' },
  dormant: { label: 'Dormant', description: 'Did real work before, nothing in this window.' },
  never: { label: 'Never started', description: 'Signed up but has not done any real work yet.' },
};

const DAY = 86_400_000;

/** Index of the Monday-to-Sunday week a UTC date falls in (only compared, never shown). */
function weekIndex(date: string): number {
  // 1970-01-05 was a Monday
  return Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.UTC(1970, 0, 5)) / (7 * DAY));
}

/** Scale a per-30-day threshold to the window, never below 1. */
function scaled(perThirty: number, windowDays: number) {
  return Math.max(1, Math.ceil(perThirty * (windowDays / 30)));
}

export function scoreEngagement(input: EngagementInput, windowDays = 30, now: Date = new Date()): EngagementResult {
  const activeDates = Object.entries(input.workByDay).filter(([, s]) => s >= ACTIVE_DAY_SECONDS).map(([d]) => d);
  const activeDays = activeDates.length;
  const activeWeeks = new Set(activeDates.map(weekIndex)).size;
  const workSeconds = Object.values(input.workByDay).reduce((a, b) => a + b, 0);
  const workHours = workSeconds / 3600;
  const edits = input.contentEdits;
  const daysSinceActive = input.lastActiveAt ? Math.max(0, Math.floor((now.getTime() - Date.parse(input.lastActiveAt)) / DAY)) : null;

  const meets = (r: { days: number; hours: number; weeks: number; edits: number }) =>
    activeDays >= scaled(r.days, windowDays)
    && workHours >= r.hours * (windowDays / 30)
    // Weeks can't exceed what fits in the window
    && activeWeeks >= Math.min(scaled(r.weeks, windowDays), Math.ceil(windowDays / 7))
    && edits >= scaled(r.edits, windowDays);

  let tier: EngagementTier;
  if (meets(TIER_RULES.committed)) tier = 'committed';
  else if (meets(TIER_RULES.active)) tier = 'active';
  else if (workSeconds > 0 || edits > 0) tier = 'trying';
  else if (input.priorWorkSeconds >= TIER_RULES.dormant.hours * 3600 || input.priorContentEdits >= TIER_RULES.dormant.edits) tier = 'dormant';
  else tier = 'never';

  // Score: consistency matters most, then time, then output, then recency.
  const factor = windowDays / 30;
  const consistency = Math.min(activeDays / Math.max(1, windowDays * 0.4), 1) * 35;
  const time = Math.min(Math.log1p(workHours) / Math.log1p(20 * factor), 1) * 30;
  const output = Math.min(Math.log1p(edits) / Math.log1p(500 * factor), 1) * 20;
  const recency = daysSinceActive === null ? 0
    : daysSinceActive <= 2 ? 15
    : daysSinceActive <= 7 ? 10
    : daysSinceActive <= 14 ? 5
    : 0;
  // Visits alone (no work, no edits) don't earn recency points
  const score = Math.round(consistency + time + output + (workSeconds > 0 || edits > 0 ? recency : 0));

  return {
    tier,
    score,
    activeDays,
    activeWeeks,
    workHours: Math.round(workHours * 10) / 10,
    contentEdits: edits,
    projects: input.projects,
    daysSinceActive,
  };
}
