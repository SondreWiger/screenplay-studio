'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { ScriptContentViewer } from '@/components/ScreenplayRenderer';
import { formatDate, timeAgo } from '@/lib/utils';
import type { CommunityPost, CommunityComment, CommunityDistro, CommunityCategory, ScriptProduction } from '@/lib/types';

// ============================================================
// Post Detail — view a community-shared script
// ============================================================

export default function PostDetailPage({ params }: { params: { slug: string } }) {
  const { user } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [distros, setDistros] = useState<CommunityDistro[]>([]);
  const [productions, setProductions] = useState<ScriptProduction[]>([]);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'comments' | 'suggestions' | 'distros' | 'productions'>('comments');
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [forking, setForking] = useState(false);
  const [showFilmModal, setShowFilmModal] = useState(false);
  const [filmTitle, setFilmTitle] = useState('');
  const [filmDesc, setFilmDesc] = useState('');
  const [filmUrl, setFilmUrl] = useState('');
  const [filmThumb, setFilmThumb] = useState('');
  const [submittingFilm, setSubmittingFilm] = useState(false);
  const [filmSubmitted, setFilmSubmitted] = useState(false);
  const [shareTooltip, setShareTooltip] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [params.slug]);

  const fetchPost = async () => {
    const supabase = createClient();

    // Fetch post
    const { data: postData, error } = await supabase
      .from('community_posts')
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

    // Increment view count
    supabase.from('community_posts').update({ view_count: (postData.view_count || 0) + 1 }).eq('id', postData.id).then(() => {});

    // Parallel fetches
    const postId = postData.id;
    const [catsRes, commentsRes, distrosRes, prodRes, upvoteRes] = await Promise.all([
      supabase.from('community_post_categories').select('category:community_categories(*)').eq('post_id', postId),
      supabase.from('community_comments').select('*, author:profiles!author_id(*)').eq('post_id', postId).eq('is_hidden', false).order('created_at'),
      supabase.from('community_distros').select('*, author:profiles!author_id(*)').eq('original_post_id', postId).order('created_at', { ascending: false }),
      postData.allow_free_use
        ? supabase.from('script_productions').select('*, submitter:profiles!submitter_id(*)').eq('post_id', postId).eq('status', 'approved').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from('community_upvotes').select('user_id').eq('post_id', postId).eq('user_id', user.id).limit(1)
        : Promise.resolve({ data: [] }),
    ]);

    setCategories((catsRes.data || []).map((j: any) => j.category));

    // Thread comments
    const allComments = commentsRes.data || [];
    const topLevel = allComments.filter((c: any) => !c.parent_id);
    topLevel.forEach((c: any) => {
      c.replies = allComments.filter((r: any) => r.parent_id === c.id);
    });
    setComments(topLevel);
    setDistros(distrosRes.data || []);
    setProductions(prodRes.data || []);
    setHasUpvoted((upvoteRes.data || []).length > 0);
    setLoading(false);
  };

  const handleUpvote = async () => {
    if (!user || !post) return;
    const supabase = createClient();
    const { data } = await supabase.rpc('toggle_community_upvote', { p_post_id: post.id });
    setHasUpvoted(!!data);
    setPost((prev) => prev ? { ...prev, upvote_count: prev.upvote_count + (data ? 1 : -1) } : prev);
  };

  const handleComment = async (parentId?: string) => {
    if (!user || !post) return;
    const content = parentId ? replyText.trim() : commentText.trim();
    if (!content) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const commentType = activeTab === 'suggestions' ? 'suggestion' : 'comment';
      const { data } = await supabase
        .from('community_comments')
        .insert({
          post_id: post.id,
          parent_id: parentId || null,
          author_id: user.id,
          content,
          comment_type: commentType,
        })
        .select('*, author:profiles!author_id(*)')
        .single();

      if (data) {
        if (parentId) {
          setComments((prev) =>
            prev.map((c) => c.id === parentId ? { ...c, replies: [...(c.replies || []), data] } : c)
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

  const handleCreateDistro = async () => {
    if (!user || !post) return;
    const distroTitle = prompt('Name your distro:', `${post.title} (fork)`);
    if (!distroTitle) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from('community_distros')
      .insert({
        original_post_id: post.id,
        author_id: user.id,
        title: distroTitle,
        description: `Fork of "${post.title}"`,
        script_content: post.script_content,
      })
      .select('*, author:profiles!author_id(*)')
      .single();

    if (data) {
      setDistros((prev) => [data, ...prev]);
    }
    if (error) alert('Failed to create distro: ' + error.message);
  };

  const handleForkToProject = async () => {
    if (!user || !post) return;
    const title = prompt('Project title:', post.title);
    if (!title) return;

    setForking(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('fork_community_script_to_project', {
        p_post_id: post.id,
        p_user_id: user.id,
        p_title: title,
      });

      if (error) throw error;
      if (data) {
        router.push(`/projects/${data}`);
      }
    } catch (err: any) {
      alert('Failed to fork: ' + (err?.message || 'Unknown error'));
    } finally {
      setForking(false);
    }
  };

  const handleSubmitFilm = async () => {
    if (!user || !post || !filmTitle.trim()) return;
    setSubmittingFilm(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('script_productions').insert({
        post_id: post.id,
        submitter_id: user.id,
        title: filmTitle.trim(),
        description: filmDesc.trim() || null,
        url: filmUrl.trim() || null,
        thumbnail_url: filmThumb.trim() || null,
        share_url: window.location.href,
        status: 'pending',
      });
      if (error) throw error;
      setFilmSubmitted(true);
      setFilmTitle(''); setFilmDesc(''); setFilmUrl(''); setFilmThumb('');
    } catch (err: any) {
      alert('Failed to submit: ' + (err?.message || 'Unknown error'));
    } finally {
      setSubmittingFilm(false);
    }
  };

  const handleShareLink = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: post?.title || 'Screenplay', url });
    } else {
      navigator.clipboard.writeText(url);
      setShareTooltip(true);
      setTimeout(() => setShareTooltip(false), 2000);
    }
  };

  // Loading
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
            <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Community
            </Link>
          </div>
        </nav>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Post not found</h1>
          <p className="text-stone-500">This post may have been removed or doesn't exist.</p>
          <Link href="/community" className="mt-8 px-6 py-3 bg-brand-600 text-white font-medium rounded-lg">Browse Community</Link>
        </div>
      </div>
    );
  }

  const filteredComments = comments.filter((c) =>
    activeTab === 'suggestions' ? c.comment_type === 'suggestion' : c.comment_type === 'comment'
  );

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#faf9f7]/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Community
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/dashboard" className="text-xs text-stone-500 hover:text-stone-900 transition-colors">Dashboard</Link>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600">
                    {(user.full_name || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
              </>
            ) : (
              <Link href={`/auth/login?redirect=/community/post/${params.slug}`} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Sign In</Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-8">
          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map((cat) => (
                <span
                  key={cat.id}
                  className="px-2.5 py-0.5 text-xs font-semibold rounded-full"
                  style={{ color: cat.color || '#6b7280', backgroundColor: (cat.color || '#6b7280') + '15' }}
                >
                  {cat.icon} {cat.name}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">{post.title}</h1>
          {post.description && <p className="mt-3 text-lg text-stone-500">{post.description}</p>}

          {/* Author & meta */}
          <div className="mt-6 flex items-center justify-between pb-6 border-b border-stone-200">
            <div className="flex items-center gap-3">
              {post.author?.avatar_url ? (
                <img src={post.author.avatar_url} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-600">
                  {(post.author?.full_name || 'A')[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-stone-800">{post.author?.full_name || 'Anonymous'}</p>
                <p className="text-xs text-stone-400">{formatDate(post.created_at)} · {post.view_count} views</p>
              </div>
            </div>

            {/* Upvote */}
            <button
              onClick={handleUpvote}
              disabled={!user}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                hasUpvoted
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
              } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <svg className="w-4 h-4" fill={hasUpvoted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
              <span className="text-sm font-semibold">{post.upvote_count}</span>
            </button>
          </div>

          {/* Permission badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {post.allow_free_use && <span className="px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50 rounded-full border border-green-200">📖 Free to Use</span>}
            {post.allow_distros && <span className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full border border-blue-200">🔀 Distros Allowed</span>}
            {post.allow_edits && <span className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 rounded-full border border-purple-200">✏️ Open to Edits</span>}
            {post.allow_comments && <span className="px-2.5 py-1 text-xs font-semibold text-stone-600 bg-stone-100 rounded-full border border-stone-200">💬 Comments On</span>}
            {post.allow_suggestions && <span className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full border border-amber-200">💡 Suggestions On</span>}
          </div>
        </header>

        {/* Cover image */}
        {post.cover_image_url && (
          <div className="rounded-xl overflow-hidden mb-8 max-h-72">
            <img src={post.cover_image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Script content */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-stone-900">Script</h2>
            <button
              onClick={() => setShowScript(!showScript)}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
            >
              {showScript ? 'Collapse' : 'Expand Full Script'}
            </button>
          </div>
          <div
            className={`rounded-xl border border-stone-200 bg-white p-6 overflow-hidden transition-all ${
              showScript ? 'max-h-none' : 'max-h-96'
            }`}
          >
            {post.script_content ? (
              <ScriptContentViewer content={post.script_content} />
            ) : (
              <p className="text-sm text-stone-400 italic">No script content.</p>
            )}
          </div>
          {!showScript && post.script_content && post.script_content.length > 1500 && (
            <div className="relative -mt-16 pt-16 bg-gradient-to-t from-[#faf9f7] to-transparent">
              <button
                onClick={() => setShowScript(true)}
                className="w-full py-3 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                Read full script ↓
              </button>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="flex flex-wrap gap-3 mb-10 pb-8 border-b border-stone-200">
          {post.allow_distros && user && (
            <button
              onClick={handleCreateDistro}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
            >
              🔀 Create Distro
            </button>
          )}
          {user && post.script_content && (
            <button
              onClick={handleForkToProject}
              disabled={forking}
              className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors disabled:opacity-50"
            >
              {forking ? '⏳ Forking...' : '📂 Fork to Project'}
            </button>
          )}
          {post.allow_free_use && (
            <button
              onClick={() => setActiveTab('productions')}
              className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
            >
              🎬 Productions ({productions.length})
            </button>
          )}
          {post.allow_free_use && user && (
            <button
              onClick={() => setShowFilmModal(true)}
              className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              🎥 Submit Your Film
            </button>
          )}
          <div className="relative">
            <button
              onClick={handleShareLink}
              className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              🔗 Share
            </button>
            {shareTooltip && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white bg-stone-800 rounded shadow whitespace-nowrap">
                Link copied!
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-stone-100 rounded-lg p-1 w-fit">
          {[
            ...(post.allow_comments ? [{ key: 'comments' as const, label: `Comments (${comments.filter(c => c.comment_type === 'comment').length})` }] : []),
            ...(post.allow_suggestions ? [{ key: 'suggestions' as const, label: `Suggestions (${comments.filter(c => c.comment_type === 'suggestion').length})` }] : []),
            ...(post.allow_distros ? [{ key: 'distros' as const, label: `Distros (${distros.length})` }] : []),
            ...(post.allow_free_use ? [{ key: 'productions' as const, label: `Productions (${productions.length})` }] : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Comments / Suggestions */}
        {(activeTab === 'comments' || activeTab === 'suggestions') && (
          <div>
            {user ? (
              <div className="mb-8 rounded-xl border border-stone-200 bg-white p-5">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={activeTab === 'suggestions' ? 'Share a suggestion for improvement...' : 'Write a comment...'}
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none resize-none transition-colors"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleComment()}
                    disabled={!commentText.trim() || submitting}
                    className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {submitting ? 'Posting...' : activeTab === 'suggestions' ? 'Submit Suggestion' : 'Post Comment'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-8 rounded-xl bg-stone-100 p-6 text-center">
                <p className="text-sm text-stone-600 mb-3">Sign in to join the conversation</p>
                <Link href={`/auth/login?redirect=/community/post/${params.slug}`} className="inline-block px-5 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg">Sign In</Link>
              </div>
            )}

            {filteredComments.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-8">No {activeTab} yet. Be the first!</p>
            )}

            <div className="space-y-4">
              {filteredComments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-stone-200 bg-white p-5">
                  <div className="flex items-start gap-3">
                    {comment.author?.avatar_url ? (
                      <img src={comment.author.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-500">
                        {(comment.author?.full_name || '?')[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-stone-800">{comment.author?.full_name || 'Anonymous'}</span>
                        <span className="text-xs text-stone-400">{timeAgo(comment.created_at)}</span>
                        {comment.comment_type === 'suggestion' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 bg-amber-50 rounded">Suggestion</span>
                        )}
                      </div>
                      <p className="text-sm text-stone-700 mt-1 whitespace-pre-wrap">{comment.content}</p>
                      {user && (
                        <button
                          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                          className="text-xs text-brand-600 hover:text-brand-700 mt-2 transition-colors"
                        >
                          Reply
                        </button>
                      )}

                      {/* Reply form */}
                      {replyingTo === comment.id && (
                        <div className="mt-3 flex gap-2">
                          <input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleComment(comment.id); }}
                          />
                          <button
                            onClick={() => handleComment(comment.id)}
                            disabled={!replyText.trim() || submitting}
                            className="px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg disabled:opacity-50"
                          >Reply</button>
                        </div>
                      )}

                      {/* Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-4 ml-4 pl-4 border-l-2 border-stone-100 space-y-3">
                          {comment.replies.map((reply: CommunityComment) => (
                            <div key={reply.id} className="flex items-start gap-2">
                              {reply.author?.avatar_url ? (
                                <img src={reply.author.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-[9px] font-bold text-stone-500">
                                  {(reply.author?.full_name || '?')[0]}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-stone-700">{reply.author?.full_name}</span>
                                  <span className="text-[10px] text-stone-400">{timeAgo(reply.created_at)}</span>
                                </div>
                                <p className="text-xs text-stone-600 mt-0.5">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distros */}
        {activeTab === 'distros' && (
          <div>
            {distros.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-stone-400 text-sm mb-3">No distros yet.</p>
                {user && post.allow_distros && (
                  <button onClick={handleCreateDistro} className="px-5 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg border border-blue-200">
                    Create First Distro
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {distros.map((distro) => (
                  <div key={distro.id} className="rounded-xl border border-stone-200 bg-white p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-stone-900">{distro.title}</h4>
                        {distro.description && <p className="text-xs text-stone-500 mt-1">{distro.description}</p>}
                        <div className="flex items-center gap-2 mt-2 text-xs text-stone-400">
                          <span>by {distro.author?.full_name || 'Anonymous'}</span>
                          <span>·</span>
                          <span>{timeAgo(distro.created_at)}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 rounded-full">Distro</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Productions */}
        {activeTab === 'productions' && (
          <div>
            {productions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-stone-400 text-sm mb-1">No productions yet.</p>
                <p className="text-xs text-stone-400">Filmmakers can submit movies they've made based on this script.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {productions.map((prod) => (
                  <a key={prod.id} href={prod.url || '#'} target="_blank" rel="noopener noreferrer"
                    className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-300 hover:shadow-sm transition-all block"
                  >
                    {prod.thumbnail_url && (
                      <div className="rounded-lg overflow-hidden mb-3 h-32">
                        <img src={prod.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <h4 className="text-sm font-semibold text-stone-900">{prod.title}</h4>
                    {prod.description && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{prod.description}</p>}
                    <div className="text-xs text-stone-400 mt-2">
                      by {prod.submitter?.full_name || 'Anonymous'} · {formatDate(prod.created_at)}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Film Submission Modal */}
      {showFilmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowFilmModal(false); setFilmSubmitted(false); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            {filmSubmitted ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">🎬</div>
                <h3 className="text-xl font-bold text-stone-900 mb-2">Film Submitted!</h3>
                <p className="text-sm text-stone-500 mb-6">Your film has been sent for review. You'll be notified once it's approved.</p>
                <button onClick={() => { setShowFilmModal(false); setFilmSubmitted(false); }}
                  className="px-6 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-stone-900 mb-1">Submit Your Film</h3>
                <p className="text-sm text-stone-500 mb-5">
                  Made a film based on this script? Submit it for review — once approved, it'll appear on this page and the original creator will be notified.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Film Title *</label>
                    <input
                      value={filmTitle} onChange={(e) => setFilmTitle(e.target.value)}
                      placeholder="My Short Film"
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                    <textarea
                      value={filmDesc} onChange={(e) => setFilmDesc(e.target.value)}
                      placeholder="Tell us about your production..."
                      rows={3}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:border-brand-400 focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Video URL (YouTube, Vimeo, etc.)</label>
                    <input
                      value={filmUrl} onChange={(e) => setFilmUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Thumbnail URL (optional)</label>
                    <input
                      value={filmThumb} onChange={(e) => setFilmThumb(e.target.value)}
                      placeholder="https://example.com/thumbnail.jpg"
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowFilmModal(false)}
                    className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitFilm}
                    disabled={!filmTitle.trim() || submittingFilm}
                    className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {submittingFilm ? 'Submitting...' : 'Submit for Review'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#faf9f7] border-t border-stone-200 py-10 px-6 mt-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">← Back to Community</Link>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <Link href="/" className="hover:text-stone-900 transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-stone-900 transition-colors">Blog</Link>
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}
