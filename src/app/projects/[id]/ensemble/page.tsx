'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, LoadingPage, Input, Modal, toast, ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { StageEnsembleMember, StageEnsembleGroup, STAGE_ENSEMBLE_GROUPS } from '@/lib/types';
import { STAGE_ENSEMBLE_GROUPS as GROUPS } from '@/lib/types';

const GROUP_COLORS: Record<StageEnsembleGroup, string> = {
  'Principal':    'bg-[#FF5F1F]/20 text-[#FF8F5F] border-[#FF5F1F]/30',
  'Ensemble':     'bg-[#6366f1]/20 text-[#a5b4fc] border-[#6366f1]/30',
  'Understudy':   'bg-[#f59e0b]/20 text-[#fbbf24] border-[#f59e0b]/30',
  'Dance Captain':'bg-[#ec4899]/20 text-[#f9a8d4] border-[#ec4899]/30',
  'Swing':        'bg-[#10b981]/20 text-[#6ee7b7] border-[#10b981]/30',
  'Alternate':    'bg-[#3b82f6]/20 text-[#93c5fd] border-[#3b82f6]/30',
  'Other':        'bg-surface-700 text-surface-400 border-surface-600',
};

const VOCAL_RANGES = ['Soprano','Mezzo-Soprano','Alto','Tenor','Baritone','Bass','Narrator','N/A'];

const emptyForm = (): Partial<StageEnsembleMember> => ({
  actor_name: '',
  character_name: '',
  ensemble_group: 'Ensemble',
  vocal_range: '',
  dance_skills: [],
  availability: '',
  contact_email: '',
  notes: '',
});

export default function EnsemblePage() {
  const params  = useParams<{ id: string }>();
  const { user } = useAuth();
  const { currentProject } = useProjectStore();
  const [members, setMembers] = useState<StageEnsembleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGroup, setFilterGroup] = useState<StageEnsembleGroup | 'All'>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<StageEnsembleMember | null>(null);
  const [form, setForm] = useState<Partial<StageEnsembleMember>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isOwner = currentProject?.created_by === user?.id;

  const fetchMembers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('stage_ensemble_members')
      .select('*')
      .eq('project_id', params.id)
      .order('sort_order')
      .order('actor_name');
    setMembers(data || []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filtered = members.filter(m => {
    const matchGroup = filterGroup === 'All' || m.ensemble_group === filterGroup;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || m.actor_name.toLowerCase().includes(q) || (m.character_name ?? '').toLowerCase().includes(q);
    return matchGroup && matchSearch;
  });

  const openAdd = () => {
    setEditingMember(null);
    setForm(emptyForm());
    setShowAddModal(true);
  };

  const openEdit = (m: StageEnsembleMember) => {
    setEditingMember(m);
    setForm({ ...m });
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!form.actor_name?.trim()) { toast.error('Actor name is required'); return; }
    setSaving(true);
    const supabase = createClient();
    try {
      if (editingMember) {
        await supabase.from('stage_ensemble_members').update({
          actor_name:     form.actor_name?.trim(),
          character_name: form.character_name?.trim() || null,
          ensemble_group: form.ensemble_group,
          vocal_range:    form.vocal_range?.trim() || null,
          dance_skills:   form.dance_skills || [],
          availability:   form.availability?.trim() || null,
          contact_email:  form.contact_email?.trim() || null,
          notes:          form.notes?.trim() || null,
        }).eq('id', editingMember.id);
        toast.success('Member updated');
      } else {
        await supabase.from('stage_ensemble_members').insert({
          project_id:     params.id,
          actor_name:     form.actor_name?.trim(),
          character_name: form.character_name?.trim() || null,
          ensemble_group: form.ensemble_group ?? 'Ensemble',
          vocal_range:    form.vocal_range?.trim() || null,
          dance_skills:   form.dance_skills || [],
          availability:   form.availability?.trim() || null,
          contact_email:  form.contact_email?.trim() || null,
          notes:          form.notes?.trim() || null,
          sort_order:     members.length,
        });
        toast.success('Member added');
      }
      setShowAddModal(false);
      fetchMembers();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this ensemble member?')) return;
    const supabase = createClient();
    await supabase.from('stage_ensemble_members').delete().eq('id', id);
    fetchMembers();
    toast.success('Removed');
  };

  // Group counts for badges
  const groupCounts = GROUPS.reduce((acc, g) => {
    acc[g] = members.filter(m => m.ensemble_group === g).length;
    return acc;
  }, {} as Record<StageEnsembleGroup, number>);

  if (loading) return <LoadingPage />;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ensemble</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {members.length} member{members.length !== 1 ? 's' : ''} · {currentProject?.title}
          </p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Member
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search actor or character…"
          className="w-56 bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-[#FF5F1F]"
        />
        {(['All', ...GROUPS] as const).map(g => (
          <button
            key={g}
            onClick={() => setFilterGroup(g as StageEnsembleGroup | 'All')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              filterGroup === g
                ? 'bg-[#FF5F1F] text-white border-[#FF5F1F]'
                : 'bg-surface-800 text-surface-400 border-surface-700 hover:border-surface-500',
            )}
          >
            {g}{g !== 'All' && groupCounts[g as StageEnsembleGroup] > 0 && (
              <span className="ml-1 opacity-60">({groupCounts[g as StageEnsembleGroup]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-surface-800/80">
          <p className="text-3xl mb-3">🎭</p>
          <p className="text-surface-300 font-medium">No ensemble members yet</p>
          <p className="text-surface-500 text-sm mt-1">Add actors and assign their characters and roles.</p>
        </Card>
      ) : (
        <Card className="border-surface-800/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wide">Actor</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wide">Character</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wide">Group</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wide">Voice</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wide">Dance Skills</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wide">Notes</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr
                    key={m.id}
                    className="border-b border-surface-800/50 last:border-0 hover:bg-surface-800/30 cursor-pointer transition-colors"
                    onClick={() => openEdit(m)}
                  >
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-300 flex-shrink-0">
                          {m.actor_name[0]?.toUpperCase()}
                        </div>
                        {m.actor_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-surface-300">
                      {m.character_name || <span className="text-surface-600 italic">Ensemble</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', GROUP_COLORS[m.ensemble_group] || GROUP_COLORS.Other)}>
                        {m.ensemble_group}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-surface-400">{m.vocal_range || '—'}</td>
                    <td className="px-4 py-3 text-surface-400">
                      {(m.dance_skills ?? []).length > 0
                        ? (m.dance_skills ?? []).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-surface-500 max-w-[200px] truncate">{m.notes || '—'}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-surface-600 hover:text-red-400 transition-colors p-1"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add / Edit Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingMember ? 'Edit Member' : 'Add Ensemble Member'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Actor Name *</label>
              <Input
                value={form.actor_name ?? ''}
                onChange={e => setForm(f => ({ ...f, actor_name: e.target.value }))}
                placeholder="Full name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Character Name</label>
              <Input
                value={form.character_name ?? ''}
                onChange={e => setForm(f => ({ ...f, character_name: e.target.value }))}
                placeholder="Leave blank for chorus/ensemble"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Group</label>
              <select
                value={form.ensemble_group ?? 'Ensemble'}
                onChange={e => setForm(f => ({ ...f, ensemble_group: e.target.value as StageEnsembleGroup }))}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FF5F1F]"
              >
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Vocal Range</label>
              <select
                value={form.vocal_range ?? ''}
                onChange={e => setForm(f => ({ ...f, vocal_range: e.target.value }))}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FF5F1F]"
              >
                <option value="">— select —</option>
                {VOCAL_RANGES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Dance Skills (comma-separated)</label>
            <Input
              value={(form.dance_skills ?? []).join(', ')}
              onChange={e => setForm(f => ({ ...f, dance_skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
              placeholder="e.g. ballet, tap, jazz"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Contact Email</label>
              <Input
                value={form.contact_email ?? ''}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="agent@email.com"
                type="email"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Availability</label>
              <Input
                value={form.availability ?? ''}
                onChange={e => setForm(f => ({ ...f, availability: e.target.value }))}
                placeholder="e.g. weekends only"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Special requirements, understudy for, conflicts…"
              rows={3}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-[#FF5F1F] resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingMember ? 'Save Changes' : 'Add Member'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
