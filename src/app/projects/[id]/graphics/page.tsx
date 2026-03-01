'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Modal, Input, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
  BroadcastGraphicsTemplate, BroadcastGraphicsTemplateType,
  BroadcastGraphicsCue, BroadcastGraphicsCueStatus,
} from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Graphics / CG — CasparCG-style template + cue management
// ────────────────────────────────────────────────────────────

const TEMPLATE_TYPES: BroadcastGraphicsTemplateType[] = [
  'lower_third', 'full_screen', 'ots', 'locator', 'ticker', 'scorebug',
  'name_super', 'title_card', 'logo_bug', 'strap', 'clock', 'breaking', 'other',
];

const TEMPLATE_COLORS: Record<string, string> = {
  lower_third: 'bg-blue-600', full_screen: 'bg-purple-600', ots: 'bg-indigo-600',
  locator: 'bg-teal-600', ticker: 'bg-amber-600', scorebug: 'bg-orange-600',
  name_super: 'bg-sky-600', title_card: 'bg-rose-600', logo_bug: 'bg-green-600',
  strap: 'bg-cyan-600', clock: 'bg-emerald-600', breaking: 'bg-red-600', other: 'bg-surface-700',
};

export default function GraphicsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<BroadcastGraphicsTemplate[]>([]);
  const [cues, setCues] = useState<BroadcastGraphicsCue[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<BroadcastGraphicsTemplate | null>(null);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showCreateCue, setShowCreateCue] = useState(false);
  const [tab, setTab] = useState<'templates' | 'cues'>('templates');

  // Template form
  const [tplForm, setTplForm] = useState({
    name: '', template_type: 'lower_third' as BroadcastGraphicsTemplateType,
    cg_channel: 1, cg_layer: 20, cg_template_path: '',
    fields: '[]',
  });

  // Cue form
  const [cueForm, setCueForm] = useState({
    template_id: '', title: '', cue_type: 'manual',
    field_values: '{}', duration_seconds: 5,
  });

  // ─── Fetching ──────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_graphics_templates')
      .select('*')
      .eq('project_id', projectId)
      .order('template_type', { ascending: true });
    setTemplates(data || []);
  }, [projectId]);

  const fetchCues = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_graphics_cues')
      .select('*, broadcast_graphics_templates(*)')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    setCues(data || []);
  }, [projectId]);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchTemplates(), fetchCues()]);
      setLoading(false);
    })();
  }, [fetchTemplates, fetchCues]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`gfx-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_graphics_templates', filter: `project_id=eq.${projectId}` }, () => fetchTemplates())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_graphics_cues', filter: `project_id=eq.${projectId}` }, () => fetchCues())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchTemplates, fetchCues]);

  // ─── Template CRUD ─────────────────────────────────────

  const handleSaveTemplate = async () => {
    if (!tplForm.name) { toast.error('Name is required'); return; }
    let fields: unknown[];
    try { fields = JSON.parse(tplForm.fields); } catch { toast.error('Invalid JSON for fields'); return; }

    const supabase = createClient();
    const { error } = await supabase.from('broadcast_graphics_templates').insert({
      project_id: projectId,
      name: tplForm.name,
      template_type: tplForm.template_type,
      cg_channel: tplForm.cg_channel,
      cg_layer: tplForm.cg_layer,
      cg_template_path: tplForm.cg_template_path || null,
      fields,
    });

    if (error) { toast.error(error.message); return; }
    toast.success('Template created');
    setShowAddTemplate(false);
    setTplForm({ name: '', template_type: 'lower_third', cg_channel: 1, cg_layer: 20, cg_template_path: '', fields: '[]' });
    fetchTemplates();
  };

  const handleDeleteTemplate = async (id: string) => {
    const supabase = createClient();
    await supabase.from('broadcast_graphics_templates').delete().eq('id', id);
    toast.success('Template deleted');
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
    fetchTemplates();
  };

  // ─── Cue CRUD ──────────────────────────────────────────

  const handleSaveCue = async () => {
    if (!cueForm.template_id || !cueForm.title) { toast.error('Template and title required'); return; }
    let fv: Record<string, string>;
    try { fv = JSON.parse(cueForm.field_values); } catch { toast.error('Invalid JSON for field values'); return; }

    const supabase = createClient();
    const { error } = await supabase.from('broadcast_graphics_cues').insert({
      project_id: projectId,
      template_id: cueForm.template_id,
      title: cueForm.title,
      cue_type: cueForm.cue_type,
      field_values: fv,
      duration_seconds: cueForm.duration_seconds,
      sort_order: cues.length,
    });

    if (error) { toast.error(error.message); return; }
    toast.success('Cue created');
    setShowCreateCue(false);
    setCueForm({ template_id: '', title: '', cue_type: 'manual', field_values: '{}', duration_seconds: 5 });
    fetchCues();
  };

  const handleDeleteCue = async (id: string) => {
    const supabase = createClient();
    await supabase.from('broadcast_graphics_cues').delete().eq('id', id);
    toast.success('Cue deleted');
    fetchCues();
  };

  const handleSetCueStatus = async (cue: BroadcastGraphicsCue, status: BroadcastGraphicsCueStatus) => {
    const supabase = createClient();
    await supabase.from('broadcast_graphics_cues').update({ status }).eq('id', cue.id);
    if (status === 'on_air') toast.success(`▶ Playing: ${cue.title}`);
    if (status === 'done') toast(`⏹ Stopped: ${cue.title}`);
    fetchCues();
  };

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* Header */}
      <div className="p-3 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold text-white">Graphics / CG</h2>
          <div className="flex bg-surface-800 rounded-lg p-0.5">
            <button onClick={() => setTab('templates')} className={cn('px-3 py-1 text-xs rounded-md transition', tab === 'templates' ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white')}>
              Templates ({templates.length})
            </button>
            <button onClick={() => setTab('cues')} className={cn('px-3 py-1 text-xs rounded-md transition', tab === 'cues' ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white')}>
              Cue Stack ({cues.length})
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {tab === 'templates' && <Button size="sm" onClick={() => setShowAddTemplate(true)}>+ Template</Button>}
          {tab === 'cues' && <Button size="sm" onClick={() => setShowCreateCue(true)}>+ Cue</Button>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'templates' ? (
          templates.length === 0 ? (
            <EmptyState title="No Templates" description="Create graphics templates to define your on-air graphics." action={<Button onClick={() => setShowAddTemplate(true)}>Create Template</Button>} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={cn(
                    'p-4 rounded-lg border cursor-pointer transition-all',
                    selectedTemplate?.id === tpl.id ? 'border-[#FF5F1F] bg-surface-800' : 'border-surface-800 bg-surface-900 hover:border-surface-700',
                  )}
                >
                  <div className={cn('w-full aspect-video rounded mb-3 flex items-center justify-center', TEMPLATE_COLORS[tpl.template_type] || 'bg-surface-700')}>
                    <span className="text-white/70 text-xs font-bold uppercase">{tpl.template_type.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-sm font-medium text-white">{tpl.name}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-surface-500">
                    {tpl.cg_channel != null && <span>Ch{tpl.cg_channel}</span>}
                    {tpl.cg_layer != null && <span>L{tpl.cg_layer}</span>}
                    {tpl.cg_template_path && <span className="truncate max-w-[120px]">{tpl.cg_template_path}</span>}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }} className="text-red-400 text-[10px]">Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          cues.length === 0 ? (
            <EmptyState title="No Cues" description="Create cues from your templates to build the graphics stack for the show." action={<Button onClick={() => setShowCreateCue(true)}>Create Cue</Button>} />
          ) : (
            <div className="space-y-2 max-w-3xl">
              {cues.map((cue, i) => {
                const tpl = templates.find(t => t.id === cue.template_id);
                const isOnAir = cue.status === 'on_air';
                return (
                  <div
                    key={cue.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all',
                      isOnAir ? 'border-red-500/50 bg-red-950/20' : 'border-surface-800 bg-surface-900',
                    )}
                  >
                    <span className="text-xs text-surface-500 w-6 text-center font-mono">{i + 1}</span>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded text-white', tpl ? TEMPLATE_COLORS[tpl.template_type] || 'bg-surface-700' : 'bg-surface-700')}>
                      {tpl?.template_type.replace(/_/g, ' ').toUpperCase() || '?'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium">{cue.title}</div>
                      <div className="text-[10px] text-surface-500">{tpl?.name || 'Unknown template'} · {cue.duration_seconds}s</div>
                    </div>
                    {isOnAir && <span className="text-[10px] text-red-400 font-bold animate-pulse">ON AIR</span>}
                    <span className="text-[10px] text-surface-500 uppercase">{cue.status}</span>
                    <div className="flex gap-1 shrink-0">
                      {isOnAir ? (
                        <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleSetCueStatus(cue, 'done')}>⏹ Stop</Button>
                      ) : (
                        <>
                          {cue.status !== 'done' && (
                            <Button size="sm" onClick={() => handleSetCueStatus(cue, 'on_air')}>▶ Play</Button>
                          )}
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleDeleteCue(cue.id)}>×</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Add Template Modal */}
      <Modal isOpen={showAddTemplate} onClose={() => setShowAddTemplate(false)} title="Create Graphics Template">
        <div className="space-y-4">
          <Input label="Template Name" value={tplForm.name} onChange={(e) => setTplForm(p => ({ ...p, name: e.target.value }))} placeholder="Main Lower Third, Full OTS..." />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Type</label>
              <select value={tplForm.template_type} onChange={(e) => setTplForm(p => ({ ...p, template_type: e.target.value as BroadcastGraphicsTemplateType }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm">
                {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <Input label="CasparCG Template Path" value={tplForm.cg_template_path} onChange={(e) => setTplForm(p => ({ ...p, cg_template_path: e.target.value }))} placeholder="template/lower_third" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">CG Channel</label>
              <input type="number" value={tplForm.cg_channel} onChange={(e) => setTplForm(p => ({ ...p, cg_channel: Number(e.target.value) }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">CG Layer</label>
              <input type="number" value={tplForm.cg_layer} onChange={(e) => setTplForm(p => ({ ...p, cg_layer: Number(e.target.value) }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-400 block mb-1">Fields (JSON Array)</label>
            <textarea value={tplForm.fields} onChange={(e) => setTplForm(p => ({ ...p, fields: e.target.value }))}
              className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm font-mono resize-none" rows={4}
              placeholder='[{"key":"line1","label":"Name","type":"text"},{"key":"line2","label":"Title","type":"text"}]' />
            <p className="text-[10px] text-surface-500 mt-1">Define template fields: key, label, type (text/number/color/image/boolean), default_value.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddTemplate(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate}>Create Template</Button>
          </div>
        </div>
      </Modal>

      {/* Create Cue Modal */}
      <Modal isOpen={showCreateCue} onClose={() => setShowCreateCue(false)} title="Create Graphics Cue">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-400 block mb-1">Template</label>
            <select value={cueForm.template_id} onChange={(e) => setCueForm(p => ({ ...p, template_id: e.target.value }))}
              className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm">
              <option value="">Select template...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.template_type.replace(/_/g, ' ')})</option>)}
            </select>
          </div>
          <Input label="Cue Title" value={cueForm.title} onChange={(e) => setCueForm(p => ({ ...p, title: e.target.value }))} placeholder="John Smith - Reporter, Breaking News..." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cue Type" value={cueForm.cue_type} onChange={(e) => setCueForm(p => ({ ...p, cue_type: e.target.value }))} placeholder="manual, auto, triggered..." />
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Duration (s)</label>
              <input type="number" value={cueForm.duration_seconds} onChange={(e) => setCueForm(p => ({ ...p, duration_seconds: Number(e.target.value) }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-400 block mb-1">Field Values (JSON)</label>
            <textarea value={cueForm.field_values} onChange={(e) => setCueForm(p => ({ ...p, field_values: e.target.value }))}
              className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm font-mono resize-none" rows={4}
              placeholder='{"line1": "John Smith", "line2": "Reporter, Oslo"}' />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreateCue(false)}>Cancel</Button>
            <Button onClick={handleSaveCue}>Create Cue</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
