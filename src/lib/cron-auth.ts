import { NextResponse } from 'next/server';

/**
 * Vercel Cron calls scheduled routes with `Authorization: Bearer $CRON_SECRET`.
 * Returns a response to send back when the caller isn't the scheduler, or
 * null when the request may proceed. Without this, anyone could hit a cron
 * URL repeatedly (e.g. to spam Discord announcements).
 */
export function rejectUnlessCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
