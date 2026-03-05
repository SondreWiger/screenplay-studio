'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Card, Button, Input, Textarea, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

// ============================================================
// Script Coverage
// Industry-standard reader report: graded categories,
// synopsis, logline, and pass / consider / recommend verdict.
// ============================================================

type Grade = 'excellent' | 'good' | 'fair' | 'poor' | '';
type Recommendation = 'pass' | 'consider' | 'recommend' | '';

interface Coverage {
  id: string;
  reader_name: string | null;
  script_title: string | null;
  draft_date: string | null;
  logline: string | null;
  short_synopsis: string | null;
  full_synopsis: string | null;
  grade_premise: Grade;
  grade_structure: Grade;
  grade_dialogue: Grade;
  grade_characters: Grade;
  grade_theme: Grade;
  grade_pacing: Grade;
  grade_originality: Grade;
  recommendation: Recommendation;
  comments: string | null;
  created_at: string;
}

const GRADE_OPTIONS: Grade[] = ['excellent', 'good', 'fair', 'poor'];
const GRADE_COLOR: Record<Grade, string> = {
  excellent: 'bg-green-500/20 text-green-300 border-green-500/30',
  good:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
  fair:      'bg-amber-500/20 text-amber-300 border-amber-500/30',
  poor:      'bg-red-500/20 text-red-300 border-red-500/30',
  '':        'bg-surface-700/40 text-surface-500 border-surface-700',
};
const REC_META: Record<Recommendation, { color: string; label: string }> = {
  pass:      { color: 'bg-red-500/20 text-red-300 border-red-500/30', label: 'PASS' },
  consider:  { color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', label: 'CONSIDER' },
  recommend: { color: 'bg-green-500/20 text-green-300 border-green-500/30', label: 'RECOMMEND' },
  '':        { color: 'bg-surface-700/40 text-surface-500 border-surface-700', label: '—' },
};

const GRADE_FIELDS: { key: keyof Omit<Coverage, 'id' | 'created_at'>; label: string }[] = [
  { key: 'grade_premise',     label: 'Premise' },
  { key: 'grade_structure',   label: 'Structure' },
  { key: 'grade_dialogue',    label: 'Dialogue' },
  { key: 'grade_characters',  label: 'Characters' },
  { key: 'grade_theme',       label: 'Theme' },
  { key: 'grade_pacing',      label: 'Pacing' },
  { key: 'grade_originality', label: 'Originality' },
];

const BLANK: Omit<Coverage, 'id' | 'created_at'> = {
  reader_name: null, script_title: null, draft_date: null,
  logline: null, short_synopsis: null, full_synopsis: null,
  grade_premise: '', grade_structure: '', grade_dialogue: '', grade_characters: '',
  grade_theme: '', grade_pacing: '', grade_originality: '',
  recommendation: '', comments: null,
};

export default function CoveragePage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const [coverages, setCoverages] = useState<Coverage[]>([]);
  const [selected, setSelected] = useState<Coverage | null>(null);
  const [form, setForm] = useState<Omit<Coverage, 'id' | 'created_at'>>(BLANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'list' | 'edit' | 'print'>('list');

  useEffect(() => { load(); }, [params.id]);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('script_coverage').select('*').eq('project_id', params.id).order('created_at', { ascending: false });
    setCoverages((data ?? []) as Coverage[]);
    setLoading(false);
  };

  const openNew = () => {
    setSelected(null);
    setForm({ ...BLANK, script_title: currentProject?.title ?? null });
    setView('edit');
  };

  const openEdit = (c: Coverage) => {
    setSelected(c);
    setForm({ reader_name: c.reader_name, script_title: c.script_title, draft_date: c.draft_date,
      logline: c.logline, short_synopsis: c.short_synopsis, full_synopsis: c.full_synopsis,
      grade_premise: c.grade_premise, grade_structure: c.grade_structure, grade_dialogue: c.grade_dialogue,
      grade_characters: c.grade_characters, grade_theme: c.grade_theme, grade_pacing: c.grade_pacing,
      grade_originality: c.grade_originality, recommendation: c.recommendation, comments: c.comments });
    setView('edit');
  };

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    // Coerce empty-string grades/recommendation to null — DB CHECK constraint only allows specific values or NULL
    const payload = {
      ...form,
      recommendation: form.recommendation || null,
      grade_premise:     form.grade_premise     || null,
      grade_structure:   form.grade_structure   || null,
      grade_dialogue:    form.grade_dialogue     || null,
      grade_characters:  form.grade_characters  || null,
      grade_theme:       form.grade_theme       || null,
      grade_pacing:      form.grade_pacing      || null,
      grade_originality: form.grade_originality || null,
      project_id: params.id,
      created_by: user?.id,
      updated_at: new Date().toISOString(),
    };
    if (selected) {
      const { data, error } = await supabase.from('script_coverage').update(payload).eq('id', selected.id).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      if (data) { setCoverages((prev) => prev.map((c) => c.id === selected.id ? data as Coverage : c)); toast.success('Coverage updated.'); }
    } else {
      const { data, error } = await supabase.from('script_coverage').insert(payload).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      if (data) { setCoverages((prev) => [data as Coverage, ...prev]); toast.success('Coverage saved.'); }
    }
    setSaving(false);
    setView('list');
  };

  const { confirm, ConfirmDialog } = useConfirmDialog();

  const deleteCoverage = async (id: string) => {
    const ok = await confirm({ message: 'Delete this coverage report?', variant: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    await createClient().from('script_coverage').delete().eq('id', id);
    setCoverages((prev) => prev.filter((c) => c.id !== id));
    if (view !== 'list') setView('list');
    toast.success('Deleted.');
  };

  const f = form;

  if (loading) return <LoadingSpinner className="py-32" />;

  if (view === 'edit') return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-white">{selected ? 'Edit Coverage' : 'New Coverage Report'}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setView('list')}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>

      <div className="space-y-5">
        <Card className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Script Title</label>
            <Input value={f.script_title ?? ''} onChange={(e) => setForm({ ...f, script_title: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Reader</label>
            <Input value={f.reader_name ?? ''} onChange={(e) => setForm({ ...f, reader_name: e.target.value })} placeholder="Name or initials" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Draft Date</label>
            <input type="date" value={f.draft_date ?? ''} onChange={(e) => setForm({ ...f, draft_date: e.target.value })}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
        </Card>

        <Card className="p-5">
          <label className="text-xs text-surface-400 mb-2 block font-bold">Logline <span className="font-normal">(1–2 sentences)</span></label>
          <Textarea value={f.logline ?? ''} onChange={(e) => setForm({ ...f, logline: e.target.value })} rows={2} placeholder="When [protagonist] must [conflict], they discover [theme]…" />
        </Card>

        <Card className="p-5">
          <label className="text-xs text-surface-400 mb-2 block font-bold">Short Synopsis <span className="font-normal">(1 paragraph)</span></label>
          <Textarea value={f.short_synopsis ?? ''} onChange={(e) => setForm({ ...f, short_synopsis: e.target.value })} rows={4} />
        </Card>

        <Card className="p-5">
          <label className="text-xs text-surface-400 mb-2 block font-bold">Full Synopsis</label>
          <Textarea value={f.full_synopsis ?? ''} onChange={(e) => setForm({ ...f, full_synopsis: e.target.value })} rows={10} />
        </Card>

        {/* Grades */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-white mb-4">Category Grades</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GRADE_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <p className="text-[11px] text-surface-500 mb-1.5">{label}</p>
                <div className="flex flex-col gap-1">
                  {GRADE_OPTIONS.map((g) => (
                    <button key={g}
                      onClick={() => setForm({ ...f, [key]: f[key] === g ? '' : g })}
                      className={cn(
                        'px-2 py-1 rounded text-[11px] font-medium border transition-all text-left',
                        f[key] === g ? GRADE_COLOR[g] : 'bg-surface-800/40 text-surface-500 border-surface-700/40 hover:border-surface-600',
                      )}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recommendation */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-white mb-4">Overall Recommendation</h2>
          <div className="flex gap-3 mb-5">
            {(['pass', 'consider', 'recommend'] as Recommendation[]).map((r) => (
              <button key={r}
                onClick={() => setForm({ ...f, recommendation: f.recommendation === r ? '' : r })}
                className={cn(
                  'flex-1 py-3 rounded-xl border-2 font-black text-sm uppercase tracking-wider transition-all',
                  f.recommendation === r ? REC_META[r].color : 'border-surface-700 text-surface-500 hover:border-surface-600',
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <label className="text-xs text-surface-400 mb-2 block">Additional Comments</label>
          <Textarea value={f.comments ?? ''} onChange={(e) => setForm({ ...f, comments: e.target.value })} rows={4} placeholder="Overall impression, specific notes for the writer…" />
        </Card>
      </div>
    </div>
  );

  if (view === 'print' && selected) {
    const rec = REC_META[selected.recommendation ?? ''];
    return (
      <div className="p-6 max-w-3xl print:p-0">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <h1 className="text-xl font-black text-white">Coverage Report</h1>
          <div className="flex gap-2">
            <Button onClick={() => window.print()}>Print / Save PDF</Button>
            <Button variant="ghost" onClick={() => setView('list')}>Back</Button>
          </div>
        </div>
        <div className="bg-white text-gray-900 rounded-xl p-8 space-y-6 print:rounded-none print:shadow-none">
          <div className="border-b pb-4">
            <h2 className="text-2xl font-black">{selected.script_title ?? 'Untitled'}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {selected.reader_name && <>Reader: <strong>{selected.reader_name}</strong> &nbsp;·&nbsp;</>}
              {selected.draft_date && <>Draft: {selected.draft_date}</>}
            </p>
            {selected.recommendation && (
              <span className="mt-3 inline-block px-4 py-1.5 rounded font-black text-sm uppercase tracking-widest border-2" style={{ borderColor: selected.recommendation === 'recommend' ? '#16a34a' : selected.recommendation === 'consider' ? '#d97706' : '#dc2626', color: selected.recommendation === 'recommend' ? '#15803d' : selected.recommendation === 'consider' ? '#b45309' : '#b91c1c' }}>
                {rec.label}
              </span>
            )}
          </div>
          {selected.logline && (
            <div><h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Logline</h3><p className="italic text-gray-800">{selected.logline}</p></div>
          )}
          {selected.short_synopsis && (
            <div><h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Short Synopsis</h3><p className="text-gray-700 whitespace-pre-wrap">{selected.short_synopsis}</p></div>
          )}
          {selected.full_synopsis && (
            <div><h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Full Synopsis</h3><p className="text-gray-700 whitespace-pre-wrap">{selected.full_synopsis}</p></div>
          )}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Category Grades</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GRADE_FIELDS.map(({ key, label }) => {
                const grade = selected[key] as Grade;
                return (
                  <div key={key} className="border rounded-lg p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{label}</p>
                    <p className="font-bold text-sm capitalize">{grade || '—'}</p>
                  </div>
                );
              })}
            </div>
          </div>
          {selected.comments && (
            <div><h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Comments</h3><p className="text-gray-700 whitespace-pre-wrap">{selected.comments}</p></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Script Coverage</h1>
          <p className="text-sm text-surface-400 mt-0.5">Reader reports with graded categories and recommendations.</p>
        </div>
        {canEdit && <Button onClick={openNew}>+ New Coverage</Button>}
      </div>

      {coverages.length === 0 ? (
        <Card className="p-10 text-center text-surface-500">
          <p className="font-medium text-white mb-1">No coverage yet</p>
          <p className="text-sm">Create a reader report with graded categories and a pass/consider/recommend verdict.</p>
          {canEdit && <Button className="mt-4" onClick={openNew}>Write Coverage</Button>}
        </Card>
      ) : (
        <div className="space-y-3">
          {coverages.map((c) => {
            const recMeta = REC_META[c.recommendation ?? ''];
            const avgGrade = GRADE_FIELDS
              .map((f) => ({ excellent: 4, good: 3, fair: 2, poor: 1, '': 0 })[(c[f.key] as Grade) ?? ''])
              .filter((g) => g > 0);
            const avg = avgGrade.length ? (avgGrade.reduce((a, b) => a + b, 0) / avgGrade.length).toFixed(1) : null;
            return (
              <Card key={c.id} className="group p-4 hover:border-surface-600 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-white">{c.script_title ?? 'Untitled'}</p>
                      {c.recommendation && (
                        <span className={cn('text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider border', recMeta.color)}>
                          {recMeta.label}
                        </span>
                      )}
                      {avg && <span className="text-[11px] text-surface-500">avg grade: {avg}/4</span>}
                    </div>
                    <p className="text-xs text-surface-500">
                      {c.reader_name ? `Read by ${c.reader_name}` : 'No reader'}
                      {c.draft_date ? ` · ${c.draft_date}` : ''}
                    </p>
                    {c.logline && <p className="text-xs text-surface-400 mt-1.5 line-clamp-2 italic">{c.logline}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {canEdit && (
                      <>
                      <button onClick={() => { setSelected(c); setView('print'); }} className="px-3 py-1.5 text-xs bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-white">Print</button>
                        <button onClick={() => openEdit(c)} className="px-3 py-1.5 text-xs bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-white">Edit</button>
                        <button onClick={() => deleteCoverage(c.id)} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg">Delete</button>
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
