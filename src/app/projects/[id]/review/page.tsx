'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, LoadingPage, toast, ToastContainer } from '@/components/ui';

// ============================================================
// Client Review Portal — Pro Feature
// Manage share links for external review and track feedback.
// All operations backed by Supabase: external_shares + comments.
// ============================================================

type SharePermissions = {
  can_comment?: boolean;
  can_download?: boolean;
};

type ShareLink = {
  id: string;
  project_id: string;
  share_type: 'script' | 'budget' | 'schedule' | 'full';
  access_token: string;
  recipient_email: string | null;
  recipient_name: string | null;
  permissions: SharePermissions;
  expires_at: string | null;
  is_active: boolean;
  last_accessed_at: string | null;
  created_by: string;
  created_at: string;
};

type CommentWithAuthor = {
  id: string;
  project_id: string;
  user_id: string | null;
  target_type: string | null;
  target_id: string | null;
  content: string;
  is_resolved: boolean;
  parent_id: string | null;
  created_at: string;
  profiles: {
    display_name: string | null;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  replies?: CommentWithAuthor[];
};

type Tab = 'links' | 'comments';

// ────────────────────────────────────────────
// Create Share Link Modal
// ────────────────────────────────────────────
function CreateShareModal({
  onClose,
  onCreate,
  saving,
}: {
  onClose: () => void;
  onCreate: (data: {
    recipient_name: string;
    recipient_email: string;
    share_type: ShareLink['share_type'];
    permissions: SharePermissions;
    expires_at: string;
  }) => void;
  saving: boolean;
}) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [shareType, setShareType] = useState<ShareLink['share_type']>('script');
  const [canComment, setCanComment] = useState(true);
  const [canDownload, setCanDownload] = useState(false);
  const [expiresIn, setExpiresIn] = useState('14');

  const handleSubmit = () => {
    const expiryDate = new Date(
      Date.now() + parseInt(expiresIn) * 24 * 60 * 60 * 1000
    ).toISOString();
    onCreate({
      recipient_name: recipientName.trim(),
      recipient_email: recipientEmail.trim(),
      share_type: shareType,
      permissions: { can_comment: canComment, can_download: canDownload },
      expires_at: expiryDate,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg p-6 rounded-xl border border-surface-800 bg-surface-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-5">Create Share Link</h2>

        <div className="space-y-4">
          {/* Recipient */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Recipient Name
              </label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Recipient Email
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="jane@studio.com"
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Share Type */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Share Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['script', 'budget', 'schedule', 'full'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setShareType(t)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                    shareType === t
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                      : 'border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canComment}
                  onChange={(e) => setCanComment(e.target.checked)}
                  className="rounded border-surface-600 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-surface-300">Can leave comments</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canDownload}
                  onChange={(e) => setCanDownload(e.target.checked)}
                  className="rounded border-surface-600 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-surface-300">Can download</span>
              </label>
            </div>
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Link Expires In
            </label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors"
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-surface-800">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            Create Link
          </Button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Comment Thread Component
// ────────────────────────────────────────────
function CommentThread({
  comment,
  onResolve,
  onReply,
}: {
  comment: CommentWithAuthor;
  onResolve: (id: string, resolved: boolean) => void;
  onReply: (parentId: string, content: string) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const authorName =
    comment.profiles?.display_name ||
    comment.profiles?.full_name ||
    comment.profiles?.email ||
    'Unknown';
  const initials = authorName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    await onReply(comment.id, replyText.trim());
    setReplyText('');
    setShowReply(false);
    setSubmitting(false);
  };

  return (
    <div className="p-4 rounded-xl bg-surface-900/80 border border-surface-800">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {comment.profiles?.avatar_url ? (
          <img
            src={comment.profiles.avatar_url}
            alt={authorName}
            className="w-8 h-8 rounded-full shrink-0 object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-300 shrink-0">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{authorName}</span>
              <span className="text-xs text-surface-500">
                {new Date(comment.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {comment.target_type && (
                <Badge variant="info" size="sm">
                  {comment.target_type}
                </Badge>
              )}
              <Badge variant={comment.is_resolved ? 'success' : 'warning'} size="sm">
                {comment.is_resolved ? 'Resolved' : 'Open'}
              </Badge>
            </div>
          </div>

          <p className="text-sm text-surface-300 mt-1.5 whitespace-pre-wrap">{comment.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => onResolve(comment.id, !comment.is_resolved)}
              className="text-xs text-surface-500 hover:text-amber-400 transition-colors"
            >
              {comment.is_resolved ? 'Reopen' : 'Resolve'}
            </button>
            <button
              onClick={() => setShowReply(!showReply)}
              className="text-xs text-surface-500 hover:text-amber-400 transition-colors"
            >
              Reply
            </button>
          </div>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-3 pl-4 border-l-2 border-surface-800">
              {comment.replies.map((reply) => {
                const rName =
                  reply.profiles?.display_name ||
                  reply.profiles?.full_name ||
                  reply.profiles?.email ||
                  'Unknown';
                return (
                  <div key={reply.id} className="flex items-start gap-2">
                    {reply.profiles?.avatar_url ? (
                      <img
                        src={reply.profiles.avatar_url}
                        alt={rName}
                        className="w-6 h-6 rounded-full shrink-0 object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-[10px] font-bold text-surface-400 shrink-0">
                        {rName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{rName}</span>
                        <span className="text-[10px] text-surface-500">
                          {new Date(reply.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-surface-400 mt-0.5">{reply.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reply Input */}
          {showReply && (
            <div className="mt-3 flex gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-500 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              <Button size="sm" onClick={handleReply} loading={submitting} disabled={!replyText.trim()}>
                Send
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────
export default function ClientReviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();
  const { user } = useAuth();
  const { isPro } = useProFeatures();
  const { currentProject } = useProjectStore();
  const hasProAccess = isPro || currentProject?.pro_enabled === true;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('links');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingLink, setSavingLink] = useState(false);

  // Share links
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);

  // Comments
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [commentFilter, setCommentFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // ─── Data Loading ───
  const loadShareLinks = useCallback(async () => {
    const { data, error } = await supabase
      .from('external_shares')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load share links:', error);
      toast.error('Failed to load share links');
      return;
    }
    setShareLinks((data as ShareLink[]) || []);
  }, [projectId, supabase]);

  const loadComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles:user_id(display_name, full_name, email, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load comments:', error);
      toast.error('Failed to load comments');
      return;
    }

    // Nest replies under their parent comments
    const all = (data || []) as CommentWithAuthor[];
    const topLevel: CommentWithAuthor[] = [];
    const replyMap = new Map<string, CommentWithAuthor[]>();

    for (const c of all) {
      if (c.parent_id) {
        const existing = replyMap.get(c.parent_id) || [];
        existing.push(c);
        replyMap.set(c.parent_id, existing);
      } else {
        topLevel.push(c);
      }
    }

    for (const t of topLevel) {
      t.replies = (replyMap.get(t.id) || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    setComments(topLevel);
  }, [projectId, supabase]);

  useEffect(() => {
    if (!hasProAccess) {
      setLoading(false);
      return;
    }
    Promise.all([loadShareLinks(), loadComments()]).finally(() => setLoading(false));
  }, [hasProAccess, loadShareLinks, loadComments]);

  // ─── Share Link Actions ───
  const createShareLink = async (data: {
    recipient_name: string;
    recipient_email: string;
    share_type: ShareLink['share_type'];
    permissions: SharePermissions;
    expires_at: string;
  }) => {
    if (!user) return;
    setSavingLink(true);

    const accessToken = crypto.randomUUID();
    const { error } = await supabase.from('external_shares').insert({
      project_id: projectId,
      share_type: data.share_type,
      access_token: accessToken,
      recipient_email: data.recipient_email || null,
      recipient_name: data.recipient_name || null,
      permissions: data.permissions,
      expires_at: data.expires_at,
      is_active: true,
      created_by: user.id,
    });

    if (error) {
      console.error('Failed to create share link:', error);
      toast.error('Failed to create share link');
      setSavingLink(false);
      return;
    }

    toast.success('Share link created');
    setShowCreateModal(false);
    setSavingLink(false);
    await loadShareLinks();
  };

  const toggleLinkActive = async (link: ShareLink) => {
    const { error } = await supabase
      .from('external_shares')
      .update({ is_active: !link.is_active })
      .eq('id', link.id);

    if (error) {
      toast.error('Failed to update link');
      return;
    }
    toast.success(link.is_active ? 'Link deactivated' : 'Link activated');
    setShareLinks((prev) =>
      prev.map((l) => (l.id === link.id ? { ...l, is_active: !l.is_active } : l))
    );
  };

  const deleteLink = async (id: string) => {
    const { error } = await supabase.from('external_shares').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete link');
      return;
    }
    toast.success('Link deleted');
    setShareLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const copyLink = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    navigator.clipboard.writeText(`${origin}/share/${token}`);
    toast.success('Link copied to clipboard');
  };

  // ─── Comment Actions ───
  const resolveComment = async (id: string, resolved: boolean) => {
    const { error } = await supabase
      .from('comments')
      .update({ is_resolved: resolved })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update comment');
      return;
    }
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_resolved: resolved } : c))
    );
    toast.success(resolved ? 'Comment resolved' : 'Comment reopened');
  };

  const replyToComment = async (parentId: string, content: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('comments')
      .insert({
        project_id: projectId,
        user_id: user.id,
        content,
        parent_id: parentId,
        is_resolved: false,
      })
      .select('*, profiles:user_id(display_name, full_name, email, avatar_url)')
      .single();

    if (error) {
      toast.error('Failed to post reply');
      return;
    }

    // Append reply under parent
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === parentId) {
          return { ...c, replies: [...(c.replies || []), data as CommentWithAuthor] };
        }
        return c;
      })
    );
    toast.success('Reply posted');
  };

  // ─── Computed Stats ───
  const stats = useMemo(() => {
    const totalShares = shareLinks.length;
    const activeShares = shareLinks.filter((l) => l.is_active).length;

    let totalComments = comments.length;
    let unresolvedComments = 0;
    for (const c of comments) {
      if (!c.is_resolved) unresolvedComments++;
      totalComments += (c.replies || []).length;
    }

    return { totalShares, activeShares, totalComments, unresolvedComments };
  }, [shareLinks, comments]);

  const filteredComments = useMemo(() => {
    if (commentFilter === 'all') return comments;
    if (commentFilter === 'open') return comments.filter((c) => !c.is_resolved);
    return comments.filter((c) => c.is_resolved);
  }, [comments, commentFilter]);

  // ─── Helpers ───
  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isExpired = (link: ShareLink) => {
    if (!link.expires_at) return false;
    return new Date(link.expires_at) < new Date();
  };

  const shareTypeIcon = (type: string) => {
    switch (type) {
      case 'script':
        return '📝';
      case 'budget':
        return '💰';
      case 'schedule':
        return '📅';
      case 'full':
        return '📦';
      default:
        return '📄';
    }
  };

  // ─── Pro Gate ───
  if (!hasProAccess) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md p-8 text-center">
          <div className="text-4xl mb-4">👁️</div>
          <h2 className="text-xl font-bold text-white mb-2">Client Review Portal</h2>
          <p className="text-sm text-surface-400 mb-6">
            Share scripts with clients for feedback and approval — without needing them to create an
            account.
          </p>
          <Button onClick={() => (window.location.href = '/pro')}>Upgrade to Pro</Button>
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingPage />;

  // ─── Render ───
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Review</h1>
          <p className="text-sm text-surface-400 mt-1">
            Share project materials and manage reviewer feedback
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Share Link
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Shares', value: stats.totalShares, icon: '🔗', highlight: false },
          { label: 'Active Links', value: stats.activeShares, icon: '✅', highlight: false },
          { label: 'Total Comments', value: stats.totalComments, icon: '💬', highlight: false },
          {
            label: 'Unresolved',
            value: stats.unresolvedComments,
            icon: '⚠️',
            highlight: stats.unresolvedComments > 0,
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">{s.icon}</span>
              <div>
                <p
                  className={`text-xl font-bold ${
                    s.highlight ? 'text-amber-400' : 'text-white'
                  }`}
                >
                  {s.value}
                </p>
                <p className="text-xs text-surface-500">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-800">
        {(['links', 'comments'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-amber-400'
                : 'text-surface-400 hover:text-white'
            }`}
          >
            {tab === 'links' ? 'Share Links' : 'Review Comments'}
            {tab === 'comments' && stats.unresolvedComments > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                {stats.unresolvedComments}
              </span>
            )}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* TAB: Share Links                        */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === 'links' && (
        <>
          {shareLinks.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🔗</div>
              <h3 className="text-lg font-semibold text-white mb-2">No share links yet</h3>
              <p className="text-sm text-surface-400 mb-6 max-w-md mx-auto">
                Create a share link to let clients, producers, or stakeholders review your project
                materials without creating an account.
              </p>
              <Button onClick={() => setShowCreateModal(true)}>Create First Share Link</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {shareLinks.map((link) => {
                const expired = isExpired(link);
                const statusVariant = !link.is_active
                  ? 'default'
                  : expired
                  ? 'error'
                  : 'success';
                const statusLabel = !link.is_active
                  ? 'Inactive'
                  : expired
                  ? 'Expired'
                  : 'Active';

                return (
                  <Card key={link.id} className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">{shareTypeIcon(link.share_type)}</span>
                          <span className="text-sm font-semibold text-white capitalize">
                            {link.share_type} share
                          </span>
                          <Badge variant={statusVariant}>{statusLabel}</Badge>
                          {link.permissions?.can_comment && (
                            <Badge variant="info" size="sm">
                              Comments
                            </Badge>
                          )}
                          {link.permissions?.can_download && (
                            <Badge variant="info" size="sm">
                              Download
                            </Badge>
                          )}
                        </div>

                        {/* Recipient */}
                        <div className="flex items-center gap-4 text-xs text-surface-400">
                          {link.recipient_name && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {link.recipient_name}
                            </span>
                          )}
                          {link.recipient_email && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {link.recipient_email}
                            </span>
                          )}
                        </div>

                        {/* Dates */}
                        <div className="flex items-center gap-4 text-[11px] text-surface-500">
                          <span>Created {formatDate(link.created_at)}</span>
                          <span>Expires {formatDate(link.expires_at)}</span>
                          {link.last_accessed_at && (
                            <span>Last viewed {formatDate(link.last_accessed_at)}</span>
                          )}
                        </div>

                        {/* Shareable URL */}
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            readOnly
                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/${link.access_token}`}
                            className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs text-surface-400 font-mono outline-none"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => copyLink(link.access_token)}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </Button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex sm:flex-col gap-2 sm:items-end shrink-0">
                        <Button
                          size="sm"
                          variant={link.is_active ? 'outline' : 'primary'}
                          onClick={() => toggleLinkActive(link)}
                        >
                          {link.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (confirm('Delete this share link? This cannot be undone.')) {
                              deleteLink(link.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: Review Comments                    */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === 'comments' && (
        <>
          {/* Filter */}
          <div className="flex items-center gap-2">
            {(['all', 'open', 'resolved'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCommentFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  commentFilter === f
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-surface-800 text-surface-400 border border-surface-700 hover:text-white'
                }`}
              >
                {f}
                {f === 'open' && stats.unresolvedComments > 0 && (
                  <span className="ml-1 text-amber-500">({stats.unresolvedComments})</span>
                )}
              </button>
            ))}
          </div>

          {filteredComments.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">💬</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {commentFilter === 'all'
                  ? 'No comments yet'
                  : commentFilter === 'open'
                  ? 'No open comments'
                  : 'No resolved comments'}
              </h3>
              <p className="text-sm text-surface-400 max-w-md mx-auto">
                {commentFilter === 'all'
                  ? 'Comments from reviewers will appear here. Share a link to start collecting feedback.'
                  : 'Try switching the filter above.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredComments.map((c) => (
                <CommentThread
                  key={c.id}
                  comment={c}
                  onResolve={resolveComment}
                  onReply={replyToComment}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateShareModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createShareLink}
          saving={savingLink}
        />
      )}

      <ToastContainer />
    </div>
  );
}
