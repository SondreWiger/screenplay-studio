'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Button, Badge, Input, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BrollItem, BrollStatus } from '@/lib/types';

const STATUS_COLORS: Record<BrollStatus, string> = {
  needed: 'bg-[#FF5F1F]/20 text-[#FF5F1F]',
  found: 'bg-blue-500/20 text-blue-400',
  filmed: 'bg-purple-500/20 text-purple-400',
  edited: 'bg-green-500/20 text-green-400',
};

const STATUS_LABELS: Record<BrollStatus, string> = {
  needed: 'Needed',
  found: 'Found',
  filmed: 'Filmed',
  edited: 'Edited',
};

const EMPTY_FORM = {
  description: '',
  source: 'film' as BrollItem['source'],
  source_url: '',
  notes: '',
};

export default function BRollPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { members, currentProject } = useProjectStore();
  const { user } = useAuthStore();
  
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [items, setItems] = useState<BrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState<BrollStatus | 'all'>('all');

  useEffect(() => {
    fetchItems();
  }, [projectId]);

  const fetchItems = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broll_items')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  const saveItem = async () => {
    const supabase = createClient();
    
    if (editingId) {
      await supabase
        .from('broll_items')
        .update(form)
        .eq('id', editingId);
    } else {
      await supabase
        .from('broll_items')
        .insert({ ...form, project_id: projectId });
    }
    
    fetchItems();
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const updateStatus = async (id: string, status: BrollStatus) => {
    const supabase = createClient();
    await supabase
      .from('broll_items')
      .update({ status })
      .eq('id', id);
    setItems(items.map(i => i.id === id ? { ...i, status } : i));
  };

  const deleteItem = async (id: string) => {
    const supabase = createClient();
    await supabase.from('broll_items').delete().eq('id', id);
    setItems(items.filter(i => i.id !== id));
  };

  const startEdit = (item: BrollItem) => {
    setForm({
      description: item.description,
      source: item.source,
      source_url: item.source_url || '',
      notes: item.notes || '',
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const filteredItems = filter === 'all' 
    ? items 
    : items.filter(i => i.status === filter);

  // Stats
  const stats = {
    needed: items.filter(i => i.status === 'needed').length,
    found: items.filter(i => i.status === 'found').length,
    filmed: items.filter(i => i.status === 'filmed').length,
    edited: items.filter(i => i.status === 'edited').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[#FF5F1F] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">B-Roll</h1>
          <p className="text-surface-400 text-sm mt-1">
            Track supplementary footage for your video
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}>
            + Add B-Roll
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(STATUS_LABELS) as BrollStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(filter === status ? 'all' : status)}
            className={cn(
              'bg-surface-900 border rounded-xl p-4 text-center transition-all',
              filter === status ? 'border-[#FF5F1F]' : 'border-surface-800 hover:border-surface-700'
            )}
          >
            <p className="text-2xl font-black text-white">{stats[status]}</p>
            <Badge className={cn('mt-1 text-xs', STATUS_COLORS[status])}>
              {STATUS_LABELS[status]}
            </Badge>
          </button>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface-900 rounded-xl p-6 w-full max-w-lg border border-surface-800">
            <h2 className="text-lg font-bold text-white mb-4">
              {editingId ? 'Edit B-Roll' : 'Add B-Roll'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">
                  Description *
                </label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g., Drone shot of city skyline at sunset"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">
                  Source Type
                </label>
                <select
                  value={form.source || 'film'}
                  onChange={(e) => setForm({ ...form, source: e.target.value as BrollItem['source'] })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-white"
                >
                  <option value="film">Film Myself</option>
                  <option value="stock">Stock Footage</option>
                  <option value="screen_recording">Screen Recording</option>
                  <option value="archive">Archive Footage</option>
                  <option value="animation">Animation/Graphics</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">
                  Source URL
                </label>
                <Input
                  value={form.source_url}
                  onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                  placeholder="e.g., Link to stock footage, reference video"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional notes, timing, style preferences..."
                  rows={3}
                  className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-white resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>
                Cancel
              </Button>
              <Button onClick={saveItem} disabled={!form.description.trim()}>
                {editingId ? 'Save Changes' : 'Add B-Roll'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No B-Roll yet' : `No ${STATUS_LABELS[filter as BrollStatus].toLowerCase()} items`}
          description={filter === 'all' ? 'Start tracking extra footage you need for your video' : 'No items match this filter'}
        />
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-surface-900 border border-surface-800 rounded-xl p-4 hover:border-surface-700 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Status Dropdown */}
                <div className="shrink-0">
                  <select
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value as BrollStatus)}
                    disabled={!canEdit}
                    className={cn(
                      'rounded-lg px-2 py-1 text-xs font-medium border-0',
                      STATUS_COLORS[item.status]
                    )}
                  >
                    {(Object.keys(STATUS_LABELS) as BrollStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white">{item.description}</h3>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge className="text-xs bg-surface-800 text-surface-400">
                      {item.source === 'film' && '📹 Film'}
                      {item.source === 'stock' && '🎬 Stock'}
                      {item.source === 'screen_recording' && '🖥️ Screen'}
                      {item.source === 'archive' && '📁 Archive'}
                      {item.source === 'animation' && '✨ Animation'}
                      {!item.source && '🎥 Record'}
                    </Badge>
                    
                    {item.source_url && (
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#FF5F1F] hover:underline">
                        🔗 Source
                      </a>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-sm text-surface-400 mt-2">{item.notes}</p>
                  )}
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(item)}
                      className="p-2 text-surface-400 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-2 text-surface-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="bg-gradient-to-r from-purple-500/10 to-brand-500/10 border border-purple-500/20 rounded-xl p-4">
        <h3 className="font-semibold text-white text-sm mb-2">📽️ B-Roll Best Practices</h3>
        <ul className="text-xs text-surface-400 space-y-1">
          <li>• Shoot more than you think you&apos;ll need — variety is key</li>
          <li>• Get multiple angles of the same subject when recording</li>
          <li>• Match the color profile to your main footage</li>
          <li>• Use b-roll to cover cuts and transitions</li>
        </ul>
      </div>
    </div>
  );
}
