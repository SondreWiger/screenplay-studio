'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Input, LoadingPage } from '@/components/ui';
import type { ExternalShare, ReviewSession } from '@/lib/types';

// ============================================================
// Public Share Viewer — external stakeholders view shared content
// No authentication required.
// ============================================================

export default function ShareViewerPage({ params }: { params: { token: string } }) {
  const [share, setShare] = useState<ExternalShare | null>(null);
  const [project, setProject] = useState<any>(null);
  const [scriptContent, setScriptContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  // Review state
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [overallRating, setOverallRating] = useState(0);
  const [overallNotes, setOverallNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchShare(); }, [params.token]);

  const fetchShare = async () => {
    try {
      const supabase = createClient();
      // Fetch via RPC or direct select (public access needed)
      const { data, error: fetchErr } = await supabase
        .from('external_shares')
        .select('*')
        .eq('access_token', params.token)
        .eq('is_active', true)
        .maybeSingle();

      if (fetchErr || !data) {
        setError('This share link is invalid or has been deactivated.');
        setLoading(false);
        return;
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('This share link has expired.');
        setLoading(false);
        return;
      }

      // Check max views
      if (data.max_views && data.view_count >= data.max_views) {
        setError('This share link has reached its maximum number of views.');
        setLoading(false);
        return;
      }

      setShare(data);

      // Check if password protected
      if (data.password_hash) {
        setLoading(false);
        return;
      }

      setAuthenticated(true);
      await loadContent(data, supabase);
    } catch {
      setError('Something went wrong loading this share.');
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!share) return;
    // Simple check (in production, use bcrypt)
    if (btoa(passwordInput) !== share.password_hash) {
      setError('Incorrect password');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setAuthenticated(true);
    setLoading(true);
    const supabase = createClient();
    await loadContent(share, supabase);
  };

  const loadContent = async (shareData: ExternalShare, supabase: any) => {
    try {
      // Increment view count (may fail for anon users without UPDATE policy — that's ok)
      supabase.from('external_shares').update({
        view_count: (shareData.view_count || 0) + 1,
      }).eq('id', shareData.id).then(() => {});

      // Use snapshot data stored at share creation time (no auth needed)
      if (shareData.content_snapshot) {
        const snap = shareData.content_snapshot as any;
        if (snap.project) setProject(snap.project);
        if (snap.scripts) setScriptContent(snap.scripts);
      }
    } catch (err) {
      console.error('Error loading content:', err);
    } finally {
      setLoading(false);
    }
  };

  const startReview = async () => {
    if (!share || !reviewerName.trim()) return;
    const supabase = createClient();
    const { data } = await supabase.from('review_sessions').insert({
      share_id: share.id,
      project_id: share.project_id,
      reviewer_name: reviewerName.trim(),
      reviewer_email: reviewerEmail.trim() || null,
      status: 'in_progress',
    }).select().single();
    if (data) setReviewSession(data);
    setShowReviewForm(false);
  };

  const submitReview = async () => {
    if (!reviewSession) return;
    setSubmitting(true);
    const supabase = createClient();
    await supabase.from('review_sessions').update({
      status: 'submitted',
      overall_rating: overallRating || null,
      overall_notes: overallNotes.trim() || null,
      submitted_at: new Date().toISOString(),
    }).eq('id', reviewSession.id);
    setReviewSession({ ...reviewSession, status: 'submitted' });
    setSubmitting(false);
  };

  if (loading) return <LoadingPage />;

  if (error && !share) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-white mb-2">Link Unavailable</h1>
          <p className="text-sm text-surface-400">{error}</p>
        </Card>
      </div>
    );
  }

  // Password gate
  if (share && !authenticated) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <Card className="p-8 max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="text-3xl mb-3">🔒</div>
            <h1 className="text-xl font-bold text-white mb-1">Password Protected</h1>
            <p className="text-sm text-surface-400">Enter the password to view this content.</p>
          </div>
          {error && <p className="text-sm text-red-400 text-center mb-3">{error}</p>}
          <Input
            type="password"
            value={passwordInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordInput(e.target.value)}
            placeholder="Enter password"
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handlePasswordSubmit()}
          />
          <Button className="w-full mt-3" onClick={handlePasswordSubmit}>Access</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <div className="border-b border-surface-800 bg-surface-950 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {share?.branding?.logo_url ? (
              <img src={share.branding.logo_url} alt="" className="h-8 w-auto" />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-orange-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                SS
              </div>
            )}
            <div>
              <h1 className="text-sm font-semibold text-white">{share?.title || project?.title || 'Shared Content'}</h1>
              {share?.branding?.company_name && (
                <p className="text-[11px] text-surface-500">{share.branding.company_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {share?.allow_comments && !reviewSession && (
              <Button size="sm" variant="secondary" onClick={() => setShowReviewForm(true)}>
                Leave Feedback
              </Button>
            )}
            {reviewSession && reviewSession.status !== 'submitted' && (
              <Button size="sm" onClick={submitReview} loading={submitting}>
                Submit Review
              </Button>
            )}
            {reviewSession?.status === 'submitted' && (
              <span className="text-xs text-green-400 font-medium">✓ Review Submitted</span>
            )}
          </div>
        </div>
      </div>

      {/* Watermark overlay */}
      {share?.watermark_text && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden opacity-[0.04]">
          <div className="text-8xl font-bold text-white whitespace-nowrap rotate-[-30deg] select-none">
            {share.watermark_text}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Project header */}
        {project && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1">{project.title}</h2>
            {project.logline && <p className="text-surface-400">{project.logline}</p>}
            {project.genre && <p className="text-xs text-surface-500 mt-2">{Array.isArray(project.genre) ? project.genre.join(', ') : project.genre} • {project.format}</p>}
          </div>
        )}

        {/* Script content */}
        {scriptContent.length > 0 && (
          <div className="space-y-6">
            {scriptContent.map((script, idx) => (
              <Card key={idx} className="p-6 sm:p-8">
                {script.title && <h3 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-surface-800">{script.title}</h3>}
                <div className="screenplay-content space-y-2">
                  {Array.isArray(script.content) ? (
                    script.content.map((element: any, elIdx: number) => (
                      <div
                        key={elIdx}
                        className={`script-element ${element.type || 'action'}`}
                        data-element-type={element.type}
                      >
                        {element.type === 'scene_heading' && (
                          <p className="font-bold text-white uppercase tracking-wide">{element.text}</p>
                        )}
                        {element.type === 'action' && (
                          <p className="text-surface-300">{element.text}</p>
                        )}
                        {element.type === 'character' && (
                          <p className="text-center font-semibold text-white uppercase mt-4">{element.text}</p>
                        )}
                        {element.type === 'dialogue' && (
                          <p className="text-surface-300 mx-auto max-w-md text-center">{element.text}</p>
                        )}
                        {element.type === 'parenthetical' && (
                          <p className="text-surface-500 italic mx-auto max-w-sm text-center">({element.text})</p>
                        )}
                        {element.type === 'transition' && (
                          <p className="text-right text-surface-400 uppercase">{element.text}</p>
                        )}
                        {!['scene_heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'].includes(element.type || '') && (
                          <p className="text-surface-400">{element.text}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-surface-400 whitespace-pre-wrap">{typeof script.content === 'string' ? script.content : JSON.stringify(script.content, null, 2)}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {scriptContent.length === 0 && share?.share_type !== 'script' && (
          <Card className="p-12 text-center">
            <p className="text-surface-400">Content loading...</p>
          </Card>
        )}

        {/* Review rating */}
        {reviewSession && reviewSession.status !== 'submitted' && (
          <Card className="p-6 mt-8 border border-brand-500/20">
            <h3 className="text-lg font-semibold text-white mb-4">Your Review</h3>
            <div className="mb-4">
              <label className="block text-sm text-surface-300 mb-2">Overall Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setOverallRating(star)}
                    className={`text-2xl transition-colors ${star <= overallRating ? 'text-amber-400' : 'text-surface-700 hover:text-surface-500'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-surface-300 mb-2">Notes</label>
              <textarea
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white resize-none"
                placeholder="Share your overall thoughts..."
              />
            </div>
            <Button onClick={submitReview} loading={submitting}>Submit Review</Button>
          </Card>
        )}
      </div>

      {/* Review form modal */}
      {showReviewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowReviewForm(false)}>
          <div onClick={(e) => e.stopPropagation()}>
                <Card className="p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Start Your Review</h3>
            <div className="space-y-3">
              <Input label="Your Name" value={reviewerName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReviewerName(e.target.value)} placeholder="Jane Smith" />
              <Input label="Email (optional)" type="email" value={reviewerEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReviewerEmail(e.target.value)} placeholder="jane@company.com" />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setShowReviewForm(false)}>Cancel</Button>
              <Button onClick={startReview} disabled={!reviewerName.trim()}>Start Reviewing</Button>
            </div>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}
