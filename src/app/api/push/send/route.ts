import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Push notification delivery endpoint
//
// Auth — two paths:
//   1. Internal (DB trigger, server actions, cron):
//      Header:  x-push-secret: <PUSH_API_SECRET>
//      Body:    { user_id, user_ids, title, body, url }  — can target any user
//
//   2. Client-authenticated (user's own browser, pushing to their other devices):
//      Header:  Authorization: Bearer <supabase-access-token>
//      Body:    { title, body, url }
//      Enforces: can only deliver to the authenticated user's own subscriptions
// ---------------------------------------------------------------------------

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@screenplaystudio.fun';
const PUSH_API_SECRET = process.env.PUSH_API_SECRET || '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-push-secret');
    const authHeader = req.headers.get('authorization');

    let targetIds: string[] = [];
    let body: Record<string, unknown> = {};

    // ── Auth path 1: internal secret ──────────────────────────────────────────
    if (PUSH_API_SECRET && secret === PUSH_API_SECRET) {
      body = await req.json();
      const user_id = body.user_id as string | undefined;
      const user_ids = body.user_ids as string[] | undefined;
      targetIds = user_ids ?? (user_id ? [user_id] : []);
      if (targetIds.length === 0) {
        return NextResponse.json({ error: 'No user_id(s) provided' }, { status: 400 });
      }

    // ── Auth path 2: user session token (push to own devices only) ───────────
    } else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // Validate the token against Supabase
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
      if (authErr || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      body = await req.json();
      // Session-auth callers can ONLY push to their own subscriptions
      targetIds = [user.id];

    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── VAPID check ───────────────────────────────────────────────────────────
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json(
        { error: 'VAPID keys not configured. Run: node scripts/generate-vapid-keys.mjs' },
        { status: 500 },
      );
    }

    const { title, body: notifBody, url } = body;

    const supabase = createAdminSupabaseClient();

    // ── Fetch push subscriptions ──────────────────────────────────────────────
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

    const payload = JSON.stringify({
      title: title || 'Screenplay Studio',
      body: notifBody || '',
      url: url || '/notifications',
      tag: `notif-${Date.now()}`,
    });

    let sent = 0;
    const expired: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const keys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys;
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
            payload,
          );
          sent++;
        } catch (err: unknown) {
          const pushErr = err as { statusCode?: number; body?: string };
          if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
            expired.push(sub.id);
          } else {
            console.error('[push/send] Failed for', sub.endpoint, pushErr?.statusCode, pushErr?.body);
          }
        }
      }),
    );

    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired);
    }

    return NextResponse.json({ sent, expired: expired.length });
  } catch (err) {
    console.error('[push/send] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
