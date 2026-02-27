'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, LoadingPage, Avatar, Textarea, toast } from '@/components/ui';
import { timeAgo } from '@/lib/utils';
import type { Company, CompanyBlogPost, CompanyBlogComment, Profile } from '@/lib/types';

export default function CompanyBlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const postSlug = params.postSlug as string;
  const { user } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [post, setPost] = useState<CompanyBlogPost | null>(null);
  const [comments, setComments] = useState<(CompanyBlogComment & { author?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPost();
  }, [slug, postSlug]);

  const loadPost = async () => {
    const supabase = createClient();

    const { data: co, error: coError } = await supabase
      .from('companies')
      .select('*')
      .eq('slug', slug)
      .single();

    if (coError || !co) {
      if (coError) toast.error('Failed to load company');
      setLoading(false);
      return;
    }
    setCompany(co);

    const { data: blogPost, error: postError } = await supabase
      .from('company_blog_posts')
      .select('*, author:profiles!author_id(*)')
      .eq('company_id', co.id)
      .eq('slug', postSlug)
      .single();

    if (postError || !blogPost) {
      if (postError) toast.error('Failed to load blog post');
      setLoading(false);
      return;
    }
    setPost(blogPost);

    // Increment view count
    await supabase.from('company_blog_posts')
      .update({ view_count: (blogPost.view_count || 0) + 1 })
      .eq('id', blogPost.id);

    // Load comments
    const { data: cmts } = await supabase
      .from('company_blog_comments')
      .select('*, author:profiles!author_id(*)')
      .eq('post_id', blogPost.id)
      .order('created_at', { ascending: true });

    setComments(cmts || []);
    setLoading(false);
  };

  const submitComment = async () => {
    if (!user || !post || !commentText.trim()) return;
    setSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase.from('company_blog_comments').insert({
      post_id: post.id,
      author_id: user.id,
      content: commentText.trim(),
    });

    if (!error) {
      setCommentText('');
      loadPost();
    }
    setSubmitting(false);
  };

  const deleteComment = async (commentId: string) => {
    const supabase = createClient();
    await supabase.from('company_blog_comments').delete().eq('id', commentId);
    loadPost();
  };

  if (loading) return <LoadingPage />;

  if (!company || !post) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-surface-400 mb-4">Post not found.</p>
          <Link href={`/company/${slug}/blog`} className="text-brand-400 hover:underline text-sm">
            ← Back to blog
          </Link>
        </div>
      </div>
    );
  }

  const author = (post as any).author as Profile | undefined;

  // Simple Markdown-like rendering: paragraphs, bold, italic, headers
  const renderContent = (content: string) => {
    return content.split('\n\n').map((block, i) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith('### ')) {
        return <h3 key={i} className="text-lg font-semibold text-white mt-6 mb-2">{trimmed.slice(4)}</h3>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={i} className="text-xl font-bold text-white mt-8 mb-3">{trimmed.slice(3)}</h2>;
      }
      if (trimmed.startsWith('# ')) {
        return <h1 key={i} className="text-2xl font-bold text-white mt-8 mb-3">{trimmed.slice(2)}</h1>;
      }

      // Process inline bold/italic
      const processInline = (text: string) => {
        return text
          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>');
      };

      return (
        <p
          key={i}
          className="text-surface-300 leading-relaxed mb-4"
          dangerouslySetInnerHTML={{ __html: processInline(trimmed) }}
        />
      );
    });
  };

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-950">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <Link href={`/company/${slug}/blog`} className="text-sm text-surface-400 hover:text-white transition-colors flex items-center gap-1 mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            {company.name} Blog
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-8">
        {/* Cover */}
        {post.cover_image_url && (
          <img src={post.cover_image_url} alt={post.title || 'Blog post cover'} className="w-full h-64 object-cover rounded-xl mb-8" />
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {post.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-surface-800 text-surface-400 font-medium">{tag}</span>
          ))}
        </div>

        <h1 className="text-3xl font-bold text-white leading-tight">{post.title}</h1>

        {/* Author row */}
        <div className="flex items-center gap-3 mt-6 mb-8 pb-6 border-b border-surface-800">
          <Avatar src={author?.avatar_url} name={author?.display_name || author?.full_name} size="md" />
          <div>
            <p className="text-sm font-medium text-white">{author?.display_name || author?.full_name || 'Unknown'}</p>
            <p className="text-xs text-surface-500">
              {post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
              {' · '}{post.view_count} views
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="prose-custom">
          {renderContent(post.content)}
        </div>

        {/* Comments */}
        {post.allow_comments && (
          <div className="mt-12 pt-8 border-t border-surface-800">
            <h2 className="text-lg font-semibold text-white mb-6">Comments ({comments.length})</h2>

            {user ? (
              <div className="mb-8">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts..."
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <Button onClick={submitComment} loading={submitting} disabled={!commentText.trim()}>
                    Post Comment
                  </Button>
                </div>
              </div>
            ) : (
              <Card className="p-6 text-center mb-8">
                <p className="text-sm text-surface-400">
                  <Link href={`/auth/login?redirect=/company/${slug}/blog/${postSlug}`} className="text-brand-400 hover:underline">Sign in</Link>
                  {' '}to leave a comment.
                </p>
              </Card>
            )}

            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar src={comment.author?.avatar_url} name={comment.author?.display_name || comment.author?.full_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{comment.author?.display_name || comment.author?.full_name || 'Unknown'}</span>
                      <span className="text-xs text-surface-500">{timeAgo(comment.created_at)}</span>
                      {user?.id === comment.author_id && (
                        <button onClick={() => deleteComment(comment.id)} className="text-[10px] text-red-400 hover:text-red-300 ml-auto">Delete</button>
                      )}
                    </div>
                    <p className="text-sm text-surface-300 mt-1 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-surface-500 text-center py-4">No comments yet. Be the first!</p>
              )}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
