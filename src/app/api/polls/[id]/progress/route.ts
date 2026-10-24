import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { cleanPollSource } from '@/lib/polls/analytics';

// Longest stretch one report can add, so a client can't inflate the totals
const MAX_ACTIVE_MS_PER_REPORT = 30 * 60 * 1000;

/**
 * POST /api/polls/[id]/progress — how far someone got and how long they spent.
 * Body: { event: 'shown' | 'step' | 'dismiss', step?: number, active_ms?: number, source?: string }
 *
 * One poll_views row per person per poll; the furthest step and active time
 * only ever grow. Best-effort: failures answer 204 so the poll never breaks.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const body = await req.json().catch(() => ({}));
  const event = body.event === 'shown' || body.event === 'dismiss' ? body.event : 'step';
  const step = Number.isFinite(body.step) ? Math.max(0, Math.min(500, Math.floor(body.step))) : 0;
  const activeMs = Number.isFinite(body.active_ms)
    ? Math.max(0, Math.min(MAX_ACTIVE_MS_PER_REPORT, Math.floor(body.active_ms)))
    : 0;

  try {
    const admin = createAdminSupabaseClient();
    // Only live polls are tracked
    const { data: poll } = await admin.from('poll_sessions').select('id').eq('id', params.id).eq('status', 'published').maybeSingle();
    if (!poll) return new NextResponse(null, { status: 204 });

    const { data: row } = await admin.from('poll_views')
      .select('max_step, view_count, dismiss_count, active_ms, source')
      .eq('session_id', params.id).eq('user_id', user.id).maybeSingle();

    const now = new Date().toISOString();
    if (!row) {
      await admin.from('poll_views').insert({
        session_id: params.id,
        user_id: user.id,
        source: cleanPollSource(body.source),
        max_step: step,
        dismiss_count: event === 'dismiss' ? 1 : 0,
        active_ms: activeMs,
      });
    } else {
      await admin.from('poll_views').update({
        last_seen_at: now,
        max_step: Math.max(row.max_step, step),
        view_count: row.view_count + (event === 'shown' ? 1 : 0),
        dismiss_count: row.dismiss_count + (event === 'dismiss' ? 1 : 0),
        active_ms: row.active_ms + activeMs,
        source: row.source || cleanPollSource(body.source),
      }).eq('session_id', params.id).eq('user_id', user.id);
    }
  } catch {
    // Tracking is a bonus
  }
  return new NextResponse(null, { status: 204 });
}
