import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: languages, error } = await supabase
    .from('translation_languages')
    .select('*')
    .eq('status', 'approved')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const langCodes = (languages || []).map((l: any) => l.code);

  const { count: totalKeys } = await supabase
    .from('translation_keys')
    .select('*', { count: 'exact', head: true });

  const progress: Record<string, number> = {};
  for (const code of langCodes) {
    const { count } = await supabase
      .from('translation_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('language', code)
      .eq('status', 'pending');

    progress[code] = totalKeys ? Math.round(((count || 0) / totalKeys) * 100) : 0;
  }

  const { data: contributors } = await supabase
    .from('translation_suggestions')
    .select('user_id, profiles:user_id(display_name, avatar_url)')
    .then(({ data }) => {
      if (!data) return { data: [] };
      const counts = new Map<string, { count: number; profile: any }>();
      data.forEach((s: any) => {
        const existing = counts.get(s.user_id);
        if (existing) {
          existing.count++;
        } else {
          counts.set(s.user_id, { count: 1, profile: s.profiles });
        }
      });
      return {
        data: Array.from(counts.entries())
          .map(([uid, v]) => ({ user_id: uid, count: v.count, ...v.profile }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      };
    });

  return NextResponse.json({
    languages: languages || [],
    total_keys: totalKeys || 0,
    progress,
    contributors: contributors || [],
  });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { code, name, native_name } = body;

  if (!code || !name || !native_name) {
    return NextResponse.json(
      { error: 'Missing required fields: code, name, native_name' },
      { status: 400 }
    );
  }

  const normalizedCode = code.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!normalizedCode || normalizedCode.length < 2 || normalizedCode.length > 10) {
    return NextResponse.json(
      { error: 'Language code must be 2-10 characters (letters, numbers, or hyphens)' },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from('translation_languages')
    .select('id, status')
    .eq('code', normalizedCode)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'This language has already been added', existing_status: existing.status },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('translation_languages')
    .insert({
      code: normalizedCode,
      name: name.trim(),
      native_name: native_name.trim(),
      added_by: user.id,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ language: data }, { status: 201 });
}
