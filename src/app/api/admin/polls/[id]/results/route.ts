import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

async function requireAdmin() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (user.id !== ADMIN_UID && profile?.role !== 'admin') return null;
  return { supabase };
}

export interface QuestionResult {
  question_id: string;
  question_text: string;
  question_type: string;
  total_answers: number;
  // For yes_no / single_select / multi_select / ranking:
  option_counts: { label: string; count: number }[];
  // For short_text / long_text:
  text_answers: string[];
  // For ranking:
  ranking_scores: { label: string; avg_rank: number; count: number }[];
}

// GET /api/admin/polls/[id]/results
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch all questions
  const { data: questions, error: qErr } = await ctx.supabase
    .from('poll_questions')
    .select('*')
    .eq('session_id', params.id)
    .order('sort_order', { ascending: true });
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  // Fetch all answers for this session
  const { data: answers, error: aErr } = await ctx.supabase
    .from('poll_answers')
    .select('question_id, answer_text, answer_json')
    .eq('session_id', params.id);
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  const results: QuestionResult[] = (questions ?? []).map((q) => {
    const qAnswers = (answers ?? []).filter((a) => a.question_id === q.id);
    const total = qAnswers.length;

    if (q.question_type === 'yes_no') {
      const yesCnt = qAnswers.filter((a) => a.answer_text === 'yes').length;
      const noCnt  = qAnswers.filter((a) => a.answer_text === 'no').length;
      return {
        question_id: q.id, question_text: q.question_text, question_type: q.question_type,
        total_answers: total,
        option_counts: [{ label: 'Yes', count: yesCnt }, { label: 'No', count: noCnt }],
        text_answers: [], ranking_scores: [],
      };
    }

    if (q.question_type === 'single_select') {
      const opts: string[] = q.options ?? [];
      const option_counts = opts.map((opt) => ({
        label: opt,
        count: qAnswers.filter((a) => a.answer_text === opt).length,
      }));
      return {
        question_id: q.id, question_text: q.question_text, question_type: q.question_type,
        total_answers: total, option_counts, text_answers: [], ranking_scores: [],
      };
    }

    if (q.question_type === 'multi_select') {
      const opts: string[] = q.options ?? [];
      const option_counts = opts.map((opt) => ({
        label: opt,
        count: qAnswers.filter((a) => Array.isArray(a.answer_json) && (a.answer_json as string[]).includes(opt)).length,
      }));
      return {
        question_id: q.id, question_text: q.question_text, question_type: q.question_type,
        total_answers: total, option_counts, text_answers: [], ranking_scores: [],
      };
    }

    if (q.question_type === 'ranking') {
      const opts: string[] = q.options ?? [];
      // For each option, compute average rank position (lower = ranked higher = better)
      const ranking_scores = opts.map((opt) => {
        const positions: number[] = [];
        qAnswers.forEach((a) => {
          if (Array.isArray(a.answer_json)) {
            const idx = (a.answer_json as string[]).indexOf(opt);
            if (idx >= 0) positions.push(idx + 1); // 1-based rank
          }
        });
        const avg_rank = positions.length
          ? Math.round((positions.reduce((s, n) => s + n, 0) / positions.length) * 10) / 10
          : 0;
        return { label: opt, avg_rank, count: positions.length };
      });
      // Sort by avg_rank ascending (best first)
      ranking_scores.sort((a, b) => (a.avg_rank || 999) - (b.avg_rank || 999));
      return {
        question_id: q.id, question_text: q.question_text, question_type: q.question_type,
        total_answers: total, option_counts: [], text_answers: [], ranking_scores,
      };
    }

    // short_text / long_text
    const text_answers = qAnswers.map((a) => a.answer_text ?? '').filter(Boolean);
    return {
      question_id: q.id, question_text: q.question_text, question_type: q.question_type,
      total_answers: total, option_counts: [], text_answers, ranking_scores: [],
    };
  });

  return NextResponse.json({ results });
}
