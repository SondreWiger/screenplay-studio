import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { rejectUnlessCron } from '@/lib/cron-auth';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const DAY = 86_400_000;
/** Paid plans keep working this long past their end date while people renew. */
const PAID_GRACE_DAYS = 3;
/** Never expired here (manual or test grants). */
const SKIP_METHODS = ['dev_bypass'];

const ENDED: Record<string, { title: string; body: string }> = {
  gift: { title: 'Your gifted Pro has ended', body: 'Thanks for writing with us. Everything you made stays yours, and Pro is there if you want it back.' },
  kofi: { title: 'Your supporter Pro has ended', body: 'Thank you for supporting Screenplay Studio. Your work stays yours, and you can pick Pro up again any time.' },
  paid: { title: 'Your Pro plan has ended', body: 'Your Pro period is over. Renew to keep Pro features — your projects and files are untouched either way.' },
};

/**
 * Daily: end Pro whose period is over — gifted (admin Engagement tab),
 * donated (Ko-fi) and one-off PayPal periods alike. Pro is only switched off
 * for people with no other live subscription.
 */
export async function GET(req: Request) {
  const denied = rejectUnlessCron(req);
  if (denied) return denied;

  const db = createAdminSupabaseClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const paidCutoff = new Date(now - PAID_GRACE_DAYS * DAY).toISOString();

  const { data: due, error } = await db
    .from('subscriptions')
    .select('id, user_id, payment_method, current_period_end')
    .eq('status', 'active')
    .lt('current_period_end', nowIso)
    .limit(1000);
  if (error) {
    logger.error('[cron]', 'expire-pro lookup failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const expired = (due ?? []).filter((s) => {
    const method = (s.payment_method as string) || '';
    if (SKIP_METHODS.includes(method)) return false;
    const isPaid = method !== 'gift' && method !== 'kofi';
    return !isPaid || (s.current_period_end as string) < paidCutoff;
  });
  if (!expired.length) return NextResponse.json({ expired: 0, downgraded: 0 });

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
    if (upErr) logger.error('[cron]', 'expire-pro downgrade failed:', upErr);
    const methodByUser = new Map(expired.map((s) => [s.user_id as string, (s.payment_method as string) || 'paid']));
    await db.from('notifications').insert(downgrade.map((id) => {
      const m = methodByUser.get(id)!;
      const copy = ENDED[m] ?? ENDED.paid;
      return { user_id: id, type: 'general', title: copy.title, body: copy.body, link: '/pro' };
    }));
  }

  return NextResponse.json({ expired: expired.length, downgraded: downgrade.length });
}
