import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const languageCode = searchParams.get('language');

  if (!languageCode) {
    return NextResponse.json({ error: 'Missing language parameter' }, { status: 400 });
  }

  const { data: quiz, error } = await supabase
    .from('language_quizzes')
    .select('*')
    .eq('language_code', languageCode)
    .single();

  if (error || !quiz) {
    return NextResponse.json({ error: 'No quiz available for this language' }, { status: 404 });
  }

  const { data: lastAttempt } = await supabase
    .from('language_quiz_attempts')
    .select('created_at, passed')
    .eq('user_id', user.id)
    .eq('language_code', languageCode)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let cooldown = false;
  if (lastAttempt && !lastAttempt.passed) {
    const hoursSince = (Date.now() - new Date(lastAttempt.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      cooldown = true;
    }
  }

  const safeQuestions = (quiz.questions as any[]).map((q: any, i: number) => ({
    index: i,
    question: q.question,
    options: q.options,
  }));

  return NextResponse.json({
    language_code: quiz.language_code,
    min_score: quiz.min_score,
    questions: safeQuestions,
    total: safeQuestions.length,
    cooldown,
    last_passed: lastAttempt?.passed || false,
  });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { language_code, answers } = body;

  if (!language_code || !answers || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: 'Missing required fields: language_code, answers (array of selected indices)' },
      { status: 400 }
    );
  }

  const { data: lastAttempt } = await supabase
    .from('language_quiz_attempts')
    .select('created_at, passed')
    .eq('user_id', user.id)
    .eq('language_code', language_code)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lastAttempt && !lastAttempt.passed) {
    const hoursSince = (Date.now() - new Date(lastAttempt.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      const hoursLeft = Math.ceil(24 - hoursSince);
      return NextResponse.json(
        { error: `You must wait ${hoursLeft} hour(s) before retrying` },
        { status: 429 }
      );
    }
  }

  const { data: quiz, error: quizError } = await supabase
    .from('language_quizzes')
    .select('*')
    .eq('language_code', language_code)
    .single();

  if (quizError || !quiz) {
    return NextResponse.json({ error: 'No quiz available for this language' }, { status: 404 });
  }

  const questions = quiz.questions as any[];
  let score = 0;
  questions.forEach((q: any, i: number) => {
    if (answers[i] === q.correct_index) score++;
  });

  const passed = score >= quiz.min_score;

  await supabase
    .from('language_quiz_attempts')
    .insert({
      user_id: user.id,
      language_code,
      score,
      total: questions.length,
      answers,
      passed,
    });

  if (passed) {
    const { data: existingLang } = await supabase
      .from('translation_languages')
      .select('id')
      .eq('code', language_code)
      .single();

    if (!existingLang) {
      return NextResponse.json({
        passed,
        score,
        total: questions.length,
        min_score: quiz.min_score,
        message: 'Quiz passed! You can now submit a language request.',
      });
    }
  }

  return NextResponse.json({
    passed,
    score,
    total: questions.length,
    min_score: quiz.min_score,
  });
}
