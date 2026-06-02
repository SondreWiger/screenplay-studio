import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || process.env.ADMIN_UID || '';

async function requireAdmin() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (user.id !== ADMIN_UID && profile?.role !== 'admin') return null;
  return { supabase, adminSupabase: createAdminSupabaseClient(), user };
}

// POST /api/admin/polls/[id]/notify
// - Sends notifications to all users about the poll (for reminders or re-notifications)
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { supabase, adminSupabase } = ctx;

  // Fetch session
  const { data: session, error: sErr } = await supabase
    .from('poll_sessions')
    .select('*')
    .eq('id', params.id)
    .single();

  if (sErr || !session) return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
  if (session.status !== 'published') return NextResponse.json({ error: 'Poll is not published' }, { status: 400 });

  // Notify all users (using admin client to bypass RLS)
  const { data: users } = await adminSupabase
    .from('profiles')
    .select('id')
    .neq('id', ctx.user.id);

  if (users && users.length > 0) {
    const notifs = users.map((u: { id: string }) => ({
      user_id: u.id,
      type: 'poll_reminder',
      title: `📊 ${session.title}`,
      body: 'Help shape the future of Screenplay Studio — answer a few quick questions and earn 100 XP.',
      link: `/poll/${params.id}`,
      actor_id: ctx.user.id,
      entity_type: 'poll',
      entity_id: params.id,
    }));

    // Insert in batches of 200 to avoid payload limits
    const insertErrors: string[] = [];
    for (let i = 0; i < notifs.length; i += 200) {
      const { error: insErr } = await adminSupabase
        .from('notifications')
        .insert(notifs.slice(i, i + 200));
      if (insErr) {
        console.error('[notify poll] notification insert error:', insErr);
        insertErrors.push(insErr.message);
      }
    }

    if (insertErrors.length > 0) {
      return NextResponse.json({
        ok: true,
        notified: users.length,
        notification_errors: insertErrors,
      });
    }
  }

  return NextResponse.json({ ok: true, notified: users?.length ?? 0 });
}