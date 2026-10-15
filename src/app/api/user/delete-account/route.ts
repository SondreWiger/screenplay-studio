import logger from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * The web app is signed in with cookies; the iPhone and iPad app sends its
 * access token as `Authorization: Bearer …`. Either identifies the user.
 */
function clientFor(req: NextRequest) {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { supabase: createServerSupabaseClient(), token: undefined };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabase, token };
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, token } = clientFor(req);

    const {
      data: { user },
      error: authErr,
    } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = user.id;
    const admin = createAdminSupabaseClient();

    // Log the attempt (using user's session for audit trail)
    await supabase.from('security_events').insert({
      user_id: uid,
      event_type: 'account_deleted',
      severity: 'critical',
      description: 'Account and all associated data permanently deleted.',
    });

    await supabase.from('audit_log').insert({
      user_id: uid,
      action: 'account_deleted',
      entity_type: 'user',
      entity_id: uid,
    });

    // Use admin client to bypass RLS for deletion
    await Promise.all([
      admin.from('projects').delete().eq('created_by', uid),
      admin.from('community_posts').delete().eq('author_id', uid),
      admin.from('direct_messages').delete().eq('sender_id', uid),
      admin.from('notifications').delete().eq('user_id', uid),
      admin.from('login_history').delete().eq('user_id', uid),
      admin.from('security_events').delete().eq('user_id', uid),
      admin.from('audit_log').delete().eq('user_id', uid),
      admin.from('consent_records').delete().eq('user_id', uid),
      admin.from('data_export_requests').delete().eq('user_id', uid),
      admin.from('deletion_requests').delete().eq('user_id', uid),
      admin.from('user_badges').delete().eq('user_id', uid),
      admin.from('subscriptions').delete().eq('user_id', uid),
    ]);

    // Anonymize comments
    await admin.from('comments').update({
      content: '[deleted]',
      user_id: null,
    }).eq('user_id', uid);

    // Delete profile
    await admin.from('profiles').delete().eq('id', uid);

    // Delete auth user
    await admin.auth.admin.deleteUser(uid);

    return NextResponse.json({
      ok: true,
      message: 'Your account and all associated data have been permanently deleted.',
    });
  } catch (err) {
    logger.error('[api]', '[delete-account] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
