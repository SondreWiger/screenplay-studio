'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Input, Textarea, Modal, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { OrgResource } from '@/lib/types';

interface Props {
  companyId: string;
  userId: string;
  canManage: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  document: '📄', template: '📋', style_guide: '📐', character_bible: '👤',
  world_bible: '🌍', mood_board: '🎨', reference_image: '🖼️', contract: '📑', other: '📦',
};

export function OrgResources({ companyId, userId, canManage }: Props) {
  const [resources, setResources] = useState<OrgResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', resource_type: 'document' as OrgResource['resource_type'],
    file_url: '', category: '', tags: '',
  });

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('org_resources')
      .select('*')
      .eq('company_id', companyId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setResources(data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const createResource = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    const { error } = await supabase.from('org_resources').insert({
      company_id: companyId, created_by: userId,
      title: form.title.trim(), description: form.description.trim() || null,
      resource_type: form.resource_type, file_url: form.file_url.trim() || null,
      category: form.category.trim() || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
    if (error) { toast.error('Failed to create resource'); return; }
    setShowCreate(false);
    setForm({ title: '', description: '', resource_type: 'document', file_url: '', category: '', tags: '' });
    load();
    toast.success('Resource added!');
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from('org_resources').update({ is_pinned: !pinned }).eq('id', id);
    load();
  };

  const deleteResource = async (id: string) => {
    await supabase.from('org_resources').delete().eq('id', id);
    load();
  };

  if (loading) return <div className="text-center py-12 text-surface-500">Loading resources...</div>;

  const categories = Array.from(new Set(resources.map(r => r.category).filter(Boolean)));

  const filtered = resources.filter(r => {
    if (filter !== 'all' && r.resource_type !== filter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !(r.description || '').toLowerCase().includes(search.toLowerCase()) &&
        !(r.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const pinned = filtered.filter(r => r.is_pinned);
  const unpinned = filtered.filter(r => !r.is_pinned);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Shared Resources</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>+ Add Resource</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <Input placeholder="Search resources..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <div className="flex bg-surface-800 rounded-lg">
          {['all', ...Object.keys(TYPE_ICONS)].map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={cn('px-3 py-1.5 text-xs rounded-lg capitalize', filter === t ? 'bg-brand-500 text-white' : 'text-surface-400')}>
              {t === 'all' ? 'All' : `${TYPE_ICONS[t]} ${t}`}
            </button>
          ))}
        </div>
      </div>

      {/* Pinned Section */}
      {pinned.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">📌 Pinned</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinned.map(r => <ResourceCard key={r.id} resource={r} canManage={canManage} userId={userId}
              onPin={() => togglePin(r.id, r.is_pinned)} onDelete={() => deleteResource(r.id)} />)}
          </div>
        </div>
      )}

      {/* All Resources */}
      <div>
        {unpinned.length === 0 && pinned.length === 0 && (
          <Card className="p-8 text-center text-surface-500">No resources yet. Add your first shared resource!</Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {unpinned.map(r => <ResourceCard key={r.id} resource={r} canManage={canManage} userId={userId}
            onPin={() => togglePin(r.id, r.is_pinned)} onDelete={() => deleteResource(r.id)} />)}
        </div>
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Resource">
        <div className="space-y-4">
          <Input label="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div>
            <label className="text-sm text-surface-400 mb-1 block">Type</label>
            <select value={form.resource_type} onChange={e => setForm({ ...form, resource_type: e.target.value as any })}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white">
              {Object.entries(TYPE_ICONS).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
            </select>
          </div>
          <Input label="URL / Link" value={form.file_url} onChange={e => setForm({ ...form, file_url: e.target.value })} placeholder="https://..." />
          <Input label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Contracts, References..." />
          <Input label="Tags (comma separated)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="e.g. legal, template, onboarding" />
          <Button onClick={createResource} disabled={!form.title.trim()}>Add Resource</Button>
        </div>
      </Modal>
    </div>
  );
}

function ResourceCard({ resource, canManage, userId, onPin, onDelete }: {
  resource: OrgResource; canManage: boolean; userId: string; onPin: () => void; onDelete: () => void;
}) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{TYPE_ICONS[resource.resource_type] || '📦'}</span>
          <h4 className="font-medium text-white text-sm">{resource.title}</h4>
        </div>
        {(canManage || resource.created_by === userId) && (
          <div className="flex gap-1">
            <button onClick={onPin} className="text-xs text-surface-500 hover:text-yellow-400" title={resource.is_pinned ? 'Unpin' : 'Pin'}>
              {resource.is_pinned ? '📌' : '📍'}
            </button>
            <button onClick={onDelete} className="text-xs text-surface-500 hover:text-red-400">✕</button>
          </div>
        )}
      </div>
      {resource.description && <p className="text-xs text-surface-500 line-clamp-2">{resource.description}</p>}
      {resource.file_url && (
        <a href={resource.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline truncate">
          {resource.file_url}
        </a>
      )}
      <div className="flex items-center gap-2 flex-wrap mt-auto">
        {resource.category && <span className="text-[10px] bg-surface-800 px-2 py-0.5 rounded text-surface-400">{resource.category}</span>}
        {(resource.tags || []).map(t => (
          <span key={t} className="text-[10px] bg-surface-800/50 px-1.5 py-0.5 rounded text-surface-500">#{t}</span>
        ))}
      </div>
      <span className="text-[10px] text-surface-600">{new Date(resource.created_at).toLocaleDateString()}</span>
    </Card>
  );
}
