import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { deliverNotificationEmail, type NotificationRecord, type EmailOutcome } from '@/lib/notification-email';

/**
 * POST /api/notifications/email — send the emails for new notifications.
 *
 * Two callers:
 * - The app, right after a signed-in user creates notifications (comments,
 *   invites, messages, ticket replies). Only rows that user created
 *   (actor_id) in the last few minutes are considered, so it can't be used to
 *   email arbitrary text to people.
 * - Optionally a Supabase Database Webhook on INSERT into notifications, with
 *   the header `x-webhook-secret: $NOTIFICATION_WEBHOOK_SECRET`. This also
 *   covers notifications made by database triggers (e.g. community comments).
 *
 * Each row is emailed at most once whichever path reaches it first.
 */

const WEBHOOK_SECRET = process.env.NOTIFICATION_WEBHOOK_SECRET || '';
const RECENT_MS = 5 * 60_000;
const MAX_PER_CALL = 25;

const COLUMNS = 'id, user_id, type, title, body, link, actor_id, entity_id, metadata, created_at';

export async function POST(req: NextRequest) {
  let db;
  try {
    db = createAdminSupabaseClient();
  } catch {
    return NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  // Webhook path
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== null) {
    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await req.json().catch(() => null);
    const id = payload?.record?.id;
    if (payload?.type !== 'INSERT' || !id) return NextResponse.json({ ok: true, skipped: 'not an insert' });
    // Re-read the row rather than trusting the payload
    const { data: row } = await db.from('notifications').select(COLUMNS).eq('id', id).maybeSingle();
    if (!row) return NextResponse.json({ ok: true, skipped: 'not found' });
    const outcome = await deliverNotificationEmail(db, row as NotificationRecord);
    return NextResponse.json({ ok: true, outcome });
  }

  // Signed-in user path
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const since = new Date(Date.now() - RECENT_MS).toISOString();
  const { data: rows, error } = await db
    .from('notifications')
    .select(COLUMNS)
    .eq('actor_id', user.id)
    .gte('created_at', since)
    .is('metadata->>email_status', null)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_CALL);
  if (error) {
    logger.error('[api]', '[notifications/email] lookup failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  const outcomes: Partial<Record<EmailOutcome, number>> = {};
  for (const row of (rows || []) as NotificationRecord[]) {
    // Cap how many emails one person can cause (in-app notifications still arrive)
    if (!checkRateLimit(`notif-email:${user.id}`, 30, 10 * 60_000).allowed) break;
    try {
      const outcome = await deliverNotificationEmail(db, row);
      outcomes[outcome] = (outcomes[outcome] || 0) + 1;
    } catch (err) {
      logger.error('[api]', '[notifications/email] delivery failed:', err);
    }
  }
  return NextResponse.json({ ok: true, outcomes });
}
