'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { ScriptContentViewer, ScreenplayRenderer } from '@/components/ScreenplayRenderer';
import { CommunityScriptInfoPanel } from '@/components/community/CommunityScriptReader';
import { formatDate, formatDateTime, getChallengePhase, getPhaseLabel, getPhaseColor, timeUntil, timeAgo, cn } from '@/lib/utils';
import { toast } from '@/components/ui';
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

  // Script reader (managed per-submission by CommunityScriptInfoPanel)

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const { data: ch, error: chError } = await supabase
      .from('community_challenges')
      .select('*')
      .eq('id', id)
      .single();

    if (chError || !ch) {
      if (chError) toast.error('Failed to load challenge');
      setLoading(false);
      return;
    }
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
      <div className="min-h-screen bg-[#070710] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#FF5F1F]" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-[#070710] flex items-center justify-center">
        <div className="flex flex-col items-center text-center">
          <p className="text-lg font-semibold text-white/70 mb-4">Challenge not found</p>
          <Link href="/community/challenges" className="text-sm text-[#FF5F1F] hover:underline">← Back to Challenges</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#070710' }}>


      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <Link href="/community/challenges" className="text-sm text-white/50 hover:text-white/60 transition-colors mb-6 inline-block">
          ← Back to Challenges
        </Link>

        {/* Challenge Header */}
        <div className="rounded-2xl text-white p-8 mb-8" style={{ background: 'linear-gradient(135deg, rgba(255,95,31,0.12) 0%, rgba(255,255,255,0.04) 100%)', border: '1px solid rgba(255,95,31,0.2)' }}>
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
                  phase === 'completed' ? 'bg-white/10 text-white/40' :
                  'bg-blue-500/20 text-blue-300'
                }`}>
                  {getPhaseLabel(phase!)}
                </span>
              </div>
              <h1 className="text-2xl font-black">{challenge.title}</h1>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-black">{submissions.length}</div>
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
                <div key={t.label} className={`rounded-lg p-3 ${isCurrent ? 'bg-surface-900/15' : 'bg-surface-900/5'}`}>
                  <div className={`font-medium mb-1 ${isCurrent ? 'text-white' : 'text-white/50'}`}>{t.label}</div>
                  <div className={`${isPast ? 'text-white/40' : 'text-white/80'}`}>{formatDateTime(t.date)}</div>
                  {isCurrent && !isPast && (
                    <div className="text-[#FF8F5F] font-semibold mt-1">{timeUntil(t.date)} left</div>
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
                <h3 className="text-base font-semibold text-white">{mySubmission.title}</h3>
                {mySubmission.description && <p className="text-sm text-white/60 mt-1">{mySubmission.description}</p>}
                <p className="text-xs text-white/50 mt-2">Submitted {timeAgo(mySubmission.submitted_at)}</p>
              </div>
            ) : user ? (
              !showSubmitForm ? (
                <button
                  onClick={() => { setShowSubmitForm(true); loadUserProjects(); }}
                  className="w-full rounded-xl border-2 border-dashed border-white/15 hover:border-[#FF5F1F] py-10 text-center transition-colors group"
                >
                  <div className="text-3xl mb-2">✍️</div>
                  <span className="text-sm font-semibold text-white/60 group-hover:text-[#FF5F1F] transition-colors">
                    Submit Your Script
                  </span>
                  <p className="text-xs text-white/50 mt-1">You have {timeUntil(challenge.submissions_close_at)} left</p>
                </button>
              ) : (
                <div className="rounded-xl border border-white/10 bg-surface-900 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Submit Your Script</h3>
                  <div className="space-y-4">
                    {/* Script source tabs */}
                    <div>
                      <label className="text-sm font-medium text-white/70 mb-2 block">Script Source</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setScriptSource('project'); if (userProjects.length === 0) loadUserProjects(); }}
                          className={cn(
                            'flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors border',
                            scriptSource === 'project'
                              ? 'bg-[#FF5F1F]/10 text-[#E54E15] border-[#FF5F1F]/40'
                              : 'text-white/40 hover:text-white/70 border-white/10 hover:bg-surface-900'
                          )}
                        >
                          📁 From My Projects
                        </button>
                        <button
                          onClick={() => { setScriptSource('text'); setSelectedProject(null); setScriptElements(null); }}
                          className={cn(
                            'flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors border',
                            scriptSource === 'text'
                              ? 'bg-[#FF5F1F]/10 text-[#E54E15] border-[#FF5F1F]/40'
                              : 'text-white/40 hover:text-white/70 border-white/10 hover:bg-surface-900'
                          )}
                        >
                          ✏️ Plain Text
                        </button>
                      </div>
                    </div>

                    {/* Project picker */}
                    {scriptSource === 'project' && (
                      <div>
                        <label className="text-sm font-medium text-white/70 mb-2 block">Select a Project</label>
                        {userProjects.length === 0 ? (
                          <p className="text-xs text-white/50 py-4 text-center">No projects found. Create one in the dashboard first, or use plain text mode.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                            {userProjects.map((project) => (
                              <button
                                key={project.id}
                                onClick={() => loadProjectScript(project)}
                                className={cn(
                                  'text-left rounded-lg border p-3 transition-all',
                                  selectedProject?.id === project.id
                                    ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 ring-1 ring-[#FF5F1F]'
                                    : 'border-white/10 hover:border-white/15 hover:bg-surface-900'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-md bg-surface-800 flex items-center justify-center text-xs font-bold text-white/40 shrink-0">
                                    {(project.title || 'P')[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{project.title}</p>
                                    <p className="text-[10px] text-white/50">{project.format} · {project.script_type || 'screenplay'}</p>
                                  </div>
                                  {selectedProject?.id === project.id && (
                                    <svg className="w-4 h-4 text-[#FF5F1F] shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Script preview */}
                        {loadingScript && (
                          <div className="flex items-center justify-center py-6">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
                          </div>
                        )}
                        {selectedProject && scriptElements && !loadingScript && (
                          <div className="mt-3">
                            {scriptElements.length === 0 ? (
                              <p className="text-xs text-amber-600 py-3">This project has no script elements. Write something in the script editor first.</p>
                            ) : (
                              <div className="rounded-lg border border-white/10 bg-surface-900 p-4 max-h-56 overflow-y-auto">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-white/40">{scriptElements.length} elements</span>
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
                        <label className="text-sm font-medium text-white/70 mb-1 block">Script Content *</label>
                        <textarea
                          value={subContent}
                          onChange={(e) => setSubContent(e.target.value)}
                          rows={14}
                          placeholder="Paste or write your screenplay here..."
                          className="w-full px-4 py-2.5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FF5F1F]/30 focus:border-[#FF5F1F] resize-y font-mono"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-white/70 mb-1 block">Title *</label>
                      <input
                        value={subTitle}
                        onChange={(e) => setSubTitle(e.target.value)}
                        placeholder="Your script title"
                        className="w-full px-4 py-2.5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FF5F1F]/30 focus:border-[#FF5F1F]"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-white/70 mb-1 block">Description (optional)</label>
                      <textarea
                        value={subDesc}
                        onChange={(e) => setSubDesc(e.target.value)}
                        rows={2}
                        placeholder="Brief description of your approach to the theme"
                        className="w-full px-4 py-2.5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FF5F1F]/30 focus:border-[#FF5F1F] resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || !subTitle.trim() || (scriptSource === 'text' ? !subContent.trim() : !scriptElements?.length)}
                        className="px-6 py-2.5 text-sm font-semibold text-white bg-[#E54E15] hover:bg-[#CC4312] disabled:bg-white/10 disabled:text-white/50 disabled:cursor-not-allowed rounded-lg transition-colors"
                      >
                        {submitting ? 'Submitting...' : 'Submit Entry'}
                      </button>
                      <button
                        onClick={() => setShowSubmitForm(false)}
                        className="px-4 py-2.5 text-sm text-white/40 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="rounded-xl border border-white/10 bg-surface-900 py-10 text-center">
                <p className="text-sm text-white/40 mb-3">Sign in to submit your script</p>
                <Link href={`/auth/login?redirect=/community/challenges/${id}`} className="px-5 py-2.5 text-sm font-medium text-white bg-[#E54E15] hover:bg-[#CC4312] rounded-lg transition-colors">
                  Sign In
                </Link>
              </div>
            )}

            {/* Existing submissions (titles only during submission phase) */}
            {submissions.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
                  Submissions ({submissions.length})
                </h3>
                <div className="space-y-2">
                  {submissions.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-3 rounded-lg border border-white/07 bg-surface-900 px-4 py-3">
                      <div className="w-6 h-6 rounded-full bg-surface-800 flex items-center justify-center text-[10px] font-bold text-white/40 shrink-0">
                        {(sub.author?.full_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-white">{sub.title}</span>
                        <span className="text-xs text-white/50 ml-2">by {sub.author?.full_name || 'Anonymous'}</span>
                      </div>
                      <span className="text-xs text-white/50 shrink-0">{timeAgo(sub.submitted_at)}</span>
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
                <h2 className="text-lg font-bold text-white">Vote for the Best Script</h2>
                <p className="text-sm text-white/40 mt-1">
                  Read the submissions below and cast your vote. You get one vote per challenge.
                  {myVote && ' You\'ve already voted!'}
                </p>
              </div>
              <div className="text-right text-xs text-white/50">
                <span className="text-white/60 font-semibold">{timeUntil(challenge.voting_close_at)}</span> left
              </div>
            </div>

            {!user && (
              <div className="rounded-xl border border-white/10 bg-surface-900 py-6 text-center mb-6">
                <p className="text-sm text-white/40 mb-3">Sign in to vote</p>
                <Link href={`/auth/login?redirect=/community/challenges/${id}`} className="px-4 py-2 text-sm font-medium text-white bg-[#E54E15] hover:bg-[#CC4312] rounded-lg transition-colors">
                  Sign In
                </Link>
              </div>
            )}

            <div className="space-y-4">
              {submissions.map((sub) => {
                const isMyVote = myVote === sub.id;
                const isOwn = user && sub.author_id === user.id;
                return (
                  <div key={sub.id} className={`rounded-xl border bg-surface-900 p-6 transition-all ${isMyVote ? 'border-[#FF5F1F]/40 ring-2 ring-[#FF5F1F]/20' : 'border-white/10'}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">{sub.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                          <span className="text-white/60 font-medium">{sub.author?.full_name || 'Anonymous'}</span>
                          <span>•</span>
                          <span>{timeAgo(sub.submitted_at)}</span>
                          {isOwn && <span className="px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 rounded">You</span>}
                        </div>
                        {sub.description && <p className="text-sm text-white/40 mt-2">{sub.description}</p>}
                      </div>

                      {/* Vote button */}
                      <div className="shrink-0">
                        {user && !isOwn ? (
                          myVote ? (
                            isMyVote ? (
                              <span className="px-4 py-2 text-xs font-semibold text-[#E54E15] bg-[#FF5F1F]/10 rounded-lg">
                                ✓ Your Vote
                              </span>
                            ) : null
                          ) : (
                            <button
                              onClick={() => handleVote(sub.id)}
                              disabled={voting !== null}
                              className="px-4 py-2 text-xs font-semibold text-white bg-[#E54E15] hover:bg-[#CC4312] disabled:bg-white/10 disabled:text-white/50 rounded-lg transition-colors"
                            >
                              {voting === sub.id ? 'Voting...' : 'Vote'}
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>

                    {/* Script info panel */}
                    {sub.script_content && (
                      <div className="mt-4">
                        <CommunityScriptInfoPanel
                          content={sub.script_content}
                          title={sub.title}
                        />
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
            <h2 className="text-xl font-black text-white mb-2">Results coming soon!</h2>
            <p className="text-sm text-white/40 mb-4">
              Voting has closed. The results will be revealed in <strong>{timeUntil(challenge.reveal_at)}</strong>.
            </p>
            <p className="text-xs text-white/50">Final reveal: {formatDateTime(challenge.reveal_at)}</p>
          </section>
        )}

        {/* =========================================================
            COMPLETED — show ranked results
        ========================================================= */}
        {phase === 'completed' && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-white mb-6">Results</h2>

            {submissions.length === 0 ? (
              <p className="text-sm text-white/50 py-8 text-center">No submissions were entered for this challenge.</p>
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
                          ? 'border-amber-400/40 bg-gradient-to-r from-amber-400/10 to-[#FF5F1F]/08 ring-1 ring-amber-400/20'
                          : isTop3
                          ? 'border-white/10 bg-surface-900'
                          : 'border-white/07 bg-surface-900'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Placement badge */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                          placement === 1 ? 'bg-amber-400 text-white text-lg' :
                          placement === 2 ? 'bg-white/20 text-white' :
                          placement === 3 ? 'bg-orange-300 text-white' :
                          'bg-surface-800 text-white/40'
                        }`}>
                          {placement === 1 ? '🏆' : placement === 2 ? '🥈' : placement === 3 ? '🥉' : `#${placement}`}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-base font-semibold ${isWinner ? 'text-amber-300' : 'text-white'}`}>
                              {sub.title}
                            </h3>
                            {isOwn && <span className="px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 bg-blue-400/10 rounded">You</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                            <span className="font-medium text-white/60">{sub.author?.full_name || 'Anonymous'}</span>
                            <span>•</span>
                            <span>{sub.vote_count} vote{sub.vote_count !== 1 ? 's' : ''}</span>
                          </div>
                          {sub.description && <p className="text-sm text-white/55 mt-2">{sub.description}</p>}

                          {/* Script info panel */}
                          {sub.script_content && (
                            <div className="mt-4">
                              <CommunityScriptInfoPanel
                                content={sub.script_content}
                                title={sub.title}
                              />
                            </div>
                          )}
                        </div>

                        {/* Vote count */}
                        <div className="text-right shrink-0">
                          <div className={`text-lg font-bold ${isWinner ? 'text-amber-700' : 'text-white/60'}`}>
                            {sub.vote_count}
                          </div>
                          <div className="text-[10px] text-white/50 uppercase">votes</div>
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
            <h2 className="text-xl font-black text-white mb-2">Challenge starts soon!</h2>
            <p className="text-sm text-white/40">
              Submissions open in <strong>{timeUntil(challenge.starts_at)}</strong>
            </p>
            <p className="text-xs text-white/50 mt-2">{formatDateTime(challenge.starts_at)}</p>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t py-10 px-6 mt-10" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-white/70">Screenplay Studio Community</span>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/community" className="hover:text-white transition-colors">Feed</Link>
            <Link href="/community/challenges" className="hover:text-white transition-colors">Challenges</Link>
            <SiteVersion light />
            <span className="text-white/10">·</span>
            <a
              href="https://development.northem.no/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono uppercase tracking-[0.15em] transition-colors text-[#FF5F1F]/40 hover:text-[#FF5F1F]/80"
            >
              Northem ♥
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
