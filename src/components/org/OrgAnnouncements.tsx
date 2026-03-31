'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Textarea, Modal, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { OrgAnnouncement } from '@/lib/types';

interface Props {
  companyId: string;
  userId: string;
  canManage: boolean;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  low: { label: 'Low', color: '#6b7280', icon: '📋' },
  normal: { label: 'Normal', color: '#3b82f6', icon: '📢' },
  high: { label: 'High', color: '#f59e0b', icon: '⚠️' },
  urgent: { label: 'Urgent', color: '#ef4444', icon: '🚨' },
};

export function OrgAnnouncements({ companyId, userId, canManage }: Props) {
  const [announcements, setAnnouncements] = useState<OrgAnnouncement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    title: '', content: '', priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    is_pinned: false,
  });

  const supabase = createClient();

  const load = useCallback(async () => {
    const [annRes, readRes] = await Promise.all([
      supabase.from('org_announcements').select('*').eq('company_id', companyId)
        .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('org_announcement_reads').select('announcement_id').eq('user_id', userId),
    ]);
    setAnnouncements(annRes.data || []);
    setReadIds(new Set((readRes.data || []).map(r => r.announcement_id)));
    setLoading(false);
  }, [companyId, userId]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    if (readIds.has(id)) return;
    await supabase.from('org_announcement_reads').insert({ announcement_id: id, user_id: userId });
    setReadIds(prev => { const next = new Set(Array.from(prev)); next.add(id); return next; });
  };

  const createAnnouncement = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content required'); return; }
    const { error } = await supabase.from('org_announcements').insert({
      company_id: companyId, created_by: userId,
      title: form.title.trim(), content: form.content.trim(),
      priority: form.priority, is_pinned: form.is_pinned,
    });
    if (error) { toast.error('Failed to create announcement'); return; }
    setShowCreate(false);
    setForm({ title: '', content: '', priority: 'normal', is_pinned: false });
    load();
    toast.success('Announcement posted!');
  };

  const deleteAnnouncement = async (id: string) => {
    await supabase.from('org_announcements').delete().eq('id', id);
    load();
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from('org_announcements').update({ is_pinned: !pinned }).eq('id', id);
    load();
  };

  if (loading) return <div className="text-center py-12 text-surface-500">Loading announcements...</div>;

  const unreadCount = announcements.filter(a => !readIds.has(a.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">Announcements</h2>
          {unreadCount > 0 && (
            <span className="text-xs bg-[#FF5F1F] text-white px-2 py-0.5 rounded-full font-semibold">{unreadCount} new</span>
          )}
        </div>
        {canManage && <Button size="sm" onClick={() => setShowCreate(true)}>+ Post Announcement</Button>}
      </div>

      {announcements.length === 0 && (
        <Card className="p-8 text-center text-surface-500">No announcements yet</Card>
      )}

      <div className="space-y-4">
        {announcements.map(ann => {
          const isRead = readIds.has(ann.id);
          const pc = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.normal;
          return (
            <Card key={ann.id}
              className={cn('p-5 transition-all', !isRead && 'ring-1 ring-[#FF5F1F]/30 bg-[#FF5F1F]/5')}
              onClick={() => markRead(ann.id)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{pc.icon}</span>
                    {ann.is_pinned && <span className="text-[10px] text-yellow-400">📌 Pinned</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: pc.color + '20', color: pc.color }}>
                      {pc.label}
                    </span>
                    {!isRead && <span className="w-2 h-2 rounded-full bg-[#FF5F1F]" />}
                  </div>
                  <h3 className="font-semibold text-white text-base">{ann.title}</h3>
                  <p className="text-sm text-surface-400 mt-2 whitespace-pre-wrap">{ann.content}</p>
                  <span className="text-[10px] text-surface-600 mt-3 block">{new Date(ann.created_at).toLocaleString()}</span>
                </div>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); togglePin(ann.id, ann.is_pinned); }}
                      className="text-xs text-surface-500 hover:text-yellow-400 p-1">📌</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteAnnouncement(ann.id); }}
                      className="text-xs text-surface-500 hover:text-red-400 p-1">✕</button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Post Announcement">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-surface-400 mb-1 block">Title *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <Textarea label="Content *" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={6} />
          <div>
            <label className="text-sm text-surface-400 mb-1 block">Priority</label>
            <div className="flex gap-2">
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => setForm({ ...form, priority: k as any })}
                  className={cn('px-3 py-1.5 text-xs rounded-lg', form.priority === k ? 'text-white' : 'text-surface-400 bg-surface-800')}
                  style={form.priority === k ? { backgroundColor: v.color } : {}}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-surface-400 cursor-pointer">
            <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
              className="rounded border-surface-700" /> Pin to top
          </label>
          <Button onClick={createAnnouncement} disabled={!form.title.trim() || !form.content.trim()}>Post Announcement</Button>
        </div>
      </Modal>
    </div>
  );
}
