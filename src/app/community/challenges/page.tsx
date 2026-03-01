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
    <div className="min-h-screen" style={{ background: '#070710' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: 'rgba(7,7,16,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          <Link href="/community" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 flex items-center justify-center shrink-0" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-[10px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors">Community</span>
          </Link>

          <div className="hidden md:flex items-center gap-5">
            <Link href="/community" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Feed</Link>
            <Link href="/community/showcase" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Showcase</Link>
            <Link href="/community/challenges" className="text-[11px] font-mono uppercase tracking-widest text-white" style={{ borderBottom: '1px solid #FF5F1F', paddingBottom: '2px' }}>Challenges</Link>
            <Link href="/community/free-scripts" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Scripts</Link>
            <Link href="/blog" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Blog</Link>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/dashboard" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Dashboard</Link>
                <Link href={`/u/${user.username || user.id}`}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name || 'User avatar'} className="w-6 h-6 rounded-full" style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,0.1)' }} />
                  ) : (
                    <div className="w-6 h-6 flex items-center justify-center text-[9px] font-black text-white shrink-0" style={{ background: '#FF5F1F' }}>
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </Link>
              </>
            ) : (
              <Link href="/auth/login?redirect=/community/challenges" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Sign In</Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>WRITING CHALLENGES</h1>
          <p className="text-white/40 mt-2 max-w-xl font-mono text-sm">
            Weekly challenges to sharpen your craft. A new theme drops every Monday — submit your script, then vote for the winner.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#FF5F1F]" />
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
              <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6" style={{ letterSpacing: '-0.01em' }}>HOW IT WORKS</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { num: '01', title: 'Theme Announced', desc: 'Monday 00:00 UTC — a random theme is revealed' },
                  { num: '02', title: 'Write & Submit', desc: 'You have until Friday 21:00 UTC to submit your script' },
                  { num: '03', title: 'Community Votes', desc: 'Friday 21:00 – Saturday 23:59 UTC — vote for the best' },
                  { num: '04', title: 'Winner Revealed', desc: 'Sunday 12:00 UTC — the ranking is revealed!' },
                ].map((step, i) => (
                  <div key={i} className="p-5" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-2xl font-black text-[#FF5F1F] mb-2" style={{ letterSpacing: '-0.04em' }}>{step.num}</div>
                    <h3 className="text-sm font-black text-white mb-1" style={{ letterSpacing: '-0.02em' }}>{step.title}</h3>
                    <p className="text-xs font-mono text-white/40 leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Upcoming Custom Challenges */}
            {upcomingChallenges.length > 0 && (
              <section className="mb-14">
                <h2 className="text-lg font-bold text-white mb-4">Upcoming Challenges</h2>
                <div className="space-y-3">
                  {upcomingChallenges.map((c) => (
                    <Link
                      key={c.id}
                      href={`/community/challenges/${c.id}`}
                      className="block rounded-xl border border-white/10 bg-surface-900 hover:border-white/15 hover:shadow-sm transition-all p-5"
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
                          <h3 className="text-base font-semibold text-white">{c.title}</h3>
                          <p className="text-sm text-white/40 mt-1 line-clamp-1">{c.description}</p>
                        </div>
                        <div className="text-right text-xs text-white/50 shrink-0">
                          <div>Starts {formatDate(c.starts_at)}</div>
                          <div className="mt-1 text-white/60 font-medium">{timeUntil(c.starts_at)}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Past Challenges */}
            <section>
              <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4">PAST CHALLENGES</h2>
              {pastChallenges.length === 0 ? (
                <p className="text-sm font-mono text-white/50 py-8 text-center">No completed challenges yet. Check back after the first week!</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pastChallenges.map((c) => (
                    <Link
                      key={c.id}
                      href={`/community/challenges/${c.id}`}
                      className="block hover:opacity-80 transition-all p-5"
                      style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono uppercase text-white/40" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                          {c.challenge_type === 'weekly' ? `Week ${c.week_number}, ${c.year}` : 'Custom'}
                        </span>
                        <span className="text-xs font-mono text-white/50">{c.submission_count} submissions</span>
                      </div>
                      <h3 className="text-base font-black text-white line-clamp-1" style={{ letterSpacing: '-0.02em' }}>{c.title}</h3>
                      <p className="text-sm text-white/40 mt-1 line-clamp-2">{c.description}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs font-mono text-white/50">
                        <span>{formatDate(c.starts_at)} — {formatDate(c.reveal_at)}</span>
                        {c.prize_title && <span className="text-[#FF5F1F]">★ {c.prize_title}</span>}
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
      <footer className="py-10 px-6 mt-10" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Screenplay Studio Community</span>
          <div className="flex items-center gap-6 text-[11px] font-mono uppercase tracking-widest text-white/50">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/community" className="hover:text-white transition-colors">Feed</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <SiteVersion />
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
    <div className="overflow-hidden text-white" style={{ border: '1px solid rgba(255,95,31,0.2)', background: 'rgba(255,95,31,0.06)' }}>
      {/* Decorative top accent */}
      <div className="h-px" style={{ background: '#FF5F1F' }} />

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

            <h2 className="text-2xl font-black mb-2" style={{ letterSpacing: '-0.03em' }}>{challenge.title.replace('Weekly Challenge: ', '')}</h2>
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
              <div className="text-3xl font-black">{challenge.submission_count}</div>
              <div className="text-xs text-white/50 uppercase tracking-wide">submissions</div>
            </div>

            <Link
              href={`/community/challenges/${challenge.id}`}
              className="px-6 py-3 text-sm font-black uppercase tracking-wider text-white transition-opacity hover:opacity-80" style={{ background: '#FF5F1F' }}
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
                      <span className={`text-xs font-medium ${isActive ? 'text-white' : isPast ? 'text-white/40' : 'text-white/50'}`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="text-xs text-white/60">{timeUntil(step.end)} left</span>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-900/10 overflow-hidden">
                      {isPast ? (
                        <div className="h-full w-full bg-green-400/60 rounded-full" />
                      ) : isActive ? (
                        <div className="h-full bg-[#FF5F1F] rounded-full animate-pulse" style={{
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
