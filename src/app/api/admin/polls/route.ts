import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

async function requireAdmin() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (user.id !== ADMIN_UID && profile?.role !== 'admin') return null;
  return { supabase, user };
}

// GET /api/admin/polls — list all poll sessions
export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await ctx.supabase
    .from('poll_sessions')
    .select('*, questions:poll_questions(id, sort_order, question_text, question_type, options, is_required, is_approved)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/polls — create a new poll session
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, preface } = body;
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const { data, error } = await ctx.supabase
    .from('poll_sessions')
    .insert({ title: title.trim(), preface: preface?.trim() || null, created_by: ctx.user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
