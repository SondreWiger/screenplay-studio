'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// Public Casting Call Form
// Anyone with the link can view roles and submit an application.
// No authentication required.
// ============================================================

type CastingQuestion = {
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
  required: boolean;
};

type CastingCharacter = {
  id: string;
  name: string;
  full_name: string | null;
  age: string | null;
  gender: string | null;
  description: string | null;
  is_main: boolean;
};

export default function PublicCastingCallPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shareData, setShareData] = useState<any>(null);
  const [instructions, setInstructions] = useState('');
  const [questions, setQuestions] = useState<CastingQuestion[]>([]);
  const [characters, setCharacters] = useState<CastingCharacter[]>([]);
  const [projectTitle, setProjectTitle] = useState('');
  const [callTitle, setCallTitle] = useState('');

  // Form state
  const [selectedRole, setSelectedRole] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCastingCall();
  }, [params.token]);

  const loadCastingCall = async () => {
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from('external_shares')
      .select('*')
      .eq('access_token', params.token)
      .eq('share_type', 'casting')
      .eq('is_active', true)
      .single();

    if (fetchErr || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // Increment view count
    await supabase
      .from('external_shares')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id);

    setShareData(data);
    const snapshot = data.content_snapshot as any;
    setInstructions(snapshot?.instructions || '');
    setQuestions(snapshot?.questions || []);
    setCharacters(snapshot?.characters || []);
    setProjectTitle(snapshot?.project_title || '');
    setCallTitle(data.title || 'Casting Call');

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setNotFound(true);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate required fields
    for (const q of questions) {
      if (q.required && !answers[q.label]?.trim()) {
        setError(`Please fill in "${q.label}"`);
        return;
      }
    }
    if (characters.length > 0 && !selectedRole) {
      setError('Please select a role you are applying for');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const submission = {
        role_id: selectedRole || null,
        role_name: characters.find(c => c.id === selectedRole)?.name || 'General',
        answers,
        submitted_at: new Date().toISOString(),
      };

      // Append submission to the content_snapshot.submissions array
      const snapshot = shareData.content_snapshot || {};
      const submissions = snapshot.submissions || [];
      submissions.push(submission);

      const { error: updateErr } = await supabase
        .from('external_shares')
        .update({
          content_snapshot: { ...snapshot, submissions },
        })
        .eq('id', shareData.id);

      if (updateErr) throw updateErr;
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  // ── Not Found ───────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-neutral-900 flex items-center justify-center">
            <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <h1 className="text-xl font-black text-white mb-2">Casting Call Not Found</h1>
          <p className="text-sm text-neutral-400">This casting call link may have expired or been deactivated.</p>
        </div>
      </div>
    );
  }

  // ── Submitted ───────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Application Submitted!</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Thank you for your interest in <span className="text-white font-medium">{projectTitle}</span>.
            The production team will review your submission and get in touch if there&apos;s a match.
          </p>
          <p className="text-xs text-neutral-500">You may close this page.</p>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="border-b border-neutral-800 bg-neutral-900/50">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <p className="text-xs text-amber-400 uppercase tracking-wider font-medium mb-1">Casting Call</p>
          <h1 className="text-2xl font-black">{callTitle}</h1>
          {projectTitle && <p className="text-sm text-neutral-400 mt-1">for &ldquo;{projectTitle}&rdquo;</p>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Instructions */}
        {instructions && (
          <div className="mb-8 p-4 rounded-lg bg-neutral-900 border border-neutral-800">
            <h2 className="text-sm font-semibold text-neutral-300 mb-2">Instructions</h2>
            <p className="text-sm text-neutral-400 whitespace-pre-wrap">{instructions}</p>
          </div>
        )}

        {/* Available Roles */}
        {characters.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-neutral-300 mb-3">Available Roles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {characters.map((char) => (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => setSelectedRole(char.id)}
                  className={`text-left p-4 rounded-lg border transition-all ${
                    selectedRole === char.id
                      ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                      : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white">{char.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${char.is_main ? 'bg-[#FF5F1F]/20 text-[#FF5F1F]' : 'bg-neutral-800 text-neutral-400'}`}>
                      {char.is_main ? 'Lead' : 'Supporting'}
                    </span>
                  </div>
                  {(char.age || char.gender) && (
                    <p className="text-xs text-neutral-500 mb-1">
                      {[char.age, char.gender].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {char.description && (
                    <p className="text-xs text-neutral-400 line-clamp-3">{char.description}</p>
                  )}
                </button>
              ))}
            </div>
            {selectedRole && (
              <p className="text-xs text-amber-400 mt-2">
                Applying for: {characters.find(c => c.id === selectedRole)?.name}
              </p>
            )}
          </div>
        )}

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <h2 className="text-sm font-semibold text-neutral-300">Your Application</h2>

          {questions.map((q, idx) => (
            <div key={idx}>
              <label className="block text-sm text-neutral-300 mb-1.5">
                {q.label}
                {q.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {q.type === 'textarea' ? (
                <textarea
                  value={answers[q.label] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [q.label]: e.target.value }))}
                  rows={4}
                  placeholder={`Enter ${q.label.toLowerCase()}...`}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors placeholder-neutral-600"
                />
              ) : q.type === 'select' ? (
                <select
                  value={answers[q.label] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [q.label]: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                >
                  <option value="">Select...</option>
                  {q.options?.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={answers[q.label] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [q.label]: e.target.value }))}
                  placeholder={`Enter ${q.label.toLowerCase()}...`}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors placeholder-neutral-600"
                />
              )}
            </div>
          ))}

          {/* Self-tape / headshot URL */}
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">
              Self-Tape / Demo Reel URL <span className="text-neutral-500">(optional)</span>
            </label>
            <input
              type="url"
              value={answers['__demo_url'] || ''}
              onChange={(e) => setAnswers(prev => ({ ...prev, '__demo_url': e.target.value }))}
              placeholder="https://youtube.com/... or https://vimeo.com/..."
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors placeholder-neutral-600"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">
              Headshot / Photo URL <span className="text-neutral-500">(optional)</span>
            </label>
            <input
              type="url"
              value={answers['__headshot_url'] || ''}
              onChange={(e) => setAnswers(prev => ({ ...prev, '__headshot_url': e.target.value }))}
              placeholder="Link to your headshot..."
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors placeholder-neutral-600"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-6 rounded-lg bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black" />
                Submitting...
              </span>
            ) : (
              'Submit Application'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-neutral-800 text-center">
          <p className="text-xs text-neutral-600">
            Powered by Screenplay Studio
          </p>
        </div>
      </div>
    </div>
  );
}
