'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Input, Textarea, Modal, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { OrgPitch, OrgPitchComment } from '@/lib/types';

interface Props {
  companyId: string;
  userId: string;
  canManage: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6b7280' },
  submitted: { label: 'Submitted', color: '#3b82f6' },
  under_review: { label: 'Under Review', color: '#f59e0b' },
  approved: { label: 'Approved', color: '#10b981' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  greenlit: { label: 'Greenlit', color: '#22c55e' },
  shelved: { label: 'Shelved', color: '#6b7280' },
};

export function OrgPitches({ companyId, userId, canManage }: Props) {
  const [pitches, setPitches] = useState<OrgPitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedPitch, setExpandedPitch] = useState<string | null>(null);
  const [comments, setComments] = useState<OrgPitchComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const [form, setForm] = useState({
    title: '', logline: '', synopsis: '', genre: '', target_audience: '',
  });

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('org_pitches')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setPitches(data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const loadComments = async (pitchId: string) => {
    const { data } = await supabase
      .from('org_pitch_comments')
      .select('*')
      .eq('pitch_id', pitchId)
      .order('created_at');
    setComments(data || []);
  };

  const toggleExpand = (id: string) => {
    if (expandedPitch === id) { setExpandedPitch(null); return; }
    setExpandedPitch(id);
    loadComments(id);
  };

  const createPitch = async () => {
    if (!form.title.trim() || !form.logline.trim()) { toast.error('Title and logline required'); return; }
    const { error } = await supabase.from('org_pitches').insert({
      company_id: companyId, author_id: userId,
      title: form.title.trim(), logline: form.logline.trim(),
      synopsis: form.synopsis.trim() || null, genre: form.genre.trim() || null,
      target_audience: form.target_audience.trim() || null,
      status: 'submitted',
    });
    if (error) { toast.error('Failed to create pitch'); return; }
    setShowCreate(false);
    setForm({ title: '', logline: '', synopsis: '', genre: '', target_audience: '' });
    load();
    toast.success('Pitch submitted!');
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('org_pitches').update({ status }).eq('id', id);
    load();
  };

  const vote = async (pitchId: string, voteType: 'upvote' | 'downvote') => {
    const { data: existing } = await supabase
      .from('org_pitch_votes')
      .select('id, vote_type')
      .eq('pitch_id', pitchId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      if (existing.vote_type === voteType) {
        await supabase.from('org_pitch_votes').delete().eq('id', existing.id);
      } else {
        await supabase.from('org_pitch_votes').update({ vote_type: voteType }).eq('id', existing.id);
      }
    } else {
      await supabase.from('org_pitch_votes').insert({ pitch_id: pitchId, user_id: userId, vote_type: voteType });
    }
    load();
  };

  const addComment = async (pitchId: string) => {
    if (!newComment.trim()) return;
    await supabase.from('org_pitch_comments').insert({
      pitch_id: pitchId, author_id: userId, content: newComment.trim(),
    });
    setNewComment('');
    loadComments(pitchId);
  };

  if (loading) return <div className="text-center py-12 text-surface-500">Loading pitches...</div>;

  const filtered = filter === 'all' ? pitches : pitches.filter(p => p.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Pitch Board</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>+ Submit Pitch</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', ...Object.keys(STATUS_CONFIG)].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-3 py-1.5 text-xs rounded-lg capitalize', filter === s ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 bg-surface-800')}>
            {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="p-8 text-center text-surface-500">No pitches yet. Be the first to submit an idea!</Card>
      )}

      <div className="space-y-4">
        {filtered.map(pitch => {
          const expanded = expandedPitch === pitch.id;
          const sc = STATUS_CONFIG[pitch.status] || STATUS_CONFIG.draft;
          return (
            <Card key={pitch.id} className="overflow-hidden">
              <div className="p-4 cursor-pointer" onClick={() => toggleExpand(pitch.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: sc.color + '20', color: sc.color }}>
                        {sc.label}
                      </span>
                      {pitch.genre && <span className="text-[10px] text-surface-600">{pitch.genre}</span>}
                    </div>
                    <h3 className="font-semibold text-white">{pitch.title}</h3>
                    <p className="text-sm text-surface-400 mt-1">{pitch.logline}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); vote(pitch.id, 'upvote'); }}
                      className="flex items-center gap-1 text-surface-500 hover:text-green-400">
                      👍 <span className="text-xs">{pitch.vote_count || 0}</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); vote(pitch.id, 'downvote'); }}
                      className="flex items-center gap-1 text-surface-500 hover:text-red-400">
                      👎
                    </button>
                    <span className="text-surface-700">{expanded ? '▲' : '▼'}</span>
                  </div>
                </div>
              </div>

              {expanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-surface-800 pt-4">
                  {pitch.synopsis && (
                    <div>
                      <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Synopsis</h4>
                      <p className="text-sm text-surface-300 whitespace-pre-wrap">{pitch.synopsis}</p>
                    </div>
                  )}
                  <div className="flex gap-4 flex-wrap text-xs text-surface-500">
                    {pitch.target_audience && <span>🎯 Audience: {pitch.target_audience}</span>}
                  </div>

                  {/* Status actions for managers */}
                  {canManage && (
                    <div className="flex gap-2 flex-wrap">
                      {pitch.status === 'submitted' && (
                        <Button size="sm" variant="secondary" onClick={() => updateStatus(pitch.id, 'under_review')}>Start Review</Button>
                      )}
                      {(pitch.status === 'submitted' || pitch.status === 'under_review') && (
                        <>
                          <Button size="sm" onClick={() => updateStatus(pitch.id, 'approved')}>Approve ✓</Button>
                          <Button size="sm" variant="danger" onClick={() => updateStatus(pitch.id, 'rejected')}>Reject ✕</Button>
                        </>
                      )}
                      {pitch.status === 'approved' && (
                        <Button size="sm" onClick={() => updateStatus(pitch.id, 'greenlit')}>Greenlight 🟢</Button>
                      )}
                      {pitch.status !== 'shelved' && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(pitch.id, 'shelved')}>Shelve</Button>
                      )}
                    </div>
                  )}

                  {/* Comments */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-surface-500 uppercase">Comments</h4>
                    {comments.length === 0 && <p className="text-xs text-surface-600">No comments yet</p>}
                    {comments.map(c => (
                      <div key={c.id} className="bg-surface-900 rounded p-2">
                        <p className="text-sm text-surface-300">{c.content}</p>
                        <span className="text-[10px] text-surface-600">{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..."
                        onKeyDown={e => { if (e.key === 'Enter') addComment(pitch.id); }} className="flex-1" />
                      <Button size="sm" variant="secondary" onClick={() => addComment(pitch.id)}>Post</Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Submit a Pitch">
        <div className="space-y-4">
          <Input label="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Your story title" />
          <Textarea label="Logline *" value={form.logline} onChange={e => setForm({ ...form, logline: e.target.value })}
            placeholder="One-line summary of the story (aim for ~25 words)" />
          <Textarea label="Synopsis" value={form.synopsis} onChange={e => setForm({ ...form, synopsis: e.target.value })}
            placeholder="Full synopsis (optional)" rows={6} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Genre" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} placeholder="e.g. Thriller" />
            <Input label="Target Audience" value={form.target_audience} onChange={e => setForm({ ...form, target_audience: e.target.value })} placeholder="e.g. 18-34" />
          </div>
          <Button onClick={createPitch} disabled={!form.title.trim() || !form.logline.trim()}>Submit Pitch</Button>
        </div>
      </Modal>
    </div>
  );
}
