import logger from '@/lib/logger';
import type { createAdminSupabaseClient } from '@/lib/supabase/admin';

type Db = ReturnType<typeof createAdminSupabaseClient>;

/** Marks notifications that tell someone we just emailed them. */
export const EMAIL_SENT_KIND = 'email_sent';

/**
 * Our emails often land in spam. After the team emails someone, leave them an
 * in-app notice (shown as a banner by <EmailSpamNotice>) asking them to look
 * there and mark it "Not spam". One unread notice per person: a newer email
 * replaces the older notice instead of stacking them.
 */
export async function recordEmailSent(db: Db, userId: string, subject: string) {
  try {
    await db.from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('read', false)
      .eq('metadata->>kind', EMAIL_SENT_KIND);
    const { error } = await db.from('notifications').insert({
      user_id: userId,
      type: 'general',
      title: 'We sent you an email',
      body: `"${subject.slice(0, 140)}" — if it isn't in your inbox, check your spam or junk folder and mark it as "Not spam".`,
      metadata: { kind: EMAIL_SENT_KIND, subject: subject.slice(0, 200) },
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    // Never fail a send because the reminder couldn't be written
    logger.warn('[email]', `email-sent notice for ${userId} failed: ${err instanceof Error ? err.message : err}`);
  }
}
