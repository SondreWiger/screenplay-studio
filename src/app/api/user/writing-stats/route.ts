import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

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

    // Gather stats in parallel
    const [
      scriptElementsRes,
      projectsRes,
      workSessionsRes,
    ] = await Promise.all([
      // All script elements (for word counts)
      supabase
        .from('script_elements')
        .select('content, created_at, script_id')
        .eq('created_by', uid),
      // Projects (to find top project)
      supabase
        .from('projects')
        .select('id, title')
        .eq('created_by', uid),
      // Work sessions for time-based stats
      supabase
        .from('work_sessions')
        .select('words_written, started_at, ended_at')
        .eq('user_id', uid)
        .order('started_at', { ascending: false })
        .limit(500),
    ]);

    const elements = scriptElementsRes.data ?? [];
    const projects = projectsRes.data ?? [];
    const sessions = workSessionsRes.data ?? [];

    // Count words from script elements
    function countWords(text: string): number {
      return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    let totalWords = 0;
    let wordsToday = 0;
    let wordsThisWeek = 0;

    // Use work sessions if available (more reliable, tracks actual typing)
    if (sessions.length > 0) {
      for (const s of sessions) {
        const w = s.words_written ?? 0;
        totalWords += w;
        const t = new Date(s.started_at);
        if (t >= todayStart) wordsToday += w;
        if (t >= weekStart) wordsThisWeek += w;
      }
    } else {
      // Fall back to counting script element content
      for (const el of elements) {
        const w = countWords(el.content ?? '');
        totalWords += w;
        const t = new Date(el.created_at);
        if (t >= todayStart) wordsToday += w;
        if (t >= weekStart) wordsThisWeek += w;
      }
    }

    // Find top project by element count
    const countByProject: Record<string, number> = {};
    for (const el of elements) {
      if (el.script_id) {
        countByProject[el.script_id] = (countByProject[el.script_id] ?? 0) + 1;
      }
    }

    // Total days since first session
    const firstSession = sessions.length > 0
      ? new Date(sessions[sessions.length - 1].started_at)
      : null;
    const activeDays = firstSession
      ? Math.max(1, Math.ceil((now.getTime() - firstSession.getTime()) / (1000 * 60 * 60 * 24)))
      : 1;

    const avgWordsPerDay = activeDays > 0 ? Math.round(totalWords / activeDays) : 0;

    // Fetch user's writing goal from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('writing_goal_words_per_day')
      .eq('id', uid)
      .single();

    return NextResponse.json({
      totalWords,
      wordsToday,
      wordsThisWeek,
      avgWordsPerDay,
      totalProjects: projects.length,
      writingGoal: (profile as any)?.writing_goal_words_per_day ?? null,
      goalProgress: (profile as any)?.writing_goal_words_per_day
        ? Math.min(100, Math.round((wordsToday / (profile as any).writing_goal_words_per_day) * 100))
        : null,
    });
  } catch (err: any) {
    logger.error('writing-stats', 'Unexpected error', err?.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
