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
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#faf9f7]/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            </div>
            <span className="text-lg font-bold text-stone-900 group-hover:text-brand-600 transition-colors">Community</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Feed</Link>
            <Link href="/community/challenges" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Challenges</Link>
            <Link href="/community/free-scripts" className="text-sm font-semibold text-stone-900 border-b-2 border-brand-500 pb-0.5">Free Scripts</Link>
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
              </>
            ) : (
              <>
                <Link href="/auth/login?redirect=/community/free-scripts" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Sign In</Link>
                <Link href="/auth/register?redirect=/community/free-scripts" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Free-to-Use Scripts</h1>
            <p className="text-stone-500 mt-1 max-w-xl">
              Scripts shared by writers for filmmakers to produce. Read, adapt, and create — always credit the author.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['newest', 'popular'] as const).map((s) => (
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
            {allLanguages.length > 0 && (
              <select
                value={filterLanguage || ''}
                onChange={(e) => setFilterLanguage(e.target.value || null)}
                className="bg-stone-100 border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-600 appearance-none cursor-pointer"
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
        <div className="rounded-xl bg-green-50 border border-green-200 p-5 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📖</span>
            <div>
              <h3 className="text-sm font-semibold text-green-900 mb-1">For Filmmakers</h3>
              <p className="text-xs text-green-700 leading-relaxed">
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
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Filter by Category</h3>
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
                  <span>{cat.icon}</span> {cat.name}
                </button>
              ))}
            </div>
          </aside>

          {/* Scripts grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">📜</div>
                <p className="text-lg font-semibold text-stone-700 mb-2">No free scripts yet</p>
                <p className="text-sm text-stone-500 mb-6">
                  Be the first to share a script freely with filmmakers!
                </p>
                {user && (
                  <Link href="/community/share" className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
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
                    className="block rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all overflow-hidden"
                  >
                    {/* Cover image */}
                    {post.cover_image_url && (
                      <div className="h-36 bg-stone-100 overflow-hidden">
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

                      <h3 className="text-base font-semibold text-stone-900 line-clamp-1">{post.title}</h3>
                      {post.description && (
                        <p className="text-sm text-stone-500 mt-1 line-clamp-2">{post.description}</p>
                      )}

                      {/* Author + meta */}
                      <div className="flex items-center gap-3 mt-3 text-xs text-stone-400">
                        <span className="flex items-center gap-1">
                          {post.author?.avatar_url ? (
                            <img src={post.author.avatar_url} alt={post.author.full_name || 'Author avatar'} className="w-4 h-4 rounded-full" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center text-[8px] font-bold text-stone-500">
                              {(post.author?.full_name || '?')[0]}
                            </div>
                          )}
                          <span className="text-stone-600 font-medium">{post.author?.full_name || 'Anonymous'}</span>
                        </span>
                        <span>{timeAgo(post.created_at)}</span>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-100 text-xs text-stone-400">
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
                        <span className="ml-auto text-green-600 font-semibold">Free to Use</span>
                      </div>

                      {/* Permission badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {post.allow_distros && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 rounded-full">Distros OK</span>
                        )}
                        {post.allow_edits && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold text-purple-700 bg-purple-50 rounded-full">Editable</span>
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
      <footer className="bg-[#faf9f7] border-t border-stone-200 py-10 px-6 mt-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-stone-700">Screenplay Studio Community</span>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <Link href="/" className="hover:text-stone-900 transition-colors">Home</Link>
            <Link href="/community" className="hover:text-stone-900 transition-colors">Feed</Link>
            <Link href="/community/challenges" className="hover:text-stone-900 transition-colors">Challenges</Link>
            <Link href="/blog" className="hover:text-stone-900 transition-colors">Blog</Link>
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}
