import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, sendNotificationEmail } from '@/lib/mailer';

// ---------------------------------------------------------------------------
// Email sending API route
// POST /api/email/send
// Body: { to, subject, heading, body, ctaLabel?, ctaUrl?, tags? }
// ---------------------------------------------------------------------------

const PUSH_API_SECRET = process.env.PUSH_API_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    // Auth: require PUSH_API_SECRET in production
    const secret = req.headers.get('x-push-secret');
    if (!PUSH_API_SECRET) {
      return NextResponse.json({ error: 'PUSH_API_SECRET not configured' }, { status: 500 });
    }
    if (secret !== PUSH_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { to, subject, heading, body: emailBody, ctaLabel, ctaUrl, html, text, tags } = payload;

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required fields: to, subject' }, { status: 400 });
    }

    // If raw html/text provided, use sendEmail directly
    if (html || text) {
      const result = await sendEmail({
        to: Array.isArray(to) ? to : [typeof to === 'string' ? { email: to } : to],
        subject,
        html,
        text,
        tags,
      });
      return NextResponse.json(result);
    }

    // Otherwise use the notification template
    const toRecipient = typeof to === 'string' ? { email: to } : to;
    const result = await sendNotificationEmail({
      to: toRecipient,
      subject,
      heading: heading || subject,
      body: emailBody || '',
      ctaLabel,
      ctaUrl,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[email/send] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
