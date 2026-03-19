import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

async function requireAdmin() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (user.id !== ADMIN_UID && profile?.role !== 'admin') return null;
  return { supabase, adminSupabase: createAdminSupabaseClient(), user };
}

// POST /api/admin/polls/[id]/publish
// - Validates all questions are approved
// - Sets status = 'published'
// - Inserts notifications for all users
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { supabase, adminSupabase } = ctx;

  // Fetch session + questions
  const { data: session, error: sErr } = await supabase
    .from('poll_sessions')
    .select('*, questions:poll_questions(*)')
    .eq('id', params.id)
    .single();

  if (sErr || !session) return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
  if (session.status === 'published') return NextResponse.json({ error: 'Already published' }, { status: 400 });

  const questions = (session.questions as { is_approved: boolean }[]) ?? [];
  const unapproved = questions.filter((q) => !q.is_approved);
  if (unapproved.length > 0) {
    return NextResponse.json({
      error: `${unapproved.length} question(s) not yet approved`,
      unapproved_count: unapproved.length,
    }, { status: 422 });
  }
  if (questions.length === 0) {
    return NextResponse.json({ error: 'Poll has no questions' }, { status: 422 });
  }

  // Mark as published
  const { error: pubErr } = await supabase
    .from('poll_sessions')
    .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', params.id);

  if (pubErr) return NextResponse.json({ error: pubErr.message }, { status: 500 });

  // Notify all users (using admin client to bypass RLS)
  const { data: users } = await adminSupabase
    .from('profiles')
    .select('id')
    .neq('id', ctx.user.id);

  if (users && users.length > 0) {
    const notifs = users.map((u: { id: string }) => ({
      user_id: u.id,
      type: 'poll_published',
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
        console.error('[publish poll] notification insert error:', insErr);
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
