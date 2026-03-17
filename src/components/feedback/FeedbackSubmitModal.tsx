'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import {
  Bug, Lightbulb, Star, MessageSquare, X, AlertTriangle,
  ChevronUp, ArrowRight, CheckCircle2, Loader2,
} from 'lucide-react';
import type { FeedbackType } from '@/app/feedback/page';

interface SimilarItem {
  id: string;
  title: string;
  type: string;
  status: string;
  vote_count: number;
  similarity: number;
}

interface Props {
  onClose: () => void;
  onSubmitted: () => void;
  defaultType?: FeedbackType;
  prefillTitle?: string;
  prefillBody?: string;
  isErrorReport?: boolean;
}

const TYPES: { value: FeedbackType; label: string; icon: React.ElementType; desc: string; color: string }[] = [
  { value: 'bug_report',      label: 'Bug Report',      icon: Bug,          desc: "Something isn't working",      color: '#ef4444' },
  { value: 'feature_request', label: 'Feature Request', icon: Lightbulb,    desc: 'Suggest an improvement',        color: '#f59e0b' },
  { value: 'testimonial',     label: 'Write a Review',  icon: Star,         desc: 'Share your experience',         color: '#8b5cf6' },
  { value: 'other',           label: 'Other',           icon: MessageSquare, desc: 'General feedback',              color: '#6b7280' },
];

const STEP_TITLES = ['Choose Type', 'Details', 'Review & Submit'];

export function FeedbackSubmitModal({ onClose, onSubmitted, defaultType, prefillTitle, prefillBody, isErrorReport }: Props) {
  const { user } = useAuthStore();
  const [step, setStep] = useState<0 | 1 | 2>(defaultType ? 1 : 0);
  const [type, setType] = useState<FeedbackType>(defaultType ?? 'bug_report');

  const [title, setTitle] = useState(prefillTitle ?? '');
  const [body, setBody] = useState(prefillBody ?? '');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [useCase, setUseCase] = useState('');
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [showAuthorName, setShowAuthorName] = useState(true);

  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [confirmedNotDuplicate, setConfirmedNotDuplicate] = useState(false);
  const similarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Auto-capture browser info
  const browserInfo = typeof window !== 'undefined' ? {
    ua: navigator.userAgent,
    platform: navigator.platform,
    lang: navigator.language,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    url: window.location.href,
  } : {};

  useEffect(() => {
    if (!title || title.length < 5 || step !== 1) return;
    if (similarTimer.current) clearTimeout(similarTimer.current);
    setSimilar([]);
    setConfirmedNotDuplicate(false);
    similarTimer.current = setTimeout(async () => {
      setCheckingSimilar(true);
      const supabase = createClient();
      const { data } = await supabase.rpc('find_similar_feedback', {
        p_title: title,
        p_body: body || ' ',
        p_type: type,
        p_limit: 4,
      });
      setSimilar((data ?? []).filter((d: SimilarItem) => d.similarity > 0.005));
      setCheckingSimilar(false);
    }, 600);
  }, [title, body, type, step]);

  const canProceedStep1 = type !== null;
  const canProceedStep2 = title.trim().length >= 5 && body.trim().length >= 10
    && (similar.length === 0 || confirmedNotDuplicate);

  const submit = async () => {
    setSubmitting(true);
    const supabase = createClient();
    const payload: Record<string, unknown> = {
      type,
      title: title.trim(),
      body: body.trim(),
      user_id: user?.id ?? null,
      author_name: authorName.trim() || (user ? null : 'Anonymous'),
      author_email: authorEmail.trim() || null,
      browser_info: browserInfo,
      is_public: true,
    };
    if (type === 'bug_report') {
      payload.steps_to_reproduce = stepsToReproduce.trim() || null;
      payload.expected_behavior  = expectedBehavior.trim() || null;
      payload.actual_behavior    = actualBehavior.trim() || null;
      payload.url_where_occurred = browserInfo.url ?? null;
    }
    if (type === 'feature_request') {
      payload.use_case = useCase.trim() || null;
    }
    if (type === 'testimonial') {
      payload.rating           = rating;
      payload.show_author_name = showAuthorName;
      payload.is_approved      = false;
      payload.is_public        = false; // pending review
    }
    const { data, error } = await supabase.from('feedback_items').insert(payload).select('id').single();
    setSubmitting(false);
    if (error) { alert('Submit failed: ' + error.message); return; }
    setSubmittedId(data.id);
    setDone(true);
    setTimeout(() => onSubmitted(), 2500);
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-surface-900 border border-surface-700 rounded-2xl p-10 max-w-sm w-full text-center">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
          <h2 className="text-xl font-black mb-2">Thanks!</h2>
          <p className="text-surface-400 text-sm mb-4">
            {type === 'testimonial'
              ? 'Your review has been submitted for approval.'
              : 'Your feedback has been submitted. You can track its progress on the feedback portal.'}
          </p>
          {submittedId && type !== 'testimonial' && (
            <a href={`/feedback/${submittedId}`} className="text-[#FF5F1F] text-sm font-bold hover:underline flex items-center justify-center gap-1">
              View your submission <ArrowRight size={14} />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-surface-900 border-b border-surface-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-black text-white">{STEP_TITLES[step]}</h2>
            <div className="flex items-center gap-1 mt-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={cn('h-1 rounded-full transition-all duration-300', i <= step ? 'w-6' : 'w-2')}
                  style={{ background: i <= step ? '#FF5F1F' : '#374151' }}
                />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-white rounded-lg hover:bg-surface-800">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">

          {/* Step 0: Choose type */}
          {step === 0 && (
            <div className="space-y-3">
              {TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => { setType(t.value); setTimeout(() => setStep(1), 150); }}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                      type === t.value ? 'border-[#FF5F1F] bg-[#FF5F1F]/5' : 'border-surface-700 hover:border-surface-600 bg-surface-800'
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.color + '22' }}>
                      <Icon size={18} style={{ color: t.color }} />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{t.label}</div>
                      <div className="text-xs text-surface-500 mt-0.5">{t.desc}</div>
                    </div>
                    <ArrowRight size={16} className="ml-auto text-surface-600" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 1: Details */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Similar issue detector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-surface-400 mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={type === 'bug_report' ? 'e.g. Export button crashes on Firefox' : type === 'feature_request' ? 'e.g. Dark mode for PDF export' : 'Write a headline…'}
                  className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white text-sm placeholder-surface-500 focus:outline-none focus:border-surface-500"
                  maxLength={200}
                />
                <div className="text-right text-[10px] text-surface-600 mt-0.5">{title.length}/200</div>
              </div>

              {/* Similar items warning */}
              {(checkingSimilar || similar.length > 0) && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                      {checkingSimilar ? 'Checking for similar issues…' : `${similar.length} similar issue${similar.length !== 1 ? 's' : ''} found`}
                    </span>
                  </div>
                  {similar.length > 0 && (
                    <>
                      <p className="text-xs text-surface-400 mb-3">Is your issue already reported? Adding your vote to an existing issue is more effective.</p>
                      <div className="space-y-2 mb-3">
                        {similar.map(s => (
                          <a key={s.id} href={`/feedback/${s.id}`} target="_blank" rel="noopener"
                            className="flex items-center gap-2 p-2 rounded-lg bg-surface-800 hover:bg-surface-700 transition-colors">
                            <ChevronUp size={12} className="text-surface-500 shrink-0" />
                            <span className="text-xs text-surface-400">{s.vote_count}</span>
                            <span className="text-xs text-white flex-1 line-clamp-1">{s.title}</span>
                            <span className="text-[10px] text-surface-500 uppercase tracking-wide">{s.status}</span>
                          </a>
                        ))}
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmedNotDuplicate}
                          onChange={e => setConfirmedNotDuplicate(e.target.checked)}
                          className="mt-0.5 rounded"
                        />
                        <span className="text-xs text-surface-400">None of these are my issue — I want to submit a new one</span>
                      </label>
                    </>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-surface-400 mb-1.5">
                  {type === 'testimonial' ? 'Your Review' : 'Description'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={4}
                  placeholder={
                    type === 'bug_report'      ? 'Describe what happened…' :
                    type === 'feature_request' ? 'Describe your idea in detail…' :
                    type === 'testimonial'     ? 'Share your experience with Screenplay Studio…' :
                    'Tell us more…'
                  }
                  className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white text-sm placeholder-surface-500 focus:outline-none focus:border-surface-500 resize-y"
                  maxLength={5000}
                />
              </div>

              {/* Bug-specific fields */}
              {type === 'bug_report' && (
                <div className="space-y-4 pl-3 border-l-2" style={{ borderColor: '#ef444433' }}>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-surface-400 mb-1.5">Steps to Reproduce</label>
                    <textarea
                      value={stepsToReproduce}
                      onChange={e => setStepsToReproduce(e.target.value)}
                      rows={3}
                      placeholder={"1. Go to…\n2. Click on…\n3. See error"}
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white text-sm placeholder-surface-500 focus:outline-none focus:border-surface-500 resize-y font-mono text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-surface-400 mb-1.5">Expected</label>
                      <textarea value={expectedBehavior} onChange={e => setExpectedBehavior(e.target.value)} rows={2}
                        placeholder="What should happen?" className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-xl text-white text-xs placeholder-surface-500 focus:outline-none focus:border-surface-500 resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-surface-400 mb-1.5">Actual</label>
                      <textarea value={actualBehavior} onChange={e => setActualBehavior(e.target.value)} rows={2}
                        placeholder="What happens instead?" className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-xl text-white text-xs placeholder-surface-500 focus:outline-none focus:border-surface-500 resize-none" />
                    </div>
                  </div>
                  <div className="text-xs text-surface-600 bg-surface-800 rounded-lg px-3 py-2 font-mono">
                    🌐 Browser info will be auto-attached: {browserInfo.ua?.slice(0, 60)}…
                  </div>
                </div>
              )}

              {/* Feature-specific */}
              {type === 'feature_request' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-surface-400 mb-1.5">Use Case</label>
                  <textarea value={useCase} onChange={e => setUseCase(e.target.value)} rows={2}
                    placeholder="When would you use this? Who would benefit?"
                    className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white text-sm placeholder-surface-500 focus:outline-none focus:border-surface-500 resize-y" />
                </div>
              )}

              {/* Testimonial-specific */}
              {type === 'testimonial' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-surface-400 mb-2">Rating</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(r => (
                        <button key={r} onClick={() => setRating(r)}
                          className={cn('w-10 h-10 rounded-lg text-lg transition-all', r <= rating ? 'bg-amber-400/20' : 'bg-surface-800 opacity-40')}>
                          ⭐
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-surface-400">
                    <input type="checkbox" checked={showAuthorName} onChange={e => setShowAuthorName(e.target.checked)} className="rounded" />
                    Show my name publicly
                  </label>
                </div>
              )}

              {/* Author (if not logged in) */}
              {!user && (
                <div className="pt-2 border-t border-surface-800 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-surface-400 mb-1.5">Your Name</label>
                    <input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Optional"
                      className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-xl text-white text-sm placeholder-surface-500 focus:outline-none focus:border-surface-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-surface-400 mb-1.5">Email</label>
                    <input value={authorEmail} onChange={e => setAuthorEmail(e.target.value)} type="email" placeholder="For update notifications"
                      className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-xl text-white text-sm placeholder-surface-500 focus:outline-none focus:border-surface-500" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-surface-700 bg-surface-800 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-surface-500">
                    {TYPES.find(t => t.value === type)?.label}
                  </span>
                </div>
                <h3 className="font-bold text-white">{title}</h3>
                <p className="text-sm text-surface-400 whitespace-pre-wrap">{body}</p>
                {type === 'bug_report' && stepsToReproduce && (
                  <div className="mt-2 text-xs text-surface-500">
                    <span className="font-bold text-surface-400">Steps: </span>{stepsToReproduce}
                  </div>
                )}
              </div>
              <p className="text-xs text-surface-500">
                By submitting, you agree that your feedback may be shown publicly.
                {type === 'testimonial' && ' Reviews are moderated before appearing.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface-900 border-t border-surface-800 px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => step === 0 ? onClose() : setStep(s => Math.max(0, s - 1) as 0|1|2)}
            className="px-4 py-2 text-sm font-semibold text-surface-400 hover:text-white border border-surface-700 rounded-xl hover:border-surface-600 transition-all"
          >
            {step === 0 ? 'Cancel' : '← Back'}
          </button>

          {step < 2 ? (
            <button
              onClick={() => setStep(s => Math.min(2, s + 1) as 0|1|2)}
              disabled={step === 0 ? !canProceedStep1 : !canProceedStep2}
              className={cn(
                'px-5 py-2 text-sm font-bold text-white rounded-xl flex items-center gap-2 transition-all',
                (step === 0 ? canProceedStep1 : canProceedStep2)
                  ? 'hover:-translate-y-px'
                  : 'opacity-40 cursor-not-allowed'
              )}
              style={{ background: '#FF5F1F' }}
            >
              Review & Submit <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="px-5 py-2 text-sm font-bold text-white rounded-xl flex items-center gap-2 hover:-translate-y-px transition-all"
              style={{ background: '#FF5F1F' }}
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <><CheckCircle2 size={14} /> Submit</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
