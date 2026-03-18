'use client';

import { createClient } from '@/lib/supabase/client';
import type { NotificationType } from '@/lib/types';

// ---------------------------------------------------------------------------
// Push delivery helper — fires from the RECIPIENT's browser via their own
// Supabase session token. Called in useNotifications after receiving a
// realtime notification, so it pushes to the user's OTHER subscribed devices
// (e.g., the notification arrives on their laptop via realtime, and this
// also pushes it to their phone).
// ---------------------------------------------------------------------------
export async function triggerSelfPush(
  title: string,
  body?: string,
  url?: string,
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ title, body: body || '', url: url || '/notifications' }),
    });
  } catch {
    // Push delivery is best-effort
  }
}

/**
 * Create a notification for a user. This inserts directly into the
 * notifications table from the client side — the realtime subscription
 * in useNotifications will pick it up and show it.
 *
 * Also triggers Web Push delivery to the user's subscribed devices.
 *
 * Skips silently if actor_id === user_id (don't notify yourself).
 */
export async function sendNotification({
  userId,
  type,
  title,
  body,
  link,
  actorId,
  entityType,
  entityId,
  metadata = {},
}: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Don't notify yourself
  if (actorId && actorId === userId) return;

  try {
    const supabase = createClient();
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body: body || null,
      link: link || null,
      actor_id: actorId || null,
      entity_type: entityType || null,
      entity_id: entityId || null,
      metadata,
    });
    // Push delivery is handled by the recipient's useNotifications hook,
    // which triggers triggerSelfPush() after receiving the realtime event.
    // This allows proper session auth without exposing PUSH_API_SECRET client-side.
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

/**
 * Notify all members of a project (except the actor).
 */
export async function notifyProjectMembers({
  projectId,
  actorId,
  type,
  title,
  body,
  link,
  entityType,
  entityId,
}: {
  projectId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  try {
    const supabase = createClient();
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId);

    if (!members) return;

    // Also include the project creator
    const { data: project } = await supabase
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single();

    const userIds = new Set(members.map((m) => m.user_id));
    if (project?.created_by) userIds.add(project.created_by);
    userIds.delete(actorId); // Don't notify actor

    const promises = Array.from(userIds).map((userId) =>
      sendNotification({
        userId,
        type,
        title,
        body,
        link,
        actorId,
        entityType,
        entityId,
      })
    );

    await Promise.all(promises);
  } catch (err) {
    console.error('Failed to notify project members:', err);
  }
}

/**
 * Notify all members of a conversation (except the sender).
 */
export async function notifyConversationMembers({
  conversationId,
  senderId,
  senderName,
  messagePreview,
}: {
  conversationId: string;
  senderId: string;
  senderName: string;
  messagePreview: string;
}): Promise<void> {
  try {
    const supabase = createClient();
    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId);

    if (!members) return;

    const promises = members.map((m) =>
      sendNotification({
        userId: m.user_id,
        type: 'direct_message',
        title: `${senderName} sent you a message`,
        body: messagePreview.length > 120 ? messagePreview.slice(0, 120) + '…' : messagePreview,
        link: `/messages?convo=${conversationId}`,
        actorId: senderId,
        entityType: 'conversation',
        entityId: conversationId,
      })
    );

    await Promise.all(promises);
  } catch (err) {
    console.error('Failed to notify conversation members:', err);
  }
}
