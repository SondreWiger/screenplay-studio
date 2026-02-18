'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { ScriptContentViewer, ScreenplayRenderer } from '@/components/ScreenplayRenderer';
import { formatDate, formatDateTime, getChallengePhase, getPhaseLabel, getPhaseColor, timeUntil, timeAgo, cn } from '@/lib/utils';
import type { CommunityChallenge, ChallengeSubmission, Profile, Project } from '@/lib/types';

// ============================================================
// Individual Challenge — phase-aware detail page
// ============================================================

export default function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [challenge, setChallenge] = useState<CommunityChallenge | null>(null);
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [mySubmission, setMySubmission] = useState<ChallengeSubmission | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null); // submission_id
  const [loading, setLoading] = useState(true);

  // Submit form state
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [subTitle, setSubTitle] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [subContent, setSubContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  // Project picker state
  const [scriptSource, setScriptSource] = useState<'project' | 'text'>('project');
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [scriptElements, setScriptElements] = useState<any[] | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);

  // Expanded script viewers
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const { data: ch } = await supabase
      .from('community_challenges')
      .select('*')
      .eq('id', id)
      .single();

    if (!ch) { setLoading(false); return; }
    setChallenge(ch);

    // Fetch submissions with author
    const { data: subs } = await supabase
      .from('challenge_submissions')
      .select('*, author:profiles!author_id(*)')
      .eq('challenge_id', id)
      .order('submitted_at', { ascending: true });

    const allSubs = subs || [];

    // If results phase, sort by placement
    const phase = getChallengePhase(ch);
    if (phase === 'completed') {
      // Ensure results are computed
      await supabase.rpc('compute_challenge_results', { p_challenge_id: id });
      // Re-fetch with updated placements
      const { data: ranked } = await supabase
        .from('challenge_submissions')
        .select('*, author:profiles!author_id(*)')
        .eq('challenge_id', id)
        .order('placement', { ascending: true });
      setSubmissions(ranked || allSubs);
    } else {
      setSubmissions(allSubs);
    }

    // Check my submission & vote
    if (user) {
      const mine = (phase === 'completed' ? (subs || allSubs) : allSubs).find((s) => s.author_id === user.id);
      setMySubmission(mine || null);

      const { data: voteData } = await supabase
        .from('challenge_votes')
        .select('submission_id')
        .eq('challenge_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      setMyVote(voteData?.submission_id || null);
    }

    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const phase = challenge ? getChallengePhase(challenge) : null;

  // Load user's projects for the project picker
  const loadUserProjects = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('created_by', user.id)
      .order('updated_at', { ascending: false });
    setUserProjects(data || []);
  }, [user]);

  // Load script elements from a project
  const loadProjectScript = async (project: Project) => {
    setSelectedProject(project);
    setSubTitle(project.title || '');
    setLoadingScript(true);
    const supabase = createClient();

    const { data: scriptData } = await supabase
      .from('scripts')
      .select('id')
      .eq('project_id', project.id)
      .order('created_at')
      .limit(1);

    if (!scriptData?.length) {
      setScriptElements([]);
      setLoadingScript(false);
      return;
    }

    const { data: elements } = await supabase
      .from('script_elements')
      .select('element_type, content, sort_order, scene_number, revision_color')
      .eq('script_id', scriptData[0].id)
      .eq('is_omitted', false)
      .order('sort_order');

    const mapped = (elements || []).map(e => ({
      element_type: e.element_type,
      content: e.content,
      sort_order: e.sort_order,
      scene_number: e.scene_number,
    }));
    setScriptElements(mapped);
    setSubContent(JSON.stringify(mapped));
    setLoadingScript(false);
  };

  // Submit a script
  const handleSubmit = async () => {
    if (!user || !challenge || !subTitle.trim()) return;
    // Need either script content (text mode) or script elements (project mode)
    const content = scriptSource === 'project' && scriptElements?.length
      ? JSON.stringify(scriptElements)
      : subContent.trim();
    if (!content) return;

    setSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('challenge_submissions')
      .insert({
        challenge_id: challenge.id,
        author_id: user.id,
        title: subTitle.trim(),
        description: subDesc.trim() || null,
        script_content: content,
        project_id: selectedProject?.id || null,
      });

    if (!error) {
      // Update submission count
      await supabase
        .from('community_challenges')
        .update({ submission_count: (challenge.submission_count || 0) + 1 })
        .eq('id', challenge.id);

      setShowSubmitForm(false);
      setSubTitle('');
      setSubDesc('');
      setSubContent('');
      setSelectedProject(null);
      setScriptElements(null);
      fetchData();
    }
    setSubmitting(false);
  };

  // Vote for a submission
  const handleVote = async (submissionId: string) => {
    if (!user || !challenge || myVote) return;
    setVoting(submissionId);
    const supabase = createClient();

    const { error } = await supabase
      .from('challenge_votes')
      .insert({
        user_id: user.id,
        challenge_id: challenge.id,
        submission_id: submissionId,
      });

    if (!error) {
      // Update vote count on submission
      await supabase
        .from('challenge_submissions')
        .update({ vote_count: (submissions.find((s) => s.id === submissionId)?.vote_count || 0) + 1 })
        .eq('id', submissionId);

      setMyVote(submissionId);
      fetchData();
    }
    setVoting(null);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    try { sessionStorage.removeItem('ss_session_active'); } catch {}
    await supabase.auth.signOut();
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-stone-700 mb-4">Challenge not found</p>
          <Link href="/community/challenges" className="text-sm text-brand-600 hover:underline">← Back to Challenges</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#faf9f7]/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-orange-500 rounded-lg flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            </div>
            <span className="text-lg font-bold text-stone-900 group-hover:text-brand-600 transition-colors">Community</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Feed</Link>
            <Link href="/community/challenges" className="text-sm font-semibold text-stone-900 border-b-2 border-brand-500 pb-0.5">Challenges</Link>
            <Link href="/community/free-scripts" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Free Scripts</Link>
            <Link href="/blog" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Blog</Link>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/dashboard" className="text-xs text-stone-500 hover:text-stone-900 transition-colors">Dashboard</Link>
                <button onClick={handleSignOut} className="text-xs text-stone-500 hover:text-stone-900 transition-colors">Sign Out</button>
              </>
            ) : (
              <Link href={`/auth/login?redirect=/community/challenges/${id}`} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Sign In</Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <Link href="/community/challenges" className="text-sm text-stone-400 hover:text-stone-600 transition-colors mb-6 inline-block">
          ← Back to Challenges
        </Link>

        {/* Challenge Header */}
        <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 text-white p-8 mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                  {challenge.challenge_type === 'weekly' ? `Week ${challenge.week_number}, ${challenge.year}` : 'Custom Challenge'}
                </span>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                  phase === 'submissions' ? 'bg-green-500/20 text-green-300' :
                  phase === 'voting' ? 'bg-amber-500/20 text-amber-300' :
                  phase === 'reveal_pending' ? 'bg-purple-500/20 text-purple-300' :
                  phase === 'completed' ? 'bg-stone-500/20 text-stone-300' :
                  'bg-blue-500/20 text-blue-300'
                }`}>
                  {getPhaseLabel(phase!)}
                </span>
              </div>
              <h1 className="text-2xl font-bold">{challenge.title}</h1>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold">{submissions.length}</div>
              <div className="text-xs text-white/50">submissions</div>
            </div>
          </div>

          <p className="text-white/70 leading-relaxed max-w-2xl mb-6">{challenge.description}</p>

          {/* Timeline */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {[
              { label: 'Started', date: challenge.starts_at, phaseKey: 'upcoming' },
              { label: 'Submissions Close', date: challenge.submissions_close_at, phaseKey: 'submissions' },
              { label: 'Voting Closes', date: challenge.voting_close_at, phaseKey: 'voting' },
              { label: 'Results Revealed', date: challenge.reveal_at, phaseKey: 'reveal_pending' },
            ].map((t) => {
              const isPast = new Date(t.date) < new Date();
              const isCurrent = phase === t.phaseKey;
              return (
                <div key={t.label} className={`rounded-lg p-3 ${isCurrent ? 'bg-white/15' : 'bg-white/5'}`}>
                  <div className={`font-medium mb-1 ${isCurrent ? 'text-white' : 'text-white/50'}`}>{t.label}</div>
                  <div className={`${isPast ? 'text-white/40' : 'text-white/80'}`}>{formatDateTime(t.date)}</div>
                  {isCurrent && !isPast && (
                    <div className="text-brand-300 font-semibold mt-1">{timeUntil(t.date)} left</div>
                  )}
                </div>
              );
            })}
          </div>

          {challenge.prize_title && (
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2 text-sm">
              <span className="text-xl">🏆</span>
              <span className="font-semibold text-amber-300">{challenge.prize_title}</span>
              {challenge.prize_description && <span className="text-white/50">— {challenge.prize_description}</span>}
            </div>
          )}
        </div>

        {/* =========================================================
            SUBMISSIONS PHASE — show submit form
        ========================================================= */}
        {phase === 'submissions' && (
          <section className="mb-10">
            {mySubmission ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-6 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-700 font-semibold text-sm">✓ You&apos;ve submitted!</span>
                </div>
                <h3 className="text-base font-semibold text-stone-900">{mySubmission.title}</h3>
                {mySubmission.description && <p className="text-sm text-stone-600 mt-1">{mySubmission.description}</p>}
                <p className="text-xs text-stone-400 mt-2">Submitted {timeAgo(mySubmission.submitted_at)}</p>
              </div>
            ) : user ? (
              !showSubmitForm ? (
                <button
                  onClick={() => { setShowSubmitForm(true); loadUserProjects(); }}
                  className="w-full rounded-xl border-2 border-dashed border-stone-300 hover:border-brand-400 py-10 text-center transition-colors group"
                >
                  <div className="text-3xl mb-2">✍️</div>
                  <span className="text-sm font-semibold text-stone-600 group-hover:text-brand-600 transition-colors">
                    Submit Your Script
                  </span>
                  <p className="text-xs text-stone-400 mt-1">You have {timeUntil(challenge.submissions_close_at)} left</p>
                </button>
              ) : (
                <div className="rounded-xl border border-stone-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-stone-900 mb-4">Submit Your Script</h3>
                  <div className="space-y-4">
                    {/* Script source tabs */}
                    <div>
                      <label className="text-sm font-medium text-stone-700 mb-2 block">Script Source</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setScriptSource('project'); if (userProjects.length === 0) loadUserProjects(); }}
                          className={cn(
                            'flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors border',
                            scriptSource === 'project'
                              ? 'bg-brand-50 text-brand-700 border-brand-300'
                              : 'text-stone-500 hover:text-stone-700 border-stone-200 hover:bg-stone-50'
                          )}
                        >
                          📁 From My Projects
                        </button>
                        <button
                          onClick={() => { setScriptSource('text'); setSelectedProject(null); setScriptElements(null); }}
                          className={cn(
                            'flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors border',
                            scriptSource === 'text'
                              ? 'bg-brand-50 text-brand-700 border-brand-300'
                              : 'text-stone-500 hover:text-stone-700 border-stone-200 hover:bg-stone-50'
                          )}
                        >
                          ✏️ Plain Text
                        </button>
                      </div>
                    </div>

                    {/* Project picker */}
                    {scriptSource === 'project' && (
                      <div>
                        <label className="text-sm font-medium text-stone-700 mb-2 block">Select a Project</label>
                        {userProjects.length === 0 ? (
                          <p className="text-xs text-stone-400 py-4 text-center">No projects found. Create one in the dashboard first, or use plain text mode.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                            {userProjects.map((project) => (
                              <button
                                key={project.id}
                                onClick={() => loadProjectScript(project)}
                                className={cn(
                                  'text-left rounded-lg border p-3 transition-all',
                                  selectedProject?.id === project.id
                                    ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-300'
                                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-500 shrink-0">
                                    {(project.title || 'P')[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-stone-900 truncate">{project.title}</p>
                                    <p className="text-[10px] text-stone-400">{project.format} · {project.script_type || 'screenplay'}</p>
                                  </div>
                                  {selectedProject?.id === project.id && (
                                    <svg className="w-4 h-4 text-brand-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Script preview */}
                        {loadingScript && (
                          <div className="flex items-center justify-center py-6">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
                          </div>
                        )}
                        {selectedProject && scriptElements && !loadingScript && (
                          <div className="mt-3">
                            {scriptElements.length === 0 ? (
                              <p className="text-xs text-amber-600 py-3">This project has no script elements. Write something in the script editor first.</p>
                            ) : (
                              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 max-h-56 overflow-y-auto">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-stone-500">{scriptElements.length} elements</span>
                                  <span className="text-[10px] text-green-600 font-medium">✓ Formatting preserved</span>
                                </div>
                                <ScriptContentViewer content={JSON.stringify(scriptElements)} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Plain text mode */}
                    {scriptSource === 'text' && (
                      <div>
                        <label className="text-sm font-medium text-stone-700 mb-1 block">Script Content *</label>
                        <textarea
                          value={subContent}
                          onChange={(e) => setSubContent(e.target.value)}
                          rows={14}
                          placeholder="Paste or write your screenplay here..."
                          className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 resize-y font-mono"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-stone-700 mb-1 block">Title *</label>
                      <input
                        value={subTitle}
                        onChange={(e) => setSubTitle(e.target.value)}
                        placeholder="Your script title"
                        className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-stone-700 mb-1 block">Description (optional)</label>
                      <textarea
                        value={subDesc}
                        onChange={(e) => setSubDesc(e.target.value)}
                        rows={2}
                        placeholder="Brief description of your approach to the theme"
                        className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || !subTitle.trim() || (scriptSource === 'text' ? !subContent.trim() : !scriptElements?.length)}
                        className="px-6 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                      >
                        {submitting ? 'Submitting...' : 'Submit Entry'}
                      </button>
                      <button
                        onClick={() => setShowSubmitForm(false)}
                        className="px-4 py-2.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="rounded-xl border border-stone-200 bg-stone-50 py-10 text-center">
                <p className="text-sm text-stone-500 mb-3">Sign in to submit your script</p>
                <Link href={`/auth/login?redirect=/community/challenges/${id}`} className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
                  Sign In
                </Link>
              </div>
            )}

            {/* Existing submissions (titles only during submission phase) */}
            {submissions.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-3">
                  Submissions ({submissions.length})
                </h3>
                <div className="space-y-2">
                  {submissions.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-3 rounded-lg border border-stone-100 bg-white px-4 py-3">
                      <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-500 shrink-0">
                        {(sub.author?.full_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-stone-900">{sub.title}</span>
                        <span className="text-xs text-stone-400 ml-2">by {sub.author?.full_name || 'Anonymous'}</span>
                      </div>
                      <span className="text-xs text-stone-400 shrink-0">{timeAgo(sub.submitted_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            VOTING PHASE — show submissions with vote buttons
        ========================================================= */}
        {phase === 'voting' && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Vote for the Best Script</h2>
                <p className="text-sm text-stone-500 mt-1">
                  Read the submissions below and cast your vote. You get one vote per challenge.
                  {myVote && ' You\'ve already voted!'}
                </p>
              </div>
              <div className="text-right text-xs text-stone-400">
                <span className="text-stone-600 font-semibold">{timeUntil(challenge.voting_close_at)}</span> left
              </div>
            </div>

            {!user && (
              <div className="rounded-xl border border-stone-200 bg-stone-50 py-6 text-center mb-6">
                <p className="text-sm text-stone-500 mb-3">Sign in to vote</p>
                <Link href={`/auth/login?redirect=/community/challenges/${id}`} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
                  Sign In
                </Link>
              </div>
            )}

            <div className="space-y-4">
              {submissions.map((sub) => {
                const isMyVote = myVote === sub.id;
                const isOwn = user && sub.author_id === user.id;
                return (
                  <div key={sub.id} className={`rounded-xl border bg-white p-6 transition-all ${isMyVote ? 'border-brand-300 ring-2 ring-brand-100' : 'border-stone-200'}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-stone-900">{sub.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-stone-400">
                          <span className="text-stone-600 font-medium">{sub.author?.full_name || 'Anonymous'}</span>
                          <span>•</span>
                          <span>{timeAgo(sub.submitted_at)}</span>
                          {isOwn && <span className="px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 rounded">You</span>}
                        </div>
                        {sub.description && <p className="text-sm text-stone-500 mt-2">{sub.description}</p>}
                      </div>

                      {/* Vote button */}
                      <div className="shrink-0">
                        {user && !isOwn ? (
                          myVote ? (
                            isMyVote ? (
                              <span className="px-4 py-2 text-xs font-semibold text-brand-700 bg-brand-50 rounded-lg">
                                ✓ Your Vote
                              </span>
                            ) : null
                          ) : (
                            <button
                              onClick={() => handleVote(sub.id)}
                              disabled={voting !== null}
                              className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-stone-300 rounded-lg transition-colors"
                            >
                              {voting === sub.id ? 'Voting...' : 'Vote'}
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>

                    {/* Expandable script content */}
                    {sub.script_content && (
                      <div className="mt-3">
                        <button
                          onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                        >
                          {expandedSub === sub.id ? 'Hide Script ▲' : 'Read Script ▼'}
                        </button>
                        {expandedSub === sub.id && (
                          <div className="mt-3 max-h-[400px] overflow-y-auto rounded-lg border border-stone-100 bg-stone-50 p-4">
                            <ScriptContentViewer content={sub.script_content || ''} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* =========================================================
            REVEAL PENDING — waiting for Sunday 12:00
        ========================================================= */}
        {phase === 'reveal_pending' && (
          <section className="mb-10 text-center py-16">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">Results coming soon!</h2>
            <p className="text-sm text-stone-500 mb-4">
              Voting has closed. The results will be revealed in <strong>{timeUntil(challenge.reveal_at)}</strong>.
            </p>
            <p className="text-xs text-stone-400">Final reveal: {formatDateTime(challenge.reveal_at)}</p>
          </section>
        )}

        {/* =========================================================
            COMPLETED — show ranked results
        ========================================================= */}
        {phase === 'completed' && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-stone-900 mb-6">Results</h2>

            {submissions.length === 0 ? (
              <p className="text-sm text-stone-400 py-8 text-center">No submissions were entered for this challenge.</p>
            ) : (
              <div className="space-y-3">
                {submissions.map((sub, i) => {
                  const placement = sub.placement || i + 1;
                  const isWinner = placement === 1;
                  const isTop3 = placement <= 3;
                  const isOwn = user && sub.author_id === user.id;

                  return (
                    <div
                      key={sub.id}
                      className={`rounded-xl border p-5 transition-all ${
                        isWinner
                          ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 ring-2 ring-amber-200'
                          : isTop3
                          ? 'border-stone-200 bg-stone-50'
                          : 'border-stone-100 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Placement badge */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                          placement === 1 ? 'bg-amber-400 text-white text-lg' :
                          placement === 2 ? 'bg-stone-300 text-white' :
                          placement === 3 ? 'bg-orange-300 text-white' :
                          'bg-stone-100 text-stone-500'
                        }`}>
                          {placement === 1 ? '🏆' : placement === 2 ? '🥈' : placement === 3 ? '🥉' : `#${placement}`}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-base font-semibold ${isWinner ? 'text-amber-900' : 'text-stone-900'}`}>
                              {sub.title}
                            </h3>
                            {isOwn && <span className="px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 rounded">You</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-stone-400">
                            <span className="font-medium text-stone-600">{sub.author?.full_name || 'Anonymous'}</span>
                            <span>•</span>
                            <span>{sub.vote_count} vote{sub.vote_count !== 1 ? 's' : ''}</span>
                          </div>
                          {sub.description && <p className="text-sm text-stone-500 mt-2">{sub.description}</p>}

                          {/* Expandable script */}
                          {sub.script_content && (
                            <div className="mt-3">
                              <button
                                onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                                className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                              >
                                {expandedSub === sub.id ? 'Hide Script ▲' : 'Read Script ▼'}
                              </button>
                              {expandedSub === sub.id && (
                                <div className="mt-3 max-h-[400px] overflow-y-auto rounded-lg border border-stone-100 bg-white p-4">
                                  <ScriptContentViewer content={sub.script_content || ''} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Vote count */}
                        <div className="text-right shrink-0">
                          <div className={`text-lg font-bold ${isWinner ? 'text-amber-700' : 'text-stone-600'}`}>
                            {sub.vote_count}
                          </div>
                          <div className="text-[10px] text-stone-400 uppercase">votes</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            UPCOMING — just show info, no submissions yet
        ========================================================= */}
        {phase === 'upcoming' && (
          <section className="mb-10 text-center py-16">
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">Challenge starts soon!</h2>
            <p className="text-sm text-stone-500">
              Submissions open in <strong>{timeUntil(challenge.starts_at)}</strong>
            </p>
            <p className="text-xs text-stone-400 mt-2">{formatDateTime(challenge.starts_at)}</p>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#faf9f7] border-t border-stone-200 py-10 px-6 mt-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-stone-700">Screenplay Studio Community</span>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <Link href="/" className="hover:text-stone-900 transition-colors">Home</Link>
            <Link href="/community" className="hover:text-stone-900 transition-colors">Feed</Link>
            <Link href="/community/challenges" className="hover:text-stone-900 transition-colors">Challenges</Link>
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}
