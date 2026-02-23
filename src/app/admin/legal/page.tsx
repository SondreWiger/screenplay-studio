'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Badge, Modal, Input, Textarea, Select, toast } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

type LegalCategory =
  | 'tos_update'
  | 'privacy_update'
  | 'security_advisory'
  | 'policy_change'
  | 'compliance'
  | 'transparency_report'
  | 'update'
  | 'announcement';

type Severity = 'info' | 'important' | 'critical';

interface LegalPostSection {
  heading: string;
  body: string;
  order: number;
}

interface LegalPost {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: LegalCategory;
  severity: Severity;
  published: boolean;
  published_at: string | null;
  author_id: string;
  notify_users: boolean;
  email_sent: boolean;
  tags: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface PostDraft {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  sections: LegalPostSection[];
  category: LegalCategory;
  severity: Severity;
  published: boolean;
  published_at?: string | null;
  author_id: string;
  notify_users: boolean;
  tags: string[];
  metadata: Record<string, unknown> | null;
}

const EMPTY_DRAFT: PostDraft = {
  title: '',
  slug: '',
  summary: '',
  sections: [{ heading: '', body: '', order: 0 }],
  category: 'update',
  severity: 'info',
  published: false,
  author_id: '',
  notify_users: true,
  tags: [],
  metadata: null,
};

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'tos_update', label: 'TOS Update' },
  { value: 'privacy_update', label: 'Privacy Update' },
  { value: 'security_advisory', label: 'Security Advisory' },
  { value: 'policy_change', label: 'Policy Change' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'transparency_report', label: 'Transparency Report' },
  { value: 'update', label: 'Update' },
  { value: 'announcement', label: 'Announcement' },
];

const CATEGORY_EDIT_OPTIONS = CATEGORY_OPTIONS.filter((o) => o.value !== '');

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Severities' },
  { value: 'info', label: 'Info' },
  { value: 'important', label: 'Important' },
  { value: 'critical', label: 'Critical' },
];

const SEVERITY_EDIT_OPTIONS = SEVERITY_OPTIONS.filter((o) => o.value !== '');

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
];

const SEVERITY_BADGE: Record<Severity, 'info' | 'warning' | 'error'> = {
  info: 'info',
  important: 'warning',
  critical: 'error',
};

const CATEGORY_LABELS: Record<LegalCategory, string> = {
  tos_update: 'TOS Update',
  privacy_update: 'Privacy Update',
  security_advisory: 'Security Advisory',
  policy_change: 'Policy Change',
  compliance: 'Compliance',
  transparency_report: 'Transparency Report',
  update: 'Update',
  announcement: 'Announcement',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Parse content into sections for editing
function parseContentToSections(content: string): LegalPostSection[] {
  if (!content || !content.trim()) {
    return [{ heading: '', body: '', order: 0 }];
  }

  // Split by ## headings
  const parts = content.split(/(?=^## )/gm);
  const sections: LegalPostSection[] = [];

  parts.forEach((part, idx) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('## ')) {
      const lines = trimmed.split('\n');
      const heading = lines[0].replace(/^## /, '').trim();
      const body = lines.slice(1).join('\n').trim();
      sections.push({ heading, body, order: sections.length });
    } else {
      // Content before first heading or no headings at all
      sections.push({ heading: '', body: trimmed, order: sections.length });
    }
  });

  return sections.length > 0 ? sections : [{ heading: '', body: '', order: 0 }];
}

// Combine sections into content string
function sectionsToContent(sections: LegalPostSection[]): string {
  return sections
    .filter((s) => s.heading.trim() || s.body.trim())
    .map((s) => {
      if (s.heading.trim()) {
        return `## ${s.heading.trim()}\n\n${s.body.trim()}`;
      }
      return s.body.trim();
    })
    .join('\n\n');
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminLegalPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  // State
  const [posts, setPosts] = useState<LegalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<PostDraft>({ ...EMPTY_DRAFT });
  const [slugTouched, setSlugTouched] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPublishWarning, setShowPublishWarning] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LegalPost | null>(null);

  // ── Auth guard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('legal_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setPosts(data as LegalPost[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (user) loadPosts();
  }, [user, loadPosts]);

  // ── Filtered posts ─────────────────────────────────────────────────────────

  const filteredPosts = posts.filter((p) => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterSeverity && p.severity !== filterSeverity) return false;
    if (filterStatus === 'published' && !p.published) return false;
    if (filterStatus === 'draft' && p.published) return false;
    return true;
  });

  // ── Editor helpers ─────────────────────────────────────────────────────────

  function openNewPost() {
    setDraft({ ...EMPTY_DRAFT, author_id: user?.id ?? '' });
    setSlugTouched(false);
    setShowPreview(false);
    setEditorOpen(true);
  }

  function openEditPost(post: LegalPost) {
    setDraft({
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      sections: parseContentToSections(post.content),
      category: post.category,
      severity: post.severity,
      published: post.published,
      published_at: post.published_at,
      author_id: post.author_id,
      notify_users: post.notify_users,
      tags: post.tags ?? [],
      metadata: post.metadata,
    });
    setSlugTouched(true);
    setShowPreview(false);
    setEditorOpen(true);
  }

  function updateDraft(patch: Partial<PostDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      // Auto-generate slug from title unless user has manually edited it
      if ('title' in patch && !slugTouched) {
        next.slug = slugify(patch.title ?? '');
      }
      return next;
    });
  }

  // Section helpers
  const addSection = () => {
    setDraft((prev) => ({
      ...prev,
      sections: [...prev.sections, { heading: '', body: '', order: prev.sections.length }],
    }));
  };

  const removeSection = (idx: number) => {
    if (draft.sections.length <= 1) return;
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })),
    }));
  };

  const updateSection = (idx: number, field: 'heading' | 'body', value: string) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const moveSection = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= draft.sections.length) return;
    setDraft((prev) => {
      const newSections = [...prev.sections];
      [newSections[idx], newSections[target]] = [newSections[target], newSections[idx]];
      return { ...prev, sections: newSections.map((s, i) => ({ ...s, order: i })) };
    });
  };

  // ── Save / Publish ─────────────────────────────────────────────────────────

  async function savePost(publish: boolean) {
    if (!draft.title.trim() || !draft.slug.trim()) return;
    setSaving(true);

    const content = sectionsToContent(draft.sections);

    const payload: Record<string, unknown> = {
      title: draft.title.trim(),
      slug: draft.slug.trim(),
      summary: draft.summary.trim(),
      content,
      category: draft.category,
      severity: draft.severity,
      published: publish,
      notify_users: draft.notify_users,
      tags: draft.tags,
      metadata: draft.metadata,
      author_id: draft.author_id || user?.id,
      updated_at: new Date().toISOString(),
    };

    if (publish && !draft.published) {
      payload.published_at = new Date().toISOString();
    }

    let error;
    if (draft.id) {
      ({ error } = await supabase.from('legal_posts').update(payload).eq('id', draft.id));
    } else {
      ({ error } = await supabase.from('legal_posts').insert(payload));
    }

    setSaving(false);
    if (!error) {
      setEditorOpen(false);
      loadPosts();
    } else {
      toast.error(`Error saving post: ${error.message}`);
    }
  }

  function handlePublishClick() {
    if (!draft.published && draft.notify_users) {
      setShowPublishWarning(true);
    } else {
      savePost(true);
    }
  }

  // ── Toggle publish ─────────────────────────────────────────────────────────

  async function togglePublish(post: LegalPost) {
    const newPublished = !post.published;
    const payload: Record<string, unknown> = {
      published: newPublished,
      updated_at: new Date().toISOString(),
    };
    if (newPublished && !post.published_at) {
      payload.published_at = new Date().toISOString();
    }

    const { error } = await supabase.from('legal_posts').update(payload).eq('id', post.id);
    if (!error) loadPosts();
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deletePost(post: LegalPost) {
    const { error } = await supabase.from('legal_posts').delete().eq('id', post.id);
    if (!error) {
      setDeleteTarget(null);
      loadPosts();
    }
  }

  // ── Render guards ──────────────────────────────────────────────────────────

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-950">
        <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Combine sections for preview
  const previewContent = sectionsToContent(draft.sections);

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-xs text-surface-500 hover:text-white transition-colors mb-2 inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Admin
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Legal Blog Management</h1>
            <p className="text-sm text-surface-400 mt-1">
              Manage policy updates, TOS changes, security advisories and more.
            </p>
          </div>
          <Button onClick={openNewPost} className="bg-red-500 hover:bg-red-600 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Post
          </Button>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────── */}
        <Card className="p-4 bg-surface-900/50 border-surface-800">
          <div className="flex flex-wrap gap-3">
            <div className="w-48">
              <Select
                label="Category"
                options={CATEGORY_OPTIONS}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Select
                label="Severity"
                options={SEVERITY_OPTIONS}
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              />
            </div>
            <div className="flex items-end ml-auto">
              <span className="text-xs text-surface-500">
                {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </Card>

        {/* ── Posts list ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <Card className="p-12 text-center bg-surface-900/50 border-surface-800">
            <p className="text-surface-400">No legal posts found.</p>
            <Button className="mt-4 bg-red-500 hover:bg-red-600" onClick={openNewPost}>
              Create your first post
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="rounded-lg border border-surface-800 bg-surface-900/50 p-4 flex items-center gap-4 hover:bg-surface-800/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={SEVERITY_BADGE[post.severity]} size="sm">{post.severity}</Badge>
                    <Badge variant="default" size="sm">{CATEGORY_LABELS[post.category] ?? post.category}</Badge>
                    {post.published ? (
                      <Badge variant="success" size="sm">Published</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">Draft</Badge>
                    )}
                    {post.notify_users && !post.email_sent && post.published && (
                      <span className="text-[10px] text-yellow-400/80 bg-yellow-500/10 px-2 py-0.5 rounded">📧 pending</span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-white group-hover:text-red-400 transition-colors truncate">
                    {post.title}
                  </h3>
                  <p className="text-xs text-surface-500 mt-1">
                    /{post.slug} · {post.published_at ? formatDate(post.published_at) : 'Draft'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEditPost(post)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => togglePublish(post)}>
                    {post.published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setDeleteTarget(post)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Editor Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={editorOpen} onClose={() => setEditorOpen(false)} title={draft.id ? 'Edit Legal Post' : 'New Legal Post'} size="xl">
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Toggle preview */}
          <div className="flex items-center gap-1 bg-surface-900 rounded-lg p-1 w-fit">
            <button
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                !showPreview ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-white'
              )}
              onClick={() => setShowPreview(false)}
            >
              Editor
            </button>
            <button
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                showPreview ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-white'
              )}
              onClick={() => setShowPreview(true)}
            >
              Preview
            </button>
          </div>

          {showPreview ? (
            /* ── Preview ─────────────────────────────────────────────── */
            <div className="rounded-lg border border-surface-800 bg-surface-900/30 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={SEVERITY_BADGE[draft.severity]}>{draft.severity}</Badge>
                <Badge variant="default">{CATEGORY_LABELS[draft.category as LegalCategory] ?? draft.category}</Badge>
              </div>
              <h2 className="text-2xl font-bold text-white">{draft.title || 'Untitled'}</h2>
              {draft.summary && (
                <p className="text-surface-300 text-sm leading-relaxed border-l-2 border-red-500/50 pl-4 italic">{draft.summary}</p>
              )}
              <hr className="border-surface-800" />
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-surface-200 leading-relaxed">
                {previewContent || 'No content yet.'}
              </div>
              {draft.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-4 border-t border-surface-800">
                  {draft.tags.map((t) => (
                    <Badge key={t} variant="default">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Editor fields ───────────────────────────────────────── */
            <div className="space-y-5">
              {/* Meta fields */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Title"
                  value={draft.title}
                  onChange={(e: any) => updateDraft({ title: e.target.value })}
                  placeholder="e.g. Updated Terms of Service"
                />
                <Input
                  label="Slug"
                  value={draft.slug}
                  onChange={(e: any) => {
                    setSlugTouched(true);
                    updateDraft({ slug: e.target.value });
                  }}
                  placeholder="url-friendly-slug"
                />
              </div>
              <Textarea
                label="Summary"
                value={draft.summary}
                onChange={(e: any) => updateDraft({ summary: e.target.value })}
                placeholder="Brief description shown in listings…"
                rows={2}
              />
              <div className="grid grid-cols-3 gap-4">
                <Select
                  label="Category"
                  options={CATEGORY_EDIT_OPTIONS}
                  value={draft.category}
                  onChange={(e) => updateDraft({ category: e.target.value as LegalCategory })}
                />
                <Select
                  label="Severity"
                  options={SEVERITY_EDIT_OPTIONS}
                  value={draft.severity}
                  onChange={(e) => updateDraft({ severity: e.target.value as Severity })}
                />
                <Input
                  label="Tags (comma-separated)"
                  value={draft.tags.join(', ')}
                  onChange={(e: any) => updateDraft({
                    tags: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean),
                  })}
                  placeholder="tos, privacy, gdpr"
                />
              </div>

              {/* Notify checkbox */}
              <label className="flex items-center gap-3 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={draft.notify_users}
                  onChange={(e) => updateDraft({ notify_users: e.target.checked })}
                  className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-red-500 focus:ring-red-500 focus:ring-offset-0"
                />
                <span className="text-sm text-surface-300">
                  Notify all users when published
                </span>
              </label>

              {/* Sections editor */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-surface-300">Sections</label>
                  <Button variant="ghost" size="sm" onClick={addSection} className="text-red-400 hover:text-red-300">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Section
                  </Button>
                </div>
                <div className="space-y-4">
                  {draft.sections.map((section, idx) => (
                    <div key={idx} className="rounded-lg border border-surface-800 bg-surface-900/30 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] text-surface-500 font-mono bg-surface-800 px-2 py-0.5 rounded">
                          Section {idx + 1}
                        </span>
                        <div className="flex-1" />
                        <Button variant="ghost" size="icon" onClick={() => moveSection(idx, -1)} disabled={idx === 0}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => moveSection(idx, 1)} disabled={idx === draft.sections.length - 1}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </Button>
                        {draft.sections.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeSection(idx)}>
                            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </Button>
                        )}
                      </div>
                      <Input
                        placeholder="Section heading (optional, becomes ## heading)"
                        value={section.heading}
                        onChange={(e: any) => updateSection(idx, 'heading', e.target.value)}
                      />
                      <div className="mt-2">
                        <textarea
                          value={section.body}
                          onChange={(e) => updateSection(idx, 'body', e.target.value)}
                          placeholder="Section content... (use markdown: **bold**, [link](url), - bullet)"
                          rows={6}
                          className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none transition-colors font-mono leading-relaxed"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Action buttons ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-4 border-t border-surface-800">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                loading={saving}
                onClick={() => savePost(false)}
              >
                Save Draft
              </Button>
              <Button
                className="bg-red-500 hover:bg-red-600"
                loading={saving}
                onClick={handlePublishClick}
              >
                {draft.id && draft.published ? 'Update & Publish' : 'Publish'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Publish warning modal ─────────────────────────────────────── */}
      <Modal isOpen={showPublishWarning} onClose={() => setShowPublishWarning(false)} title="Confirm Publish" size="sm">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5 h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-white font-medium">This will send a notification to ALL users.</p>
              <p className="text-sm text-surface-400 mt-1">
                The &quot;Notify all users&quot; option is enabled. Publishing this post will trigger a notification to every user on the platform. Are you sure?
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowPublishWarning(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600"
              loading={saving}
              onClick={() => {
                setShowPublishWarning(false);
                savePost(true);
              }}
            >
              Yes, Publish &amp; Notify
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirmation modal ─────────────────────────────────── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Post" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-surface-300">
            Are you sure you want to permanently delete <strong className="text-white">&quot;{deleteTarget?.title}&quot;</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={() => deleteTarget && deletePost(deleteTarget)}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
