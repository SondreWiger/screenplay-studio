import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { rejectUnlessAdmin } from '@/lib/require-admin';
import { fillEmails } from '@/lib/private-profile';
import { sendNotificationEmail } from '@/lib/mailer';
import { recordEmailSent } from '@/lib/email-sent-notice';

const MAX_RECIPIENTS = 500;
const PRO_MONTHS = [1, 3, 6, 12];

type Perk =
  | { type: 'pro'; months: number }
  | { type: 'badge'; badgeId: string }
  | { type: 'thanks' };

interface RewardBody {
  userIds: string[];
  perk: Perk;
  message: { subject: string; heading: string; body: string; ctaLabel?: string; ctaUrl?: string };
  channels: { notification: boolean; email: boolean };
  /** Tier and score at send time, logged with the perk. */
  context?: Record<string, { tier?: string; score?: number }>;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

// POST /api/admin/engagement/reward
export async function POST(req: NextRequest) {
  const { data: { user } } = await createServerSupabaseClient().auth.getUser();
  const denied = await rejectUnlessAdmin(user?.id);
  if (denied) return denied;

  let body: RewardBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userIds = Array.from(new Set(Array.isArray(body.userIds) ? body.userIds.filter((x) => typeof x === 'string') : []));
  if (userIds.length === 0) return NextResponse.json({ error: 'Pick at least one person' }, { status: 400 });
  if (userIds.length > MAX_RECIPIENTS) return NextResponse.json({ error: `At most ${MAX_RECIPIENTS} people per send` }, { status: 400 });

  const perk = body.perk;
  if (!perk || !['pro', 'badge', 'thanks'].includes(perk.type)) return NextResponse.json({ error: 'Unknown perk' }, { status: 400 });
  if (perk.type === 'pro' && !PRO_MONTHS.includes(perk.months)) return NextResponse.json({ error: 'Pro can be gifted for 1, 3, 6 or 12 months' }, { status: 400 });
  if (perk.type === 'badge' && !perk.badgeId) return NextResponse.json({ error: 'Pick a badge' }, { status: 400 });

  const msg = body.message ?? { subject: '', heading: '', body: '' };
  const channels = { notification: !!body.channels?.notification, email: !!body.channels?.email };
  if ((channels.notification || channels.email) && (!msg.subject?.trim() || !msg.heading?.trim() || !msg.body?.trim())) {
    return NextResponse.json({ error: 'The message needs a subject, heading and body' }, { status: 400 });
  }
  if (channels.email && !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email is not configured (RESEND_API_KEY). Send as a notification only.' }, { status: 400 });
  }

  const db = createAdminSupabaseClient();

  let badge: { id: string; name: string; emoji: string } | null = null;
  if (perk.type === 'badge') {
    const { data } = await db.from('badges').select('id, name, emoji').eq('id', perk.badgeId).maybeSingle();
    if (!data) return NextResponse.json({ error: 'That badge no longer exists' }, { status: 400 });
    badge = data;
  }

  const { data: profiles, error: profErr } = await db
    .from('profiles')
    .select('id, email, display_name, full_name, username, is_pro, pro_since, moderation_status')
    .in('id', userIds);
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
  await fillEmails(db, profiles ?? []);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const result = { rewarded: 0, notified: 0, emailed: 0, skipped: [] as { id: string; name: string; reason: string }[], failed: [] as { id: string; name: string; error: string }[] };
  const now = new Date();

  for (const id of userIds) {
    const p = byId.get(id);
    if (!p) { result.skipped.push({ id, name: id.slice(0, 8), reason: 'Account not found' }); continue; }
    const name = (p.display_name as string) || (p.full_name as string) || (p.username as string) || 'there';
    if (p.moderation_status === 'banned' || p.moderation_status === 'suspended') {
      result.skipped.push({ id, name, reason: 'Account is banned or suspended' });
      continue;
    }

    try {
      // 1. The perk itself
      let details: Record<string, unknown> = {};
      let expiresAt: string | null = null;
      if (perk.type === 'pro') {
        if (p.is_pro) { result.skipped.push({ id, name, reason: 'Already has Pro' }); continue; }
        const end = new Date(now);
        end.setMonth(end.getMonth() + perk.months);
        expiresAt = end.toISOString();
        const { data: sub, error } = await db.from('subscriptions').insert({
          user_id: id,
          plan: 'pro',
          status: 'active',
          billing_cycle: 'gift',
          price_cents: 0,
          payment_method: 'gift',
          current_period_start: now.toISOString(),
          current_period_end: expiresAt,
          metadata: { granted_by: user!.id, reason: 'engagement', previous_pro_since: p.pro_since ?? null },
        }).select('id').single();
        if (error) throw new Error(error.message);
        // pro_since starts now so a gift never unlocks legacy Studio access
        const { error: upErr } = await db.from('profiles').update({ is_pro: true, pro_since: now.toISOString() }).eq('id', id);
        if (upErr) throw new Error(upErr.message);
        details = { months: perk.months, subscription_id: sub.id };
      } else if (perk.type === 'badge' && badge) {
        const { error } = await db.from('user_badges').upsert(
          { user_id: id, badge_id: badge.id, awarded_by: user!.id },
          { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
        );
        if (error) throw new Error(error.message);
        details = { badge_id: badge.id, badge_name: badge.name };
      }

      // 2. The message
      const vars = {
        name,
        months: perk.type === 'pro' ? String(perk.months) : '',
        badge: badge ? `${badge.emoji} ${badge.name}` : '',
      };
      const sent: string[] = [];
      if (channels.notification) {
        const { error } = await db.from('notifications').insert({
          user_id: id,
          type: 'general',
          title: fill(msg.heading, vars).slice(0, 200),
          body: fill(msg.body, vars).slice(0, 1000),
          link: msg.ctaUrl || null,
          metadata: { perk: perk.type, ...details },
        });
        if (error) logger.warn('[reward]', `notification for ${id} failed: ${error.message}`);
        else { result.notified++; sent.push('notification'); }
      }
      if (channels.email && p.email) {
        const html = (t: string) => escapeHtml(fill(t, vars)).replace(/\n/g, '<br>');
        const r = await sendNotificationEmail({
          to: { email: p.email as string, name },
          subject: fill(msg.subject, vars),
          heading: html(msg.heading),
          body: html(msg.body),
          ctaLabel: msg.ctaLabel ? html(msg.ctaLabel) : undefined,
          ctaUrl: msg.ctaUrl || undefined,
        });
        if (r.success) { result.emailed++; sent.push('email'); await recordEmailSent(db, id, fill(msg.subject, vars)); }
        else logger.warn('[reward]', `email for ${id} failed: ${r.error}`);
        // Stay well under the mail provider's rate limit
        await new Promise((res) => setTimeout(res, 120));
      }

      // 3. The record
      await db.from('user_perks').insert({
        user_id: id,
        perk: perk.type,
        details,
        subject: channels.notification || channels.email ? fill(msg.subject, vars) : null,
        channels: sent,
        tier: body.context?.[id]?.tier ?? null,
        score: body.context?.[id]?.score ?? null,
        granted_by: user!.id,
        expires_at: expiresAt,
      });
      result.rewarded++;
    } catch (err) {
      result.failed.push({ id, name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json(result);
}
