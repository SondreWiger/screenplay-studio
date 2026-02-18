'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Shot, Scene, ShotType, ShotMovement } from '@/lib/types';

const SHOT_TYPES: { value: ShotType; label: string }[] = [
  { value: 'wide', label: 'Wide' }, { value: 'full', label: 'Full' },
  { value: 'medium_wide', label: 'Medium Wide' }, { value: 'medium', label: 'Medium' },
  { value: 'medium_close', label: 'Medium Close' }, { value: 'close_up', label: 'Close Up' },
  { value: 'extreme_close', label: 'Extreme Close' }, { value: 'over_shoulder', label: 'Over Shoulder' },
  { value: 'two_shot', label: 'Two Shot' }, { value: 'pov', label: 'POV' },
  { value: 'aerial', label: 'Aerial' }, { value: 'insert', label: 'Insert' },
  { value: 'establishing', label: 'Establishing' }, { value: 'tracking', label: 'Tracking' },
  { value: 'steadicam', label: 'Steadicam' }, { value: 'handheld', label: 'Handheld' },
  { value: 'dutch_angle', label: 'Dutch Angle' },
];

const MOVEMENTS: { value: ShotMovement; label: string }[] = [
  { value: 'static', label: 'Static' }, { value: 'pan_left', label: 'Pan Left' },
  { value: 'pan_right', label: 'Pan Right' }, { value: 'tilt_up', label: 'Tilt Up' },
  { value: 'tilt_down', label: 'Tilt Down' }, { value: 'dolly_in', label: 'Dolly In' },
  { value: 'dolly_out', label: 'Dolly Out' }, { value: 'crane_up', label: 'Crane Up' },
  { value: 'crane_down', label: 'Crane Down' }, { value: 'zoom_in', label: 'Zoom In' },
  { value: 'zoom_out', label: 'Zoom Out' }, { value: 'follow', label: 'Follow' },
  { value: 'orbit', label: 'Orbit' }, { value: 'whip_pan', label: 'Whip Pan' },
  { value: 'rack_focus', label: 'Rack Focus' },
];

export default function ShotsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';
  const [shots, setShots] = useState<Shot[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filterScene, setFilterScene] = useState<string>('all');

  useEffect(() => { fetchData(); }, [params.id]);

  const fetchData = async () => {
    try {
      const supabase = createClient();
      const [shotsRes, scenesRes] = await Promise.all([
        supabase.from('shots').select('*').eq('project_id', params.id).order('sort_order'),
        supabase.from('scenes').select('*').eq('project_id', params.id).order('sort_order'),
      ]);
      if (shotsRes.error) console.error('Shots fetch error:', shotsRes.error.message);
      if (scenesRes.error) console.error('Scenes fetch error:', scenesRes.error.message);
      setShots(shotsRes.data || []);
      setScenes(scenesRes.data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this shot?')) return;
    const supabase = createClient();
    await supabase.from('shots').delete().eq('id', id);
    setShots(shots.filter((s) => s.id !== id));
  };

  const toggleComplete = async (shot: Shot) => {
    const supabase = createClient();
    const updated = { ...shot, is_completed: !shot.is_completed, takes_completed: !shot.is_completed ? shot.takes_needed : 0 };
    await supabase.from('shots').update({ is_completed: updated.is_completed, takes_completed: updated.takes_completed }).eq('id', shot.id);
    setShots(shots.map((s) => s.id === shot.id ? updated : s));
  };

  const updateTakes = async (shot: Shot, delta: number) => {
    const newTakes = Math.max(0, Math.min(shot.takes_needed, shot.takes_completed + delta));
    if (newTakes === shot.takes_completed) return;
    const isComplete = newTakes >= shot.takes_needed;
    const updated = { ...shot, takes_completed: newTakes, is_completed: isComplete };
    const supabase = createClient();
    await supabase.from('shots').update({ takes_completed: newTakes, is_completed: isComplete }).eq('id', shot.id);
    setShots(shots.map((s) => s.id === shot.id ? updated : s));
  };

  const completed = shots.filter((s) => s.is_completed).length;
  const filtered = filterScene === 'all' ? shots : shots.filter((s) => s.scene_id === filterScene);

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Shot List</h1>
          <p className="text-sm text-surface-400 mt-1">{completed}/{shots.length} shots completed</p>
        </div>
        {canEdit && <Button onClick={() => { setSelectedShot(null); setShowEditor(true); }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Shot
        </Button>}
      </div>

      {shots.length > 0 && <Progress value={completed} max={Math.max(shots.length, 1)} label="Completion" color="#3b82f6" className="mb-6" />}

      {/* Scene filter */}
      {scenes.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button onClick={() => setFilterScene('all')} className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
            filterScene === 'all' ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
          )}>All Scenes</button>
          {scenes.map((s) => (
            <button key={s.id} onClick={() => setFilterScene(s.id)} className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              filterScene === s.id ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
            )}>Scene {s.scene_number || '?'}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No shots yet" description="Build your shot list for production"
          action={canEdit ? <Button onClick={() => { setSelectedShot(null); setShowEditor(true); }}>Add Shot</Button> : undefined} />
      ) : (
        <div className="space-y-2">
          {filtered.map((shot) => {
            const scene = scenes.find((s) => s.id === shot.scene_id);
            return (
              <Card key={shot.id} hover className="overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleComplete(shot); }}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      shot.is_completed ? 'bg-green-500/20 text-green-400' : 'bg-surface-800 text-surface-500 hover:bg-surface-700'
                    )}
                  >
                    {shot.is_completed ? '✓' : shot.shot_number || '•'}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedShot(shot); setShowEditor(true); }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge size="sm" variant="info">{shot.shot_type.replace('_', ' ')}</Badge>
                      <Badge size="sm">{shot.shot_movement.replace('_', ' ')}</Badge>
                      {shot.lens && <Badge size="sm">{shot.lens}</Badge>}
                      {scene && <span className="text-xs text-surface-500">Sc. {scene.scene_number}</span>}
                    </div>
                    {shot.description && <p className="text-sm text-surface-400 mt-1 line-clamp-1">{shot.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Takes counter with +/- buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); updateTakes(shot, -1); }}
                        disabled={shot.takes_completed <= 0}
                        className={cn(
                          'w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors',
                          shot.takes_completed > 0 ? 'text-surface-300 hover:bg-surface-700 hover:text-white' : 'text-surface-700 cursor-not-allowed'
                        )}
                        title="Decrease takes"
                      >−</button>
                      <span className="text-xs text-surface-400 tabular-nums min-w-[3ch] text-center">
                        {shot.takes_completed}/{shot.takes_needed}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateTakes(shot, 1); }}
                        disabled={shot.takes_completed >= shot.takes_needed}
                        className={cn(
                          'w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors',
                          shot.takes_completed < shot.takes_needed ? 'text-surface-300 hover:bg-surface-700 hover:text-white' : 'text-surface-700 cursor-not-allowed'
                        )}
                        title="Increase takes"
                      >+</button>
                    </div>
                    {shot.vfx_required && <Badge variant="warning" size="sm">VFX</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ShotEditor isOpen={showEditor} onClose={() => setShowEditor(false)} shot={selectedShot}
        projectId={params.id} userId={user?.id || ''} scenes={scenes}
        onSaved={() => { fetchData(); setShowEditor(false); }} onDelete={handleDelete} canEdit={canEdit} />
    </div>
  );
}

function ShotEditor({ isOpen, onClose, shot, projectId, userId, scenes, onSaved, onDelete, canEdit }: {
  isOpen: boolean; onClose: () => void; shot: Shot | null; projectId: string; userId: string;
  scenes: Scene[]; onSaved: () => void; onDelete: (id: string) => void; canEdit: boolean;
}) {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm(shot ? { ...shot } : {
      shot_number: '', shot_type: 'medium' as ShotType, shot_movement: 'static' as ShotMovement,
      lens: '', description: '', dialogue_ref: '', duration_seconds: '',
      camera_notes: '', lighting_notes: '', sound_notes: '', vfx_required: false,
      vfx_notes: '', scene_id: '', takes_needed: 1, takes_completed: 0, is_completed: false,
    });
  }, [shot, isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const payload = { ...form, project_id: projectId, created_by: userId,
        scene_id: form.scene_id || null, duration_seconds: form.duration_seconds ? parseInt(form.duration_seconds) : null };
      if (shot) {
        const { error } = await supabase.from('shots').update(payload).eq('id', shot.id);
        if (error) { alert(error.message); setLoading(false); return; }
      } else {
        const { error } = await supabase.from('shots').insert(payload);
        if (error) { alert(error.message); setLoading(false); return; }
      }
    } catch (err) {
      alert('Failed to save shot');
    }
    setLoading(false);
    onSaved();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={shot ? `Edit Shot ${shot.shot_number || ''}` : 'New Shot'} size="lg">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-3 gap-4">
          <Input label="Shot #" value={form.shot_number || ''} onChange={(e) => setForm({ ...form, shot_number: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Shot Type</label>
            <select value={form.shot_type || 'medium'} onChange={(e) => setForm({ ...form, shot_type: e.target.value })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              {SHOT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Movement</label>
            <select value={form.shot_movement || 'static'} onChange={(e) => setForm({ ...form, shot_movement: e.target.value })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              {MOVEMENTS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        {scenes.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Scene</label>
            <select value={form.scene_id || ''} onChange={(e) => setForm({ ...form, scene_id: e.target.value })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              <option value="">No scene</option>
              {scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.scene_number} - {s.scene_heading || s.location_name || 'Untitled'}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Lens" value={form.lens || ''} onChange={(e) => setForm({ ...form, lens: e.target.value })} placeholder="50mm, 24mm..." />
          <Input label="Duration (sec)" type="number" value={form.duration_seconds || ''} onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })} />
        </div>
        <Textarea label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        <Textarea label="Camera Notes" value={form.camera_notes || ''} onChange={(e) => setForm({ ...form, camera_notes: e.target.value })} rows={2} />
        <Textarea label="Lighting Notes" value={form.lighting_notes || ''} onChange={(e) => setForm({ ...form, lighting_notes: e.target.value })} rows={2} />
        <Textarea label="Sound Notes" value={form.sound_notes || ''} onChange={(e) => setForm({ ...form, sound_notes: e.target.value })} rows={2} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Takes Needed" type="number" value={form.takes_needed || 1} onChange={(e) => setForm({ ...form, takes_needed: parseInt(e.target.value) || 1 })} />
          <Input label="Takes Completed" type="number" value={form.takes_completed || 0} onChange={(e) => setForm({ ...form, takes_completed: parseInt(e.target.value) || 0 })} />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.vfx_required || false} onChange={(e) => setForm({ ...form, vfx_required: e.target.checked })} />
          <span className="text-sm text-surface-300">VFX Required</span>
        </label>
        {form.vfx_required && <Textarea label="VFX Notes" value={form.vfx_notes || ''} onChange={(e) => setForm({ ...form, vfx_notes: e.target.value })} rows={2} />}
      </div>
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-surface-800">
        <div>{canEdit && shot && <Button variant="danger" size="sm" onClick={() => onDelete(shot.id)}>Delete</Button>}</div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {canEdit && <Button onClick={handleSave} loading={loading}>{shot ? 'Save' : 'Create'}</Button>}
        </div>
      </div>
    </Modal>
  );
}
