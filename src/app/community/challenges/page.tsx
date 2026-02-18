'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { formatDate, timeAgo, getChallengePhase, getPhaseLabel, getPhaseColor, timeUntil } from '@/lib/utils';
import type { CommunityChallenge } from '@/lib/types';

// ============================================================
// Community Challenges — listing page
// ============================================================

export default function ChallengesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [challenges, setChallenges] = useState<CommunityChallenge[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<CommunityChallenge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    const supabase = createClient();

    // Ensure a weekly challenge exists
    const { data: ensured } = await supabase.rpc('ensure_weekly_challenge');

    // Fetch all challenges
    const { data } = await supabase
      .from('community_challenges')
      .select('*')
      .order('starts_at', { ascending: false });

    const all = data || [];

    // Find the active one (submissions or voting open)
    const active = all.find((c) => {
      const phase = getChallengePhase(c);
      return phase === 'submissions' || phase === 'voting' || phase === 'reveal_pending' || phase === 'upcoming';
    });
    setActiveChallenge(active || null);
    setChallenges(all);
    setLoading(false);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    try { sessionStorage.removeItem('ss_session_active'); } catch {}
    await supabase.auth.signOut();
    router.refresh();
  };

  const pastChallenges = challenges.filter((c) => getChallengePhase(c) === 'completed');
  const upcomingChallenges = challenges.filter((c) => getChallengePhase(c) === 'upcoming' && c.id !== activeChallenge?.id);

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
            <span className="text-lg font-bold text-stone-900 group-hover:text-brand-600 transition-colors">
              Community
            </span>
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
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600">
                    {(user.full_name || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
              </>
            ) : (
              <>
                <Link href="/auth/login?redirect=/community/challenges" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Sign In</Link>
                <Link href="/auth/register?redirect=/community/challenges" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Writing Challenges</h1>
          <p className="text-stone-500 mt-2 max-w-xl">
            Weekly challenges to sharpen your craft. A new theme drops every Monday — submit your script, then vote for the winner.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
          </div>
        ) : (
          <>
            {/* Active Challenge Hero */}
            {activeChallenge && (
              <section className="mb-12">
                <ActiveChallengeCard challenge={activeChallenge} user={user} />
              </section>
            )}

            {/* How It Works */}
            <section className="mb-14">
              <h2 className="text-lg font-bold text-stone-900 mb-6">How It Works</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { icon: '📢', title: 'Theme Announced', desc: 'Monday 00:00 UTC — a random theme is revealed', color: 'bg-blue-50 border-blue-100' },
                  { icon: '✍️', title: 'Write & Submit', desc: 'You have until Friday 21:00 UTC to submit your script', color: 'bg-green-50 border-green-100' },
                  { icon: '🗳️', title: 'Community Votes', desc: 'Friday 21:00 – Saturday 23:59 UTC — vote for the best', color: 'bg-amber-50 border-amber-100' },
                  { icon: '🏆', title: 'Winner Revealed', desc: 'Sunday 12:00 UTC — the ranking is revealed!', color: 'bg-purple-50 border-purple-100' },
                ].map((step, i) => (
                  <div key={i} className={`rounded-xl border p-5 ${step.color}`}>
                    <div className="text-2xl mb-2">{step.icon}</div>
                    <h3 className="text-sm font-semibold text-stone-900 mb-1">{step.title}</h3>
                    <p className="text-xs text-stone-500 leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Upcoming Custom Challenges */}
            {upcomingChallenges.length > 0 && (
              <section className="mb-14">
                <h2 className="text-lg font-bold text-stone-900 mb-4">Upcoming Challenges</h2>
                <div className="space-y-3">
                  {upcomingChallenges.map((c) => (
                    <Link
                      key={c.id}
                      href={`/community/challenges/${c.id}`}
                      className="block rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${getPhaseColor('upcoming')}`}>
                              {getPhaseLabel('upcoming')}
                            </span>
                            {c.challenge_type === 'custom' && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold text-orange-700 bg-orange-50 rounded-full">Custom</span>
                            )}
                          </div>
                          <h3 className="text-base font-semibold text-stone-900">{c.title}</h3>
                          <p className="text-sm text-stone-500 mt-1 line-clamp-1">{c.description}</p>
                        </div>
                        <div className="text-right text-xs text-stone-400 shrink-0">
                          <div>Starts {formatDate(c.starts_at)}</div>
                          <div className="mt-1 text-stone-600 font-medium">{timeUntil(c.starts_at)}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Past Challenges */}
            <section>
              <h2 className="text-lg font-bold text-stone-900 mb-4">Past Challenges</h2>
              {pastChallenges.length === 0 ? (
                <p className="text-sm text-stone-400 py-8 text-center">No completed challenges yet. Check back after the first week!</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pastChallenges.map((c) => (
                    <Link
                      key={c.id}
                      href={`/community/challenges/${c.id}`}
                      className="block rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all p-5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${getPhaseColor('completed')}`}>
                          {c.challenge_type === 'weekly' ? `Week ${c.week_number}, ${c.year}` : 'Custom'}
                        </span>
                        <span className="text-xs text-stone-400">{c.submission_count} submissions</span>
                      </div>
                      <h3 className="text-base font-semibold text-stone-900 line-clamp-1">{c.title}</h3>
                      <p className="text-sm text-stone-500 mt-1 line-clamp-2">{c.description}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-stone-400">
                        <span>{formatDate(c.starts_at)} — {formatDate(c.reveal_at)}</span>
                        {c.prize_title && <span className="text-amber-600 font-medium">🏆 {c.prize_title}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#faf9f7] border-t border-stone-200 py-10 px-6 mt-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-stone-700">Screenplay Studio Community</span>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <Link href="/" className="hover:text-stone-900 transition-colors">Home</Link>
            <Link href="/community" className="hover:text-stone-900 transition-colors">Feed</Link>
            <Link href="/blog" className="hover:text-stone-900 transition-colors">Blog</Link>
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Active Challenge Card — hero component
// ============================================================
function ActiveChallengeCard({ challenge, user }: { challenge: CommunityChallenge; user: any }) {
  const phase = getChallengePhase(challenge);

  const phaseTimeline = [
    { key: 'submissions', label: 'Submit', end: challenge.submissions_close_at },
    { key: 'voting', label: 'Vote', end: challenge.voting_close_at },
    { key: 'reveal_pending', label: 'Reveal', end: challenge.reveal_at },
  ];

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-stone-900 to-stone-800 text-white">
      {/* Decorative top accent */}
      <div className="h-1.5 bg-gradient-to-r from-brand-500 via-orange-500 to-amber-400" />

      <div className="p-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                {challenge.challenge_type === 'weekly' ? `Weekly Challenge — Week ${challenge.week_number}` : 'Custom Challenge'}
              </span>
              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                phase === 'submissions' ? 'bg-green-500/20 text-green-300' :
                phase === 'voting' ? 'bg-amber-500/20 text-amber-300' :
                phase === 'reveal_pending' ? 'bg-purple-500/20 text-purple-300' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {getPhaseLabel(phase)}
              </span>
            </div>

            <h2 className="text-2xl font-bold mb-2">{challenge.title.replace('Weekly Challenge: ', '')}</h2>
            <p className="text-white/70 leading-relaxed max-w-lg">{challenge.description}</p>

            {challenge.prize_title && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="text-amber-400">🏆</span>
                <span className="text-white/80 font-medium">{challenge.prize_title}</span>
                {challenge.prize_description && (
                  <span className="text-white/50">— {challenge.prize_description}</span>
                )}
              </div>
            )}
          </div>

          {/* Stats + CTA */}
          <div className="shrink-0 flex flex-col items-end gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold">{challenge.submission_count}</div>
              <div className="text-xs text-white/50 uppercase tracking-wide">submissions</div>
            </div>

            <Link
              href={`/community/challenges/${challenge.id}`}
              className="px-6 py-3 text-sm font-semibold bg-white text-stone-900 hover:bg-white/90 rounded-xl transition-colors"
            >
              {phase === 'submissions' ? (user ? 'Submit Your Script' : 'View Challenge') :
               phase === 'voting' ? 'Vote Now' :
               'View Details'}
            </Link>
          </div>
        </div>

        {/* Phase timeline */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center gap-1">
            {phaseTimeline.map((step, i) => {
              const isActive = step.key === phase;
              const isPast = phaseTimeline.findIndex((s) => s.key === phase) > i || phase === 'completed';
              return (
                <div key={step.key} className="flex-1 flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${isActive ? 'text-white' : isPast ? 'text-white/40' : 'text-white/30'}`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="text-xs text-white/60">{timeUntil(step.end)} left</span>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      {isPast ? (
                        <div className="h-full w-full bg-green-400/60 rounded-full" />
                      ) : isActive ? (
                        <div className="h-full bg-brand-400 rounded-full animate-pulse" style={{
                          width: `${Math.max(10, 100 - (new Date(step.end).getTime() - Date.now()) / (new Date(step.end).getTime() - new Date(i === 0 ? challenge.starts_at : phaseTimeline[i - 1].end).getTime()) * 100)}%`
                        }} />
                      ) : (
                        <div className="h-full w-0 rounded-full" />
                      )}
                    </div>
                  </div>
                  {i < phaseTimeline.length - 1 && <div className="w-4" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
