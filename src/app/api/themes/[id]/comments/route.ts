import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/themes/[id]/comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from('theme_comments')
    .select('*')
    .eq('theme_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comments: data });
}

// POST /api/themes/[id]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { content, user_name, user_id } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('theme_comments')
    .insert({
      theme_id: id,
      user_id: user_id || null,
      user_name: user_name || 'Anonymous',
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Increment comment count
  await supabase.rpc('increment_theme_use_count', { p_theme_id: id }).catch(() => {
    supabase.from('themes').select('comment_count').eq('id', id).single().then(({ data }) => {
      if (data) {
        supabase.from('themes').update({ comment_count: (data.comment_count || 0) + 1 }).eq('id', id);
      }
    });
  });

  return NextResponse.json({ comment: data });
}
