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
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      {/* Dot-grid texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Nav */}
      <nav
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,7,16,0.9)' }}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 flex items-center justify-center shrink-0" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-[10px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-widest group-hover:text-white/70 transition-colors">
              Screenplay Studio
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <span className="ss-label" style={{ color: '#FF5F1F' }}>Blog</span>
            <Link href="/community" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">
              Community
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">
                  Dashboard
                </Link>
                <button onClick={handleSignOut} className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">
                  Sign Out
                </button>
                <div className="flex items-center gap-2">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name || 'User avatar'} className="w-6 h-6" />
                  ) : (
                    <div
                      className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-white"
                      style={{ background: '#FF5F1F' }}
                    >
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login?redirect=/blog" className="text-[11px] font-mono text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors">
                  Sign In
                </Link>
                <Link href="/auth/register?redirect=/blog" className="ss-btn-orange" style={{ padding: '0.35rem 0.9rem', fontSize: '10px' }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 pt-16 pb-12 relative z-10">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-3 h-px shrink-0" style={{ background: '#FF5F1F' }} />
          <span className="ss-label">Publishing</span>
        </div>
        <h1 className="font-black text-white" style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)', letterSpacing: '-0.04em', lineHeight: 0.88 }}>
          THE STUDIO BLOG
        </h1>
        <p className="mt-6 text-base text-white/30 max-w-2xl leading-relaxed">
          Updates, insights, and behind-the-scenes from the development of Screenplay Studio.
        </p>
      </header>

      {/* Tags filter */}
      {allTags.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-10 relative z-10">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTag(null)}
              className="ss-tag"
              style={!selectedTag ? { background: '#FF5F1F', borderColor: '#FF5F1F', color: '#fff' } : undefined}
            >
              All Posts
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className="ss-tag"
                style={selectedTag === tag ? { background: '#FF5F1F', borderColor: '#FF5F1F', color: '#fff' } : undefined}
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
          <div className="h-6 w-6 animate-spin" style={{ border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FF5F1F', borderRadius: 0 }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="max-w-6xl mx-auto px-6 py-24 text-center relative z-10">
          <div className="flex items-center gap-2.5 mb-4 justify-center">
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
            <span className="ss-label">Empty</span>
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          </div>
          <h2 className="text-2xl font-black text-white mb-2" style={{ letterSpacing: '-0.03em' }}>NO POSTS YET</h2>
          <p className="text-sm text-white/30">Check back soon for updates.</p>
        </div>
      )}

      {/* Posts grid */}
      {!loading && filtered.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-24 relative z-10">
          {/* Featured post */}
          {featured && (
            <Link href={`/blog/${featured.slug}`} className="group block mb-16">
              <article
                className="grid md:grid-cols-2 gap-8 items-center p-8 transition-all duration-200"
                style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
              >
                {featured.cover_image_url ? (
                  <div className="aspect-[16/10] overflow-hidden">
                    <img
                      src={featured.cover_image_url}
                      alt={featured.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/10] flex items-center justify-center" style={{ background: 'rgba(255,95,31,0.05)', border: '1px solid rgba(255,95,31,0.15)' }}>
                    <span className="font-black text-white/10 text-5xl" style={{ letterSpacing: '-0.04em' }}>BLOG</span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
                    <span className="ss-label">Featured</span>
                    {featured.tags?.slice(0, 2).map((tag) => (
                      <span key={tag} className="ss-tag" style={{ fontSize: '9px' }}>{tag}</span>
                    ))}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white group-hover:text-white/70 transition-colors leading-tight" style={{ letterSpacing: '-0.03em' }}>
                    {featured.title}
                  </h2>
                  {featured.excerpt && (
                    <p className="mt-4 text-sm text-white/30 leading-relaxed line-clamp-3">
                      {featured.excerpt}
                    </p>
                  )}
                  <div className="mt-6 flex items-center gap-3">
                    {featured.author?.avatar_url ? (
                      <img src={featured.author.avatar_url} alt={featured.author.full_name || 'Author avatar'} className="w-6 h-6" />
                    ) : (
                      <div className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: '#FF5F1F' }}>
                        {(featured.author?.full_name || 'A')[0]}
                      </div>
                    )}
                    <div className="text-[11px] font-mono text-white/30">
                      <span>{featured.author?.full_name || 'Screenplay Studio'}</span>
                      <span className="mx-2 opacity-40">·</span>
                      <time>{featured.published_at ? formatDate(featured.published_at) : ''}</time>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          )}

          {/* Rest of posts */}
          {rest.length > 0 && (
            <>
              <div className="flex items-center gap-4 mb-10" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '2.5rem' }}>
                <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
                <h3 className="ss-label">All Posts</h3>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((post) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="group">
                    <article
                      className="p-5 transition-all duration-200 h-full flex flex-col"
                      style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                    >
                      {post.cover_image_url ? (
                        <div className="aspect-[16/10] overflow-hidden mb-5">
                          <img
                            src={post.cover_image_url}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[16/10] flex items-center justify-center mb-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <span className="font-black text-white/5 text-3xl" style={{ letterSpacing: '-0.04em' }}>SS</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {post.tags?.slice(0, 2).map((tag) => (
                          <span key={tag} className="ss-tag" style={{ fontSize: '9px', padding: '0.15rem 0.5rem' }}>{tag}</span>
                        ))}
                      </div>
                      <h3 className="text-base font-black text-white group-hover:text-white/60 transition-colors leading-snug mb-2" style={{ letterSpacing: '-0.02em' }}>
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-xs text-white/25 leading-relaxed line-clamp-2 flex-1">
                          {post.excerpt}
                        </p>
                      )}
                      <time className="block mt-4 text-[10px] font-mono text-white/20 uppercase tracking-wider">
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
        <section
          className="py-20 relative z-10"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)' }}
        >
          <div className="max-w-3xl mx-auto px-6">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
              <span className="ss-label">Archive</span>
              <h2 className="text-lg font-black text-white" style={{ letterSpacing: '-0.02em' }}>TIMELINE</h2>
            </div>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-2 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="space-y-8">
                {posts.map((post, idx) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="group block relative pl-10">
                    {/* Dot */}
                    <div
                      className="absolute left-0.5 top-1.5 w-3 h-3 transition-all duration-200"
                      style={{ background: idx === 0 ? '#FF5F1F' : 'rgba(255,255,255,0.12)' }}
                    />
                    <time className="block text-[10px] font-mono text-white/20 uppercase tracking-wider mb-1">
                      {post.published_at ? formatDate(post.published_at) : ''}
                    </time>
                    <h3 className="text-sm font-black text-white/60 group-hover:text-white transition-colors" style={{ letterSpacing: '-0.01em' }}>
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="mt-0.5 text-xs text-white/20 line-clamp-1">
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

      {/* Changelog banner */}
      <section className="relative z-10 py-14" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <Link
            href="/changelog"
            className="group block"
          >
            <div
              className="relative overflow-hidden p-8 md:p-10 transition-all duration-300"
              style={{ border: '1px solid rgba(255,95,31,0.18)', background: 'rgba(255,95,31,0.03)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,95,31,0.35)'; e.currentTarget.style.background = 'rgba(255,95,31,0.055)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,95,31,0.18)'; e.currentTarget.style.background = 'rgba(255,95,31,0.03)'; }}
            >
              {/* Decorative right-edge glow */}
              <div
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-64 opacity-30"
                style={{ background: 'linear-gradient(to left, rgba(255,95,31,0.12), transparent)' }}
              />

              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
                    <span className="ss-label" style={{ color: '#FF5F1F' }}>What&rsquo;s New</span>
                  </div>
                  <h2
                    className="font-black text-white leading-tight"
                    style={{ fontSize: 'clamp(1.5rem, 4vw, 2.75rem)', letterSpacing: '-0.035em' }}
                  >
                    SEE THE FULL
                    <br />
                    <span style={{ color: '#FF5F1F' }}>CHANGELOG</span>
                  </h2>
                  <p className="mt-3 text-sm text-white/30 max-w-md leading-relaxed">
                    Every feature shipped, every bug fixed, every improvement made — tracked by version, area, and type.
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  <span
                    className="inline-flex items-center gap-2 px-5 py-2.5 font-mono text-xs uppercase tracking-widest font-bold transition-all duration-200"
                    style={{ background: '#FF5F1F', color: '#fff' }}
                  >
                    View Changelog
                    <span className="group-hover:translate-x-1 transition-transform duration-200 inline-block">→</span>
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 relative z-10" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-[9px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/30 uppercase tracking-widest">Screenplay Studio</span>
          </div>
          <div className="flex items-center gap-6">
            {[
              { href: '/', label: 'Home' },
              { href: '/blog', label: 'Blog' },
              { href: '/changelog', label: 'Changelog' },
              { href: 'https://ko-fi.com/northemdevelopment', label: 'Support', external: true },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noopener noreferrer' : undefined}
                className="text-[11px] font-mono text-white/25 uppercase tracking-widest hover:text-white/60 transition-colors"
              >
                {l.label}
              </Link>
            ))}
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
