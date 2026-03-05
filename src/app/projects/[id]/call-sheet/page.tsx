'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Card, Button, Input, Textarea, LoadingSpinner, toast } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

// ============================================================
// Call Sheet Generator
// Creates per-shoot-day call sheets with crew call times,
// advanced schedule, and a print-optimised layout.
// ============================================================

interface CrewCall { name: string; dept: string; call_time: string; notes: string }
interface AdvancedScene { scene: string; location: string; cast: string; pages: string; est_time: string }
interface CallSheet {
  id: string;
  project_id: string;
  shoot_date: string;
  title: string | null;
  general_call: string | null;
  base_camp: string | null;
  nearest_hospital: string | null;
  parking: string | null;
  weather_note: string | null;
  scenes_today: string[];
  crew_calls: CrewCall[];
  advanced_schedule: AdvancedScene[];
  general_notes: string | null;
  is_published: boolean;
}

const BLANK_SHEET: Omit<CallSheet, 'id' | 'project_id'> = {
  shoot_date: new Date().toISOString().split('T')[0],
  title: null,
  general_call: '07:00',
  base_camp: null,
  nearest_hospital: null,
  parking: null,
  weather_note: null,
  scenes_today: [],
  crew_calls: [{ name: '', dept: '', call_time: '', notes: '' }],
  advanced_schedule: [{ scene: '', location: '', cast: '', pages: '', est_time: '' }],
  general_notes: null,
  is_published: false,
};

export default function CallSheetPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const [sheets, setSheets] = useState<CallSheet[]>([]);
  const [selected, setSelected] = useState<CallSheet | null>(null);
  const [form, setForm] = useState<Omit<CallSheet, 'id' | 'project_id'>>(BLANK_SHEET);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'list' | 'edit' | 'print'>('list');

  useEffect(() => { load(); }, [params.id]);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('call_sheets').select('*').eq('project_id', params.id).order('shoot_date');
    setSheets((data ?? []) as CallSheet[]);
    setLoading(false);
  };

  const openNew = () => {
    setSelected(null);
    setForm({ ...BLANK_SHEET, shoot_date: new Date().toISOString().split('T')[0] });
    setView('edit');
  };

  const duplicateFromPrevious = () => {
    const prev = sheets[sheets.length - 1];
    if (!prev) { openNew(); return; }
    setSelected(null);
    setForm({
      ...BLANK_SHEET,
      shoot_date: '',
      title: prev.title ? `${prev.title} (copy)` : '',
      base_camp: prev.base_camp,
      nearest_hospital: prev.nearest_hospital,
      parking: prev.parking,
      general_call: prev.general_call,
      crew_calls: prev.crew_calls?.length ? prev.crew_calls.map((c) => ({ ...c, call_time: '' })) : [{ name: '', dept: '', call_time: '', notes: '' }],
      advanced_schedule: prev.advanced_schedule?.length ? prev.advanced_schedule : [{ scene: '', location: '', cast: '', pages: '', est_time: '' }],
    });
    setView('edit');
  };

  const openEdit = (sheet: CallSheet) => {
    setSelected(sheet);
    setForm({
      shoot_date: sheet.shoot_date,
      title: sheet.title,
      general_call: sheet.general_call,
      base_camp: sheet.base_camp,
      nearest_hospital: sheet.nearest_hospital,
      parking: sheet.parking,
      weather_note: sheet.weather_note,
      scenes_today: sheet.scenes_today ?? [],
      crew_calls: sheet.crew_calls?.length ? sheet.crew_calls : [{ name: '', dept: '', call_time: '', notes: '' }],
      advanced_schedule: sheet.advanced_schedule?.length ? sheet.advanced_schedule : [{ scene: '', location: '', cast: '', pages: '', est_time: '' }],
      general_notes: sheet.general_notes,
      is_published: sheet.is_published,
    });
    setView('edit');
  };

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      ...form,
      project_id: params.id,
      created_by: user?.id,
      updated_at: new Date().toISOString(),
    };
    if (selected) {
      const { data, error } = await supabase.from('call_sheets').update(payload).eq('id', selected.id).select().single();
      if (!error && data) {
        setSheets((prev) => prev.map((s) => s.id === selected.id ? data as CallSheet : s));
        setSelected(data as CallSheet);
        toast.success('Call sheet updated.');
      }
    } else {
      const { data, error } = await supabase.from('call_sheets').insert(payload).select().single();
      if (!error && data) {
        setSheets((prev) => [...prev, data as CallSheet]);
        setSelected(data as CallSheet);
        toast.success('Call sheet created.');
      }
    }
    setSaving(false);
    setView('list');
  };

  const { confirm, ConfirmDialog } = useConfirmDialog();

  const deleteSheet = async (id: string) => {
    const ok = await confirm({ message: 'Delete this call sheet?', variant: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    const supabase = createClient();
    await supabase.from('call_sheets').delete().eq('id', id);
    setSheets((prev) => prev.filter((s) => s.id !== id));
    if (selected?.id === id) setView('list');
    toast.success('Deleted.');
  };

  const updateCrewCall = (i: number, field: keyof CrewCall, val: string) => {
    const updated = [...form.crew_calls];
    updated[i] = { ...updated[i], [field]: val };
    setForm({ ...form, crew_calls: updated });
  };

  const updateScheduleRow = (i: number, field: keyof AdvancedScene, val: string) => {
    const updated = [...form.advanced_schedule];
    updated[i] = { ...updated[i], [field]: val };
    setForm({ ...form, advanced_schedule: updated });
  };

  if (loading) return <LoadingSpinner className="py-32" />;

  if (view === 'print' && selected) {
    return (
      <div className="p-8 max-w-4xl mx-auto print:p-0 bg-white text-black">
        <div className="border-b-2 border-black pb-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black">{currentProject?.title ?? 'Production'}</h1>
            <h2 className="text-lg font-bold">{selected.title ?? `Call Sheet — ${selected.shoot_date}`}</h2>
            <p className="text-sm text-gray-600">{selected.shoot_date}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">GENERAL CALL</p>
            <p className="text-2xl font-black">{selected.general_call ?? '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
          {[
            { label: 'Base Camp / Unit Base', value: selected.base_camp },
            { label: 'Nearest Hospital', value: selected.nearest_hospital },
            { label: 'Parking', value: selected.parking },
          ].map(({ label, value }) => value ? (
            <div key={label}>
              <p className="font-bold text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
              <p>{value}</p>
            </div>
          ) : null)}
        </div>

        {selected.weather_note && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-sm">
            <span className="font-bold">Weather: </span>{selected.weather_note}
          </div>
        )}

        {/* Advanced Schedule */}
        {(selected.advanced_schedule ?? []).filter((r) => r.scene).length > 0 && (
          <div className="mb-6">
            <h3 className="font-black text-sm uppercase tracking-wider border-b border-black pb-1 mb-2">Advanced Schedule</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  {['Scene', 'Location', 'Cast', 'Pages', 'Est. Time'].map((h) => (
                    <th key={h} className="text-left px-2 py-1 border border-gray-300 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(selected.advanced_schedule ?? []).filter((r) => r.scene).map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    {[r.scene, r.location, r.cast, r.pages, r.est_time].map((v, j) => (
                      <td key={j} className="px-2 py-1 border border-gray-300">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Crew Calls */}
        {(selected.crew_calls ?? []).filter((c) => c.name).length > 0 && (
          <div className="mb-6">
            <h3 className="font-black text-sm uppercase tracking-wider border-b border-black pb-1 mb-2">Crew Calls</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  {['Name', 'Department', 'Call Time', 'Notes'].map((h) => (
                    <th key={h} className="text-left px-2 py-1 border border-gray-300 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(selected.crew_calls ?? []).filter((c) => c.name).map((c, i) => (
                  <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    {[c.name, c.dept, c.call_time, c.notes].map((v, j) => (
                      <td key={j} className="px-2 py-1 border border-gray-300">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected.general_notes && (
          <div className="mt-4 p-3 border border-gray-300 rounded text-sm">
            <p className="font-bold text-[10px] uppercase tracking-wider text-gray-500 mb-1">General Notes</p>
            <p className="whitespace-pre-wrap">{selected.general_notes}</p>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400 print:hidden">
          <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded mr-2">Print</button>
          <button onClick={() => setView('list')} className="px-4 py-2 bg-gray-200 rounded">Back</button>
        </div>
      </div>
    );
  }

  if (view === 'edit') {
    return (
      <div className="p-4 md:p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black text-white">{selected ? 'Edit Call Sheet' : 'New Call Sheet'}</h1>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setView('list')}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Shoot Date</label>
              <input type="date" value={form.shoot_date} onChange={(e) => setForm({ ...form, shoot_date: e.target.value })}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Sheet Title (optional)</label>
              <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Shoot Day 3 — Warehouse" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">General Call Time</label>
              <input type="time" value={form.general_call ?? ''} onChange={(e) => setForm({ ...form, general_call: e.target.value })}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Weather Note</label>
              <Input value={form.weather_note ?? ''} onChange={(e) => setForm({ ...form, weather_note: e.target.value })} placeholder="Sunny, 18°C · no rain expected" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Base Camp / Unit Base</label>
              <Input value={form.base_camp ?? ''} onChange={(e) => setForm({ ...form, base_camp: e.target.value })} placeholder="Address or description" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Nearest Hospital</label>
              <Input value={form.nearest_hospital ?? ''} onChange={(e) => setForm({ ...form, nearest_hospital: e.target.value })} placeholder="Name + address" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-surface-400 mb-1 block">Parking Instructions</label>
              <Input value={form.parking ?? ''} onChange={(e) => setForm({ ...form, parking: e.target.value })} placeholder="Where to park" />
            </div>
          </Card>

          {/* Advanced Schedule */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Advanced Schedule</h2>
              <button onClick={() => setForm({ ...form, advanced_schedule: [...form.advanced_schedule, { scene: '', location: '', cast: '', pages: '', est_time: '' }] })}
                className="text-xs text-[#FF5F1F] hover:text-[#FF8F5F]">+ Add Row</button>
            </div>
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[1fr_1.5fr_1.5fr_0.5fr_0.5fr_1.5rem] gap-2 text-[10px] text-surface-500 font-bold uppercase tracking-wider px-1">
                <span>Scene</span><span>Location</span><span>Cast</span><span>Pages</span><span>Est.</span><span />
              </div>
              {form.advanced_schedule.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.5fr_1.5fr_0.5fr_0.5fr_1.5rem] gap-2 items-center">
                  {(['scene','location','cast','pages','est_time'] as const).map((field) => (
                    <input key={field} value={row[field]} onChange={(e) => updateScheduleRow(i, field, e.target.value)}
                      className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-xs text-white w-full"
                      placeholder={field === 'est_time' ? '1h30m' : ''} />
                  ))}
                  <button onClick={() => setForm({ ...form, advanced_schedule: form.advanced_schedule.filter((_, j) => j !== i) })}
                    className="text-surface-600 hover:text-red-400 text-lg leading-none">×</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Crew Calls */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Crew Call Times</h2>
              <button onClick={() => setForm({ ...form, crew_calls: [...form.crew_calls, { name: '', dept: '', call_time: '', notes: '' }] })}
                className="text-xs text-[#FF5F1F] hover:text-[#FF8F5F]">+ Add Row</button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[1.5fr_1fr_0.6fr_1.5fr_1.5rem] gap-2 text-[10px] text-surface-500 font-bold uppercase tracking-wider px-1">
                <span>Name</span><span>Department</span><span>Call</span><span>Notes</span><span />
              </div>
              {form.crew_calls.map((row, i) => (
                <div key={i} className="grid grid-cols-[1.5fr_1fr_0.6fr_1.5fr_1.5rem] gap-2 items-center">
                  {(['name','dept','call_time','notes'] as const).map((field) => (
                    <input key={field} value={row[field]} onChange={(e) => updateCrewCall(i, field, e.target.value)}
                      className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-xs text-white w-full" />
                  ))}
                  <button onClick={() => setForm({ ...form, crew_calls: form.crew_calls.filter((_, j) => j !== i) })}
                    className="text-surface-600 hover:text-red-400 text-lg leading-none">×</button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <label className="text-xs text-surface-400 mb-2 block">General Notes</label>
            <Textarea value={form.general_notes ?? ''} onChange={(e) => setForm({ ...form, general_notes: e.target.value })}
              rows={4} placeholder="Safety briefing, special instructions, parking confirmations…" />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Call Sheets</h1>
          <p className="text-sm text-surface-400 mt-0.5">Daily shoot-day documents for the whole crew.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {sheets.length > 0 && <Button variant="ghost" onClick={duplicateFromPrevious}>Duplicate Previous</Button>}
            <Button onClick={openNew}>+ New Call Sheet</Button>
          </div>
        )}
      </div>

      {sheets.length === 0 ? (
        <Card className="p-10 text-center text-surface-500">
          <p className="font-medium text-white mb-1">No call sheets yet</p>
          <p className="text-sm">Create your first one to start building daily shoot packages.</p>
          {canEdit && <Button className="mt-4" onClick={openNew}>Create Call Sheet</Button>}
        </Card>
      ) : (
        <div className="space-y-3">
          {sheets.map((sheet) => (
            <Card key={sheet.id} className="group p-4 flex items-center justify-between gap-4 hover:border-surface-600 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{sheet.title ?? `Call Sheet — ${sheet.shoot_date}`}</p>
                <p className="text-xs text-surface-400">{sheet.shoot_date} · General call {sheet.general_call ?? '—'}</p>
                {(sheet.crew_calls ?? []).filter((c) => c.name).length > 0 && (
                  <p className="text-[11px] text-surface-500">{(sheet.crew_calls ?? []).filter((c) => c.name).length} crew members</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button onClick={() => { setSelected(sheet); setView('print'); }}
                  className="px-3 py-1.5 text-xs bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-white">Print</button>
                {canEdit && (
                  <>
                    <button onClick={() => openEdit(sheet)}
                      className="px-3 py-1.5 text-xs bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-white">Edit</button>
                    <button onClick={() => deleteSheet(sheet.id)}
                      className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-400/40 rounded-lg">Delete</button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}