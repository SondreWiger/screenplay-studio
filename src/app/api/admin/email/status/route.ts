import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rejectUnlessAdmin } from '@/lib/require-admin';

/**
 * GET /api/admin/email/status — is outgoing mail set up to reach inboxes?
 * Without EMAIL_FROM, mail goes out from Resend's shared test sender, which
 * providers routinely file as spam.
 */
export async function GET() {
  const { data: { user } } = await createServerSupabaseClient().auth.getUser();
  const denied = await rejectUnlessAdmin(user?.id);
  if (denied) return denied;

  const from = process.env.EMAIL_FROM || '';
  const domain = from.match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? null;
  return NextResponse.json({
    resendConfigured: !!process.env.RESEND_API_KEY,
    fromConfigured: !!from,
    from: from || 'Screenplay Studio <onboarding@resend.dev>',
    sharedSender: !from || domain === 'resend.dev',
    domain,
  });
}
