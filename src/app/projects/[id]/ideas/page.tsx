'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import type { Idea, IdeaStatus, IdeaCategory } from '@/lib/types';

const STATUS_COLUMNS: { value: IdeaStatus; label: string; color: string }[] = [
  { value: 'spark', label: '✨ Spark', color: 'border-yellow-500/30' },
  { value: 'developing', label: '🔧 Developing', color: 'border-blue-500/30' },
  { value: 'ready', label: '✅ Ready', color: 'border-green-500/30' },
  { value: 'used', label: '🎬 Used', color: 'border-purple-500/30' },
  { value: 'discarded', label: '🗑️ Discarded', color: 'border-surface-600/30' },
];

const CATEGORIES: { value: IdeaCategory; label: string }[] = [
  { value: 'plot', label: 'Plot' }, { value: 'character', label: 'Character' },
  { value: 'dialogue', label: 'Dialogue' }, { value: 'visual', label: 'Visual' },
  { value: 'sound', label: 'Sound' }, { value: 'location', label: 'Location' },
  { value: 'prop', label: 'Prop' }, { value: 'costume', label: 'Costume' },
  { value: 'effect', label: 'Effect' }, { value: 'theme', label: 'Theme' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_COLORS: Record<number, string> = {
  1: 'text-surface-500', 2: 'text-surface-400', 3: 'text-yellow-500',
  4: 'text-orange-500', 5: 'text-red-500',
};

export default function IdeasPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => { fetchIdeas(); }, [params.id]);

  const fetchIdeas = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('ideas').select('*').eq('project_id', params.id).order('priority', { ascending: false });
      if (error) console.error('Ideas fetch error:', error.message);
      setIdeas(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this idea?')) return;
    const supabase = createClient();
    await supabase.from('ideas').delete().eq('id', id);
    setIdeas(ideas.filter((i) => i.id !== id));
    setShowEditor(false);
  };

  const handleDrop = async (status: IdeaStatus) => {
    if (!draggedId) return;
    const supabase = createClient();
    await supabase.from('ideas').update({ status }).eq('id', draggedId);
    setIdeas(ideas.map((i) => i.id === draggedId ? { ...i, status } : i));
    setDraggedId(null);
    setDragOverCol(null);
  };

  const filtered = filterCategory === 'all' ? ideas : ideas.filter((i) => i.category === filterCategory);

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ideas Board</h1>
          <p className="text-sm text-surface-400 mt-1">{ideas.length} ideas captured</p>
        </div>
        {canEdit && <Button onClick={() => { setSelectedIdea(null); setShowEditor(true); }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Capture Idea
        </Button>}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button onClick={() => setFilterCategory('all')} className={cn(
          'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
          filterCategory === 'all' ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
        )}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setFilterCategory(c.value)} className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
            filterCategory === c.value ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
          )}>{c.label}</button>
        ))}
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 min-h-[60vh]">
        {STATUS_COLUMNS.map((col) => {
          const colIdeas = filtered.filter((i) => i.status === col.value);
          return (
            <div key={col.value}
              className={cn(
                'rounded-xl border-2 border-dashed transition-colors p-3',
                dragOverCol === col.value ? 'border-brand-500/50 bg-brand-600/5' : col.color,
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.value); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(col.value); }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-surface-300">{col.label}</h3>
                <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded-full">{colIdeas.length}</span>
              </div>
              <div className="space-y-2">
                {colIdeas.map((idea) => (
                  <div key={idea.id} draggable
                    onDragStart={() => setDraggedId(idea.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
                    onClick={() => { setSelectedIdea(idea); setShowEditor(true); }}
                    className={cn(
                      'bg-surface-900 rounded-lg p-3 cursor-grab active:cursor-grabbing border border-surface-800 hover:border-surface-700 transition-all',
                      draggedId === idea.id ? 'opacity-50' : ''
                    )}>
                    <h4 className="text-sm font-medium text-white mb-1 line-clamp-2">{idea.title}</h4>
                    {idea.description && <p className="text-xs text-surface-400 line-clamp-2 mb-2">{idea.description}</p>}
                    <div className="flex items-center justify-between">
                      <Badge size="sm">{idea.category}</Badge>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={cn('text-[8px]', i < idea.priority ? PRIORITY_COLORS[idea.priority] : 'text-surface-700')}>●</span>
                        ))}
                      </div>
                    </div>
                    {idea.tags && idea.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {idea.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-400">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <IdeaEditor isOpen={showEditor} onClose={() => setShowEditor(false)} idea={selectedIdea}
        projectId={params.id} userId={user?.id || ''}
        onSaved={() => { fetchIdeas(); setShowEditor(false); }} onDelete={handleDelete} canEdit={canEdit} />
    </div>
  );
}

function IdeaEditor({ isOpen, onClose, idea, projectId, userId, onSaved, onDelete, canEdit }: {
  isOpen: boolean; onClose: () => void; idea: Idea | null; projectId: string; userId: string;
  onSaved: () => void; onDelete: (id: string) => void; canEdit: boolean;
}) {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    setForm(idea ? { ...idea } : {
      title: '', description: '', category: 'plot' as IdeaCategory, status: 'spark' as IdeaStatus,
      priority: 3, tags: [], references: [],
    });
    setTagInput('');
  }, [idea, isOpen]);

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm({ ...form, tags: [...(form.tags || []), tagInput.trim()] });
    setTagInput('');
  };

  const handleSave = async () => {
    if (!form.title) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const payload = { ...form, project_id: projectId, created_by: userId };
      if (idea) {
        const { error } = await supabase.from('ideas').update(payload).eq('id', idea.id);
        if (error) { alert(error.message); setLoading(false); return; }
      } else {
        const { error } = await supabase.from('ideas').insert(payload);
        if (error) { alert(error.message); setLoading(false); return; }
      }
    } catch (err) {
      alert('Failed to save idea');
    }
    setLoading(false);
    onSaved();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={idea ? `Edit: ${idea.title}` : 'Capture New Idea'} size="md">
      <div className="space-y-4">
        <Input label="Title" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What's the idea?" />
        <Textarea label="Details" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Describe the idea in detail..." />
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Category</label>
            <select value={form.category || 'story'} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Status</label>
            <select value={form.status || 'spark'} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              {STATUS_COLUMNS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Priority</label>
            <select value={form.priority || 3} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              <option value={1}>1 - Low</option><option value={2}>2</option><option value={3}>3 - Medium</option>
              <option value={4}>4</option><option value={5}>5 - Critical</option>
            </select>
          </div>
        </div>
        <Input label="Reference URL" value={(form.references || [])[0] || ''} onChange={(e) => setForm({ ...form, references: e.target.value ? [e.target.value] : [] })} placeholder="https://..." />
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Tags</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {(form.tags || []).map((t: string, i: number) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-800 text-xs text-surface-300">
                {t}
                <button onClick={() => setForm({ ...form, tags: form.tags.filter((_: any, idx: number) => idx !== i) })} className="text-surface-500 hover:text-red-400">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add tag..."
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
            <Button variant="secondary" size="sm" onClick={addTag}>Add</Button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-surface-800">
        <div>{canEdit && idea && <Button variant="danger" size="sm" onClick={() => onDelete(idea.id)}>Delete</Button>}</div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {canEdit && <Button onClick={handleSave} loading={loading}>{idea ? 'Save' : 'Capture'}</Button>}
        </div>
      </div>
    </Modal>
  );
}
