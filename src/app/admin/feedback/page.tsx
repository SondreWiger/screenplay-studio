'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, MessageSquareText, RefreshCw, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Textarea, LoadingSpinner, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import {
  ActionButton, AdminPage, BarList, EmptyState, PageHeader, Panel, Pill, Reveal, SearchInput, Segmented, StatGrid,
  TabSkeleton, Toolbar, TrendPanel, dailySpark, fieldClass, tally, windowCounts, SERIES, type Tone,
} from '@/components/admin/kit';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

// Types

type FType   = 'bug_report' | 'feature_request' | 'testimonial' | 'other';
type FStatus = 'open' | 'in_progress' | 'planned' | 'resolved' | 'wont_fix' | 'intended' | 'duplicate' | 'pending_review';
type FPriority = 'low' | 'medium' | 'high' | 'critical';
type CommentType = 'note' | 'status_change' | 'resolution' | 'question' | 'update' | 'duplicate_link';

interface FeedbackItem {
  id: string;
  type: FType;
  title: string;
  body: string;
  status: FStatus;
  priority: FPriority;
  user_id: string | null;
  author_name: string | null;
  author_email: string | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  error_message: string | null;
  url_where_occurred: string | null;
  browser_info: Record<string, string> | null;
  use_case: string | null;
  rating: number | null;
  is_approved: boolean;
  show_author_name: boolean;
  vote_count: number;
  comment_count: number;
  is_public: boolean;
  admin_note: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  // (profile join removed — use author_name / author_email instead)
}

interface FeedbackComment {
  id: string;
  item_id: string;
  author_id: string | null;
  content: string;
  comment_type: CommentType;
  is_public: boolean;
  metadata: Record<string, string> | null;
  created_at: string;
}

interface SimilarLink {
  id: string;
  item_id: string;
  similar_item_id: string;
  strength: number;
  similar?: { id: string; title: string; type: FType; status: FStatus } | null;
}

// Metadata helpers

const STATUS_META: Record<FStatus, { label: string; color: string }> = {
  open:           { label: 'Open',           color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  in_progress:    { label: 'In Progress',    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  planned:        { label: 'Planned',        color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  resolved:       { label: 'Resolved',       color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  wont_fix:       { label: "Won't Fix",      color: 'bg-surface-700 text-surface-400 border-surface-600' },
  intended:       { label: 'Intended',       color: 'bg-surface-700 text-surface-400 border-surface-600' },
  duplicate:      { label: 'Duplicate',      color: 'bg-surface-700 text-surface-400 border-surface-600' },
  pending_review: { label: 'Pending Review', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
};

const PRIORITY_META: Record<FPriority, { label: string; dot: string }> = {
  low:      { label: 'Low',      dot: 'bg-surface-500' },
  medium:   { label: 'Medium',   dot: 'bg-yellow-400' },
  high:     { label: 'High',     dot: 'bg-orange-400' },
  critical: { label: 'Critical', dot: 'bg-red-500' },
};

const PRIORITY_TONE: Record<FPriority, Tone> = { low: 'neutral', medium: 'amber', high: 'brand', critical: 'red' };
const TYPE_COLOR: Record<FType, string> = { bug_report: SERIES.red, feature_request: SERIES.blue, testimonial: SERIES.yellow, other: SERIES.violet };
const ACTIVE_STATUSES: FStatus[] = ['open', 'in_progress', 'planned', 'pending_review'];

const TYPE_META: Record<FType, { label: string; emoji: string }> = {
  bug_report:      { label: 'Bug',         emoji: '🐛' },
  feature_request: { label: 'Feature',     emoji: '✨' },
  testimonial:     { label: 'Testimonial', emoji: '⭐' },
  other:           { label: 'Other',       emoji: '💬' },
};

const COMMENT_TYPE_META: Record<CommentType, { label: string; color: string; icon: string }> = {
  note:           { label: 'Note',           color: 'text-surface-400',  icon: '📝' },
  status_change:  { label: 'Status Change',  color: 'text-orange-400',   icon: '🔄' },
  resolution:     { label: 'Resolution',     color: 'text-green-400',    icon: '✅' },
  question:       { label: 'Question',       color: 'text-blue-400',     icon: '❓' },
  update:         { label: 'Update',         color: 'text-purple-400',   icon: '📣' },
  duplicate_link: { label: 'Duplicate Link', color: 'text-yellow-400',   icon: '🔗' },
};

// Panel component (right drawer)

function AdminNoteEditor({ item, onSaved }: { item: FeedbackItem; onSaved: (note: string) => void }) {
  const [note, setNote] = useState(item.admin_note ?? '');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('feedback_items')
      .update({ admin_note: note || null })
      .eq('id', item.id);
    setSaving(false);
    if (error) { toast.error('Failed to save note'); return; }
    toast.success('Note saved');
    onSaved(note);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500">Internal Note</label>
      <Textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Admin-only sticky note…"
        className="text-sm min-h-[80px]"
      />
      <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Note'}</Button>
    </div>
  );
}

function TagEditor({ item, onSaved }: { item: FeedbackItem; onSaved: (tags: string[]) => void }) {
  const [raw, setRaw] = useState(item.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const save = async () => {
    const tags = raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    setSaving(true);
    const { error } = await supabase
      .from('feedback_items')
      .update({ tags })
      .eq('id', item.id);
    setSaving(false);
    if (error) { toast.error('Failed to save tags'); return; }
    toast.success('Tags saved');
    onSaved(tags);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500">Tags (comma separated)</label>
      <Input value={raw} onChange={e => setRaw(e.target.value)} placeholder="ui, auth, performance…" className="text-sm" />
      <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Tags'}</Button>
    </div>
  );
}

function SimilarSearch({
  item,
  existingLinks,
  onLinked,
}: {
  item: FeedbackItem;
  existingLinks: SimilarLink[];
  onLinked: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FeedbackItem[]>([]);
  const [linking, setLinking] = useState<string | null>(null);
  const supabase = createClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('feedback_items')
        .select('id,title,type,status,vote_count')
        .ilike('title', `%${query}%`)
        .neq('id', item.id)
        .limit(8);
      setResults((data as FeedbackItem[]) ?? []);
    }, 400);
  }, [query]);

  const alreadyLinked = new Set([
    ...existingLinks.map(l => l.similar_item_id),
    ...existingLinks.map(l => l.item_id),
  ]);

  const link = async (otherId: string) => {
    setLinking(otherId);
    const { error } = await supabase.from('feedback_similar_links').upsert({
      item_id: item.id,
      similar_item_id: otherId,
      strength: 0.9,
    }, { onConflict: 'item_id,similar_item_id' });
    setLinking(null);
    if (error) { toast.error('Failed to link'); return; }
    toast.success('Linked');
    onLinked();
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500">Link Duplicate / Related</label>
      <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by title…" className="text-sm" />
      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-surface-800 text-sm">
              <span className="truncate text-surface-200">{r.title}</span>
              {alreadyLinked.has(r.id) ? (
                <span className="text-[11px] text-surface-500 shrink-0">linked</span>
              ) : (
                <button
                  onClick={() => link(r.id)}
                  disabled={linking === r.id}
                  className="text-[11px] text-orange-400 hover:text-orange-300 shrink-0"
                >
                  {linking === r.id ? '…' : 'Link'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Detail drawer

function DetailDrawer({
  item: initialItem,
  onClose,
  onUpdate,
}: {
  item: FeedbackItem;
  onClose: () => void;
  onUpdate: (patch: Partial<FeedbackItem>) => void;
}) {
  const [item, setItem] = useState(initialItem);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [similarLinks, setSimilarLinks] = useState<SimilarLink[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);

  // New comment form
  const [commentContent, setCommentContent] = useState('');
  const [commentType, setCommentType] = useState<CommentType>('note');
  const [commentPublic, setCommentPublic] = useState(true);
  const [toStatus, setToStatus] = useState<FStatus>(item.status);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();
  const ADMIN_UID_CONST = ADMIN_UID;

  const patch = async (updates: Partial<FeedbackItem>) => {
    const { error } = await supabase.from('feedback_items').update(updates).eq('id', item.id);
    if (error) { toast.error('Update failed'); return; }
    const next = { ...item, ...updates };
    setItem(next);
    onUpdate(updates);
    toast.success('Updated');
  };

  useEffect(() => {
    setItem(initialItem);
  }, [initialItem.id]);

  useEffect(() => {
    (async () => {
      setLoadingComments(true);
      const [{ data: comms }, { data: links }] = await Promise.all([
        supabase
          .from('feedback_comments')
          .select('*')
          .eq('item_id', item.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('feedback_similar_links')
          .select('*, similar:feedback_items!feedback_similar_links_similar_item_id_fkey(id,title,type,status)')
          .eq('item_id', item.id),
      ]);
      setComments((comms as FeedbackComment[]) ?? []);
      setSimilarLinks((links as SimilarLink[]) ?? []);
      setLoadingComments(false);
    })();
  }, [item.id]);

  const submitComment = async () => {
    if (!commentContent.trim()) return;
    setSubmitting(true);

    let meta: Record<string, string> | null = null;
    let statusUpdate: Partial<FeedbackItem> | null = null;

    if (commentType === 'status_change') {
      meta = { from_status: item.status, to_status: toStatus };
      statusUpdate = { status: toStatus };
    }

    const { error } = await supabase.from('feedback_comments').insert({
      item_id: item.id,
      author_id: ADMIN_UID_CONST,
      content: commentContent.trim(),
      comment_type: commentType,
      is_public: commentPublic,
      metadata: meta,
    });

    if (error) { toast.error('Failed to post'); setSubmitting(false); return; }

    if (statusUpdate) {
      await supabase.from('feedback_items').update(statusUpdate).eq('id', item.id);
      const next = { ...item, ...statusUpdate };
      setItem(next);
      onUpdate(statusUpdate);
    }

    // Refetch comments
    const { data: comms } = await supabase
      .from('feedback_comments')
      .select('*')
      .eq('item_id', item.id)
      .order('created_at', { ascending: true });
    setComments((comms as FeedbackComment[]) ?? []);
    setCommentContent('');
    setSubmitting(false);
    toast.success('Comment posted');
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <motion.div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />

      {/* Drawer */}
      <motion.div
        className="flex w-full max-w-2xl flex-col overflow-hidden border-l border-surface-800 bg-surface-950 shadow-2xl"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-surface-800 shrink-0">
          <span className="text-2xl mt-0.5">{TYPE_META[item.type].emoji}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white leading-snug">{item.title}</h2>
            <p className="text-[11px] text-surface-500 mt-0.5">
              #{item.id.slice(0, 8)} · {timeAgo(item.created_at)}
              {item.author_name && ` · ${item.author_name}`}
              {item.author_email && ` (${item.author_email})`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-surface-500 hover:bg-surface-800 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Quick status / priority row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500">Status</label>
              <select
                value={item.status}
                onChange={e => patch({ status: e.target.value as FStatus })}
                className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500">Priority</label>
              <select
                value={item.priority}
                onChange={e => patch({ priority: e.target.value as FPriority })}
                className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                {Object.entries(PRIORITY_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500">Visibility</label>
              <select
                value={item.is_public ? 'public' : 'private'}
                onChange={e => patch({ is_public: e.target.value === 'public' })}
                className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            {item.type === 'testimonial' && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500">Approved</label>
                <button
                  onClick={() => patch({ is_approved: !item.is_approved })}
                  className={cn(
                    'px-3 py-1.5 rounded text-sm border transition-colors',
                    item.is_approved
                      ? 'bg-green-500/20 text-green-300 border-green-500/30'
                      : 'bg-surface-800 text-surface-400 border-surface-700 hover:text-white'
                  )}
                >
                  {item.is_approved ? '✓ Approved' : 'Approve'}
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          <div>
            <label className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500 block mb-1">Description</label>
            <p className="text-sm text-surface-300 whitespace-pre-wrap">{item.body}</p>
          </div>

          {/* Bug-specific fields */}
          {item.type === 'bug_report' && (item.steps_to_reproduce || item.expected_behavior || item.actual_behavior || item.browser_info) && (
            <div className="space-y-3 border border-surface-800 rounded-lg p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500">Bug Details</p>
              {item.steps_to_reproduce && (
                <div>
                  <p className="text-[11px] text-surface-500 mb-1">Steps to Reproduce</p>
                  <pre className="text-xs text-surface-300 whitespace-pre-wrap font-mono bg-surface-900 rounded p-2">{item.steps_to_reproduce}</pre>
                </div>
              )}
              {(item.expected_behavior || item.actual_behavior) && (
                <div className="grid grid-cols-2 gap-3">
                  {item.expected_behavior && (
                    <div>
                      <p className="text-[11px] text-surface-500 mb-1">Expected</p>
                      <p className="text-xs text-surface-300">{item.expected_behavior}</p>
                    </div>
                  )}
                  {item.actual_behavior && (
                    <div>
                      <p className="text-[11px] text-surface-500 mb-1">Actual</p>
                      <p className="text-xs text-surface-300">{item.actual_behavior}</p>
                    </div>
                  )}
                </div>
              )}
              {item.browser_info && (
                <p className="text-[11px] text-surface-500 font-mono">
                  {Object.entries(item.browser_info).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </p>
              )}
              {item.url_where_occurred && (
                <p className="text-[11px] text-surface-500">URL: <span className="text-blue-400">{item.url_where_occurred}</span></p>
              )}
            </div>
          )}

          {/* Feature use case */}
          {item.type === 'feature_request' && item.use_case && (
            <div>
              <label className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500 block mb-1">Use Case</label>
              <p className="text-sm text-surface-300 whitespace-pre-wrap">{item.use_case}</p>
            </div>
          )}

          {/* Testimonial rating */}
          {item.type === 'testimonial' && (
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-lg">{'★'.repeat(item.rating ?? 0)}{'☆'.repeat(5 - (item.rating ?? 0))}</span>
              <span className="text-sm text-surface-400">{item.show_author_name ? item.author_name : 'Anonymous'}</span>
            </div>
          )}

          {/* Admin note + tags */}
          <AdminNoteEditor item={item} onSaved={note => { setItem(p => ({ ...p, admin_note: note })); onUpdate({ admin_note: note }); }} />
          <TagEditor item={item} onSaved={tags => { setItem(p => ({ ...p, tags })); onUpdate({ tags }); }} />

          {/* Similar / duplicate links */}
          <SimilarSearch item={item} existingLinks={similarLinks} onLinked={async () => {
            const { data } = await supabase
              .from('feedback_similar_links')
              .select('*, similar:feedback_items!feedback_similar_links_similar_item_id_fkey(id,title,type,status)')
              .eq('item_id', item.id);
            setSimilarLinks((data as SimilarLink[]) ?? []);
          }} />

          {similarLinks.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500">Linked Items</p>
              {similarLinks.map(l => l.similar && (
                <Link
                  key={l.id}
                  href={`/feedback/${l.similar.id}`}
                  className="flex items-center gap-2 text-sm text-blue-400 hover:underline"
                >
                  {TYPE_META[l.similar.type].emoji} {l.similar.title}
                  <span className={cn('text-[11px] px-1.5 py-0.5 rounded border', STATUS_META[l.similar.status].color)}>
                    {STATUS_META[l.similar.status].label}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Admin timeline */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500 mb-3">Admin Timeline</p>
            {loadingComments ? (
              <div className="flex justify-center py-4"><LoadingSpinner /></div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-surface-600 italic">No comments yet.</p>
            ) : (
              <div className="relative space-y-0">
                <div className="absolute left-[11px] top-0 bottom-0 w-px bg-surface-800" />
                {comments.map(c => {
                  const meta = COMMENT_TYPE_META[c.comment_type];
                  return (
                    <div key={c.id} className="relative flex gap-3 pb-4">
                      <div className={cn('relative z-10 flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5', 'bg-surface-900 border border-surface-700 text-[12px]')}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn('text-[11px] font-semibold', meta.color)}>{meta.label}</span>
                          <span className="text-[11px] text-surface-600">{timeAgo(c.created_at)}</span>
                          {!c.is_public && <span className="text-[11px] px-1 py-0.5 rounded bg-surface-800 text-surface-500 uppercase tracking-wide">internal</span>}
                        </div>
                        {c.comment_type === 'status_change' && c.metadata && (
                          <p className="text-[11px] text-surface-500 mb-1">
                            {STATUS_META[c.metadata.from_status as FStatus]?.label ?? c.metadata.from_status}
                            {' → '}
                            {STATUS_META[c.metadata.to_status as FStatus]?.label ?? c.metadata.to_status}
                          </p>
                        )}
                        <p className="text-sm text-surface-300 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add comment form */}
          <div className="border border-surface-800 rounded-lg p-4 space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500">Add Timeline Entry</p>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] text-surface-500">Type</label>
                <select
                  value={commentType}
                  onChange={e => setCommentType(e.target.value as CommentType)}
                  className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  {Object.entries(COMMENT_TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              {commentType === 'status_change' && (
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] text-surface-500">New Status</label>
                  <select
                    value={toStatus}
                    onChange={e => setToStatus(e.target.value as FStatus)}
                    className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-surface-500">Visibility</label>
                <button
                  onClick={() => setCommentPublic(p => !p)}
                  className={cn(
                    'px-3 py-1.5 rounded text-sm border transition-colors',
                    commentPublic
                      ? 'bg-green-500/20 text-green-300 border-green-500/30'
                      : 'bg-surface-800 text-surface-400 border-surface-700'
                  )}
                >
                  {commentPublic ? 'Public' : 'Internal'}
                </button>
              </div>
            </div>
            <Textarea
              value={commentContent}
              onChange={e => setCommentContent(e.target.value)}
              placeholder="Write a comment or note…"
              className="text-sm min-h-[80px]"
            />
            <Button onClick={submitComment} disabled={submitting || !commentContent.trim()} size="sm">
              {submitting ? 'Posting…' : 'Post Entry'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}


type Sort = 'newest' | 'votes' | 'priority';
const PRIORITY_RANK: Record<FPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function AdminFeedbackPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);

  // Filters (client-side: instant, and stats always reflect everything)
  const [filterType, setFilterType] = useState<FType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FStatus | 'all' | 'active'>('active');
  const [filterPriority, setFilterPriority] = useState<FPriority | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('newest');

  useEffect(() => {
    if (!authLoading && user?.id !== ADMIN_UID) router.replace('/');
  }, [user, authLoading, router]);

  const fetchItems = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await fetchAll<FeedbackItem>(() => supabase.from('feedback_items').select('*'));
      setItems(rows.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch {
      toast.error('Failed to load feedback');
    }
    setLoading(false);
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => { if (user?.id === ADMIN_UID) fetchItems(); }, [fetchItems, user?.id]);

  const applyPatch = (id: string, patch: Partial<FeedbackItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...patch } : null);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(it => filterType === 'all' || it.type === filterType)
      .filter(it => filterStatus === 'all' || (filterStatus === 'active' ? ACTIVE_STATUSES.includes(it.status) : it.status === filterStatus))
      .filter(it => filterPriority === 'all' || it.priority === filterPriority)
      .filter(it => !q || `${it.title} ${it.body} ${it.author_name || ''} ${it.author_email || ''} ${(it.tags || []).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => sort === 'votes' ? b.vote_count - a.vote_count
        : sort === 'priority' ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.created_at.localeCompare(a.created_at)
        : b.created_at.localeCompare(a.created_at));
  }, [items, filterType, filterStatus, filterPriority, search, sort]);

  if (authLoading || (loading && user?.id === ADMIN_UID)) return <TabSkeleton />;
  if (user?.id !== ADMIN_UID) return null;

  const count = (pred: (i: FeedbackItem) => boolean) => items.filter(pred).length;
  const created = (i: FeedbackItem) => i.created_at;
  const week = windowCounts(items, created, 7);
  const resolvedRate = items.length ? (count(i => i.status === 'resolved') / items.length) * 100 : 0;
  const toggleStatus = (st: FStatus) => () => setFilterStatus(cur => (cur === st ? 'active' : st));

  return (
    <AdminPage>
      <PageHeader
        icon={<MessageSquareText className="h-5 w-5" />}
        title="Feedback"
        description="Bug reports, feature requests and testimonials from users."
        meta={<>{week.current} new this week · {resolvedRate.toFixed(0)}% resolved overall</>}
        actions={
          <>
            <ActionButton icon={<RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />} onClick={fetchItems} disabled={refreshing}>Refresh</ActionButton>
            <Link href="/feedback" className="inline-flex items-center gap-1.5 rounded-xl border border-surface-800 px-3 py-2 text-xs font-semibold text-surface-300 hover:text-white">
              Public portal <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />

      <StatGrid
        cols={5}
        layoutGroup="feedback"
        items={[
          { label: 'Open', value: count(i => i.status === 'open'), tone: 'blue', onClick: toggleStatus('open'), active: filterStatus === 'open', spark: dailySpark(items.filter(i => i.status === 'open'), created) },
          { label: 'In progress', value: count(i => i.status === 'in_progress'), tone: 'brand', onClick: toggleStatus('in_progress'), active: filterStatus === 'in_progress' },
          { label: 'Planned', value: count(i => i.status === 'planned'), tone: 'violet', onClick: toggleStatus('planned'), active: filterStatus === 'planned' },
          { label: 'Critical (active)', value: count(i => i.priority === 'critical' && ACTIVE_STATUSES.includes(i.status)), tone: 'red', hint: 'Critical items not yet closed', onClick: () => { setFilterPriority(p => (p === 'critical' ? 'all' : 'critical')); setFilterStatus('active'); }, active: filterPriority === 'critical' },
          { label: 'Testimonials to approve', value: count(i => i.type === 'testimonial' && !i.is_approved), tone: 'amber', onClick: () => { setFilterType(t => (t === 'testimonial' ? 'all' : 'testimonial')); setFilterStatus('all'); }, active: filterType === 'testimonial' },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <TrendPanel
          id="feedback"
            stacked
          className="lg:col-span-3"
          title="Incoming feedback"
          subtitle="Submissions over time, by type"
          sources={(['bug_report', 'feature_request', 'testimonial'] as FType[]).map(t => ({
            key: t, label: TYPE_META[t].label, color: TYPE_COLOR[t], rows: items.filter(i => i.type === t), time: created,
          }))}
        />
        <Panel title="Where things stand" subtitle="All items by status" className="lg:col-span-2">
          <BarList items={tally(items, i => STATUS_META[i.status]?.label ?? i.status)} color={SERIES.blue} limit={6} />
          <div className="mt-4 border-t border-surface-800 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">Most voted (active)</p>
            <ul className="space-y-1">
              {[...items].filter(i => ACTIVE_STATUSES.includes(i.status)).sort((a, b) => b.vote_count - a.vote_count).slice(0, 4).map(i => (
                <li key={i.id}>
                  <button onClick={() => setSelected(i)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs hover:bg-surface-800/50">
                    <span className="w-8 shrink-0 font-semibold tabular-nums text-brand-300">▲{i.vote_count}</span>
                    <span className="truncate text-surface-300">{i.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, body, author or tag…" />
        <Segmented
          id="feedback-type"
          value={filterType}
          onChange={setFilterType}
          options={[{ key: 'all' as const, label: 'All' }, ...(Object.keys(TYPE_META) as FType[]).map(k => ({ key: k, label: `${TYPE_META[k].emoji} ${TYPE_META[k].label}` }))]}
        />
      </Toolbar>
      <Toolbar>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FStatus | 'all' | 'active')} className={cn(fieldClass, 'w-auto py-2')} aria-label="Status">
          <option value="active">Active (not closed)</option>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as FPriority | 'all')} className={cn(fieldClass, 'w-auto py-2')} aria-label="Priority">
          <option value="all">All priorities</option>
          {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Segmented id="feedback-sort" size="sm" value={sort} onChange={setSort} options={[{ key: 'newest', label: 'Newest' }, { key: 'votes', label: 'Votes' }, { key: 'priority', label: 'Priority' }]} />
        <span className="text-xs text-surface-500 sm:ml-auto">{visible.length} of {items.length}</span>
      </Toolbar>

      {visible.length === 0 ? (
        <EmptyState icon={<MessageSquareText className="h-8 w-8" />} title="Nothing here" description="No feedback matches these filters." />
      ) : (
        <Reveal className="overflow-hidden rounded-2xl border border-surface-800 bg-surface-900/40">
          <ul className="divide-y divide-surface-800/70">
            {visible.slice(0, 300).map((item, i) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 20) * 0.02 }}
                onClick={() => setSelected(item)}
                className={cn('flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors', selected?.id === item.id ? 'bg-brand-500/[0.06]' : 'hover:bg-surface-800/30')}
              >
                <span className="mt-0.5 text-lg" title={TYPE_META[item.type].label}>{TYPE_META[item.type].emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-surface-100">{item.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-surface-500">
                    <Pill tone={PRIORITY_TONE[item.priority]} dot>{PRIORITY_META[item.priority].label}</Pill>
                    {(item.tags || []).slice(0, 3).map(t => <Pill key={t}>{t}</Pill>)}
                    <span>{item.author_name ?? item.author_email ?? 'Anonymous'}</span>
                    <span>· {timeAgo(item.created_at)}</span>
                    {item.comment_count > 0 && <span>· {item.comment_count} comments</span>}
                  </div>
                  {item.admin_note && <p className="mt-1 truncate text-[11px] text-amber-300/70">📍 {item.admin_note}</p>}
                </div>
                <span className="hidden w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-surface-400 sm:block">▲ {item.vote_count}</span>
                <select
                  value={item.status}
                  onClick={e => e.stopPropagation()}
                  onChange={async e => {
                    const newStatus = e.target.value as FStatus;
                    const { error } = await supabase.from('feedback_items').update({ status: newStatus }).eq('id', item.id);
                    if (error) { toast.error('Update failed'); return; }
                    applyPatch(item.id, { status: newStatus });
                  }}
                  className={cn('shrink-0 cursor-pointer rounded-md border bg-transparent px-2 py-1 text-[11px] font-semibold focus:outline-none', STATUS_META[item.status].color)}
                  aria-label="Status"
                >
                  {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k} className="bg-surface-900 text-white">{v.label}</option>)}
                </select>
              </motion.li>
            ))}
          </ul>
          {visible.length > 300 && <p className="border-t border-surface-800 py-2 text-center text-[11px] text-surface-600">Showing 300 of {visible.length} — narrow the filters to see more</p>}
        </Reveal>
      )}

      <AnimatePresence>
        {selected && (
          <DetailDrawer
            key={selected.id}
            item={selected}
            onClose={() => setSelected(null)}
            onUpdate={patch => applyPatch(selected.id, patch)}
          />
        )}
      </AnimatePresence>
    </AdminPage>
  );
}
