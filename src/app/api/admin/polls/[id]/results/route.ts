import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { getEmailsByIds } from '@/lib/private-profile';
import {
  computePollAnalytics, type Dropout, type PersonInfo, type Respondent,
} from '@/lib/polls/analytics';

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || process.env.ADMIN_UID || '';

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

  // Everything below reads private fields (emails, timings) — service role,
  // after the admin check above. Paged: PostgREST silently caps at 1000 rows.
  const admin = createAdminSupabaseClient();
  let answers: { response_id: string; user_id: string; question_id: string; answer_text: string | null; answer_json: unknown; time_ms?: number | null }[];
  let responses: { id: string; user_id: string; completed_at: string; started_at?: string | null; duration_ms?: number | null; source?: string | null; resumed?: boolean }[];
  let views: { user_id: string; source: string | null; first_shown_at: string; last_seen_at: string; max_step: number; view_count: number; dismiss_count: number; active_ms: number; completed_at: string | null }[] = [];
  try {
    // Fall back to the pre-analytics columns if the migration hasn't run yet
    answers = await fetchAll(() => admin.from('poll_answers')
      .select('response_id, user_id, question_id, answer_text, answer_json, time_ms').eq('session_id', params.id))
      .catch(() => fetchAll(() => admin.from('poll_answers')
        .select('response_id, user_id, question_id, answer_text, answer_json').eq('session_id', params.id)));
    responses = await fetchAll(() => admin.from('poll_responses')
      .select('id, user_id, completed_at, started_at, duration_ms, source, resumed').eq('session_id', params.id))
      .catch(() => fetchAll(() => admin.from('poll_responses')
        .select('id, user_id, completed_at').eq('session_id', params.id)));
    // poll_views has no id column (fetchAll orders by id), so page it by user
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from('poll_views')
        .select('user_id, source, first_shown_at, last_seen_at, max_step, view_count, dismiss_count, active_ms, completed_at')
        .eq('session_id', params.id)
        .order('user_id')
        .range(from, from + 999);
      if (error || !data) break; // table missing before the migration
      views = views.concat(data);
      if (data.length < 1000) break;
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load answers' }, { status: 500 });
  }

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

  // Who answered: names from profiles, emails from profile_contact
  const userIds = Array.from(new Set(responses.map((r) => r.user_id).concat(views.map((v) => v.user_id))));
  const people = new Map<string, PersonInfo>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await admin.from('profiles')
      .select('id, full_name, display_name, username, avatar_url')
      .in('id', userIds.slice(i, i + 200));
    for (const p of data ?? []) {
      people.set(p.id, {
        user_id: p.id,
        name: p.full_name || p.display_name || p.username || 'Unknown user',
        username: p.username ?? null,
        avatar_url: p.avatar_url ?? null,
        email: null,
      });
    }
  }
  const emails = await getEmailsByIds(admin, userIds);
  const person = (id: string): PersonInfo => ({
    ...(people.get(id) ?? { user_id: id, name: 'Deleted user', username: null, avatar_url: null, email: null }),
    email: emails.get(id) ?? null,
  });

  const byResponse = new Map<string, Respondent['answers']>();
  for (const a of answers) {
    const m = byResponse.get(a.response_id) ?? {};
    m[a.question_id] = {
      text: a.answer_text ?? null,
      list: Array.isArray(a.answer_json) ? (a.answer_json as string[]) : null,
      time_ms: a.time_ms ?? null,
    };
    byResponse.set(a.response_id, m);
  }

  const respondents: Respondent[] = responses
    .map((r) => ({
      ...person(r.user_id),
      response_id: r.id,
      completed_at: r.completed_at,
      started_at: r.started_at ?? null,
      duration_ms: r.duration_ms ?? null,
      source: r.source ?? null,
      resumed: !!r.resumed,
      answers: byResponse.get(r.id) ?? {},
    }))
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));

  const answered = new Set(responses.map((r) => r.user_id));
  const dropouts: Dropout[] = views
    .filter((v) => !answered.has(v.user_id))
    .map((v) => ({ ...person(v.user_id), ...v }))
    .sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));

  const analytics = computePollAnalytics((questions ?? []).map((q) => q.id), respondents, views);

  return NextResponse.json({ results, respondents, dropouts, analytics });
}
