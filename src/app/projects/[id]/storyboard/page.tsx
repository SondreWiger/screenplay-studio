'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Shot, Scene } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────
interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
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

// ── Drawing Canvas Component ──────────────────────────────────
function DrawingCanvas({
  strokes, onChange, width, height, tool, color, brushSize, readOnly,
}: {
  strokes: Stroke[]; onChange: (s: Stroke[]) => void;
  width: number; height: number; tool: 'pen' | 'eraser';
  color: string; brushSize: number; readOnly?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const currentStroke = useRef<Stroke | null>(null);

  const redraw = useCallback((ctx: CanvasRenderingContext2D, allStrokes: Stroke[]) => {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
    ctx.setLineDash([]);
    allStrokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    redraw(ctx, strokes);
  }, [strokes, redraw]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width; const scaleY = height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return; e.preventDefault();
    currentStroke.current = { points: [getPos(e)], color, width: brushSize, tool };
    setDrawing(true);
  };
  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !currentStroke.current || readOnly) return; e.preventDefault();
    currentStroke.current.points.push(getPos(e));
    const ctx = canvasRef.current?.getContext('2d'); if (ctx) redraw(ctx, [...strokes, currentStroke.current]);
  };
  const endDraw = () => {
    if (!drawing || !currentStroke.current) return;
    if (currentStroke.current.points.length > 1) onChange([...strokes, currentStroke.current]);
    currentStroke.current = null; setDrawing(false);
  };

  return (
    <canvas ref={canvasRef} width={width} height={height}
      className="w-full rounded-lg bg-surface-900 border border-surface-700 touch-none"
      style={{ aspectRatio: `${width}/${height}` }}
      onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
      onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw} />
  );
}

// ── Shot Thumbnail ────────────────────────────────────────────
function ShotThumbnail({ shot, size }: { shot: ShotWithStoryboard; size: 'sm' | 'md' | 'lg' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 320; const H = 180;
  
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    (shot.storyboard_drawing || []).forEach((s: Stroke) => {
      if (s.points.length < 2) return;
      ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';
  }, [shot.storyboard_drawing]);

  const h = size === 'sm' ? 'h-20' : size === 'md' ? 'h-32' : 'h-44';

  // Show storyboard_url image
  if (shot.storyboard_url) return (
    <div className={cn('relative bg-surface-900 flex items-center justify-center', h)}>
      <img src={shot.storyboard_url} alt={`Shot ${shot.shot_number}`} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );
  
  // Show drawing
  if ((shot.storyboard_drawing || []).length > 0) return (
    <div className={cn('relative bg-surface-900', h)}><canvas ref={canvasRef} width={W} height={H} className="w-full h-full" /></div>
  );
  
  // Empty placeholder
  return (
    <div className={cn('relative bg-surface-900 flex items-center justify-center', h)}>
      <div className="text-center text-surface-700">
        <svg className="w-7 h-7 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {size !== 'sm' && <p className="text-[10px] mt-1">No storyboard</p>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
const DRAW_COLORS = ['#ffffff', '#dd574e', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#64748b'];

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
  const [drawStrokes, setDrawStrokes] = useState<Stroke[]>([]);
  const [drawTool, setDrawTool] = useState<'pen' | 'eraser'>('pen');
  const [drawColor, setDrawColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(3);
  const [imageUrl, setImageUrl] = useState('');
  const [storyboardNotes, setStoryboardNotes] = useState('');
  const [refImages, setRefImages] = useState<ReferenceImage[]>([]);
  const [newRefUrl, setNewRefUrl] = useState('');
  const [newRefLabel, setNewRefLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<'draw' | 'image' | 'refs' | 'details'>('draw');

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
    setDrawStrokes(shot.storyboard_drawing || []);
    setImageUrl(shot.storyboard_url || '');
    setStoryboardNotes(shot.storyboard_notes || '');
    setRefImages(shot.storyboard_references || []);
    setEditorTab(shot.storyboard_drawing?.length ? 'draw' : shot.storyboard_url ? 'image' : 'draw');
  };

  const handleSave = async () => {
    if (!editShot) return;
    setSaving(true);
    const supabase = createClient();
    
    const payload = {
      storyboard_url: imageUrl || null,
      storyboard_drawing: drawStrokes,
      storyboard_references: refImages,
      storyboard_notes: storyboardNotes || null,
    };
    
    await supabase.from('shots').update(payload).eq('id', editShot.id);
    
    // Update local state with proper type handling
    setShots(shots.map(s => s.id === editShot.id ? { 
      ...s, 
      storyboard_url: payload.storyboard_url,
      storyboard_drawing: payload.storyboard_drawing,
      storyboard_references: payload.storyboard_references,
      storyboard_notes: payload.storyboard_notes || undefined,
    } : s));
    setSaving(false);
    setEditShot(null);
  };

  const addRefImage = () => {
    if (!newRefUrl.trim()) return;
    setRefImages([...refImages, { url: newRefUrl.trim(), label: newRefLabel.trim() || undefined }]);
    setNewRefUrl('');
    setNewRefLabel('');
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
            <h1 className="text-xl sm:text-2xl font-black text-white">Storyboard</h1>
            <p className="text-xs sm:text-sm text-surface-400 mt-1">
              {shots.length} shot{shots.length !== 1 ? 's' : ''} &middot; {withContent} with storyboard
            </p>
          </div>
          <div className="flex items-center gap-2">
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
          <button onClick={() => setFilterScene('all')} className={cn('px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0', filterScene === 'all' ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'text-surface-400 hover:text-white hover:bg-surface-900/5')}>
            All Scenes
          </button>
          {scenes.map(s => (
            <button key={s.id} onClick={() => setFilterScene(s.id)} className={cn('px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0', filterScene === s.id ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'text-surface-400 hover:text-white hover:bg-surface-900/5')}>
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
                  'group rounded-xl border overflow-hidden transition-all',
                  canEdit && 'cursor-pointer hover:border-surface-600',
                  (shot.storyboard_url || shot.storyboard_drawing?.length) ? 'border-surface-700' : 'border-dashed border-surface-800'
                )}
              >
                <ShotThumbnail shot={shot} size={viewSize} />
                <div className="p-2 bg-surface-950">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold text-surface-500 shrink-0">
                      {shot.shot_number || '#'}
                    </span>
                    <Badge size="sm" variant="info" className="text-[9px]">{shot.shot_type.replace('_', ' ')}</Badge>
                    <Badge size="sm" className="text-[9px]">{shot.shot_movement.replace('_', ' ')}</Badge>
                  </div>
                  {shot.description && viewSize !== 'sm' && (
                    <p className="text-[10px] text-surface-500 mt-1 line-clamp-1">{shot.description}</p>
                  )}
                  {shot.storyboard_notes && viewSize !== 'sm' && (
                    <p className="text-[10px] text-surface-600 mt-0.5 line-clamp-1 italic">{shot.storyboard_notes}</p>
                  )}
                  {(shot.storyboard_references?.length || 0) > 0 && viewSize !== 'sm' && (
                    <div className="flex items-center gap-1 mt-1">
                      <svg className="w-3 h-3 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                      </svg>
                      <span className="text-[9px] text-surface-600">{shot.storyboard_references!.length} ref{shot.storyboard_references!.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Storyboard Editor Modal ────────────────────────── */}
      {editShot !== null && (
        <Modal isOpen onClose={() => setEditShot(null)} title={`Storyboard: Shot ${editShot.shot_number || '#'}`} size="lg">
          {/* Shot info banner */}
          <div className="bg-surface-900/50 rounded-lg p-3 mb-4 border border-surface-800">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="info">{editShot.shot_type.replace('_', ' ')}</Badge>
              <Badge>{editShot.shot_movement.replace('_', ' ')}</Badge>
              {editShot.lens && <Badge>{editShot.lens}</Badge>}
              {editShot.duration_seconds && <span className="text-xs text-surface-500">{editShot.duration_seconds}s</span>}
            </div>
            {editShot.description && <p className="text-xs text-surface-400 mt-2">{editShot.description}</p>}
          </div>

          {/* Editor tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
            {(['draw', 'image', 'refs', 'details'] as const).map(t => (
              <button key={t} onClick={() => setEditorTab(t)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0', editorTab === t ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'text-surface-400 hover:text-white hover:bg-surface-900/5')}>
                {t === 'draw' ? '✏️ Draw' : t === 'image' ? '🖼️ Image' : t === 'refs' ? '📎 Refs' : '📝 Notes'}
              </button>
            ))}
          </div>

          {/* Draw tab */}
          {editorTab === 'draw' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button onClick={() => setDrawTool('pen')} className={cn('p-1.5 sm:p-2 rounded-lg transition-colors', drawTool === 'pen' ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'text-surface-400 hover:text-white hover:bg-surface-900/5')} title="Pen">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button onClick={() => setDrawTool('eraser')} className={cn('p-1.5 sm:p-2 rounded-lg transition-colors', drawTool === 'eraser' ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'text-surface-400 hover:text-white hover:bg-surface-900/5')} title="Eraser">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                <div className="h-5 w-px bg-surface-700 hidden sm:block" />
                <div className="flex flex-wrap gap-1">
                  {DRAW_COLORS.map(c => (
                    <button key={c} onClick={() => { setDrawColor(c); setDrawTool('pen'); }}
                      className={cn('w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-transform', drawColor === c && drawTool === 'pen' ? 'border-white scale-110' : 'border-surface-700 hover:scale-105')}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="h-5 w-px bg-surface-700 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                  <input type="range" min={1} max={20} value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-14 sm:w-20 accent-brand-500" />
                  <span className="text-[10px] text-surface-400 w-4">{brushSize}</span>
                </div>
                <button onClick={() => setDrawStrokes(drawStrokes.slice(0, -1))} disabled={!drawStrokes.length} className="p-1.5 rounded-lg text-surface-400 hover:text-white disabled:opacity-30" title="Undo">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                </button>
                <button onClick={() => setDrawStrokes([])} disabled={!drawStrokes.length} className="p-1.5 rounded-lg text-surface-400 hover:text-white disabled:opacity-30" title="Clear">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              <DrawingCanvas strokes={drawStrokes} onChange={setDrawStrokes} width={640} height={360} tool={drawTool} color={drawColor} brushSize={brushSize} />
              <p className="text-[10px] text-surface-600">Draw directly on the canvas. Touch or mouse. 16:9 ratio.</p>
            </div>
          )}

          {/* Image tab */}
          {editorTab === 'image' && (
            <div className="space-y-4">
              {imageUrl && (
                <div className="rounded-lg overflow-hidden border border-surface-700 bg-surface-900">
                  <img src={imageUrl} alt="Storyboard" className="w-full max-h-64 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <Input label="Image URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
              <p className="text-[11px] text-surface-500 -mt-2">Paste any direct image link — sketches, AI frames, photos.</p>
              {imageUrl && <Button variant="ghost" size="sm" onClick={() => setImageUrl('')}>Remove Image</Button>}
            </div>
          )}

          {/* Refs tab */}
          {editorTab === 'refs' && (
            <div className="space-y-4">
              <p className="text-xs text-surface-400">Add reference images — mood, location photos, character refs.</p>
              {refImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {refImages.map((ref, i) => (
                    <div key={i} className="group relative rounded-lg overflow-hidden border border-surface-700 bg-surface-900">
                      <img src={ref.url} alt={ref.label || `Ref ${i+1}`} className="w-full h-20 sm:h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => setRefImages(refImages.filter((_,idx) => idx !== i))} className="p-1.5 bg-red-600 rounded-full text-white">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      {ref.label && <p className="absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] text-white px-2 py-1 truncate">{ref.label}</p>}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input placeholder="Image URL" value={newRefUrl} onChange={e => setNewRefUrl(e.target.value)} className="flex-1" />
                <Input placeholder="Label (opt)" value={newRefLabel} onChange={e => setNewRefLabel(e.target.value)} className="sm:w-32" />
                <Button onClick={addRefImage} disabled={!newRefUrl.trim()} size="sm" className="shrink-0">Add</Button>
              </div>
            </div>
          )}

          {/* Notes tab */}
          {editorTab === 'details' && (
            <div className="space-y-4">
              <Textarea 
                label="Storyboard Notes" 
                value={storyboardNotes} 
                onChange={e => setStoryboardNotes(e.target.value)} 
                placeholder="Describe the visual composition, action, framing details..."
                rows={4}
              />
              <p className="text-[11px] text-surface-500 -mt-2">Add notes specific to this storyboard frame. Shot details are edited in the Shot List.</p>
            </div>
          )}

          {/* Modal footer */}
          <div className="flex flex-col-reverse sm:flex-row justify-end pt-5 mt-5 border-t border-surface-800 gap-3">
            <Button variant="ghost" onClick={() => setEditShot(null)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Storyboard</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
