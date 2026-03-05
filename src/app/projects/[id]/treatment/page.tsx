'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Card, Button, Input, Textarea, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

// ============================================================
// Treatment / Series Bible / Pitch Document Writer
// One document per project. Structured sections with
// episode breakdown, character arcs, and export.
// ============================================================

interface Episode {
  id: string;
  title: string;
  logline: string;
  synopsis: string;
}

interface CharacterArc {
  id: string;
  name: string;
  role: string;
  arc: string;
}

interface Treatment {
  id: string;
  logline: string | null;
  premise: string | null;
  theme: string | null;
  tone: string | null;
  format: string | null;
  budget_level: string | null;
  world: string | null;
  synopsis: string | null;
  episode_breakdown: Episode[];
  character_arcs: CharacterArc[];
  comparable_titles: string | null;
  market_context: string | null;
  writer_bio: string | null;
}

const BLANK_TREATMENT: Omit<Treatment, 'id'> = {
  logline: null, premise: null, theme: null, tone: null, format: null, budget_level: null,
  world: null, synopsis: null, episode_breakdown: [], character_arcs: [], comparable_titles: null,
  market_context: null, writer_bio: null,
};

const BUDGET_OPTIONS = ['Micro', 'Low', 'Mid', 'High', 'Studio'];
const FORMAT_OPTIONS = ['Feature Film', 'Short Film', 'TV Series (30 min)', 'TV Series (60 min)', 'Limited Series', 'Pilot', 'Web Series', 'Other'];

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function TreatmentPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const [treatment, setTreatment] = useState<Treatment | null>(null);
  const [form, setForm] = useState<Omit<Treatment, 'id'>>(BLANK_TREATMENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [isDirty, setIsDirty] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justLoadedRef = useRef(false);
  const saveRef = useRef<() => void>(() => {});

  useEffect(() => { load(); }, [params.id]);

  const load = async () => {
    const { data } = await createClient()
      .from('treatment')
      .select('*')
      .eq('project_id', params.id)
      .maybeSingle();
    if (data) {
      setTreatment(data as Treatment);
      justLoadedRef.current = true;
      setForm({
        logline: data.logline, premise: data.premise, theme: data.theme, tone: data.tone,
        format: data.format, budget_level: data.budget_level, world: data.world, synopsis: data.synopsis,
        episode_breakdown: (data.episode_breakdown ?? []) as Episode[],
        character_arcs: (data.character_arcs ?? []) as CharacterArc[],
        comparable_titles: data.comparable_titles, market_context: data.market_context, writer_bio: data.writer_bio,
      });
    }
    setLoading(false);
  };

  const save = useCallback(async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = { ...form, project_id: params.id, updated_at: new Date().toISOString() };
    if (treatment) {
      const { data, error } = await supabase.from('treatment').update(payload).eq('id', treatment.id).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      if (data) { setTreatment(data as Treatment); toast.success('Saved.'); }
    } else {
      const { data, error } = await supabase.from('treatment').insert({ ...payload, created_by: user?.id }).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      if (data) { setTreatment(data as Treatment); toast.success('Treatment created.'); }
    }
    setSaving(false);
    setIsDirty(false);
  }, [form, treatment, user?.id, params.id]);

  // Keep saveRef current so debounce callback always uses latest save fn
  useEffect(() => { saveRef.current = save; }, [save]);

  // Auto-save with debounce (3s) + dirty tracking
  useEffect(() => {
    if (justLoadedRef.current) { justLoadedRef.current = false; return; }
    if (loading) return;
    setIsDirty(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => saveRef.current(), 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [form]);

  // ⌘S / Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Unsaved changes warning
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Episode helpers
  const addEpisode = () => setForm((f) => ({ ...f, episode_breakdown: [...f.episode_breakdown, { id: uid(), title: '', logline: '', synopsis: '' }] }));
  const updateEpisode = (id: string, field: keyof Episode, val: string) =>
    setForm((f) => ({ ...f, episode_breakdown: f.episode_breakdown.map((e) => e.id === id ? { ...e, [field]: val } : e) }));
  const removeEpisode = (id: string) =>
    setForm((f) => ({ ...f, episode_breakdown: f.episode_breakdown.filter((e) => e.id !== id) }));

  // Character arc helpers
  const addArc = () => setForm((f) => ({ ...f, character_arcs: [...f.character_arcs, { id: uid(), name: '', role: '', arc: '' }] }));
  const updateArc = (id: string, field: keyof CharacterArc, val: string) =>
    setForm((f) => ({ ...f, character_arcs: f.character_arcs.map((c) => c.id === id ? { ...c, [field]: val } : c) }));
  const removeArc = (id: string) =>
    setForm((f) => ({ ...f, character_arcs: f.character_arcs.filter((c) => c.id !== id) }));

  const f = form;

  const SECTIONS = [
    { id: 'overview',    label: 'Overview' },
    { id: 'story',       label: 'Story' },
    { id: 'characters',  label: 'Characters' },
    { id: 'episodes',    label: 'Episodes' },
    { id: 'market',      label: 'Market' },
  ];

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Treatment / Series Bible</h1>
          <p className="text-sm text-surface-400 mt-0.5">Pitch document · {currentProject?.title}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {isDirty && !saving && <span className="text-xs text-amber-400">● Unsaved</span>}
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : treatment ? 'Save Changes' : 'Create Document'}</Button>
          </div>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl mb-6 flex-wrap">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              activeSection === s.id ? 'bg-surface-700 text-white' : 'text-surface-500 hover:text-surface-300')}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ─ Overview ─────────────────────────────────────── */}
      {activeSection === 'overview' && (
        <div className="max-w-2xl space-y-5">
          <Card className="p-5">
            <label className="text-xs text-surface-400 mb-1 block font-bold">Logline <span className="font-normal text-surface-500">(1–2 sentences)</span></label>
            <Textarea value={f.logline ?? ''} onChange={(e) => setForm({ ...f, logline: e.target.value })} rows={2}
              placeholder="When [protagonist] must [conflict], they discover [theme]…" readOnly={!canEdit} />
          </Card>

          <Card className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Format</label>
              <select value={f.format ?? ''} onChange={(e) => setForm({ ...f, format: e.target.value })}
                disabled={!canEdit}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">Select…</option>
                {FORMAT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Budget Level</label>
              <select value={f.budget_level ?? ''} onChange={(e) => setForm({ ...f, budget_level: e.target.value })}
                disabled={!canEdit}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">Select…</option>
                {BUDGET_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Tone</label>
              <Input value={f.tone ?? ''} onChange={(e) => setForm({ ...f, tone: e.target.value })}
                placeholder="e.g. Dark comedy, Gritty drama" readOnly={!canEdit} />
            </div>
          </Card>

          <Card className="p-5">
            <label className="text-xs text-surface-400 mb-1 block font-bold">Premise</label>
            <Textarea value={f.premise ?? ''} onChange={(e) => setForm({ ...f, premise: e.target.value })} rows={4}
              placeholder="The central dramatic question and core conflict…" readOnly={!canEdit} />
          </Card>

          <Card className="p-5">
            <label className="text-xs text-surface-400 mb-1 block font-bold">Theme</label>
            <Textarea value={f.theme ?? ''} onChange={(e) => setForm({ ...f, theme: e.target.value })} rows={3}
              placeholder="What questions does this story ask? What does it explore?" readOnly={!canEdit} />
          </Card>

          <Card className="p-5">
            <label className="text-xs text-surface-400 mb-1 block font-bold">World / Setting</label>
            <Textarea value={f.world ?? ''} onChange={(e) => setForm({ ...f, world: e.target.value })} rows={4}
              placeholder="Time period, location, rules of the world, look and feel…" readOnly={!canEdit} />
          </Card>
        </div>
      )}

      {/* ─ Story ────────────────────────────────────────── */}
      {activeSection === 'story' && (
        <div className="max-w-2xl space-y-5">
          <Card className="p-5">
            <label className="text-xs text-surface-400 mb-1 block font-bold">Full Synopsis</label>
            <Textarea value={f.synopsis ?? ''} onChange={(e) => setForm({ ...f, synopsis: e.target.value })} rows={20}
              placeholder="Beat-by-beat story summary. Beginning, middle, end. No cliffhanger — reveal your ending." readOnly={!canEdit} />
          </Card>
        </div>
      )}

      {/* ─ Characters ───────────────────────────────────── */}
      {activeSection === 'characters' && (
        <div className="max-w-2xl space-y-4">
          {f.character_arcs.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex gap-3 flex-1 flex-wrap">
                  <div className="flex-1 min-w-32">
                    <label className="text-xs text-surface-400 mb-1 block">Name</label>
                    <Input value={c.name} onChange={(e) => updateArc(c.id, 'name', e.target.value)} placeholder="Character name" readOnly={!canEdit} />
                  </div>
                  <div className="flex-1 min-w-32">
                    <label className="text-xs text-surface-400 mb-1 block">Role</label>
                    <Input value={c.role} onChange={(e) => updateArc(c.id, 'role', e.target.value)} placeholder="Protagonist, Antagonist…" readOnly={!canEdit} />
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => removeArc(c.id)} className="text-surface-600 hover:text-red-400 text-lg mt-5">×</button>
                )}
              </div>
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Arc</label>
                <Textarea value={c.arc} onChange={(e) => updateArc(c.id, 'arc', e.target.value)} rows={3}
                  placeholder="Where do they start? What do they want vs need? What do they become?" readOnly={!canEdit} />
              </div>
            </Card>
          ))}
          {canEdit && (
            <button onClick={addArc}
              className="w-full py-3 rounded-xl border border-dashed border-surface-700 text-surface-500 hover:border-orange-500/50 hover:text-orange-400 text-sm transition-colors">
              + Add Character Arc
            </button>
          )}
          {f.character_arcs.length === 0 && (
            <div className="text-center text-surface-500 text-sm py-8">No character arcs yet.</div>
          )}
        </div>
      )}

      {/* ─ Episodes ─────────────────────────────────────── */}
      {activeSection === 'episodes' && (
        <div className="max-w-2xl space-y-4">
          <p className="text-xs text-surface-500">For series formats — add episode-by-episode breakdown with title, logline and synopsis.</p>
          {f.episode_breakdown.map((ep, idx) => (
            <Card key={ep.id} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">Episode {idx + 1}</p>
                {canEdit && <button onClick={() => removeEpisode(ep.id)} className="text-surface-600 hover:text-red-400 text-lg">×</button>}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">Title</label>
                  <Input value={ep.title} onChange={(e) => updateEpisode(ep.id, 'title', e.target.value)} placeholder="Episode title" readOnly={!canEdit} />
                </div>
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">Logline</label>
                  <Input value={ep.logline} onChange={(e) => updateEpisode(ep.id, 'logline', e.target.value)} placeholder="One-line summary" readOnly={!canEdit} />
                </div>
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">Synopsis</label>
                  <Textarea value={ep.synopsis} onChange={(e) => updateEpisode(ep.id, 'synopsis', e.target.value)} rows={4}
                    placeholder="Episode story beats…" readOnly={!canEdit} />
                </div>
              </div>
            </Card>
          ))}
          {canEdit && (
            <button onClick={addEpisode}
              className="w-full py-3 rounded-xl border border-dashed border-surface-700 text-surface-500 hover:border-orange-500/50 hover:text-orange-400 text-sm transition-colors">
              + Add Episode
            </button>
          )}
          {f.episode_breakdown.length === 0 && (
            <div className="text-center text-surface-500 text-sm py-8">No episodes added. Use this for series or episodic projects.</div>
          )}
        </div>
      )}

      {/* ─ Market ───────────────────────────────────────── */}
      {activeSection === 'market' && (
        <div className="max-w-2xl space-y-5">
          <Card className="p-5">
            <label className="text-xs text-surface-400 mb-1 block font-bold">Comparable Titles</label>
            <Textarea value={f.comparable_titles ?? ''} onChange={(e) => setForm({ ...f, comparable_titles: e.target.value })} rows={3}
              placeholder={'e.g. "The Bear meets Normal People" or list individual titles with brief explanation…'} readOnly={!canEdit} />
          </Card>
          <Card className="p-5">
            <label className="text-xs text-surface-400 mb-1 block font-bold">Market Context</label>
            <Textarea value={f.market_context ?? ''} onChange={(e) => setForm({ ...f, market_context: e.target.value })} rows={4}
              placeholder="Target audience, why now, distribution strategy, streaming vs theatrical…" readOnly={!canEdit} />
          </Card>
          <Card className="p-5">
            <label className="text-xs text-surface-400 mb-1 block font-bold">Writer / Director Bio</label>
            <Textarea value={f.writer_bio ?? ''} onChange={(e) => setForm({ ...f, writer_bio: e.target.value })} rows={5}
              placeholder="Brief bio, relevant credits, why this writer for this project…" readOnly={!canEdit} />
          </Card>

          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Treatment'}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
