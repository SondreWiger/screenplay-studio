'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, Check, ChevronDown, ChevronLeft, ChevronUp, Clock, GripVertical, History,
  ListChecks, Save, Sparkles, ThumbsDown, ThumbsUp, X,
} from 'lucide-react';
import type { PollSource } from '@/lib/polls/analytics';

// PollModal — Step-by-step questionnaire modal
//
// Steps: Intro → Q1 → Q2 → … → Thank You
// Answers: yes_no, single_select, multi_select, ranking, short_text, long_text
// Awards 100 XP on completion via /api/polls/[id]

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
  /** Where the person came from, for the admin stats */
  source?: PollSource;
  /** completed = the user submitted (or had already submitted) the poll */
  onClose: (completed: boolean) => void;
}

type AnswerValue = string | string[] | null;

/** Active time so far: total and per question id (ms), kept with the draft */
interface Timing { total: number; questions: Record<string, number>; startedAt: string | null }

// Progress is kept locally so closing the modal by accident doesn't throw away a long survey
const draftKey = (id: string) => `sps-poll-draft:${id}`;

function loadDraft(id: string): { step: number; answers: Record<string, AnswerValue>; timing?: Timing } | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(id: string, step: number, answers: Record<string, AnswerValue>, timing: Timing) {
  try { localStorage.setItem(draftKey(id), JSON.stringify({ step, answers, timing })); } catch { /* storage blocked */ }
}

/** Best-effort progress report for the admin funnel; keepalive so it survives closing the tab. */
function reportProgress(pollId: string, body: { event: 'shown' | 'step' | 'dismiss'; step: number; active_ms: number; source?: PollSource }) {
  try {
    fetch(`/api/polls/${pollId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => { /* tracking only */ });
  } catch { /* tracking only */ }
}

function clearDraft(id: string) {
  try { localStorage.removeItem(draftKey(id)); } catch { /* storage blocked */ }
}

// Rough seconds per question type, for the "takes about N minutes" line
const SECONDS_PER_TYPE: Record<PollQuestion['question_type'], number> = {
  yes_no: 5, single_select: 10, multi_select: 15, ranking: 25, short_text: 25, long_text: 60,
};

function estimateMinutes(questions: PollQuestion[]): number {
  const secs = questions.reduce((sum, q) => sum + (q.is_required || q.question_type !== 'long_text' ? SECONDS_PER_TYPE[q.question_type] : 15), 0);
  return Math.max(1, Math.round(secs / 60));
}

export function PollModal({ pollId, onClose, source }: PollModalProps) {
  const [session, setSession] = useState<PollSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasResponded, setHasResponded] = useState(false);
  const [step, setStep] = useState(0); // 0 = intro, 1..n = questions, n+1 = done
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [resumedAt, setResumedAt] = useState<number | null>(null);

  // Time tracking: only counts while the poll is on screen (tab visible)
  const timing = useRef<Timing>({ total: 0, questions: {}, startedAt: null });
  const tickFrom = useRef<number | null>(null); // when the current visible stretch began
  const timedStep = useRef(0);                  // step the running stretch belongs to
  const unreported = useRef(0);                 // active ms not yet sent to /progress
  const questionsRef = useRef<PollQuestion[]>([]);
  const tracking = useRef(false);               // live poll, not yet answered

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
        const total = d.session.questions?.length ?? 0;
        const draft = d.has_responded ? null : loadDraft(pollId);
        questionsRef.current = d.session.questions ?? [];
        if (draft?.timing) timing.current = { ...timing.current, ...draft.timing };
        if (draft && draft.step > 0) {
          setAnswers({ ...initAnswers, ...draft.answers });
          const at = Math.min(draft.step, total);
          setStep(at);
          setResumedAt(at);
        } else {
          setAnswers(initAnswers);
        }
        // If already responded, jump to done slide
        if (d.has_responded) {
          clearDraft(pollId);
          setCompleted(true);
          setStep(total + 1);
        } else if (d.session.status === 'published') {
          tracking.current = true;
          reportProgress(pollId, { event: 'shown', step: draft?.step ?? 0, active_ms: 0, source });
        }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load poll.'); setLoading(false); });
  }, [pollId]);

  const questions = useMemo(() => session?.questions ?? [], [session]);

  /** Book the running stretch to the step it was spent on. */
  const flushTime = useCallback(() => {
    if (tickFrom.current == null) return;
    const ms = Math.max(0, Date.now() - tickFrom.current);
    tickFrom.current = document.visibilityState === 'visible' ? Date.now() : null;
    const t = timing.current;
    t.total += ms;
    unreported.current += ms;
    const q = questionsRef.current[timedStep.current - 1];
    if (q) t.questions[q.id] = (t.questions[q.id] || 0) + ms;
  }, []);

  // Each step change closes the previous step's stretch and reports progress
  useEffect(() => {
    if (!tracking.current) return;
    flushTime();
    timedStep.current = step;
    if (tickFrom.current == null && document.visibilityState === 'visible') tickFrom.current = Date.now();
    if (step >= 1 && !timing.current.startedAt) timing.current.startedAt = new Date().toISOString();
    if (step >= 1 && step <= questionsRef.current.length) {
      reportProgress(pollId, { event: 'step', step, active_ms: unreported.current, source });
      unreported.current = 0;
    }
  }, [step, loading, pollId, source, flushTime]);

  // Pause the clock while the tab is in the background
  useEffect(() => {
    const onVis = () => {
      if (!tracking.current) return;
      if (document.visibilityState === 'hidden') { flushTime(); tickFrom.current = null; }
      else if (tickFrom.current == null) tickFrom.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [flushTime]);

  useEffect(() => {
    if (!session || hasResponded || completed || step === 0 || step > questions.length) return;
    saveDraft(pollId, step, answers, timing.current);
  }, [pollId, session, hasResponded, completed, step, answers, questions.length]);

  const close = useCallback(() => {
    if (tracking.current && !completed) {
      flushTime();
      tickFrom.current = null;
      tracking.current = false;
      if (step >= 1 && step <= questions.length) saveDraft(pollId, step, answers, timing.current);
      reportProgress(pollId, { event: 'dismiss', step, active_ms: unreported.current, source });
      unreported.current = 0;
    }
    onClose(completed);
  }, [onClose, completed, flushTime, step, questions.length, pollId, answers, source]);
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
    flushTime();
    const t = timing.current;
    const answerPayload = questions.map((q) => {
      const val = answers[q.id];
      const time_ms = t.questions[q.id] ?? null;
      if (q.question_type === 'multi_select' || q.question_type === 'ranking') {
        return { question_id: q.id, answer_json: val, time_ms };
      }
      return { question_id: q.id, answer_text: typeof val === 'string' ? val : null, time_ms };
    });
    try {
      const res = await fetch(`/api/polls/${pollId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answerPayload,
          started_at: t.startedAt,
          duration_ms: t.total,
          source,
          resumed: resumedAt !== null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Submission failed'); setSubmitting(false); return; }
      setXpAwarded(data.xp_awarded ?? xpAwarded);
      tracking.current = false;
      tickFrom.current = null;
      clearDraft(pollId);
      setCompleted(true);
      setStep(questions.length + 1);
    } catch {
      setError('Network error. Please try again.');
    }
    setSubmitting(false);
  }, [session, questions, answers, pollId, xpAwarded, flushTime, source, resumedAt]);

  const handleNext = useCallback(() => {
    if (step === questions.length) {
      handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, questions.length, handleSubmit]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  // Mid-survey, a stray click outside shouldn't dismiss it
  const inQuestions = step > 0 && step <= questions.length;
  const isDone = step > questions.length;

  const sections = useMemo(() => splitSections(questions), [questions]);
  const currentSection = currentQuestion ? sections.find((sec) => sec.indices.includes(step - 1)) ?? null : null;
  const minutes = estimateMinutes(questions);

  // Slide direction for the question transition
  const lastStep = useRef(step);
  const direction = step >= lastStep.current ? 1 : -1;
  useEffect(() => { lastStep.current = step; }, [step]);

  // Picking a single answer moves on by itself; a pending hop is cancelled if the step changes first
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, [step]);

  const choose = useCallback((q: PollQuestion, opt: string) => {
    if (q.question_type === 'multi_select') {
      setAnswers((prev) => {
        const cur = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
        return { ...prev, [q.id]: cur.includes(opt) ? cur.filter((a) => a !== opt) : [...cur, opt] };
      });
      return;
    }
    setAnswers((prev) => ({ ...prev, [q.id]: opt }));
    if (step < questions.length) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      const from = step;
      advanceTimer.current = setTimeout(() => setStep((cur) => (cur === from ? cur + 1 : cur)), 320);
    }
  }, [step, questions.length]);

  // Keyboard: 1–9 pick an option, Enter continues (⌘/Ctrl+Enter inside a long answer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading || error) return;
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
      if (e.key === 'Enter') {
        // In a long answer Enter is a new line — unless focus is still in the previous step's box mid-transition
        if (target?.tagName === 'TEXTAREA' && currentQuestion?.question_type === 'long_text' && !(e.metaKey || e.ctrlKey)) return;
        if (target?.closest('[data-own-enter]')) return; // Back, Close etc. keep their own Enter
        e.preventDefault();
        if (isDone) close();
        else if (canProceed() && !submitting) handleNext();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || !currentQuestion) return;
      const opts = optionsFor(currentQuestion);
      if (!opts) return;
      const scale = isScale(currentQuestion);
      const idx = scale ? opts.indexOf(e.key) : Number(e.key) - 1;
      if (idx >= 0 && idx < opts.length && /^\d$/.test(e.key)) {
        e.preventDefault();
        choose(currentQuestion, opts[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loading, error, isDone, close, canProceed, submitting, handleNext, currentQuestion, choose]);

  const answered = currentQuestion ? hasAnswer(currentQuestion, answers[currentQuestion.id]) : false;
  const skipping = !!currentQuestion && !currentQuestion.is_required && !answered && step < questions.length;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={session?.title ?? 'Survey'}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={inQuestions ? undefined : close}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative w-full sm:max-w-2xl bg-surface-950 border border-white/[0.08] rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col h-[92dvh] sm:h-auto sm:min-h-[560px] sm:max-h-[min(780px,calc(100dvh-3rem))]"
      >
        {/* Warm glow behind the header */}
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[320px] rounded-full bg-brand-500/15 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center gap-3 px-5 sm:px-8 pt-5 pb-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            {inQuestions ? (
              <SegmentedProgress sections={sections} step={step} />
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-400">
                <Sparkles className="h-3.5 w-3.5" />
                {isDone ? 'Survey complete' : 'Survey'}
              </span>
            )}
          </div>
          <button
            aria-label="Close"
            data-own-enter
            onClick={close}
            className="-mr-1 grid h-8 w-8 place-items-center rounded-full text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-8">
          {loading && (
            <div className="flex items-center justify-center h-full py-24">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center text-center h-full py-16">
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={close} className="mt-4 text-xs text-white/50 hover:text-white underline">Close</button>
            </div>
          )}

          {!loading && !error && session && (
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={step}
                custom={direction}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                className="pb-6"
              >
                {step === 0 && (
                  <Intro
                    session={session}
                    questionCount={questions.length}
                    minutes={minutes}
                    xp={xpAwarded}
                    sections={sections}
                  />
                )}

                {currentQuestion && (
                  <>
                    {resumedAt === step && (
                      <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 px-3 py-1 text-xs text-brand-300">
                        <History className="h-3.5 w-3.5" />
                        Welcome back — picked up where you left off
                      </p>
                    )}
                    <QuestionStep
                      question={currentQuestion}
                      number={step}
                      total={questions.length}
                      section={currentSection}
                      sectionCount={sections.filter((sec) => sec.label).length}
                      answer={answers[currentQuestion.id] ?? null}
                      onChoose={(opt) => choose(currentQuestion, opt)}
                      onChange={(val) => setAnswer(currentQuestion.id, val)}
                    />
                  </>
                )}

                {isDone && <Done alreadySubmitted={hasResponded} xp={xpAwarded} />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="relative flex items-center gap-3 px-5 sm:px-8 py-4 border-t border-white/[0.06] bg-surface-950/80 backdrop-blur flex-shrink-0">
            {isDone ? (
              <button
                data-own-enter
                onClick={close}
                className="w-full py-3 bg-white/[0.06] hover:bg-white/10 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Back to Screenplay Studio
              </button>
            ) : (
              <>
                {step > 0 ? (
                  <button
                    data-own-enter
                    onClick={() => setStep((s) => s - 1)}
                    className="inline-flex items-center gap-1 px-3 py-2 -ml-3 text-sm text-white/50 hover:text-white rounded-lg transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                ) : (
                  <button
                    data-own-enter
                    onClick={close}
                    className="px-3 py-2 -ml-3 text-sm text-white/50 hover:text-white rounded-lg transition-colors"
                  >
                    Maybe later
                  </button>
                )}

                <span className="flex-1 hidden sm:block text-center text-[11px] text-white/30">
                  {inQuestions && currentQuestion?.question_type !== 'long_text' && <>Press <Kbd>Enter ↵</Kbd> to continue</>}
                </span>
                <span className="flex-1 sm:hidden" />

                <button
                  onClick={handleNext}
                  disabled={!canProceed() || submitting}
                  className={`inline-flex items-center justify-center gap-1.5 min-w-[120px] px-5 py-2.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-35 disabled:cursor-not-allowed ${
                    skipping
                      ? 'bg-white/[0.06] hover:bg-white/10 text-white/80'
                      : 'bg-brand-500 hover:brightness-110 text-white shadow-lg shadow-brand-500/25'
                  }`}
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : step === 0 ? (
                    <>{resumedAt ? 'Continue' : 'Start'} <ArrowRight className="h-4 w-4" /></>
                  ) : step === questions.length ? (
                    <>Submit <Check className="h-4 w-4" /></>
                  ) : skipping ? (
                    'Skip'
                  ) : (
                    <>Next <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

// ── Layout helpers ────────────────────────────────────────────

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
};

/** A run of questions under one "Part N · Label — …" heading */
interface Section { label: string | null; indices: number[] }

// Questions that open a part are written "Part 2 · Your habits — How often do you…"
const PART_RE = /^Part\s+\d+\s*·\s*(.+?)\s+[—–-]\s+([\s\S]+)$/;

function splitQuestionText(text: string): { part: string | null; text: string } {
  const m = text.match(PART_RE);
  return m ? { part: m[1].trim(), text: m[2].trim() } : { part: null, text };
}

function splitSections(questions: PollQuestion[]): Section[] {
  const out: Section[] = [];
  questions.forEach((q, i) => {
    const { part } = splitQuestionText(q.question_text);
    if (part || out.length === 0) out.push({ label: part, indices: [] });
    out[out.length - 1].indices.push(i);
  });
  return out;
}

function optionsFor(q: PollQuestion): string[] | null {
  if (q.question_type === 'yes_no') return ['yes', 'no'];
  if (q.question_type === 'single_select' || q.question_type === 'multi_select') return q.options ?? [];
  return null;
}

/** A 0–10 style rating: every option is a consecutive number */
function isScale(q: PollQuestion): boolean {
  const opts = q.options ?? [];
  return q.question_type === 'single_select' && opts.length >= 5 && opts.length <= 11
    && opts.every((o, i) => /^\d+$/.test(o) && Number(o) === Number(opts[0]) + i);
}

function hasAnswer(q: PollQuestion, ans: AnswerValue): boolean {
  if (q.question_type === 'ranking') return true; // always has an order
  if (Array.isArray(ans)) return ans.length > 0;
  return typeof ans === 'string' && ans.trim().length > 0;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 font-sans text-[10px] font-medium text-white/50">
      {children}
    </kbd>
  );
}

function SegmentedProgress({ sections, step }: { sections: Section[]; step: number }) {
  const done = step - 1; // questions already behind us
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {sections.map((sec, i) => {
        const first = sec.indices[0];
        const filled = Math.min(Math.max(done - first, 0), sec.indices.length);
        const active = step - 1 >= first && step - 1 <= sec.indices[sec.indices.length - 1];
        return (
          <div key={i} className="h-1 flex-1 rounded-full bg-white/[0.07] overflow-hidden" style={{ flexGrow: sec.indices.length }}>
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${active ? 'bg-brand-500' : 'bg-brand-500/70'}`}
              style={{ width: `${(filled / sec.indices.length) * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Intro({
  session, questionCount, minutes, xp, sections,
}: {
  session: PollSession; questionCount: number; minutes: number; xp: number; sections: Section[];
}) {
  const parts = sections.filter((sec) => sec.label);
  return (
    <div className="pt-4 sm:pt-8">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">{session.title}</h2>
      {session.preface && (
        <p className="mt-4 text-[15px] leading-relaxed text-white/65 whitespace-pre-wrap">{session.preface}</p>
      )}

      <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
        <Stat icon={<ListChecks className="h-4 w-4" />} value={String(questionCount)} label="questions" />
        <Stat icon={<Clock className="h-4 w-4" />} value={`~${minutes} min`} label="to finish" />
        <Stat icon={<Sparkles className="h-4 w-4" />} value={`+${xp} XP`} label="when you're done" accent />
      </div>

      {parts.length > 1 && (
        <div className="mt-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35 mb-2.5">What we&apos;ll cover</p>
          <ol className="flex flex-wrap gap-1.5">
            {parts.map((sec, i) => (
              <li key={i} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] pl-1 pr-3 py-1 text-xs text-white/70">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.07] text-[10px] font-semibold text-white/60">{i + 1}</span>
                {sec.label}
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="mt-7 flex items-center gap-1.5 text-xs text-white/40">
        <Save className="h-3.5 w-3.5" />
        Your progress is saved as you go — close it any time and pick up later.
      </p>
    </div>
  );
}

function Stat({ icon, value, label, accent }: { icon: React.ReactNode; value: string; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-3 sm:px-4 ${accent ? 'border-brand-500/25 bg-brand-500/10' : 'border-white/[0.08] bg-white/[0.03]'}`}>
      <div className={`mb-1.5 ${accent ? 'text-brand-400' : 'text-white/40'}`}>{icon}</div>
      <p className="text-base sm:text-lg font-semibold text-white leading-tight">{value}</p>
      <p className="text-[11px] text-white/45">{label}</p>
    </div>
  );
}

function Done({ alreadySubmitted, xp }: { alreadySubmitted: boolean; xp: number }) {
  return (
    <div className="flex flex-col items-center text-center pt-10 sm:pt-16">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
        className="grid h-20 w-20 place-items-center rounded-full bg-brand-500 shadow-[0_0_60px_-8px] shadow-brand-500/70"
      >
        <Check className="h-10 w-10 text-white" strokeWidth={3} />
      </motion.div>
      <h2 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-white">
        {alreadySubmitted ? 'You already answered this one' : 'Thank you — really.'}
      </h2>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/55">
        {alreadySubmitted
          ? 'Your answers are in. We read every one.'
          : 'Every answer is read by a person on the team, and it directly shapes what we build next.'}
      </p>
      {!alreadySubmitted && (
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-5 py-2"
        >
          <Sparkles className="h-4 w-4 text-brand-400" />
          <span className="font-bold text-brand-300">+{xp} XP</span>
          <span className="text-sm text-white/50">added to your account</span>
        </motion.div>
      )}
    </div>
  );
}

// ── Question step ─────────────────────────────────────────────

function QuestionStep({
  question, number, total, section, sectionCount, answer, onChoose, onChange,
}: {
  question: PollQuestion;
  number: number;
  total: number;
  section: Section | null;
  sectionCount: number;
  answer: AnswerValue;
  onChoose: (opt: string) => void;
  onChange: (val: AnswerValue) => void;
}) {
  const split = splitQuestionText(question.question_text).text;
  // The scale has its own end labels, so a "(0 = not at all, 10 = …)" note is redundant
  const text = isScale(question) ? split.replace(/\s*\([^)]*\d+\s*=[^)]*\)\s*$/, '') : split;
  const partIndex = section?.label && section.indices.length ? section : null;
  const opts = question.options ?? [];
  // Long option lists read better as wrapping chips than a tall column
  const chips = question.question_type === 'multi_select' && opts.length > 6 && opts.every((o) => o.length <= 34);

  return (
    <div className="pt-3 sm:pt-6">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
        {partIndex && (
          <span className="text-brand-400">{section!.label}</span>
        )}
        {partIndex && sectionCount > 1 && <span className="text-white/20">·</span>}
        <span className="text-white/35 tabular-nums">Question {number} of {total}</span>
        {!question.is_required && (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] tracking-[0.04em] normal-case font-medium text-white/45">Optional</span>
        )}
      </div>

      <h3 className="text-xl sm:text-2xl font-semibold leading-snug tracking-tight text-white text-balance">{text}</h3>

      <div className="mt-6">
        {/* Yes / No */}
        {question.question_type === 'yes_no' && (
          <div className="grid grid-cols-2 gap-3">
            {(['yes', 'no'] as const).map((v, i) => (
              <button
                key={v}
                onClick={() => onChoose(v)}
                aria-pressed={answer === v}
                className={`group relative flex flex-col items-center justify-center gap-2 rounded-2xl border py-7 text-base font-semibold transition-all ${
                  answer === v
                    ? 'border-brand-500 bg-brand-500/15 text-white ring-1 ring-brand-500'
                    : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {v === 'yes' ? <ThumbsUp className="h-6 w-6" /> : <ThumbsDown className="h-6 w-6" />}
                {v === 'yes' ? 'Yes' : 'No'}
                <KeyHint n={i + 1} active={answer === v} className="absolute top-2.5 left-2.5" />
              </button>
            ))}
          </div>
        )}

        {/* 0–10 rating */}
        {isScale(question) && (
          <div>
            <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
              {opts.map((opt) => {
                const n = Number(opt);
                const picked = answer === opt;
                const tone = n <= 6 ? 'hover:border-red-400/50' : n <= 8 ? 'hover:border-amber-400/50' : 'hover:border-emerald-400/50';
                return (
                  <button
                    key={opt}
                    onClick={() => onChoose(opt)}
                    aria-pressed={picked}
                    className={`aspect-square rounded-xl border text-base font-semibold tabular-nums transition-all ${
                      picked
                        ? 'border-brand-500 bg-brand-500 text-white scale-105 shadow-lg shadow-brand-500/30'
                        : `border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.06] ${tone}`
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 flex justify-between text-[11px] text-white/40">
              <span>Not at all likely</span>
              <span>Extremely likely</span>
            </div>
          </div>
        )}

        {/* Single select */}
        {question.question_type === 'single_select' && !isScale(question) && (
          <div className="space-y-2">
            {opts.map((opt, i) => {
              const picked = answer === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onChoose(opt)}
                  aria-pressed={picked}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] transition-all ${
                    picked
                      ? 'border-brand-500 bg-brand-500/15 text-white ring-1 ring-brand-500'
                      : 'border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <KeyHint n={i + 1} active={picked} />
                  <span className="flex-1">{opt}</span>
                  {picked && <Check className="h-4 w-4 text-brand-400" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Multi select */}
        {question.question_type === 'multi_select' && (
          <div>
            <p className="mb-3 text-xs text-white/40">
              Pick all that apply{Array.isArray(answer) && answer.length > 0 ? ` · ${answer.length} selected` : ''}
            </p>
            <div className={chips ? 'flex flex-wrap gap-2' : 'space-y-2'}>
              {opts.map((opt, i) => {
                const selected = Array.isArray(answer) && answer.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => onChoose(opt)}
                    aria-pressed={selected}
                    className={`flex items-center gap-2.5 border text-left transition-all ${
                      chips ? 'rounded-full px-3.5 py-2 text-sm' : 'w-full rounded-xl px-4 py-3.5 text-[15px]'
                    } ${
                      selected
                        ? 'border-brand-500 bg-brand-500/15 text-white'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <span className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded border transition-colors ${
                      selected ? 'border-brand-500 bg-brand-500' : 'border-white/30'
                    }`}>
                      {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {!chips && i < 9 && <KeyHint n={i + 1} active={selected} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ranking */}
        {question.question_type === 'ranking' && Array.isArray(answer) && (
          <RankingList items={answer as string[]} onChange={onChange} />
        )}

        {/* Short text */}
        {question.question_type === 'short_text' && (
          <input
            type="text"
            autoFocus
            maxLength={300}
            value={(answer as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="A few words…"
            className="w-full border-0 border-b-2 border-white/10 bg-transparent px-0 py-3 text-lg text-white placeholder-white/25 focus:border-brand-500 focus:outline-none focus:ring-0 transition-colors"
          />
        )}

        {/* Long text */}
        {question.question_type === 'long_text' && (
          <div>
            <textarea
              autoFocus
              rows={6}
              maxLength={2000}
              value={(answer as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={question.is_required ? 'Write as much or as little as you like…' : 'Optional — but even one sentence helps a lot…'}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-[15px] leading-relaxed text-white placeholder-white/25 focus:border-brand-500/60 focus:bg-white/[0.05] focus:outline-none transition-colors"
            />
            <div className="mt-1.5 flex justify-between text-[11px] text-white/35">
              <span className="hidden sm:inline"><Kbd>⌘ ↵</Kbd> to continue</span>
              <span className="tabular-nums ml-auto">{((answer as string) ?? '').length} / 2000</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KeyHint({ n, active, className = '' }: { n: number; active: boolean; className?: string }) {
  if (n > 9) return null;
  return (
    <span
      aria-hidden
      className={`hidden sm:grid h-5 w-5 flex-shrink-0 place-items-center rounded-md border text-[10px] font-semibold tabular-nums transition-colors ${
        active ? 'border-brand-500 bg-brand-500 text-white' : 'border-white/15 text-white/40'
      } ${className}`}
    >
      {n}
    </span>
  );
}

/** Reorder by dragging (pointer) or the arrow buttons (touch, keyboard) */
function RankingList({ items, onChange }: { items: string[]; onChange: (val: AnswerValue) => void }) {
  const [dragging, setDragging] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const arr = [...items];
    const [it] = arr.splice(from, 1);
    arr.splice(to, 0, it);
    onChange(arr);
  };

  return (
    <div>
      <p className="mb-3 text-xs text-white/40">Most important at the top — drag, or use the arrows</p>
      <ol className="space-y-2">
        {items.map((opt, idx) => (
          <li
            key={opt}
            draggable
            onDragStart={() => setDragging(idx)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragging !== null && dragging !== idx) { move(dragging, idx); setDragging(idx); }
            }}
            className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors cursor-grab active:cursor-grabbing ${
              dragging === idx ? 'border-brand-500 bg-brand-500/15' : 'border-white/10 bg-white/[0.03] hover:border-white/20'
            }`}
          >
            <GripVertical className="h-4 w-4 flex-shrink-0 text-white/25" />
            <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${
              idx < 3 ? 'bg-brand-500 text-white' : 'bg-white/[0.07] text-white/50'
            }`}>
              {idx + 1}
            </span>
            <span className="flex-1 text-[15px] text-white">{opt}</span>
            <div className="flex flex-shrink-0 gap-1">
              <button
                aria-label={`Move ${opt} up`}
                disabled={idx === 0}
                onClick={() => move(idx, idx - 1)}
                className="grid h-7 w-7 place-items-center rounded-lg text-white/45 hover:bg-white/[0.07] hover:text-white disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                aria-label={`Move ${opt} down`}
                disabled={idx === items.length - 1}
                onClick={() => move(idx, idx + 1)}
                className="grid h-7 w-7 place-items-center rounded-lg text-white/45 hover:bg-white/[0.07] hover:text-white disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
