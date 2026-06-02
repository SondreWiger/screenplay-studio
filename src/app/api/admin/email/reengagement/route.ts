import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { sendNotificationEmail } from '@/lib/mailer';

const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(req: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch inactive users: last_login_at OR updated_at older than 30 days
  const { data: candidates, error: queryErr } = await supabase
    .from('profiles')
    .select('id, email, display_name, full_name, last_login_at, updated_at')
    .or(`last_login_at.lt.${thirtyDaysAgo},and(last_login_at.is.null,updated_at.lt.${thirtyDaysAgo})`)
    .not('email', 'is', null)
    .neq('email_weekly_digest', false);

  if (queryErr) {
    console.error('[reengagement] query error:', queryErr);
    return NextResponse.json({ error: 'Failed to query profiles' }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, total: 0 });
  }

  // Exclude users who received a re-engagement email in the last 30 days
  const candidateIds = candidates.map((u) => u.id);
  const { data: recentLogs } = await supabase
    .from('reengagement_log')
    .select('user_id')
    .in('user_id', candidateIds)
    .gte('sent_at', thirtyDaysAgo);

  const alreadyEmailed = new Set((recentLogs || []).map((r) => r.user_id));
  const toEmail = candidates.filter((u) => !alreadyEmailed.has(u.id));

  let sent = 0;
  let skipped = 0;

  for (const user of toEmail) {
    const name = (user.display_name || user.full_name || 'there').trim();

    const result = await sendNotificationEmail({
      to: { email: user.email, name },
      subject: `We miss you, ${name}! 🎬`,
      heading: 'Come back to your story',
      body: `Hey ${name}, it's been a while since you last visited Screenplay Studio. Your projects are waiting for you. Whether you're mid-draft or just starting out, there's always room for one more scene.`,
      ctaLabel: 'Continue Writing',
      ctaUrl: '/dashboard',
    });

    if (result.success) {
      sent++;
      // Log to reengagement_log
      await supabase.from('reengagement_log').insert({
        user_id: user.id,
        email: user.email,
      });
    } else {
      skipped++;
      console.error(`[reengagement] failed to send to ${user.email}:`, result.error);
    }

    // 200ms delay between sends
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({
    sent,
    skipped,
    total: candidates.length,
  });
}
