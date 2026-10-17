'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, EmptyState, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Scene } from '@/lib/types';
import { PageTitle } from '@/components/projects/PageTitle';
import { hasDrawing, type ShotWithStoryboard } from '@/components/storyboard/engine';
import { StoryboardThumb } from '@/components/storyboard/StoryboardThumb';

// The studio is large and only needed once someone starts drawing — load it on demand.
const loadStudio = () => import('@/components/storyboard/StoryboardSequenceStudio');
const StoryboardSequenceStudio = dynamic(() => loadStudio().then((m) => m.StoryboardSequenceStudio), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-y-0 right-0 left-0 md:left-[var(--sidebar-width,3.5rem)] z-30 flex items-center justify-center bg-surface-950">
      <LoadingSpinner />
    </div>
  ),
});

type ViewSize = 'sm' | 'md' | 'lg';

export default function StoryboardPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const canEdit = (members.find(m => m.user_id === user?.id)?.role || (currentProject?.created_by === user?.id ? 'owner' : 'viewer')) !== 'viewer';

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [shots, setShots] = useState<ShotWithStoryboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filterScene, setFilterScene] = useState('all');
  const [viewSize, setViewSize] = useState<ViewSize>('md');
  const [studioShotId, setStudioShotId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadError(false);
    try {
      const supabase = createClient();
      const [scenesRes, shotsRes] = await Promise.all([
        supabase.from('scenes').select('*').eq('project_id', params.id).order('sort_order'),
        supabase.from('shots').select('*').eq('project_id', params.id).order('sort_order'),
      ]);
      if (scenesRes.error || shotsRes.error) throw scenesRes.error || shotsRes.error;
      setScenes(scenesRes.data || []);
      setShots(
        (shotsRes.data || []).map((s: any) => ({
          ...s,
          storyboard_drawing: s.storyboard_drawing || [],
          storyboard_references: s.storyboard_references || [],
          storyboard_notes: s.storyboard_notes || '',
        }))
      );
    } catch (err) {
      console.error('Storyboard fetch:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openStudio = (shotId: string) => {
    if (!canEdit) return;
    setStudioShotId(shotId);
  };

  const patchShot = useCallback((shotId: string, patch: Partial<ShotWithStoryboard>) => {
    setShots(prev => prev.map(s => (s.id === shotId ? { ...s, ...patch } : s)));
  }, []);

  const sceneGroups = useMemo(() => {
    const filtered = filterScene === 'all' ? shots : shots.filter(s => s.scene_id === filterScene);
    if (filterScene !== 'all') {
      return [{ scene: scenes.find(s => s.id === filterScene) || null, shots: filtered }];
    }
    const grouped = new Map<string, ShotWithStoryboard[]>();
    const noScene: ShotWithStoryboard[] = [];
    for (const shot of filtered) {
      if (shot.scene_id) {
        if (!grouped.has(shot.scene_id)) grouped.set(shot.scene_id, []);
        grouped.get(shot.scene_id)!.push(shot);
      } else {
        noScene.push(shot);
      }
    }
    const groups: { scene: Scene | null; shots: ShotWithStoryboard[] }[] = [];
    for (const scene of scenes) {
      const g = grouped.get(scene.id);
      if (g?.length) groups.push({ scene, shots: g });
    }
    if (noScene.length) groups.push({ scene: null, shots: noScene });
    return groups;
  }, [shots, scenes, filterScene]);

  const withContent = useMemo(() => shots.filter(s => s.storyboard_url || hasDrawing(s.storyboard_drawing)).length, [shots]);

  const gridCols = viewSize === 'sm' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
    : viewSize === 'md' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-8 max-w-7xl" aria-busy>
        <div className="h-7 w-40 rounded-lg bg-surface-900 animate-pulse mb-2" />
        <div className="h-4 w-56 rounded bg-surface-900 animate-pulse mb-8" />
        <div className={cn('grid gap-2 sm:gap-3', gridCols)}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-800 overflow-hidden">
              <div className="aspect-video bg-surface-900 animate-pulse" />
              <div className="h-10 bg-surface-950" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <PageTitle>Storyboard</PageTitle>
          <p className="text-xs sm:text-sm text-surface-400 mt-1">
            {shots.length} shot{shots.length !== 1 ? 's' : ''} &middot; {withContent} with storyboard
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && shots.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onPointerEnter={() => void loadStudio()}
              onFocus={() => void loadStudio()}
              onClick={() => {
                const first = filterScene === 'all' ? shots[0] : shots.find(s => s.scene_id === filterScene) || shots[0];
                openStudio(first.id);
              }}
              className="gap-1.5 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
              </svg>
              Open Sequence Studio
            </Button>
          )}
          <div className="flex bg-surface-900 rounded-lg p-0.5" role="group" aria-label="Card size">
            {(['sm', 'md', 'lg'] as const).map(s => (
              <button key={s} type="button" onClick={() => setViewSize(s)} aria-pressed={viewSize === s} className={cn('px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors', viewSize === s ? 'bg-surface-700 text-white' : 'text-surface-500 hover:text-white')}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scene filter tabs */}
      {scenes.length > 0 && (
        <div className="flex gap-1.5 sm:gap-2 mb-5 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          <button onClick={() => setFilterScene('all')} className={cn('px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0', filterScene === 'all' ? 'bg-brand-600/20 text-brand-500' : 'text-surface-400 hover:text-white hover:bg-surface-900/5')}>
            All Scenes
          </button>
          {scenes.map(s => (
            <button key={s.id} onClick={() => setFilterScene(s.id)} className={cn('px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0', filterScene === s.id ? 'bg-brand-600/20 text-brand-500' : 'text-surface-400 hover:text-white hover:bg-surface-900/5')}>
              Scene {s.scene_number || '?'}
            </button>
          ))}
        </div>
      )}

      {loadError && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>Couldn&rsquo;t load the storyboard.</span>
          <Button size="sm" variant="secondary" onClick={() => { setLoading(true); fetchData(); }}>Retry</Button>
        </div>
      )}

      {!loadError && shots.length === 0 && (
        <EmptyState
          title="No shots yet"
          description="Create shots in the Shot List to build your storyboard. Each shot can have a storyboard drawing or image."
        />
      )}

      {sceneGroups.map((group, gi) => (
        <section key={group.scene?.id || `unassigned-${gi}`} className="mb-6 sm:mb-8">
          {group.scene ? (
            <div className="flex items-center gap-2 sm:gap-3 mb-3">
              <span className="text-xs sm:text-sm font-bold text-surface-300 shrink-0">Scene {group.scene.scene_number}</span>
              <Badge size="sm" variant="info">{group.scene.location_type}</Badge>
              <span className="text-xs text-surface-500 hidden sm:inline truncate">{group.scene.location_name}</span>
              <div className="flex-1 border-t border-surface-800" />
            </div>
          ) : group.shots.length > 0 && (
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs sm:text-sm text-surface-500">Unassigned Shots</span>
              <div className="flex-1 border-t border-surface-800" />
            </div>
          )}

          <div className={cn('grid gap-2 sm:gap-3', gridCols)}>
            {group.shots.map((shot) => {
              const filled = !!shot.storyboard_url || hasDrawing(shot.storyboard_drawing);
              const Card = canEdit ? 'button' : 'div';
              return (
                <Card
                  key={shot.id}
                  {...(canEdit ? { type: 'button' as const, onClick: () => openStudio(shot.id), onPointerEnter: () => void loadStudio() } : {})}
                  className={cn(
                    'group block w-full text-left rounded-xl border overflow-hidden transition-colors',
                    canEdit && 'cursor-pointer hover:border-surface-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    filled ? 'border-surface-700' : 'border-dashed border-surface-800'
                  )}
                >
                  <div className="relative">
                    <StoryboardThumb
                      drawing={shot.storyboard_drawing}
                      imageUrl={shot.storyboard_url}
                      alt={`Shot ${shot.shot_number || ''}`}
                      emptyLabel={viewSize === 'sm' ? '' : canEdit ? 'Tap to draw' : 'No storyboard'}
                    />
                    {canEdit && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-white">
                        {filled ? 'Edit frame' : 'Draw frame'}
                      </span>
                    )}
                  </div>
                  <div className="p-2 bg-surface-950">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-bold text-surface-500 shrink-0">{shot.shot_number || '#'}</span>
                      <Badge size="sm" variant="info" className="text-[11px] capitalize">{(shot.shot_type || '').replace(/_/g, ' ')}</Badge>
                      <Badge size="sm" className="text-[11px] capitalize">{(shot.shot_movement || '').replace(/_/g, ' ')}</Badge>
                    </div>
                    {shot.description && viewSize !== 'sm' && (
                      <p className="text-[11px] text-surface-500 mt-1 line-clamp-1">{shot.description}</p>
                    )}
                    {shot.storyboard_notes && viewSize !== 'sm' && (
                      <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-1 italic">{shot.storyboard_notes}</p>
                    )}
                    {(shot.storyboard_references?.length || 0) > 0 && viewSize !== 'sm' && (
                      <div className="flex items-center gap-1 mt-1">
                        <svg className="w-3 h-3 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                        </svg>
                        <span className="text-[11px] text-surface-500">{shot.storyboard_references!.length} ref{shot.storyboard_references!.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      {studioShotId && (
        <StoryboardSequenceStudio
          isOpen
          onClose={() => setStudioShotId(null)}
          projectId={params.id}
          initialShotId={studioShotId}
          scenes={scenes}
          allShots={shots}
          onShotPatched={patchShot}
        />
      )}
    </div>
  );
}
