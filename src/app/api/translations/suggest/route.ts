import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: agreement } = await supabase
    .from('translation_agreements')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!agreement) {
    return NextResponse.json(
      { error: 'You must agree to the translation guidelines first' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { key_id, language, translated_text } = body;

  if (!key_id || !language || !translated_text) {
    return NextResponse.json(
      { error: 'Missing required fields: key_id, language, translated_text' },
      { status: 400 }
    );
  }

  if (translated_text.length > 500) {
    return NextResponse.json(
      { error: 'Translation must be 500 characters or fewer' },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from('translation_suggestions')
    .select('id')
    .eq('key_id', key_id)
    .eq('language', language)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('translation_suggestions')
      .update({ translated_text, status: 'pending' })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ suggestion: data });
  }

  const { data, error } = await supabase
    .from('translation_suggestions')
    .insert({
      key_id,
      language,
      translated_text,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suggestion: data }, { status: 201 });
}
