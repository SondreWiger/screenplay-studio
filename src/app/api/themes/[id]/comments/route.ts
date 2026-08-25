import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/themes/[id]/comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminSupabaseClient();

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
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  // Identity comes from the session, never from the request body. This route
  // inserts with the service role key, so a caller-supplied `user_id` would
  // let anyone post a comment under someone else's name.
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  let authorName = 'Anonymous';
  if (user) {
    const { data: profile } = await auth
      .from('profiles')
      .select('display_name, full_name, email')
      .eq('id', user.id)
      .single();

    authorName = profile?.display_name
      || profile?.full_name
      || profile?.email?.split('@')[0]
      || 'Anonymous';
  }

  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('theme_comments')
    .insert({
      theme_id: id,
      user_id: user?.id ?? null,
      user_name: authorName,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Increment comment count. The RPC is the fast path; databases that predate
  // it fall back to a read-modify-write.
  //
  // A query builder is thenable but is not a Promise, so it has no `.catch` —
  // chaining one threw a TypeError and turned every successful comment into a
  // 500. Errors come back in the result instead.
  const { error: rpcError } = await supabase.rpc('increment_theme_use_count', { p_theme_id: id });

  if (rpcError) {
    const { data: theme } = await supabase
      .from('themes')
      .select('comment_count')
      .eq('id', id)
      .single();

    if (theme) {
      await supabase
        .from('themes')
        .update({ comment_count: (theme.comment_count || 0) + 1 })
        .eq('id', id);
    }
  }

  return NextResponse.json({ comment: data });
}
