'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { ScriptContentViewer } from '@/components/ScreenplayRenderer';
import { formatDate, timeAgo, cn } from '@/lib/utils';
import { sendNotification } from '@/lib/notifications';
import { toast } from '@/components/ui';
import type { CommunityPost, CommunityComment, CommunityDistro, CommunityCategory, ScriptProduction, Profile } from '@/lib/types';

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

    // Store all comments flat for infinite nesting
    const allComments = commentsRes.data || [];
    setComments(allComments);
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
    // Notify post author on upvote (not on un-upvote)
    if (data && post.author_id !== user.id) {
      const actorName = (user as Profile)?.display_name || (user as Profile)?.full_name || 'Someone';
      sendNotification({
        userId: post.author_id,
        type: 'community_upvote',
        title: `${actorName} liked your post`,
        body: post.title,
        link: `/community/post/${post.slug}`,
        actorId: user.id,
        entityType: 'community_post',
        entityId: post.id,
      });
    }
  };

  const handleComment = async (parentId?: string) => {
    if (!user || !post) return;
    const content = parentId ? replyText.trim() : commentText.trim();
    if (!content) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const commentType = activeTab === 'suggestions' ? 'suggestion' : 'comment';
      const { data, error: commentError } = await supabase
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

      if (commentError) {
        toast.error('Failed to post comment: ' + commentError.message);
        setSubmitting(false);
        return;
      }

      if (data) {
        // Add to flat comments list (nesting handled by recursive component)
        setComments((prev) => [...prev, data]);
        if (parentId) {
          setReplyText('');
          setReplyingTo(null);
        } else {
          setCommentText('');
        }
        // Notify post author about the comment
        if (post.author_id !== user.id) {
          const actorName = (user as Profile)?.display_name || (user as Profile)?.full_name || 'Someone';
          sendNotification({
            userId: post.author_id,
            type: 'community_comment',
            title: `${actorName} commented on your post`,
            body: content.length > 120 ? content.slice(0, 120) + '…' : content,
            link: `/community/post/${post.slug}`,
            actorId: user.id,
            entityType: 'community_post',
            entityId: post.id,
          });
        }
        // If replying, notify parent comment author
        if (parentId) {
          const parentComment = comments.find((c) => c.id === parentId);
          if (parentComment && parentComment.author_id !== user.id && parentComment.author_id !== post.author_id) {
            const actorName = (user as Profile)?.display_name || (user as Profile)?.full_name || 'Someone';
            sendNotification({
              userId: parentComment.author_id,
              type: 'community_reply',
              title: `${actorName} replied to your comment`,
              body: content.length > 120 ? content.slice(0, 120) + '…' : content,
              link: `/community/post/${post.slug}`,
              actorId: user.id,
              entityType: 'community_comment',
              entityId: data.id,
            });
          }
        }
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
    if (!error) setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
  };

  const handleDeletePost = async () => {
    if (!post || !confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
    const supabase = createClient();
    const { error } = await supabase.from('community_posts').delete().eq('id', post.id);
    if (!error) router.push('/community');
  };

  const isMod = user?.role === 'moderator' || user?.role === 'admin';

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
    if (error) toast.error('Failed to create distro: ' + error.message);
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
    } catch (err: unknown) {
      toast.error('Failed to fork: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
    } catch (err: unknown) {
      toast.error('Failed to submit: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
      </div>
    );
  }

  // Not found
  if (!post) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <nav className="border-b border-white/10 bg-[#faf9f7]/90 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
            <Link href="/community" className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Community
            </Link>
          </div>
        </nav>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-3xl font-black text-white mb-2">Post not found</h1>
          <p className="text-white/40">This post may have been removed or doesn't exist.</p>
          <Link href="/community" className="mt-8 px-6 py-3 bg-[#E54E15] text-white font-medium rounded-lg">Browse Community</Link>
        </div>
      </div>
    );
  }

  const filteredComments = comments.filter((c) =>
    !c.parent_id && (activeTab === 'suggestions' ? c.comment_type === 'suggestion' : c.comment_type === 'comment')
  );

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
            <Link href="/community" className="text-[11px] font-mono uppercase tracking-widest text-white" style={{ borderBottom: '1px solid #FF5F1F', paddingBottom: '2px' }}>Feed</Link>
            <Link href="/community/showcase" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Showcase</Link>
            <Link href="/community/challenges" className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Challenges</Link>
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
              <Link href={`/auth/login?redirect=/community/post/${params.slug}`} className="text-[11px] font-mono uppercase tracking-widest text-white/45 hover:text-white transition-colors">Sign In</Link>
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

          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{post.title}</h1>
          {post.description && <p className="mt-3 text-lg text-white/40">{post.description}</p>}

          {/* Author & meta */}
          <div className="mt-6 flex items-center justify-between pb-6 border-b border-white/10">
            <Link
              href={`/u/${post.author?.username || post.author?.id || ''}`}
              className="flex items-center gap-3 group"
            >
              {post.author?.avatar_url ? (
                <img src={post.author.avatar_url} alt={post.author.full_name || 'Author avatar'} className="w-10 h-10 rounded-full group-hover:ring-2 ring-[#FF5F1F] transition-all" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#FF5F1F]/15 flex items-center justify-center text-sm font-bold text-[#FF5F1F] group-hover:ring-2 ring-[#FF5F1F] transition-all">
                  {(post.author?.full_name || 'A')[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white/90 group-hover:text-[#FF5F1F] transition-colors">{post.author?.full_name || 'Anonymous'}</p>
                <p className="text-xs text-white/50">{formatDate(post.created_at)} · {post.view_count} views</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {/* DM button */}
              {user && post.author_id !== user.id && (
                <Link
                  href={`/u/${post.author?.username || post.author?.id || ''}`}
                  className="px-3 py-2 text-xs font-medium text-white/60 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Profile
                </Link>
              )}

              {/* Upvote */}
              <button
                onClick={handleUpvote}
                disabled={!user}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  hasUpvoted
                    ? 'border-[#FF5F1F]/40 bg-[#FF5F1F]/10 text-[#E54E15]'
                    : 'border-white/10 bg-surface-900 text-white/60 hover:border-white/15'
                } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <svg className="w-4 h-4" fill={hasUpvoted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                <span className="text-sm font-semibold">{post.upvote_count}</span>
              </button>

              {/* Delete post — owner or mod/admin */}
              {user && (user.id === post.author_id || isMod) && (
                <button
                  onClick={handleDeletePost}
                  className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1.5 border border-red-200"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  {user.id !== post.author_id ? 'Remove (mod)' : 'Delete'}
                </button>
              )}

              {/* Report */}
              {user && user.id !== post.author_id && (
                <Link
                  href={`/support?type=community_post&id=${post.id}&subject=${encodeURIComponent(`Report post: ${post.title}`)}`}
                  className="px-3 py-2 text-xs font-medium text-white/50 hover:text-white/60 bg-surface-900 hover:bg-surface-800 rounded-lg transition-colors flex items-center gap-1.5 border border-white/10"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                  Report
                </Link>
              )}
            </div>
          </div>

          {/* Permission badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {post.allow_free_use && <span className="px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50 rounded-full border border-green-200">📖 Free to Use</span>}
            {post.allow_distros && <span className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full border border-blue-200">🔀 Distros Allowed</span>}
            {post.allow_edits && <span className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 rounded-full border border-purple-200">✏️ Open to Edits</span>}
            {post.allow_comments && <span className="px-2.5 py-1 text-xs font-semibold text-white/60 bg-surface-800 rounded-full border border-white/10">💬 Comments On</span>}
            {post.allow_suggestions && <span className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full border border-amber-200">💡 Suggestions On</span>}
          </div>
        </header>

        {/* Cover image */}
        {post.cover_image_url && (
          <div className="rounded-xl overflow-hidden mb-8 max-h-72">
            <img src={post.cover_image_url} alt={post.title || 'Post cover'} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Script content */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Script</h2>
            <button
              onClick={() => setShowScript(!showScript)}
              className="text-xs text-[#FF5F1F] hover:text-[#E54E15] font-medium transition-colors"
            >
              {showScript ? 'Collapse' : 'Expand Full Script'}
            </button>
          </div>
          <div
            className={`rounded-xl border border-white/10 bg-surface-900 p-6 overflow-hidden transition-all ${
              showScript ? 'max-h-none' : 'max-h-96'
            }`}
          >
            {post.script_content ? (
              <ScriptContentViewer content={post.script_content} />
            ) : (
              <p className="text-sm text-white/50 italic">No script content.</p>
            )}
          </div>
          {!showScript && post.script_content && post.script_content.length > 1500 && (
            <div className="relative -mt-16 pt-16 bg-gradient-to-t from-[#faf9f7] to-transparent">
              <button
                onClick={() => setShowScript(true)}
                className="w-full py-3 text-sm font-medium text-[#FF5F1F] hover:text-[#E54E15] transition-colors"
              >
                Read full script ↓
              </button>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="flex flex-wrap gap-3 mb-10 pb-8 border-b border-white/10">
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
              className="px-4 py-2 text-sm font-medium text-white/60 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
            >
              🔗 Share
            </button>
            {shareTooltip && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white bg-surface-700 rounded shadow whitespace-nowrap">
                Link copied!
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-800 rounded-lg p-1 w-fit">
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
                activeTab === tab.key ? 'bg-surface-900 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
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
              <div className="mb-8 rounded-xl border border-white/10 bg-surface-900 p-5">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={activeTab === 'suggestions' ? 'Share a suggestion for improvement...' : 'Write a comment...'}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-surface-900 px-4 py-3 text-sm text-white/90 placeholder:text-white/30 focus:border-[#FF5F1F] focus:outline-none resize-none transition-colors"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleComment()}
                    disabled={!commentText.trim() || submitting}
                    className="px-5 py-2 text-sm font-medium text-white bg-[#E54E15] hover:bg-[#CC4312] disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {submitting ? 'Posting...' : activeTab === 'suggestions' ? 'Submit Suggestion' : 'Post Comment'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-8 rounded-xl bg-surface-800 p-6 text-center">
                <p className="text-sm text-white/60 mb-3">Sign in to join the conversation</p>
                <Link href={`/auth/login?redirect=/community/post/${params.slug}`} className="inline-block px-5 py-2 text-sm font-medium text-white bg-[#E54E15] rounded-lg">Sign In</Link>
              </div>
            )}

            {filteredComments.length === 0 && (
              <p className="text-sm text-white/50 text-center py-8">No {activeTab} yet. Be the first!</p>
            )}

            <div className="space-y-4">
              {filteredComments.map((comment) => (
                <CommunityCommentThread
                  key={comment.id}
                  comment={comment}
                  allComments={comments}
                  depth={0}
                  user={user}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  submitting={submitting}
                  handleComment={handleComment}
                  onDelete={handleDeleteComment}
                  isMod={isMod}
                />
              ))}
            </div>
          </div>
        )}

        {/* Distros */}
        {activeTab === 'distros' && (
          <div>
            {distros.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white/50 text-sm mb-3">No distros yet.</p>
                {user && post.allow_distros && (
                  <button onClick={handleCreateDistro} className="px-5 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg border border-blue-200">
                    Create First Distro
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {distros.map((distro) => (
                  <div key={distro.id} className="rounded-xl border border-white/10 bg-surface-900 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{distro.title}</h4>
                        {distro.description && <p className="text-xs text-white/40 mt-1">{distro.description}</p>}
                        <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                          <span>by <Link href={`/u/${distro.author?.username || distro.author?.id || ''}`} className="hover:text-white/70 transition-colors">{distro.author?.full_name || 'Anonymous'}</Link></span>
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
                <p className="text-white/50 text-sm mb-1">No productions yet.</p>
                <p className="text-xs text-white/50">Filmmakers can submit movies they've made based on this script.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {productions.map((prod) => (
                  <a key={prod.id} href={prod.url || '#'} target="_blank" rel="noopener noreferrer"
                    className="rounded-xl border border-white/10 bg-surface-900 p-5 hover:border-white/15 hover:shadow-sm transition-all block"
                  >
                    {prod.thumbnail_url && (
                      <div className="rounded-lg overflow-hidden mb-3 h-32">
                        <img src={prod.thumbnail_url} alt={prod.title || 'Production thumbnail'} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <h4 className="text-sm font-semibold text-white">{prod.title}</h4>
                    {prod.description && <p className="text-xs text-white/40 mt-1 line-clamp-2">{prod.description}</p>}
                    <div className="text-xs text-white/50 mt-2">
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
          <div className="bg-surface-900 rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            {filmSubmitted ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">🎬</div>
                <h3 className="text-xl font-black text-white mb-2">Film Submitted!</h3>
                <p className="text-sm text-white/40 mb-6">Your film has been sent for review. You'll be notified once it's approved.</p>
                <button onClick={() => { setShowFilmModal(false); setFilmSubmitted(false); }}
                  className="px-6 py-2 text-sm font-medium text-white bg-[#E54E15] rounded-lg hover:bg-[#CC4312] transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-1">Submit Your Film</h3>
                <p className="text-sm text-white/40 mb-5">
                  Made a film based on this script? Submit it for review — once approved, it'll appear on this page and the original creator will be notified.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Film Title *</label>
                    <input
                      value={filmTitle} onChange={(e) => setFilmTitle(e.target.value)}
                      placeholder="My Short Film"
                      className="w-full rounded-lg border border-white/10 bg-surface-900 px-3 py-2 text-sm text-white/90 focus:border-[#FF5F1F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
                    <textarea
                      value={filmDesc} onChange={(e) => setFilmDesc(e.target.value)}
                      placeholder="Tell us about your production..."
                      rows={3}
                      className="w-full rounded-lg border border-white/10 bg-surface-900 px-3 py-2 text-sm text-white/90 focus:border-[#FF5F1F] focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Video URL (YouTube, Vimeo, etc.)</label>
                    <input
                      value={filmUrl} onChange={(e) => setFilmUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full rounded-lg border border-white/10 bg-surface-900 px-3 py-2 text-sm text-white/90 focus:border-[#FF5F1F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Thumbnail URL (optional)</label>
                    <input
                      value={filmThumb} onChange={(e) => setFilmThumb(e.target.value)}
                      placeholder="https://example.com/thumbnail.jpg"
                      className="w-full rounded-lg border border-white/10 bg-surface-900 px-3 py-2 text-sm text-white/90 focus:border-[#FF5F1F] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowFilmModal(false)}
                    className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white/90 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitFilm}
                    disabled={!filmTitle.trim() || submittingFilm}
                    className="px-5 py-2 text-sm font-medium text-white bg-[#E54E15] hover:bg-[#CC4312] disabled:opacity-50 rounded-lg transition-colors"
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
      <footer className="bg-[#faf9f7] border-t border-white/10 py-10 px-6 mt-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/community" className="text-sm text-white/40 hover:text-white transition-colors">← Back to Community</Link>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}

// Recursive comment thread component for infinite nesting
function CommunityCommentThread({ comment, allComments, depth, user, replyingTo, setReplyingTo, replyText, setReplyText, submitting, handleComment, onDelete, isMod }: {
  comment: CommunityComment;
  allComments: CommunityComment[];
  depth: number;
  user: Profile | null;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  replyText: string;
  setReplyText: (text: string) => void;
  submitting: boolean;
  handleComment: (parentId?: string) => void;
  onDelete?: (id: string) => void;
  isMod?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const replies = allComments.filter(c => c.parent_id === comment.id);
  const maxIndent = 5;
  const isRoot = depth === 0;

  return (
    <div className={cn(!isRoot && 'ml-4 sm:ml-6')}>
      <div className={cn(
        isRoot ? 'rounded-xl border border-white/10 bg-surface-900 p-5' : 'pt-3',
      )}>
        <div className="flex items-start gap-3">
          <Link href={`/u/${comment.author?.username || comment.author?.id || ''}`}>
            {comment.author?.avatar_url ? (
              <img src={comment.author.avatar_url} alt={comment.author.full_name || 'Commenter avatar'} className={cn(isRoot ? 'w-8 h-8' : 'w-6 h-6', 'rounded-full hover:ring-2 ring-[#FF5F1F] transition-all')} />
            ) : (
              <div className={cn(isRoot ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[9px]', 'rounded-full bg-surface-700 flex items-center justify-center font-bold text-white/40 hover:ring-2 ring-[#FF5F1F] transition-all')}>
                {(comment.author?.full_name || '?')[0]}
              </div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/u/${comment.author?.username || comment.author?.id || ''}`} className={cn(isRoot ? 'text-sm' : 'text-xs', 'font-semibold text-white/90 hover:text-[#FF5F1F] transition-colors')}>{comment.author?.full_name || 'Anonymous'}</Link>
              {comment.author?.role === 'moderator' && <span className="px-1 py-0.5 text-[8px] font-bold text-green-700 bg-green-50 rounded border border-green-200">MOD</span>}
              {comment.author?.role === 'admin' && <span className="px-1 py-0.5 text-[8px] font-bold text-red-700 bg-red-50 rounded border border-red-200">ADMIN</span>}
              <span className="text-[10px] text-white/50">{timeAgo(comment.created_at)}</span>
              {comment.comment_type === 'suggestion' && (
                <span className="px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 bg-amber-50 rounded">Suggestion</span>
              )}
            </div>
            <p className={cn(isRoot ? 'text-sm' : 'text-xs', 'text-white/70 mt-1 whitespace-pre-wrap')}>{comment.content}</p>
            <div className="flex items-center gap-3 mt-1">
              {user && (
                <button
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="text-xs text-[#FF5F1F] hover:text-[#E54E15] transition-colors"
                >
                  Reply
                </button>
              )}
              {user && onDelete && (user.id === comment.author_id || isMod) && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                >
                  {user.id !== comment.author_id && <span className="text-[9px] font-semibold text-amber-600">MOD</span>}
                  Delete
                </button>
              )}
              {replies.length > 0 && (
                <button onClick={() => setCollapsed(!collapsed)} className="text-[10px] text-white/50 hover:text-white/70 transition-colors">
                  {collapsed ? `Show ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : replies.length > 2 ? `Hide replies` : ''}
                </button>
              )}
            </div>

            {/* Reply form */}
            {replyingTo === comment.id && (
              <div className="mt-3 flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm focus:border-[#FF5F1F] focus:outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleComment(comment.id); }}
                />
                <button
                  onClick={() => handleComment(comment.id)}
                  disabled={!replyText.trim() || submitting}
                  className="px-3 py-2 text-sm font-medium text-white bg-[#E54E15] rounded-lg disabled:opacity-50"
                >Reply</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {!collapsed && replies.length > 0 && (
        <div className={cn(depth < maxIndent ? 'border-l-2 border-white/07 ml-4 pl-0' : '')}>
          {replies.map(reply => (
            <CommunityCommentThread
              key={reply.id}
              comment={reply}
              allComments={allComments}
              depth={depth + 1}
              user={user}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              replyText={replyText}
              setReplyText={setReplyText}
              submitting={submitting}
              handleComment={handleComment}
              onDelete={onDelete}
              isMod={isMod}
            />
          ))}
        </div>
      )}
    </div>
  );
}
