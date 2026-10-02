'use server';

/**
 * Server actions that send email. Every export of a 'use server' file is a
 * public endpoint, so each one checks who is calling and what they may send.
 * Notification emails (invites, mentions, messages, ticket replies) are not
 * here: they go through /api/notifications/email, which applies each
 * recipient's settings.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { rejectUnlessAdmin } from '@/lib/require-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendNotificationEmail, sendWelcomeEmail } from '@/lib/mailer';

type Result = { success: boolean; error?: string };

/** Admin email tool: send one templated email. Admins only. */
export async function sendAdminEmailAction(
  email: string,
  name: string | undefined,
  subject: string,
  heading: string,
  body: string,
  ctaLabel?: string,
  ctaUrl?: string,
): Promise<Result> {
  try {
    const { data: { user } } = await createServerSupabaseClient().auth.getUser();
    if (await rejectUnlessAdmin(user?.id)) return { success: false, error: 'Only admins can send emails.' };
    return await sendNotificationEmail({ to: { email, name }, subject, heading, body, ctaLabel, ctaUrl });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Welcome email after sign-up. Only sent to an address that belongs to an
 * account created in the last 30 minutes, at most once per address per hour,
 * so it can't be pointed at arbitrary people.
 */
export async function sendWelcomeEmailAction(email: string, name: string): Promise<Result> {
  try {
    const address = email.trim().toLowerCase();
    if (!address) return { success: false, error: 'No address' };
    if (!checkRateLimit(`welcome-email:${address}`, 1, 60 * 60_000).allowed) return { success: false, error: 'Already sent' };

    const db = createAdminSupabaseClient();
    let userId: string | null = null;
    const { data: contact, error } = await db.from('profile_contact').select('id').ilike('email', address).maybeSingle();
    if (!error) userId = contact?.id ?? null;
    if (!userId) {
      // Before the private-profile migration the address was on profiles
      const { data: legacy } = await db.from('profiles').select('id').ilike('email', address).maybeSingle();
      userId = (legacy?.id as string | undefined) ?? null;
    }
    if (!userId) return { success: false, error: 'No new account with that address' };

    const { data: profile } = await db.from('profiles').select('created_at').eq('id', userId).maybeSingle();
    const createdAt = profile?.created_at ? new Date(profile.created_at as string).getTime() : 0;
    if (Date.now() - createdAt > 30 * 60_000) return { success: false, error: 'Account is not new' };

    return await sendWelcomeEmail({ email: address, name: name.trim().slice(0, 80) });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
