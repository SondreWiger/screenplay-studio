import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/polls/global — the newest published global poll the user hasn't answered yet
export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ pollId: null });
  }

  // poll_status has no 'active' value — live polls are 'published'
  const { data: globalPolls, error: pollError } = await supabase
    .from('poll_sessions')
    .select('id')
    .eq('is_global', true)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(5);

  if (pollError || !globalPolls || globalPolls.length === 0) {
    return NextResponse.json({ pollId: null });
  }

  const { data: answered, error: responseError } = await supabase
    .from('poll_responses')
    .select('session_id')
    .eq('user_id', user.id)
    .in('session_id', globalPolls.map((p) => p.id));

  if (responseError) {
    return NextResponse.json({ pollId: null });
  }

  const done = new Set((answered ?? []).map((r) => r.session_id));
  const next = globalPolls.find((p) => !done.has(p.id));

  return NextResponse.json({ pollId: next?.id ?? null });
}
