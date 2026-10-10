'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Shot, Scene } from '@/lib/types';
import { PageTitle } from '@/components/projects/PageTitle';

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

// Drawing Canvas Component with Full Apple Pencil & iPad Support
function DrawingCanvas({
  strokes,
  onChange,
  width,
  height,
  tool,
  color,
  brushSize,
  readOnly,
  pressureSensitive = true,
  palmRejectionMode = 'auto',
  showGrid = true,
  onApplePencilDetected,
  onLivePressureChange,
}: {
  strokes: Stroke[];
  onChange: (s: Stroke[]) => void;
  width: number;
  height: number;
  tool: 'pen' | 'marker' | 'eraser';
  color: string;
  brushSize: number;
  readOnly?: boolean;
  pressureSensitive?: boolean;
  palmRejectionMode: 'auto' | 'pencil-only' | 'all';
  showGrid: boolean;
  onApplePencilDetected?: () => void;
  onLivePressureChange?: (pressure: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverPos, setHoverPos] = useState<Point | null>(null);

  const currentStroke = useRef<Stroke | null>(null);
  const activePointerId = useRef<number | null>(null);
  const isPencilDrawing = useRef(false);
  const lastPencilTime = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Retina scaling on iPad
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDpr(Math.min(window.devicePixelRatio || 1, 3));
    }
  }, []);

  // Redraw whenever strokes, size, or grid change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderStrokes(ctx, strokes, width, height, width, height, { showGrid, dpr });
  }, [strokes, width, height, showGrid, dpr]);

  // Map pointer client coordinates to canvas 640x360 logical coordinates
  const getPos = useCallback((e: PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const x = Math.max(0, Math.min(width, (e.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(height, (e.clientY - rect.top) * scaleY));

    // Normalize pressure: Apple Pencil sends analog values (0.01 - 1.0)
    let pressure = 0.5;
    if (typeof e.pressure === 'number' && e.pressure > 0) {
      pressure = e.pressure;
    }

    return {
      x,
      y,
      pressure,
      tiltX: e.tiltX,
      tiltY: e.tiltY,
    };
  }, [width, height]);

  // Native Pointer Event handling for Apple Pencil on iPad Safari
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || readOnly) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Primary button only
      if (e.button !== 0 && e.buttons !== 1) return;

      const isPen = e.pointerType === 'pen';

      // 1. Detect Apple Pencil
      if (isPen) {
        lastPencilTime.current = Date.now();
        isPencilDrawing.current = true;
        onApplePencilDetected?.();
        onLivePressureChange?.(e.pressure || 0.5);
      }

      // 2. Palm Rejection
      if (palmRejectionMode === 'pencil-only' && !isPen) {
        // Strict Apple Pencil mode: ignore all finger & palm touches
        return;
      }

      if (palmRejectionMode === 'auto') {
        // If Apple Pencil is currently drawing or was recently active, ignore touch
        if (!isPen && (isPencilDrawing.current || Date.now() - lastPencilTime.current < 1200)) {
          return;
        }
        // Palm contact rejection: palm touches have wide contact radius
        if (!isPen && (e.width > 22 || e.height > 22)) {
          return;
        }
      }

      // If another pointer is already actively drawing, ignore
      if (activePointerId.current !== null) return;

      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}

      activePointerId.current = e.pointerId;

      const pt = getPos(e);
      currentStroke.current = {
        points: [pt],
        color,
        width: brushSize,
        tool,
        pressureSensitive,
      };

      // Render dot/initial stroke
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderStrokes(ctx, [...strokes, currentStroke.current], width, height, width, height, { showGrid, dpr });
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const isPen = e.pointerType === 'pen';

      // Apple Pencil Hover (iPad Pro M2/M4)
      if (e.buttons === 0) {
        if (isPen) {
          onApplePencilDetected?.();
          setHoverPos(getPos(e));
        } else {
          setHoverPos(null);
        }
        return;
      }

      if (activePointerId.current !== e.pointerId || !currentStroke.current) return;
      e.preventDefault();

      if (isPen) {
        lastPencilTime.current = Date.now();
        onLivePressureChange?.(e.pressure || 0.5);
      }

      // Use coalesced events to capture 120Hz-240Hz Apple Pencil digitizer sampling
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      for (const cev of events) {
        const pt = getPos(cev);
        currentStroke.current.points.push(pt);
      }

      // Redraw via requestAnimationFrame for 120fps smoothness
      if (animFrameRef.current === null) {
        animFrameRef.current = requestAnimationFrame(() => {
          animFrameRef.current = null;
          const ctx = canvas.getContext('2d');
          if (ctx && currentStroke.current) {
            renderStrokes(ctx, [...strokes, currentStroke.current], width, height, width, height, { showGrid, dpr });
          }
        });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      e.preventDefault();

      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}

      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      activePointerId.current = null;
      isPencilDrawing.current = false;
      onLivePressureChange?.(0);

      if (currentStroke.current && currentStroke.current.points.length > 0) {
        onChange([...strokes, currentStroke.current]);
      }
      currentStroke.current = null;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderStrokes(ctx, strokes, width, height, width, height, { showGrid, dpr });
      }
    };

    const handlePointerCancel = (e: PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}

      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      activePointerId.current = null;
      isPencilDrawing.current = false;
      currentStroke.current = null;
      onLivePressureChange?.(0);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderStrokes(ctx, strokes, width, height, width, height, { showGrid, dpr });
      }
    };

    const handlePointerLeave = () => {
      setHoverPos(null);
    };

    // Non-passive touch listener prevents iOS Safari gestures (scroll, swipe, bounce) on the canvas
    const handleTouch = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };

    canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
    canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
    canvas.addEventListener('pointercancel', handlePointerCancel, { passive: false });
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouch);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    readOnly,
    palmRejectionMode,
    pressureSensitive,
    brushSize,
    color,
    tool,
    strokes,
    width,
    height,
    showGrid,
    dpr,
    getPos,
    onChange,
    onApplePencilDetected,
    onLivePressureChange,
  ]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-surface-950 border border-surface-700 shadow-inner select-none touch-none"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        width={width * dpr}
        height={height * dpr}
        className="w-full h-auto block select-none touch-none cursor-crosshair"
        style={{
          aspectRatio: `${width}/${height}`,
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
        }}
      />

      {/* Apple Pencil Hover Reticle (iPad Pro M2/M4) */}
      {hoverPos && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/20 shadow-sm transition-transform"
          style={{
            left: `${(hoverPos.x / width) * 100}%`,
            top: `${(hoverPos.y / height) * 100}%`,
            width: `${Math.max(4, tool === 'eraser' ? brushSize : getPressureWidth(brushSize, hoverPos.pressure || 0.5, pressureSensitive))}px`,
            height: `${Math.max(4, tool === 'eraser' ? brushSize : getPressureWidth(brushSize, hoverPos.pressure || 0.5, pressureSensitive))}px`,
            borderColor: tool === 'eraser' ? '#ffffff' : color,
          }}
        />
      )}
    </div>
  );
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
    renderStrokes(ctx, shot.storyboard_drawing || [], W, H, 640, 360, { showGrid: false });
  }, [shot.storyboard_drawing]);

  const h = size === 'sm' ? 'h-20' : size === 'md' ? 'h-32' : 'h-44';

  // Show storyboard_url image
  if (shot.storyboard_url) return (
    <div className={cn('relative bg-surface-900 flex items-center justify-center', h)}>
      <img src={shot.storyboard_url} alt={`Shot ${shot.shot_number}`} className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );

  // Show drawing
  if ((shot.storyboard_drawing || []).length > 0) return (
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
const DRAW_COLORS = [
  '#ffffff', // Chalk White
  '#1e293b', // Ink Black
  '#ef4444', // Action Red
  '#3b82f6', // Camera Blue
  '#f59e0b', // Key Light Amber
  '#10b981', // Practical Green
  '#a855f7', // VFX Purple
  '#64748b', // Sketch Slate
];

const BRUSH_PRESETS = [
  { label: 'Fine', size: 2 },
  { label: 'Med', size: 5 },
  { label: 'Bold', size: 12 },
  { label: 'Wash', size: 24 },
];

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
  const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
  const [drawTool, setDrawTool] = useState<'pen' | 'marker' | 'eraser'>('pen');
  const [drawColor, setDrawColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(5);
  const [pressureSensitive, setPressureSensitive] = useState(true);
  const [palmRejectionMode, setPalmRejectionMode] = useState<'auto' | 'pencil-only' | 'all'>('auto');
  const [showGrid, setShowGrid] = useState(true);
  const [isApplePencilActive, setIsApplePencilActive] = useState(false);
  const [livePressure, setLivePressure] = useState(0);

  const [imageUrl, setImageUrl] = useState('');
  const [storyboardNotes, setStoryboardNotes] = useState('');
  const [refImages, setRefImages] = useState<ReferenceImage[]>([]);
  const [newRefUrl, setNewRefUrl] = useState('');
  const [newRefLabel, setNewRefLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<'draw' | 'image' | 'refs' | 'details'>('draw');

  // Load tablet preferences from localStorage
  useEffect(() => {
    try {
      const savedPalm = localStorage.getItem('ss:storyboard:palm-rejection');
      if (savedPalm === 'auto' || savedPalm === 'pencil-only' || savedPalm === 'all') {
        setPalmRejectionMode(savedPalm);
      }
      const savedPressure = localStorage.getItem('ss:storyboard:pressure');
      if (savedPressure !== null) {
        setPressureSensitive(savedPressure === 'true');
      }
      const savedGrid = localStorage.getItem('ss:storyboard:grid');
      if (savedGrid !== null) {
        setShowGrid(savedGrid === 'true');
      }
    } catch {}
  }, []);

  const updatePalmRejectionMode = (mode: 'auto' | 'pencil-only' | 'all') => {
    setPalmRejectionMode(mode);
    try { localStorage.setItem('ss:storyboard:palm-rejection', mode); } catch {}
  };

  const updatePressureSensitive = (val: boolean) => {
    setPressureSensitive(val);
    try { localStorage.setItem('ss:storyboard:pressure', String(val)); } catch {}
  };

  const updateShowGrid = (val: boolean) => {
    setShowGrid(val);
    try { localStorage.setItem('ss:storyboard:grid', String(val)); } catch {}
  };

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    setDrawStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStrokes((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStrokes((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setDrawStrokes((prev) => [...prev, next]);
      return r.slice(0, -1);
    });
  }, []);

  const handleClearStrokes = useCallback(() => {
    setDrawStrokes((prev) => {
      if (prev.length === 0) return prev;
      setRedoStrokes(prev);
      return [];
    });
  }, []);

  const handleStrokesChange = useCallback((newStrokes: Stroke[]) => {
    setDrawStrokes(newStrokes);
    setRedoStrokes([]);
  }, []);

  // Keyboard shortcuts (Cmd+Z, Cmd+Shift+Z, P, M, E, [, ], G)
  useEffect(() => {
    if (!editShot || editorTab !== 'draw') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'p') {
        setDrawTool('pen');
      } else if (e.key.toLowerCase() === 'm') {
        setDrawTool('marker');
      } else if (e.key.toLowerCase() === 'e') {
        setDrawTool('eraser');
      } else if (e.key === '[') {
        setBrushSize((b) => Math.max(1, b - 2));
      } else if (e.key === ']') {
        setBrushSize((b) => Math.min(40, b + 2));
      } else if (e.key.toLowerCase() === 'g') {
        setShowGrid((g) => !g);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editShot, editorTab, handleUndo, handleRedo]);

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
    setRedoStrokes([]);
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
            <PageTitle>Storyboard</PageTitle>
            <p className="text-xs sm:text-sm text-surface-400 mt-1">
              {shots.length} shot{shots.length !== 1 ? 's' : ''} &middot; {withContent} with storyboard
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

      {/* ── Storyboard Editor Modal ────────────────────────── */}
      {editShot !== null && (
        <Modal isOpen onClose={() => setEditShot(null)} title={`Storyboard: Shot ${editShot.shot_number || '#'}`} size="xl">
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
              <button key={t} onClick={() => setEditorTab(t)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0', editorTab === t ? 'bg-brand-600/20 text-brand-500' : 'text-surface-400 hover:text-white hover:bg-surface-900/5')}>
                {t === 'draw' ? '✏️ Draw' : t === 'image' ? '🖼️ Image' : t === 'refs' ? '📎 Refs' : '📝 Notes'}
              </button>
            ))}
          </div>

          {/* Draw tab */}
          {editorTab === 'draw' && (
            <div className="space-y-3">
              {/* Apple Pencil & Tablet Assistant Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-surface-900/80 border border-surface-800">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      isApplePencilActive
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-surface-800/80 border-surface-700/60 text-surface-400'
                    )}
                    title={isApplePencilActive ? 'Apple Pencil connected and drawing' : 'Use your Apple Pencil directly on the canvas'}
                  >
                    <span>✏️</span>
                    <span>{isApplePencilActive ? 'Apple Pencil Active' : 'Apple Pencil Ready'}</span>
                    {isApplePencilActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>

                  {/* Real-time pressure gauge */}
                  {isApplePencilActive && (
                    <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-800/50 border border-surface-700/40 text-[11px] text-surface-400">
                      <span>Pressure:</span>
                      <div className="w-14 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 transition-all duration-75"
                          style={{ width: `${Math.round(livePressure * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] w-6">{Math.round(livePressure * 100)}%</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Palm Rejection Mode Picker */}
                  <div className="flex items-center bg-surface-950 p-0.5 rounded-lg border border-surface-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => updatePalmRejectionMode('pencil-only')}
                      className={cn(
                        'px-2 py-1 rounded-md transition-colors flex items-center gap-1',
                        palmRejectionMode === 'pencil-only'
                          ? 'bg-brand-600 text-white font-medium shadow-sm'
                          : 'text-surface-400 hover:text-white'
                      )}
                      title="Strict Palm Rejection: Rest your entire hand on the screen; only Apple Pencil draws"
                    >
                      <span>🖐️ Pencil Only</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePalmRejectionMode('auto')}
                      className={cn(
                        'px-2 py-1 rounded-md transition-colors',
                        palmRejectionMode === 'auto'
                          ? 'bg-brand-600 text-white font-medium shadow-sm'
                          : 'text-surface-400 hover:text-white'
                      )}
                      title="Auto Palm Rejection: Auto-detects pencil and suppresses palm touches"
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePalmRejectionMode('all')}
                      className={cn(
                        'px-2 py-1 rounded-md transition-colors',
                        palmRejectionMode === 'all'
                          ? 'bg-brand-600 text-white font-medium shadow-sm'
                          : 'text-surface-400 hover:text-white'
                      )}
                      title="Draw with both fingers and Apple Pencil"
                    >
                      Touch + Pen
                    </button>
                  </div>

                  {/* Pressure Dynamics Switch */}
                  <button
                    type="button"
                    onClick={() => updatePressureSensitive(!pressureSensitive)}
                    className={cn(
                      'px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1',
                      pressureSensitive
                        ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                        : 'bg-surface-800 border-surface-700 text-surface-400 hover:text-white'
                    )}
                    title="Scale stroke thickness with Apple Pencil pressure"
                  >
                    <span>〰️ Pressure</span>
                    <span className="text-[10px] opacity-75">{pressureSensitive ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Rule of Thirds Grid Toggle */}
                  <button
                    type="button"
                    onClick={() => updateShowGrid(!showGrid)}
                    className={cn(
                      'px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                      showGrid
                        ? 'bg-surface-700 border-surface-600 text-white'
                        : 'bg-surface-800 border-surface-700 text-surface-400 hover:text-white'
                    )}
                    title="Toggle 16:9 Rule of Thirds cinema framing grid"
                  >
                    # Grid
                  </button>
                </div>
              </div>

              {/* Main Drawing Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-surface-900 border border-surface-800">
                {/* Tools (Pen / Marker / Eraser) */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDrawTool('pen')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                      drawTool === 'pen'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-surface-400 hover:text-white hover:bg-surface-800'
                    )}
                    title="Pen / Pencil (P)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>Pen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawTool('marker')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                      drawTool === 'marker'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-surface-400 hover:text-white hover:bg-surface-800'
                    )}
                    title="Marker / Shading (M)"
                  >
                    <span className="text-sm">🖍️</span>
                    <span>Marker</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawTool('eraser')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                      drawTool === 'eraser'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-surface-400 hover:text-white hover:bg-surface-800'
                    )}
                    title="Eraser (E)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Eraser</span>
                  </button>
                </div>

                {/* Color Palette */}
                <div className="flex items-center gap-1.5">
                  {DRAW_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setDrawColor(c);
                        if (drawTool === 'eraser') setDrawTool('pen');
                      }}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-transform',
                        drawColor === c && drawTool !== 'eraser'
                          ? 'border-white scale-110 shadow-md ring-2 ring-brand-500/40'
                          : 'border-surface-700 hover:scale-105'
                      )}
                      style={{ backgroundColor: c }}
                      title={`Color: ${c}`}
                    />
                  ))}
                </div>

                {/* Size presets & slider */}
                <div className="flex items-center gap-2">
                  <div className="hidden md:flex items-center gap-1 bg-surface-950 p-0.5 rounded-lg border border-surface-800">
                    {BRUSH_PRESETS.map(p => (
                      <button
                        key={p.size}
                        type="button"
                        onClick={() => setBrushSize(p.size)}
                        className={cn(
                          'px-2 py-0.5 rounded text-[11px] transition-colors',
                          brushSize === p.size
                            ? 'bg-surface-700 text-white font-medium'
                            : 'text-surface-400 hover:text-white'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="range"
                      min={1}
                      max={40}
                      value={brushSize}
                      onChange={e => setBrushSize(Number(e.target.value))}
                      className="w-16 sm:w-20 accent-brand-500"
                      title="Brush Size"
                    />
                    <span className="text-[11px] text-surface-400 w-5 text-right font-mono">{brushSize}</span>
                  </div>
                </div>

                {/* Undo / Redo / Clear */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!drawStrokes.length}
                    className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 disabled:opacity-30 transition-colors"
                    title="Undo (Cmd+Z)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!redoStrokes.length}
                    className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 disabled:opacity-30 transition-colors"
                    title="Redo (Cmd+Shift+Z)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearStrokes}
                    disabled={!drawStrokes.length}
                    className="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-surface-800 disabled:opacity-30 transition-colors"
                    title="Clear Canvas (Undoable)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Drawing Canvas */}
              <DrawingCanvas
                strokes={drawStrokes}
                onChange={handleStrokesChange}
                width={640}
                height={360}
                tool={drawTool}
                color={drawColor}
                brushSize={brushSize}
                pressureSensitive={pressureSensitive}
                palmRejectionMode={palmRejectionMode}
                showGrid={showGrid}
                onApplePencilDetected={() => setIsApplePencilActive(true)}
                onLivePressureChange={setLivePressure}
              />

              <div className="flex items-center justify-between text-[11px] text-surface-500 px-1">
                <p>
                  <span>Optimized for Apple Pencil on iPad Safari</span>
                  <span className="hidden sm:inline"> &middot; Palm rejection, pressure dynamics, and high-frequency stroke tracking</span>
                </p>
                <p className="hidden md:inline font-mono text-[10px] text-surface-600">16:9 cinematic framing</p>
              </div>
            </div>
          )}

          {/* Image tab */}
          {editorTab === 'image' && (
            <div className="space-y-4">
              {imageUrl && (
                <div className="rounded-lg overflow-hidden border border-surface-700 bg-surface-900">
                  <img src={imageUrl} alt="Storyboard" className="w-full max-h-64 object-contain" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
                      <img src={ref.url} alt={ref.label || `Ref ${i+1}`} className="w-full h-20 sm:h-32 object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => setRefImages(refImages.filter((_,idx) => idx !== i))} className="p-1.5 bg-red-600 rounded-full text-white">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      {ref.label && <p className="absolute bottom-0 left-0 right-0 bg-black/70 text-[11px] text-white px-2 py-1 truncate">{ref.label}</p>}
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
