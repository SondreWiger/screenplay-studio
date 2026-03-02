'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, LoadingPage, Input, Modal, toast, ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { StageCue, StageCueType } from '@/lib/types';
import { STAGE_CUE_TYPE_CONFIG } from '@/lib/types';

const CUE_TYPES = Object.keys(STAGE_CUE_TYPE_CONFIG) as StageCueType[];

const emptyForm = (): Partial<StageCue> => ({
  cue_type:     'lighting',
  cue_number:   '',
  description:  '',
  act_number:   undefined,
  scene_ref:    '',
  timing_note:  '',
  duration_note:'',
  operator:     '',
  notes:        '',
});

export default function CuePage() {
  const params  = useParams<{ id: string }>();
  const { currentProject } = useProjectStore();
  const [cues, setCues] = useState<StageCue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<StageCueType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingCue, setEditingCue] = useState<StageCue | null>(null);
  const [form, setForm] = useState<Partial<StageCue>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchCues = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('stage_cues')
      .select('*')
      .eq('project_id', params.id)
      .order('cue_type')
      .order('sort_order')
      .order('cue_number');
    setCues(data || []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchCues(); }, [fetchCues]);

  const filtered = filterType === 'all' ? cues : cues.filter(c => c.cue_type === filterType);

  const openAdd = () => { setEditingCue(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (c: StageCue) => { setEditingCue(c); setForm({ ...c }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.cue_number?.trim()) { toast.error('Cue number is required'); return; }
    setSaving(true);
    const supabase = createClient();
    try {
      const payload = {
        cue_type:      form.cue_type ?? 'lighting',
        cue_number:    form.cue_number?.trim(),
        description:   form.description?.trim() || null,
        act_number:    form.act_number ?? null,
        scene_ref:     form.scene_ref?.trim() || null,
        timing_note:   form.timing_note?.trim() || null,
        duration_note: form.duration_note?.trim() || null,
        operator:      form.operator?.trim() || null,
        notes:         form.notes?.trim() || null,
      };
      if (editingCue) {
        await supabase.from('stage_cues').update(payload).eq('id', editingCue.id);
        toast.success('Cue updated');
      } else {
        await supabase.from('stage_cues').insert({ ...payload, project_id: params.id, sort_order: cues.length });
        toast.success('Cue added');
      }
      setShowModal(false);
      fetchCues();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cue?')) return;
    const supabase = createClient();
    await supabase.from('stage_cues').delete().eq('id', id);
    fetchCues();
  };

  const typeCounts = CUE_TYPES.reduce((acc, t) => {
    acc[t] = cues.filter(c => c.cue_type === t).length;
    return acc;
  }, {} as Record<StageCueType, number>);

  const handlePrint = () => window.print();

  if (loading) return <LoadingPage />;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cue Sheet</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {cues.length} cue{cues.length !== 1 ? 's' : ''} · {currentProject?.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-700 text-surface-400 hover:text-white hover:border-surface-500 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 15.75v3.75h10.5v-3.75M6.75 8.25V3.75h10.5V8.25M4.5 15.75h15M4.5 8.25h15" />
            </svg>
            Print
          </button>
          <Button onClick={openAdd} className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Cue
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => setFilterType('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            filterType === 'all' ? 'bg-surface-700 text-white' : 'text-surface-500 hover:text-surface-300',
          )}
        >
          All ({cues.length})
        </button>
        {CUE_TYPES.map(t => {
          const cfg = STAGE_CUE_TYPE_CONFIG[t];
          return (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                filterType === t ? 'text-white' : 'text-surface-500 hover:text-surface-300',
              )}
              style={filterType === t ? { backgroundColor: cfg.color + '30', color: cfg.color } : {}}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: cfg.color }}
              />
              {cfg.label}
              {typeCounts[t] > 0 && <span className="opacity-60">({typeCounts[t]})</span>}
            </button>
          );
        })}
      </div>

      {/* Cue table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-surface-800/80">
          <p className="text-3xl mb-3">💡</p>
          <p className="text-surface-300 font-medium">No cues yet</p>
          <p className="text-surface-500 text-sm mt-1">Add lighting, sound, music and other cues to build your cue sheet.</p>
        </Card>
      ) : (
        <Card className="border-surface-800/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide w-24">Cue #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Scene / Page</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Timing</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Operator</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Notes</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const cfg = STAGE_CUE_TYPE_CONFIG[c.cue_type];
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-surface-800/50 last:border-0 hover:bg-surface-800/30 cursor-pointer transition-colors"
                      onClick={() => openEdit(c)}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-white whitespace-nowrap">
                        {c.cue_number}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ backgroundColor: cfg.color + '25', color: cfg.color }}
                        >
                          {cfg.abbrev}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-200 max-w-[220px] truncate">{c.description || '—'}</td>
                      <td className="px-4 py-3 text-surface-400 whitespace-nowrap">
                        {c.act_number ? `Act ${c.act_number} ` : ''}{c.scene_ref || '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-400">{c.timing_note || '—'}</td>
                      <td className="px-4 py-3 text-surface-400">{c.operator || '—'}</td>
                      <td className="px-4 py-3 text-surface-500 max-w-[160px] truncate">{c.notes || '—'}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleDelete(c.id)} className="text-surface-600 hover:text-red-400 transition-colors p-1" title="Delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCue ? 'Edit Cue' : 'Add Cue'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Cue Type</label>
              <select
                value={form.cue_type ?? 'lighting'}
                onChange={e => setForm(f => ({ ...f, cue_type: e.target.value as StageCueType }))}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FF5F1F]"
              >
                {CUE_TYPES.map(t => (
                  <option key={t} value={t}>{STAGE_CUE_TYPE_CONFIG[t].label} ({STAGE_CUE_TYPE_CONFIG[t].abbrev})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Cue Number *</label>
              <Input
                value={form.cue_number ?? ''}
                onChange={e => setForm(f => ({ ...f, cue_number: e.target.value }))}
                placeholder="e.g. LX 1, SQ 42, Q 3.5"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Description</label>
            <Input
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What does this cue do?"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Act</label>
              <Input
                type="number"
                value={form.act_number ?? ''}
                onChange={e => setForm(f => ({ ...f, act_number: e.target.value ? parseInt(e.target.value) : undefined }))}
                placeholder="1"
                min={1}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Scene / Page Reference</label>
              <Input
                value={form.scene_ref ?? ''}
                onChange={e => setForm(f => ({ ...f, scene_ref: e.target.value }))}
                placeholder="p. 24 / Scene 3"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Timing / On Cue</label>
              <Input
                value={form.timing_note ?? ''}
                onChange={e => setForm(f => ({ ...f, timing_note: e.target.value }))}
                placeholder="On 'Enter stage left'"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Duration</label>
              <Input
                value={form.duration_note ?? ''}
                onChange={e => setForm(f => ({ ...f, duration_note: e.target.value }))}
                placeholder="3 sec fade, hold to scene end…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Operator</label>
              <Input
                value={form.operator ?? ''}
                onChange={e => setForm(f => ({ ...f, operator: e.target.value }))}
                placeholder="LX board, Follow-spot 1…"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-[#FF5F1F] resize-none"
              placeholder="Extra notes, dependencies, warnings…"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingCue ? 'Save Changes' : 'Add Cue'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
