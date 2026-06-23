import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/themes — list all public themes
export async function GET(req: NextRequest) {
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
    const { name, description, category, colors, author_id, author_name, sha } = body;

    if (!name || !colors || !sha) {
      return NextResponse.json({ error: 'name, colors, and sha are required' }, { status: 400 });
    }

    // Generate short ID
    const id = sha.slice(0, 12);

    const { data, error } = await supabase
      .from('themes')
      .upsert({
        id,
        sha,
        name,
        description: description || null,
        category: category || 'dark',
        colors,
        author_id: author_id || null,
        author_name: author_name || null,
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
