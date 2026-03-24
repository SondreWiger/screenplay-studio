import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════
// Moderation Actions API — Admin-only
// Handles: update flag status, preserve evidence, ban/warn users,
//          DM users, delete content, unban/unsuspend
// ═══════════════════════════════════════════════════════════════

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
const SYSTEM_UID = '00000000-0000-0000-0000-000000000000';
const APPEAL_EMAIL = 'sondre@northem.no';

// ── Send a SYSTEM DM to a user ──────────────────────────────
async function sendSystemDM(supabase: ReturnType<typeof createAdminSupabaseClient>, userId: string, message: string) {
  // Find existing system→user conversation
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

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const supabase = createAdminSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (user.id === ADMIN_UID || profile?.role === 'admin') {
    return user.id;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;
  const supabase = createAdminSupabaseClient();

  switch (action) {
    // ── Update flag status ──────────────────────────────────
    case 'update_flag': {
      const { flag_id, status, review_notes, action_taken } = body;
      if (!flag_id || !status) {
        return NextResponse.json({ error: 'Missing flag_id or status' }, { status: 400 });
      }

      const { error } = await supabase
        .from('content_flags')
        .update({
          status,
          review_notes: review_notes || null,
          action_taken: action_taken || null,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', flag_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_update_flag',
        entity_type: 'content_flag',
        entity_id: flag_id,
        metadata: { status, action_taken, review_notes },
      });

      return NextResponse.json({ success: true });
    }

    // ── Preserve evidence for a flag ────────────────────────
    case 'preserve_evidence': {
      const { flag_id, content_type, content_id, full_content, author_id } = body;
      if (!flag_id || !content_type || !content_id || !full_content || !author_id) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const { data: author } = await supabase
        .from('profiles')
        .select('email, full_name, display_name')
        .eq('id', author_id)
        .single();

      const { data: flag } = await supabase
        .from('content_flags')
        .select('project_id, matched_terms')
        .eq('id', flag_id)
        .single();

      const { error } = await supabase.from('moderation_evidence').insert({
        flag_id,
        content_type,
        content_id,
        full_content,
        content_metadata: {
          project_id: flag?.project_id,
          matched_terms: flag?.matched_terms,
          preserved_at: new Date().toISOString(),
        },
        author_id,
        author_email: author?.email || null,
        author_name: author?.full_name || author?.display_name || null,
        captured_by: adminId,
        content_hash: createHash('sha256').update(full_content, 'utf8').digest('hex'),
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_preserve_evidence',
        entity_type: 'moderation_evidence',
        entity_id: flag_id,
        metadata: { content_type, content_id, author_id },
      });

      return NextResponse.json({ success: true });
    }

    // ── Warn a user ─────────────────────────────────────────
    case 'warn_user': {
      const { user_id, reason, flag_id } = body;
      if (!user_id || !reason) {
        return NextResponse.json({ error: 'Missing user_id or reason' }, { status: 400 });
      }

      await supabase.from('user_bans').insert({
        user_id,
        banned_by: adminId,
        reason,
        ban_type: 'warning',
        is_active: true,
      });

      await supabase.from('profiles').update({
        moderation_status: 'warned',
        moderation_notes: reason,
      }).eq('id', user_id);

      if (flag_id) {
        await supabase.from('content_flags').update({
          status: 'actioned',
          action_taken: 'user_warned',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        }).eq('id', flag_id);
      }

      // System DM notification
      await sendSystemDM(supabase, user_id,
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
        entity_id: user_id,
        metadata: { reason, flag_id },
      });

      return NextResponse.json({ success: true });
    }

    // ── Suspend a user ──────────────────────────────────────
    case 'suspend_user': {
      const { user_id, reason, duration_days, flag_id } = body;
      if (!user_id || !reason) {
        return NextResponse.json({ error: 'Missing user_id or reason' }, { status: 400 });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (duration_days || 30));

      await supabase.from('user_bans').insert({
        user_id,
        banned_by: adminId,
        reason,
        ban_type: 'temporary',
        expires_at: expiresAt.toISOString(),
        is_active: true,
      });

      await supabase.from('profiles').update({
        moderation_status: 'suspended',
        moderation_notes: reason,
      }).eq('id', user_id);

      if (flag_id) {
        await supabase.from('content_flags').update({
          status: 'actioned',
          action_taken: 'user_suspended',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        }).eq('id', flag_id);
      }

      // System DM notification
      await sendSystemDM(supabase, user_id,
        `🔒 **Account Suspended**\n\n` +
        `Your account has been temporarily suspended by the moderation team.\n\n` +
        `**Reason:** ${reason}\n` +
        `**Duration:** ${duration_days || 30} days\n` +
        `**Expires:** ${expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
        `During this suspension, your access to the platform is restricted.\n\n` +
        `If you believe this was a mistake, you can appeal by emailing **${APPEAL_EMAIL}**.`
      );

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_suspend_user',
        entity_type: 'user',
        entity_id: user_id,
        metadata: { reason, duration_days, flag_id },
      });

      return NextResponse.json({ success: true });
    }

    // ── Ban a user permanently ──────────────────────────────
    case 'ban_user': {
      const { user_id, reason, flag_id } = body;
      if (!user_id || !reason) {
        return NextResponse.json({ error: 'Missing user_id or reason' }, { status: 400 });
      }

      const { data: banData } = await supabase.from('user_bans').insert({
        user_id,
        banned_by: adminId,
        reason,
        ban_type: 'permanent',
        is_active: true,
      }).select('id').single();

      await supabase.from('profiles').update({
        moderation_status: 'banned',
        moderation_notes: reason,
      }).eq('id', user_id);

      // Store user's known IP as banned
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('last_known_ip')
        .eq('id', user_id)
        .single();

      if (userProfile?.last_known_ip) {
        await supabase.from('banned_ips').insert({
          ip_address: userProfile.last_known_ip,
          user_id,
          ban_id: banData?.id || null,
          reason,
          is_active: true,
        });
      }

      // Remove all project memberships
      await supabase.from('project_members').delete().eq('user_id', user_id);

      if (flag_id) {
        await supabase.from('content_flags').update({
          status: 'actioned',
          action_taken: 'user_banned',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        }).eq('id', flag_id);
      }

      // System DM notification (they'll see this if they ever get unbanned)
      await sendSystemDM(supabase, user_id,
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
        entity_id: user_id,
        metadata: { reason, flag_id },
      });

      return NextResponse.json({ success: true });
    }

    // ── DM a user (create conversation + send message) ──────
    case 'dm_user': {
      const { user_id, message } = body;
      if (!user_id || !message) {
        return NextResponse.json({ error: 'Missing user_id or message' }, { status: 400 });
      }

      // Check for existing DM conversation between admin and user
      const { data: existingConvos } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', adminId);

      let conversationId: string | null = null;

      if (existingConvos) {
        for (const ec of existingConvos) {
          const { data: otherMember } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', ec.conversation_id)
            .eq('user_id', user_id)
            .single();
          if (otherMember) {
            conversationId = ec.conversation_id;
            break;
          }
        }
      }

      if (!conversationId) {
        // Create new conversation
        const { data: newConvo } = await supabase
          .from('conversations')
          .insert({
            conversation_type: 'direct',
            created_by: adminId,
          })
          .select('id')
          .single();

        if (!newConvo) {
          return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
        }
        conversationId = newConvo.id;

        // Add both members
        await supabase.from('conversation_members').insert([
          { conversation_id: conversationId, user_id: adminId, role: 'admin' },
          { conversation_id: conversationId, user_id, role: 'member' },
        ]);
      }

      // Send the message
      const { error } = await supabase.from('direct_messages').insert({
        conversation_id: conversationId,
        sender_id: adminId,
        content: message,
        message_type: 'text',
      });

      // Update conversation last_message_at
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
      }).eq('id', conversationId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_dm_user',
        entity_type: 'user',
        entity_id: user_id,
        metadata: { message_preview: message.slice(0, 100) },
      });

      return NextResponse.json({ success: true, conversation_id: conversationId });
    }

    // ── Delete flagged content ──────────────────────────────
    case 'delete_content': {
      const { flag_id, content_type, content_id } = body;
      if (!content_type || !content_id) {
        return NextResponse.json({ error: 'Missing content_type or content_id' }, { status: 400 });
      }

      // Map content_type to table name
      const tableMap: Record<string, string> = {
        script_element: 'script_elements',
        idea: 'ideas',
        document: 'project_documents',
        scene: 'scenes',
        character: 'characters',
        channel_message: 'channel_messages',
        direct_message: 'direct_messages',
      };

      const table = tableMap[content_type];
      if (!table) {
        return NextResponse.json({ error: 'Invalid content_type' }, { status: 400 });
      }

      // For messages, soft-delete by marking is_deleted
      if (content_type === 'channel_message' || content_type === 'direct_message') {
        await supabase.from(table).update({
          is_deleted: true,
          content: '[Content removed by moderation]',
        }).eq('id', content_id);
      } else {
        // Hard delete for other content types
        await supabase.from(table).delete().eq('id', content_id);
      }

      if (flag_id) {
        await supabase.from('content_flags').update({
          status: 'actioned',
          action_taken: 'content_removed',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        }).eq('id', flag_id);
      }

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_delete_content',
        entity_type: content_type,
        entity_id: content_id,
        metadata: { flag_id },
      });

      // Notify the content author via System DM
      if (flag_id) {
        const { data: flagData } = await supabase
          .from('content_flags')
          .select('flagged_user_id, flag_reason, content_snippet')
          .eq('id', flag_id)
          .single();
        if (flagData?.flagged_user_id) {
          await sendSystemDM(supabase, flagData.flagged_user_id,
            `🗑️ **Content Removed**\n\n` +
            `Content you authored has been removed by the moderation team for violating our community guidelines.\n\n` +
            `**Type:** ${content_type.replace('_', ' ')}\n` +
            `**Reason:** ${flagData.flag_reason}\n\n` +
            `If you believe this was a mistake, you can reach out by emailing **${APPEAL_EMAIL}**.`
          );
        }
      }

      return NextResponse.json({ success: true });
    }

    // ── Unban / Pardon a user ────────────────────────────────
    case 'unban_user': {
      const { user_id, reason } = body;
      if (!user_id) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
      }

      // Deactivate all active bans
      await supabase.from('user_bans')
        .update({ is_active: false })
        .eq('user_id', user_id)
        .eq('is_active', true);

      // Deactivate IP bans for this user
      await supabase.from('banned_ips')
        .update({ is_active: false })
        .eq('user_id', user_id)
        .eq('is_active', true);

      // Reset profile moderation status
      await supabase.from('profiles').update({
        moderation_status: 'clean',
        moderation_notes: reason || 'Ban lifted by admin',
        moderation_flags: 0,
      }).eq('id', user_id);

      // Mark related flags as false_positive
      await supabase.from('content_flags')
        .update({ status: 'false_positive', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq('flagged_user_id', user_id)
        .in('status', ['pending', 'reviewing', 'confirmed']);

      // System DM
      await sendSystemDM(supabase, user_id,
        `✅ **Account Restored**\n\n` +
        `Your account has been unbanned and restored to good standing.\n\n` +
        (reason ? `**Note:** ${reason}\n\n` : '') +
        `Welcome back! Please review our community guidelines to avoid future issues.`
      );

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_unban_user',
        entity_type: 'user',
        entity_id: user_id,
        metadata: { reason },
      });

      return NextResponse.json({ success: true });
    }

    // ── Unsuspend a user ─────────────────────────────────────
    case 'unsuspend_user': {
      const { user_id, reason } = body;
      if (!user_id) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
      }

      // Deactivate temporary bans
      await supabase.from('user_bans')
        .update({ is_active: false })
        .eq('user_id', user_id)
        .eq('ban_type', 'temporary')
        .eq('is_active', true);

      // Reset status
      await supabase.from('profiles').update({
        moderation_status: 'clean',
        moderation_notes: reason || 'Suspension lifted by admin',
      }).eq('id', user_id);

      // System DM
      await sendSystemDM(supabase, user_id,
        `✅ **Suspension Lifted**\n\n` +
        `Your account suspension has been lifted early.\n\n` +
        (reason ? `**Note:** ${reason}\n\n` : '') +
        `Your access has been fully restored. Please follow our community guidelines going forward.`
      );

      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'moderation_unsuspend_user',
        entity_type: 'user',
        entity_id: user_id,
        metadata: { reason },
      });

      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
