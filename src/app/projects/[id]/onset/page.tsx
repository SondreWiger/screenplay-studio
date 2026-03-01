'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, LoadingSpinner, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Shot, Scene } from '@/lib/types';

type ViewMode = 'shots' | 'scenes';

export default function OnSetPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';
  const [shots, setShots] = useState<Shot[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('shots');
  const [filterScene, setFilterScene] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);

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
      console.error('Onset data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleShotComplete = async (shot: Shot) => {
    if (!canEdit) return;
    const supabase = createClient();
    const updated = { ...shot, is_completed: !shot.is_completed, takes_completed: !shot.is_completed ? shot.takes_needed : 0 };
    await supabase.from('shots').update({ is_completed: updated.is_completed, takes_completed: updated.takes_completed }).eq('id', shot.id);
    setShots(shots.map((s) => s.id === shot.id ? updated : s));
  };

  const incrementTakes = async (shot: Shot) => {
    if (!canEdit) return;
    const newTakes = Math.min(shot.takes_needed, shot.takes_completed + 1);
    if (newTakes === shot.takes_completed) return;
    const isComplete = newTakes >= shot.takes_needed;
    const updated = { ...shot, takes_completed: newTakes, is_completed: isComplete };
    const supabase = createClient();
    await supabase.from('shots').update({ takes_completed: newTakes, is_completed: isComplete }).eq('id', shot.id);
    setShots(shots.map((s) => s.id === shot.id ? updated : s));
  };

  const toggleSceneComplete = async (scene: Scene) => {
    if (!canEdit) return;
    const supabase = createClient();
    const updated = { ...scene, is_completed: !scene.is_completed };
    await supabase.from('scenes').update({ is_completed: updated.is_completed }).eq('id', scene.id);
    setScenes(scenes.map((s) => s.id === scene.id ? updated : s));
  };

  const completedShots = shots.filter((s) => s.is_completed).length;
  const completedScenes = scenes.filter((s) => s.is_completed).length;

  const filteredShots = shots.filter(s => {
    if (!showCompleted && s.is_completed) return false;
    if (filterScene !== 'all' && s.scene_id !== filterScene) return false;
    return true;
  });

  const filteredScenes = scenes.filter(s => {
    if (!showCompleted && s.is_completed) return false;
    return true;
  });

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header - compact for mobile */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /></svg>
            On Set
          </h1>
          <label className="flex items-center gap-2 text-xs text-surface-400">
            <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-surface-600" />
            Show done
          </label>
        </div>
        <p className="text-xs text-surface-500 mt-1">
          {completedShots}/{shots.length} shots &bull; {completedScenes}/{scenes.length} scenes
        </p>
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-surface-900 rounded-xl p-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] text-surface-400 font-medium">Shots</span>
            <span className="text-lg font-bold text-blue-400">{shots.length > 0 ? Math.round(completedShots / shots.length * 100) : 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${shots.length > 0 ? completedShots / shots.length * 100 : 0}%` }} />
          </div>
        </div>
        <div className="bg-surface-900 rounded-xl p-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] text-surface-400 font-medium">Scenes</span>
            <span className="text-lg font-bold text-green-400">{scenes.length > 0 ? Math.round(completedScenes / scenes.length * 100) : 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${scenes.length > 0 ? completedScenes / scenes.length * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Toggle shots/scenes */}
      <div className="flex gap-1 bg-surface-900 rounded-xl p-1 mb-4">
        <button onClick={() => setViewMode('shots')} className={cn(
          'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
          viewMode === 'shots' ? 'bg-surface-700 text-white' : 'text-surface-400'
        )}>Shots ({shots.length - completedShots} left)</button>
        <button onClick={() => setViewMode('scenes')} className={cn(
          'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
          viewMode === 'scenes' ? 'bg-surface-700 text-white' : 'text-surface-400'
        )}>Scenes ({scenes.length - completedScenes} left)</button>
      </div>

      {/* === SHOTS VIEW === */}
      {viewMode === 'shots' && (
        <>
          {/* Scene filter pills */}
          {scenes.length > 0 && (
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
              <button onClick={() => setFilterScene('all')} className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors',
                filterScene === 'all' ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'bg-surface-900 text-surface-400'
              )}>All</button>
              {scenes.map((s) => (
                <button key={s.id} onClick={() => setFilterScene(s.id)} className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors',
                  filterScene === s.id ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'bg-surface-900 text-surface-400'
                )}>Sc. {s.scene_number || '?'}</button>
              ))}
            </div>
          )}

          {filteredShots.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl mb-3 block">{showCompleted ? '📷' : '🎉'}</span>
              <p className="text-surface-400">{showCompleted ? 'No shots yet' : 'All shots complete!'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredShots.map((shot) => {
                const scene = scenes.find((s) => s.id === shot.scene_id);
                return (
                  <div
                    key={shot.id}
                    className={cn(
                      'rounded-xl border p-3 transition-all',
                      shot.is_completed
                        ? 'bg-green-500/5 border-green-500/20 opacity-60'
                        : 'bg-surface-900 border-surface-800'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Big tap target - complete toggle */}
                      <button
                        onClick={() => toggleShotComplete(shot)}
                        disabled={!canEdit}
                        aria-label={`Mark shot ${shot.shot_number || ''} ${shot.is_completed ? 'incomplete' : 'complete'}`}
                        className={cn(
                          'w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all active:scale-95',
                          shot.is_completed
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                        )}
                      >
                        {shot.is_completed ? (
                          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <>
                            <span className="text-lg font-bold leading-none">{shot.shot_number || '•'}</span>
                            <span className="text-[9px] mt-0.5 opacity-60">TAP</span>
                          </>
                        )}
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge size="sm" variant="info">{shot.shot_type.replace('_', ' ')}</Badge>
                          <Badge size="sm">{shot.shot_movement.replace('_', ' ')}</Badge>
                          {shot.lens && <span className="text-[10px] text-surface-500">{shot.lens}</span>}
                        </div>
                        {shot.description && (
                          <p className="text-xs text-surface-400 mt-1 line-clamp-2">{shot.description}</p>
                        )}
                        {scene && (
                          <p className="text-[10px] text-surface-600 mt-1">
                            Scene {scene.scene_number} — {scene.location_name || scene.scene_heading}
                          </p>
                        )}
                      </div>

                      {/* Takes quick-tap */}
                      <button
                        onClick={() => incrementTakes(shot)}
                        disabled={!canEdit || shot.takes_completed >= shot.takes_needed}
                        aria-label={`Increment takes for shot ${shot.shot_number || ''} (${shot.takes_completed}/${shot.takes_needed})`}
                        className={cn(
                          'w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all active:scale-95',
                          shot.takes_completed >= shot.takes_needed
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                        )}
                      >
                        <span className="text-lg font-bold leading-none">{shot.takes_completed}</span>
                        <span className="text-[9px] mt-0.5 opacity-60">/{shot.takes_needed}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* === SCENES VIEW === */}
      {viewMode === 'scenes' && (
        <>
          {filteredScenes.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl mb-3 block">{showCompleted ? '🎬' : '🎉'}</span>
              <p className="text-surface-400">{showCompleted ? 'No scenes yet' : 'All scenes wrapped!'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredScenes.map((scene) => {
                const sceneShots = shots.filter(s => s.scene_id === scene.id);
                const sceneShotsComplete = sceneShots.filter(s => s.is_completed).length;
                return (
                  <div
                    key={scene.id}
                    className={cn(
                      'rounded-xl border p-3 transition-all',
                      scene.is_completed
                        ? 'bg-green-500/5 border-green-500/20 opacity-60'
                        : 'bg-surface-900 border-surface-800'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Big tap target */}
                      <button
                        onClick={() => toggleSceneComplete(scene)}
                        disabled={!canEdit}
                        aria-label={`${scene.is_completed ? 'Unwrap' : 'Wrap'} scene ${scene.scene_number || ''}`}
                        className={cn(
                          'w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all active:scale-95',
                          scene.is_completed
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                        )}
                      >
                        {scene.is_completed ? (
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <>
                            <span className="text-xl font-black leading-none">{scene.scene_number || '?'}</span>
                            <span className="text-[9px] mt-0.5 opacity-60">WRAP</span>
                          </>
                        )}
                      </button>

                      {/* Scene info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge size="sm" variant="info">{scene.location_type}</Badge>
                          <Badge size="sm">{scene.time_of_day}</Badge>
                        </div>
                        <p className="text-sm text-white font-medium mt-1 truncate">
                          {scene.scene_heading || scene.location_name || 'Untitled'}
                        </p>
                        {sceneShots.length > 0 && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-surface-800 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${sceneShotsComplete / sceneShots.length * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-surface-500 shrink-0">{sceneShotsComplete}/{sceneShots.length} shots</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-surface-600">
                          {scene.page_count > 0 && <span>{scene.page_count} pgs</span>}
                          {scene.cast_ids.length > 0 && <span>{scene.cast_ids.length} cast</span>}
                          {scene.estimated_duration_minutes && <span>~{scene.estimated_duration_minutes}m</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
