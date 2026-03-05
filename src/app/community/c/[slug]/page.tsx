'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubCommunity } from '@/lib/SubCommunityContext';
import type { CommunityPost, CommunityCategory } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';
import Link from 'next/link';

type PostCategory = { category: CommunityCategory };
type RichPost = CommunityPost & {
  author: { id: string; full_name: string | null; avatar_url: string | null; username: string | null; role: string | null } | null;
  community_post_categories: PostCategory[];
};

type Sort = 'newest' | 'hot' | 'top';

export default function CommunityFeedPage() {
  const { community, isMod, canPost } = useSubCommunity();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [posts,   setPosts]   = useState<RichPost[]>([]);
  const [sort,    setSort]    = useState<Sort>('newest');
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(true);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Show pending banner if redirected after approval-required post
  const showPending = searchParams?.get('pending') === '1';

  const loadPosts = async () => {
    setLoading(true);
    const sb = createClient();
    let q = sb
      .from('community_posts')
      .select('*, author:profiles!author_id(id,full_name,avatar_url,username,role), community_post_categories(category:community_categories(id,name,slug,icon,color))')
      .eq('sub_community_id', community.id);

    if (!isMod) q = q.eq('mod_status', 'approved');
    if (query)  q = q.ilike('title', `%${query}%`);

    if (sort === 'newest')     q = q.order('created_at', { ascending: false });
    else if (sort === 'hot')   q = q.order('comment_count', { ascending: false });
    else                       q = q.order('upvote_count',  { ascending: false });

    const { data } = await q.limit(60);
    setPosts((data ?? []) as RichPost[]);
    setLoading(false);
  };

  useEffect(() => { loadPosts(); }, [sort, query, community.id]); // eslint-disable-line

  const toggleUpvote = async (post: RichPost) => {
    if (!user) return;
    const sb = createClient();
    const has = upvoted.has(post.id);
    setUpvoted(prev => { const n = new Set(prev); has ? n.delete(post.id) : n.add(post.id); return n; });
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, upvote_count: (p.upvote_count ?? 0) + (has ? -1 : 1) }
      : p));
    if (has)
      await sb.from('post_upvotes').delete().eq('post_id', post.id).eq('user_id', user.id);
    else
      await sb.from('post_upvotes').insert({ post_id: post.id, user_id: user.id });
  };

  const deletePost = async (post: RichPost) => {
    if (!isMod || !confirm('Delete this post?')) return;
    setDeletingId(post.id);
    const sb = createClient();
    await sb.from('community_posts').delete().eq('id', post.id);
    setPosts(prev => prev.filter(p => p.id !== post.id));
    setDeletingId(null);
  };

  const accent = community.accent_color ?? '#FF5F1F';

  const CATEGORY_COLORS: Record<string, string> = {
    action:   '#ef4444', drama:    '#8b5cf6', comedy:   '#f59e0b',
    thriller: '#06b6d4', romance:  '#ec4899', horror:   '#dc2626',
    sci_fi:   '#3b82f6', fantasy:  '#a855f7', docs:     '#10b981',
  };

  return (
    <div className="flex gap-6">
      {/* Feed column */}
      <div className="flex-1 min-w-0 space-y-3">

        {/* Pending notice */}
        {showPending && (
          <div className="rounded-xl px-4 py-3 text-sm text-yellow-300/90 flex items-center gap-2"
            style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)' }}>
            <span>⏳</span>
            <span>Your post is pending mod approval. It will appear here once approved.</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {(['newest', 'hot', 'top'] as Sort[]).map(s => (
              <button key={s} onClick={() => setSort(s)}
                className={cn('px-2.5 py-1 text-xs font-medium rounded-md transition-all capitalize',
                  sort === s ? 'text-white' : 'text-white/40 hover:text-white/70')}
                style={sort === s ? { background: accent + '33', color: accent } : undefined}>
                {s}
              </button>
            ))}
          </div>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search posts…"
            className="flex-1 px-3 py-1.5 text-sm text-white placeholder:text-white/25 rounded-lg outline-none"
            style={{ background: 'rgba(255,255,255,0.05)' }} />
          {canPost && (
            <Link href={`/community/share?community=${community.slug}`}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap"
              style={{ background: accent }}>
              + Share Script
            </Link>
          )}
        </div>

        {/* Posts */}
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">🏜️</p>
            <p className="text-white/40 text-sm mb-4">
              {query ? 'No posts matching your search.' : 'No posts yet. Be the first to share a script!'}
            </p>
            {canPost && !query && (
              <Link href={`/community/share?community=${community.slug}`}
                className="inline-block px-4 py-2 text-sm font-semibold rounded-xl"
                style={{ background: accent }}>
                + Share Script
              </Link>
            )}
          </div>
        ) : (
          posts.map(post => {
            const isUpvoted = upvoted.has(post.id);
            const author = post.author;
            const categories: CommunityCategory[] = (post.community_post_categories ?? []).map((c: PostCategory) => c.category).filter(Boolean);
            return (
              <article key={post.id}
                className="group rounded-2xl p-4 transition-all hover:border-white/20"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex gap-3">

                  {/* Upvote */}
                  <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                    <button onClick={() => toggleUpvote(post)}
                      className={cn('transition-transform hover:scale-110', isUpvoted ? '' : 'opacity-30 hover:opacity-70')}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={isUpvoted ? accent : 'currentColor'}>
                        <path d="M12 4l8 8H4z"/>
                      </svg>
                    </button>
                    <span className="text-xs font-bold tabular-nums" style={{ color: isUpvoted ? accent : 'rgba(255,255,255,0.45)' }}>
                      {post.upvote_count ?? 0}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">

                    {/* Categories */}
                    {categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {categories.map(cat => (
                          <span key={cat.id}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              background: (CATEGORY_COLORS[cat.slug ?? ''] ?? accent) + '22',
                              color: CATEGORY_COLORS[cat.slug ?? ''] ?? accent,
                            }}>
                            {cat.icon} {cat.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Title + mod badge */}
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/community/post/${post.slug}`}
                        className="font-semibold text-sm leading-snug text-white hover:text-white/80 transition">
                        {post.title}
                      </Link>
                      {isMod && post.mod_status && post.mod_status !== 'approved' && (
                        <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded uppercase flex-shrink-0',
                          post.mod_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400')}>
                          {post.mod_status}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {post.description && (
                      <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-relaxed">{post.description}</p>
                    )}

                    {/* Permission badges */}
                    {(post.allow_free_use || post.allow_distros || post.allow_edits) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {post.allow_free_use && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-400">Free to Use</span>
                        )}
                        {post.allow_distros && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/15 text-blue-400">Distros Allowed</span>
                        )}
                        {post.allow_edits && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/15 text-purple-400">Open to Edits</span>
                        )}
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {/* Avatar + name */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex-shrink-0 overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.1)' }}>
                          {author?.avatar_url
                            ? <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <span className="w-full h-full flex items-center justify-center text-[9px]">
                                {(author?.full_name ?? '?')[0]}
                              </span>}
                        </div>
                        <span className="text-[11px] text-white/50">{author?.full_name ?? 'Anonymous'}</span>
                        {(author?.role === 'moderator' || author?.role === 'admin') && (
                          <span className="text-[9px] px-1 py-0.5 rounded font-medium"
                            style={{ background: accent + '22', color: accent }}>
                            {author.role === 'admin' ? 'Admin' : 'Mod'}
                          </span>
                        )}
                      </div>
                      <span className="text-white/20 text-[10px]">·</span>
                      <span className="text-[11px] text-white/30">{timeAgo(post.created_at!)}</span>
                      <span className="text-white/20 text-[10px]">·</span>
                      <span className="text-[11px] text-white/30">💬 {post.comment_count ?? 0}</span>
                      {(post.distro_count ?? 0) > 0 && (
                        <>
                          <span className="text-white/20 text-[10px]">·</span>
                          <span className="text-[11px] text-white/30">🔀 {post.distro_count}</span>
                        </>
                      )}
                      {(post.view_count ?? 0) > 0 && (
                        <>
                          <span className="text-white/20 text-[10px]">·</span>
                          <span className="text-[11px] text-white/30">👁 {post.view_count}</span>
                        </>
                      )}

                      {/* Mod delete */}
                      {isMod && (
                        <button onClick={() => deletePost(post)}
                          disabled={deletingId === post.id}
                          className="ml-auto text-[10px] text-red-400/40 hover:text-red-400 transition opacity-0 group-hover:opacity-100 disabled:opacity-30">
                          {deletingId === post.id ? '…' : '🗑'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cover image */}
                  {post.cover_image_url && (
                    <Link href={`/community/post/${post.slug}`}
                      className="hidden sm:block flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden">
                      <img src={post.cover_image_url} alt="" className="w-full h-full object-cover" />
                    </Link>
                  )}

                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 space-y-4 hidden lg:block">
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">About</h3>
          {community.description && <p className="text-xs text-white/60 leading-relaxed">{community.description}</p>}
          <div className="flex flex-col gap-1.5">
            <Link href={`/community/c/${community.slug}/about`}
              className="text-xs text-white/40 hover:text-white transition">Rules &amp; Staff →</Link>
            <Link href={`/community/c/${community.slug}/contests`}
              className="text-xs text-white/40 hover:text-white transition">Contests →</Link>
            {isMod && (
              <Link href={`/community/c/${community.slug}/settings`}
                className="text-xs font-medium hover:opacity-80 transition" style={{ color: accent }}>⚙ Mod Tools →</Link>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
