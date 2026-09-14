import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createHash } from 'crypto';
import { moderateUser, sendSystemDM } from '@/lib/moderation';

// ═══════════════════════════════════════════════════════════════
// Moderation Actions API — Admin-only
// Handles: update flag status, preserve evidence, ban/warn users,
//          DM users, delete content, unban/unsuspend
// ═══════════════════════════════════════════════════════════════

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || process.env.ADMIN_UID || '';
const APPEAL_EMAIL = process.env.APPEAL_EMAIL || 'support@screenplaystudio.app';

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

function moderationResponse(result: Awaited<ReturnType<typeof moderateUser>>) {
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
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
    // Update flag status
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

    // Preserve evidence for a flag
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

    // Warn a user
    case 'warn_user': {
      return moderationResponse(await moderateUser(supabase, adminId, 'warn', {
        userId: body.user_id, reason: body.reason, durationDays: body.duration_days, flagId: body.flag_id,
      }));
    }

    // Suspend a user
    case 'suspend_user': {
      return moderationResponse(await moderateUser(supabase, adminId, 'suspend', {
        userId: body.user_id, reason: body.reason, durationDays: body.duration_days, flagId: body.flag_id,
      }));
    }

    // Ban a user permanently
    case 'ban_user': {
      return moderationResponse(await moderateUser(supabase, adminId, 'ban', {
        userId: body.user_id, reason: body.reason, durationDays: body.duration_days, flagId: body.flag_id,
      }));
    }

    // DM a user (create conversation + send message)
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

    // Delete flagged content
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

    // Unban / Pardon a user
    case 'unban_user': {
      return moderationResponse(await moderateUser(supabase, adminId, 'unban', {
        userId: body.user_id, reason: body.reason, durationDays: body.duration_days, flagId: body.flag_id,
      }));
    }

    // Unsuspend a user
    case 'unsuspend_user': {
      return moderationResponse(await moderateUser(supabase, adminId, 'unsuspend', {
        userId: body.user_id, reason: body.reason, durationDays: body.duration_days, flagId: body.flag_id,
      }));
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
