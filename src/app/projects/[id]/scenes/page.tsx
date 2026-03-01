'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, Select, EmptyState, LoadingSpinner, Progress, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { Scene, Location, Character, SceneLocationType, SceneTime, ScriptElement } from '@/lib/types';

// Parse a scene heading like "INT. COFFEE SHOP - NIGHT" into components
function parseSceneHeading(heading: string) {
  let locationType: 'INT' | 'EXT' | 'INT_EXT' = 'INT';
  let locationName = '';
  let timeOfDay = 'DAY';

  const h = heading.trim().toUpperCase();
  if (h.startsWith('INT./EXT.') || h.startsWith('INT/EXT') || h.startsWith('I/E.')) locationType = 'INT_EXT';
  else if (h.startsWith('EXT.')) locationType = 'EXT';
  else if (h.startsWith('INT.')) locationType = 'INT';

  let rest = h.replace(/^(INT\.\/EXT\.|INT\/EXT|I\/E\.|INT\.|EXT\.)\s*/i, '').trim();
  const dashParts = rest.split(/\s+-\s+/);
  locationName = dashParts[0]?.trim() || '';
  if (dashParts.length > 1) {
    timeOfDay = dashParts[dashParts.length - 1]?.trim() || 'DAY';
  }

  return { locationType, locationName, timeOfDay };
}

export default function ScenesPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const hasSynced = useRef(false);

  useEffect(() => { fetchData(); }, [params.id]);

  // Auto-sync scenes from script on first load
  useEffect(() => {
    if (!loading && !hasSynced.current && canEdit) {
      hasSynced.current = true;
      handleAutoSync();
    }
  }, [loading]);

  const fetchData = async () => {
    try {
      const supabase = createClient();
      const [scenesRes, locsRes, charsRes] = await Promise.all([
        supabase.from('scenes').select('*').eq('project_id', params.id).order('sort_order'),
        supabase.from('locations').select('*').eq('project_id', params.id),
        supabase.from('characters').select('*').eq('project_id', params.id).order('name'),
      ]);
      setScenes(scenesRes.data || []);
      setLocations(locsRes.data || []);
      setCharacters(charsRes.data || []);
    } catch (err) {
      console.error('Unexpected error fetching scenes data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-sync: detect new scene headings from script and create scene entries
  const handleAutoSync = async () => {
    setSyncing(true);
    try {
      const supabase = createClient();
      const { data: scripts } = await supabase
        .from('scripts').select('id').eq('project_id', params.id).limit(1);
      if (!scripts || scripts.length === 0) { setSyncing(false); return; }

      const { data: elements } = await supabase
        .from('script_elements')
        .select('*')
        .eq('script_id', scripts[0].id)
        .eq('element_type', 'scene_heading')
        .eq('is_omitted', false)
        .order('sort_order');

      if (!elements || elements.length === 0) { setSyncing(false); return; }

      const linkedIds = new Set(scenes.filter(s => s.script_element_id).map(s => s.script_element_id));
      const newElements = elements.filter(e => !linkedIds.has(e.id));

      if (newElements.length === 0) { setSyncing(false); return; }

      const scenesToCreate = newElements.map((el, i) => {
        const parsed = parseSceneHeading(el.content);
        return {
          project_id: params.id,
          script_id: scripts[0].id,
          script_element_id: el.id,
          scene_number: el.scene_number || String(scenes.length + i + 1),
          scene_heading: el.content,
          location_type: parsed.locationType as SceneLocationType,
          location_name: parsed.locationName,
          time_of_day: parsed.timeOfDay as SceneTime,
          sort_order: scenes.length + i,
          created_by: user?.id,
        };
      });

      await supabase.from('scenes').insert(scenesToCreate);
      await fetchData();
    } catch (err) {
      console.error('Auto-sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Determine if a scene "needs setup" (only has auto-imported data, no production breakdown)
  const needsSetup = (s: Scene) => {
    return s.script_element_id && !s.is_completed && !s.synopsis && s.cast_ids.length === 0 && s.props.length === 0 && !s.location_id;
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    const ok = await confirm({ message: 'Delete this scene?', variant: 'danger', confirmLabel: 'Delete' }); if (!ok) return;
    const supabase = createClient();
    await supabase.from('scenes').delete().eq('id', id);
    setScenes(scenes.filter((s) => s.id !== id));
  };

  const completed = scenes.filter((s) => s.is_completed).length;
  const setupNeeded = scenes.filter(needsSetup).length;
  const totalPages = scenes.reduce((sum, s) => sum + (s.page_count || 0), 0);

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Scene Breakdown</h1>
          <p className="text-sm text-surface-400 mt-1">
            {completed}/{scenes.length} scenes completed &bull; {totalPages} pages total
            {setupNeeded > 0 && <span className="text-amber-400"> &bull; {setupNeeded} need setup</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <Button variant="secondary" onClick={handleAutoSync} loading={syncing}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync from Script
              </Button>
              <Button variant="secondary" onClick={() => setShowImport(true)}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Import from Script
              </Button>
              <Button onClick={() => { setSelectedScene(null); setShowEditor(true); }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Scene
              </Button>
            </>
          )}
        </div>
      </div>

      {scenes.length > 0 && (
        <div className="mb-6">
          <Progress value={completed} max={Math.max(scenes.length, 1)} label="Production Progress" color="#22c55e" />
        </div>
      )}

      {scenes.length === 0 ? (
        <EmptyState title="No scenes yet" description="Break down your script into scenes for production planning"
          action={canEdit ? <Button onClick={() => { setSelectedScene(null); setShowEditor(true); }}>Add Scene</Button> : undefined} />
      ) : (
        <div className="space-y-3 stagger-children">
          {scenes.map((scene, i) => (
            <Card key={scene.id} hover className="overflow-hidden" onClick={() => { setSelectedScene(scene); setShowEditor(true); }}>
              <div className="flex items-start gap-4 p-4">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                  scene.is_completed ? 'bg-green-500/20 text-green-400' : 'bg-surface-800 text-surface-400'
                )}>
                  {scene.scene_number || i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge size="sm" variant="info">{scene.location_type}</Badge>
                    <h3 className="font-medium text-white">
                      {scene.scene_heading || scene.location_name || 'Untitled Scene'}
                    </h3>
                    <Badge size="sm">{scene.time_of_day}</Badge>
                    {scene.is_completed && <Badge variant="success" size="sm">Done</Badge>}
                    {needsSetup(scene) && (
                      <Badge variant="warning" size="sm">
                        <svg className="w-3 h-3 mr-0.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                        Set Up
                      </Badge>
                    )}
                    {!needsSetup(scene) && scene.script_element_id && <Badge variant="info" size="sm">📄 Script Linked</Badge>}
                  </div>
                  {needsSetup(scene) && !scene.synopsis && (
                    <p className="text-sm text-amber-400/70 mt-1 italic">Click to set up cast, props, location &amp; more</p>
                  )}
                  {scene.synopsis && <p className="text-sm text-surface-400 mt-1 line-clamp-1">{scene.synopsis}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
                    {scene.page_count > 0 && <span>{scene.page_count} pgs</span>}
                    {scene.estimated_duration_minutes && <span>{scene.estimated_duration_minutes} min</span>}
                    {scene.cast_ids.length > 0 && <span>{scene.cast_ids.length} cast</span>}
                    {scene.props.length > 0 && <span>{scene.props.length} props</span>}
                    {scene.special_effects.length > 0 && <span>{scene.special_effects.length} FX</span>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SceneEditor
        isOpen={showEditor} onClose={() => setShowEditor(false)}
        scene={selectedScene} projectId={params.id} userId={user?.id || ''}
        locations={locations} characters={characters}
        onSaved={() => { fetchData(); setShowEditor(false); }}
        onDelete={handleDelete}
        canEdit={canEdit}
      />

      <ImportFromScriptModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        projectId={params.id}
        userId={user?.id || ''}
        existingScenes={scenes}
        onImported={() => { fetchData(); setShowImport(false); }}
      />
      <ConfirmDialog />
    </div>
  );
}

function SceneEditor({ isOpen, onClose, scene, projectId, userId, locations, characters, onSaved, onDelete, canEdit }: {
  isOpen: boolean; onClose: () => void; scene: Scene | null; projectId: string; userId: string;
  locations: Location[]; characters: Character[];
  onSaved: () => void; onDelete: (id: string) => void; canEdit: boolean;
}) {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('basic');
  const [propInput, setPropInput] = useState('');
  const [fxInput, setFxInput] = useState('');

  useEffect(() => {
    setForm(scene ? {
      scene_number: scene.scene_number || '', scene_heading: scene.scene_heading || '',
      location_type: scene.location_type, location_name: scene.location_name || '',
      time_of_day: scene.time_of_day, synopsis: scene.synopsis || '', page_count: scene.page_count || 0,
      estimated_duration_minutes: scene.estimated_duration_minutes || '', location_id: scene.location_id || '',
      cast_ids: scene.cast_ids || [], extras_count: scene.extras_count || 0, props: scene.props || [],
      costumes: scene.costumes || [], makeup_notes: scene.makeup_notes || '',
      special_effects: scene.special_effects || [], stunts: scene.stunts || '',
      vehicles: scene.vehicles || [], sound_notes: scene.sound_notes || '', music_cues: scene.music_cues || [],
      vfx_notes: scene.vfx_notes || '', mood: scene.mood || '', weather_required: scene.weather_required || '',
      special_equipment: scene.special_equipment || [], notes: scene.notes || '', is_completed: scene.is_completed,
    } : {
      scene_number: '', scene_heading: '', location_type: 'INT' as SceneLocationType,
      location_name: '', time_of_day: 'DAY' as SceneTime, synopsis: '', page_count: 0,
      estimated_duration_minutes: '', location_id: '', cast_ids: [], extras_count: 0,
      props: [], costumes: [], makeup_notes: '', special_effects: [], stunts: '',
      vehicles: [], sound_notes: '', music_cues: [], vfx_notes: '', mood: '',
      weather_required: '', special_equipment: [], notes: '', is_completed: false,
    });
    setTab('basic');
  }, [scene, isOpen]);

  const handleSave = async () => {
    setLoading(true);
    const supabase = createClient();
    const payload = { ...form, project_id: projectId, created_by: userId,
      estimated_duration_minutes: form.estimated_duration_minutes ? parseInt(form.estimated_duration_minutes) : null,
      location_id: form.location_id || null,
    };
    if (scene) await supabase.from('scenes').update(payload).eq('id', scene.id);
    else await supabase.from('scenes').insert(payload);
    setLoading(false);
    onSaved();
  };

  const addToArray = (field: string, value: string, setInput: (v: string) => void) => {
    if (value.trim() && !form[field].includes(value.trim())) {
      setForm({ ...form, [field]: [...form[field], value.trim()] });
      setInput('');
    }
  };

  const toggleCast = (id: string) => {
    setForm({ ...form, cast_ids: form.cast_ids?.includes(id) ? form.cast_ids.filter((c: string) => c !== id) : [...(form.cast_ids || []), id] });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={scene ? `Scene ${scene.scene_number || ''}` : 'New Scene'} size="xl">
      <div className="flex gap-1 mb-6 bg-surface-800 rounded-lg p-1">
        {['basic', 'breakdown', 'technical', 'notes'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            'flex-1 px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors',
            tab === t ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white'
          )}>{t}</button>
        ))}
      </div>

      <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
        {tab === 'basic' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Scene #" value={form.scene_number} onChange={(e) => setForm({ ...form, scene_number: e.target.value })} />
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">INT/EXT</label>
                <select value={form.location_type} onChange={(e) => setForm({ ...form, location_type: e.target.value })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
                  <option value="INT">INT</option><option value="EXT">EXT</option>
                  <option value="INT_EXT">INT/EXT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Time</label>
                <select value={form.time_of_day} onChange={(e) => setForm({ ...form, time_of_day: e.target.value })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
                  {['DAY','NIGHT','DAWN','DUSK','MORNING','AFTERNOON','EVENING','CONTINUOUS','LATER'].map(t =>
                    <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <Input label="Scene Heading" value={form.scene_heading} onChange={(e) => setForm({ ...form, scene_heading: e.target.value })} placeholder="INT. LOCATION - DAY" />
            <Input label="Location Name" value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} />
            <Textarea label="Synopsis" value={form.synopsis} onChange={(e) => setForm({ ...form, synopsis: e.target.value })} rows={3} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Page Count" type="number" step="0.125" value={form.page_count} onChange={(e) => setForm({ ...form, page_count: parseFloat(e.target.value) || 0 })} />
              <Input label="Est. Duration (min)" type="number" value={form.estimated_duration_minutes} onChange={(e) => setForm({ ...form, estimated_duration_minutes: e.target.value })} />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_completed} onChange={(e) => setForm({ ...form, is_completed: e.target.checked })} />
              <span className="text-sm text-surface-300">Scene Completed</span>
            </label>
          </>
        )}
        {tab === 'breakdown' && (
          <>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Cast</label>
              <div className="flex flex-wrap gap-2">
                {characters.map((c) => (
                  <button key={c.id} onClick={() => toggleCast(c.id)} className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    form.cast_ids?.includes(c.id) ? 'text-white' : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                  )} style={form.cast_ids?.includes(c.id) ? { backgroundColor: c.color } : undefined}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <Input label="Extras Count" type="number" value={form.extras_count} onChange={(e) => setForm({ ...form, extras_count: parseInt(e.target.value) || 0 })} />
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Props</label>
              <div className="flex gap-2 mb-2">
                <Input value={propInput} onChange={(e) => setPropInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('props', propInput, setPropInput))}
                  placeholder="Add prop..." className="flex-1" />
                <Button variant="secondary" onClick={() => addToArray('props', propInput, setPropInput)}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.props?.map((p: string) => (
                  <button key={p} onClick={() => setForm({ ...form, props: form.props.filter((x: string) => x !== p) })}
                    className="px-2 py-1 rounded bg-surface-800 text-xs text-surface-300 hover:bg-red-500/20 hover:text-red-400">{p} ×</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Special Effects</label>
              <div className="flex gap-2 mb-2">
                <Input value={fxInput} onChange={(e) => setFxInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('special_effects', fxInput, setFxInput))}
                  placeholder="Add effect..." className="flex-1" />
                <Button variant="secondary" onClick={() => addToArray('special_effects', fxInput, setFxInput)}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.special_effects?.map((fx: string) => (
                  <button key={fx} onClick={() => setForm({ ...form, special_effects: form.special_effects.filter((x: string) => x !== fx) })}
                    className="px-2 py-1 rounded bg-surface-800 text-xs text-surface-300 hover:bg-red-500/20 hover:text-red-400">{fx} ×</button>
                ))}
              </div>
            </div>
            <Textarea label="Stunts" value={form.stunts} onChange={(e) => setForm({ ...form, stunts: e.target.value })} rows={2} />
          </>
        )}
        {tab === 'technical' && (
          <>
            <Textarea label="Sound Notes" value={form.sound_notes} onChange={(e) => setForm({ ...form, sound_notes: e.target.value })} rows={2} />
            <Textarea label="VFX Notes" value={form.vfx_notes} onChange={(e) => setForm({ ...form, vfx_notes: e.target.value })} rows={2} />
            <Input label="Mood" value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })} placeholder="Tense, romantic, eerie..." />
            <Input label="Weather Required" value={form.weather_required} onChange={(e) => setForm({ ...form, weather_required: e.target.value })} />
            <Textarea label="Makeup Notes" value={form.makeup_notes} onChange={(e) => setForm({ ...form, makeup_notes: e.target.value })} rows={2} />
          </>
        )}
        {tab === 'notes' && (
          <Textarea label="General Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={8} />
        )}
      </div>

      <div className="flex items-center justify-between pt-6 mt-6 border-t border-surface-800">
        <div>{canEdit && scene && <Button variant="danger" size="sm" onClick={() => onDelete(scene.id)}>Delete</Button>}</div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {canEdit && <Button onClick={handleSave} loading={loading}>{scene ? 'Save' : 'Create'}</Button>}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// IMPORT FROM SCRIPT MODAL
// ============================================================

function ImportFromScriptModal({ isOpen, onClose, projectId, userId, existingScenes, onImported }: {
  isOpen: boolean; onClose: () => void; projectId: string; userId: string;
  existingScenes: Scene[]; onImported: () => void;
}) {
  const [scriptElements, setScriptElements] = useState<ScriptElement[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isOpen) loadSceneHeadings();
  }, [isOpen]);

  const loadSceneHeadings = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: scripts } = await supabase
      .from('scripts').select('id').eq('project_id', projectId).limit(1);
    if (!scripts || scripts.length === 0) { setLoading(false); return; }

    const { data: elements } = await supabase
      .from('script_elements')
      .select('*')
      .eq('script_id', scripts[0].id)
      .eq('element_type', 'scene_heading')
      .eq('is_omitted', false)
      .order('sort_order');

    setScriptElements(elements || []);
    setLoading(false);
  };

  const linkedElementIds = new Set(existingScenes.filter(s => s.script_element_id).map(s => s.script_element_id));

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    const unlinked = scriptElements.filter(e => !linkedElementIds.has(e.id));
    if (selected.size === unlinked.length) setSelected(new Set());
    else setSelected(new Set(unlinked.map(e => e.id)));
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    const supabase = createClient();

    const { data: scripts } = await supabase
      .from('scripts').select('id').eq('project_id', projectId).limit(1);
    const scriptId = scripts?.[0]?.id || null;

    const scenesToCreate = Array.from(selected).map((elementId, i) => {
      const el = scriptElements.find(e => e.id === elementId);
      if (!el) return null;
      const parsed = parseSceneHeading(el.content);
      return {
        project_id: projectId,
        script_id: scriptId,
        script_element_id: elementId,
        scene_number: el.scene_number || String(existingScenes.length + i + 1),
        scene_heading: el.content,
        location_type: parsed.locationType as SceneLocationType,
        location_name: parsed.locationName,
        time_of_day: parsed.timeOfDay as SceneTime,
        sort_order: existingScenes.length + i,
        created_by: userId,
      };
    }).filter(Boolean);

    if (scenesToCreate.length > 0) {
      const { error } = await supabase.from('scenes').insert(scenesToCreate);
      if (error) {
        toast.error('Import failed: ' + error.message);
        setImporting(false);
        return;
      }
    }

    setImporting(false);
    setSelected(new Set());
    onImported();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Scenes from Script" size="lg">
      {loading ? (
        <LoadingSpinner className="py-12" />
      ) : scriptElements.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-3xl mb-3 block">📄</span>
          <p className="text-surface-400 text-sm">No script found or no scene headings in the script.</p>
          <p className="text-surface-500 text-xs mt-1">Write your screenplay first, then import scenes here.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-surface-400">
              {scriptElements.length} scene headings found. Select which to import.
            </p>
            <button onClick={selectAll} className="text-xs text-[#FF5F1F] hover:text-[#FF8F5F] transition-colors">
              {selected.size === scriptElements.filter(e => !linkedElementIds.has(e.id)).length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-2">
            {scriptElements.map((el) => {
              const isLinked = linkedElementIds.has(el.id);
              const isSelected = selected.has(el.id);
              const parsed = parseSceneHeading(el.content);
              return (
                <button
                  key={el.id}
                  disabled={isLinked}
                  onClick={() => toggleSelect(el.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                    isLinked ? 'opacity-50 cursor-not-allowed bg-surface-800/30' :
                    isSelected ? 'bg-[#E54E15]/15 border border-[#E54E15]/30' :
                    'bg-surface-900 hover:bg-surface-800 border border-transparent'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                    isLinked ? 'border-green-500 bg-green-500/20' :
                    isSelected ? 'border-[#FF5F1F] bg-[#FF5F1F]' : 'border-surface-600'
                  )}>
                    {(isLinked || isSelected) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {el.scene_number && <span className="text-xs font-mono text-surface-500">{el.scene_number}</span>}
                      <Badge size="sm" variant="info">{parsed.locationType.replace('_', '/')}</Badge>
                      <span className="text-sm text-white font-medium truncate">{parsed.locationName}</span>
                      <Badge size="sm">{parsed.timeOfDay}</Badge>
                    </div>
                  </div>
                  {isLinked && <span className="text-[10px] text-green-400">Already linked</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-6 mt-4 border-t border-surface-800">
            <p className="text-xs text-surface-500">{selected.size} selected</p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={handleImport} loading={importing} disabled={selected.size === 0}>
                Import {selected.size} Scene{selected.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
