// ============================================================
// Screenplay Studio — Gamification Constants & Helpers
// ============================================================

import type { XPEventType } from './types';

// ── XP per event ─────────────────────────────────────────────
export const XP_VALUES: Record<XPEventType, number> = {
  words_written:               1,   // per 10 words
  community_post:             25,
  community_comment:           5,
  community_like_received:     2,
  community_challenge_submit: 50,
  project_created:            10,
  daily_login:                 5,
  login_streak_bonus:         15,   // bonus after 7-day streak
  profile_complete:           20,
  lesson_complete:            15,   // per lesson
  course_complete:           100,   // bonus on course finish
  quiz_perfect_score:         25,   // bonus for 100% quiz
  poll_complete:             100,   // filled in a platform poll
};

// ── Time multiplier ───────────────────────────────────────────
// Based on continuous uninterrupted work session duration (hours)
// 1 hr = 2x, 2 hrs = 4x, 3 hrs = 8x  →  2^hours (capped at 16x)
export const SESSION_INACTIVITY_MS = 30 * 60 * 1000; // 30 min idle = session reset
export const SESSION_MAX_MULTIPLIER = 16;
export const SESSION_STORAGE_KEY = 'ss_session_start';
export const SESSION_LAST_ACTIVE_KEY = 'ss_session_last_active';

/** Returns the current time-based XP multiplier (1x to 16x). */
export function getSessionMultiplier(): number {
  if (typeof window === 'undefined') return 1;
  const startRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  const lastRaw  = sessionStorage.getItem(SESSION_LAST_ACTIVE_KEY);
  if (!startRaw) return 1;

  const now = Date.now();

  // Reset if inactive for > 30 min
  if (lastRaw && (now - parseInt(lastRaw)) > SESSION_INACTIVITY_MS) {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_LAST_ACTIVE_KEY);
    return 1;
  }

  const hours = (now - parseInt(startRaw)) / 3_600_000;
  const mult  = Math.pow(2, Math.floor(hours));
  return Math.min(mult, SESSION_MAX_MULTIPLIER);
}

/** Call this frequently (on keystroke, scroll, etc.) to mark the session as active. */
export function touchSession(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now().toString();
  if (!sessionStorage.getItem(SESSION_STORAGE_KEY)) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, now);
  }
  sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, now);
}

/** Returns hour count of the current session (0 if no session). */
export function getSessionHours(): number {
  if (typeof window === 'undefined') return 0;
  const startRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!startRaw) return 0;
  return (Date.now() - parseInt(startRaw)) / 3_600_000;
}

// ── Level system ─────────────────────────────────────────────
// XP to reach level n from 0: cumulative = 80 * n^1.8
// Solved with a lookup table up to level 100

const LEVEL_THRESHOLDS: number[] = [0]; // index = level, value = total XP needed
for (let lvl = 1; lvl <= 100; lvl++) {
  LEVEL_THRESHOLDS.push(Math.round(80 * Math.pow(lvl, 1.8)));
}

export function getLevelInfo(xpTotal: number): {
  level: number;
  xpForCurrentLevel: number;   // cumulative XP to unlock current level
  xpForNextLevel: number;      // cumulative XP to unlock next level
  progressPercent: number;     // 0–100
} {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xpTotal >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  level = Math.min(level, 100);

  const xpForCurrentLevel = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const xpForNextLevel    = LEVEL_THRESHOLDS[level]     ?? LEVEL_THRESHOLDS[99];
  const progressPercent   = level >= 100 ? 100
    : Math.min(100, Math.round(
        ((xpTotal - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100,
      ));

  return { level, xpForCurrentLevel, xpForNextLevel, progressPercent };
}

export const LEVEL_THRESHOLDS_EXPORT = LEVEL_THRESHOLDS;

// ── Level titles & unlocks ────────────────────────────────────
export interface LevelUnlock {
  title: string;
  unlocks: string[];
}

export const LEVEL_DATA: Record<number, LevelUnlock> = {
  1:  { title: 'Aspiring Writer',   unlocks: [] },
  2:  { title: 'Scribbler',         unlocks: ['Bronze username glow'] },
  3:  { title: 'Story Apprentice',  unlocks: [] },
  5:  { title: 'Scene Builder',     unlocks: ['XP bar on profile'] },
  7:  { title: 'Dialogue Crafter',  unlocks: [] },
  10: { title: 'Plot Weaver',       unlocks: ['Silver username glow', 'Level badge on profile'] },
  15: { title: 'Second Act Hero',   unlocks: [] },
  20: { title: 'Screenplay Veteran',unlocks: ['Gold username glow', 'Animated XP bar'] },
  30: { title: 'Master of Craft',   unlocks: ['Profile flame effect'] },
  50: { title: 'Legend of the Page',unlocks: ['Platinum glow', 'Custom profile accent'] },
  75: { title: 'Grandmaster',       unlocks: ['Rainbow glow'] },
  100:{ title: 'The Auteur',        unlocks: ['Ultra profile effect', 'Exclusive badge'] },
};

export function getLevelTitle(level: number): string {
  // Find the closest level floor
  const keys = Object.keys(LEVEL_DATA).map(Number).sort((a, b) => b - a);
  for (const k of keys) {
    if (level >= k) return LEVEL_DATA[k].title;
  }
  return 'Aspiring Writer';
}

export function getLevelUnlocks(level: number): string[] {
  return LEVEL_DATA[level]?.unlocks ?? [];
}

// ── Multiplier display helper ─────────────────────────────────
export function multiplierLabel(mult: number): string {
  if (mult <= 1) return '';
  return `${mult}×`;
}

export function multiplierHours(mult: number): number {
  // inverse of 2^hours = mult  →  hours = log2(mult)
  return Math.log2(mult);
}

// ── Profile visual unlocks ────────────────────────────────────
export type GlowTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'rainbow';

export function getGlowTier(level: number): GlowTier {
  if (level >= 75) return 'rainbow';
  if (level >= 50) return 'platinum';
  if (level >= 20) return 'gold';
  if (level >= 10) return 'silver';
  if (level >= 2)  return 'bronze';
  return 'none';
}

export const GLOW_CLASSES: Record<GlowTier, string> = {
  none:     '',
  bronze:   'drop-shadow-[0_0_6px_rgba(180,100,30,0.7)]',
  silver:   'drop-shadow-[0_0_6px_rgba(180,190,210,0.8)]',
  gold:     'drop-shadow-[0_0_8px_rgba(255,180,0,0.9)]',
  platinum: 'drop-shadow-[0_0_10px_rgba(200,220,255,0.95)]',
  rainbow:  'animate-rainbow-glow',
};
