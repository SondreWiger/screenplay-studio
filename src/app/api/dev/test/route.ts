import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getMailerStatus, sendNotificationEmail } from '@/lib/mailer';

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || process.env.ADMIN_UID || '';

async function requireAdmin() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (user.id === ADMIN_UID) return { user, supabase };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role === 'admin') return { user, supabase };
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { action, payload } = await req.json();
  const { user, supabase } = auth;

  switch (action) {
    case 'send_notification': {
      const { data: inserted, error } = await supabase.from('notifications').insert({
        user_id: user.id,
        type: payload?.type ?? 'system',
        title: payload?.title ?? '🧪 Test Notification',
        body: payload?.body ?? 'This is a test notification from the dev panel.',
        read: false,
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, notification: inserted });
    }

    case 'award_xp': {
      const amount = Number(payload?.amount) || 50;
      const { error } = await supabase.rpc('award_xp', { target_user_id: user.id, xp_amount: amount, reason: 'dev_panel_test' });
      if (error) {
        // Fallback: direct update (XP lives in user_gamification, not profiles)
        const { data: g } = await supabase.from('user_gamification').select('xp_total').eq('user_id', user.id).maybeSingle();
        await supabase.from('user_gamification').update({ xp_total: (g?.xp_total ?? 0) + amount }).eq('user_id', user.id);
      }
      return NextResponse.json({ ok: true, awarded: amount });
    }

    case 'send_email': {
      // A real email to your own address, with the provider's answer, so
      // delivery problems (missing key, unverified sender domain) show here.
      const status = getMailerStatus();
      if (!user.email) return NextResponse.json({ error: 'Your account has no email address', mailer: status }, { status: 400 });
      const result = await sendNotificationEmail({
        to: { email: user.email },
        subject: 'Test email from Screenplay Studio',
        heading: 'Email delivery works',
        body: `This test was sent from the dev panel at ${new Date().toUTCString()}.`,
        ctaLabel: 'Open notification settings',
        ctaUrl: '/settings?tab=notifications',
      });
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Send failed', sent_to: user.email, mailer: status }, { status: 502 });
      }
      return NextResponse.json({ ok: true, sent_to: user.email, message_id: result.messageId, mailer: status });
    }

    case 'send_push': {
      // Fetch user push subscription and send a test push
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);
      if (!subs?.length) return NextResponse.json({ error: 'No push subscription found for your account.' }, { status: 400 });
      // Record a simulated push event
      const { error } = await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'system',
        title: '🔔 Test Push',
        body: 'Push notification was triggered via dev panel.',
        read: false,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, subscription_endpoint: subs[0].endpoint?.slice(0, 60) + '...' });
    }

    case 'db_health': {
      const start = Date.now();
      const checks: { name: string; ok: boolean; ms: number; detail?: string }[] = [];
      const tables = ['profiles', 'projects', 'scripts', 'characters', 'locations', 'scenes', 'shots', 'blog_posts', 'community_posts'];
      await Promise.all(tables.map(async (t) => {
        const t0 = Date.now();
        const { error, count } = await supabase.from(t as any).select('*', { count: 'exact', head: true });
        checks.push({ name: t, ok: !error, ms: Date.now() - t0, detail: error ? error.message : `${count} rows` });
      }));
      return NextResponse.json({ ok: true, totalMs: Date.now() - start, checks });
    }

    case 'simulate_error': {
      const type = payload?.type ?? 'generic';
      if (type === '404') return NextResponse.json({ error: 'Simulated 404 — Not Found' }, { status: 404 });
      if (type === '500') return NextResponse.json({ error: 'Simulated 500 — Internal Server Error' }, { status: 500 });
      if (type === '429') return NextResponse.json({ error: 'Simulated 429 — Rate Limited' }, { status: 429 });
      throw new Error('Simulated unhandled exception from dev panel');
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
