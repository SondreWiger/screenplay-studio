'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BlogPost, BlogComment, Profile } from '@/lib/types';
import { formatDate, timeAgo } from '@/lib/utils';
import { SiteVersion } from '@/components/SiteVersion';

// ============================================================
// Individual blog post page — clean reading experience
// ============================================================

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    try { sessionStorage.removeItem('ss_session_active'); } catch {}
    await supabase.auth.signOut();
    router.refresh();
  };
  const [post, setPost] = useState<BlogPost | null>(null);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    fetchPost();
  }, [params.slug]);

  // Scroll-spy for section highlighting in the ToC
  useEffect(() => {
    if (!post || !post.sections || post.sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLElement);
            if (idx !== -1) setActiveSection(idx);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, [post]);

  const fetchPost = async () => {
    try {
      const supabase = createClient();
      const { data: postData, error } = await supabase
        .from('blog_posts')
        .select('*, author:profiles!author_id(*)')
        .eq('slug', params.slug)
        .eq('status', 'published')
        .single();

      if (error || !postData) {
        setPost(null);
        setLoading(false);
        return;
      }

      setPost(postData);

      // Increment view count (fire-and-forget)
      supabase
        .from('blog_posts')
        .update({ view_count: (postData.view_count || 0) + 1 })
        .eq('id', postData.id)
        .then(() => {});

      // Fetch comments
      const { data: commentsData } = await supabase
        .from('blog_comments')
        .select('*, author:profiles!author_id(*)')
        .eq('post_id', postData.id)
        .eq('is_hidden', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: true });

      // Nest replies
      const topLevel: BlogComment[] = [];
      const replyMap: Record<string, BlogComment[]> = {};
      (commentsData || []).forEach((c: BlogComment) => {
        if (c.parent_id) {
          if (!replyMap[c.parent_id]) replyMap[c.parent_id] = [];
          replyMap[c.parent_id].push(c);
        } else {
          topLevel.push(c);
        }
      });
      topLevel.forEach((c) => {
        c.replies = replyMap[c.id] || [];
      });
      setComments(topLevel);
    } catch (err) {
      console.error('Error fetching post:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleComment = async (parentId?: string) => {
    const text = parentId ? replyText : commentText;
    if (!text.trim() || !user || !post) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('blog_comments')
        .insert({
          post_id: post.id,
          parent_id: parentId || null,
          author_id: user.id,
          author_name: user.full_name || user.display_name || user.email,
          content: text.trim(),
        })
        .select('*, author:profiles!author_id(*)')
        .single();

      if (!error && data) {
        if (parentId) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === parentId
                ? { ...c, replies: [...(c.replies || []), data] }
                : c
            )
          );
          setReplyText('');
          setReplyingTo(null);
        } else {
          setComments((prev) => [...prev, { ...data, replies: [] }]);
          setCommentText('');
        }
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToSection = (idx: number) => {
    sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
      </div>
    );
  }

  // Not found
  if (!post) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <nav className="border-b border-stone-200 bg-[#faf9f7]/90 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
            <Link href="/blog" className="text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Blog
            </Link>
          </div>
        </nav>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Post not found</h1>
          <p className="text-stone-500">This post may have been removed or doesn't exist.</p>
          <Link href="/blog" className="mt-8 px-6 py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors">
            Browse all posts
          </Link>
        </div>
      </div>
    );
  }

  const sections = post.sections || [];
  const hasToC = sections.length > 1;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#faf9f7]/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/blog" className="text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Blog
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
              Home
            </Link>
            <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
              Community
            </Link>
            {user ? (
              <>
                <button onClick={handleSignOut} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  Sign Out
                </button>
                <div className="flex items-center gap-2">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name || 'User avatar'} className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600">
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href={`/auth/login?redirect=/blog/${params.slug}`} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 relative">
        <div className={hasToC ? 'lg:pr-72' : ''}>
          {/* Article header */}
          <header className="pt-16 pb-10">
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags?.map((tag) => (
                <span key={tag} className="px-3 py-1 text-xs font-semibold text-brand-700 bg-brand-50 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-tight">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="mt-6 text-xl text-stone-500 leading-relaxed">
                {post.excerpt}
              </p>
            )}
            <div className="mt-8 flex items-center gap-4 pb-8 border-b border-stone-200">
              {post.author?.avatar_url ? (
                <img src={post.author.avatar_url} alt={post.author.full_name || 'Author avatar'} className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-600">
                  {(post.author?.full_name || 'A')[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-stone-800">
                  {post.author?.full_name || 'Screenplay Studio'}
                </p>
                <p className="text-xs text-stone-400">
                  {post.published_at ? formatDate(post.published_at) : ''}
                  {post.view_count > 0 && (
                    <> · {post.view_count.toLocaleString()} views</>
                  )}
                </p>
              </div>
            </div>
          </header>

          {/* Cover image */}
          {post.cover_image_url && (
            <div className="mb-12 -mx-6 lg:mx-0">
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="w-full rounded-2xl"
              />
            </div>
          )}

          {/* Article body — sections */}
          <article className="pb-16">
            {sections.length > 0 ? (
              <div className="space-y-12">
                {sections
                  .sort((a, b) => a.order - b.order)
                  .map((section, idx) => (
                    <section
                      key={idx}
                      ref={(el) => { sectionRefs.current[idx] = el; }}
                      id={`section-${idx}`}
                      className="scroll-mt-24"
                    >
                      {section.heading && (
                        <h2 className="text-2xl font-bold text-stone-900 mb-4 pb-2 border-b border-stone-100">
                          {section.heading}
                        </h2>
                      )}
                      <div className="prose prose-stone prose-lg max-w-none">
                        {section.body.split('\n\n').map((paragraph, pIdx) => (
                          <p key={pIdx} className="text-stone-600 leading-relaxed mb-4 last:mb-0">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </section>
                  ))}
              </div>
            ) : (
              <p className="text-stone-500 italic">This post has no content yet.</p>
            )}
          </article>

          {/* Tags footer */}
          {post.tags && post.tags.length > 0 && (
            <div className="border-t border-stone-200 pt-6 pb-12">
              <p className="text-xs text-stone-400 uppercase tracking-widest mb-3 font-semibold">Tags</p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog?tag=${tag}`}
                    className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Comments section */}
          {post.allow_comments && (
            <section className="border-t border-stone-200 pt-12 pb-24" id="comments">
              <h2 className="text-2xl font-bold text-stone-900 mb-8">
                Comments
                {comments.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-stone-400">
                    ({comments.length + comments.reduce((n, c) => n + (c.replies?.length || 0), 0)})
                  </span>
                )}
              </h2>

              {/* New comment form */}
              {user ? (
                <div className="mb-10">
                  <div className="flex gap-3">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name || 'User avatar'} className="w-9 h-9 rounded-full flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600 flex-shrink-0">
                        {(user.full_name || user.email || 'U')[0]}
                      </div>
                    )}
                    <div className="flex-1">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Share your thoughts..."
                        rows={3}
                        className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none transition-colors"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => handleComment()}
                          disabled={!commentText.trim() || submitting}
                          className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                          {submitting ? 'Posting...' : 'Post Comment'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-10 rounded-xl bg-stone-100 p-6 text-center">
                  <p className="text-sm text-stone-600 mb-3">
                    Sign in to join the conversation
                  </p>
                  <Link
                    href={`/auth/login?redirect=/blog/${params.slug}`}
                    className="inline-block px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                  >
                    Sign In
                  </Link>
                </div>
              )}

              {/* Comments list */}
              {comments.length === 0 && (
                <p className="text-sm text-stone-400 text-center py-8">No comments yet. Be the first!</p>
              )}

              <div className="space-y-6">
                {comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    user={user}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    submitting={submitting}
                    onSetReplyingTo={setReplyingTo}
                    onSetReplyText={setReplyText}
                    onReply={(parentId) => handleComment(parentId)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Table of Contents — sticky sidebar */}
        {hasToC && (
          <aside className="hidden lg:block absolute right-0 top-0 w-64 pt-80">
            <div className="sticky top-24">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.15em] mb-4">
                In this post
              </p>
              <nav className="space-y-1">
                {sections
                  .sort((a, b) => a.order - b.order)
                  .map((section, idx) => (
                    section.heading && (
                      <button
                        key={idx}
                        onClick={() => scrollToSection(idx)}
                        className={`block w-full text-left text-sm py-1.5 pl-3 border-l-2 transition-all ${
                          activeSection === idx
                            ? 'border-brand-500 text-brand-600 font-medium'
                            : 'border-transparent text-stone-400 hover:text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        {section.heading}
                      </button>
                    )
                  ))}
              </nav>
            </div>
          </aside>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#faf9f7] border-t border-stone-200 py-10 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/blog" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
            ← Back to all posts
          </Link>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <Link href="/" className="hover:text-stone-900 transition-colors">Home</Link>
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

// ============================================================
// Comment component
// ============================================================

function CommentCard({
  comment,
  user,
  replyingTo,
  replyText,
  submitting,
  onSetReplyingTo,
  onSetReplyText,
  onReply,
}: {
  comment: BlogComment;
  user: Profile | null;
  replyingTo: string | null;
  replyText: string;
  submitting: boolean;
  onSetReplyingTo: (id: string | null) => void;
  onSetReplyText: (text: string) => void;
  onReply: (parentId: string) => void;
}) {
  const authorName = comment.author?.full_name || comment.author_name || 'Anonymous';
  const initials = authorName[0]?.toUpperCase() || '?';

  return (
    <div className="group">
      <div className="flex gap-3">
        {comment.author?.avatar_url ? (
          <img src={comment.author.avatar_url} alt={comment.author.full_name || 'Commenter avatar'} className="w-8 h-8 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600 flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-stone-800">{authorName}</span>
            <span className="text-xs text-stone-400">
              {timeAgo(comment.created_at)}
            </span>
            {comment.is_pinned && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 rounded">
                PINNED
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">
            {comment.content}
          </p>
          {/* Reply button */}
          {user && (
            <button
              onClick={() => onSetReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="mt-2 text-xs text-stone-400 hover:text-brand-600 transition-colors font-medium"
            >
              Reply
            </button>
          )}
          {/* Reply form */}
          {replyingTo === comment.id && (
            <div className="mt-3 flex gap-2">
              <textarea
                value={replyText}
                onChange={(e) => onSetReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={2}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none transition-colors"
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => onReply(comment.id)}
                  disabled={!replyText.trim() || submitting}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-md transition-colors"
                >
                  Reply
                </button>
                <button
                  onClick={() => { onSetReplyingTo(null); onSetReplyText(''); }}
                  className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {/* Nested replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-stone-100">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="flex gap-3">
                  {reply.author?.avatar_url ? (
                    <img src={reply.author.avatar_url} alt={reply.author.full_name || 'Reply author avatar'} className="w-6 h-6 rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-bold text-stone-600 flex-shrink-0">
                      {(reply.author?.full_name || reply.author_name || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-800">
                        {reply.author?.full_name || reply.author_name || 'Anonymous'}
                      </span>
                      <span className="text-xs text-stone-400">{timeAgo(reply.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-stone-600 whitespace-pre-wrap">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
