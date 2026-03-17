'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Badge, Input, Textarea, LoadingSpinner, Select, toast } from '@/components/ui';
import { cn, timeAgo, formatDate } from '@/lib/utils';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Metadata helpers ─────────────────────────────────────────────────────────

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

// ─── Panel component (right drawer) ───────────────────────────────────────────

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
      <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Internal Note</label>
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
      <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Tags (comma separated)</label>
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
      <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Link Duplicate / Related</label>
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

// ─── Detail drawer ─────────────────────────────────────────────────────────────

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
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl bg-surface-950 border-l border-surface-800 flex flex-col overflow-hidden">
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
          <button onClick={onClose} className="text-surface-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Quick status / priority row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Status</label>
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Priority</label>
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Visibility</label>
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Approved</label>
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500 block mb-1">Description</label>
            <p className="text-sm text-surface-300 whitespace-pre-wrap">{item.body}</p>
          </div>

          {/* Bug-specific fields */}
          {item.type === 'bug_report' && (item.steps_to_reproduce || item.expected_behavior || item.actual_behavior || item.browser_info) && (
            <div className="space-y-3 border border-surface-800 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Bug Details</p>
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-surface-500 block mb-1">Use Case</label>
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Linked Items</p>
              {similarLinks.map(l => l.similar && (
                <Link
                  key={l.id}
                  href={`/feedback/${l.similar.id}`}
                  className="flex items-center gap-2 text-sm text-blue-400 hover:underline"
                >
                  {TYPE_META[l.similar.type].emoji} {l.similar.title}
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', STATUS_META[l.similar.status].color)}>
                    {STATUS_META[l.similar.status].label}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Admin timeline */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500 mb-3">Admin Timeline</p>
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
                          <span className="text-[10px] text-surface-600">{timeAgo(c.created_at)}</span>
                          {!c.is_public && <span className="text-[9px] px-1 py-0.5 rounded bg-surface-800 text-surface-500 uppercase tracking-wide">internal</span>}
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Add Timeline Entry</p>
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
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AdminFeedbackPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<FType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<FPriority | 'all'>('all');
  const [search, setSearch] = useState('');

  // Stats
  const [stats, setStats] = useState({ open: 0, inProgress: 0, critical: 0, pendingTestimonials: 0 });

  // Auth guard
  useEffect(() => {
    if (!authLoading && user?.id !== ADMIN_UID) {
      router.replace('/');
    }
  }, [user, authLoading]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('feedback_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterType !== 'all') q = q.eq('type', filterType);
    if (filterStatus !== 'all') q = q.eq('status', filterStatus);
    if (filterPriority !== 'all') q = q.eq('priority', filterPriority);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);

    const { data, error } = await q.limit(200);
    if (error) { toast.error('Failed to load feedback'); setLoading(false); return; }
    const rows = (data as FeedbackItem[]) ?? [];
    setItems(rows);
    setStats({
      open: rows.filter(r => r.status === 'open').length,
      inProgress: rows.filter(r => r.status === 'in_progress').length,
      critical: rows.filter(r => r.priority === 'critical').length,
      pendingTestimonials: rows.filter(r => r.type === 'testimonial' && !r.is_approved).length,
    });
    setLoading(false);
  }, [filterType, filterStatus, filterPriority, search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const applyPatch = (id: string, patch: Partial<FeedbackItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...patch } : null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (user?.id !== ADMIN_UID) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950 text-white">

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="w-64 flex flex-col border-r border-surface-800 bg-surface-950 shrink-0">
        <div className="border-b border-surface-800 p-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">A</div>
            </Link>
            <div>
              <h2 className="text-sm font-semibold text-white">Admin Panel</h2>
              <p className="text-[11px] text-surface-500">Platform Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {([
            { href: '/admin', label: 'Overview', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
            { href: '/admin?tab=users', label: 'Users', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
            { href: '/admin?tab=projects', label: 'Projects', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
            { href: '/admin?tab=system', label: 'System', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
            { href: '/admin?tab=blog', label: 'Blog', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg> },
            { href: '/admin?tab=community', label: 'Community', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
          ] as { href: string; label: string; icon: React.ReactNode }[]).map(item => (
            <Link key={item.href} href={item.href}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
              {item.icon}{item.label}
            </Link>
          ))}

          <div className="mt-4 pt-4 border-t border-surface-800">
            <p className="px-3 py-1 text-[10px] text-surface-600 uppercase tracking-wider font-medium">Tools</p>
            <Link href="/admin/legal" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
              Legal Blog
            </Link>
            <Link href="/admin/security" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Security
            </Link>
            <Link href="/admin/reports" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>
              Reports
            </Link>
            <Link href="/admin/features" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
              Feature Flags
            </Link>
            <Link href="/admin/changelog" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              Changelog
            </Link>
            <Link href="/admin/feedback"
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium bg-[#E54E15]/10 text-[#FF5F1F] transition-all duration-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" /></svg>
              Feedback
            </Link>
          </div>
        </nav>

        <div className="border-t border-surface-800 p-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs text-surface-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="border-b border-surface-800 sticky top-0 z-10 bg-surface-950">
          <div className="px-6 py-4 flex items-center gap-4">
            <h1 className="text-sm font-semibold">Feedback</h1>
            <div className="flex-1" />
            <Link href="/feedback" className="text-sm text-orange-400 hover:text-orange-300">View Public Portal →</Link>
          </div>
        </div>

      <div className="px-6 py-8 space-y-6">

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Open', value: stats.open, color: 'text-blue-400' },
            { label: 'In Progress', value: stats.inProgress, color: 'text-orange-400' },
            { label: 'Critical', value: stats.critical, color: 'text-red-400' },
            { label: 'Testimonials Pending', value: stats.pendingTestimonials, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-surface-900 border border-surface-800 rounded-xl p-4">
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-[11px] text-surface-500 uppercase tracking-widest mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search titles…"
            className="w-48 text-sm"
          />

          {/* Type filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as FType | 'all')}
            className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as FStatus | 'all')}
            className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as FPriority | 'all')}
            className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <button
            onClick={fetchItems}
            className="text-sm text-surface-400 hover:text-white border border-surface-700 rounded-lg px-3 py-2"
          >
            Refresh
          </button>

          <span className="text-sm text-surface-500 ml-auto">{items.length} items</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-surface-600">No feedback items found.</div>
        ) : (
          <div className="border border-surface-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 bg-surface-900/50">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-surface-500 w-8"></th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-surface-500">Title</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-surface-500 hidden md:table-cell">Author</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-surface-500">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-surface-500 hidden lg:table-cell">Priority</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-surface-500 hidden lg:table-cell">Votes</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-surface-500 hidden xl:table-cell">Submitted</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={cn(
                      'border-b border-surface-800/50 cursor-pointer transition-colors',
                      selected?.id === item.id
                        ? 'bg-orange-500/5 border-orange-500/20'
                        : 'hover:bg-surface-900/50',
                      i === items.length - 1 && 'border-b-0'
                    )}
                  >
                    <td className="px-4 py-3 text-lg">{TYPE_META[item.type].emoji}</td>
                    <td className="px-4 py-3 max-w-[300px]">
                      <p className="truncate text-surface-200">{item.title}</p>
                      {item.admin_note && (
                        <p className="text-[11px] text-yellow-500/70 truncate mt-0.5">📍 {item.admin_note}</p>
                      )}
                      {item.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {item.tags.slice(0, 3).map(t => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-500">{t}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-surface-400 text-xs truncate max-w-[140px]">
                        {item.author_name ?? item.author_email ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.status}
                        onClick={e => e.stopPropagation()}
                        onChange={async e => {
                          e.stopPropagation();
                          const newStatus = e.target.value as FStatus;
                          await supabase.from('feedback_items').update({ status: newStatus }).eq('id', item.id);
                          applyPatch(item.id, { status: newStatus });
                        }}
                        className={cn(
                          'rounded px-2 py-1 text-xs border bg-transparent cursor-pointer focus:outline-none',
                          STATUS_META[item.status].color
                        )}
                      >
                        {Object.entries(STATUS_META).map(([k, v]) => (
                          <option key={k} value={k} className="bg-surface-900 text-white">{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full', PRIORITY_META[item.priority].dot)} />
                        <span className="text-xs text-surface-400">{PRIORITY_META[item.priority].label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-surface-500">
                      ▲ {item.vote_count}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-xs text-surface-500">
                      {timeAgo(item.created_at)}
                    </td>
                    <td className="px-4 py-3 text-surface-600 text-xs">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </main>

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          item={selected}
          onClose={() => setSelected(null)}
          onUpdate={patch => applyPatch(selected.id, patch)}
        />
      )}
    </div>
  );
}

