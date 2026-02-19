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
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<CommunityChallenge | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'discussed'>('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();

    const [postsRes, catsRes, challengeRes] = await Promise.all([
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
    ]);

    const rawPosts = postsRes.data || [];

    // Fetch categories for each post
    if (rawPosts.length > 0) {
      const postIds = rawPosts.map((p: any) => p.id);
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

      rawPosts.forEach((p: any) => {
        p.categories = catMap.get(p.id) || [];
      });
    }

    setPosts(rawPosts);
    setCategories(catsRes.data || []);
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

  // Filter & sort
  const filtered = posts
    .filter((p) => !selectedCategory || p.categories?.some((c) => c.slug === selectedCategory))
    .sort((a, b) => {
      if (sortBy === 'popular') return b.upvote_count - a.upvote_count;
      if (sortBy === 'discussed') return b.comment_count - a.comment_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

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
            <Link href="/community" className="text-sm font-semibold text-stone-900 border-b-2 border-brand-500 pb-0.5">Feed</Link>
            <Link href="/community/challenges" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Challenges</Link>
            <Link href="/community/free-scripts" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Free Scripts</Link>
            <Link href="/community/chat" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Chat</Link>
            <Link href="/messages" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Messages</Link>
            <Link href="/blog" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Blog</Link>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/community/share"
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                >
                  Share Script
                </Link>
                <Link href="/dashboard" className="text-xs text-stone-500 hover:text-stone-900 transition-colors">Dashboard</Link>
                <button onClick={handleSignOut} className="text-xs text-stone-500 hover:text-stone-900 transition-colors">Sign Out</button>
                <Link href={`/u/${user.username || user.id}`}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full hover:ring-2 ring-brand-300 transition-all" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600 hover:ring-2 ring-brand-300 transition-all">
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/login?redirect=/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Sign In</Link>
                <Link href="/auth/register?redirect=/community" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero / Active Challenge Banner */}
      {activeChallenge && (() => {
        const phase = getChallengePhase(activeChallenge);
        return phase !== 'completed' ? (
          <div className="bg-gradient-to-r from-brand-600 to-orange-500 text-white">
            <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Weekly Challenge</span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/20 rounded-full">{getPhaseLabel(phase)}</span>
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
                  className="px-4 py-2 text-sm font-medium bg-white text-brand-700 hover:bg-white/90 rounded-lg transition-colors"
                >
                  {phase === 'submissions' ? 'Submit' : 'View'}
                </Link>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Community Scripts</h1>
            <p className="text-stone-500 mt-1">Discover, share, and collaborate on screenplays</p>
          </div>
          <div className="flex items-center gap-2">
            {(['newest', 'popular', 'discussed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                  sortBy === s ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar — categories */}
          <aside className="hidden lg:block w-56 shrink-0">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Categories</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  !selectedCategory ? 'bg-brand-50 text-brand-700 font-medium' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                All Scripts
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                    selectedCategory === cat.slug ? 'bg-brand-50 text-brand-700 font-medium' : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Quick links */}
            <div className="mt-8 pt-6 border-t border-stone-200">
              <Link href="/community/challenges" className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors py-1.5">
                🏆 Writing Challenges
              </Link>
              <Link href="/community/free-scripts" className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors py-1.5">
                📖 Free-to-Use Scripts
              </Link>
            </div>
          </aside>

          {/* Main content — post feed */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">📝</div>
                <p className="text-lg font-semibold text-stone-700 mb-2">No scripts shared yet</p>
                <p className="text-sm text-stone-500 mb-6">Be the first to share your work with the community!</p>
                {user && (
                  <Link href="/community/share" className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
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
                    className="block rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all p-5"
                  >
                    <div className="flex items-start gap-4">
                      {/* Upvote count */}
                      <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        <span className="text-sm font-semibold text-stone-700">{post.upvote_count}</span>
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

                        <h3 className="text-base font-semibold text-stone-900 line-clamp-1">{post.title}</h3>
                        {post.description && (
                          <p className="text-sm text-stone-500 mt-1 line-clamp-2">{post.description}</p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-stone-400">
                          <Link
                            href={`/u/${post.author?.username || post.author?.id || ''}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 hover:text-stone-700 transition-colors"
                          >
                            {post.author?.avatar_url ? (
                              <img src={post.author.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center text-[8px] font-bold text-stone-500">
                                {(post.author?.full_name || '?')[0]}
                              </div>
                            )}
                            <span className="text-stone-600 font-medium">{post.author?.full_name || 'Anonymous'}</span>
                          </Link>
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
                        </div>
                      </div>

                      {/* Cover image */}
                      {post.cover_image_url && (
                        <div className="hidden sm:block w-28 h-20 rounded-lg overflow-hidden shrink-0">
                          <img src={post.cover_image_url} alt="" className="w-full h-full object-cover" />
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-2 z-20">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-3 py-1.5 text-xs rounded-full ${!selectedCategory ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600'}`}
          >All</button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`shrink-0 px-3 py-1.5 text-xs rounded-full ${selectedCategory === cat.slug ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600'}`}
            >{cat.icon} {cat.name}</button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#faf9f7] border-t border-stone-200 py-10 px-6 mt-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-stone-700">Screenplay Studio Community</span>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <Link href="/" className="hover:text-stone-900 transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-stone-900 transition-colors">Blog</Link>
            <Link href="/community/challenges" className="hover:text-stone-900 transition-colors">Challenges</Link>
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}
