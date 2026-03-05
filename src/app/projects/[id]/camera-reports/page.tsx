'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Card, Button, Input, Textarea, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

// ============================================================
// Camera & Sound Reports
// Daily roll-based reports for camera and sound departments.
// ============================================================

type ReportType = 'camera' | 'sound';

interface CameraTake {
  scene: string;
  setup: string;
  take: string;
  lens: string;
  stop: string;
  filter: string;
  focus_dist: string;
  int_ext: string;
  type: string;
  circle: boolean;
  notes: string;
}

interface SoundTake {
  roll: string;
  scene: string;
  take: string;
  track1: string;
  track2: string;
  wild_track: boolean;
  notes: string;
}

interface Report {
  id: string;
  report_type: ReportType;
  roll_number: string | null;
  report_date: string | null;       // DB column
  camera_id: string | null;
  stock: string | null;
  magazine: string | null;
  operator: string | null;
  loader: string | null;
  takes: CameraTake[];
  sound_takes: SoundTake[];
  general_notes: string | null;     // DB column
  created_at: string;
}

const BLANK_CAM_TAKE: CameraTake = { scene: '', setup: '', take: '', lens: '', stop: '', filter: '', focus_dist: '', int_ext: 'INT', type: 'SYNC', circle: false, notes: '' };
const BLANK_SND_TAKE: SoundTake = { roll: '', scene: '', take: '', track1: '', track2: '', wild_track: false, notes: '' };

export default function CameraReportsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportType>('camera');
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [selected, setSelected] = useState<Report | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [rollNumber, setRollNumber] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [stock, setStock] = useState('');
  const [magazine, setMagazine] = useState('');
  const [operator, setOperator] = useState('');
  const [loader, setLoader] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [camTakes, setCamTakes] = useState<CameraTake[]>([{ ...BLANK_CAM_TAKE }]);
  const [sndTakes, setSndTakes] = useState<SoundTake[]>([{ ...BLANK_SND_TAKE }]);

  useEffect(() => { load(); }, [params.id]);

  const load = async () => {
    const { data, error } = await createClient().from('camera_reports').select('*').eq('project_id', params.id).order('report_date', { ascending: false });
    if (error) toast.error('Failed to load: ' + error.message);
    setReports((data ?? []) as Report[]);
    setLoading(false);
  };

  const openNew = (type: ReportType) => {
    setSelected(null); setActiveTab(type);
    setRollNumber(''); setReportDate(''); setCameraId(''); setStock(''); setMagazine(''); setOperator(''); setLoader(''); setGeneralNotes('');
    setCamTakes([{ ...BLANK_CAM_TAKE }]); setSndTakes([{ ...BLANK_SND_TAKE }]);
    setView('edit');
  };

  const openEdit = (r: Report) => {
    setSelected(r); setActiveTab(r.report_type);
    setRollNumber(r.roll_number ?? ''); setReportDate(r.report_date ?? '');
    setCameraId(r.camera_id ?? ''); setStock(r.stock ?? ''); setMagazine(r.magazine ?? '');
    setOperator(r.operator ?? ''); setLoader(r.loader ?? ''); setGeneralNotes(r.general_notes ?? '');
    setCamTakes(r.takes?.length ? r.takes : [{ ...BLANK_CAM_TAKE }]);
    setSndTakes(r.sound_takes?.length ? r.sound_takes : [{ ...BLANK_SND_TAKE }]);
    setView('edit');
  };

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      project_id: params.id, report_type: activeTab,
      roll_number: rollNumber || null,
      report_date: reportDate || null,
      camera_id: cameraId || null, stock: stock || null, magazine: magazine || null,
      operator: operator || null, loader: loader || null,
      general_notes: generalNotes || null,
      takes: activeTab === 'camera' ? camTakes : [],
      sound_takes: activeTab === 'sound' ? sndTakes : [],
      updated_at: new Date().toISOString(),
    };
    if (selected) {
      const { data, error } = await supabase.from('camera_reports').update(payload).eq('id', selected.id).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      if (data) { setReports((prev) => prev.map((r) => r.id === selected.id ? data as Report : r)); toast.success('Report updated.'); }
    } else {
      const { data, error } = await supabase.from('camera_reports').insert({ ...payload, created_by: user?.id }).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      if (data) { setReports((prev) => [data as Report, ...prev]); toast.success('Report saved.'); }
    }
    setSaving(false); setView('list');
  };

  const deleteReport = async (id: string) => {
    const ok = await confirm({ message: 'Delete this report?', variant: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    await createClient().from('camera_reports').delete().eq('id', id);
    setReports((prev) => prev.filter((r) => r.id !== id)); toast.success('Deleted.');
  };

  const updateCamTake = (i: number, field: keyof CameraTake, val: string | boolean) => {
    setCamTakes((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));
  };
  const updateSndTake = (i: number, field: keyof SoundTake, val: string | boolean) => {
    setSndTakes((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));
  };

  if (loading) return <LoadingSpinner className="py-32" />;

  // ─── Edit form ───────────────────────────────────────────────
  if (view === 'edit') return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-black text-white">{selected ? 'Edit' : `New ${activeTab === 'camera' ? 'Camera' : 'Sound'} Report`}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setView('list')}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>

      {/* Header info */}
      <Card className="p-5 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Roll / Card #</label>
          <Input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="A001" />
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Shoot Date</label>
          <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        {activeTab === 'camera' ? (
          <>
            <div><label className="text-xs text-surface-400 mb-1 block">Camera ID</label><Input value={cameraId} onChange={(e) => setCameraId(e.target.value)} placeholder="A-Cam" /></div>
            <div><label className="text-xs text-surface-400 mb-1 block">Stock / Format</label><Input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="ARRIRAW" /></div>
            <div><label className="text-xs text-surface-400 mb-1 block">Magazine</label><Input value={magazine} onChange={(e) => setMagazine(e.target.value)} /></div>
            <div><label className="text-xs text-surface-400 mb-1 block">Operator</label><Input value={operator} onChange={(e) => setOperator(e.target.value)} /></div>
            <div><label className="text-xs text-surface-400 mb-1 block">Loader</label><Input value={loader} onChange={(e) => setLoader(e.target.value)} /></div>
          </>
        ) : (
          <>
            <div><label className="text-xs text-surface-400 mb-1 block">Boom Operator</label><Input value={operator} onChange={(e) => setOperator(e.target.value)} /></div>
            <div><label className="text-xs text-surface-400 mb-1 block">Mixer</label><Input value={loader} onChange={(e) => setLoader(e.target.value)} /></div>
          </>
        )}
      </Card>

      {/* Takes table */}
      {activeTab === 'camera' ? (
        <Card className="overflow-x-auto mb-4">
          <div className="px-4 py-3 flex items-center justify-between border-b border-surface-800">
            <div>
              <h2 className="text-sm font-bold text-white">Camera Takes</h2>
              <p className="text-[11px] text-surface-500 mt-0.5">{camTakes.filter(t => t.circle).length} of {camTakes.length} circled</p>
            </div>
            <button onClick={() => setCamTakes((p) => [...p, { ...BLANK_CAM_TAKE }])}
              className="px-3 py-1.5 text-xs bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-orange-400 font-medium transition-colors">+ Add Take</button>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-surface-800/40 text-surface-500 text-[10px] uppercase tracking-widest">
              <tr>
                {['Scene', 'Setup', 'Take', 'Lens', 'f/', 'Filter', 'Focus', 'I/E', 'Type', '✓ Circle', 'Notes', ''].map((h) => (
                  <th key={h} className="px-2 py-2.5 text-left whitespace-nowrap font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {camTakes.map((t, i) => (
                <tr key={i} className={cn('border-t border-surface-800/60 transition-colors', t.circle ? 'bg-orange-500/5' : 'hover:bg-surface-800/20')}>
                  {(['scene', 'setup', 'take', 'lens', 'stop', 'filter', 'focus_dist'] as const).map((f) => (
                    <td key={f} className="px-1.5 py-2">
                      <input value={t[f]} onChange={(e) => updateCamTake(i, f, e.target.value)}
                        className="w-16 bg-surface-800/60 border border-surface-700/40 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500/50 focus:bg-surface-800" />
                    </td>
                  ))}
                  <td className="px-1.5 py-2">
                    <select value={t.int_ext} onChange={(e) => updateCamTake(i, 'int_ext', e.target.value)}
                      className="bg-surface-800 border border-surface-700/40 rounded-md px-1.5 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500/50">
                      {['INT', 'EXT', 'INT/EXT'].map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-1.5 py-2">
                    <select value={t.type} onChange={(e) => updateCamTake(i, 'type', e.target.value)}
                      className="bg-surface-800 border border-surface-700/40 rounded-md px-1.5 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500/50">
                      {['SYNC', 'MOS', 'VO', 'VFX', 'PICKUP'].map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => updateCamTake(i, 'circle', !t.circle)}
                      className={cn('w-7 h-7 rounded-full border-2 flex items-center justify-center mx-auto transition-all',
                        t.circle ? 'border-orange-500 bg-orange-500/20 text-orange-400' : 'border-surface-600 hover:border-orange-500/50 text-transparent')}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    </button>
                  </td>
                  <td className="px-1.5 py-2">
                    <input value={t.notes} onChange={(e) => updateCamTake(i, 'notes', e.target.value)}
                      className="w-32 bg-surface-800/60 border border-surface-700/40 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500/50 focus:bg-surface-800" />
                  </td>
                  <td className="px-1.5 py-2">
                    <button onClick={() => setCamTakes((p) => p.filter((_, idx) => idx !== i))}
                      className="w-6 h-6 flex items-center justify-center text-surface-600 hover:text-red-400 text-base rounded transition-colors">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {camTakes.length === 0 && (
            <div className="py-8 text-center text-surface-500 text-xs">No takes yet — click + Add Take</div>
          )}
        </Card>
      ) : (
        <Card className="overflow-x-auto mb-4">
          <div className="px-4 py-3 flex items-center justify-between border-b border-surface-800">
            <div>
              <h2 className="text-sm font-bold text-white">Sound Takes</h2>
              <p className="text-[11px] text-surface-500 mt-0.5">{sndTakes.filter(t => t.wild_track).length} wild track{sndTakes.filter(t => t.wild_track).length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setSndTakes((p) => [...p, { ...BLANK_SND_TAKE }])}
              className="px-3 py-1.5 text-xs bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-orange-400 font-medium transition-colors">+ Add Take</button>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-surface-800/40 text-surface-500 text-[10px] uppercase tracking-widest">
              <tr>
                {['Roll', 'Scene', 'Take', 'Track 1', 'Track 2', 'Wild Track', 'Notes', ''].map((h) => (
                  <th key={h} className="px-2 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sndTakes.map((t, i) => (
                <tr key={i} className={cn('border-t border-surface-800/60 transition-colors', t.wild_track ? 'bg-purple-500/5' : 'hover:bg-surface-800/20')}>
                  {(['roll', 'scene', 'take', 'track1', 'track2'] as const).map((f) => (
                    <td key={f} className="px-1.5 py-2">
                      <input value={t[f]} onChange={(e) => updateSndTake(i, f, e.target.value)}
                        className="w-20 bg-surface-800/60 border border-surface-700/40 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500/50 focus:bg-surface-800" />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => updateSndTake(i, 'wild_track', !t.wild_track)}
                      className={cn('w-7 h-7 rounded-full border-2 flex items-center justify-center mx-auto transition-all',
                        t.wild_track ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'border-surface-600 hover:border-purple-500/50 text-transparent')}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    </button>
                  </td>
                  <td className="px-1.5 py-2">
                    <input value={t.notes} onChange={(e) => updateSndTake(i, 'notes', e.target.value)}
                      className="w-32 bg-surface-800/60 border border-surface-700/40 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500/50 focus:bg-surface-800" />
                  </td>
                  <td className="px-1.5 py-2">
                    <button onClick={() => setSndTakes((p) => p.filter((_, idx) => idx !== i))}
                      className="w-6 h-6 flex items-center justify-center text-surface-600 hover:text-red-400 text-base rounded transition-colors">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sndTakes.length === 0 && (
            <div className="py-8 text-center text-surface-500 text-xs">No takes yet — click + Add Take</div>
          )}
        </Card>
      )}

      <Card className="p-4">
        <label className="text-xs text-surface-400 mb-1 block">General Notes</label>
        <Textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} rows={3} placeholder="Magazines, comments, technical issues…" />
      </Card>
    </div>
  );

  // ─── List view ───────────────────────────────────────────────
  const cameraReports = reports.filter((r) => r.report_type === 'camera');
  const soundReports = reports.filter((r) => r.report_type === 'sound');

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Camera &amp; Sound Reports</h1>
          <p className="text-sm text-surface-400 mt-0.5">Daily roll reports for camera and sound departments.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => openNew('sound')}>+ Sound</Button>
            <Button onClick={() => openNew('camera')}>+ Camera</Button>
          </div>
        )}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl mb-5 w-fit">
        {(['camera', 'sound'] as ReportType[]).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              activeTab === t ? 'bg-surface-700 text-white' : 'text-surface-500 hover:text-surface-300')}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className={cn('ml-1.5 text-[11px]', activeTab === t ? 'text-orange-400' : 'text-surface-600')}>
              {t === 'camera' ? cameraReports.length : soundReports.length}
            </span>
          </button>
        ))}
      </div>

      {(activeTab === 'camera' ? cameraReports : soundReports).length === 0 ? (
        <Card className="p-10 text-center text-surface-500">
          <p className="font-medium text-white mb-1">No {activeTab} reports yet</p>
          <p className="text-sm">Log each roll with all take metadata and circle takes.</p>
          {canEdit && <Button className="mt-4" onClick={() => openNew(activeTab)}>New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report</Button>}
        </Card>
      ) : (
        <div className="space-y-3">
          {(activeTab === 'camera' ? cameraReports : soundReports).map((r) => {
            const takes = activeTab === 'camera' ? r.takes ?? [] : r.sound_takes ?? [];
            const circled = activeTab === 'camera' ? (r.takes ?? []).filter((t) => t.circle).length : 0;
            return (
              <Card key={r.id} className="group p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{r.roll_number ? `Roll ${r.roll_number}` : 'No Roll #'}</span>
                      {r.report_date && <span className="text-xs text-surface-500">{r.report_date}</span>}
                      {r.camera_id && <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded">{r.camera_id}</span>}
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {takes.length} takes{circled > 0 ? ` · ${circled} circled` : ''}
                      {r.operator ? ` · Operator: ${r.operator}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {canEdit && (
                      <>
                        <button onClick={() => openEdit(r)} className="px-3 py-1.5 text-xs bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-white">Edit</button>
                        <button onClick={() => deleteReport(r.id)} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg">Delete</button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
