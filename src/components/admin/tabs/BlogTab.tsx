'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Badge, Modal, Input, Textarea, Avatar, Select, toast } from '@/components/ui';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import type { BlogPost, BlogPostSection, BlogComment, CommunityPostStatus } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useAdminData } from '../data';
import { TabSkeleton } from '../motion';
import { Newspaper } from 'lucide-react';
import { AdminPage, BarList, PageHeader, Panel, Reveal, StatGrid, TrendPanel, SERIES } from '../kit';

export function BlogTab({ posts, comments, onNewPost, onEditPost, onDeletePost, onToggleCommentHidden, onDeleteComment }: {
  posts: BlogPost[];
  comments: (BlogComment & { author: { full_name: string | null; avatar_url: string | null } | null })[];
  onNewPost: () => void;
  onEditPost: (post: BlogPost) => void;
  onDeletePost: (id: string) => void;
  onToggleCommentHidden: (id: string, hidden: boolean) => void;
  onDeleteComment: (id: string) => void;
}) {
  const [view, setView] = useState<'posts' | 'comments'>('posts');

  const statusColor = (s: string) => {
    if (s === 'published') return 'success';
    if (s === 'draft') return 'warning';
    return 'default';
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <Button onClick={onNewPost}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Post
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 bg-surface-900 rounded-lg p-1 w-fit">
        {(['posts', 'comments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
              view === t ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-white'
            )}
          >
            {t} {t === 'posts' ? `(${posts.length})` : `(${comments.length})`}
          </button>
        ))}
      </div>

      {view === 'posts' && (
        <div className="space-y-3">
          {posts.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-surface-400 text-sm">No blog posts yet. Create your first one!</p>
            </div>
          )}
          {posts.map((post) => (
            <div key={post.id} className="rounded-xl border border-surface-800 bg-surface-900/50 p-5 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={statusColor(post.status)} size="sm">{post.status}</Badge>
                  {post.tags?.map((tag) => (
                    <span key={tag} className="text-[11px] text-surface-500 bg-surface-800 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
                <h3 className="text-base font-semibold text-white truncate">{post.title}</h3>
                {post.excerpt && <p className="text-xs text-surface-400 mt-1 truncate">{post.excerpt}</p>}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-500">
                  <span>/{post.slug}</span>
                  <span>·</span>
                  <span>{post.sections?.length || 0} sections</span>
                  <span>·</span>
                  <span>{post.view_count || 0} views</span>
                  {post.published_at && (
                    <>
                      <span>·</span>
                      <span>Published {formatDate(post.published_at)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => onEditPost(post)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => onDeletePost(post.id)}>
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'comments' && (
        <div className="space-y-3">
          {comments.length === 0 && (
            <p className="text-center py-16 text-surface-400 text-sm">No blog comments yet.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className={cn('rounded-xl border border-surface-800 bg-surface-900/50 p-4 flex items-start gap-3', c.is_hidden && 'opacity-50')}>
              <Avatar src={c.author?.avatar_url} name={c.author?.full_name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">{c.author?.full_name || 'Anonymous'}</span>
                  <span className="text-[11px] text-surface-500">{timeAgo(c.created_at)}</span>
                  {c.is_hidden && <Badge variant="error" size="sm">Hidden</Badge>}
                </div>
                <p className="text-sm text-surface-300 line-clamp-2">{c.content}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => onToggleCommentHidden(c.id, !c.is_hidden)}
                  title={c.is_hidden ? 'Show' : 'Hide'}
                >
                  {c.is_hidden ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDeleteComment(c.id)}>
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



export function BlogPostEditorModal({ post, authorId, onClose, onSaved }: {
  post: BlogPost | null;
  authorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [coverUrl, setCoverUrl] = useState(post?.cover_image_url || '');
  const [tags, setTags] = useState(post?.tags?.join(', ') || '');
  const [status, setStatus] = useState(post?.status || 'draft');
  const [allowComments, setAllowComments] = useState(post?.allow_comments ?? true);
  const [sections, setSections] = useState<BlogPostSection[]>(
    post?.sections && post.sections.length > 0
      ? [...post.sections].sort((a, b) => a.order - b.order)
      : [{ heading: '', body: '', order: 0 }]
  );
  const [saving, setSaving] = useState(false);

  // Auto-generate slug from title
  useEffect(() => {
    if (!post && title) {
      setSlug(
        title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      );
    }
  }, [title, post]);

  const addSection = () => {
    setSections([...sections, { heading: '', body: '', order: sections.length }]);
  };

  const removeSection = (idx: number) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  };

  const updateSection = (idx: number, field: 'heading' | 'body', value: string) => {
    setSections(sections.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const moveSection = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= sections.length) return;
    const newSections = [...sections];
    [newSections[idx], newSections[target]] = [newSections[target], newSections[idx]];
    setSections(newSections.map((s, i) => ({ ...s, order: i })));
  };

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        cover_image_url: coverUrl.trim() || null,
        tags: parsedTags,
        status,
        allow_comments: allowComments,
        sections: sections.map((s, i) => ({ heading: s.heading, body: s.body, order: i })),
        published_at: status === 'published' && !post?.published_at ? new Date().toISOString() : post?.published_at || null,
        author_id: authorId,
      };

      if (post) {
        await supabase.from('blog_posts').update(payload).eq('id', post.id);
      } else {
        await supabase.from('blog_posts').insert(payload);
      }

      onSaved();
    } catch (err) {
      console.error('Error saving blog post:', err);
      toast.error('Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={post ? 'Edit Blog Post' : 'New Blog Post'} size="xl">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Meta fields */}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Title" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="Post title" />
          <Input label="Slug" value={slug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlug(e.target.value)} placeholder="url-friendly-slug" />
        </div>
        <Textarea label="Excerpt" value={excerpt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExcerpt(e.target.value)} placeholder="Brief description shown in listings..." rows={2} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Cover Image URL" value={coverUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCoverUrl(e.target.value)} placeholder="https://..." />
          <Input label="Tags (comma-separated)" value={tags} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTags(e.target.value)} placeholder="update, feature, devlog" />
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <Select
            label="Status"
            value={status}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as CommunityPostStatus)}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer pb-2.5">
            <input
              type="checkbox"
              checked={allowComments}
              onChange={(e) => setAllowComments(e.target.checked)}
              className="rounded border-surface-600 bg-surface-900 text-brand-500 focus:ring-brand-500"
            />
            Allow comments
          </label>
        </div>

        {/* Sections editor */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-surface-300">Sections</label>
            <Button variant="ghost" size="sm" onClick={addSection}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Section
            </Button>
          </div>
          <div className="space-y-4">
            {sections.map((section, idx) => (
              <div key={idx} className="rounded-lg border border-surface-800 bg-surface-900/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] text-surface-500 font-mono bg-surface-800 px-2 py-0.5 rounded">
                    Section {idx + 1}
                  </span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => moveSection(idx, -1)} disabled={idx === 0}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </Button>
                  {sections.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeSection(idx)}>
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="Section heading (optional)"
                  value={section.heading}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSection(idx, 'heading', e.target.value)}
                />
                <div className="mt-2">
                  <textarea
                    value={section.body}
                    onChange={(e) => updateSection(idx, 'body', e.target.value)}
                    placeholder="Section content... (use blank lines for paragraph breaks)"
                    rows={6}
                    className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none transition-colors font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cover preview */}
        {coverUrl && (
          <div>
            <label className="text-sm font-medium text-surface-300 block mb-2">Cover Preview</label>
            <div className="rounded-lg overflow-hidden border border-surface-800 max-h-48">
              <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end gap-3 pt-4 border-t border-surface-800">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>
            {post ? 'Update Post' : 'Create Post'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type BlogCommentWithAuthor = BlogComment & { author: { full_name: string | null; avatar_url: string | null } | null };

export default function BlogPanel() {
  const { user } = useAuth();
  const [editing, setEditing] = useState<BlogPost | null | 'new'>(null);
  const { data, loading, reload } = useAdminData<{ posts: BlogPost[]; comments: BlogCommentWithAuthor[] }>('blog', async () => {
    const supabase = createClient();
    const [postsRes, commentsRes] = await Promise.all([
      supabase.from('blog_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('blog_comments').select('*, author:profiles(full_name, avatar_url)').order('created_at', { ascending: false }).limit(50),
    ]);
    return { posts: postsRes.data || [], comments: (commentsRes.data || []) as BlogCommentWithAuthor[] };
  }, { posts: [], comments: [] });

  const handleDeletePost = async (id: string) => {
    if (!confirm('Delete this blog post? This cannot be undone.')) return;
    const supabase = createClient();
    await supabase.from('blog_comments').delete().eq('post_id', id);
    await supabase.from('blog_posts').delete().eq('id', id);
    await reload();
  };
  const handleToggleCommentHidden = async (id: string, hidden: boolean) => {
    await createClient().from('blog_comments').update({ is_hidden: hidden }).eq('id', id);
    await reload();
  };
  const handleDeleteComment = async (id: string) => {
    if (!confirm('Delete this comment?')) return;
    await createClient().from('blog_comments').delete().eq('id', id);
    await reload();
  };

  if (loading) return <TabSkeleton />;
  const { posts, comments } = data;
  return (
    <AdminPage>
      <PageHeader icon={<Newspaper className="h-5 w-5" />} title="Blog" description="Write and publish posts, moderate comments." />
      <StatGrid
        cols={5}
        items={[
          { label: 'Posts', value: posts.length, tone: 'brand' },
          { label: 'Published', value: posts.filter((p) => p.status === 'published').length, tone: 'green' },
          { label: 'Drafts', value: posts.filter((p) => p.status !== 'published').length, tone: 'amber' },
          { label: 'Total views', value: posts.reduce((n, p) => n + (p.view_count || 0), 0), tone: 'blue' },
          { label: 'Hidden comments', value: comments.filter((c) => c.is_hidden).length, tone: 'red', hint: 'Among the latest 50 comments' },
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-5">
        <TrendPanel id="blog" className="lg:col-span-3" title="Publishing & discussion" subtitle="Posts published and comments received" defaultRange="1y" sources={[
          { key: 'posts', label: 'Posts published', color: SERIES.blue, rows: posts, time: (p) => p.published_at },
          { key: 'comments', label: 'Comments', color: SERIES.aqua, rows: comments, time: (c) => c.created_at },
        ]} />
        <Panel title="Most viewed" className="lg:col-span-2">
          <BarList items={[...posts].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 6).map((p) => ({ label: p.title, count: p.view_count || 0 }))} labelFormat={(l) => <span className="normal-case">{l}</span>} empty="No views yet" />
        </Panel>
      </div>
      <Reveal>
      <BlogTab
        posts={data.posts}
        comments={data.comments}
        onNewPost={() => setEditing('new')}
        onEditPost={(post) => setEditing(post)}
        onDeletePost={handleDeletePost}
        onToggleCommentHidden={handleToggleCommentHidden}
        onDeleteComment={handleDeleteComment}
      />
      </Reveal>
      {editing && user && (
        <BlogPostEditorModal
          post={editing === 'new' ? null : editing}
          authorId={user.id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </AdminPage>
  );
}
