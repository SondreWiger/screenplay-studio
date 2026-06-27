import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ pollId: null });
  }

  // 1. Find the latest active global poll
  const { data: globalPolls, error: pollError } = await supabase
    .from('poll_sessions')
    .select('id')
    .eq('is_global', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);

  if (pollError || !globalPolls || globalPolls.length === 0) {
    return NextResponse.json({ pollId: null });
  }

  const pollId = globalPolls[0].id;

  // 2. Check if the user has already responded
  const { count, error: responseError } = await supabase
    .from('poll_responses')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', pollId)
    .eq('user_id', user.id);

  if (responseError || (count ?? 0) > 0) {
    return NextResponse.json({ pollId: null });
  }

  return NextResponse.json({ pollId });
}
