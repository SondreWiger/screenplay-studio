'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore, useScriptStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type {
  ShootDay, ShootDayScene, ShootDayCast, ShootDayStatus,
  ShootGear, ScriptElement,
} from '@/lib/types';
import { GEAR_CATEGORIES } from '@/lib/types';

// ── Status helpers ──────────────────────────────────────────
const DAY_STATUS_LABEL: Record<ShootDayStatus, string> = {
  planned: 'Planned', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled',
};
const DAY_STATUS_COLOR: Record<ShootDayStatus, string> = {
  planned: 'text-surface-400 bg-surface-800 border-surface-700',
  confirmed: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  completed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  cancelled: 'text-red-400 bg-red-500/10 border-red-500/30',
};
const DAY_STATUS_CYCLE: ShootDayStatus[] = ['planned', 'confirmed', 'completed', 'cancelled'];

// ── Enrich type for display ─────────────────────────────────
interface EnrichedDay extends ShootDay {
  scenes: ShootDayScene[];
  cast: ShootDayCast[];
  gear: ShootGear[];
}

const emptyDay = (projectId: string, dayNumber: number): Partial<ShootDay> => ({
  project_id: projectId, day_number: dayNumber,
  shoot_date: null, title: null, call_time: null, wrap_time: null,
  location: null, notes: null, status: 'planned',
});

export default function SchedulePackPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const { scripts, currentScript, fetchScripts } = useScriptStore();
  const currentUserRole = members.find(m => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [days, setDays] = useState<EnrichedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<Partial<ShootDay> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddScene, setShowAddScene] = useState(false);
  const [showAddCast, setShowAddCast] = useState(false);
  const [allSceneHeadings, setAllSceneHeadings] = useState<ScriptElement[]>([]);
  const [allScriptElements, setAllScriptElements] = useState<ScriptElement[]>([]);
  const [allProjectGear, setAllProjectGear] = useState<ShootGear[]>([]);
  const [showAssignGear, setShowAssignGear] = useState(false);
  const [gearSearch, setGearSearch] = useState('');
  const [showNewGearInline, setShowNewGearInline] = useState(false);
  const [newGearForm, setNewGearForm] = useState({ name: '', category: 'Camera', quantity: 1, unit: 'unit', ownership: 'tbc', vendor: '' });
  const [savingGear, setSavingGear] = useState(false);
  const [sceneSearch, setSceneSearch] = useState('');
  const [newCast, setNewCast] = useState({ character_name: '', actor_name: '', call_time: '' });

  const activeScript = currentScript ?? scripts?.[0] ?? null;

  useEffect(() => {
    if (!scripts || scripts.length === 0) fetchScripts(params.id);
  }, [params.id]);

  const fetchDays = useCallback(async () => {
    const supabase = createClient();
    const [{ data: daysData }, { data: scenesData }, { data: castData }, { data: gearData }] = await Promise.all([
      supabase.from('shoot_days').select('*').eq('project_id', params.id).order('day_number'),
      supabase.from('shoot_day_scenes').select('*').eq('project_id', params.id).order('sort_order'),
      supabase.from('shoot_day_cast').select('*').eq('project_id', params.id).order('sort_order'),
      supabase.from('shoot_gear').select('*').eq('project_id', params.id).neq('status', 'cancelled'),
    ]);

    setAllProjectGear((gearData || []) as ShootGear[]);
    const enriched: EnrichedDay[] = (daysData || []).map(d => ({
      ...d,
      scenes: (scenesData || []).filter(s => s.shoot_day_id === d.id),
      cast: (castData || []).filter(c => c.shoot_day_id === d.id),
      gear: (gearData || []).filter(g => g.shoot_day_id === d.id),
    }));
    setDays(enriched);
    if (enriched.length > 0 && !selectedDayId) setSelectedDayId(enriched[0].id);
    setLoading(false);
  }, [params.id]);

  const fetchAllScriptElements = useCallback(async () => {
    if (!activeScript) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('script_elements')
      .select('id, content, scene_number, sort_order, script_id, element_type')
      .eq('script_id', activeScript.id)
      .order('sort_order');
    const elements = (data || []) as unknown as ScriptElement[];
    setAllScriptElements(elements);
    setAllSceneHeadings(elements.filter(el => el.element_type === 'scene_heading'));
  }, [activeScript?.id]);

  useEffect(() => { fetchDays(); }, [fetchDays]);
  useEffect(() => { fetchAllScriptElements(); }, [fetchAllScriptElements]);

  const selectedDay = days.find(d => d.id === selectedDayId) ?? null;

  // ── Day CRUD ─────────────────────────────────────────────
  const handleAddDay = async () => {
    const supabase = createClient();
    const nextNum = days.length + 1;
    const payload = { ...emptyDay(params.id, nextNum), created_by: user?.id };
    const { data, error } = await supabase.from('shoot_days').insert(payload).select().single();
    if (error) { toast.error('Failed to add shoot day.'); return; }
    const newDay: EnrichedDay = { ...(data as ShootDay), scenes: [], cast: [], gear: [] };
    setDays(prev => [...prev, newDay]);
    setSelectedDayId(newDay.id);
  };

  const handleSaveDay = async () => {
    if (!editingDay || !selectedDay) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('shoot_days').update({
      shoot_date: editingDay.shoot_date || null,
      title: editingDay.title?.trim() || null,
      call_time: editingDay.call_time || null,
      wrap_time: editingDay.wrap_time || null,
      location: editingDay.location?.trim() || null,
      notes: editingDay.notes?.trim() || null,
    }).eq('id', selectedDay.id);
    setSaving(false);
    if (error) { toast.error('Failed to save.'); return; }
    setDays(prev => prev.map(d => d.id === selectedDay.id ? { ...d, ...editingDay } : d));
    setEditingDay(null);
    toast.success('Day updated.');
  };

  const handleCycleStatus = async (day: EnrichedDay) => {
    if (!canEdit) return;
    const next = DAY_STATUS_CYCLE[(DAY_STATUS_CYCLE.indexOf(day.status) + 1) % DAY_STATUS_CYCLE.length];
    const supabase = createClient();
    await supabase.from('shoot_days').update({ status: next }).eq('id', day.id);
    setDays(prev => prev.map(d => d.id === day.id ? { ...d, status: next } : d));
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!confirm('Delete this shoot day and all its scene/cast assignments?')) return;
    const supabase = createClient();
    await supabase.from('shoot_days').delete().eq('id', dayId);
    setDays(prev => prev.filter(d => d.id !== dayId));
    setSelectedDayId(days.filter(d => d.id !== dayId)[0]?.id ?? null);
    toast.success('Shoot day deleted.');
  };

  // ── Scene assignment ─────────────────────────────────────
  const handleAddSceneToDay = async (el: ScriptElement) => {
    if (!selectedDay) return;
    // skip if already assigned
    if (selectedDay.scenes.some(s => s.scene_element_id === el.id)) return;
    const supabase = createClient();
    const payload = {
      shoot_day_id: selectedDay.id, project_id: params.id,
      scene_element_id: el.id, scene_heading: el.content,
      scene_number: el.scene_number || null, script_id: activeScript?.id || null,
      sort_order: selectedDay.scenes.length,
    };
    const { data, error } = await supabase.from('shoot_day_scenes').insert(payload).select().single();
    if (error) { toast.error('Failed to add scene.'); return; }
    setDays(prev => prev.map(d => d.id === selectedDay.id ? { ...d, scenes: [...d.scenes, data as ShootDayScene] } : d));
  };

  const handleRemoveScene = async (sceneId: string) => {
    const supabase = createClient();
    await supabase.from('shoot_day_scenes').delete().eq('id', sceneId);
    setDays(prev => prev.map(d => ({
      ...d,
      scenes: d.scenes.filter(s => s.id !== sceneId),
    })));
  };

  // ── Cast assignment ──────────────────────────────────────
  const handleAddCast = async () => {
    if (!selectedDay || !newCast.character_name.trim()) return;
    const supabase = createClient();
    const payload = {
      shoot_day_id: selectedDay.id, project_id: params.id,
      character_name: newCast.character_name.trim(),
      actor_name: newCast.actor_name.trim() || null,
      call_time: newCast.call_time || null,
      sort_order: selectedDay.cast.length,
    };
    const { data, error } = await supabase.from('shoot_day_cast').insert(payload).select().single();
    if (error) { toast.error('Failed to add cast member.'); return; }
    setDays(prev => prev.map(d => d.id === selectedDay.id ? { ...d, cast: [...d.cast, data as ShootDayCast] } : d));
    setNewCast({ character_name: '', actor_name: '', call_time: '' });
    setShowAddCast(false);
  };

  const handleRemoveCast = async (castId: string) => {
    const supabase = createClient();
    await supabase.from('shoot_day_cast').delete().eq('id', castId);
    setDays(prev => prev.map(d => ({ ...d, cast: d.cast.filter(c => c.id !== castId) })));
  };

  // ── Gear assignment ──────────────────────────────────────
  const handleAssignGear = async (gearItem: ShootGear) => {
    if (!selectedDay) return;
    const supabase = createClient();
    const { error } = await supabase.from('shoot_gear').update({ shoot_day_id: selectedDay.id }).eq('id', gearItem.id);
    if (error) { toast.error('Failed to assign gear.'); return; }
    const updated = { ...gearItem, shoot_day_id: selectedDay.id };
    setAllProjectGear(prev => prev.map(g => g.id === gearItem.id ? updated : g));
    setDays(prev => prev.map(d => {
      if (d.id === selectedDay.id) return { ...d, gear: [...d.gear, updated] };
      return { ...d, gear: d.gear.filter(g => g.id !== gearItem.id) };
    }));
    setShowAssignGear(false);
    setGearSearch('');
  };

  const handleUnassignGear = async (gearId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('shoot_gear').update({ shoot_day_id: null }).eq('id', gearId);
    if (error) { toast.error('Failed to unassign gear.'); return; }
    setAllProjectGear(prev => prev.map(g => g.id === gearId ? { ...g, shoot_day_id: null } : g));
    setDays(prev => prev.map(d => ({ ...d, gear: d.gear.filter(g => g.id !== gearId) })));
  };

  const handleCreateGearForDay = async () => {
    if (!selectedDay || !newGearForm.name.trim()) { toast.error('Name is required.'); return; }
    setSavingGear(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('shoot_gear').insert({
      project_id: params.id,
      shoot_day_id: selectedDay.id,
      name: newGearForm.name.trim(),
      category: newGearForm.category,
      quantity: newGearForm.quantity,
      unit: newGearForm.unit,
      ownership: newGearForm.ownership,
      vendor: newGearForm.vendor.trim() || null,
      status: 'pending',
      created_by: user?.id,
    }).select().single();
    setSavingGear(false);
    if (error) { toast.error('Failed to add gear.'); return; }
    const newItem = data as ShootGear;
    setAllProjectGear(prev => [...prev, newItem]);
    setDays(prev => prev.map(d => d.id === selectedDay.id ? { ...d, gear: [...d.gear, newItem] } : d));
    setNewGearForm({ name: '', category: 'Camera', quantity: 1, unit: 'unit', ownership: 'tbc', vendor: '' });
    setShowNewGearInline(false);
    toast.success('Gear item added.');
  };

  // ── Script content helpers ───────────────────────────────
  const getSceneContent = (sceneElementId: string | null): ScriptElement[] => {
    if (!sceneElementId) return [];
    const idx = allScriptElements.findIndex(el => el.id === sceneElementId);
    if (idx === -1) return [];
    const result: ScriptElement[] = [];
    for (let i = idx + 1; i < allScriptElements.length; i++) {
      if (allScriptElements[i].element_type === 'scene_heading') break;
      result.push(allScriptElements[i]);
    }
    return result;
  };

  const renderScriptElement = (el: ScriptElement) => {
    switch (el.element_type) {
      case 'action':
        return <p key={el.id} className="text-surface-200 whitespace-pre-wrap leading-relaxed">{el.content}</p>;
      case 'character':
        return <p key={el.id} className="text-white font-bold text-center mt-3 uppercase tracking-wide">{el.content}</p>;
      case 'parenthetical':
        return <p key={el.id} className="text-surface-400 text-center italic text-[10px]">{el.content}</p>;
      case 'dialogue':
        return <p key={el.id} className="text-surface-100 mx-8 leading-relaxed">{el.content}</p>;
      case 'transition':
        return <p key={el.id} className="text-surface-500 text-right uppercase text-[10px] tracking-wider mt-2">{el.content}</p>;
      default:
        return <p key={el.id} className="text-surface-400">{el.content}</p>;
    }
  };

  // ── Day pack export ──────────────────────────────────────
  const handleExportDayPack = (day: EnrichedDay) => {
    const projectTitle = currentProject?.title || 'Project';
    const dayTitle = day.title || `Day ${day.day_number}`;
    const dateStr = day.shoot_date
      ? new Date(day.shoot_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Date TBD';

    const sceneRows = day.scenes.map(s => `
      <tr>
        <td class="num">${s.scene_number || '—'}</td>
        <td>${s.scene_heading}</td>
        <td class="num">${s.estimated_pages != null ? s.estimated_pages + 'p' : '—'}</td>
        <td>${s.notes || ''}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="empty">No scenes assigned</td></tr>';

    const castRows = day.cast.map(c => `
      <tr>
        <td><strong>${c.character_name}</strong></td>
        <td>${c.actor_name || '—'}</td>
        <td class="num">${c.makeup_call || ''}</td>
        <td class="num">${c.call_time || '—'}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="empty">No cast assigned</td></tr>';

    const gearRows = day.gear.map(g => `
      <tr>
        <td>${g.name}</td>
        <td>${g.category}</td>
        <td class="num">${g.quantity} ${g.unit}</td>
        <td>${g.vendor || '—'}</td>
        <td>${g.status}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="empty">No gear assigned to this day</td></tr>';

    // Build screenplay sides (one block per assigned scene)
    const sidesHtml = day.scenes.map(scene => {
      const content = getSceneContent(scene.scene_element_id);
      const contentHtml = content.map(el => {
        const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        switch (el.element_type) {
          case 'action':       return `<p class="s-action">${esc(el.content)}</p>`;
          case 'character':    return `<p class="s-character">${esc(el.content)}</p>`;
          case 'parenthetical':return `<p class="s-paren">${esc(el.content)}</p>`;
          case 'dialogue':     return `<p class="s-dialogue">${esc(el.content)}</p>`;
          case 'transition':   return `<p class="s-transition">${esc(el.content)}</p>`;
          default:             return `<p class="s-action">${esc(el.content)}</p>`;
        }
      }).join('');
      return `<div class="scene-block">
        <div class="s-heading">${scene.scene_number ? scene.scene_number + '. ' : ''}${scene.scene_heading}</div>
        ${contentHtml || '<p class="s-action" style="color:#aaa;font-style:italic">No script content found for this scene.</p>'}
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${projectTitle} — Shoot Day ${day.day_number} Pack</title>
  <style>
    @page { size: A4 portrait; margin: 18mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt; color: #111; }

    .page-break { page-break-before: always; }

    /* Header */
    .header { border-bottom: 2px solid #111; padding-bottom: 8pt; margin-bottom: 14pt; display: flex; justify-content: space-between; align-items: flex-start; }
    .header h1 { font-size: 16pt; font-weight: 900; }
    .header .meta { font-size: 8pt; color: #555; text-align: right; line-height: 1.7; }
    .header .sub { font-size: 9pt; color: #444; margin-top: 2pt; }

    /* Info strip */
    .info-strip { display: flex; gap: 20pt; margin-bottom: 16pt; padding: 8pt 10pt; background: #f5f5f5; border-radius: 4pt; }
    .info-item { }
    .info-item .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 2pt; }
    .info-item .value { font-size: 9pt; font-weight: 700; color: #111; }

    /* Sections */
    .section-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #555; margin-bottom: 5pt; padding-bottom: 3pt; border-bottom: 1pt solid #ddd; }
    .section { margin-bottom: 18pt; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #888; padding: 3pt 5pt; border-bottom: 1pt solid #ddd; }
    td { padding: 4pt 5pt; border-bottom: 0.5pt solid #eee; font-size: 8.5pt; vertical-align: top; line-height: 1.4; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    td.num { text-align: center; font-size: 8pt; color: #555; width: 40pt; }
    td.empty { color: #aaa; text-align: center; padding: 10pt; font-style: italic; }

    /* Footer */
    .footer { margin-top: 16pt; border-top: 0.5pt solid #ddd; padding-top: 6pt; font-size: 7pt; color: #bbb; display: flex; justify-content: space-between; }

    /* Screenplay sides */
    .scene-block { margin-bottom: 22pt; break-inside: avoid; }
    .s-heading { font-size: 9pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; padding-bottom: 4pt; margin-bottom: 7pt; border-bottom: 1.5pt solid #111; }
    .s-action { font-size: 9pt; line-height: 1.65; color: #111; margin-bottom: 5pt; white-space: pre-wrap; }
    .s-character { font-size: 9pt; font-weight: 700; text-align: center; text-transform: uppercase; margin-top: 9pt; margin-bottom: 1pt; }
    .s-paren { font-size: 8.5pt; text-align: center; font-style: italic; color: #444; margin-left: 22%; margin-right: 22%; margin-bottom: 2pt; }
    .s-dialogue { font-size: 9pt; margin-left: 18%; margin-right: 18%; line-height: 1.6; margin-bottom: 5pt; }
    .s-transition { font-size: 8pt; text-align: right; text-transform: uppercase; color: #666; margin-top: 5pt; margin-bottom: 5pt; letter-spacing: 0.06em; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${projectTitle}</h1>
      <div class="sub">Shoot Day ${day.day_number} — ${dayTitle}</div>
    </div>
    <div class="meta">
      <div>${dateStr}</div>
      <div>Status: ${DAY_STATUS_LABEL[day.status]}</div>
      <div>Generated ${new Date().toLocaleDateString('en-GB')}</div>
    </div>
  </div>

  <div class="info-strip">
    <div class="info-item"><div class="label">General Call</div><div class="value">${day.call_time || 'TBD'}</div></div>
    <div class="info-item"><div class="label">Est. Wrap</div><div class="value">${day.wrap_time || 'TBD'}</div></div>
    <div class="info-item"><div class="label">Location</div><div class="value">${day.location || 'TBD'}</div></div>
    <div class="info-item"><div class="label">Scenes</div><div class="value">${day.scenes.length}</div></div>
    <div class="info-item"><div class="label">Cast Called</div><div class="value">${day.cast.length}</div></div>
  </div>

  <!-- Scenes -->
  <div class="section">
    <div class="section-title">Scenes Scheduled</div>
    <table>
      <thead><tr><th style="width:36pt">Scene</th><th>Heading</th><th style="width:36pt">Pages</th><th>Notes</th></tr></thead>
      <tbody>${sceneRows}</tbody>
    </table>
  </div>

  <!-- Cast -->
  <div class="section">
    <div class="section-title">Cast Called</div>
    <table>
      <thead><tr><th>Character</th><th>Actor</th><th style="width:52pt">H/MU Call</th><th style="width:52pt">Set Call</th></tr></thead>
      <tbody>${castRows}</tbody>
    </table>
  </div>

  <!-- Gear -->
  <div class="section">
    <div class="section-title">Gear &amp; Equipment</div>
    <table>
      <thead><tr><th>Item</th><th>Category</th><th style="width:44pt">Qty</th><th>Vendor</th><th style="width:52pt">Status</th></tr></thead>
      <tbody>${gearRows}</tbody>
    </table>
  </div>

  ${day.notes ? `<div class="section"><div class="section-title">Notes</div><p style="font-size:8.5pt;line-height:1.6;color:#333">${day.notes.replace(/\n/g, '<br>')}</p></div>` : ''}

  <div class="footer">
    <span>${projectTitle} — Day ${day.day_number} Pack</span>
    <span>Screenplay Studio</span>
  </div>

  <!-- Sides (scene pages for actors) -->
  ${day.scenes.length > 0 && sidesHtml ? `
  <div class="page-break"></div>
  <div class="header">
    <div>
      <h1 style="font-size:14pt">${projectTitle}</h1>
      <div class="sub">Sides — Day ${day.day_number} — ${dayTitle}</div>
    </div>
    <div class="meta">
      <div>${dateStr}</div>
      <div>Generated ${new Date().toLocaleDateString('en-GB')}</div>
    </div>
  </div>
  ${sidesHtml}
  <div class="footer">
    <span>${projectTitle} — Day ${day.day_number} Sides</span>
    <span>Screenplay Studio</span>
  </div>` : ''}  

  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // ── Export all days as CSV ───────────────────────────────
  const handleExportAllCSV = () => {
    const header = ['Day', 'Date', 'Title', 'Location', 'Call Time', 'Wrap Time', 'Status', 'Scenes', 'Cast'];
    const rows = days.map(d => [
      d.day_number,
      d.shoot_date || '',
      d.title || '',
      d.location || '',
      d.call_time || '',
      d.wrap_time || '',
      DAY_STATUS_LABEL[d.status],
      d.scenes.map(s => s.scene_heading).join('; '),
      d.cast.map(c => `${c.character_name}${c.actor_name ? ` (${c.actor_name})` : ''}`).join('; '),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${currentProject?.title || 'project'}-schedule.csv`;
    a.click();
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Day list sidebar ── */}
      <div className="w-56 shrink-0 border-r border-surface-800 flex flex-col">
        <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Shoot Days</span>
          {canEdit && (
            <button onClick={handleAddDay} className="text-surface-500 hover:text-[#FF5F1F] p-1 rounded transition-colors" title="Add day">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {days.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-surface-600">No shoot days yet.</p>
              {canEdit && <button onClick={handleAddDay} className="mt-2 text-xs text-[#FF5F1F] hover:underline">Add first day</button>}
            </div>
          ) : (
            days.map(day => (
              <button
                key={day.id}
                onClick={() => setSelectedDayId(day.id)}
                className={cn(
                  'w-full text-left px-4 py-2.5 hover:bg-surface-800/50 transition-colors group',
                  selectedDayId === day.id && 'bg-surface-800/80 border-r-2 border-[#FF5F1F]'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('text-sm font-medium', selectedDayId === day.id ? 'text-white' : 'text-surface-300')}>
                    Day {day.day_number}
                  </span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', DAY_STATUS_COLOR[day.status])}>
                    {DAY_STATUS_LABEL[day.status].slice(0, 3)}
                  </span>
                </div>
                {day.shoot_date && (
                  <p className="text-[11px] text-surface-500 mt-0.5">
                    {new Date(day.shoot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                )}
                {day.location && (
                  <p className="text-[11px] text-surface-600 truncate">{day.location}</p>
                )}
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border-surface-800">
          <button onClick={handleExportAllCSV} className="w-full text-xs text-surface-500 hover:text-white py-1.5 rounded-lg hover:bg-surface-800 transition-colors flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export Schedule CSV
          </button>
        </div>
      </div>

      {/* ── Day detail ── */}
      {!selectedDay ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-surface-400 font-medium">Select a shoot day</p>
            {canEdit && <button onClick={handleAddDay} className="mt-2 text-sm text-[#FF5F1F] hover:underline">or add one</button>}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Day header */}
          <div className="sticky top-0 z-10 bg-[#070710]/95 backdrop-blur border-b border-surface-800 px-6 py-3 flex items-center gap-3">
            <div className="flex-1">
              {editingDay ? (
                <input
                  value={editingDay.title || ''}
                  onChange={e => setEditingDay(d => d ? { ...d, title: e.target.value } : d)}
                  placeholder={`Day ${selectedDay.day_number}`}
                  className="text-lg font-bold text-white bg-transparent outline-none border-b border-[#FF5F1F]/40 focus:border-[#FF5F1F] w-full max-w-sm"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">
                    Day {selectedDay.day_number}{selectedDay.title ? ` — ${selectedDay.title}` : ''}
                  </h2>
                  <button
                    onClick={() => handleCycleStatus(selectedDay)}
                    disabled={!canEdit}
                    className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all hover:opacity-80', DAY_STATUS_COLOR[selectedDay.status])}
                  >
                    {DAY_STATUS_LABEL[selectedDay.status]}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {editingDay ? (
                <>
                  <button onClick={() => setEditingDay(null)} className="text-xs px-3 py-1.5 rounded-lg border border-surface-700 text-surface-300 hover:text-white transition-colors">Cancel</button>
                  <button onClick={handleSaveDay} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-[#FF5F1F] text-white font-semibold hover:bg-orange-500 active:scale-95 transition-all disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : (
                <>
                  {canEdit && (
                    <button onClick={() => setEditingDay({ ...selectedDay })} className="text-xs px-2.5 py-1.5 rounded-lg border border-surface-700 text-surface-300 hover:text-white transition-colors flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleExportDayPack(selectedDay)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-[#FF5F1F] text-white font-semibold hover:bg-orange-500 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Export Day Pack
                  </button>
                  {canEdit && (
                    <button onClick={() => handleDeleteDay(selectedDay.id)} className="text-xs p-1.5 rounded-lg text-surface-600 hover:text-red-400 transition-colors" title="Delete day">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Day info fields */}
            {editingDay ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Date', key: 'shoot_date', type: 'date' },
                  { label: 'Call Time', key: 'call_time', type: 'time' },
                  { label: 'Est. Wrap', key: 'wrap_time', type: 'time' },
                  { label: 'Location', key: 'location', type: 'text' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="block text-[11px] text-surface-500 mb-1">{label}</label>
                    <input
                      type={type}
                      value={(editingDay as Record<string, unknown>)[key] as string || ''}
                      onChange={e => setEditingDay(d => d ? { ...d, [key]: e.target.value || null } : d)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-surface-900 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60"
                    />
                  </div>
                ))}
                <div className="col-span-2 md:col-span-4">
                  <label className="block text-[11px] text-surface-500 mb-1">Notes</label>
                  <textarea
                    value={editingDay.notes || ''}
                    onChange={e => setEditingDay(d => d ? { ...d, notes: e.target.value } : d)}
                    rows={2}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-900 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60 resize-none"
                    placeholder="Day notes…"
                  />
                </div>
              </div>
            ) : (
              /* Info pills */
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Date', value: selectedDay.shoot_date ? new Date(selectedDay.shoot_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD' },
                  { label: 'Call', value: selectedDay.call_time || 'TBD' },
                  { label: 'Wrap', value: selectedDay.wrap_time || 'TBD' },
                  { label: 'Location', value: selectedDay.location || 'TBD' },
                ].map(({ label, value }) => (
                  <div key={label} className="px-3 py-2 rounded-xl bg-surface-900 border border-surface-800">
                    <p className="text-[10px] text-surface-500 uppercase tracking-wider">{label}</p>
                    <p className="text-sm font-medium text-white mt-0.5">{value}</p>
                  </div>
                ))}
                {selectedDay.notes && (
                  <div className="px-3 py-2 rounded-xl bg-surface-900 border border-surface-800 flex-1 min-w-[200px]">
                    <p className="text-[10px] text-surface-500 uppercase tracking-wider">Notes</p>
                    <p className="text-sm text-surface-300 mt-0.5 whitespace-pre-wrap">{selectedDay.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Scenes section ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Scenes — {selectedDay.scenes.length}</h3>
                {canEdit && (
                  <button onClick={() => setShowAddScene(true)} className="text-xs text-[#FF5F1F] hover:underline flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Scene
                  </button>
                )}
              </div>

              {showAddScene && (
                <div className="mb-3 p-3 rounded-xl bg-surface-900 border border-surface-700">
                  <input
                    value={sceneSearch}
                    onChange={e => setSceneSearch(e.target.value)}
                    placeholder="Search scene headings…"
                    className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60 mb-2"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {allSceneHeadings
                      .filter(el => !sceneSearch || el.content.toLowerCase().includes(sceneSearch.toLowerCase()))
                      .map(el => (
                        <button key={el.id} onClick={() => { handleAddSceneToDay(el); setShowAddScene(false); setSceneSearch(''); }}
                          className={cn('w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors',
                            selectedDay.scenes.some(s => s.scene_element_id === el.id)
                              ? 'text-surface-600 cursor-not-allowed'
                              : 'text-surface-300 hover:bg-surface-700 hover:text-white'
                          )}>
                          {el.scene_number && <span className="text-surface-500 mr-1.5">#{el.scene_number}</span>}
                          {el.content}
                          {selectedDay.scenes.some(s => s.scene_element_id === el.id) && <span className="ml-2 text-[10px] text-surface-600">Already added</span>}
                        </button>
                      ))}
                  </div>
                  <button onClick={() => { setShowAddScene(false); setSceneSearch(''); }} className="mt-2 text-xs text-surface-500 hover:text-white">Cancel</button>
                </div>
              )}

              {selectedDay.scenes.length === 0 ? (
                <p className="text-xs text-surface-600 italic py-2">No scenes assigned to this day.</p>
              ) : (
                <div className="rounded-xl border border-surface-800 overflow-hidden">
                  {selectedDay.scenes.map((scene, idx) => (
                    <div key={scene.id} className={cn('flex items-center gap-3 px-4 py-2.5 text-sm group', idx < selectedDay.scenes.length - 1 && 'border-b border-surface-800/50')}>
                      {scene.scene_number && <span className="text-[11px] text-surface-500 font-mono w-6 shrink-0">#{scene.scene_number}</span>}
                      <span className="flex-1 text-surface-200 text-xs">{scene.scene_heading}</span>
                      {scene.estimated_pages && <span className="text-[11px] text-surface-500">{scene.estimated_pages}p</span>}
                      {canEdit && (
                        <button onClick={() => handleRemoveScene(scene.id)} className="text-surface-700 hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Cast section ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Cast Called — {selectedDay.cast.length}</h3>
                {canEdit && (
                  <button onClick={() => setShowAddCast(!showAddCast)} className="text-xs text-[#FF5F1F] hover:underline flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Cast
                  </button>
                )}
              </div>

              {showAddCast && (
                <div className="mb-3 p-3 rounded-xl bg-surface-900 border border-surface-700 grid grid-cols-3 gap-2">
                  <input value={newCast.character_name} onChange={e => setNewCast(c => ({ ...c, character_name: e.target.value }))}
                    placeholder="Character *" autoFocus
                    className="px-2.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60" />
                  <input value={newCast.actor_name} onChange={e => setNewCast(c => ({ ...c, actor_name: e.target.value }))}
                    placeholder="Actor name"
                    className="px-2.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60" />
                  <input type="time" value={newCast.call_time} onChange={e => setNewCast(c => ({ ...c, call_time: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60" />
                  <div className="col-span-3 flex justify-end gap-2">
                    <button onClick={() => { setShowAddCast(false); setNewCast({ character_name: '', actor_name: '', call_time: '' }); }} className="text-xs text-surface-500 hover:text-white px-3 py-1 rounded border border-surface-700 transition-colors">Cancel</button>
                    <button onClick={handleAddCast} className="text-xs px-3 py-1 rounded bg-[#FF5F1F] text-white font-semibold hover:bg-orange-500 active:scale-95 transition-all">Add</button>
                  </div>
                </div>
              )}

              {selectedDay.cast.length === 0 ? (
                <p className="text-xs text-surface-600 italic py-2">No cast assigned to this day.</p>
              ) : (
                <div className="rounded-xl border border-surface-800 overflow-hidden">
                  {selectedDay.cast.map((member, idx) => (
                    <div key={member.id} className={cn('flex items-center gap-3 px-4 py-2.5 group', idx < selectedDay.cast.length - 1 && 'border-b border-surface-800/50')}>
                      <span className="flex-1 text-sm font-medium text-white">{member.character_name}</span>
                      {member.actor_name && <span className="text-xs text-surface-400">{member.actor_name}</span>}
                      {member.call_time && (
                        <span className="text-xs font-mono text-surface-300 bg-surface-800 px-2 py-0.5 rounded">{member.call_time}</span>
                      )}
                      {canEdit && (
                        <button onClick={() => handleRemoveCast(member.id)} className="text-surface-700 hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Gear section ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Gear — {selectedDay.gear.length} items</h3>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setShowNewGearInline(true); setShowAssignGear(false); }} className="text-xs text-[#FF5F1F] hover:underline flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      New Item
                    </button>
                    <button onClick={() => { setShowAssignGear(true); setShowNewGearInline(false); }} className="text-xs text-surface-400 hover:text-white flex items-center gap-1 ml-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      Assign Existing
                    </button>
                  </div>
                )}
              </div>

              {/* Add new gear item inline */}
              {showNewGearInline && (
                <div className="mb-3 p-3 rounded-xl bg-surface-900 border border-surface-700 space-y-2">
                  <p className="text-[11px] text-surface-400 font-medium">New gear item for this day</p>
                  <input value={newGearForm.name} onChange={e => setNewGearForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Item name *" autoFocus
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newGearForm.category} onChange={e => setNewGearForm(f => ({ ...f, category: e.target.value }))}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60">
                      {GEAR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={newGearForm.ownership} onChange={e => setNewGearForm(f => ({ ...f, ownership: e.target.value }))}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60">
                      {[['owned','Owned'],['rented','Rented'],['provided','Provided'],['tbc','TBC']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input type="number" min={1} value={newGearForm.quantity} onChange={e => setNewGearForm(f => ({ ...f, quantity: +e.target.value || 1 }))}
                        className="w-16 px-2.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60" />
                      <select value={newGearForm.unit} onChange={e => setNewGearForm(f => ({ ...f, unit: e.target.value }))}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60">
                        {['unit','set','kit','day','week','roll','box'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <input value={newGearForm.vendor} onChange={e => setNewGearForm(f => ({ ...f, vendor: e.target.value }))}
                      placeholder="Vendor (optional)"
                      className="px-2.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-white text-xs outline-none focus:border-[#FF5F1F]/60" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setShowNewGearInline(false); setNewGearForm({ name: '', category: 'Camera', quantity: 1, unit: 'unit', ownership: 'tbc', vendor: '' }); }} className="text-xs text-surface-500 hover:text-white px-3 py-1 rounded border border-surface-700 transition-colors">Cancel</button>
                    <button onClick={handleCreateGearForDay} disabled={savingGear} className="text-xs px-3 py-1 rounded bg-[#FF5F1F] text-white font-semibold hover:bg-orange-500 active:scale-95 transition-all disabled:opacity-50">
                      {savingGear ? 'Adding…' : 'Add to Day'}
                    </button>
                  </div>
                </div>
              )}

              {/* Assign existing gear picker */}
              {showAssignGear && (() => {
                const unassigned = allProjectGear.filter(g => !g.shoot_day_id && (gearSearch === '' || g.name.toLowerCase().includes(gearSearch.toLowerCase())));
                return (
                  <div className="mb-3 p-3 rounded-xl bg-surface-900 border border-surface-700">
                    <input value={gearSearch} onChange={e => setGearSearch(e.target.value)}
                      placeholder="Search gear from project…"
                      className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60 mb-2"
                      autoFocus />
                    {unassigned.length === 0 ? (
                      <p className="text-xs text-surface-600 italic py-2 text-center">
                        {allProjectGear.filter(g => !g.shoot_day_id).length === 0 ? 'No unassigned gear in project — add items from the Gear page first.' : 'No matches.'}
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {unassigned.map(g => (
                          <button key={g.id} onClick={() => handleAssignGear(g)}
                            className="w-full text-left text-xs px-3 py-1.5 rounded-lg text-surface-300 hover:bg-surface-700 hover:text-white transition-colors flex items-center gap-2">
                            <span className="flex-1 truncate">{g.name}</span>
                            <span className="text-surface-600 shrink-0">{g.category}</span>
                            <span className="text-surface-600 shrink-0">{g.quantity} {g.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => { setShowAssignGear(false); setGearSearch(''); }} className="mt-2 text-xs text-surface-500 hover:text-white">Cancel</button>
                  </div>
                );
              })()}

              {/* Assigned gear list */}
              {selectedDay.gear.length === 0 ? (
                <p className="text-xs text-surface-600 italic py-2">No gear assigned to this day.</p>
              ) : (
                <div className="rounded-xl border border-surface-800 overflow-hidden">
                  {selectedDay.gear.map((item, idx) => (
                    <div key={item.id} className={cn('flex items-center gap-3 px-4 py-2.5 group', idx < selectedDay.gear.length - 1 && 'border-b border-surface-800/50')}>
                      <span className="flex-1 text-sm font-medium text-white">{item.name}</span>
                      <span className="text-xs text-surface-500">{item.category}</span>
                      <span className="text-xs text-surface-400">{item.quantity} {item.unit}</span>
                      {item.vendor && <span className="text-xs text-surface-600">{item.vendor}</span>}
                      {canEdit && (
                        <button onClick={() => handleUnassignGear(item.id)} className="text-surface-700 hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-all" title="Remove from day">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Script Pages (Sides) ── */}
            {selectedDay.scenes.length > 0 && allScriptElements.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                    Script Pages (Sides)
                  </h3>
                  <span className="text-[11px] text-surface-600">Included in print export</span>
                </div>
                <div className="space-y-4">
                  {selectedDay.scenes.map(scene => {
                    const content = getSceneContent(scene.scene_element_id);
                    return (
                      <div key={scene.id} className="rounded-xl border border-surface-800 overflow-hidden">
                        <div className="bg-surface-900/60 px-4 py-2 border-b border-surface-800 flex items-center gap-2">
                          {scene.scene_number && <span className="text-[11px] font-mono text-surface-500 shrink-0">#{scene.scene_number}</span>}
                          <span className="text-xs font-bold text-[#FF5F1F] uppercase tracking-wide">{scene.scene_heading}</span>
                        </div>
                        <div className="px-5 py-3 font-mono text-[11px] leading-relaxed space-y-0.5 max-h-80 overflow-y-auto">
                          {content.length === 0 ? (
                            <p className="text-surface-600 italic">No content found for this scene.</p>
                          ) : content.map(el => renderScriptElement(el))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
