'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Shot, Scene } from '@/lib/types';

export default function StoryboardPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';
  const [shots, setShots] = useState<Shot[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingShot, setEditingShot] = useState<Shot | null>(null);
  const [storyboardUrl, setStoryboardUrl] = useState('');
  const [storyboardNote, setStoryboardNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterScene, setFilterScene] = useState<string>('all');
  const [viewSize, setViewSize] = useState<'sm' | 'md' | 'lg'>('md');

  useEffect(() => { fetchData(); }, [params.id]);

  const fetchData = async () => {
    try {
      const supabase = createClient();
      const [shotsRes, scenesRes] = await Promise.all([
        supabase.from('shots').select('*').eq('project_id', params.id).order('sort_order'),
        supabase.from('scenes').select('*').eq('project_id', params.id).order('sort_order'),
      ]);
      setShots(shotsRes.data || []);
      setScenes(scenesRes.data || []);
    } catch (err) {
      console.error('Error fetching storyboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStoryboard = async () => {
    if (!editingShot) return;
    setSaving(true);
    const supabase = createClient();
    const desc = storyboardNote ? (editingShot.description ? `${editingShot.description}\n\n[Storyboard] ${storyboardNote}` : storyboardNote) : editingShot.description;
    await supabase.from('shots').update({
      storyboard_url: storyboardUrl || null,
      description: storyboardNote ? desc : editingShot.description,
    }).eq('id', editingShot.id);
    setShots(shots.map(s => s.id === editingShot.id ? { ...s, storyboard_url: storyboardUrl || null } : s));
    setSaving(false);
    setEditingShot(null);
  };

  const filtered = filterScene === 'all' ? shots : shots.filter(s => s.scene_id === filterScene);

  // Group shots by scene for storyboard flow
  const sceneGroups: { scene: Scene | null; shots: Shot[] }[] = [];
  if (filterScene === 'all') {
    const grouped = new Map<string, Shot[]>();
    const noScene: Shot[] = [];
    filtered.forEach(s => {
      if (s.scene_id) {
        if (!grouped.has(s.scene_id)) grouped.set(s.scene_id, []);
        grouped.get(s.scene_id)!.push(s);
      } else {
        noScene.push(s);
      }
    });
    scenes.forEach(sc => {
      const scShots = grouped.get(sc.id);
      if (scShots) sceneGroups.push({ scene: sc, shots: scShots });
    });
    if (noScene.length > 0) sceneGroups.push({ scene: null, shots: noScene });
  } else {
    const sc = scenes.find(s => s.id === filterScene) || null;
    sceneGroups.push({ scene: sc, shots: filtered });
  }

  const gridCols = viewSize === 'sm' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6' :
    viewSize === 'md' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' :
    'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';

  const panelH = viewSize === 'sm' ? 'h-24' : viewSize === 'md' ? 'h-36' : 'h-48';

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Storyboard</h1>
          <p className="text-sm text-surface-400 mt-1">
            {shots.filter(s => s.storyboard_url).length}/{shots.length} shots have storyboard frames
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Size toggle */}
          <div className="flex bg-surface-900 rounded-lg p-0.5">
            {(['sm', 'md', 'lg'] as const).map(size => (
              <button key={size} onClick={() => setViewSize(size)} className={cn(
                'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewSize === size ? 'bg-surface-700 text-white' : 'text-surface-500 hover:text-white'
              )}>
                {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
              </button>
            ))}
          </div>
        </div>
      </div>

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

      {shots.length === 0 ? (
        <EmptyState
          title="No shots for storyboarding"
          description="Create shots in your Shot List first, then add storyboard frames here."
        />
      ) : (
        <div className="space-y-8">
          {sceneGroups.map((group, gi) => (
            <div key={gi}>
              {group.scene && (
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-surface-300">Scene {group.scene.scene_number}</span>
                    <Badge size="sm" variant="info">{group.scene.location_type}</Badge>
                    <span className="text-xs text-surface-500">{group.scene.location_name}</span>
                    <Badge size="sm">{group.scene.time_of_day}</Badge>
                  </div>
                  <div className="flex-1 border-t border-surface-800" />
                </div>
              )}
              {!group.scene && group.shots.length > 0 && (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-surface-500">Unassigned shots</span>
                  <div className="flex-1 border-t border-surface-800" />
                </div>
              )}
              <div className={cn('grid gap-3', gridCols)}>
                {group.shots.map((shot, si) => (
                  <div
                    key={shot.id}
                    onClick={() => {
                      if (!canEdit) return;
                      setEditingShot(shot);
                      setStoryboardUrl(shot.storyboard_url || '');
                      setStoryboardNote('');
                    }}
                    className={cn(
                      'group rounded-xl border overflow-hidden transition-all',
                      canEdit && 'cursor-pointer hover:border-surface-600',
                      shot.storyboard_url ? 'border-surface-700' : 'border-dashed border-surface-800'
                    )}
                  >
                    {/* Frame */}
                    <div className={cn('relative bg-surface-900 flex items-center justify-center', panelH)}>
                      {shot.storyboard_url ? (
                        <img
                          src={shot.storyboard_url}
                          alt={`Shot ${shot.shot_number}`}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="text-center text-surface-700 group-hover:text-surface-500 transition-colors">
                          <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {viewSize !== 'sm' && <p className="text-[10px] mt-1">Add frame</p>}
                        </div>
                      )}
                      {/* Shot number overlay */}
                      <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
                        {shot.shot_number || `#${si + 1}`}
                      </span>
                      {shot.is_completed && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                      )}
                    </div>
                    {/* Label */}
                    {viewSize !== 'sm' && (
                      <div className="p-2 bg-surface-950">
                        <div className="flex items-center gap-1">
                          <Badge size="sm" variant="info">{shot.shot_type.replace('_', ' ')}</Badge>
                          {shot.lens && <span className="text-[10px] text-surface-600">{shot.lens}</span>}
                        </div>
                        {shot.description && (
                          <p className="text-[11px] text-surface-500 mt-1 line-clamp-2">{shot.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit storyboard frame modal */}
      {editingShot && (
        <Modal isOpen={true} onClose={() => setEditingShot(null)} title={`Storyboard — Shot ${editingShot.shot_number || ''}`} size="md">
          <div className="space-y-4">
            {/* Current frame preview */}
            {storyboardUrl && (
              <div className="rounded-lg overflow-hidden border border-surface-700 bg-surface-900">
                <img src={storyboardUrl} alt="Storyboard" className="w-full max-h-64 object-contain" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }} />
              </div>
            )}
            <Input
              label="Image URL"
              value={storyboardUrl}
              onChange={(e) => setStoryboardUrl(e.target.value)}
              placeholder="https://... (paste image URL or drawing link)"
            />
            <p className="text-[11px] text-surface-500 -mt-2">
              Paste a direct image URL. You can use free tools like Excalidraw, Canva, or your own sketches uploaded to any image host.
            </p>
            <Textarea
              label="Frame Notes (optional)"
              value={storyboardNote}
              onChange={(e) => setStoryboardNote(e.target.value)}
              placeholder="Camera angle, action description..."
              rows={2}
            />

            {/* Shot context */}
            <div className="bg-surface-900 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Badge size="sm" variant="info">{editingShot.shot_type.replace('_', ' ')}</Badge>
                <Badge size="sm">{editingShot.shot_movement.replace('_', ' ')}</Badge>
                {editingShot.lens && <span className="text-xs text-surface-500">{editingShot.lens}</span>}
              </div>
              {editingShot.description && <p className="text-xs text-surface-400">{editingShot.description}</p>}
              {editingShot.camera_notes && <p className="text-xs text-surface-500 italic">{editingShot.camera_notes}</p>}
            </div>
          </div>
          <div className="flex justify-between pt-6 mt-6 border-t border-surface-800">
            <div>
              {storyboardUrl && (
                <Button variant="ghost" size="sm" onClick={() => setStoryboardUrl('')}>Remove Frame</Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setEditingShot(null)}>Cancel</Button>
              <Button onClick={handleSaveStoryboard} loading={saving}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
