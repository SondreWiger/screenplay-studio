/**
 * Work Tracker — client-side utility for logging writing sessions.
 *
 * Calls the `upsert_work_log` Supabase RPC which INCREMENTS values for the
 * current day (never overwrites), so calling this multiple times in one day
 * accumulates the day's total automatically.
 */

import { createClient } from '@/lib/supabase/client';
import type { WorkLogInput } from '@/lib/types';

/**
 * Log work done in this session.  Values are incremented onto the existing
 * row for today, so this is safe to call repeatedly.
 *
 * @returns the work_log row id, or null on failure
 */
export async function logWork(params: WorkLogInput): Promise<string | null> {
  const {
    projectId = null,
    pagesWritten = 0,
    scenesCreated = 0,
    wordsWritten = 0,
    sessionMinutes = 0,
    manualNote = null,
    isManual = false,
  } = params;

  // Nothing to log
  if (
    pagesWritten === 0 &&
    scenesCreated === 0 &&
    wordsWritten === 0 &&
    sessionMinutes === 0 &&
    !manualNote
  ) {
    return null;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('upsert_work_log', {
      p_project_id:      projectId,
      p_pages_written:   pagesWritten,
      p_scenes_created:  scenesCreated,
      p_words_written:   wordsWritten,
      p_session_minutes: sessionMinutes,
      p_manual_note:     manualNote,
      p_is_manual:       isManual,
    });

    if (error) {
      console.warn('[work-tracker] logWork error:', error.message);
      return null;
    }
    return data as string;
  } catch (err) {
    console.warn('[work-tracker] logWork exception:', err);
    return null;
  }
}

/**
 * Fetch all work logs for the current user for the past N days (default 365).
 */
export async function fetchMyWorkLogs(days = 365): Promise<Array<{
  log_date: string;
  pages_written: number;
  session_minutes: number;
  project_id: string | null;
}>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('work_logs')
    .select('log_date, pages_written, session_minutes, project_id')
    .eq('user_id', user.id)
    .gte('log_date', since.toISOString().slice(0, 10))
    .order('log_date', { ascending: true });

  if (error) {
    console.warn('[work-tracker] fetchMyWorkLogs error:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Fetch work logs for a specific user (visible only if their grid is
 * public or if the viewer is an accepted buddy — enforced by RLS).
 */
export async function fetchUserWorkLogs(userId: string, days = 365): Promise<Array<{
  log_date: string;
  pages_written: number;
  session_minutes: number;
}>> {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('work_logs')
    .select('log_date, pages_written, session_minutes')
    .eq('user_id', userId)
    .gte('log_date', since.toISOString().slice(0, 10))
    .order('log_date', { ascending: true });

  if (error) {
    console.warn('[work-tracker] fetchUserWorkLogs error:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Aggregate logs by date (sum across all projects).
 * Returns a map of { "2025-01-15": { pages, minutes } } for quick lookup.
 */
export function aggregateLogsByDate(
  logs: Array<{ log_date: string; pages_written: number; session_minutes: number }>
): Map<string, { pages: number; minutes: number }> {
  const map = new Map<string, { pages: number; minutes: number }>();
  for (const log of logs) {
    const existing = map.get(log.log_date);
    if (existing) {
      existing.pages += log.pages_written;
      existing.minutes += log.session_minutes;
    } else {
      map.set(log.log_date, { pages: log.pages_written, minutes: log.session_minutes });
    }
  }
  return map;
}

/**
 * Calculate current streak (consecutive days with any activity up to today).
 */
export function calculateStreak(
  logs: Array<{ log_date: string; pages_written: number; session_minutes: number }>
): number {
  if (logs.length === 0) return 0;

  const aggregated = aggregateLogsByDate(logs);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  const cursor = new Date(today);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const dayData = aggregated.get(key);
    if (!dayData || (dayData.pages === 0 && dayData.minutes === 0)) {
      // Allow today to not have activity yet without breaking the streak
      if (cursor.getTime() === today.getTime()) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
