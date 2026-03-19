import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { XP_VALUES } from '@/lib/gamification';

// GET /api/polls/[id] — get a published poll + whether current user has answered
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: session, error } = await supabase
    .from('poll_sessions')
    .select('id, title, preface, status, published_at, response_count, questions:poll_questions(id, sort_order, question_text, question_type, options, is_required)')
    .eq('id', params.id)
    .in('status', ['published', 'closed'])
    .single();

  if (error || !session) return NextResponse.json({ error: 'Poll not found or not yet published' }, { status: 404 });

  // Sort questions
  if (Array.isArray(session.questions)) {
    (session.questions as { sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order);
  }

  let has_responded = false;
  if (user) {
    const { data: existing } = await supabase
      .from('poll_responses')
      .select('id')
      .eq('session_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    has_responded = !!existing;
  }

  return NextResponse.json({ session, has_responded, xp_reward: XP_VALUES.poll_complete });
}

// POST /api/polls/[id] — submit answers
// Body: { answers: { question_id: string; answer_text?: string; answer_json?: unknown }[] }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Sign in to submit' }, { status: 401 });

  // Check poll is published
  const { data: session } = await supabase
    .from('poll_sessions')
    .select('id, status')
    .eq('id', params.id)
    .eq('status', 'published')
    .maybeSingle();
  if (!session) return NextResponse.json({ error: 'Poll not found or closed' }, { status: 404 });

  // Check not already responded
  const { data: existing } = await supabase
    .from('poll_responses')
    .select('id')
    .eq('session_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'Already responded' }, { status: 409 });

  const body = await req.json();
  const answers: { question_id: string; answer_text?: string; answer_json?: unknown }[] = body.answers ?? [];

  // Insert response record
  const { data: response, error: rErr } = await supabase
    .from('poll_responses')
    .insert({ session_id: params.id, user_id: user.id, xp_awarded: XP_VALUES.poll_complete })
    .select()
    .single();

  if (rErr || !response) return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });

  // Insert individual answers
  if (answers.length > 0) {
    const answerRows = answers.map((a) => ({
      response_id: response.id,
      session_id: params.id,
      question_id: a.question_id,
      user_id: user.id,
      answer_text: a.answer_text ?? null,
      answer_json: a.answer_json ?? null,
    }));
    await supabase.from('poll_answers').insert(answerRows);
  }

  // Award XP via award_xp DB function
  await supabase.rpc('award_xp', {
    p_user_id:    user.id,
    p_event_type: 'poll_complete',
    p_xp_base:    XP_VALUES.poll_complete,
    p_multiplier: 1,
    p_metadata:   { poll_id: params.id },
  });

  return NextResponse.json({ ok: true, xp_awarded: XP_VALUES.poll_complete });
}
