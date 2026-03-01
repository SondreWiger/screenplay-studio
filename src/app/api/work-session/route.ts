import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// ============================================================
// Work Session API — heartbeat-based time tracking
//
// POST /api/work-session   — receive a 30-second heartbeat
// GET  /api/work-session?projectId=xxx — read stats for a project
//
// Anti-exploit measures:
//   • Server-side auth required for every request
//   • Rate-limit: min 20 s between heartbeats per session
//   • Grace capped at 600 s (10 min) regardless of client hint
//   • session_key is a per-tab UUID from sessionStorage so
//     old replayed keys only update an existing, bounded session
//   • Project access verified via Supabase RLS before upsert
// ============================================================

const HEARTBEAT_SECONDS   = 30;  // normal time added per heartbeat
const MAX_GRACE_SECONDS   = 600; // max one-time "thinking break" credit
const MIN_GAP_SECONDS     = 20;  // don't accept two heartbeats < 20 s apart
const CONTEXT_MAX_LEN     = 50;

// ---------------------------------------------------------------------------
// POST — receive a heartbeat
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const project_id   = body.project_id   as string | undefined;
    const session_key  = body.session_key  as string | undefined;
    const rawContext   = (body.context ?? 'general') as string;
    const rawGrace     = Number(body.idle_grace_seconds ?? 0);

    if (!project_id || !session_key) {
      return NextResponse.json({ error: 'project_id and session_key are required' }, { status: 400 });
    }

    // Sanitise inputs server-side — never trust the client
    const context      = rawContext.slice(0, CONTEXT_MAX_LEN).replace(/[^a-z0-9-]/g, '');
    const graceSecs    = Math.max(0, Math.min(isFinite(rawGrace) ? rawGrace : 0, MAX_GRACE_SECONDS));

    // Verify project access (RLS enforces this; explicit check gives a clean 404)
    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .maybeSingle();

    if (projErr || !proj) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    const now     = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Look for an existing session with this key
    const { data: existing } = await supabase
      .from('work_sessions')
      .select('id, duration_seconds, last_heartbeat_at')
      .eq('user_id', user.id)
      .eq('project_id', project_id)
      .eq('session_key', session_key)
      .maybeSingle();

    if (existing) {
      // Rate-limit: reject if too soon since last heartbeat
      const lastBeatMs  = new Date(existing.last_heartbeat_at).getTime();
      const gapSeconds  = (now.getTime() - lastBeatMs) / 1000;

      if (gapSeconds < MIN_GAP_SECONDS) {
        // Just return current total without updating
        return NextResponse.json({ ok: true, total_seconds: existing.duration_seconds });
      }

      // Grace is only applied once per "return from break" — the client
      // sends it exactly once and then resets. Cap it here too.
      const increment = HEARTBEAT_SECONDS + graceSecs;

      const { data: updated, error: updateErr } = await supabase
        .from('work_sessions')
        .update({
          duration_seconds:  existing.duration_seconds + increment,
          last_heartbeat_at: now.toISOString(),
        })
        .eq('id', existing.id)
        .select('duration_seconds')
        .single();

      if (updateErr) {
        console.error('[work-session] update error:', updateErr);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
      }

      return NextResponse.json({ ok: true, total_seconds: updated.duration_seconds });

    } else {
      // First heartbeat for this session_key → create row
      const { data: created, error: insertErr } = await supabase
        .from('work_sessions')
        .insert({
          user_id:           user.id,
          project_id,
          session_key,
          context:           context || 'general',
          date:              todayStr,
          duration_seconds:  HEARTBEAT_SECONDS,
          last_heartbeat_at: now.toISOString(),
        })
        .select('duration_seconds')
        .single();

      if (insertErr) {
        // Possible race-condition duplicate key — not an error
        if (insertErr.code === '23505') {
          return NextResponse.json({ ok: true, total_seconds: HEARTBEAT_SECONDS });
        }
        console.error('[work-session] insert error:', insertErr);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
      }

      return NextResponse.json({ ok: true, total_seconds: created.duration_seconds });
    }

  } catch (err) {
    console.error('[work-session] POST exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET — read work time stats for a project
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId query param required' }, { status: 400 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
      .toISOString().split('T')[0];

    // Run three queries in parallel; RLS ensures users only see
    // sessions they're allowed to see (own sessions + project team)
    const [myRes, allRes, dailyRes, contextRes] = await Promise.all([
      // My total + breakdown across all time
      supabase
        .from('work_sessions')
        .select('duration_seconds, date, context')
        .eq('user_id', user.id)
        .eq('project_id', projectId),

      // All team members' totals for this project
      supabase
        .from('work_sessions')
        .select('duration_seconds, user_id')
        .eq('project_id', projectId),

      // Last 30 days — mine (for sparkline)
      supabase
        .from('work_sessions')
        .select('duration_seconds, date')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: true }),

      // Context breakdown — mine
      supabase
        .from('work_sessions')
        .select('duration_seconds, context')
        .eq('user_id', user.id)
        .eq('project_id', projectId),
    ]);

    // My total
    const myTotal   = (myRes.data ?? []).reduce((s, r) => s + r.duration_seconds, 0);
    // Team total
    const teamTotal = (allRes.data ?? []).reduce((s, r) => s + r.duration_seconds, 0);

    // Per-user totals (for project owner view)
    const userMap: Record<string, number> = {};
    for (const row of (allRes.data ?? [])) {
      userMap[row.user_id] = (userMap[row.user_id] ?? 0) + row.duration_seconds;
    }

    // Daily buckets — fill zeros for last 30 days
    const dailyMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().split('T')[0];
      dailyMap[d] = 0;
    }
    for (const row of (dailyRes.data ?? [])) {
      if (dailyMap[row.date] !== undefined) {
        dailyMap[row.date] += row.duration_seconds;
      }
    }
    const daily = Object.entries(dailyMap).map(([date, seconds]) => ({ date, seconds }));

    // Context breakdown
    const ctxMap: Record<string, number> = {};
    for (const row of (contextRes.data ?? [])) {
      ctxMap[row.context] = (ctxMap[row.context] ?? 0) + row.duration_seconds;
    }

    return NextResponse.json({
      my_total_seconds:   myTotal,
      team_total_seconds: teamTotal,
      daily,                       // { date, seconds }[] — last 30 days
      user_totals:        userMap, // userId → seconds
      context_breakdown:  ctxMap, // context → seconds
    });

  } catch (err) {
    console.error('[work-session] GET exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
