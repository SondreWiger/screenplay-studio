import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/themes — list all public themes
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabaseClient();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const sort = searchParams.get('sort') || 'popular';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

  let query = supabase
    .from('themes')
    .select('*')
    .eq('is_public', true);

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'staff_picks') {
    query = query.eq('is_staff_pick', true).order('created_at', { ascending: false });
  } else {
    query = query.order('use_count', { ascending: false });
  }

  query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ themes: data });
}

// POST /api/themes — publish a new theme
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, category, colors, sha } = body;

    if (!name || !colors || !sha) {
      return NextResponse.json({ error: 'name, colors, and sha are required' }, { status: 400 });
    }

    // Authorship comes from the session, not the body. This route writes with
    // the service role key, so trusting a caller-supplied `author_id` would let
    // anyone publish a theme under someone else's name.
    const auth = createServerSupabaseClient();
    const { data: { user } } = await auth.auth.getUser();

    let authorName: string | null = null;
    if (user) {
      const { data: profile } = await auth
        .from('profiles')
        .select('display_name, full_name, email')
        .eq('id', user.id)
        .single();

      authorName = profile?.display_name
        || profile?.full_name
        || profile?.email?.split('@')[0]
        || null;
    }

    // Generate short ID
    const id = sha.slice(0, 12);

    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from('themes')
      .upsert({
        id,
        sha,
        name,
        description: description || null,
        category: category || 'dark',
        colors,
        author_id: user?.id ?? null,
        author_name: authorName,
        is_public: true,
        use_count: 0,
        comment_count: 0,
      }, { onConflict: 'sha' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ theme: data });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
