/**
 * tourState.ts
 *
 * Lightweight session-storage backed state for the interactive guided tour.
 * Persists across page navigations within a single browser session.
 */

import type { UsageIntent } from '@/lib/types';

export interface TourState {
  active: boolean;
  step: number;
  intent: UsageIntent;
  /** First project id — used for "open your project" navigation steps */
  projectId: string | null;
}

const KEY = 'ss_guided_tour';

export function startTour(intent: UsageIntent, projectId: string | null): void {
  if (typeof window === 'undefined') return;
  const state: TourState = { active: true, step: 0, intent, projectId };
  sessionStorage.setItem(KEY, JSON.stringify(state));
}

export function getTourState(): TourState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TourState) : null;
  } catch {
    return null;
  }
}

export function setTourStep(step: number): void {
  if (typeof window === 'undefined') return;
  const prev = getTourState();
  if (!prev) return;
  sessionStorage.setItem(KEY, JSON.stringify({ ...prev, step }));
}

export function endTour(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}
