import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { sendNotificationEmail } from '@/lib/mailer';

function replaceVars(str: string, vars: Record<string, string>): string {
  let result = str;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, val);
  }
  return result;
}

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  const userClient = createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { userIds, subject, heading, body: emailBody, ctaLabel, ctaUrl } = body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'userIds must be a non-empty array' }, { status: 400 });
  }
  if (!subject || !heading || !emailBody) {
    return NextResponse.json({ error: 'Missing required fields: subject, heading, body' }, { status: 400 });
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: profiles, error: fetchError } = await adminSupabase
    .from('profiles')
    .select('id, email, full_name, display_name')
    .in('id', userIds);

  if (fetchError) {
    return NextResponse.json({ error: `Failed to fetch profiles: ${fetchError.message}` }, { status: 500 });
  }

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const userId of userIds) {
    const profile = profileMap.get(userId);
    if (!profile?.email) {
      failed++;
      errors.push(`No email found for user ${userId}`);
      continue;
    }

    const name = profile.display_name || profile.full_name || 'there';
    const vars = { name, email: profile.email };

    const result = await sendNotificationEmail({
      to: { email: profile.email, name },
      subject: replaceVars(subject, vars),
      heading: replaceVars(heading, vars),
      body: replaceVars(emailBody, vars),
      ctaLabel: ctaLabel ? replaceVars(ctaLabel, vars) : undefined,
      ctaUrl: ctaUrl ? replaceVars(ctaUrl, vars) : undefined,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${userId}: ${result.error ?? 'unknown error'}`);
    }

    if (userIds.indexOf(userId) < userIds.length - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return NextResponse.json({ sent, failed, errors });
}
