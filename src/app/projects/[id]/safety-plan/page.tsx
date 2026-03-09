'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Card, Button, Input, Textarea, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

// ============================================================
// Safety Plan
// Risk assessment items per scene — categories, risk levels,
// mitigation notes, responsible parties, and clearance sign-off.
// ============================================================

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type Category =
  | 'stunt' | 'pyrotechnics' | 'heights' | 'vehicles' | 'water'
  | 'animals' | 'hazmat' | 'electrical' | 'weather' | 'crowd' | 'general';

interface Scene { id: string; scene_number: string | null; scene_heading: string | null; }

interface SafetyItem {
  id: string;
  scene_id: string | null;
  category: Category;
  risk_level: RiskLevel;
  description: string | null;
  mitigation: string | null;
  responsible_dept: string | null;
  responsible_person: string | null;
  signed_off_by: string | null;   // DB column name
  is_cleared: boolean;
  created_at: string;
}

const RISK_META: Record<RiskLevel, { color: string; label: string }> = {
  low:      { color: 'bg-green-500/15 text-green-300 border-green-500/30',  label: 'Low' },
  medium:   { color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',  label: 'Medium' },
  high:     { color: 'bg-orange-500/15 text-orange-300 border-orange-500/30', label: 'High' },
  critical: { color: 'bg-red-500/15 text-red-300 border-red-500/30',        label: 'Critical' },
};

const CATEGORIES: Category[] = ['stunt', 'pyrotechnics', 'heights', 'vehicles', 'water', 'animals', 'hazmat', 'electrical', 'weather', 'crowd', 'general'];

const BLANK = {
  scene_id: null as string | null,
  category: 'general' as Category,
  risk_level: 'medium' as RiskLevel,
  description: '',
  mitigation: '',
  responsible_dept: '',
  responsible_person: '',
  signed_off_by: '',
  is_cleared: false,
};

export default function SafetyPlanPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [items, setItems] = useState<SafetyItem[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [selected, setSelected] = useState<SafetyItem | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [filterRisk, setFilterRisk] = useState<RiskLevel | 'all'>('all');

  useEffect(() => { load(); }, [params.id]);

  const load = async () => {
    const supabase = createClient();
    const [{ data: sceneData }, { data: itemData }] = await Promise.all([
      supabase.from('scenes').select('id, scene_number, scene_heading').eq('project_id', params.id).order('sort_order'),
      supabase.from('safety_plan_items').select('*').eq('project_id', params.id).order('risk_level', { ascending: false }),
    ]);
    setScenes((sceneData ?? []) as Scene[]);
    setItems((itemData ?? []) as SafetyItem[]);
    setLoading(false);
  };

  const openNew = () => {
    setSelected(null); setForm({ ...BLANK }); setView('edit');
  };

  const openEdit = (item: SafetyItem) => {
    setSelected(item);
    setForm({
      scene_id: item.scene_id, category: item.category, risk_level: item.risk_level,
      description: item.description ?? '', mitigation: item.mitigation ?? '',
      responsible_dept: item.responsible_dept ?? '', responsible_person: item.responsible_person ?? '',
      signed_off_by: item.signed_off_by ?? '', is_cleared: item.is_cleared,
    });
    setView('edit');
  };

  const save = async () => {
    if (!form.description.trim()) { toast.error('Description is required.'); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = { ...form, project_id: params.id, updated_at: new Date().toISOString() };
    if (selected) {
      const { data, error } = await supabase.from('safety_plan_items').update(payload).eq('id', selected.id).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      if (data) { setItems((prev) => prev.map((i) => i.id === selected.id ? data as SafetyItem : i)); toast.success('Updated.'); setView('list'); }
    } else {
      const { data, error } = await supabase.from('safety_plan_items').insert({ ...payload, created_by: user?.id }).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      if (data) { setItems((prev) => [...prev, data as SafetyItem]); toast.success('Safety item added.'); setView('list'); }
    }
    setSaving(false);
  };

  const toggleCleared = async (item: SafetyItem) => {
    const { data } = await createClient().from('safety_plan_items')
      .update({ is_cleared: !item.is_cleared }).eq('id', item.id).select().single();
    if (data) setItems((prev) => prev.map((i) => i.id === item.id ? data as SafetyItem : i));
  };

  const deleteItem = async (id: string) => {
    const ok = await confirm({ message: 'Delete this safety item?', variant: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    await createClient().from('safety_plan_items').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id)); toast.success('Deleted.');
  };

  const sceneLabel = (sceneId: string | null) => {
    if (!sceneId) return 'General (no scene)';
    const sc = scenes.find((s) => s.id === sceneId);
    return sc ? (sc.scene_heading ?? `Sc. ${sc.scene_number}`) : 'Unknown Scene';
  };

  if (loading) return <LoadingSpinner className="py-32" />;

  // ─── Edit form ────────────────────────────────────────────────
  if (view === 'edit') return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-white">{selected ? 'Edit Safety Item' : 'New Safety Item'}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setView('list')}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Scene</label>
            <select value={form.scene_id ?? ''} onChange={(e) => setForm({ ...form, scene_id: e.target.value || null })}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">General (no scene)</option>
              {scenes.map((s) => <option key={s.id} value={s.id}>{s.scene_heading ?? `Sc. ${s.scene_number}`}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white capitalize">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-surface-400 mb-3 font-bold">Risk Level</p>
          <div className="flex gap-2 flex-wrap">
            {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((r) => (
              <button key={r}
                onClick={() => setForm({ ...form, risk_level: r })}
                className={cn('px-4 py-2 rounded-lg border font-bold text-sm capitalize transition-all',
                  form.risk_level === r ? RISK_META[r].color : 'border-surface-700 text-surface-500 hover:border-surface-600')}>
                {r}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Description of Risk</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the hazard or risk scenario…" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Mitigation / Control Measures</label>
            <Textarea value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })} rows={3} placeholder="How will this risk be managed or mitigated?…" />
          </div>
        </Card>

        <Card className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Responsible Department</label>
            <Input value={form.responsible_dept} onChange={(e) => setForm({ ...form, responsible_dept: e.target.value })} placeholder="e.g. Stunt Dept., Art Dept." />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Responsible Person</label>
            <Input value={form.responsible_person} onChange={(e) => setForm({ ...form, responsible_person: e.target.value })} placeholder="Name or role" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Signed Off By</label>
            <Input value={form.signed_off_by} onChange={(e) => setForm({ ...form, signed_off_by: e.target.value })} placeholder="Safety officer name or initials" />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input type="checkbox" id="cleared" checked={form.is_cleared} onChange={(e) => setForm({ ...form, is_cleared: e.target.checked })}
              className="w-4 h-4 accent-green-500" />
            <label htmlFor="cleared" className="text-sm text-surface-300 font-medium">Marked as Cleared</label>
          </div>
        </Card>
      </div>
    </div>
  );

  // ─── List view ────────────────────────────────────────────────
  const RISK_ORDER: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
  const counts = RISK_ORDER.reduce((acc, r) => ({ ...acc, [r]: items.filter((i) => i.risk_level === r).length }), {} as Record<RiskLevel, number>);
  const cleared = items.filter((i) => i.is_cleared).length;
  const filtered = filterRisk === 'all' ? items : items.filter((i) => i.risk_level === filterRisk);

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Safety Plan</h1>
          <p className="text-sm text-surface-400 mt-0.5">Risk assessment and mitigation for each scene.</p>
        </div>
        {canEdit && <Button onClick={openNew}>+ Add Risk</Button>}
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
          {RISK_ORDER.map((r) => (
            <Card key={r} className={cn('p-3 text-center cursor-pointer border-2 transition-all',
              filterRisk === r ? 'border-orange-500/50' : 'border-transparent hover:border-surface-600')}
              onClick={() => setFilterRisk(filterRisk === r ? 'all' : r)}>
              <p className={cn('text-xl font-black', RISK_META[r].color.split(' ')[1])}>{counts[r]}</p>
              <p className="text-[11px] text-surface-500 capitalize mt-0.5">{r}</p>
            </Card>
          ))}
          <Card className="p-3 text-center">
            <p className="text-xl font-black text-green-400">{cleared}</p>
            <p className="text-[11px] text-surface-500 mt-0.5">Cleared</p>
          </Card>
        </div>
      )}

      {filterRisk !== 'all' && (
        <button onClick={() => setFilterRisk('all')} className="text-xs text-orange-400 mb-3 hover:underline">← Show all risks</button>
      )}

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-surface-500">
          <p className="font-medium text-white mb-1">{items.length === 0 ? 'No safety items yet' : 'None in this category'}</p>
          <p className="text-sm">Document hazards, risk levels, and their mitigations.</p>
          {canEdit && items.length === 0 && <Button className="mt-4" onClick={openNew}>Add First Item</Button>}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.sort((a, b) => RISK_ORDER.indexOf(a.risk_level) - RISK_ORDER.indexOf(b.risk_level)).map((item) => (
            <Card key={item.id} className={cn('group p-4 transition-colors', item.is_cleared && 'opacity-50')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button onClick={() => canEdit && toggleCleared(item)}
                    className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
                      item.is_cleared ? 'border-green-500 bg-green-500/20' : 'border-surface-600 hover:border-green-500/50')}>
                    {item.is_cleared && <svg className="w-2.5 h-2.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border', RISK_META[item.risk_level].color)}>
                        {RISK_META[item.risk_level].label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-surface-700/60 text-surface-400 capitalize border border-surface-700">{item.category}</span>
                      <span className="text-[11px] text-surface-500 truncate">{sceneLabel(item.scene_id)}</span>
                    </div>
                    {item.description && <p className="text-sm text-white font-medium mb-1">{item.description}</p>}
                    {item.mitigation && <p className="text-xs text-surface-400 line-clamp-2">{item.mitigation}</p>}
                    {(item.responsible_person || item.responsible_dept) && (
                      <p className="text-xs text-surface-500 mt-1">
                        Responsible: {[item.responsible_person, item.responsible_dept].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex gap-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-white">Edit</button>
                    <button onClick={() => deleteItem(item.id)} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg">Delete</button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}      <ConfirmDialog />    </div>
  );
}
