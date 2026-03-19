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

// GET /api/admin/polls/[id] — get a single poll with all questions
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await ctx.supabase
    .from('poll_sessions')
    .select('*, questions:poll_questions(*)')
    .eq('id', params.id)
    .order('sort_order', { referencedTable: 'poll_questions', ascending: true })
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/admin/polls/[id] — update session or questions
// Body can include: { title?, preface?, status?, questions? }
// questions is an array of upsert objects
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { questions, ...sessionFields } = body;

  // Update session fields
  if (Object.keys(sessionFields).length > 0) {
    const { error } = await ctx.supabase
      .from('poll_sessions')
      .update({ ...sessionFields, updated_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Upsert questions if provided
  if (Array.isArray(questions)) {
    for (const q of questions) {
      if (q._delete && q.id) {
        await ctx.supabase.from('poll_questions').delete().eq('id', q.id);
      } else if (q.id) {
        const { _delete: _d, ...fields } = q;
        await ctx.supabase.from('poll_questions')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', q.id);
      } else {
        await ctx.supabase.from('poll_questions')
          .insert({ ...q, session_id: params.id });
      }
    }
  }

  // Return updated session with questions
  const { data } = await ctx.supabase
    .from('poll_sessions')
    .select('*, questions:poll_questions(*)')
    .eq('id', params.id)
    .order('sort_order', { referencedTable: 'poll_questions', ascending: true })
    .single();

  return NextResponse.json(data);
}

// DELETE /api/admin/polls/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await ctx.supabase
    .from('poll_sessions')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
