'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Input, Textarea, EmptyState, LoadingSpinner, Avatar } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import { sendNotification, notifyProjectMembers } from '@/lib/notifications';
import type { Comment, Profile, CommentType, ScriptElement } from '@/lib/types';
import { ELEMENT_LABELS } from '@/lib/types';

// Recursive comment component for infinite nesting
function CommentThread({ comment, allComments, depth, canEdit, userId, projectId, onReply, onResolve, onDelete }: {
  comment: Comment & { profile?: Profile };
  allComments: (Comment & { profile?: Profile })[];
  depth: number;
  canEdit: boolean;
  userId: string;
  projectId: string;
  onReply: (parentId: string, content: string, type: CommentType) => Promise<void>;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyType, setReplyType] = useState<CommentType>('note');
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const replies = allComments.filter(c => c.parent_id === comment.id);
  const maxIndent = 6;
  const indent = Math.min(depth, maxIndent);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    await onReply(comment.id, replyContent.trim(), replyType);
    setReplyContent('');
    setShowReply(false);
    setSubmitting(false);
  };

  const typeColors: Record<string, string> = {
    note: 'border-l-surface-600',
    suggestion: 'border-l-blue-500',
    issue: 'border-l-red-500',
    resolved: 'border-l-green-500',
  };

  const typeLabels: Record<string, string> = {
    note: '', suggestion: 'Suggestion', issue: 'Issue', resolved: 'Resolved',
  };

  return (
    <div className={cn(depth > 0 && 'ml-3 sm:ml-5')}>
      <div className={cn(
        'border-l-2 rounded-r-lg pl-3 py-2 pr-2 mb-1 transition-colors',
        typeColors[comment.comment_type] || 'border-l-surface-700',
        comment.is_resolved && 'opacity-50'
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Avatar src={comment.profile?.avatar_url} name={comment.profile?.full_name || 'User'} size="sm" />
          <span className="text-xs font-medium text-surface-300">
            {comment.profile?.full_name || comment.profile?.email || 'Anonymous'}
          </span>
          {typeLabels[comment.comment_type] && (
            <Badge size="sm" variant={comment.comment_type === 'issue' ? 'error' : comment.comment_type === 'suggestion' ? 'info' : 'success'}>
              {typeLabels[comment.comment_type]}
            </Badge>
          )}
          {comment.is_resolved && <Badge size="sm" variant="success">Resolved</Badge>}
          <span className="text-[10px] text-surface-600">{timeAgo(comment.created_at)}</span>
          {replies.length > 0 && (
            <button onClick={() => setCollapsed(!collapsed)} className="text-[10px] text-surface-500 hover:text-white ml-auto">
              {collapsed ? `+${replies.length} replies` : ''}
            </button>
          )}
        </div>

        {/* Content */}
        <p className="text-sm text-surface-300 whitespace-pre-wrap">{comment.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-1.5">
          <button onClick={() => setShowReply(!showReply)} className="text-[11px] text-surface-500 hover:text-brand-400 transition-colors">
            Reply
          </button>
          {canEdit && comment.comment_type === 'issue' && !comment.is_resolved && (
            <button onClick={() => onResolve(comment.id)} className="text-[11px] text-surface-500 hover:text-green-400 transition-colors">
              Resolve
            </button>
          )}
          {(comment.created_by === userId) && (
            <button onClick={() => onDelete(comment.id)} className="text-[11px] text-surface-500 hover:text-red-400 transition-colors">
              Delete
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReply && (
          <div className="mt-2 space-y-2">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              rows={2}
              className="text-sm"
            />
            <div className="flex items-center gap-2">
              <select
                value={replyType}
                onChange={(e) => setReplyType(e.target.value as CommentType)}
                className="rounded-lg border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white"
              >
                <option value="note">Note</option>
                <option value="suggestion">Suggestion</option>
                <option value="issue">Issue</option>
              </select>
              <Button size="sm" onClick={handleSubmitReply} loading={submitting}>Reply</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowReply(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {/* Nested replies */}
      {!collapsed && replies.length > 0 && (
        <div>
          {replies.map(reply => (
            <CommentThread
              key={reply.id}
              comment={reply}
              allComments={allComments}
              depth={depth + 1}
              canEdit={canEdit}
              userId={userId}
              projectId={projectId}
              onReply={onReply}
              onResolve={onResolve}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';
  const [comments, setComments] = useState<(Comment & { profile?: Profile })[]>([]);
  const [scriptElements, setScriptElements] = useState<ScriptElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<CommentType>('note');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'issues' | 'suggestions' | 'unresolved' | 'script'>('all');

  useEffect(() => { fetchComments(); }, [params.id]);

  // Subscribe to realtime for new comments
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`comments:${params.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `project_id=eq.${params.id}`,
      }, () => {
        fetchComments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  const fetchComments = async () => {
    try {
      const supabase = createClient();
      // Fetch ALL comments (project-level + script element)
      const { data, error } = await supabase
        .from('comments')
        .select('*, profile:profiles!created_by(*)')
        .eq('project_id', params.id)
        .order('created_at', { ascending: true });
      if (error) console.error('Comments fetch error:', error.message);
      setComments(data || []);

      // Fetch script elements for inline comment context
      const scriptRes = await supabase
        .from('script_elements')
        .select('*')
        .eq('script_id', (await supabase.from('scripts').select('id').eq('project_id', params.id).limit(1).single()).data?.id || '')
        .order('sort_order');
      setScriptElements((scriptRes.data as ScriptElement[]) || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!newContent.trim() || !user) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from('comments').insert({
      project_id: params.id,
      entity_type: 'project',
      entity_id: params.id,
      parent_id: null,
      content: newContent.trim(),
      comment_type: newType,
      created_by: user.id,
    });
    if (error) {
      alert('Failed to post: ' + error.message);
    } else {
      // Notify project members
      notifyProjectMembers({
        projectId: params.id,
        actorId: user.id,
        type: 'project_comment',
        title: `New ${newType} on ${currentProject?.title || 'project'}`,
        body: newContent.trim().slice(0, 120),
        link: `/projects/${params.id}/comments`,
        entityType: 'comment',
      });
      setNewContent('');
      setNewType('note');
      await fetchComments();
    }
    setSubmitting(false);
  };

  const handleReply = async (parentId: string, content: string, type: CommentType) => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from('comments').insert({
      project_id: params.id,
      entity_type: 'project',
      entity_id: params.id,
      parent_id: parentId,
      content,
      comment_type: type,
      created_by: user.id,
    });
    await fetchComments();
  };

  const handleResolve = async (id: string) => {
    const supabase = createClient();
    await supabase.from('comments').update({ is_resolved: true, resolved_by: user?.id, comment_type: 'resolved' }).eq('id', id);
    await fetchComments();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this comment?')) return;
    const supabase = createClient();
    await supabase.from('comments').delete().eq('id', id);
    await fetchComments();
  };

  // Filter comments
  const rootComments = comments.filter(c => !c.parent_id);
  const filteredRoots = rootComments.filter(c => {
    if (filter === 'issues') return c.comment_type === 'issue';
    if (filter === 'suggestions') return c.comment_type === 'suggestion';
    if (filter === 'unresolved') return c.comment_type === 'issue' && !c.is_resolved;
    if (filter === 'script') return c.entity_type === 'script_element';
    return true;
  });

  const issueCount = comments.filter(c => c.comment_type === 'issue' && !c.is_resolved).length;
  const scriptCommentCount = comments.filter(c => c.entity_type === 'script_element' && !c.parent_id).length;

  // Script element lookup for comment context
  const elementMap = new Map(scriptElements.map(e => [e.id, e]));

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Comments</h1>
          <p className="text-sm text-surface-400 mt-1">
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
            {scriptCommentCount > 0 && <span className="text-brand-400"> &bull; {scriptCommentCount} on script</span>}
            {issueCount > 0 && <span className="text-red-400"> &bull; {issueCount} open issue{issueCount !== 1 ? 's' : ''}</span>}
          </p>
        </div>
      </div>

      {/* New comment form — viewers can comment too */}
      <Card className="p-4 mb-6">
        <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write a comment, suggestion, or flag an issue..."
            rows={3}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as CommentType)}
                className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-xs text-white"
              >
                <option value="note">Note</option>
                <option value="suggestion">Suggestion</option>
                <option value="issue">Issue</option>
              </select>
              <span className="text-[11px] text-surface-500">
                {newType === 'note' ? 'General note' : newType === 'suggestion' ? 'Propose a change' : 'Flag a problem'}
              </span>
            </div>
            <Button onClick={handlePost} loading={submitting} disabled={!newContent.trim()}>Post</Button>
          </div>
        </Card>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: 'All' },
          { key: 'script', label: `Script (${scriptCommentCount})` },
          { key: 'issues', label: 'Issues' },
          { key: 'suggestions', label: 'Suggestions' },
          { key: 'unresolved', label: 'Unresolved' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)} className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            filter === f.key ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
          )}>{f.label}</button>
        ))}
      </div>

      {/* Comments list */}
      {filteredRoots.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No comments yet' : `No ${filter} found`}
          description={filter === 'script' ? 'Add comments from the Script Editor by clicking the comment icon on any line' : 'Start a discussion about your project'}
        />
      ) : (
        <div className="space-y-1">
          {filteredRoots.map(comment => {
            const el = comment.entity_type === 'script_element' ? elementMap.get(comment.entity_id) : null;
            return (
              <div key={comment.id}>
                {el && (
                  <div className="flex items-center gap-2 px-3 pt-2 pb-0.5">
                    <span className="text-[9px] uppercase font-semibold tracking-wider text-brand-400">
                      {ELEMENT_LABELS[el.element_type] || 'Element'}
                    </span>
                    <span className="text-xs text-surface-400 truncate max-w-md">{el.content || 'Empty'}</span>
                  </div>
                )}
                <CommentThread
                  comment={comment}
                  allComments={comments}
                  depth={0}
                  canEdit={canEdit}
                  userId={user?.id || ''}
                  projectId={params.id}
                  onReply={handleReply}
                  onResolve={handleResolve}
                  onDelete={handleDelete}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
