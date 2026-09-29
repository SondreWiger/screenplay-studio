import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { fetchAll } from '@/lib/supabase/fetch-all';

// GET /api/user/writing-stats
// Returns aggregated writing statistics for the authenticated user.
// Used by the dashboard goal widget and profile stats sections.

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = user.id;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);

    // Daily totals come from work_logs (maintained by the work tracker). The old
    // version read non-existent work_sessions columns and then downloaded every
    // element the user had ever written on each dashboard load.
    const [logsRes, projectsRes, profileRes] = await Promise.all([
      supabase
        .from('work_logs')
        .select('log_date, words_written')
        .eq('user_id', uid)
        .order('log_date', { ascending: false })
        .limit(1000),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('created_by', uid),
      supabase.from('profiles').select('writing_goal_words_per_day').eq('id', uid).maybeSingle(),
    ]);

    const logs = (logsRes.data ?? []) as { log_date: string; words_written: number | null }[];
    let totalWords = 0;
    let wordsToday = 0;
    let wordsThisWeek = 0;
    const today = isoDate(todayStart);
    const week = isoDate(weekStart);
    for (const l of logs) {
      const w = l.words_written ?? 0;
      totalWords += w;
      if (l.log_date === today) wordsToday += w;
      if (l.log_date >= week) wordsThisWeek += w;
    }

    // No tracked sessions yet: estimate the recent numbers from lines written
    // this week (bounded, unlike an all-time scan).
    if (logs.length === 0) {
      const countWords = (text: string): number =>
        text ? text.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length : 0;
      const recent = await fetchAll<{ content: string | null; created_at: string }>(() =>
        supabase
          .from('script_elements')
          .select('content, created_at')
          .eq('created_by', uid)
          .gte('created_at', weekStart.toISOString()),
      ).catch(() => []);
      for (const el of recent) {
        const w = countWords(el.content ?? '');
        wordsThisWeek += w;
        if (new Date(el.created_at) >= todayStart) wordsToday += w;
      }
      totalWords = wordsThisWeek;
    }

    const firstLog = logs.length > 0 ? new Date(logs[logs.length - 1].log_date) : null;
    const activeDays = firstLog
      ? Math.max(1, Math.ceil((now.getTime() - firstLog.getTime()) / (1000 * 60 * 60 * 24)))
      : 7;
    const avgWordsPerDay = Math.round(totalWords / activeDays);

    // Null until the writing_goal_words_per_day migration is applied
    const goal = (profileRes.data as { writing_goal_words_per_day?: number | null } | null)?.writing_goal_words_per_day ?? null;

    return NextResponse.json({
      totalWords,
      wordsToday,
      wordsThisWeek,
      avgWordsPerDay,
      totalProjects: projectsRes.count ?? 0,
      writingGoal: goal,
      goalProgress: goal ? Math.min(100, Math.round((wordsToday / goal) * 100)) : null,
    });
  } catch (err: any) {
    logger.error('writing-stats', 'Unexpected error', err?.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
