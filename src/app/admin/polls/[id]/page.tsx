'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';
import type { PollSession, PollQuestion, PollQuestionType } from '@/lib/types';
import type { QuestionResult } from '@/components/PollResultChart';
import { PollResultCard } from '@/components/PollResultChart';

// ============================================================
// Admin — Poll Detail / Editor / Results
// ============================================================

const QUESTION_TYPES: { value: PollQuestionType; label: string; desc: string }[] = [
  { value: 'yes_no',        label: 'Yes / No',       desc: 'Simple binary choice' },
  { value: 'single_select', label: 'Single select',  desc: 'Pick exactly one option' },
  { value: 'multi_select',  label: 'Multi-select',   desc: 'Pick all that apply' },
  { value: 'ranking',       label: 'Ranking',        desc: 'Order items by preference' },
  { value: 'short_text',    label: 'Short text',     desc: 'One-line free response' },
  { value: 'long_text',     label: 'Long text',      desc: 'Open-ended paragraph' },
];

const STATUS_COLOR: Record<string, string> = {
  draft:     'bg-white/10 text-white/50',
  review:    'bg-amber-500/20 text-amber-300',
  published: 'bg-emerald-500/20 text-emerald-300',
  closed:    'bg-white/5 text-white/30',
};


export default function AdminPollDetailPage({ params }: { params: { id: string } }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<PollSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<QuestionResult[] | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Edit state for session metadata
  const [editTitle, setEditTitle] = useState('');
  const [editPreface, setEditPreface] = useState('');
  const [metaDirty, setMetaDirty] = useState(false);

  // Active view mode
  type View = 'edit' | 'review' | 'results';
  const [view, setView] = useState<View>('edit');

  // Review step
  const [reviewStep, setReviewStep] = useState(0);

  // Publishing
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // New question form
  const [addingQ, setAddingQ] = useState(false);
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState<PollQuestionType>('single_select');
  const [newQOptions, setNewQOptions] = useState('');
  const [newQRequired, setNewQRequired] = useState(true);

  // Editing existing question
  const [editingQ, setEditingQ] = useState<string | null>(null);
  const [editQText, setEditQText] = useState('');
  const [editQType, setEditQType] = useState<PollQuestionType>('single_select');
  const [editQOptions, setEditQOptions] = useState('');
  const [editQRequired, setEditQRequired] = useState(true);

  const isAdmin = user && (user.id === 'f0e0c4a4-0833-4c64-b012-15829c087c77' || user.role === 'admin');

  const load = useCallback(() => {
    fetch(`/api/admin/polls/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setSession(d);
        setEditTitle(d.title ?? '');
        setEditPreface(d.preface ?? '');
        setLoading(false);
      });
  }, [params.id]);

  useEffect(() => {
    if (!authLoading && !isAdmin) { router.push('/admin'); return; }
    if (!isAdmin) return;
    load();
  }, [isAdmin, authLoading, router, load]);

  const loadResults = useCallback(() => {
    setLoadingResults(true);
    fetch(`/api/admin/polls/${params.id}/results`)
      .then((r) => r.json())
      .then((d) => { setResults(d.results ?? []); setLoadingResults(false); });
  }, [params.id]);

  useEffect(() => {
    if (view === 'results' && results === null) loadResults();
  }, [view, results, loadResults]);

  const saveMeta = async () => {
    setSaving(true);
    await fetch(`/api/admin/polls/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, preface: editPreface || null }),
    });
    setSession((s) => s ? { ...s, title: editTitle, preface: editPreface || null } : s);
    setMetaDirty(false);
    setSaving(false);
  };

  const addQuestion = async () => {
    if (!newQText.trim()) return;
    const needsOptions = ['single_select', 'multi_select', 'ranking'].includes(newQType);
    const opts = needsOptions ? newQOptions.split('\n').map((o) => o.trim()).filter(Boolean) : null;
    setSaving(true);
    const res = await fetch(`/api/admin/polls/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions: [{
          question_text: newQText.trim(),
          question_type: newQType,
          options: opts,
          is_required: newQRequired,
          sort_order: (session?.questions?.length ?? 0) * 10 + 10,
        }],
      }),
    });
    const data = await res.json();
    setSession(data);
    setNewQText(''); setNewQType('single_select'); setNewQOptions(''); setNewQRequired(true);
    setAddingQ(false);
    setSaving(false);
  };

  const saveQuestion = async (q: PollQuestion) => {
    const needsOptions = ['single_select', 'multi_select', 'ranking'].includes(editQType);
    const opts = needsOptions ? editQOptions.split('\n').map((o) => o.trim()).filter(Boolean) : null;
    setSaving(true);
    const res = await fetch(`/api/admin/polls/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions: [{
          id: q.id,
          question_text: editQText.trim(),
          question_type: editQType,
          options: opts,
          is_required: editQRequired,
          is_approved: false, // reset approval on edit
        }],
      }),
    });
    const data = await res.json();
    setSession(data);
    setEditingQ(null);
    setSaving(false);
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    setSaving(true);
    const res = await fetch(`/api/admin/polls/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: [{ id, _delete: true }] }),
    });
    const data = await res.json();
    setSession(data);
    setSaving(false);
  };

  const toggleApprove = async (q: PollQuestion) => {
    setSaving(true);
    const res = await fetch(`/api/admin/polls/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: [{ id: q.id, is_approved: !q.is_approved }] }),
    });
    const data = await res.json();
    setSession(data);
    setSaving(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    const res = await fetch(`/api/admin/polls/${params.id}/publish`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setPublishError(data.error ?? 'Publish failed');
      setPublishing(false);
      return;
    }
    setPublishing(false);
    // Show any notification errors as a warning (poll still published)
    if (data.notification_errors?.length) {
      setPublishError(`Published! But notifications failed: ${data.notification_errors[0]}`);
    }
    load();
    setView('results');
  };

  const moveQuestion = async (q: PollQuestion, direction: -1 | 1) => {
    const qs = [...(session?.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const idx = qs.findIndex((x) => x.id === q.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= qs.length) return;
    // Swap sort_orders
    setSaving(true);
    await fetch(`/api/admin/polls/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions: [
          { id: qs[idx].id, sort_order: qs[swapIdx].sort_order },
          { id: qs[swapIdx].id, sort_order: qs[idx].sort_order },
        ],
      }),
    });
    load();
    setSaving(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <div className="min-h-screen bg-surface-950 flex items-center justify-center text-white/40">Poll not found</div>;

  const questions = [...(session.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const allApproved = questions.length > 0 && questions.every((q) => q.is_approved);
  const approvedCount = questions.filter((q) => q.is_approved).length;
  const canPublish = allApproved && session.status !== 'published' && session.status !== 'closed';
  const isLive = session.status === 'published' || session.status === 'closed';
  const reviewQ = questions[reviewStep] ?? null;

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-surface-950/95 border-b border-white/[0.06] px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin/polls" className="text-white/40 hover:text-white transition-colors text-sm flex-shrink-0">
            ← Polls
          </Link>
          <span className="text-white/20">/</span>
          <h1 className="text-sm font-semibold text-white truncate">{session.title}</h1>
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[session.status]}`}>
            {session.status}
          </span>
        </div>
        {saving && (
          <span className="text-xs text-white/30 flex-shrink-0">Saving…</span>
        )}
      </header>

      {/* Tab bar */}
      <div className="border-b border-white/[0.06] px-6">
        <div className="flex gap-0">
          {(['edit', 'review', 'results'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-3 text-sm font-medium transition-colors capitalize border-b-2 ${
                view === v
                  ? 'text-white border-[#FF5F1F]'
                  : 'text-white/40 hover:text-white border-transparent'
              }`}
            >
              {v === 'review'
                ? `Review (${approvedCount}/${questions.length})`
                : v === 'results'
                  ? `Results${isLive ? ` · ${session.response_count}` : ''}`
                  : 'Edit'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8">

        {/* ── Edit Tab ─────────────────────────────────────────── */}
        {view === 'edit' && (
          <div className="space-y-6">
            {/* Session meta */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Poll details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => { setEditTitle(e.target.value); setMetaDirty(true); }}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF5F1F]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                    Preface <span className="normal-case text-white/20">(displayed on the intro page)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={editPreface}
                    onChange={(e) => { setEditPreface(e.target.value); setMetaDirty(true); }}
                    placeholder="Tell users what this poll is about and why their input matters…"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF5F1F]/50 resize-none"
                  />
                </div>
                {metaDirty && (
                  <button onClick={saveMeta} disabled={saving} className="px-4 py-2 bg-[#FF5F1F] hover:bg-[#FF7F3F] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                    Save changes
                  </button>
                )}
              </div>
            </div>

            {/* Questions list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Questions ({questions.length})</h2>
                {!isLive && (
                  <button
                    onClick={() => setAddingQ(true)}
                    className="text-xs px-3 py-1.5 border border-white/20 hover:border-white/40 text-white/60 hover:text-white rounded-lg transition-colors"
                  >
                    + Add question
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={idx}
                    total={questions.length}
                    locked={isLive}
                    isEditing={editingQ === q.id}
                    editQText={editQText}
                    editQType={editQType}
                    editQOptions={editQOptions}
                    editQRequired={editQRequired}
                    onStartEdit={() => {
                      setEditingQ(q.id);
                      setEditQText(q.question_text);
                      setEditQType(q.question_type);
                      setEditQOptions(Array.isArray(q.options) ? q.options.join('\n') : '');
                      setEditQRequired(q.is_required);
                    }}
                    onCancelEdit={() => setEditingQ(null)}
                    onSaveEdit={() => saveQuestion(q)}
                    onDelete={() => deleteQuestion(q.id)}
                    onMoveUp={() => moveQuestion(q, -1)}
                    onMoveDown={() => moveQuestion(q, 1)}
                    setEditQText={setEditQText}
                    setEditQType={setEditQType}
                    setEditQOptions={setEditQOptions}
                    setEditQRequired={setEditQRequired}
                  />
                ))}
              </div>

              {questions.length === 0 && (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
                  <p className="text-white/30 text-sm">No questions yet</p>
                </div>
              )}
            </div>

            {/* Add question form */}
            {addingQ && !isLive && (
              <QuestionForm
                qText={newQText} setQText={setNewQText}
                qType={newQType} setQType={setNewQType}
                qOptions={newQOptions} setQOptions={setNewQOptions}
                qRequired={newQRequired} setQRequired={setNewQRequired}
                onSave={addQuestion}
                onCancel={() => setAddingQ(false)}
                saving={saving}
                title="New question"
              />
            )}

            {/* Actions bar */}
            {!isLive && questions.length > 0 && (
              <div className="pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/40">
                    Once all questions are approved in the Review tab, you can publish.
                  </p>
                  <button
                    onClick={() => setView('review')}
                    className="px-4 py-2 border border-white/20 hover:border-white/40 text-white/60 hover:text-white text-sm rounded-lg transition-colors"
                  >
                    Go to Review →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Review Tab ───────────────────────────────────────── */}
        {view === 'review' && (
          <div>
            {questions.length === 0 ? (
              <div className="text-center py-16 text-white/30 text-sm">No questions to review.</div>
            ) : reviewStep >= questions.length ? (
              /* All reviewed */
              <div className="text-center py-10">
                <div className="text-5xl mb-4">{allApproved ? '✅' : '⚠️'}</div>
                <h2 className="text-xl font-bold text-white mb-2">
                  {allApproved ? 'All questions approved!' : `${approvedCount} of ${questions.length} approved`}
                </h2>
                <p className="text-white/40 text-sm mb-8">
                  {allApproved
                    ? 'You\'re good to publish. Clicking Publish will notify all users.'
                    : 'Some questions still need approval. Go back to review them.'}
                </p>

                {publishError && (
                  <p className="text-red-400 text-sm mb-4">{publishError}</p>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => setReviewStep(0)}
                    className="px-5 py-2.5 border border-white/20 hover:border-white/40 text-white/60 hover:text-white text-sm rounded-xl transition-colors"
                  >
                    ← Review again
                  </button>
                  {canPublish && (
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
                    >
                      {publishing
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Publishing…</>
                        : '🚀 Publish & Notify All Users'
                      }
                    </button>
                  )}
                </div>

                {/* Summary of approval status */}
                <div className="mt-8 space-y-2 text-left max-w-sm mx-auto">
                  {questions.map((q, i) => (
                    <div key={q.id} className="flex items-center gap-3 text-sm">
                      <span className={q.is_approved ? 'text-emerald-400' : 'text-amber-400'}>{q.is_approved ? '✓' : '○'}</span>
                      <span className="text-white/60 truncate">{i + 1}. {q.question_text}</span>
                      <button onClick={() => { setReviewStep(i); }} className="text-white/30 hover:text-white ml-auto flex-shrink-0 text-xs underline">edit</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : reviewQ ? (
              /* Individual question review */
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-white/30 uppercase tracking-wider">
                    Question {reviewStep + 1} of {questions.length}
                  </p>
                  <div className="flex gap-2">
                    {questions.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setReviewStep(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          i === reviewStep ? 'bg-[#FF5F1F]' : questions[i].is_approved ? 'bg-emerald-500' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Question preview card */}
                <div className={`rounded-2xl border p-6 mb-5 transition-colors ${
                  reviewQ.is_approved
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-white/10 bg-white/[0.03]'
                }`}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <p className="text-lg font-semibold text-white leading-snug">{reviewQ.question_text}</p>
                    {reviewQ.is_approved && (
                      <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                      {QUESTION_TYPES.find((t) => t.value === reviewQ.question_type)?.label ?? reviewQ.question_type}
                    </span>
                    {!reviewQ.is_required && (
                      <span className="text-xs bg-white/5 text-white/30 px-2 py-0.5 rounded-full">Optional</span>
                    )}
                  </div>
                  {/* Show options preview */}
                  {Array.isArray(reviewQ.options) && reviewQ.options.length > 0 && (
                    <div className="space-y-2">
                      {reviewQ.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-white/50">
                          <span className="text-white/20">{i + 1}.</span> {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  {(reviewQ.question_type === 'yes_no') && (
                    <div className="flex gap-3">
                      <div className="px-4 py-2 border border-white/10 rounded-lg text-white/40 text-sm">👍 Yes</div>
                      <div className="px-4 py-2 border border-white/10 rounded-lg text-white/40 text-sm">👎 No</div>
                    </div>
                  )}
                  {(reviewQ.question_type === 'short_text') && (
                    <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2 text-white/20 text-sm italic">Short text answer…</div>
                  )}
                  {(reviewQ.question_type === 'long_text') && (
                    <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-8 text-white/20 text-sm italic text-center">Long text answer…</div>
                  )}
                </div>

                {/* Approve / actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { toggleApprove(reviewQ); if (!reviewQ.is_approved) setReviewStep((s) => s + 1); }}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      reviewQ.is_approved
                        ? 'bg-white/5 hover:bg-white/10 text-white/40 border border-white/10'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {reviewQ.is_approved ? '✓ Approved — un-approve' : '✓ Looks good — Approve'}
                  </button>
                  <button
                    onClick={() => { setView('edit'); setEditingQ(reviewQ.id); setEditQText(reviewQ.question_text); setEditQType(reviewQ.question_type); setEditQOptions(Array.isArray(reviewQ.options) ? reviewQ.options.join('\n') : ''); setEditQRequired(reviewQ.is_required); }}
                    className="px-4 py-3 border border-white/10 hover:border-white/30 text-white/40 hover:text-white text-sm rounded-xl transition-colors"
                  >
                    Edit
                  </button>
                </div>

                <div className="flex gap-3 mt-3">
                  {reviewStep > 0 && (
                    <button onClick={() => setReviewStep((s) => s - 1)} className="text-sm text-white/30 hover:text-white transition-colors">
                      ← Previous
                    </button>
                  )}
                  <button onClick={() => setReviewStep((s) => s + 1)} className="text-sm text-white/30 hover:text-white transition-colors ml-auto">
                    Skip →
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ── Results Tab ──────────────────────────────────────── */}
        {view === 'results' && (
          <div>
            {!isLive && (
              <div className="text-center py-10 text-white/30 text-sm">
                Results will be available after the poll is published.
              </div>
            )}
            {isLive && loadingResults && (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {isLive && !loadingResults && results !== null && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/40">
                    <span className="text-white font-bold text-base">{session.response_count}</span> total response{session.response_count !== 1 ? 's' : ''}
                  </p>
                  <button onClick={() => { setResults(null); loadResults(); }} className="text-xs text-white/30 hover:text-white transition-colors">
                    Refresh
                  </button>
                </div>

                {results.map((r) => (
                  <PollResultCard key={r.question_id} result={r} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Question Card ─────────────────────────────────────────────

function QuestionCard({
  question, index, total, locked,
  isEditing, editQText, editQType, editQOptions, editQRequired,
  onStartEdit, onCancelEdit, onSaveEdit, onDelete, onMoveUp, onMoveDown,
  setEditQText, setEditQType, setEditQOptions, setEditQRequired,
}: {
  question: PollQuestion;
  index: number;
  total: number;
  locked: boolean;
  isEditing: boolean;
  editQText: string;
  editQType: PollQuestionType;
  editQOptions: string;
  editQRequired: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  setEditQText: (v: string) => void;
  setEditQType: (v: PollQuestionType) => void;
  setEditQOptions: (v: string) => void;
  setEditQRequired: (v: boolean) => void;
}) {
  if (isEditing) {
    return (
      <QuestionForm
        qText={editQText} setQText={setEditQText}
        qType={editQType} setQType={setEditQType}
        qOptions={editQOptions} setQOptions={setEditQOptions}
        qRequired={editQRequired} setQRequired={setEditQRequired}
        onSave={onSaveEdit}
        onCancel={onCancelEdit}
        saving={false}
        title={`Edit question ${index + 1}`}
      />
    );
  }

  return (
    <div className={`bg-white/[0.03] border rounded-xl p-4 ${question.is_approved ? 'border-emerald-500/20' : 'border-white/[0.06]'}`}>
      <div className="flex items-start gap-3">
        <span className="text-white/20 text-sm font-mono w-5 flex-shrink-0 pt-0.5">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium leading-snug">{question.question_text}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] bg-white/8 text-white/40 px-1.5 py-0.5 rounded">
              {QUESTION_TYPES.find((t) => t.value === question.question_type)?.label ?? question.question_type}
            </span>
            {!question.is_required && (
              <span className="text-[10px] text-white/25">optional</span>
            )}
            {Array.isArray(question.options) && (
              <span className="text-[10px] text-white/25">{question.options.length} options</span>
            )}
            {question.is_approved && (
              <span className="text-[10px] text-emerald-400">✓ approved</span>
            )}
          </div>
        </div>
        {!locked && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onMoveUp} disabled={index === 0} className="p-1 text-white/20 hover:text-white disabled:opacity-0 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            </button>
            <button onClick={onMoveDown} disabled={index === total - 1} className="p-1 text-white/20 hover:text-white disabled:opacity-0 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button onClick={onStartEdit} className="p-1 text-white/30 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button onClick={onDelete} className="p-1 text-white/20 hover:text-red-400 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Question Form ─────────────────────────────────────────────

function QuestionForm({
  qText, setQText, qType, setQType, qOptions, setQOptions, qRequired, setQRequired,
  onSave, onCancel, saving, title,
}: {
  qText: string; setQText: (v: string) => void;
  qType: PollQuestionType; setQType: (v: PollQuestionType) => void;
  qOptions: string; setQOptions: (v: string) => void;
  qRequired: boolean; setQRequired: (v: boolean) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; title: string;
}) {
  const needsOptions = ['single_select', 'multi_select', 'ranking'].includes(qType);

  return (
    <div className="bg-white/[0.04] border border-[#FF5F1F]/20 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Question</label>
          <input
            type="text"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="What would you like to ask?"
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF5F1F]/50"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {QUESTION_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setQType(t.value)}
                className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                  qType === t.value
                    ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 text-white'
                    : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white'
                }`}
              >
                <p className="text-xs font-semibold">{t.label}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
        {needsOptions && (
          <div>
            <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
              Options <span className="normal-case text-white/20">(one per line)</span>
            </label>
            <textarea
              rows={4}
              value={qOptions}
              onChange={(e) => setQOptions(e.target.value)}
              placeholder={"Option A\nOption B\nOption C"}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF5F1F]/50 resize-none font-mono"
            />
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={qRequired} onChange={(e) => setQRequired(e.target.checked)} className="w-4 h-4 accent-[#FF5F1F]" />
          <span className="text-sm text-white/60">Required</span>
        </label>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={onCancel} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white/50 text-sm rounded-xl transition-colors">
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!qText.trim() || saving}
          className="flex-1 py-2 bg-[#FF5F1F] hover:bg-[#FF7F3F] disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? 'Saving…' : 'Save question'}
        </button>
      </div>
    </div>
  );
}


