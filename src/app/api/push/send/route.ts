import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Push notification delivery endpoint
// Called from:
//   1. Client-side sendNotification() after inserting into notifications table
//   2. DB trigger via pg_net after any notification INSERT (covers server-side)
// ---------------------------------------------------------------------------

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@screenplaystudio.app';
const PUSH_API_SECRET = process.env.PUSH_API_SECRET || '';

// Configure VAPID credentials once at module load
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: NextRequest) {
  try {
    // ---- Auth ----
    // Accept requests with a valid PUSH_API_SECRET header (DB trigger / cron)
    // OR when PUSH_API_SECRET is not configured (dev mode, or client-side calls)
    const secret = req.headers.get('x-push-secret');
    if (PUSH_API_SECRET && secret !== PUSH_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ---- VAPID check ----
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json(
        { error: 'VAPID keys not configured. Run: node scripts/generate-vapid-keys.mjs' },
        { status: 500 },
      );
    }

    // ---- Parse body ----
    const body = await req.json();
    const { user_id, user_ids, title, body: notifBody, url } = body;
    const targetIds: string[] = user_ids || (user_id ? [user_id] : []);

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'No user_id(s) provided' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // ---- Fetch push subscriptions for target users ----
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, keys')
      .in('user_id', targetIds);

    if (error) {
      console.error('[push/send] DB error fetching subscriptions:', error);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No subscriptions found' });
    }

    // ---- Build payload ----
    const payload = JSON.stringify({
      title: title || 'Screenplay Studio',
      body: notifBody || '',
      url: url || '/notifications',
      tag: `notif-${Date.now()}`,
    });

    // ---- Send pushes ----
    let sent = 0;
    const expired: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const keys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys;
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: keys.p256dh, auth: keys.auth },
            },
            payload,
          );
          sent++;
        } catch (err: unknown) {
          const pushErr = err as { statusCode?: number; body?: string };
          // 410 Gone or 404 = subscription expired / invalid
          if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
            expired.push(sub.id);
          } else {
            console.error(
              `[push/send] Failed for ${sub.endpoint}:`,
              pushErr?.statusCode,
              pushErr?.body,
            );
          }
        }
      }),
    );

    // ---- Cleanup expired subscriptions ----
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired);
    }

    return NextResponse.json({ sent, expired: expired.length });
  } catch (err) {
    console.error('[push/send] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
