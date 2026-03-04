'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { formatDate, timeAgo, getChallengePhase, getPhaseLabel, getPhaseColor, timeUntil } from '@/lib/utils';
import type { CommunityPost, CommunityCategory, CommunityChallenge } from '@/lib/types';

// ============================================================
// Community Hub — main feed & browse page
// ============================================================

export default function CommunityPage() {
  const { user } = useAuth();
  const router = useRouter();
  type FeaturedCourse = { id: string; title: string; difficulty: string; xp_reward: number; enrollment_count: number };
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<CommunityChallenge | null>(null);
  const [featuredCourses, setFeaturedCourses] = useState<FeaturedCourse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'discussed'>('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();

    const [postsRes, catsRes, challengeRes, coursesRes] = await Promise.all([
      supabase
        .from('community_posts')
        .select('*, author:profiles!author_id(*)')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('community_categories')
        .select('*')
        .order('display_order'),
      supabase.rpc('ensure_weekly_challenge'),
      supabase
        .from('courses')
        .select('id,title,difficulty,xp_reward,enrollment_count')
        .eq('status', 'published')
        .order('enrollment_count', { ascending: false })
        .limit(3),
    ]);

    const rawPosts = postsRes.data || [];

    // Fetch categories for each post
    if (rawPosts.length > 0) {
      const postIds = rawPosts.map((p: { id: string }) => p.id);
      const { data: junctions } = await supabase
        .from('community_post_categories')
        .select('post_id, category:community_categories(*)')
        .in('post_id', postIds);

      const catMap = new Map<string, CommunityCategory[]>();
      (junctions || []).forEach((j: any) => {
        const arr = catMap.get(j.post_id) || [];
        arr.push(j.category);
        catMap.set(j.post_id, arr);
      });

      rawPosts.forEach((p: CommunityPost) => {
        p.categories = catMap.get(p.id) || [];
      });
    }

    setPosts(rawPosts);
    setCategories(catsRes.data || []);
    setFeaturedCourses((coursesRes.data as FeaturedCourse[]) || []);
    if (challengeRes.data && Array.isArray(challengeRes.data) && challengeRes.data.length > 0) {
      setActiveChallenge(challengeRes.data[0]);
    } else if (challengeRes.data && !Array.isArray(challengeRes.data)) {
      setActiveChallenge(challengeRes.data);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    try { sessionStorage.removeItem('ss_session_active'); } catch {}
    await supabase.auth.signOut();
    router.refresh();
  };

  const isMod = user?.role === 'moderator' || user?.role === 'admin';

  const handleDeletePost = async (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this post? This cannot be undone.')) return;
    const supabase = createClient();
    const { error } = await supabase.from('community_posts').delete().eq('id', postId);
    if (!error) setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  // Filter & sort
  const filtered = posts
    .filter((p) => !selectedCategory || p.categories?.some((c) => c.slug === selectedCategory))
    .sort((a, b) => {
      if (sortBy === 'popular') return b.upvote_count - a.upvote_count;
      if (sortBy === 'discussed') return b.comment_count - a.comment_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      {/* Dot-grid texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />



      {/* Hero / Active Challenge Banner */}
      {activeChallenge && (() => {
        const phase = getChallengePhase(activeChallenge);
        return phase !== 'completed' ? (
          <div className="text-white" style={{ background: '#FF5F1F' }}>
            <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Weekly Challenge</span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-surface-900/20 rounded-full">{getPhaseLabel(phase)}</span>
                </div>
                <h2 className="text-lg font-bold">{activeChallenge.title.replace('Weekly Challenge: ', '')}</h2>
                <p className="text-sm text-white/80 mt-1 max-w-lg line-clamp-2">{activeChallenge.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right text-xs text-white/70">
                  {phase === 'submissions' && <><span className="text-white font-semibold">{timeUntil(activeChallenge.submissions_close_at)}</span> to submit</>}
                  {phase === 'voting' && <><span className="text-white font-semibold">{timeUntil(activeChallenge.voting_close_at)}</span> to vote</>}
                  {phase === 'upcoming' && <>Starts {formatDate(activeChallenge.starts_at)}</>}
                  <div className="mt-0.5">{activeChallenge.submission_count} submissions</div>
                </div>
                <Link
                  href={`/community/challenges/${activeChallenge.id}`}
                  className="px-4 py-2 text-sm font-medium bg-surface-900 text-[#E54E15] hover:bg-surface-900/90 rounded-lg transition-colors"
                >
                  {phase === 'submissions' ? 'Submit' : 'View'}
                </Link>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-3 h-px shrink-0" style={{ background: '#FF5F1F' }} />
              <span className="ss-label">Community</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>COMMUNITY SCRIPTS</h1>
            <p className="text-white/50 text-sm mt-1">Discover, share, and collaborate on screenplays</p>
          </div>
          <div className="flex items-center gap-2">
            {(['newest', 'popular', 'discussed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 transition-colors"
              style={{
                  color: sortBy === s ? '#FF5F1F' : 'rgba(255,255,255,0.45)',
                  border: sortBy === s ? '1px solid rgba(255,95,31,0.3)' : '1px solid rgba(255,255,255,0.07)',
                  background: sortBy === s ? 'rgba(255,95,31,0.08)' : 'transparent',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar — categories */}
          <aside className="hidden lg:block w-56 shrink-0">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Categories</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  !selectedCategory ? 'bg-[#FF5F1F]/10 text-[#E54E15] font-medium' : 'text-white/60 hover:bg-surface-800'
                }`}
              >
                All Scripts
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                    selectedCategory === cat.slug ? 'bg-[#FF5F1F]/10 text-[#E54E15] font-medium' : 'text-white/60 hover:bg-surface-800'
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Quick links */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <Link href="/community/showcase" className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors py-1.5">
                🎬 Finished Projects
              </Link>
              <Link href="/community/challenges" className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors py-1.5">
                🏆 Writing Challenges
              </Link>
              <Link href="/community/free-scripts" className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors py-1.5">
                📖 Free-to-Use Scripts
              </Link>
            </div>

            {/* Featured Courses */}
            {featuredCourses.length > 0 && (
              <div className="mt-6 pt-5 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">📚 Courses</p>
                  <Link href="/community/courses" className="text-[10px] text-[#FF5F1F] hover:text-[#FF7A3F] transition-colors">All →</Link>
                </div>
                <div className="space-y-2">
                  {featuredCourses.map(c => {
                    const diffColor = c.difficulty === 'beginner' ? 'text-emerald-400' : c.difficulty === 'intermediate' ? 'text-yellow-400' : 'text-red-400';
                    return (
                      <Link key={c.id} href={`/community/courses/${c.id}`}
                        className="block p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all group">
                        <p className="text-xs font-medium text-white/80 group-hover:text-white transition-colors line-clamp-1">{c.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[9px] font-semibold uppercase tracking-wide ${diffColor}`}>{c.difficulty}</span>
                          <span className="text-[9px] text-white/25">·</span>
                          <span className="text-[9px] text-[#FF5F1F]">{c.xp_reward} XP</span>
                          {c.enrollment_count > 0 && <span className="text-[9px] text-white/25 ml-auto">{c.enrollment_count} enrolled</span>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          {/* Main content — post feed */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">📝</div>
                <p className="text-lg font-semibold text-white/70 mb-2">No scripts shared yet</p>
                <p className="text-sm text-white/40 mb-6">Be the first to share your work with the community!</p>
                {user && (
                  <Link href="/community/share" className="px-5 py-2.5 text-sm font-medium text-white bg-[#E54E15] hover:bg-[#CC4312] rounded-lg transition-colors">
                    Share Your Script
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((post) => (
                  <Link
                    key={post.id}
                    href={`/community/post/${post.slug}`}
                    className="block rounded-xl border border-white/[0.12] bg-surface-800/50 hover:border-white/20 hover:bg-surface-800/70 transition-all p-5"
                  >
                    <div className="flex items-start gap-4">
                      {/* Upvote count */}
                      <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                        <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        <span className="text-sm font-semibold text-white/70">{post.upvote_count}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Categories */}
                        {post.categories && post.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {post.categories.map((cat) => (
                              <span
                                key={cat.id}
                                className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                                style={{
                                  color: cat.color || '#6b7280',
                                  backgroundColor: (cat.color || '#6b7280') + '15',
                                }}
                              >
                                {cat.icon} {cat.name}
                              </span>
                            ))}
                          </div>
                        )}

                        <h3 className="text-base font-semibold text-white line-clamp-1">{post.title}</h3>
                        {post.description && (
                            <p className="text-sm text-white/55 mt-1 line-clamp-2">{post.description}</p>
                        )}

                        {/* Meta row */}
                          <div className="flex items-center gap-4 mt-3 text-xs text-white/50">
                          <Link
                            href={`/u/${post.author?.username || post.author?.id || ''}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 hover:text-white/70 transition-colors"
                          >
                            {post.author?.avatar_url ? (
                              <img src={post.author.avatar_url} alt={post.author.full_name || 'Author avatar'} className="w-4 h-4 rounded-full" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-surface-700 flex items-center justify-center text-[8px] font-bold text-white/40">
                                {(post.author?.full_name || '?')[0]}
                              </div>
                            )}
                            <span className="text-white/60 font-medium">{post.author?.full_name || 'Anonymous'}</span>
                          </Link>
                          {post.author?.role === 'moderator' && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold" style={{backgroundColor:'#22C55E33',color:'#22C55E'}}>🔰 Moderator</span>}
                          {post.author?.role === 'admin' && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold" style={{backgroundColor:'#EF444433',color:'#EF4444'}}>🛡️ Admin</span>}
                          <span>{timeAgo(post.created_at)}</span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            {post.comment_count}
                          </span>
                          {post.distro_count > 0 && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              {post.distro_count} distros
                            </span>
                          )}
                          {post.view_count > 0 && <span>{post.view_count} views</span>}
                        </div>

                        {/* Permission badges */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {post.allow_free_use && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold text-green-700 bg-green-50 rounded-full">Free to Use</span>
                          )}
                          {post.allow_distros && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 rounded-full">Distros Allowed</span>
                          )}
                          {post.allow_edits && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold text-purple-700 bg-purple-50 rounded-full">Open to Edits</span>
                          )}
                          {/* Mod delete */}
                          {user && (user.id === post.author_id || isMod) && (
                            <button
                              onClick={(e) => handleDeletePost(e, post.id)}
                              className="ml-auto px-2 py-0.5 text-[10px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors flex items-center gap-1"
                            >
                              {user.id !== post.author_id && <span className="text-amber-600">MOD</span>}
                              ✕ Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cover image */}
                      {post.cover_image_url && (
                        <div className="hidden sm:block w-28 h-20 rounded-lg overflow-hidden shrink-0">
                          <img src={post.cover_image_url} alt={post.title || 'Post cover'} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile category bar */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 px-4 py-2 z-20 backdrop-blur-xl"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,7,16,0.95)' }}
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className="shrink-0 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors"
            style={{
              color: !selectedCategory ? '#FF5F1F' : 'rgba(255,255,255,0.3)',
              border: !selectedCategory ? '1px solid rgba(255,95,31,0.3)' : '1px solid rgba(255,255,255,0.07)',
              background: !selectedCategory ? 'rgba(255,95,31,0.08)' : 'transparent',
            }}
          >All</button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className="shrink-0 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors"
              style={{
                color: selectedCategory === cat.slug ? '#FF5F1F' : 'rgba(255,255,255,0.3)',
                border: selectedCategory === cat.slug ? '1px solid rgba(255,95,31,0.3)' : '1px solid rgba(255,255,255,0.07)',
                background: selectedCategory === cat.slug ? 'rgba(255,95,31,0.08)' : 'transparent',
              }}
            >{cat.icon} {cat.name}</button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 px-6 mt-10" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 flex items-center justify-center" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-[9px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/50 uppercase tracking-widest">Screenplay Studio Community</span>
          </div>
          <div className="flex items-center gap-6">
            {['/', '/blog', '/community/challenges'].map((href, i) => (
              <Link key={href} href={href} className="text-[11px] font-mono text-white/25 uppercase tracking-widest hover:text-white/60 transition-colors">
                {['Home', 'Blog', 'Challenges'][i]}
              </Link>
            ))}
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}
