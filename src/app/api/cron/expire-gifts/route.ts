import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { rejectUnlessCron } from '@/lib/cron-auth';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * Daily: end gifted Pro (from the admin Engagement tab) whose period is over.
 * Only `payment_method = 'gift'` subscriptions are touched, and Pro is only
 * switched off for people with no other live subscription — a paid plan or a
 * newer gift keeps them Pro.
 */
export async function GET(req: Request) {
  const denied = rejectUnlessCron(req);
  if (denied) return denied;

  const db = createAdminSupabaseClient();
  const nowIso = new Date().toISOString();

  const { data: expired, error } = await db
    .from('subscriptions')
    .select('id, user_id')
    .eq('payment_method', 'gift')
    .eq('status', 'active')
    .lt('current_period_end', nowIso)
    .limit(1000);
  if (error) {
    logger.error('[cron]', 'expire-gifts lookup failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!expired?.length) return NextResponse.json({ expired: 0, downgraded: 0 });

  await db.from('subscriptions').update({ status: 'expired', updated_at: nowIso }).in('id', expired.map((s) => s.id));

  const userIds = Array.from(new Set(expired.map((s) => s.user_id as string)));
  const { data: stillLive } = await db
    .from('subscriptions')
    .select('user_id')
    .in('user_id', userIds)
    .eq('status', 'active')
    .gt('current_period_end', nowIso);
  const keep = new Set((stillLive ?? []).map((s) => s.user_id as string));
  const downgrade = userIds.filter((id) => !keep.has(id));

  if (downgrade.length) {
    const { error: upErr } = await db.from('profiles').update({ is_pro: false }).in('id', downgrade);
    if (upErr) logger.error('[cron]', 'expire-gifts downgrade failed:', upErr);
    await db.from('notifications').insert(downgrade.map((id) => ({
      user_id: id,
      type: 'general',
      title: 'Your gifted Pro has ended',
      body: 'Thanks for writing with us. Everything you made stays yours, and Pro is there if you want it back.',
      link: '/pro',
    })));
  }

  return NextResponse.json({ expired: expired.length, downgraded: downgrade.length });
}
