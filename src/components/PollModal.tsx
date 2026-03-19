'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ============================================================
// PollModal — Step-by-step questionnaire modal
//
// Steps: Intro → Q1 → Q2 → … → Thank You
// Answers: yes_no, single_select, multi_select, ranking, short_text, long_text
// Awards 100 XP on completion via /api/polls/[id]
// ============================================================

export interface PollQuestion {
  id: string;
  sort_order: number;
  question_text: string;
  question_type: 'yes_no' | 'single_select' | 'multi_select' | 'ranking' | 'short_text' | 'long_text';
  options: string[] | null;
  is_required: boolean;
}

export interface PollSession {
  id: string;
  title: string;
  preface: string | null;
  status: string;
  response_count: number;
  questions: PollQuestion[];
}

interface PollModalProps {
  pollId: string;
  onClose: () => void;
}

type AnswerValue = string | string[] | null;

export function PollModal({ pollId, onClose }: PollModalProps) {
  const [session, setSession] = useState<PollSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasResponded, setHasResponded] = useState(false);
  const [step, setStep] = useState(0); // 0 = intro, 1..n = questions, n+1 = done
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/polls/${pollId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setSession(d.session);
        setHasResponded(d.has_responded);
        setXpAwarded(d.xp_reward ?? 100);
        // Init ranking answers to default order
        const initAnswers: Record<string, AnswerValue> = {};
        for (const q of d.session.questions ?? []) {
          if (q.question_type === 'ranking' && Array.isArray(q.options)) {
            initAnswers[q.id] = [...q.options];
          }
        }
        setAnswers(initAnswers);
        // If already responded, jump to done slide
        if (d.has_responded) setStep((d.session.questions?.length ?? 0) + 1);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load poll.'); setLoading(false); });
  }, [pollId]);

  const questions = session?.questions ?? [];
  const totalSteps = questions.length + 2; // intro + questions + done
  const currentQuestion = step >= 1 && step <= questions.length ? questions[step - 1] : null;

  const setAnswer = useCallback((qId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }, []);

  const canProceed = useCallback((): boolean => {
    if (!currentQuestion) return true;
    if (!currentQuestion.is_required) return true;
    const ans = answers[currentQuestion.id];
    if (currentQuestion.question_type === 'yes_no' || currentQuestion.question_type === 'single_select') {
      return typeof ans === 'string' && ans.trim().length > 0;
    }
    if (currentQuestion.question_type === 'multi_select') {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (currentQuestion.question_type === 'short_text' || currentQuestion.question_type === 'long_text') {
      return typeof ans === 'string' && ans.trim().length > 0;
    }
    if (currentQuestion.question_type === 'ranking') {
      return Array.isArray(ans) && ans.length > 0;
    }
    return false;
  }, [currentQuestion, answers]);

  const handleSubmit = useCallback(async () => {
    if (!session) return;
    setSubmitting(true);
    const answerPayload = questions.map((q) => {
      const val = answers[q.id];
      if (q.question_type === 'multi_select' || q.question_type === 'ranking') {
        return { question_id: q.id, answer_json: val };
      }
      return { question_id: q.id, answer_text: typeof val === 'string' ? val : null };
    });
    try {
      const res = await fetch(`/api/polls/${pollId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerPayload }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Submission failed'); setSubmitting(false); return; }
      setXpAwarded(data.xp_awarded ?? xpAwarded);
      setStep(questions.length + 1);
    } catch {
      setError('Network error. Please try again.');
    }
    setSubmitting(false);
  }, [session, questions, answers, pollId, xpAwarded]);

  const handleNext = useCallback(() => {
    if (step === questions.length) {
      handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, questions.length, handleSubmit]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Progress (exclude intro and done)
  const progress = questions.length > 0
    ? Math.round(((step - 1) / questions.length) * 100)
    : 0;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-[#111113] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]">
        {/* Progress bar (only during questions) */}
        {step > 0 && step <= questions.length && (
          <div className="h-0.5 bg-white/5 w-full flex-shrink-0">
            <div
              className="h-full bg-gradient-to-r from-[#FF5F1F] to-[#f97316] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <span className="text-xs text-white/40 font-medium uppercase tracking-wider">
              {step === 0 ? 'Survey' : step > questions.length ? 'Done' : `Question ${step} of ${questions.length}`}
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12">
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={onClose} className="mt-4 text-xs text-white/40 hover:text-white/60 underline">Close</button>
            </div>
          )}

          {/* Intro */}
          {!loading && !error && step === 0 && session && (
            <div className="py-4">
              <h2 className="text-xl font-bold text-white mb-3">{session.title}</h2>
              {session.preface && (
                <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap mb-4">{session.preface}</p>
              )}
              <div className="flex items-center gap-3 py-3 px-4 bg-[#FF5F1F]/10 border border-[#FF5F1F]/20 rounded-xl mt-2">
                <span className="text-xl">🎮</span>
                <div>
                  <p className="text-sm font-semibold text-white">Earn {xpAwarded} XP</p>
                  <p className="text-xs text-white/40">Just for completing this survey</p>
                </div>
              </div>
              <p className="text-xs text-white/30 mt-4">
                {questions.length} question{questions.length !== 1 ? 's' : ''} · Takes about 2 minutes
              </p>
            </div>
          )}

          {/* Question */}
          {!loading && !error && currentQuestion && (
            <QuestionStep
              question={currentQuestion}
              answer={answers[currentQuestion.id] ?? null}
              onChange={(val) => setAnswer(currentQuestion.id, val)}
            />
          )}

          {/* Done */}
          {!loading && !error && step > questions.length && (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">{hasResponded && !submitting ? '✓' : '🎉'}</div>
              <h2 className="text-xl font-bold text-white mb-2">
                {hasResponded && step <= questions.length ? 'Already submitted' : 'Thank you!'}
              </h2>
              <p className="text-white/50 text-sm mb-6">
                Your answers help shape the future of Screenplay Studio.
              </p>
              {!hasResponded && (
                <div className="inline-flex items-center gap-2 bg-[#FF5F1F]/10 border border-[#FF5F1F]/20 rounded-full px-5 py-2">
                  <span className="text-[#FF5F1F] font-bold">+{xpAwarded} XP</span>
                  <span className="text-white/40 text-sm">added to your account</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer / navigation */}
        {!loading && !error && step <= questions.length && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/[0.06] flex-shrink-0">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 text-sm text-white/40 hover:text-white transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed() || submitting}
              className="px-6 py-2.5 bg-[#FF5F1F] hover:bg-[#FF7F3F] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors min-w-[100px] flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : step === questions.length ? 'Submit' : step === 0 ? "Let's go →" : 'Next →'}
            </button>
          </div>
        )}

        {step > questions.length && !loading && (
          <div className="px-5 py-4 border-t border-white/[0.06] flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Question step ─────────────────────────────────────────────

function QuestionStep({
  question, answer, onChange,
}: {
  question: PollQuestion;
  answer: AnswerValue;
  onChange: (val: AnswerValue) => void;
}) {
  return (
    <div className="py-4">
      <p className="text-base font-semibold text-white mb-1 leading-snug">{question.question_text}</p>
      {!question.is_required && (
        <p className="text-xs text-white/30 mb-4">Optional</p>
      )}
      {question.is_required && <div className="mb-4" />}

      {/* Yes / No */}
      {question.question_type === 'yes_no' && (
        <div className="grid grid-cols-2 gap-3">
          {(['yes', 'no'] as const).map((v) => (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={`py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                answer === v
                  ? 'bg-[#FF5F1F]/20 border-[#FF5F1F] text-white'
                  : 'bg-white/[0.03] border-white/10 text-white/50 hover:border-white/20 hover:text-white'
              }`}
            >
              {v === 'yes' ? '👍 Yes' : '👎 No'}
            </button>
          ))}
        </div>
      )}

      {/* Single select */}
      {question.question_type === 'single_select' && (
        <div className="space-y-2">
          {(question.options ?? []).map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                answer === opt
                  ? 'bg-[#FF5F1F]/20 border-[#FF5F1F] text-white font-medium'
                  : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white'
              }`}
            >
              <span className={`inline-block w-4 h-4 rounded-full border mr-3 align-middle flex-shrink-0 transition-colors ${
                answer === opt ? 'bg-[#FF5F1F] border-[#FF5F1F]' : 'border-white/30'
              }`} />
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Multi select */}
      {question.question_type === 'multi_select' && (
        <div className="space-y-2">
          <p className="text-xs text-white/30 mb-3">Select all that apply</p>
          {(question.options ?? []).map((opt) => {
            const selected = Array.isArray(answer) && answer.includes(opt);
            const toggle = () => {
              if (Array.isArray(answer)) {
                onChange(selected ? answer.filter((a) => a !== opt) : [...answer, opt]);
              } else {
                onChange([opt]);
              }
            };
            return (
              <button
                key={opt}
                onClick={toggle}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                  selected
                    ? 'bg-[#FF5F1F]/20 border-[#FF5F1F] text-white font-medium'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                }`}
              >
                <span className={`inline-block w-4 h-4 rounded border mr-3 align-middle flex-shrink-0 transition-colors relative ${
                  selected ? 'bg-[#FF5F1F] border-[#FF5F1F]' : 'border-white/30'
                }`}>
                  {selected && (
                    <svg className="absolute inset-0 w-full h-full text-white" fill="none" viewBox="0 0 16 16">
                      <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 5" />
                    </svg>
                  )}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* Ranking */}
      {question.question_type === 'ranking' && Array.isArray(answer) && (
        <div className="space-y-2">
          <p className="text-xs text-white/30 mb-3">Drag to reorder — top = most preferred</p>
          {(answer as string[]).map((opt, idx) => (
            <div key={opt} className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3">
              <span className="text-[#FF5F1F] font-bold text-sm w-5 flex-shrink-0">{idx + 1}</span>
              <span className="flex-1 text-sm text-white">{opt}</span>
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  disabled={idx === 0}
                  onClick={() => {
                    const arr = [...(answer as string[])];
                    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                    onChange(arr);
                  }}
                  className="p-0.5 text-white/30 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  disabled={idx === (answer as string[]).length - 1}
                  onClick={() => {
                    const arr = [...(answer as string[])];
                    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                    onChange(arr);
                  }}
                  className="p-0.5 text-white/30 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Short text */}
      {question.question_type === 'short_text' && (
        <input
          type="text"
          maxLength={300}
          value={(answer as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer…"
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF5F1F]/50 transition-colors"
        />
      )}

      {/* Long text */}
      {question.question_type === 'long_text' && (
        <textarea
          rows={5}
          maxLength={2000}
          value={(answer as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer…"
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF5F1F]/50 transition-colors resize-none"
        />
      )}
    </div>
  );
}
