'use server';

/**
 * Server actions that send email. Anything exported from a 'use server' file
 * can be called by any visitor with any arguments, so every action here:
 * - checks who is calling,
 * - takes ids, never addresses or message text — the recipient and the
 *   content are looked up on the server,
 * - is rate limited.
 * Bulk and admin mail goes through /api/admin/email/* instead.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { findUserByEmail, getEmailsByIds } from '@/lib/private-profile';
import { checkRateLimit } from '@/lib/rate-limit';
import { escapeHtml } from '@/lib/utils';
import logger from '@/lib/logger';
import {
  sendNotificationEmail,
  sendWelcomeEmail,
  sendProjectInviteEmail,
  sendTicketReplyEmail,
} from '@/lib/mailer';

type Result = { success: boolean; error?: string };

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || process.env.ADMIN_UID || '';
/** The welcome email may only go to an account this new. */
const WELCOME_WINDOW_MS = 15 * 60_000;
/** Comment emails may only be sent this soon after the comment was posted. */
const COMMENT_WINDOW_MS = 10 * 60_000;

async function currentUserId(): Promise<string | null> {
  const { data: { user } } = await createServerSupabaseClient().auth.getUser();
  return user?.id ?? null;
}

function limited(key: string, max: number, windowMs: number): Result | null {
  return checkRateLimit(`email-action:${key}`, max, windowMs).allowed ? null : { success: false, error: 'Too many emails, try again later' };
}

function fail(where: string, err: unknown): Result {
  logger.error('[email-action]', `${where}:`, err);
  return { success: false, error: 'Could not send email' };
}

/**
 * Welcome email right after sign-up. The caller may not have a session yet
 * (email confirmation), so instead the address must belong to an account
 * created in the last few minutes, and each address gets it once per window.
 */
export async function sendWelcomeEmailAction(email: string, name: string): Promise<Result> {
  try {
    const address = String(email ?? '').trim().toLowerCase();
    if (!address) return { success: false, error: 'Missing email' };
    const tooMany = limited(`welcome:${address}`, 1, WELCOME_WINDOW_MS);
    if (tooMany) return tooMany;

    const db = createAdminSupabaseClient();
    const found = await findUserByEmail(db, address);
    if (!found) return { success: false, error: 'Unknown account' };
    const { data } = await db.auth.admin.getUserById(found.id);
    const authUser = data?.user;
    const createdAt = authUser?.created_at ? Date.parse(authUser.created_at) : 0;
    if (!authUser || !createdAt || Date.now() - createdAt > WELCOME_WINDOW_MS) return { success: false, error: 'Not a new account' };
    // Exactly once per account, across server instances
    if (authUser.user_metadata?.welcome_email_sent_at) return { success: false, error: 'Welcome already sent' };
    await db.auth.admin.updateUserById(found.id, {
      user_metadata: { ...authUser.user_metadata, welcome_email_sent_at: new Date().toISOString() },
    });

    const displayName = (found.display_name || found.full_name || String(name ?? '')).slice(0, 60);
    return await sendWelcomeEmail({ email: address, name: displayName });
  } catch (err) {
    return fail('welcome', err);
  }
}

/** Tell someone they were added to a project. Only project owners/admins, only to members. */
export async function sendProjectInviteEmailAction(projectId: string, recipientUserId: string): Promise<Result> {
  try {
    const uid = await currentUserId();
    if (!uid) return { success: false, error: 'Unauthorized' };
    const tooMany = limited(`invite:${uid}`, 30, 60 * 60_000);
    if (tooMany) return tooMany;

    const db = createAdminSupabaseClient();
    const [{ data: canManage }, { data: membership }, { data: project }, { data: inviter }] = await Promise.all([
      db.rpc('is_project_owner_or_admin', { p_project_id: projectId, p_user_id: uid }),
      db.from('project_members').select('user_id').eq('project_id', projectId).eq('user_id', recipientUserId).maybeSingle(),
      db.from('projects').select('title').eq('id', projectId).maybeSingle(),
      db.from('profiles').select('display_name, full_name').eq('id', uid).maybeSingle(),
    ]);
    if (!canManage) return { success: false, error: 'Forbidden' };
    if (!membership || !project) return { success: false, error: 'Not a member of this project' };

    const [{ data: recipient }, emails] = await Promise.all([
      db.from('profiles').select('display_name, full_name').eq('id', recipientUserId).maybeSingle(),
      getEmailsByIds(db, [recipientUserId]),
    ]);
    const to = emails.get(recipientUserId);
    if (!to) return { success: false, error: 'No email on file' };

    return await sendProjectInviteEmail(
      { email: to, name: recipient?.display_name || recipient?.full_name || '' },
      project.title || 'a project',
      inviter?.display_name || inviter?.full_name || 'Someone',
      projectId,
    );
  } catch (err) {
    return fail('invite', err);
  }
}

/** Tell a ticket's owner that staff replied. Staff only. */
export async function sendTicketReplyEmailAction(ticketId: string): Promise<Result> {
  try {
    const uid = await currentUserId();
    if (!uid) return { success: false, error: 'Unauthorized' };
    const db = createAdminSupabaseClient();
    const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle();
    if (uid !== ADMIN_UID && me?.role !== 'admin' && me?.role !== 'moderator') return { success: false, error: 'Forbidden' };
    const tooMany = limited(`ticket:${ticketId}`, 3, 10 * 60_000);
    if (tooMany) return tooMany;

    const { data: ticket } = await db.from('support_tickets').select('id, subject, user_id').eq('id', ticketId).maybeSingle();
    if (!ticket) return { success: false, error: 'Ticket not found' };
    const [{ data: owner }, emails] = await Promise.all([
      db.from('profiles').select('display_name, full_name').eq('id', ticket.user_id).maybeSingle(),
      getEmailsByIds(db, [ticket.user_id]),
    ]);
    const to = emails.get(ticket.user_id);
    if (!to) return { success: false, error: 'No email on file' };

    return await sendTicketReplyEmail({ email: to, name: owner?.display_name || owner?.full_name || '' }, ticket.subject, ticket.id);
  } catch (err) {
    return fail('ticket', err);
  }
}

/**
 * Email a project's members about a new comment. Only the comment's author,
 * only shortly after posting, only to members of that project.
 */
export async function sendCommentEmailAction(commentId: string): Promise<Result & { sent?: number }> {
  try {
    const uid = await currentUserId();
    if (!uid) return { success: false, error: 'Unauthorized' };
    const tooMany = limited(`comment:${uid}`, 20, 60 * 60_000);
    if (tooMany) return tooMany;

    const db = createAdminSupabaseClient();
    const { data: comment } = await db.from('comments')
      .select('id, project_id, content, comment_type, created_by, created_at')
      .eq('id', commentId).maybeSingle();
    if (!comment || comment.created_by !== uid) return { success: false, error: 'Forbidden' };
    if (Date.now() - Date.parse(comment.created_at) > COMMENT_WINDOW_MS) return { success: false, error: 'Too late to notify' };

    const [{ data: project }, { data: actor }, { data: members }] = await Promise.all([
      db.from('projects').select('title').eq('id', comment.project_id).maybeSingle(),
      db.from('profiles').select('display_name, full_name').eq('id', uid).maybeSingle(),
      db.from('project_members').select('user_id').eq('project_id', comment.project_id).neq('user_id', uid),
    ]);
    const ids = (members ?? []).map((m) => m.user_id as string);
    if (ids.length === 0) return { success: true, sent: 0 };

    const [{ data: profiles }, emails] = await Promise.all([
      db.from('profiles').select('id, display_name, full_name').in('id', ids),
      getEmailsByIds(db, ids),
    ]);
    const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name || p.full_name || '') as string]));
    const kind = comment.comment_type || 'comment';
    const title = project?.title || 'project';
    const actorName = actor?.display_name || actor?.full_name || 'Someone';
    const preview = escapeHtml(String(comment.content ?? '').slice(0, 200)).replace(/\n/g, '<br>');

    let sent = 0;
    for (const id of ids) {
      const to = emails.get(id);
      if (!to) continue;
      const r = await sendNotificationEmail({
        to: { email: to, name: names.get(id) },
        subject: `New ${kind} on ${title}`,
        heading: escapeHtml(`New ${kind} from ${actorName}`),
        body: preview,
        ctaLabel: 'View Comment',
        ctaUrl: `/projects/${comment.project_id}/comments`,
      });
      if (r.success) sent++;
    }
    return { success: true, sent };
  } catch (err) {
    return fail('comment', err);
  }
}
