import type { SupabaseClient } from '@supabase/supabase-js';
import { getModeration } from '@/lib/private-profile';

/**
 * Account moderation: warnings, suspensions, bans and lifting them.
 *
 * Shared by the admin moderation API and the MCP admin tools, so a ban from
 * either place does the same things — the user_bans row, the profile status
 * the middleware enforces, IP bans, membership removal, the system DM and the
 * audit entry. Server side only; callers pass the service role client.
 */

export const SYSTEM_UID = '00000000-0000-0000-0000-000000000000';
const APPEAL_EMAIL = process.env.APPEAL_EMAIL || 'support@screenplaystudio.app';

export type ModerationAction = 'warn' | 'suspend' | 'ban' | 'unban' | 'unsuspend';

export interface ModerationInput {
  userId: string;
  reason?: string;
  durationDays?: number;
  flagId?: string;
}

/** Send a message from the SYSTEM account, reusing the existing conversation. */
export async function sendSystemDM(supabase: SupabaseClient, userId: string, message: string) {
  const { data: systemConvos } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', SYSTEM_UID);

  let conversationId: string | null = null;

  if (systemConvos) {
    for (const sc of systemConvos) {
      const { data: otherMember } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', sc.conversation_id)
        .eq('user_id', userId)
        .single();
      if (otherMember) {
        conversationId = sc.conversation_id;
        break;
      }
    }
  }

  if (!conversationId) {
    const { data: newConvo } = await supabase
      .from('conversations')
      .insert({ conversation_type: 'direct', created_by: SYSTEM_UID })
      .select('id')
      .single();
    if (!newConvo) return;
    conversationId = newConvo.id;
    await supabase.from('conversation_members').insert([
      { conversation_id: conversationId, user_id: SYSTEM_UID, role: 'admin' },
      { conversation_id: conversationId, user_id: userId, role: 'member' },
    ]);
  }

  await supabase.from('direct_messages').insert({
    conversation_id: conversationId,
    sender_id: SYSTEM_UID,
    content: message,
    message_type: 'system',
  });

  await supabase.from('conversations').update({
    last_message_at: new Date().toISOString(),
  }).eq('id', conversationId);
}

async function markFlag(supabase: SupabaseClient, adminId: string, flagId: string | undefined, actionTaken: string) {
  if (!flagId) return;
  await supabase.from('content_flags').update({
    status: 'actioned',
    action_taken: actionTaken,
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', flagId);
}

export async function moderateUser(
  supabase: SupabaseClient,
  adminId: string,
  action: ModerationAction,
  { userId, reason, durationDays, flagId }: ModerationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!userId) return { ok: false, error: 'Missing user_id' };
  if ((action === 'warn' || action === 'suspend' || action === 'ban') && !reason) {
    return { ok: false, error: 'Missing user_id or reason' };
  }

  switch (action) {
    case 'warn': {
      await supabase.from('user_bans').insert({
        user_id: userId,
        banned_by: adminId,
        reason,
        ban_type: 'warning',
        is_active: true,
      });

      await supabase.from('profiles').update({
        moderation_status: 'warned',
        moderation_notes: reason,
      }).eq('id', userId);

      await markFlag(supabase, adminId, flagId, 'user_warned');

      await sendSystemDM(supabase, userId,
        `⚠️ **Moderation Warning**\n\n` +
        `Your account has received a warning from the moderation team.\n\n` +
        `**Reason:** ${reason}\n\n` +
        `Please review your content and ensure it complies with our community guidelines. ` +
        `Continued violations may result in suspension or a permanent ban.\n\n` +
        `If you believe this was a mistake, you can appeal by emailing **${APPEAL_EMAIL}**.`
      );

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_warn_user',
        entity_type: 'user',
        entity_id: userId,
        metadata: { reason, flag_id: flagId },
      });
      return { ok: true };
    }

    case 'suspend': {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (durationDays || 30));

      await supabase.from('user_bans').insert({
        user_id: userId,
        banned_by: adminId,
        reason,
        ban_type: 'temporary',
        expires_at: expiresAt.toISOString(),
        is_active: true,
      });

      await supabase.from('profiles').update({
        moderation_status: 'suspended',
        moderation_notes: reason,
      }).eq('id', userId);

      await markFlag(supabase, adminId, flagId, 'user_suspended');

      await sendSystemDM(supabase, userId,
        `🔒 **Account Suspended**\n\n` +
        `Your account has been temporarily suspended by the moderation team.\n\n` +
        `**Reason:** ${reason}\n` +
        `**Duration:** ${durationDays || 30} days\n` +
        `**Expires:** ${expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
        `During this suspension, your access to the platform is restricted.\n\n` +
        `If you believe this was a mistake, you can appeal by emailing **${APPEAL_EMAIL}**.`
      );

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_suspend_user',
        entity_type: 'user',
        entity_id: userId,
        metadata: { reason, duration_days: durationDays, flag_id: flagId },
      });
      return { ok: true };
    }

    case 'ban': {
      const { data: banData } = await supabase.from('user_bans').insert({
        user_id: userId,
        banned_by: adminId,
        reason,
        ban_type: 'permanent',
        is_active: true,
      }).select('id').single();

      await supabase.from('profiles').update({
        moderation_status: 'banned',
        moderation_notes: reason,
      }).eq('id', userId);

      // Store user's known IP as banned
      // IP lives in profile_moderation (staff can read it); older rows may
      // still have it on profiles
      const { data: legacyProfile } = await supabase
        .from('profiles')
        .select('last_known_ip')
        .eq('id', userId)
        .single();
      const privateFields = await getModeration(supabase, userId);
      const userProfile = { last_known_ip: privateFields?.last_known_ip || legacyProfile?.last_known_ip || null };

      if (userProfile.last_known_ip) {
        await supabase.from('banned_ips').insert({
          ip_address: userProfile.last_known_ip,
          user_id: userId,
          ban_id: banData?.id || null,
          reason,
          is_active: true,
        });
      }

      // Remove all project memberships
      await supabase.from('project_members').delete().eq('user_id', userId);

      await markFlag(supabase, adminId, flagId, 'user_banned');

      // System DM notification (they'll see this if they ever get unbanned)
      await sendSystemDM(supabase, userId,
        `🚫 **Account Permanently Banned**\n\n` +
        `Your account has been permanently banned from Screenplay Studio.\n\n` +
        `**Reason:** ${reason}\n\n` +
        `You no longer have access to any features on the platform. All project memberships have been revoked.\n\n` +
        `If you believe this was done in error, you may appeal by emailing **${APPEAL_EMAIL}**.`
      );

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_ban_user',
        entity_type: 'user',
        entity_id: userId,
        metadata: { reason, flag_id: flagId },
      });
      return { ok: true };
    }

    case 'unban': {
      // Deactivate all active bans
      await supabase.from('user_bans')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Deactivate IP bans for this user
      await supabase.from('banned_ips')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      await supabase.from('profiles').update({
        moderation_status: 'clean',
        moderation_notes: reason || 'Ban lifted by admin',
        moderation_flags: 0,
      }).eq('id', userId);

      // Mark related flags as false_positive
      await supabase.from('content_flags')
        .update({ status: 'false_positive', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq('flagged_user_id', userId)
        .in('status', ['pending', 'reviewing', 'confirmed']);

      await sendSystemDM(supabase, userId,
        `✅ **Account Restored**\n\n` +
        `Your account has been unbanned and restored to good standing.\n\n` +
        (reason ? `**Note:** ${reason}\n\n` : '') +
        `Welcome back! Please review our community guidelines to avoid future issues.`
      );

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_unban_user',
        entity_type: 'user',
        entity_id: userId,
        metadata: { reason },
      });
      return { ok: true };
    }

    case 'unsuspend': {
      // Deactivate temporary bans
      await supabase.from('user_bans')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('ban_type', 'temporary')
        .eq('is_active', true);

      await supabase.from('profiles').update({
        moderation_status: 'clean',
        moderation_notes: reason || 'Suspension lifted by admin',
      }).eq('id', userId);

      await sendSystemDM(supabase, userId,
        `✅ **Suspension Lifted**\n\n` +
        `Your account suspension has been lifted early.\n\n` +
        (reason ? `**Note:** ${reason}\n\n` : '') +
        `Your access has been fully restored. Please follow our community guidelines going forward.`
      );

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_unsuspend_user',
        entity_type: 'user',
        entity_id: userId,
        metadata: { reason },
      });
      return { ok: true };
    }
  }
}
