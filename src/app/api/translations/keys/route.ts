import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang');
  const section = searchParams.get('section');

  let query = supabase
    .from('translation_keys')
    .select('*')
    .order('section')
    .order('key');

  if (section) {
    query = query.eq('section', section);
  }

  const { data: keys, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!lang) {
    return NextResponse.json({ keys: keys || [] });
  }

  const { data: suggestions } = await supabase
    .from('translation_suggestions')
    .select(`
      id, key_id, language, translated_text, user_id, status, created_at,
      profiles:user_id ( display_name, avatar_url )
    `)
    .eq('language', lang);

  const { data: votes } = await supabase
    .from('translation_votes')
    .select('suggestion_id, vote, user_id');

  const suggestionsByKey = new Map<string, any[]>();
  (suggestions || []).forEach((s: any) => {
    const list = suggestionsByKey.get(s.key_id) || [];
    const sVotes = (votes || []).filter((v: any) => v.suggestion_id === s.id);
    const upvotes = sVotes.filter((v: any) => v.vote === 'up').length;
    const downvotes = sVotes.filter((v: any) => v.vote === 'down').length;
    const userVote = votes?.find((v: any) => v.suggestion_id === s.id && v.user_id === user.id);
    list.push({
      ...s,
      upvotes,
      downvotes,
      net_votes: upvotes - downvotes,
      user_vote: userVote?.vote || null,
    });
    suggestionsByKey.set(s.key_id, list);
  });

  const result = (keys || []).map((k: any) => {
    const keySuggestions = suggestionsByKey.get(k.id) || [];
    keySuggestions.sort((a: any, b: any) => b.net_votes - a.net_votes);
    return {
      ...k,
      suggestions: keySuggestions,
      winner: keySuggestions[0]?.net_votes > 0 ? keySuggestions[0] : null,
    };
  });

  return NextResponse.json({ keys: result });
}
