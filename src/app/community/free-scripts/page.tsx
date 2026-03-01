'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { formatDate, timeAgo } from '@/lib/utils';
import { LANGUAGE_OPTIONS } from '@/lib/types';
import type { CommunityPost, CommunityCategory } from '@/lib/types';

type EnrichedPost = CommunityPost & { _productionCount?: number };

// ============================================================
// Free-to-Use Scripts — library of openly-licensed scripts
// ============================================================

export default function FreeScriptsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  const [filterLanguage, setFilterLanguage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFreeScripts();
  }, []);

  const fetchFreeScripts = async () => {
    const supabase = createClient();

    const [postsRes, catsRes] = await Promise.all([
      supabase
        .from('community_posts')
        .select('*, author:profiles!author_id(*)')
        .eq('status', 'published')
        .eq('allow_free_use', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('community_categories')
        .select('*')
        .order('display_order'),
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

    // Fetch production counts
    if (rawPosts.length > 0) {
      const postIds = rawPosts.map((p: { id: string }) => p.id);
      const { data: prodCounts } = await supabase
        .from('script_productions')
        .select('post_id')
        .in('post_id', postIds)
        .eq('status', 'approved');

      const countMap = new Map<string, number>();
      (prodCounts || []).forEach((p: { post_id: string }) => {
        countMap.set(p.post_id, (countMap.get(p.post_id) || 0) + 1);
      });

      rawPosts.forEach((p: EnrichedPost) => {
        p._productionCount = countMap.get(p.id) || 0;
      });
    }

    setPosts(rawPosts);
    setCategories(catsRes.data || []);
    setLoading(false);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    try { sessionStorage.removeItem('ss_session_active'); } catch {}
    await supabase.auth.signOut();
    router.refresh();
  };

  // Filter & sort
  const allLanguages = Array.from(new Set(posts.map((p) => p.language).filter(Boolean))).sort() as string[];
  const filtered = posts
    .filter((p) => !selectedCategory || p.categories?.some((c) => c.slug === selectedCategory))
    .filter((p) => !filterLanguage || p.language === filterLanguage)
    .sort((a, b) => {
      if (sortBy === 'popular') return b.upvote_count - a.upvote_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

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
            <Link href="/community/challenges" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Challenges</Link>
            <Link href="/community/free-scripts" className="text-[11px] font-mono uppercase tracking-widest text-white" style={{ borderBottom: '1px solid #FF5F1F', paddingBottom: '2px' }}>Scripts</Link>
            <Link href="/blog" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Blog</Link>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/community/share" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Share</Link>
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
              <Link href="/auth/login?redirect=/community/free-scripts" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Sign In</Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>FREE-TO-USE SCRIPTS</h1>
            <p className="text-white/40 mt-1 max-w-xl font-mono text-sm">
              Scripts shared by writers for filmmakers to produce. Read, adapt, and create — always credit the author.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['newest', 'popular'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-widest capitalize transition-colors ${
                  sortBy === s ? 'text-white' : 'text-white/40 hover:text-white'
                }`}
                style={sortBy === s ? { background: '#FF5F1F' } : { border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {s}
              </button>
            ))}
            {allLanguages.length > 0 && (
              <select
                value={filterLanguage || ''}
                onChange={(e) => setFilterLanguage(e.target.value || null)}
                className="appearance-none cursor-pointer bg-transparent px-3 py-1.5 text-xs font-mono text-white/50 hover:text-white"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <option value="">All Languages</option>
                {allLanguages.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_OPTIONS.find((lo) => lo.value === l)?.label || l}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Info banner */}
        <div className="p-5 mb-8" style={{ background: 'rgba(255,95,31,0.06)', border: '1px solid rgba(255,95,31,0.2)' }}>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 shrink-0 mt-0.5" style={{ background: '#FF5F1F' }} />
            <div>
              <h3 className="text-sm font-black text-white mb-1" style={{ letterSpacing: '-0.02em' }}>FOR FILMMAKERS</h3>
              <p className="text-xs font-mono text-white/50 leading-relaxed">
                All scripts in this section have been explicitly marked as &quot;free to use&quot; by their authors.
                You may produce films based on these scripts, but you must credit the original writer.
                Check each script&apos;s details for specific permissions. If you produce something, submit it — the author would love to see!
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Category filter sidebar */}
          <aside className="hidden lg:block w-52 shrink-0">
            <h3 className="text-[9px] font-mono uppercase tracking-widest text-white/50 mb-3">Filter by Category</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
                  !selectedCategory ? 'text-[#FF5F1F]' : 'text-white/40 hover:text-white'
                }`}
              >
                All Scripts
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`w-full text-left px-3 py-2 text-xs font-mono uppercase tracking-widest transition-colors flex items-center gap-2 ${
                    selectedCategory === cat.slug ? 'text-[#FF5F1F]' : 'text-white/40 hover:text-white'
                  }`}
                >
                  <span>{cat.icon}</span> {cat.name}
                </button>
              ))}
            </div>
          </aside>

          {/* Scripts grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#FF5F1F]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 mb-4 mx-auto" style={{ background: '#FF5F1F', opacity: 0.3 }} />
                <p className="text-lg font-black text-white mb-2" style={{ letterSpacing: '-0.02em' }}>NO FREE SCRIPTS YET</p>
                <p className="text-sm font-mono text-white/40 mb-6">
                  Be the first to share a script freely with filmmakers!
                </p>
                {user && (
                  <Link href="/community/share" className="ss-btn-orange text-sm">
                    Share a Free Script
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((post) => (
                  <Link
                    key={post.id}
                    href={`/community/post/${post.slug}`}
                    className="block hover:opacity-80 transition-all overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    {/* Cover image */}
                    {post.cover_image_url && (
                      <div className="h-36 bg-white/5 overflow-hidden">
                        <img src={post.cover_image_url} alt={post.title || 'Script cover'} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="p-5">
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

                      <h3 className="text-base font-black text-white line-clamp-1" style={{ letterSpacing: '-0.02em' }}>{post.title}</h3>
                      {post.description && (
                        <p className="text-sm text-white/40 mt-1 line-clamp-2">{post.description}</p>
                      )}

                      {/* Author + meta */}
                      <div className="flex items-center gap-3 mt-3 text-xs font-mono text-white/50">
                        <span className="flex items-center gap-1">
                          {post.author?.avatar_url ? (
                            <img src={post.author.avatar_url} alt={post.author.full_name || 'Author avatar'} className="w-4 h-4 rounded-full" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold text-white">
                              {(post.author?.full_name || '?')[0]}
                            </div>
                          )}
                          <span className="text-white/60 font-medium">{post.author?.full_name || 'Anonymous'}</span>
                        </span>
                        <span>{timeAgo(post.created_at)}</span>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-3 pt-3 text-xs font-mono text-white/50" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                          {post.upvote_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          {post.comment_count}
                        </span>
                        {(post as EnrichedPost)._productionCount && (post as EnrichedPost)._productionCount! > 0 && (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            🎬 {(post as EnrichedPost)._productionCount} production{(post as EnrichedPost)._productionCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="ml-auto text-[#FF5F1F] font-black">Free to Use</span>
                      </div>

                      {/* Permission badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {post.allow_distros && (
                          <span className="px-2 py-0.5 text-[10px] font-mono uppercase text-white/50" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Distros OK</span>
                        )}
                        {post.allow_edits && (
                          <span className="px-2 py-0.5 text-[10px] font-mono uppercase text-white/50" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Editable</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 px-6 mt-10" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Screenplay Studio Community</span>
          <div className="flex items-center gap-6 text-[11px] font-mono uppercase tracking-widest text-white/50">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/community" className="hover:text-white transition-colors">Feed</Link>
            <Link href="/community/challenges" className="hover:text-white transition-colors">Challenges</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <SiteVersion />
          </div>
        </div>
      </footer>
    </div>
  );
}
