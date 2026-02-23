'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BlogPost } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { SiteVersion } from '@/components/SiteVersion';

// ============================================================
// Blog index — distinct, magazine-style design
// ============================================================

export default function BlogPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const handleSignOut = async () => {
    const supabase = createClient();
    try { sessionStorage.removeItem('ss_session_active'); } catch {}
    await supabase.auth.signOut();
    router.refresh();
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('blog_posts')
        .select('*, author:profiles!author_id(*)')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      setPosts(data || []);
    } catch (err) {
      console.error('Error loading blog posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const allTags = Array.from(new Set(posts.flatMap((p) => p.tags || [])));
  const filtered = selectedTag
    ? posts.filter((p) => p.tags?.includes(selectedTag))
    : posts;

  const featured = filtered[0];
  const rest = filtered.slice(1);

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
            <span className="text-lg font-bold text-stone-900 group-hover:text-brand-600 transition-colors">
              Screenplay Studio
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-stone-900 border-b-2 border-brand-500 pb-0.5">
              Blog
            </span>
            <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
              Community
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  Dashboard
                </Link>
                <button onClick={handleSignOut} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  Sign Out
                </button>
                <div className="flex items-center gap-2">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600">
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login?redirect=/blog" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  Sign In
                </Link>
                <Link
                  href="/auth/register?redirect=/blog"
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <h1 className="text-5xl md:text-6xl font-bold text-stone-900 tracking-tight">
          The Studio Blog
        </h1>
        <p className="mt-4 text-xl text-stone-500 max-w-2xl">
          Updates, insights, and behind-the-scenes from the development of Screenplay Studio.
        </p>
      </header>

      {/* Tags filter */}
      {allTags.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-8">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                !selectedTag
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All Posts
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedTag === tag
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <div className="text-5xl mb-4">📝</div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">No posts yet</h2>
          <p className="text-stone-500">Check back soon for updates!</p>
        </div>
      )}

      {/* Posts grid */}
      {!loading && filtered.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-24">
          {/* Featured post */}
          {featured && (
            <Link href={`/blog/${featured.slug}`} className="group block mb-16">
              <article className="grid md:grid-cols-2 gap-8 items-center">
                {featured.cover_image_url ? (
                  <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-stone-200">
                    <img
                      src={featured.cover_image_url}
                      alt={featured.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/10] rounded-2xl bg-gradient-to-br from-brand-100 to-orange-100 flex items-center justify-center">
                    <span className="text-6xl opacity-50">✍️</span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    {featured.tags?.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-stone-900 group-hover:text-brand-600 transition-colors leading-tight">
                    {featured.title}
                  </h2>
                  {featured.excerpt && (
                    <p className="mt-4 text-lg text-stone-500 leading-relaxed line-clamp-3">
                      {featured.excerpt}
                    </p>
                  )}
                  <div className="mt-6 flex items-center gap-3">
                    {featured.author?.avatar_url ? (
                      <img src={featured.author.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600">
                        {(featured.author?.full_name || 'A')[0]}
                      </div>
                    )}
                    <div className="text-sm">
                      <span className="text-stone-700 font-medium">
                        {featured.author?.full_name || 'Screenplay Studio'}
                      </span>
                      <span className="text-stone-400 mx-2">·</span>
                      <time className="text-stone-400">
                        {featured.published_at ? formatDate(featured.published_at) : ''}
                      </time>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          )}

          {/* Rest of posts */}
          {rest.length > 0 && (
            <>
              <div className="border-t border-stone-200 pt-12 mb-8">
                <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-widest">
                  All Posts
                </h3>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {rest.map((post) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="group">
                    <article>
                      {post.cover_image_url ? (
                        <div className="aspect-[16/10] rounded-xl overflow-hidden bg-stone-200 mb-4">
                          <img
                            src={post.cover_image_url}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center mb-4">
                          <span className="text-4xl opacity-30">📄</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {post.tags?.slice(0, 2).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 text-[10px] font-semibold text-stone-500 bg-stone-100 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-xl font-bold text-stone-900 group-hover:text-brand-600 transition-colors leading-snug">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="mt-2 text-sm text-stone-500 leading-relaxed line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <time className="block mt-3 text-xs text-stone-400">
                        {post.published_at ? formatDate(post.published_at) : ''}
                      </time>
                    </article>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Timeline section */}
      {!loading && posts.length > 0 && (
        <section className="bg-stone-100 border-t border-stone-200 py-20">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-stone-900 mb-12 text-center">Timeline</h2>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-stone-300" />
              <div className="space-y-8">
                {posts.map((post, idx) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="group block relative pl-12">
                    {/* Dot */}
                    <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 ${
                      idx === 0
                        ? 'bg-brand-500 border-brand-500'
                        : 'bg-white border-stone-400 group-hover:border-brand-500'
                    } transition-colors`} />
                    <time className="block text-xs font-medium text-stone-400 mb-1">
                      {post.published_at ? formatDate(post.published_at) : ''}
                    </time>
                    <h3 className="text-base font-semibold text-stone-800 group-hover:text-brand-600 transition-colors">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="mt-1 text-sm text-stone-500 line-clamp-1">
                        {post.excerpt}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-[#faf9f7] border-t border-stone-200 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand-600 rounded-md flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-stone-700">Screenplay Studio</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <Link href="/" className="hover:text-stone-900 transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-stone-900 transition-colors">Blog</Link>
            <a href="https://ko-fi.com/northemdevelopment" target="_blank" rel="noopener noreferrer" className="hover:text-stone-900 transition-colors">
              Support ❤️
            </a>
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}
