import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { XP_VALUES } from '@/lib/gamification';
import type { XPEventType } from '@/lib/types';

// ============================================================
// Gamification Award API
// POST /api/gamification/award
// Body: { event_type: XPEventType, multiplier?: number, metadata?: object }
// ============================================================

const MAX_MULTIPLIER = 16;

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType = body.event_type as XPEventType;
    if (!eventType || !(eventType in XP_VALUES)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
    }

    const rawMult = Number(body.multiplier ?? 1);
    const multiplier = Math.max(1, Math.min(MAX_MULTIPLIER, isNaN(rawMult) ? 1 : rawMult));
    const metadata   = (body.metadata && typeof body.metadata === 'object') ? body.metadata : null;
    const xpBase     = XP_VALUES[eventType];

    // Call the DB function to award XP and level up
    const { data, error } = await supabase.rpc('award_xp', {
      p_user_id:    user.id,
      p_event_type: eventType,
      p_xp_base:    xpBase,
      p_multiplier: multiplier,
      p_metadata:   metadata,
    });

    if (error) {
      console.error('[gamification/award]', error);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    // Read updated totals
    const { data: gamif } = await supabase
      .from('user_gamification')
      .select('xp_total, level')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      xp_awarded: data as number,
      xp_total:   gamif?.xp_total ?? 0,
      level:      gamif?.level    ?? 1,
    });
  } catch (err) {
    console.error('[gamification/award] unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── GET — read current gamification state ─────────────────────
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data } = await supabase
      .from('user_gamification')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json(data ?? {});
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
