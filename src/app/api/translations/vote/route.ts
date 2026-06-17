import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { suggestion_id, vote } = body;

  if (!suggestion_id || !vote || !['up', 'down'].includes(vote)) {
    return NextResponse.json(
      { error: 'Missing required fields: suggestion_id, vote (up or down)' },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from('translation_votes')
    .select('id, vote')
    .eq('suggestion_id', suggestion_id)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    if (existing.vote === vote) {
      await supabase.from('translation_votes').delete().eq('id', existing.id);
      return NextResponse.json({ action: 'removed', vote: null });
    }

    const { error } = await supabase
      .from('translation_votes')
      .update({ vote })
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ action: 'updated', vote });
  }

  const { error } = await supabase
    .from('translation_votes')
    .insert({
      suggestion_id,
      user_id: user.id,
      vote,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ action: 'created', vote }, { status: 201 });
}
