/**
 * Email delivery for in-app notifications. Server-only (service role).
 *
 * Every notification row can produce at most one email. Which ones do, and
 * whether the recipient wants it, follows the switches in
 * Settings → Notifications (profiles.email_*). The outcome is written to
 * notifications.metadata.email_status so a row is never emailed twice.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendNotificationEmail, escapeHtml } from '@/lib/mailer';

export type EmailPref =
  | 'email_project_invites'
  | 'email_mentions'
  | 'email_direct_messages'
  | 'email_ticket_replies';

/** Notification types that can send an email, and the setting that controls each. */
export const EMAIL_PREF_BY_TYPE: Record<string, EmailPref> = {
  project_invitation: 'email_project_invites',
  company_invitation: 'email_project_invites',
  collaborator_added: 'email_project_invites',
  mention: 'email_mentions',
  chat_mention: 'email_mentions',
  project_comment: 'email_mentions',
  community_comment: 'email_mentions',
  community_reply: 'email_mentions',
  blog_comment: 'email_mentions',
  company_blog_comment: 'email_mentions',
  direct_message: 'email_direct_messages',
  ticket_reply: 'email_ticket_replies',
};

const PREF_DEFAULTS: Record<EmailPref, boolean> = {
  email_project_invites: true,
  email_mentions: true,
  email_direct_messages: true,
  email_ticket_replies: true,
};

/** One email per conversation in this window, however many messages arrive. */
const DM_EMAIL_COOLDOWN_MS = 30 * 60_000;

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  actor_id: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type EmailOutcome =
  | 'sent'
  | 'failed'
  | 'already_handled'
  | 'type_not_emailed'
  | 'opted_out'
  | 'no_address'
  | 'cooldown';

/** Whether the recipient's settings allow this email. Missing values use the column defaults. */
export function wantsEmail(pref: EmailPref, profile: Partial<Record<EmailPref, boolean | null>> | null): boolean {
  const value = profile?.[pref];
  return value === null || value === undefined ? PREF_DEFAULTS[pref] : value;
}

/** Plain notification text → safe email HTML (escaped, line breaks kept). */
export function notificationBodyHtml(body: string | null): string {
  return escapeHtml(body || '').replace(/\n/g, '<br>');
}

async function setStatus(db: SupabaseClient, n: NotificationRecord, status: string, extra: Record<string, unknown> = {}) {
  await db
    .from('notifications')
    .update({ metadata: { ...(n.metadata || {}), email_status: status, ...extra } })
    .eq('id', n.id);
}

async function recipientEmail(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data: contact } = await db.from('profile_contact').select('email').eq('id', userId).maybeSingle();
  if (contact?.email) return contact.email;
  // Before the private-profile migration the address was on profiles
  const { data: legacy } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
  if (legacy?.email) return legacy.email as string;
  const { data } = await db.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

type RecipientProfile = Partial<Record<EmailPref, boolean | null>> & { display_name?: string | null; full_name?: string | null };

async function recipientPrefs(db: SupabaseClient, userId: string): Promise<RecipientProfile | null> {
  const { data, error } = await db
    .from('profiles')
    .select('display_name, full_name, email_project_invites, email_mentions, email_direct_messages, email_ticket_replies')
    .eq('id', userId)
    .maybeSingle();
  if (!error) return data as RecipientProfile | null;
  // email_* columns not created yet (migration 20261001000200): defaults apply
  const { data: basic } = await db.from('profiles').select('display_name, full_name').eq('id', userId).maybeSingle();
  return basic as RecipientProfile | null;
}

/**
 * Send the email for one notification, if its type sends one and the
 * recipient wants it. Safe to call more than once for the same row.
 */
export async function deliverNotificationEmail(db: SupabaseClient, n: NotificationRecord): Promise<EmailOutcome> {
  const pref = EMAIL_PREF_BY_TYPE[n.type];
  if (!pref) return 'type_not_emailed';
  if (n.metadata && 'email_status' in n.metadata) return 'already_handled';

  // Claim the row so a concurrent call (another tab, the webhook) skips it
  const { data: claimed } = await db
    .from('notifications')
    .update({ metadata: { ...(n.metadata || {}), email_status: 'pending' } })
    .eq('id', n.id)
    .is('metadata->>email_status', null)
    .select('id');
  if (!claimed?.length) return 'already_handled';
  n = { ...n, metadata: { ...(n.metadata || {}), email_status: 'pending' } };

  const profile = await recipientPrefs(db, n.user_id);
  if (!wantsEmail(pref, profile)) {
    await setStatus(db, n, 'opted_out');
    return 'opted_out';
  }

  if (n.type === 'direct_message' && n.entity_id) {
    const since = new Date(Date.now() - DM_EMAIL_COOLDOWN_MS).toISOString();
    const { data: recent } = await db
      .from('notifications')
      .select('id')
      .eq('user_id', n.user_id)
      .eq('type', 'direct_message')
      .eq('entity_id', n.entity_id)
      .eq('metadata->>email_status', 'sent')
      .gte('created_at', since)
      .neq('id', n.id)
      .limit(1);
    if (recent?.length) {
      await setStatus(db, n, 'cooldown');
      return 'cooldown';
    }
  }

  const email = await recipientEmail(db, n.user_id);
  if (!email) {
    await setStatus(db, n, 'no_address');
    return 'no_address';
  }

  const result = await sendNotificationEmail({
    to: { email, name: profile?.display_name || profile?.full_name || undefined },
    subject: n.title,
    heading: escapeHtml(n.title),
    body: notificationBodyHtml(n.body),
    ctaLabel: n.link ? 'Open in Screenplay Studio' : undefined,
    ctaUrl: n.link || undefined,
  });
  if (result.success) {
    await setStatus(db, n, 'sent', { email_id: result.messageId });
    return 'sent';
  }
  await setStatus(db, n, 'failed', { email_error: (result.error || 'unknown').slice(0, 300) });
  return 'failed';
}
