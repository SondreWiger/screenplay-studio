'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, EmptyState, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Shot, Scene } from '@/lib/types';
import { PageTitle } from '@/components/projects/PageTitle';
import { StoryboardSequenceStudio, flattenLayersToStrokes } from '@/components/storyboard/StoryboardSequenceStudio';

// Types
interface Point {
  x: number;
  y: number;
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  tool: 'pen' | 'marker' | 'eraser';
  pressureSensitive?: boolean;
}

interface ReferenceImage {
  url: string;
  label?: string;
}

// Extended Shot with storyboard data
interface ShotWithStoryboard extends Shot {
  storyboard_drawing?: Stroke[];
  storyboard_references?: ReferenceImage[];
  storyboard_notes?: string;
}

// Drawing Utilities & Canvas Helpers
function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#')) return hex;
  const h = hex.replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

function getPressureWidth(baseWidth: number, pressure = 0.5, isPressureSensitive = true): number {
  if (!isPressureSensitive) return baseWidth;
  // Natural response curve for Apple Pencil pressure digitizer
  const p = Math.max(0.04, Math.min(1, pressure));
  const factor = 0.28 + 1.25 * Math.pow(p, 0.85);
  return Math.max(1, baseWidth * factor);
}

function renderStrokes(
  ctx: CanvasRenderingContext2D,
  allStrokes: Stroke[],
  targetWidth: number,
  targetHeight: number,
  baseWidth = 640,
  baseHeight = 360,
  options?: {
    showGrid?: boolean;
    dpr?: number;
  }
) {
  const dpr = options?.dpr ?? 1;
  ctx.save();
  ctx.clearRect(0, 0, targetWidth * dpr, targetHeight * dpr);
  ctx.scale((targetWidth / baseWidth) * dpr, (targetHeight / baseHeight) * dpr);

  // Cinematic Rule of Thirds & Center Framing Grid
  if (options?.showGrid) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < baseWidth; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, baseHeight); ctx.stroke();
    }
    for (let y = 0; y < baseHeight; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(baseWidth, y); ctx.stroke();
    }

    // Rule of Thirds
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(0, baseHeight / 3); ctx.lineTo(baseWidth, baseHeight / 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, (baseHeight * 2) / 3); ctx.lineTo(baseWidth, (baseHeight * 2) / 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(baseWidth / 3, 0); ctx.lineTo(baseWidth / 3, baseHeight); ctx.stroke();
    ctx.beginPath(); ctx.moveTo((baseWidth * 2) / 3, 0); ctx.lineTo((baseWidth * 2) / 3, baseHeight); ctx.stroke();

    // Center crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(baseWidth / 2, 0); ctx.lineTo(baseWidth / 2, baseHeight); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, baseHeight / 2); ctx.lineTo(baseWidth, baseHeight / 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw strokes
  for (const stroke of allStrokes) {
    if (!stroke.points || stroke.points.length === 0) continue;

    const isEraser = stroke.tool === 'eraser';
    const isMarker = stroke.tool === 'marker';

    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const strokeColor = isEraser
      ? 'rgba(0,0,0,1)'
      : isMarker
      ? hexToRgba(stroke.color, 0.35)
      : stroke.color;

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;

    // Single point (tap, dot, stipple)
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      const pr = p.pressure ?? 0.5;
      const width = isEraser
        ? stroke.width
        : getPressureWidth(stroke.width, pr, stroke.pressureSensitive !== false);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, width / 2), 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    // Multi-point stroke
    const hasPressureVariation =
      stroke.pressureSensitive !== false &&
      !isEraser &&
      stroke.points.some(pt => pt.pressure !== undefined && Math.abs(pt.pressure - 0.5) > 0.04);

    if (hasPressureVariation) {
      // Dynamic pressure line segments
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const p1 = stroke.points[i];
        const p2 = stroke.points[i + 1];
        const pr = ((p1.pressure ?? 0.5) + (p2.pressure ?? 0.5)) / 2;
        ctx.lineWidth = getPressureWidth(stroke.width, pr, true);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    } else {
      // Smooth vector-like line using quadratic Bezier curve
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      if (stroke.points.length > 2) {
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
          const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
        }
        const last = stroke.points[stroke.points.length - 1];
        const prev = stroke.points[stroke.points.length - 2];
        ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
      } else {
        ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

// Shot Thumbnail
function ShotThumbnail({ shot, size }: { shot: ShotWithStoryboard; size: 'sm' | 'md' | 'lg' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 320;
  const H = 180;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const drawing = shot.storyboard_drawing;
    let strokesToRender: any[] = [];
    if (Array.isArray(drawing) && drawing.length > 0) {
      if ('strokes' in drawing[0]) {
        strokesToRender = flattenLayersToStrokes(drawing as any);
      } else {
        strokesToRender = drawing;
      }
    }
    renderStrokes(ctx, strokesToRender, W, H, 640, 360, { showGrid: false });
  }, [shot.storyboard_drawing]);

  const h = size === 'sm' ? 'h-20' : size === 'md' ? 'h-32' : 'h-44';

  // Show storyboard_url image
  if (shot.storyboard_url) return (
    <div className={cn('relative bg-surface-900 flex items-center justify-center', h)}>
      <img src={shot.storyboard_url} alt={`Shot ${shot.shot_number}`} className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );

  // Show drawing
  const hasDrawing = Array.isArray(shot.storyboard_drawing) && shot.storyboard_drawing.length > 0;
  if (hasDrawing) return (
    <div className={cn('relative bg-surface-900', h)}>
      <canvas ref={canvasRef} width={W} height={H} className="w-full h-full" />
    </div>
  );

  // Empty placeholder
  return (
    <div className={cn('relative bg-surface-900 flex items-center justify-center', h)}>
      <div className="text-center text-surface-700">
        <svg className="w-7 h-7 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {size !== 'sm' && <p className="text-[11px] mt-1">No storyboard</p>}
      </div>
    </div>
  );
}

// Main
export default function StoryboardPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const canEdit = (members.find(m => m.user_id === user?.id)?.role || (currentProject?.created_by === user?.id ? 'owner' : 'viewer')) !== 'viewer';

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [shots, setShots] = useState<ShotWithStoryboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterScene, setFilterScene] = useState('all');
  const [viewSize, setViewSize] = useState<'sm' | 'md' | 'lg'>('md');

  // Editor state
  const [editShot, setEditShot] = useState<ShotWithStoryboard | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  useEffect(() => { fetchData(); }, [params.id]);

  const fetchData = async () => {
    try {
      const supabase = createClient();
      const [scenesRes, shotsRes] = await Promise.all([
        supabase.from('scenes').select('*').eq('project_id', params.id).order('sort_order'),
        supabase.from('shots').select('*').eq('project_id', params.id).order('sort_order'),
      ]);
      setScenes(scenesRes.data || []);
      // Parse storyboard_drawing from JSON if stored
      const shotsData = (shotsRes.data || []).map((s: any) => ({
        ...s,
        storyboard_drawing: s.storyboard_drawing || [],
        storyboard_references: s.storyboard_references || [],
        storyboard_notes: s.storyboard_notes || '',
      }));
      setShots(shotsData);
    } catch (err) { 
      console.error('Storyboard fetch:', err); 
    } finally { 
      setLoading(false); 
    }
  };

  const openEditor = (shot: ShotWithStoryboard) => {
    setEditShot(shot);
    setIsStudioOpen(true);
  };

  // Filter shots by scene
  const filteredShots = filterScene === 'all' ? shots : shots.filter(s => s.scene_id === filterScene);
  
  // Group shots by scene
  const sceneGroups: { scene: Scene | null; shots: ShotWithStoryboard[] }[] = [];
  if (filterScene === 'all') {
    const grouped = new Map<string, ShotWithStoryboard[]>();
    const noScene: ShotWithStoryboard[] = [];
    
    filteredShots.forEach(shot => {
      if (shot.scene_id) {
        if (!grouped.has(shot.scene_id)) grouped.set(shot.scene_id, []);
        grouped.get(shot.scene_id)!.push(shot);
      } else {
        noScene.push(shot);
      }
    });
    
    scenes.forEach(scene => {
      const g = grouped.get(scene.id);
      if (g && g.length > 0) sceneGroups.push({ scene, shots: g });
    });
    
    if (noScene.length) sceneGroups.push({ scene: null, shots: noScene });
  } else {
    sceneGroups.push({ 
      scene: scenes.find(s => s.id === filterScene) || null, 
      shots: filteredShots 
    });
  }

  const gridCols = viewSize === 'sm' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
    : viewSize === 'md' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  const withContent = shots.filter(s => s.storyboard_url || s.storyboard_drawing?.length).length;

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                onClick={() => {
                  setEditShot(shots[0] || null);
                  setIsStudioOpen(true);
                }}
                className="gap-1.5 shadow-sm"
              >
                <span>🎬</span>
                <span>Open Sequence Studio</span>
              </Button>
            )}
            <div className="flex bg-surface-900 rounded-lg p-0.5">
              {(['sm', 'md', 'lg'] as const).map(s => (
                <button key={s} onClick={() => setViewSize(s)} className={cn('px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors', viewSize === s ? 'bg-surface-700 text-white' : 'text-surface-500 hover:text-white')}>
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
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

      {/* Empty state */}
      {shots.length === 0 && (
        <EmptyState 
          title="No shots yet" 
          description="Create shots in the Shot List to build your storyboard. Each shot can have a storyboard drawing or image."
        />
      )}

      {/* Shot groups by scene */}
      {sceneGroups.map((group, gi) => (
        <div key={gi} className="mb-6 sm:mb-8">
          {/* Scene header */}
          {group.scene && (
            <div className="flex items-center gap-2 sm:gap-3 mb-3">
              <span className="text-xs sm:text-sm font-bold text-surface-300 shrink-0">
                Scene {group.scene.scene_number}
              </span>
              <Badge size="sm" variant="info">{group.scene.location_type}</Badge>
              <span className="text-xs text-surface-500 hidden sm:inline truncate">{group.scene.location_name}</span>
              <div className="flex-1 border-t border-surface-800" />
            </div>
          )}
          {!group.scene && group.shots.length > 0 && (
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs sm:text-sm text-surface-500">Unassigned Shots</span>
              <div className="flex-1 border-t border-surface-800" />
            </div>
          )}
          
          {/* Shot grid */}
          <div className={cn('grid gap-2 sm:gap-3', gridCols)}>
            {group.shots.map((shot) => (
              <div 
                key={shot.id} 
                onClick={() => canEdit && openEditor(shot)}
                className={cn(
                  'group rounded-xl border overflow-hidden transition-colors',
                  canEdit && 'cursor-pointer hover:border-surface-600',
                  (shot.storyboard_url || shot.storyboard_drawing?.length) ? 'border-surface-700' : 'border-dashed border-surface-800'
                )}
              >
                <ShotThumbnail shot={shot} size={viewSize} />
                <div className="p-2 bg-surface-950">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-surface-500 shrink-0">
                      {shot.shot_number || '#'}
                    </span>
                    <Badge size="sm" variant="info" className="text-[11px]">{shot.shot_type.replace('_', ' ')}</Badge>
                    <Badge size="sm" className="text-[11px]">{shot.shot_movement.replace('_', ' ')}</Badge>
                  </div>
                  {shot.description && viewSize !== 'sm' && (
                    <p className="text-[11px] text-surface-500 mt-1 line-clamp-1">{shot.description}</p>
                  )}
                  {shot.storyboard_notes && viewSize !== 'sm' && (
                    <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-1 italic">{shot.storyboard_notes}</p>
                  )}
                  {(shot.storyboard_references?.length || 0) > 0 && viewSize !== 'sm' && (
                    <div className="flex items-center gap-1 mt-1">
                      <svg className="w-3 h-3 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                      </svg>
                      <span className="text-[11px] text-surface-500">{shot.storyboard_references!.length} ref{shot.storyboard_references!.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Storyboard Sequence Studio ────────────────────────── */}
      {isStudioOpen && (
        <StoryboardSequenceStudio
          isOpen={isStudioOpen}
          onClose={() => {
            setIsStudioOpen(false);
            setEditShot(null);
          }}
          projectId={params.id}
          initialShotId={editShot?.id}
          scenes={scenes}
          allShots={shots}
          onShotsUpdated={(updated) => setShots(updated)}
        />
      )}
    </div>
  );
}
