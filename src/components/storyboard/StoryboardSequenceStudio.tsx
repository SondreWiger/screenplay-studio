'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Scene } from '@/lib/types';
import { requestSidebarCompact, isSidebarCurrentlyCollapsed } from '@/lib/sidebar-collapse';
import {
  BASE_W,
  BASE_H,
  LayerRasterCache,
  compactLayers,
  distanceToRuler,
  drawGuides,
  drawStroke,
  ellipseRadius,
  getPressureWidth,
  hitHandle,
  luminance,
  makeCanvas,
  normalizeToLayers,
  projectOntoEllipse,
  projectOntoPerspective,
  projectOntoRuler,
  renderDrawing,
  renderTintedDrawing,
  type AspectRatioGuide,
  type BrushTool,
  type DrawingLayer,
  type DrawingPoint,
  type DrawingStroke,
  type EllipseGeom,
  type HandleKind,
  type OverlayConfig,
  type RulerGeom,
  type RulerMode,
  type Scratch,
  type ShotWithStoryboard,
  type Vec,
} from './engine';
import { StoryboardThumb } from './StoryboardThumb';

export type { BrushTool, DrawingLayer, DrawingStroke, ShotWithStoryboard } from './engine';
export { normalizeToLayers, flattenLayersToStrokes } from './engine';

// ── Icons ─────────────────────────────────────────────────────────────

function Ico({ d, className, fill }: { d: string | string[]; className?: string; fill?: boolean }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg
      className={cn('w-4 h-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const I = {
  pencil: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z',
  ink: ['M12 3l6 7-6 11-6-11z', 'M12 10v5'],
  marker: ['M15 4l5 5-9 9H6v-5l9-9z', 'M4 21h16'],
  fineliner: ['M4 20l4-1 11-11-3-3L5 16l-1 4z', 'M14 6l3 3'],
  arrow: ['M5 19L19 5', 'M10 5h9v9'],
  eraser: ['M7 21h10', 'M5.5 15.5l9-9a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8L13 18H8l-2.5-2.5z', 'M10 11l5 5'],
  undo: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
  redo: 'M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6',
  layers: ['M12 3l9 5-9 5-9-5 9-5z', 'M3 13l9 5 9-5'],
  eye: ['M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z', 'M12 15a3 3 0 100-6 3 3 0 000 6z'],
  eyeOff: ['M3 3l18 18', 'M10.6 5.1A9.7 9.7 0 0112 5c6 0 9.5 7 9.5 7a17 17 0 01-3.2 4.1M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7a9.5 9.5 0 004.4-1.1', 'M9.9 9.9a3 3 0 004.2 4.2'],
  lock: ['M6 11h12v10H6z', 'M8 11V7a4 4 0 118 0v4'],
  unlock: ['M6 11h12v10H6z', 'M8 11V7a4 4 0 017.7-1.5'],
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  trash: ['M4 7h16', 'M10 11v6M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  plus: 'M12 5v14M5 12h14',
  play: 'M7 4.5v15a1 1 0 001.5.86l12-7.5a1 1 0 000-1.72l-12-7.5A1 1 0 007 4.5z',
  pause: ['M8 5v14', 'M16 5v14'],
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 6l6 6-6 6',
  onion: ['M9 16a6 6 0 100-12 6 6 0 000 12z', 'M15 20a6 6 0 100-12 6 6 0 000 12z'],
  guides: ['M4 4h16v16H4z', 'M9.33 4v16', 'M14.67 4v16', 'M4 9.33h16', 'M4 14.67h16'],
  straight: ['M5 19L19 5', 'M5 19h.01', 'M19 5h.01'],
  sun: ['M12 16a4 4 0 100-8 4 4 0 000 8z', 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  sliders: ['M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1', 'M15 4v4M9 10v4M17 16v4'],
  download: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
  help: ['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3', 'M12 17h.01'],
  loop: ['M17 2l4 4-4 4', 'M3 11V9a3 3 0 013-3h15', 'M7 22l-4-4 4-4', 'M21 13v2a3 3 0 01-3 3H3'],
  check: 'M5 13l4 4L19 7',
  alert: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z'],
  fit: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  close: 'M6 6l12 12M18 6L6 18',
  stylus: ['M14.5 4.5l5 5L9 20H4v-5L14.5 4.5z', 'M12 7l5 5'],
};

// ── Constants ─────────────────────────────────────────────────────────

const STUDIO_COLORS = [
  { label: 'Charcoal', hex: '#111827' },
  { label: 'Graphite', hex: '#64748b' },
  { label: 'Action Red', hex: '#ef4444' },
  { label: 'Camera Blue', hex: '#3b82f6' },
  { label: 'Key Light Amber', hex: '#f59e0b' },
  { label: 'Practical Green', hex: '#10b981' },
  { label: 'VFX Purple', hex: '#a855f7' },
];

const TOOLS: { tool: BrushTool; label: string; key: string; icon: string | string[]; desc: string }[] = [
  { tool: 'pencil', label: 'Pencil', key: 'p', icon: I.pencil, desc: 'Graphite with pressure, and tilt shading on Apple Pencil' },
  { tool: 'ink', label: 'Ink', key: 'i', icon: I.ink, desc: 'Bold contour ink with dynamic taper' },
  { tool: 'marker', label: 'Marker', key: 'm', icon: I.marker, desc: 'Translucent wash for values and lighting' },
  { tool: 'fineliner', label: 'Tech Pen', key: 'f', icon: I.fineliner, desc: 'Uniform width for architecture and props' },
  { tool: 'arrow', label: 'Arrow', key: 'a', icon: I.arrow, desc: 'Camera moves and actor direction' },
  { tool: 'eraser', label: 'Eraser', key: 'e', icon: I.eraser, desc: 'Erases on the active layer (also the Pencil eraser end)' },
];

const DEFAULT_SIZES: Record<BrushTool, number> = { pencil: 3, ink: 4, marker: 16, fineliner: 1.5, arrow: 4, eraser: 18 };
const SIZE_MIN = 0.5;
const SIZE_MAX = 60;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;

const DEFAULT_GUIDES: { ruler: RulerGeom; vp1: Vec; vp2: Vec; ellipse: EllipseGeom } = {
  ruler: { x: BASE_W / 2, y: BASE_H / 2, angle: 0 },
  vp1: { x: BASE_W / 2, y: BASE_H * 0.45 },
  vp2: { x: BASE_W - 40, y: BASE_H * 0.45 },
  ellipse: { cx: BASE_W / 2, cy: BASE_H / 2, rx: 120, ry: 80 },
};

type PalmMode = 'auto' | 'pencil-only' | 'all';
type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'offline';
type ShotPatch = Partial<Pick<ShotWithStoryboard, 'storyboard_drawing' | 'storyboard_notes' | 'duration_seconds'>>;

interface StudioPrefs {
  tool: BrushTool;
  color: string;
  sizes: Record<BrushTool, number>;
  pressureSensitive: boolean;
  palmMode: PalmMode;
  streamline: number;
  paper: boolean;
  aspectRatio: AspectRatioGuide;
  showRuleOfThirds: boolean;
  showSafeAreas: boolean;
  showCenterCrosshair: boolean;
  showFilmstrip: boolean;
}

const PREFS_KEY = 'ss-storyboard-studio:v2';

function loadPrefs(): Partial<StudioPrefs> {
  try {
    if (typeof window === 'undefined') return {};
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

interface LiveStroke {
  layerId: string;
  pointerId: number;
  pointerType: string;
  startedAt: number;
  straight: boolean;
  snap: 'ruler' | 'ellipse' | null;
  stroke: DrawingStroke;
}

const newId = () => Math.random().toString(36).slice(2, 10);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fmt = (v?: string | null) => (v || '').replace(/_/g, ' ');

function historyFor(map: Map<string, { undo: DrawingLayer[][]; redo: DrawingLayer[][] }>, id: string) {
  let h = map.get(id);
  if (!h) {
    h = { undo: [], redo: [] };
    map.set(id, h);
  }
  return h;
}

// ── Small UI pieces ───────────────────────────────────────────────────

const TbButton = React.forwardRef<
  HTMLButtonElement,
  { active?: boolean; onClick?: () => void; title: string; children: React.ReactNode; className?: string; disabled?: boolean }
>(function TbButton({ active, onClick, title, children, className, disabled }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'h-9 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap disabled:opacity-30 disabled:pointer-events-none',
        active
          ? 'bg-brand-600/20 border-brand-500/50 text-brand-200'
          : 'bg-surface-900 border-surface-800 text-surface-300 hover:text-white hover:border-surface-700',
        className
      )}
    >
      {children}
    </button>
  );
});

function Popover({
  anchor,
  open,
  onClose,
  align = 'left',
  width = 288,
  children,
}: {
  anchor: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  align?: 'left' | 'right';
  width?: number;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Popovers are positioned against the viewport so the horizontally scrolling toolbar never clips them.
  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const r = anchor.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const left = clamp(align === 'right' ? r.right - width : r.left, 8, Math.max(8, vw - width - 8));
    setPos({ top: r.bottom + 8, left });
  }, [open, anchor, align, width]);

  if (!open || !pos) return null;
  return (
    <>
      <div className="fixed inset-0 z-[60]" onPointerDown={onClose} />
      <div
        role="dialog"
        className="fixed z-[61] p-3 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl space-y-3 text-left overflow-y-auto overscroll-contain"
        style={{ top: pos.top, left: pos.left, width: Math.min(width, window.innerWidth - 16), maxHeight: `calc(100dvh - ${pos.top + 12}px)` }}
      >
        {children}
      </div>
    </>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  cols,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div className="grid gap-1 text-[11px]" style={{ gridTemplateColumns: `repeat(${cols || options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'min-h-[32px] px-1.5 rounded-lg border text-center transition-colors',
            value === o.value ? 'bg-brand-600 text-white border-brand-500 font-semibold' : 'bg-surface-800 border-surface-700 text-surface-300 hover:text-white'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-1.5 text-left"
    >
      <span className="min-w-0">
        <span className="block text-xs text-surface-200">{label}</span>
        {hint && <span className="block text-[11px] text-surface-500 leading-snug">{hint}</span>}
      </span>
      <span className={cn('relative w-9 h-5 rounded-full transition-colors shrink-0', checked ? 'bg-brand-600' : 'bg-surface-700')}>
        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-[11px] font-medium uppercase tracking-wider text-surface-500 mb-1.5">{children}</span>
);

/** Vertical, log-scaled brush size slider that works with finger, Pencil and mouse. */
function SizeSlider({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lo = Math.log(SIZE_MIN);
  const hi = Math.log(SIZE_MAX);
  const t = (Math.log(value) - lo) / (hi - lo);

  const setFromEvent = (e: React.PointerEvent) => {
    const r = trackRef.current!.getBoundingClientRect();
    const tt = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    onChange(Math.round(Math.exp(lo + tt * (hi - lo)) * 10) / 10);
  };

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="h-7 flex items-center justify-center" aria-hidden>
        <span className="rounded-full border border-white/30" style={{ width: clamp(value, 2, 26), height: clamp(value, 2, 26), background: color }} />
      </div>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Brush size"
        aria-valuemin={SIZE_MIN}
        aria-valuemax={SIZE_MAX}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') onChange(Math.min(SIZE_MAX, Math.round(value * 1.15 * 10) / 10));
          if (e.key === 'ArrowDown') onChange(Math.max(SIZE_MIN, Math.round((value / 1.15) * 10) / 10));
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromEvent(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) setFromEvent(e);
        }}
        className="relative w-9 h-36 rounded-full bg-surface-900 border border-surface-800 cursor-ns-resize touch-none"
      >
        <div className="absolute inset-x-1 bottom-1 rounded-full bg-brand-600/40" style={{ height: `calc(${t * 100}% - ${t * 8}px)` }} />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow-md border border-surface-300"
          style={{ bottom: `calc(${t * 100}% - ${t * 28}px)` }}
        />
      </div>
      <span className="text-[10px] font-mono text-surface-400">{value < 10 ? value.toFixed(1) : Math.round(value)}</span>
    </div>
  );
}

// ── Storyboard Sequence Studio ────────────────────────────────────────

interface StoryboardSequenceStudioProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  initialShotId?: string;
  scenes: Scene[];
  allShots: ShotWithStoryboard[];
  /** Called optimistically for every change so the board stays in sync; persistence is handled here. */
  onShotPatched: (shotId: string, patch: Partial<ShotWithStoryboard>) => void;
}

export function StoryboardSequenceStudio({
  isOpen,
  onClose,
  initialShotId,
  scenes,
  allShots,
  onShotPatched,
}: StoryboardSequenceStudioProps) {
  const prefs = useMemo(loadPrefs, []);

  // ── Shots & navigation ──────────────────────────────────────────────
  const shotsById = useMemo(() => new Map(allShots.map((s) => [s.id, s])), [allShots]);
  const shotsByIdRef = useRef(shotsById);
  shotsByIdRef.current = shotsById;

  const firstId = initialShotId && shotsById.has(initialShotId) ? initialShotId : allShots[0]?.id || '';
  const [activeShotId, setActiveShotId] = useState(firstId);
  const currentShot = shotsById.get(activeShotId) || null;
  const [sceneFilter, setSceneFilter] = useState<string>(() => shotsById.get(firstId)?.scene_id || 'all');

  const sequenceShots = useMemo(
    () => (sceneFilter === 'all' ? allShots : allShots.filter((s) => s.scene_id === sceneFilter)),
    [allShots, sceneFilter]
  );
  const currentIndex = sequenceShots.findIndex((s) => s.id === activeShotId);
  const shotCountByScene = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of allShots) if (s.scene_id) m.set(s.scene_id, (m.get(s.scene_id) || 0) + 1);
    return m;
  }, [allShots]);

  // ── Document (layers of the active shot) ────────────────────────────
  const initialLayersRef = useRef<DrawingLayer[] | null>(null);
  if (!initialLayersRef.current) initialLayersRef.current = normalizeToLayers(shotsById.get(firstId)?.storyboard_drawing);
  const [layers, setLayersState] = useState<DrawingLayer[]>(initialLayersRef.current);
  const layersRef = useRef<DrawingLayer[]>(layers);
  const docShotRef = useRef(firstId);
  const [activeLayerId, setActiveLayerId] = useState<string>(() => {
    const l = initialLayersRef.current!;
    return l[1]?.id || l[0]?.id || '';
  });
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const historyRef = useRef(new Map<string, { undo: DrawingLayer[][]; redo: DrawingLayer[][] }>());
  const [, setHistoryTick] = useState(0);
  const [notesDraft, setNotesDraft] = useState(currentShot?.storyboard_notes || '');

  // ── Tools & preferences ─────────────────────────────────────────────
  const [tool, setTool] = useState<BrushTool>(prefs.tool || 'pencil');
  // Storyboards are always drawn on white paper, whatever the app theme or an older saved preference.
  const paper = true;
  const [color, setColor] = useState(prefs.color && luminance(prefs.color) < 0.8 ? prefs.color : '#111827');
  const [sizes, setSizes] = useState<Record<BrushTool, number>>({ ...DEFAULT_SIZES, ...(prefs.sizes || {}) });
  const [pressureSensitive, setPressureSensitive] = useState(prefs.pressureSensitive ?? true);
  const [palmMode, setPalmMode] = useState<PalmMode>(prefs.palmMode || 'auto');
  const [streamline, setStreamline] = useState(prefs.streamline ?? 0.35);
  const [penDetected, setPenDetected] = useState(false);
  const penSeenRef = useRef(false);

  // ── Guides ──────────────────────────────────────────────────────────
  const [rulerMode, setRulerMode] = useState<RulerMode>('none');
  const [guides, setGuides] = useState(DEFAULT_GUIDES);
  const guideRef = useRef(guides);
  const activeHandleRef = useRef<HandleKind | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioGuide>(prefs.aspectRatio || '16:9');
  const [showRuleOfThirds, setShowRuleOfThirds] = useState(prefs.showRuleOfThirds ?? true);
  const [showSafeAreas, setShowSafeAreas] = useState(prefs.showSafeAreas ?? false);
  const [showCenterCrosshair, setShowCenterCrosshair] = useState(prefs.showCenterCrosshair ?? false);
  const [straightLine, setStraightLine] = useState(false);

  useEffect(() => {
    guideRef.current = guides;
  }, [guides]);

  // ── Overlay / onion skin ────────────────────────────────────────────
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>({ enabled: false, source: 'prev', opacity: 0.35, tint: 'amber' });
  const [refIndex, setRefIndex] = useState(0);
  const overlayCacheRef = useRef<{ drawing: any; tint: string; canvas: HTMLCanvasElement } | null>(null);

  const overlayShot = useMemo(() => {
    if (!overlayConfig.enabled || currentIndex < 0) return null;
    if (overlayConfig.source === 'prev') return currentIndex > 0 ? sequenceShots[currentIndex - 1] : null;
    if (overlayConfig.source === 'next') return currentIndex < sequenceShots.length - 1 ? sequenceShots[currentIndex + 1] : null;
    if (overlayConfig.source === 'custom' && overlayConfig.customShotId) return shotsById.get(overlayConfig.customShotId) || null;
    return null;
  }, [overlayConfig, currentIndex, sequenceShots, shotsById]);

  const references = currentShot?.storyboard_references || [];
  const traceRef = overlayConfig.enabled && overlayConfig.source === 'reference' ? references[Math.min(refIndex, references.length - 1)] : null;

  // ── Panels & menus ──────────────────────────────────────────────────
  const [openMenu, setOpenMenu] = useState<null | 'overlay' | 'guides' | 'input'>(null);
  const [showLayers, setShowLayers] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1180);
  const [showFilmstrip, setShowFilmstrip] = useState(prefs.showFilmstrip ?? true);
  const [showHelp, setShowHelp] = useState(false);
  const overlayBtnRef = useRef<HTMLButtonElement>(null);
  const guidesBtnRef = useRef<HTMLButtonElement>(null);
  const inputBtnRef = useRef<HTMLButtonElement>(null);

  // ── Playback ────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);

  // ── Canvas & view ───────────────────────────────────────────────────
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const pressureBarRef = useRef<HTMLSpanElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const viewRef = useRef({ scale: 1, x: 0, y: 0 });
  const [viewScale, setViewScale] = useState(1);
  const cacheRef = useRef(new LayerRasterCache());
  const liveRef = useRef<LiveStroke | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchRef = useRef<Scratch>({});
  const rafRef = useRef<number | null>(null);
  const renderNowRef = useRef<() => void>(() => {});

  const requestRender = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      renderNowRef.current();
    });
  }, []);

  // ── Persistence ─────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const pendingRef = useRef(new Map<string, ShotPatch>());
  const inFlightRef = useRef<Promise<void> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const onShotPatchedRef = useRef(onShotPatched);
  onShotPatchedRef.current = onShotPatched;

  const flushSaves = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    while (inFlightRef.current) await inFlightRef.current;
    if (pendingRef.current.size === 0) {
      setSaveState('saved');
      return true;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSaveState('offline');
      return false;
    }

    const batch = Array.from(pendingRef.current.entries());
    pendingRef.current.clear();
    setSaveState('saving');
    let ok = true;

    const run = (async () => {
      const supabase = createClient();
      for (const [id, patch] of batch) {
        const body: Record<string, unknown> = { ...patch };
        if (patch.storyboard_drawing) body.storyboard_drawing = compactLayers(patch.storyboard_drawing as DrawingLayer[]);
        try {
          // Ask for the row back: an update blocked by RLS returns no error, just no rows.
          const { data, error } = await supabase.from('shots').update(body).eq('id', id).select('id');
          if (error) throw error;
          if (!data || data.length === 0) throw new Error('Shot was not updated (missing permission or deleted)');
        } catch (err) {
          ok = false;
          console.error('Storyboard save failed:', err);
          // Re-queue, letting any newer edits for the same shot win.
          pendingRef.current.set(id, { ...patch, ...pendingRef.current.get(id) });
        }
      }
    })();

    inFlightRef.current = run;
    try {
      await run;
    } finally {
      inFlightRef.current = null;
    }

    if (!ok) {
      setSaveState(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
      saveTimerRef.current = setTimeout(() => void flushRef.current(), 6000);
      return false;
    }
    if (pendingRef.current.size > 0) return flushRef.current();
    setSaveState('saved');
    return true;
  }, []);
  flushRef.current = flushSaves;

  const queuePatch = useCallback((shotId: string, patch: ShotPatch, delay = 1200) => {
    if (!shotId) return;
    pendingRef.current.set(shotId, { ...pendingRef.current.get(shotId), ...patch });
    onShotPatchedRef.current(shotId, patch);
    setSaveState((s) => (s === 'saving' ? s : 'pending'));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void flushRef.current(), delay);
  }, []);

  // Flush when the tab is hidden (iPad app switch), retry when back online, warn before unloading.
  useEffect(() => {
    if (!isOpen) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushRef.current();
    };
    const onOnline = () => void flushRef.current(); // also used for pagehide
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingRef.current.size > 0 || inFlightRef.current) {
        void flushRef.current();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onOnline);
    window.addEventListener('online', onOnline);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onOnline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [isOpen]);

  useEffect(() => () => void flushRef.current(), []);

  // ── Document mutations & history ────────────────────────────────────
  const commitLayers = useCallback(
    (next: DrawingLayer[], record = true) => {
      const shotId = docShotRef.current;
      if (record) {
        const h = historyFor(historyRef.current, shotId);
        h.undo.push(layersRef.current);
        if (h.undo.length > 100) h.undo.shift();
        h.redo = [];
        setHistoryTick((t) => t + 1);
      }
      layersRef.current = next;
      setLayersState(next);
      queuePatch(shotId, { storyboard_drawing: next });
    },
    [queuePatch]
  );

  const undo = useCallback(() => {
    const h = historyFor(historyRef.current, docShotRef.current);
    const prev = h.undo.pop();
    if (!prev) return;
    h.redo.push(layersRef.current);
    commitLayers(prev, false);
    setHistoryTick((t) => t + 1);
  }, [commitLayers]);

  const redo = useCallback(() => {
    const h = historyFor(historyRef.current, docShotRef.current);
    const next = h.redo.pop();
    if (!next) return;
    h.undo.push(layersRef.current);
    commitLayers(next, false);
    setHistoryTick((t) => t + 1);
  }, [commitLayers]);

  const history = historyFor(historyRef.current, activeShotId);
  const canUndo = history.undo.length > 0;
  const canRedo = history.redo.length > 0;

  useEffect(() => {
    if (!layers.some((l) => l.id === activeLayerId)) setActiveLayerId(layers[layers.length - 1]?.id || '');
  }, [layers, activeLayerId]);

  const loadShot = useCallback(
    (id: string) => {
      if (!id || id === docShotRef.current) return;
      const shot = shotsByIdRef.current.get(id);
      if (!shot) return;
      if (liveRef.current) liveRef.current = null;
      if (pendingRef.current.size) void flushRef.current();
      const next = normalizeToLayers(shot.storyboard_drawing);
      docShotRef.current = id;
      layersRef.current = next;
      // Layer ids repeat across shots ('bg', 'char', …) so cached rasters must go.
      cacheRef.current.clear();
      setLayersState(next);
      setActiveShotId(id);
      setActiveLayerId((prev) => (next.some((l) => l.id === prev) ? prev : next[1]?.id || next[0]?.id || ''));
      setNotesDraft(shot.storyboard_notes || '');
      setRenamingLayerId(null);
      setHistoryTick((t) => t + 1);
    },
    []
  );

  // Shot deleted elsewhere while the studio is open.
  useEffect(() => {
    if (!currentShot && allShots.length > 0) loadShot(allShots[0].id);
  }, [currentShot, allShots, loadShot]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) loadShot(sequenceShots[currentIndex - 1].id);
  }, [currentIndex, sequenceShots, loadShot]);

  const goNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < sequenceShots.length - 1) loadShot(sequenceShots[currentIndex + 1].id);
  }, [currentIndex, sequenceShots, loadShot]);

  const changeScene = (sceneId: string) => {
    setSceneFilter(sceneId);
    if (sceneId !== 'all' && currentShot?.scene_id !== sceneId) {
      const first = allShots.find((s) => s.scene_id === sceneId);
      if (first) loadShot(first.id);
    }
  };

  // ── Layers ──────────────────────────────────────────────────────────
  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];

  const updateLayer = (id: string, patch: Partial<DrawingLayer>, record = false) =>
    commitLayers(layersRef.current.map((l) => (l.id === id ? { ...l, ...patch } : l)), record);

  const addLayer = () => {
    const cur = layersRef.current;
    const id = `layer-${newId()}`;
    const idx = cur.findIndex((l) => l.id === activeLayerId);
    const next = [...cur];
    next.splice(idx + 1, 0, { id, name: `Layer ${cur.length + 1}`, visible: true, locked: false, opacity: 1, strokes: [] });
    commitLayers(next);
    setActiveLayerId(id);
  };

  const deleteLayer = (id: string) => {
    const cur = layersRef.current;
    if (cur.length <= 1) {
      toast('A frame needs at least one layer', 'info');
      return;
    }
    const idx = cur.findIndex((l) => l.id === id);
    const next = cur.filter((l) => l.id !== id);
    commitLayers(next);
    if (activeLayerId === id) setActiveLayerId(next[Math.max(0, idx - 1)]?.id || next[0].id);
    toast('Layer deleted — ⌘Z / two-finger tap to undo', 'info');
  };

  const moveLayer = (id: string, dir: 'up' | 'down') => {
    const cur = layersRef.current;
    const idx = cur.findIndex((l) => l.id === id);
    const target = dir === 'up' ? idx + 1 : idx - 1;
    if (idx < 0 || target < 0 || target >= cur.length) return;
    const next = [...cur];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    commitLayers(next);
  };

  const clearActiveLayer = () => {
    if (!activeLayer || activeLayer.locked || activeLayer.strokes.length === 0) return;
    updateLayer(activeLayer.id, { strokes: [] }, true);
    toast(`Cleared “${activeLayer.name}” — ⌘Z to undo`, 'info');
  };

  // ── Paper / colour helpers ──────────────────────────────────────────

  const brushSize = sizes[tool];
  const setBrushSize = (v: number) => setSizes((s) => ({ ...s, [tool]: clamp(v, SIZE_MIN, SIZE_MAX) }));

  // ── Persist preferences ─────────────────────────────────────────────
  useEffect(() => {
    try {
      const p: StudioPrefs = {
        tool, color, sizes, pressureSensitive, palmMode, streamline, paper, aspectRatio,
        showRuleOfThirds, showSafeAreas, showCenterCrosshair, showFilmstrip,
      };
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
      // Private mode / storage disabled — preferences just won't stick.
    }
  }, [tool, color, sizes, pressureSensitive, palmMode, streamline, paper, aspectRatio, showRuleOfThirds, showSafeAreas, showCenterCrosshair, showFilmstrip]);

  // Live values read by the (once-bound) pointer handlers.
  const settingsRef = useRef({ tool, color, sizes, pressureSensitive, palmMode, straightLine, rulerMode, activeLayerId, streamline });
  settingsRef.current = { tool, color, sizes, pressureSensitive, palmMode, straightLine, rulerMode, activeLayerId, streamline };

  // ── Sidebar compaction & close ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const wasAlreadyCollapsed = isSidebarCurrentlyCollapsed();
    requestSidebarCompact(true);
    return () => {
      if (!wasAlreadyCollapsed) requestSidebarCompact(false);
    };
  }, [isOpen]);

  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const requestClose = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setPlaying(false);
    const ok = await flushRef.current();
    closingRef.current = false;
    setClosing(false);
    if (!ok && !window.confirm('Some changes have not been saved yet (you may be offline). Close anyway and lose them?')) return;
    onClose();
  }, [onClose]);

  // ── View (zoom / pan) ───────────────────────────────────────────────
  const applyView = useCallback((animate = false) => {
    const stage = stageRef.current;
    if (!stage) return;
    const v = viewRef.current;
    stage.style.transition = animate ? 'transform 180ms ease-out' : 'none';
    stage.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.scale})`;
  }, []);

  const commitView = useCallback(() => {
    // Near 100% snaps back to "fit", so a stray one-finger pan never leaves the frame off-centre.
    if (Math.abs(viewRef.current.scale - 1) < 0.04) {
      viewRef.current = { scale: 1, x: 0, y: 0 };
      applyView(true);
    }
    setViewScale(viewRef.current.scale);
  }, [applyView]);

  const resetView = useCallback(() => {
    viewRef.current = { scale: 1, x: 0, y: 0 };
    applyView(true);
    setViewScale(1);
  }, [applyView]);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, scale: number) => {
      const frame = frameRef.current;
      if (!frame) return;
      const o = frame.getBoundingClientRect();
      const v = viewRef.current;
      const s = clamp(scale, MIN_ZOOM, MAX_ZOOM);
      const lx = (clientX - o.left - v.x) / v.scale;
      const ly = (clientY - o.top - v.y) / v.scale;
      viewRef.current = { scale: s, x: clientX - o.left - lx * s, y: clientY - o.top - ly * s };
      applyView();
    },
    [applyView]
  );

  // Fit the 16:9 frame into whatever space the panels leave.
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!isOpen || !vp) return;
    const measure = () => {
      const pad = window.innerWidth < 640 ? 10 : 24;
      const aw = vp.clientWidth - pad * 2;
      const ah = vp.clientHeight - pad * 2;
      if (aw <= 0 || ah <= 0) return;
      const w = Math.floor(Math.min(aw, (ah * 16) / 9));
      const h = Math.floor((w * 9) / 16);
      setFrameSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
  }, [isOpen, !!currentShot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Backing-store resolution follows device pixel ratio and zoom (capped for iPad memory).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frameSize.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let k = dpr * clamp(viewScale, 1, 3);
    const maxPixels = 4_200_000;
    if (frameSize.w * k * frameSize.h * k > maxPixels) k = Math.sqrt(maxPixels / (frameSize.w * frameSize.h));
    const W = Math.round(frameSize.w * k);
    const H = Math.round(frameSize.h * k);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    requestRender();
  }, [frameSize, viewScale, requestRender]);

  // ── Rendering ───────────────────────────────────────────────────────
  renderNowRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const sx = W / BASE_W;
    const sy = H / BASE_H;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    // Onion skin of a neighbouring / chosen shot.
    if (overlayShot && overlayConfig.source !== 'reference') {
      let oc = overlayCacheRef.current;
      if (!oc || oc.drawing !== overlayShot.storyboard_drawing || oc.tint !== overlayConfig.tint || oc.canvas.width !== W || oc.canvas.height !== H) {
        oc = { drawing: overlayShot.storyboard_drawing, tint: overlayConfig.tint, canvas: renderTintedDrawing(overlayShot.storyboard_drawing, W, H, overlayConfig.tint) };
        overlayCacheRef.current = oc;
      }
      ctx.globalAlpha = overlayConfig.opacity;
      ctx.drawImage(oc.canvas, 0, 0);
      ctx.globalAlpha = 1;
    }

    const cache = cacheRef.current;
    cache.resize(W, H);
    const live = liveRef.current;
    const current = layersRef.current;
    cache.retain(new Set(current.map((l) => l.id)));

    for (const layer of current) {
      if (!layer.visible || layer.opacity <= 0) continue;
      const lc = cache.get(layer);
      if (live && live.layerId === layer.id) {
        let lv = liveCanvasRef.current;
        if (!lv || lv.width !== W || lv.height !== H) lv = liveCanvasRef.current = makeCanvas(W, H);
        const lctx = lv.getContext('2d')!;
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        lctx.globalCompositeOperation = 'source-over';
        lctx.globalAlpha = 1;
        lctx.clearRect(0, 0, W, H);
        lctx.drawImage(lc, 0, 0);
        drawStroke(lctx, live.stroke, sx, sy, scratchRef.current);
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(lv, 0, 0);
      } else {
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(lc, 0, 0);
      }
    }
    ctx.globalAlpha = 1;

    const g = guideRef.current;
    drawGuides(ctx, W, H, {
      aspectRatio,
      showRuleOfThirds: showRuleOfThirds && !playing,
      showSafeAreas: showSafeAreas && !playing,
      showCenterCrosshair: showCenterCrosshair && !playing,
      rulerMode: playing ? 'none' : rulerMode,
      ruler: g.ruler,
      vp1: g.vp1,
      vp2: g.vp2,
      ellipse: g.ellipse,
      paper,
      px: BASE_W / Math.max(1, frameSize.w * viewScale),
      activeHandle: activeHandleRef.current,
    });
  };

  // Any React-driven change (layers, guides, overlay…) schedules one coalesced frame.
  useEffect(() => {
    requestRender();
  });
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null; // StrictMode remounts: a stale id would block every future frame
      cacheRef.current.clear();
      liveCanvasRef.current = null;
      overlayCacheRef.current = null;
    },
    []
  );

  // ── Pointer input: Apple Pencil, touch gestures, mouse ──────────────
  const actionsRef = useRef({ commitLayers, undo, redo, commitView, zoomAt, applyView, requestRender });
  actionsRef.current = { commitLayers, undo, redo, commitView, zoomAt, applyView, requestRender };

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!isOpen || !canvas || !viewport) return;

    const touches = new Map<number, { x: number; y: number }>();
    let gesture: null | {
      ids: number[];
      startDist: number;
      startMid: Vec;
      startView: { scale: number; x: number; y: number };
      startTime: number;
      moved: boolean;
      maxTouches: number;
    } = null;
    let handleDrag: null | { pointerId: number; kind: HandleKind } = null;
    let mousePan: null | { x: number; y: number; vx: number; vy: number } = null;
    let rect: DOMRect | null = null;
    let smoothed: DrawingPoint | null = null;
    let lockToastAt = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    let safariGestureScale = 1;

    const a = () => actionsRef.current;
    const isUi = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest('button, input, select, textarea, a, [data-studio-ui]');

    const toBase = (clientX: number, clientY: number, r: DOMRect = rect || canvas.getBoundingClientRect()): Vec => ({
      x: ((clientX - r.left) * BASE_W) / r.width,
      y: ((clientY - r.top) * BASE_H) / r.height,
    });

    const readPressure = (e: PointerEvent, prev?: number) => {
      if (e.pointerType !== 'pen') return 0.5;
      // Safari can report 0 on the first coalesced sample of a stroke.
      return e.pressure > 0 ? e.pressure : prev ?? 0.5;
    };

    const setPressureMeter = (p: number) => {
      const el = pressureBarRef.current;
      if (el) el.style.width = `${Math.round(p * 100)}%`;
    };

    const hideReticle = () => {
      const el = reticleRef.current;
      if (el) el.style.display = 'none';
    };

    const showReticle = (e: PointerEvent) => {
      const el = reticleRef.current;
      if (!el) return;
      const r = canvas.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        hideReticle();
        return;
      }
      const s = settingsRef.current;
      const base = s.tool === 'eraser' ? s.sizes.eraser : getPressureWidth(s.sizes[s.tool], 0.5, s.tool, s.pressureSensitive);
      const d = Math.max(4, (base * r.width) / BASE_W);
      el.style.display = 'block';
      el.style.width = `${d}px`;
      el.style.height = `${d}px`;
      el.style.transform = `translate3d(${e.clientX - d / 2}px, ${e.clientY - d / 2}px, 0)`;
      el.style.borderColor = s.tool === 'eraser' ? 'rgba(255,255,255,0.9)' : s.color;
    };

    const cancelStroke = () => {
      const live = liveRef.current;
      if (!live) return;
      try { viewport.releasePointerCapture(live.pointerId); } catch {}
      liveRef.current = null;
      setPressureMeter(0);
      a().requestRender();
    };

    const startStroke = (e: PointerEvent): boolean => {
      const s = settingsRef.current;
      const layer = layersRef.current.find((l) => l.id === s.activeLayerId);
      if (!layer) return false;
      if (layer.locked || !layer.visible) {
        if (Date.now() - lockToastAt > 2500) {
          lockToastAt = Date.now();
          toast(layer.locked ? `“${layer.name}” is locked — unlock it in Layers to draw.` : `“${layer.name}” is hidden — show it to draw.`, 'warning');
        }
        return false;
      }
      rect = canvas.getBoundingClientRect();
      const toolNow: BrushTool = e.pointerType === 'pen' && e.buttons & 32 ? 'eraser' : s.tool;
      let p = toBase(e.clientX, e.clientY);
      const g = guideRef.current;
      const tol = (22 * BASE_W) / rect.width;
      let snap: LiveStroke['snap'] = null;
      if (s.rulerMode === 'straight' && Math.abs(distanceToRuler(p, g.ruler)) < tol) snap = 'ruler';
      else if (s.rulerMode === 'circle' && Math.abs(ellipseRadius(p, g.ellipse) - 1) * Math.min(g.ellipse.rx, g.ellipse.ry) < tol) snap = 'ellipse';
      if (snap === 'ruler') p = projectOntoRuler(p, g.ruler);
      else if (snap === 'ellipse') p = projectOntoEllipse(p, g.ellipse);

      const pt: DrawingPoint = { x: p.x, y: p.y, pressure: readPressure(e) };
      if (e.pointerType === 'pen' && (e.tiltX || e.tiltY)) {
        pt.tiltX = e.tiltX;
        pt.tiltY = e.tiltY;
      }
      smoothed = pt;
      liveRef.current = {
        layerId: layer.id,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startedAt: performance.now(),
        straight: s.straightLine || e.shiftKey,
        snap,
        stroke: { id: newId(), points: [pt], color: s.color, width: s.sizes[toolNow], tool: toolNow, pressureSensitive: s.pressureSensitive },
      };
      try { viewport.setPointerCapture(e.pointerId); } catch {}
      hideReticle();
      setPressureMeter(pt.pressure ?? 0);
      a().requestRender();
      return true;
    };

    const extendStroke = (e: PointerEvent) => {
      const live = liveRef.current;
      if (!live || !smoothed) return;
      const s = settingsRef.current;
      const g = guideRef.current;
      const pts = live.stroke.points;
      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const samples = coalesced.length ? coalesced : [e];
      // Streamline: light exponential smoothing; Pencil needs less than mouse/finger.
      const smoothing = live.straight || live.snap ? 0 : s.streamline * (live.pointerType === 'pen' ? 0.6 : 0.85);
      const k = 1 - smoothing;
      const perspective = s.rulerMode === 'perspective1' ? [g.vp1] : s.rulerMode === 'perspective2' ? [g.vp1, g.vp2] : null;

      for (const ev of samples) {
        let p = toBase(ev.clientX, ev.clientY);
        if (live.snap === 'ruler') p = projectOntoRuler(p, g.ruler);
        else if (live.snap === 'ellipse') p = projectOntoEllipse(p, g.ellipse);
        const prevPressure = smoothed.pressure ?? 0.5;
        const pressure = prevPressure + (readPressure(ev, prevPressure) - prevPressure) * 0.55;
        const pt: DrawingPoint = { x: smoothed.x + (p.x - smoothed.x) * k, y: smoothed.y + (p.y - smoothed.y) * k, pressure };
        if (live.pointerType === 'pen' && (ev.tiltX || ev.tiltY)) {
          pt.tiltX = ev.tiltX;
          pt.tiltY = ev.tiltY;
        }
        smoothed = pt;

        if (live.straight) {
          const end = perspective ? projectOntoPerspective(pts[0], pt, perspective) : pt;
          pts.length = 1;
          pts.push({ ...pt, x: end.x, y: end.y });
          continue;
        }
        const last = pts[pts.length - 1];
        if (Math.abs(pt.x - last.x) < 0.15 && Math.abs(pt.y - last.y) < 0.15) {
          last.pressure = pt.pressure;
          continue;
        }
        pts.push(pt);
      }
      setPressureMeter(smoothed.pressure ?? 0);
      a().requestRender();
    };

    const finishStroke = (e?: PointerEvent) => {
      const live = liveRef.current;
      if (!live) return;
      liveRef.current = null;
      try { viewport.releasePointerCapture(live.pointerId); } catch {}
      setPressureMeter(0);
      const pts = live.stroke.points;
      // Close the gap streamlining leaves behind so the line ends under the nib.
      if (e && !live.straight && !live.snap && pts.length > 1) {
        const p = toBase(e.clientX, e.clientY);
        const last = pts[pts.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) > 0.3) pts.push({ ...last, x: p.x, y: p.y });
      }
      const cur = layersRef.current;
      if (!cur.some((l) => l.id === live.layerId)) {
        a().requestRender();
        return;
      }
      a().commitLayers(cur.map((l) => (l.id === live.layerId ? { ...l, strokes: [...l.strokes, live.stroke] } : l)));
      a().requestRender();
    };

    const startGesture = () => {
      const ids = Array.from(touches.keys()).slice(-2);
      const [p1, p2] = ids.map((id) => touches.get(id)!);
      if (!p1) return;
      const mid = p2 ? { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } : p1;
      gesture = {
        ids,
        startDist: p2 ? Math.hypot(p1.x - p2.x, p1.y - p2.y) : 0,
        startMid: mid,
        startView: { ...viewRef.current },
        startTime: gesture?.startTime ?? performance.now(),
        moved: gesture?.moved ?? false,
        maxTouches: Math.max(gesture?.maxTouches ?? 0, touches.size),
      };
    };

    const updateGesture = () => {
      const frame = frameRef.current;
      if (!gesture || !frame) return;
      const [p1, p2] = gesture.ids.map((id) => touches.get(id));
      if (!p1) return;
      const mid = p2 ? { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } : p1;
      const o = frame.getBoundingClientRect();
      const sv = gesture.startView;
      const scale = p2 && gesture.startDist > 0 ? clamp((sv.scale * Math.hypot(p1.x - p2.x, p1.y - p2.y)) / gesture.startDist, MIN_ZOOM, MAX_ZOOM) : sv.scale;
      const lx = (gesture.startMid.x - o.left - sv.x) / sv.scale;
      const ly = (gesture.startMid.y - o.top - sv.y) / sv.scale;
      viewRef.current = { scale, x: mid.x - o.left - lx * scale, y: mid.y - o.top - ly * scale };
      if (Math.hypot(mid.x - gesture.startMid.x, mid.y - gesture.startMid.y) > 10 || Math.abs(scale / sv.scale - 1) > 0.05) gesture.moved = true;
      a().applyView();
    };

    const endGesture = () => {
      if (!gesture) return;
      const g = gesture;
      gesture = null;
      const tap = performance.now() - g.startTime < 320 && !g.moved;
      if (tap && g.maxTouches === 2) a().undo();
      else if (tap && g.maxTouches >= 3) a().redo();
      a().commitView();
    };

    const dragHandle = (e: PointerEvent) => {
      if (!handleDrag) return;
      const p = toBase(e.clientX, e.clientY);
      const g = { ...guideRef.current };
      switch (handleDrag.kind) {
        case 'ruler-move':
          g.ruler = { ...g.ruler, x: p.x, y: p.y };
          break;
        case 'ruler-rotate': {
          let angle = (Math.atan2(p.y - g.ruler.y, p.x - g.ruler.x) * 180) / Math.PI;
          const snapped = Math.round(angle / 15) * 15;
          if (Math.abs(angle - snapped) < 2.5) angle = snapped;
          g.ruler = { ...g.ruler, angle };
          break;
        }
        case 'vp1':
          g.vp1 = p;
          if (settingsRef.current.rulerMode === 'perspective2') g.vp2 = { ...g.vp2, y: p.y };
          break;
        case 'vp2':
          g.vp2 = p;
          g.vp1 = { ...g.vp1, y: p.y };
          break;
        case 'ellipse-move':
          g.ellipse = { ...g.ellipse, cx: p.x, cy: p.y };
          break;
        case 'ellipse-rx':
          g.ellipse = { ...g.ellipse, rx: Math.max(6, Math.abs(p.x - g.ellipse.cx)) };
          break;
        case 'ellipse-ry':
          g.ellipse = { ...g.ellipse, ry: Math.max(6, Math.abs(p.y - g.ellipse.cy)) };
          break;
      }
      guideRef.current = g;
      a().requestRender();
    };

    const tryHandle = (e: PointerEvent): boolean => {
      const s = settingsRef.current;
      if (s.rulerMode === 'none' || handleDrag) return false;
      const r = canvas.getBoundingClientRect();
      const kind = hitHandle({ rulerMode: s.rulerMode, ...guideRef.current }, toBase(e.clientX, e.clientY, r), (20 * BASE_W) / r.width);
      if (!kind) return false;
      rect = r;
      handleDrag = { pointerId: e.pointerId, kind };
      activeHandleRef.current = kind;
      try { viewport.setPointerCapture(e.pointerId); } catch {}
      a().requestRender();
      return true;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (isUi(e.target)) return;
      const s = settingsRef.current;

      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        e.preventDefault();
        const live = liveRef.current;
        if (touches.size >= 2) {
          // A second finger means pinch / pan / tap-undo, not a stroke. Drop a finger stroke that just began.
          if (live && live.pointerType === 'touch') {
            if (performance.now() - live.startedAt < 350 || live.stroke.points.length < 8) cancelStroke();
            else finishStroke();
          }
          if (handleDrag && touches.has(handleDrag.pointerId)) {
            handleDrag = null;
            activeHandleRef.current = null;
            setGuides({ ...guideRef.current });
          }
          startGesture();
          return;
        }
        // One finger can always move rulers and vanishing points.
        if (tryHandle(e)) return;
        const fingersDraw = s.palmMode === 'all' || (s.palmMode === 'auto' && !penSeenRef.current);
        const looksLikePalm = s.palmMode === 'auto' && (e.width > 40 || e.height > 40);
        if (!fingersDraw || looksLikePalm || live?.pointerType === 'pen') {
          startGesture();
          return;
        }
      } else if (e.pointerType === 'pen') {
        if (!penSeenRef.current) {
          penSeenRef.current = true;
          setPenDetected(true);
        }
        // A resting palm may have landed first — its stroke is discarded.
        if (liveRef.current?.pointerType === 'touch') cancelStroke();
        if (gesture) {
          gesture = null;
          touches.clear();
          a().commitView();
        }
      } else {
        if (e.button === 1) {
          e.preventDefault();
          mousePan = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
          return;
        }
        if (e.button !== 0) return;
      }

      if (liveRef.current) return;
      e.preventDefault();
      if (tryHandle(e)) return;
      startStroke(e);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (gesture) {
          e.preventDefault();
          updateGesture();
          return;
        }
      }
      if (mousePan) {
        viewRef.current = { ...viewRef.current, x: mousePan.vx + e.clientX - mousePan.x, y: mousePan.vy + e.clientY - mousePan.y };
        a().applyView();
        return;
      }
      if (handleDrag && handleDrag.pointerId === e.pointerId) {
        e.preventDefault();
        dragHandle(e);
        return;
      }
      const live = liveRef.current;
      if (live && live.pointerId === e.pointerId) {
        e.preventDefault();
        extendStroke(e);
        return;
      }
      // Apple Pencil hover (M2+ iPad Pro) and mouse: show the brush footprint.
      if (e.buttons === 0 && (e.pointerType === 'pen' || e.pointerType === 'mouse')) showReticle(e);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
        touches.delete(e.pointerId);
        if (gesture) {
          if (touches.size === 0) endGesture();
          else startGesture();
        }
      }
      if (mousePan && e.pointerType === 'mouse') {
        mousePan = null;
        a().commitView();
        return;
      }
      if (handleDrag && handleDrag.pointerId === e.pointerId) {
        try { viewport.releasePointerCapture(e.pointerId); } catch {}
        handleDrag = null;
        activeHandleRef.current = null;
        setGuides({ ...guideRef.current });
        a().requestRender();
        return;
      }
      const live = liveRef.current;
      if (live && live.pointerId === e.pointerId) {
        e.preventDefault();
        finishStroke(e);
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (touches.delete(e.pointerId) && gesture && touches.size === 0) {
        gesture = null;
        a().commitView();
      }
      if (handleDrag && handleDrag.pointerId === e.pointerId) {
        handleDrag = null;
        activeHandleRef.current = null;
        setGuides({ ...guideRef.current });
      }
      if (liveRef.current && liveRef.current.pointerId === e.pointerId) cancelStroke();
    };

    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') hideReticle();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        a().zoomAt(e.clientX, e.clientY, v.scale * Math.exp(-e.deltaY * 0.01));
      } else if (v.scale > 1) {
        viewRef.current = { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY };
        a().applyView();
      } else {
        return;
      }
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => a().commitView(), 160);
    };

    // Safari trackpad pinch arrives as proprietary gesture events (touch pinch is handled above).
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      safariGestureScale = viewRef.current.scale;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      if (touches.size > 0) return;
      const ge = e as Event & { scale: number; clientX: number; clientY: number };
      a().zoomAt(ge.clientX, ge.clientY, safariGestureScale * ge.scale);
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      if (touches.size === 0) a().commitView();
    };

    // Stop iOS scrolling, double-tap zoom, the magnifier loupe and text selection on the drawing surface.
    const onTouch = (e: TouchEvent) => {
      if (e.cancelable && !isUi(e.target)) e.preventDefault();
    };
    const prevent = (e: Event) => {
      if (!isUi(e.target)) e.preventDefault();
    };

    viewport.addEventListener('pointerdown', onPointerDown, { passive: false });
    viewport.addEventListener('pointermove', onPointerMove, { passive: false });
    viewport.addEventListener('pointerup', onPointerUp, { passive: false });
    viewport.addEventListener('pointercancel', onPointerCancel);
    viewport.addEventListener('pointerleave', onPointerLeave);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
    viewport.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
    viewport.addEventListener('gestureend', onGestureEnd, { passive: false } as AddEventListenerOptions);
    viewport.addEventListener('touchstart', onTouch, { passive: false });
    viewport.addEventListener('touchmove', onTouch, { passive: false });
    viewport.addEventListener('contextmenu', prevent);
    viewport.addEventListener('selectstart', prevent);

    return () => {
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerCancel);
      viewport.removeEventListener('pointerleave', onPointerLeave);
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('gesturestart', onGestureStart);
      viewport.removeEventListener('gesturechange', onGestureChange);
      viewport.removeEventListener('gestureend', onGestureEnd);
      viewport.removeEventListener('touchstart', onTouch);
      viewport.removeEventListener('touchmove', onTouch);
      viewport.removeEventListener('contextmenu', prevent);
      viewport.removeEventListener('selectstart', prevent);
      if (wheelTimer) clearTimeout(wheelTimer);
      liveRef.current = null;
    };
  }, [isOpen, !!currentShot]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animatic playback ───────────────────────────────────────────────
  const shotDuration = (currentShot?.duration_seconds || 2.5) * 1000;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      const idx = sequenceShots.findIndex((s) => s.id === docShotRef.current);
      if (idx >= 0 && idx < sequenceShots.length - 1) loadShot(sequenceShots[idx + 1].id);
      else if (loop && sequenceShots.length > 1) loadShot(sequenceShots[0].id);
      else setPlaying(false);
    }, shotDuration);
    return () => clearTimeout(t);
  }, [playing, activeShotId, shotDuration, sequenceShots, loop, loadShot]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p && currentIndex === sequenceShots.length - 1 && !loop && sequenceShots.length > 1) loadShot(sequenceShots[0].id);
      return !p;
    });
  }, [currentIndex, sequenceShots, loop, loadShot]);

  // Keep the active card in view in the filmstrip.
  useEffect(() => {
    const el = filmstripRef.current?.querySelector<HTMLElement>(`[data-shot-id="${activeShotId}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [activeShotId, showFilmstrip, sceneFilter]);

  // ── Export ──────────────────────────────────────────────────────────
  const exportPng = () => {
    if (!currentShot) return;
    const W = 1920;
    const H = 1080;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    renderDrawing(ctx, layersRef.current, W, H);
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shot-${currentShot.shot_number || currentIndex + 1}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  const keyActionsRef = useRef<Record<string, () => void>>({});
  keyActionsRef.current = {
    undo,
    redo,
    prev: goPrev,
    next: goNext,
    play: togglePlay,
    save: () => void flushRef.current(),
    escape: () => {
      if (showHelp) setShowHelp(false);
      else if (openMenu) setOpenMenu(null);
      else void requestClose();
    },
    sizeDown: () => setBrushSize(brushSize / 1.15),
    sizeUp: () => setBrushSize(brushSize * 1.15),
    overlay: () => setOverlayConfig((c) => ({ ...c, enabled: !c.enabled })),
    thirds: () => setShowRuleOfThirds((v) => !v),
    layers: () => setShowLayers((v) => !v),
    straight: () => setStraightLine((v) => !v),
    fit: resetView,
    help: () => setShowHelp((v) => !v),
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const k = keyActionsRef.current;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape') {
        e.preventDefault();
        if (typing) t!.blur();
        else k.escape();
        return;
      }
      if (typing) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) k.redo(); else k.undo(); return; }
      if (mod && key === 'y') { e.preventDefault(); k.redo(); return; }
      if (mod && key === 's') { e.preventDefault(); k.save(); return; }
      if (mod || e.altKey) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); k.prev(); return;
        case 'ArrowRight': e.preventDefault(); k.next(); return;
        case ' ': e.preventDefault(); k.play(); return;
        case '[': k.sizeDown(); return;
        case ']': k.sizeUp(); return;
        case '?': k.help(); return;
        case '0': k.fit(); return;
      }
      const td = TOOLS.find((x) => x.key === key);
      if (td) { setTool(td.tool); return; }
      if (key === 'o') k.overlay();
      else if (key === 'g') k.thirds();
      else if (key === 'l') k.layers();
      else if (key === 's') k.straight();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen || !currentShot) return null;

  // ── Render ──────────────────────────────────────────────────────────
  const saveBadge = {
    saved: { text: 'Saved', cls: 'text-surface-400 border-surface-800', icon: I.check },
    pending: { text: 'Editing', cls: 'text-surface-300 border-surface-800', icon: null },
    saving: { text: 'Saving…', cls: 'text-surface-300 border-surface-800', icon: null },
    error: { text: 'Save failed · Retry', cls: 'text-red-300 border-red-500/40 bg-red-500/10', icon: I.alert },
    offline: { text: 'Offline · kept locally', cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10', icon: I.alert },
  }[saveState];

  const guidesActive = rulerMode !== 'none' || showRuleOfThirds || showSafeAreas || showCenterCrosshair || aspectRatio !== '16:9';
  const fingersDraw = palmMode === 'all' || (palmMode === 'auto' && !penDetected);

  return (
    <div
      className="fixed inset-y-0 right-0 left-0 md:left-[var(--sidebar-width,3.5rem)] z-30 flex flex-col bg-surface-950 text-white select-none overflow-hidden transition-[left] duration-300 ease-spring"
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="h-14 px-2 sm:px-4 flex items-center justify-between gap-2 border-b border-surface-800 bg-surface-950 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden xl:inline text-sm font-bold tracking-tight text-brand-400 shrink-0">Sequence Studio</span>
          <select
            value={sceneFilter}
            onChange={(e) => changeScene(e.target.value)}
            aria-label="Scene"
            className="h-9 max-w-[42vw] sm:max-w-[260px] bg-surface-900 border border-surface-700 text-xs rounded-lg px-2 text-surface-200 focus:outline-none focus:border-brand-500 font-medium truncate"
          >
            <option value="all">All scenes · {allShots.length} shots</option>
            {scenes.map((s) => (
              <option key={s.id} value={s.id} disabled={!shotCountByScene.get(s.id)}>
                Scene {s.scene_number || '?'}{s.location_name ? ` · ${s.location_name}` : ''} ({shotCountByScene.get(s.id) || 0})
              </option>
            ))}
          </select>
          <span className="hidden lg:inline text-xs font-mono text-surface-400 shrink-0">
            {currentIndex >= 0 ? currentIndex + 1 : '–'}/{sequenceShots.length}
          </span>
          <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-surface-400 min-w-0">
            <span className="px-1.5 py-0.5 rounded bg-surface-900 border border-surface-800 capitalize">{fmt(currentShot.shot_type)}</span>
            <span className="px-1.5 py-0.5 rounded bg-surface-900 border border-surface-800 capitalize">{fmt(currentShot.shot_movement)}</span>
            {currentShot.lens && <span className="px-1.5 py-0.5 rounded bg-surface-900 border border-surface-800">{currentShot.lens}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 bg-surface-900 p-1 rounded-xl border border-surface-800 shrink-0">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex <= 0}
            className="w-9 h-8 rounded-lg inline-flex items-center justify-center text-surface-300 hover:text-white hover:bg-surface-800 disabled:opacity-30"
            title="Previous shot (←)"
            aria-label="Previous shot"
          >
            <Ico d={I.prev} />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={sequenceShots.length < 2}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-40',
              playing ? 'bg-amber-500 text-black' : 'bg-brand-600 text-white hover:bg-brand-500'
            )}
            title="Play animatic (Space)"
          >
            {playing ? <Ico d={I.pause} /> : <Ico d={I.play} fill />}
            <span className="hidden sm:inline">{playing ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex < 0 || currentIndex >= sequenceShots.length - 1}
            className="w-9 h-8 rounded-lg inline-flex items-center justify-center text-surface-300 hover:text-white hover:bg-surface-800 disabled:opacity-30"
            title="Next shot (→)"
            aria-label="Next shot"
          >
            <Ico d={I.next} />
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void flushRef.current()}
            className={cn('hidden sm:inline-flex h-8 px-2.5 items-center gap-1.5 rounded-lg border text-[11px] font-medium', saveBadge.cls)}
            title={saveState === 'saved' ? 'All changes saved' : 'Save now (⌘S)'}
            aria-live="polite"
          >
            {saveState === 'saving' || saveState === 'pending' ? (
              <span className={cn('w-2 h-2 rounded-full', saveState === 'saving' ? 'bg-brand-400 animate-pulse' : 'bg-amber-400')} />
            ) : (
              saveBadge.icon && <Ico d={saveBadge.icon} className="w-3.5 h-3.5" />
            )}
            <span className="hidden lg:inline">{saveBadge.text}</span>
            <span className="lg:hidden">{saveState === 'error' ? 'Retry' : saveState === 'offline' ? 'Offline' : saveState === 'saved' ? 'Saved' : ''}</span>
          </button>
          <Button size="sm" onClick={() => void requestClose()} loading={closing} className="h-9 text-xs font-medium">
            Done
          </Button>
        </div>
      </header>

      {/* Animatic progress */}
      <div className="h-0.5 bg-surface-900 shrink-0 overflow-hidden">
        {playing && (
          <div
            key={`${activeShotId}-${shotDuration}`}
            className="h-full bg-amber-400 origin-left"
            style={{ animation: `ss-progress ${shotDuration}ms linear forwards` }}
          />
        )}
      </div>
      <style>{'@keyframes ss-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}'}</style>

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <div
        className="h-12 px-2 sm:px-4 flex items-center justify-between gap-2 border-b border-surface-800/80 bg-surface-900/60 shrink-0 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="flex items-center gap-1.5">
          <TbButton
            ref={overlayBtnRef}
            active={overlayConfig.enabled}
            onClick={() => setOpenMenu((m) => (m === 'overlay' ? null : 'overlay'))}
            title="Onion skin / overlay (O)"
          >
            <Ico d={I.onion} />
            <span className="hidden sm:inline">Overlay</span>
          </TbButton>
          <TbButton
            ref={guidesBtnRef}
            active={guidesActive}
            onClick={() => setOpenMenu((m) => (m === 'guides' ? null : 'guides'))}
            title="Guides & rulers"
          >
            <Ico d={I.guides} />
            <span className="hidden sm:inline">Guides</span>
          </TbButton>
          <TbButton active={straightLine} onClick={() => setStraightLine((v) => !v)} title="Straight lines (S, or hold Shift)">
            <Ico d={I.straight} />
            <span className="hidden lg:inline">Straight</span>
          </TbButton>
        </div>

        <div className="flex items-center gap-1.5">
          <TbButton
            ref={inputBtnRef}
            active={openMenu === 'input'}
            onClick={() => setOpenMenu((m) => (m === 'input' ? null : 'input'))}
            title="Apple Pencil & touch settings"
            className={penDetected ? 'border-emerald-500/40 text-emerald-300' : undefined}
          >
            <Ico d={I.stylus} />
            <span className="hidden lg:inline">{penDetected ? 'Pencil' : 'Input'}</span>
            {penDetected && (
              <span className="w-8 h-1.5 rounded-full bg-surface-800 overflow-hidden" title="Live pressure">
                <span ref={pressureBarRef} className="block h-full bg-emerald-400" style={{ width: '0%' }} />
              </span>
            )}
          </TbButton>
          <div className="flex items-center rounded-lg border border-surface-800 bg-surface-900">
            <button type="button" onClick={undo} disabled={!canUndo} className="w-9 h-9 inline-flex items-center justify-center text-surface-300 hover:text-white disabled:opacity-30" title="Undo (⌘Z · two-finger tap)" aria-label="Undo">
              <Ico d={I.undo} />
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} className="w-9 h-9 inline-flex items-center justify-center text-surface-300 hover:text-white disabled:opacity-30" title="Redo (⇧⌘Z · three-finger tap)" aria-label="Redo">
              <Ico d={I.redo} />
            </button>
          </div>
          <TbButton onClick={exportPng} title="Export frame as PNG" className="hidden sm:inline-flex">
            <Ico d={I.download} />
          </TbButton>
          <TbButton onClick={() => setShowHelp(true)} title="Shortcuts & gestures (?)" className="hidden sm:inline-flex">
            <Ico d={I.help} />
          </TbButton>
          <TbButton active={showLayers} onClick={() => setShowLayers((v) => !v)} title="Layers & shot details (L)">
            <Ico d={I.layers} />
            <span className="hidden sm:inline">Layers</span>
            <span className="text-[10px] bg-surface-800 px-1 rounded">{layers.length}</span>
          </TbButton>
        </div>
      </div>

      {/* ── Popovers ───────────────────────────────────────────────── */}
      <Popover anchor={overlayBtnRef} open={openMenu === 'overlay'} onClose={() => setOpenMenu(null)}>
        <Toggle
          checked={overlayConfig.enabled}
          onChange={(v) => setOverlayConfig((c) => ({ ...c, enabled: v }))}
          label="Show overlay"
          hint="Ghost another frame under your drawing for continuity"
        />
        <div>
          <SectionLabel>Source</SectionLabel>
          <Segmented
            value={overlayConfig.source}
            onChange={(source) => setOverlayConfig((c) => ({ ...c, source, enabled: true }))}
            options={[
              { value: 'prev', label: '◀ Previous' },
              { value: 'next', label: 'Next ▶' },
              { value: 'custom', label: 'Pick shot' },
              ...(references.length ? [{ value: 'reference' as const, label: 'Reference' }] : []),
            ]}
            cols={2}
          />
          {overlayConfig.source === 'custom' && (
            <select
              value={overlayConfig.customShotId || ''}
              onChange={(e) => setOverlayConfig((c) => ({ ...c, customShotId: e.target.value, enabled: true }))}
              className="mt-2 w-full h-9 bg-surface-800 border border-surface-700 rounded-lg px-2 text-xs text-surface-200"
            >
              <option value="">Choose a shot…</option>
              {allShots.filter((s) => s.id !== activeShotId).map((s, i) => (
                <option key={s.id} value={s.id}>
                  Shot {s.shot_number || i + 1} · {fmt(s.shot_type)}
                </option>
              ))}
            </select>
          )}
          {overlayConfig.source === 'reference' && references.length > 1 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {references.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRefIndex(i)}
                  className={cn('px-2 h-7 rounded-md text-[11px] border', i === refIndex ? 'bg-brand-600 border-brand-500' : 'bg-surface-800 border-surface-700 text-surface-300')}
                >
                  {r.label || `Ref ${i + 1}`}
                </button>
              ))}
            </div>
          )}
          {overlayConfig.enabled && overlayConfig.source !== 'reference' && !overlayShot && (
            <p className="mt-2 text-[11px] text-surface-500">No {overlayConfig.source === 'custom' ? 'shot chosen' : `${overlayConfig.source} shot in this sequence`}.</p>
          )}
        </div>
        {overlayConfig.source !== 'reference' && (
          <div>
            <SectionLabel>Tint</SectionLabel>
            <Segmented
              value={overlayConfig.tint}
              onChange={(tint) => setOverlayConfig((c) => ({ ...c, tint }))}
              options={[
                { value: 'amber', label: 'Amber' },
                { value: 'cyan', label: 'Cyan' },
                { value: 'mono', label: 'Mono' },
                { value: 'original', label: 'Original' },
              ]}
            />
          </div>
        )}
        <div>
          <div className="flex justify-between">
            <SectionLabel>Opacity</SectionLabel>
            <span className="text-[11px] font-mono text-surface-400">{Math.round(overlayConfig.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.05}
            value={overlayConfig.opacity}
            onChange={(e) => setOverlayConfig((c) => ({ ...c, opacity: Number(e.target.value) }))}
            className="w-full accent-brand-500"
          />
        </div>
      </Popover>

      <Popover anchor={guidesBtnRef} open={openMenu === 'guides'} onClose={() => setOpenMenu(null)} width={300}>
        <div>
          <SectionLabel>Drawing assist</SectionLabel>
          <Segmented
            value={rulerMode}
            onChange={setRulerMode}
            cols={3}
            options={[
              { value: 'none', label: 'Off' },
              { value: 'straight', label: 'Ruler' },
              { value: 'circle', label: 'Ellipse' },
              { value: 'perspective1', label: '1-pt persp.' },
              { value: 'perspective2', label: '2-pt persp.' },
            ]}
          />
          <p className="mt-1.5 text-[11px] text-surface-500 leading-snug">
            {rulerMode === 'straight' && 'Drag the yellow dots to move or rotate. Strokes that start on the edge snap to it.'}
            {rulerMode === 'circle' && 'Drag the purple dots to move and size. Strokes started on the ring follow it.'}
            {(rulerMode === 'perspective1' || rulerMode === 'perspective2') && 'Drag the blue vanishing points. Turn on Straight to snap lines to perspective.'}
            {rulerMode === 'none' && 'Rulers, ellipse and perspective guides with draggable handles.'}
          </p>
          {rulerMode !== 'none' && (
            <button type="button" onClick={() => setGuides(DEFAULT_GUIDES)} className="mt-1 text-[11px] text-brand-400 hover:text-brand-300">
              Reset guide position
            </button>
          )}
        </div>
        <div>
          <SectionLabel>Framing</SectionLabel>
          <Segmented
            value={aspectRatio}
            onChange={setAspectRatio}
            cols={5}
            options={(['16:9', '2.39:1', '1.85:1', '4:3', '9:16'] as const).map((r) => ({ value: r, label: r }))}
          />
        </div>
        <div className="border-t border-surface-800 pt-1">
          <Toggle checked={showRuleOfThirds} onChange={setShowRuleOfThirds} label="Rule of thirds (G)" />
          <Toggle checked={showSafeAreas} onChange={setShowSafeAreas} label="Action & title safe" />
          <Toggle checked={showCenterCrosshair} onChange={setShowCenterCrosshair} label="Centre mark" />
        </div>
      </Popover>

      <Popover anchor={inputBtnRef} open={openMenu === 'input'} onClose={() => setOpenMenu(null)} align="right" width={300}>
        <div className={cn('rounded-lg px-2.5 py-2 text-[11px] leading-snug border', penDetected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-surface-800/60 border-surface-700 text-surface-400')}>
          {penDetected
            ? 'Apple Pencil detected. Pencil draws; fingers pan, pinch-zoom, two-finger tap to undo.'
            : 'Draw with Apple Pencil, mouse or finger. Once a Pencil touches the screen, Auto mode leaves drawing to the Pencil.'}
        </div>
        <div>
          <SectionLabel>Fingers</SectionLabel>
          <Segmented
            value={palmMode}
            onChange={setPalmMode}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'pencil-only', label: 'Gestures only' },
              { value: 'all', label: 'Also draw' },
            ]}
          />
          <p className="mt-1.5 text-[11px] text-surface-500">{fingersDraw ? 'Fingers currently draw.' : 'Fingers currently only pan, zoom and undo.'}</p>
        </div>
        <Toggle checked={pressureSensitive} onChange={setPressureSensitive} label="Pressure sensitivity" hint="Line weight follows Pencil pressure" />
        <div>
          <div className="flex justify-between">
            <SectionLabel>Streamline</SectionLabel>
            <span className="text-[11px] font-mono text-surface-400">{Math.round(streamline * 100)}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.05} value={streamline} onChange={(e) => setStreamline(Number(e.target.value))} className="w-full accent-brand-500" />
          <p className="text-[11px] text-surface-500">Smooths wobble. Lower for direct, sketchy lines.</p>
        </div>
      </Popover>

      {/* ── Workspace ──────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Brush dock */}
        <aside className="w-14 sm:w-[72px] bg-surface-950 border-r border-surface-800 flex flex-col items-center py-2 gap-2 shrink-0 z-20 overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'none' }}>
          <div className="flex flex-col gap-1 w-full px-1.5">
            {TOOLS.map((td) => (
              <button
                key={td.tool}
                type="button"
                onClick={() => setTool(td.tool)}
                aria-pressed={tool === td.tool}
                className={cn(
                  'flex flex-col items-center justify-center h-12 rounded-xl transition-colors w-full',
                  tool === td.tool ? 'bg-brand-600 text-white shadow-lg ring-1 ring-brand-400' : 'text-surface-400 hover:text-white hover:bg-surface-900'
                )}
                title={`${td.label} (${td.key.toUpperCase()}) — ${td.desc}`}
              >
                <Ico d={td.icon} className="w-5 h-5" />
                <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 leading-none">{td.label}</span>
              </button>
            ))}
          </div>

          <div className="w-8 h-px bg-surface-800 shrink-0" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 shrink-0">
            {STUDIO_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  setColor(c.hex);
                  if (tool === 'eraser') setTool('pencil');
                }}
                className={cn(
                  'w-7 h-7 rounded-full border-2 transition-transform',
                  color === c.hex && tool !== 'eraser' ? 'border-brand-400 scale-110 shadow-md' : 'border-surface-700 hover:scale-105'
                )}
                style={{ backgroundColor: c.hex }}
                title={c.label}
                aria-label={c.label}
              />
            ))}
            <label
              className="relative w-7 h-7 rounded-full border-2 border-surface-700 overflow-hidden cursor-pointer"
              title="Custom colour"
              style={{ background: 'conic-gradient(#ef4444, #f59e0b, #10b981, #3b82f6, #a855f7, #ef4444)' }}
            >
              <input
                type="color"
                value={color.length === 7 ? color : '#ffffff'}
                onChange={(e) => {
                  setColor(e.target.value);
                  if (tool === 'eraser') setTool('pencil');
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="Custom colour"
              />
            </label>
          </div>

          <div className="w-8 h-px bg-surface-800 shrink-0" />

          <SizeSlider value={brushSize} onChange={setBrushSize} color={tool === 'eraser' ? '#94a3b8' : color} />
        </aside>

        {/* Canvas viewport */}
        <main
          ref={viewportRef}
          className="flex-1 min-w-0 flex items-center justify-center bg-surface-900/40 relative overflow-hidden"
          style={{ touchAction: 'none', cursor: 'crosshair' }}
        >
          <div ref={frameRef} className="relative shrink-0" style={{ width: frameSize.w, height: frameSize.h }}>
            <div
              ref={stageRef}
              className={cn(
                'absolute inset-0 origin-top-left rounded-lg overflow-hidden shadow-2xl ring-1',
                'bg-white ring-black/10'
              )}
              style={{
                backgroundImage: paper
                  ? 'linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)'
                  : 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                backgroundSize: '6.25% 11.111%',
                willChange: 'transform',
              }}
            >
              {currentShot.storyboard_url && (
                <img src={currentShot.storyboard_url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
              )}
              {traceRef && (
                <img
                  src={traceRef.url}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ opacity: overlayConfig.opacity }}
                />
              )}
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" aria-label={`Storyboard frame for shot ${currentShot.shot_number || currentIndex + 1}`} />
            </div>
          </div>

          {/* Corner badges (not zoomed with the frame) */}
          <div className="absolute top-2 left-2 pointer-events-none flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-surface-200">
              Shot {currentShot.shot_number || currentIndex + 1} · {aspectRatio}
            </span>
            {overlayShot && overlayConfig.source !== 'reference' && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 backdrop-blur-sm border border-amber-500/40 text-[10px] font-medium text-amber-200">
                Overlay · shot {overlayShot.shot_number || '?'}
              </span>
            )}
            {activeLayer && (activeLayer.locked || !activeLayer.visible) && (
              <span className="px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-[10px] font-medium text-red-200">
                “{activeLayer.name}” is {activeLayer.locked ? 'locked' : 'hidden'}
              </span>
            )}
          </div>
          {viewScale !== 1 && (
            <button
              type="button"
              data-studio-ui
              onClick={resetView}
              className="absolute bottom-3 right-3 h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg bg-black/70 border border-white/10 text-[11px] font-mono text-surface-200 hover:text-white"
              title="Fit to screen (0)"
            >
              <Ico d={I.fit} className="w-3.5 h-3.5" />
              {Math.round(viewScale * 100)}%
            </button>
          )}
        </main>

        {/* Layers & shot inspector */}
        {showLayers && (
          <aside
            className={cn(
              'w-[272px] bg-surface-950 border-l border-surface-800 flex flex-col shrink-0 z-30 overflow-y-auto overscroll-contain',
              'absolute right-0 inset-y-0 shadow-2xl xl:static xl:shadow-none'
            )}
          >
            <div className="p-3 border-b border-surface-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Layers</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={addLayer} className="h-8 px-2 inline-flex items-center gap-1 bg-surface-800 hover:bg-surface-700 text-brand-300 rounded-lg text-xs font-medium">
                    <Ico d={I.plus} className="w-3.5 h-3.5" /> Add
                  </button>
                  <button type="button" onClick={() => setShowLayers(false)} className="xl:hidden w-8 h-8 inline-flex items-center justify-center rounded-lg text-surface-400 hover:text-white hover:bg-surface-800" aria-label="Close panel">
                    <Ico d={I.close} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {[...layers].reverse().map((layer) => {
                  const isActive = layer.id === activeLayerId;
                  const idx = layers.indexOf(layer);
                  return (
                    <div
                      key={layer.id}
                      onClick={() => setActiveLayerId(layer.id)}
                      className={cn(
                        'p-1.5 rounded-xl border transition-colors cursor-pointer',
                        isActive ? 'bg-brand-600/15 border-brand-500/60' : 'bg-surface-900/60 border-surface-800 hover:border-surface-700'
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
                          className={cn('w-8 h-8 inline-flex items-center justify-center rounded-lg', layer.visible ? 'text-surface-300 hover:text-white' : 'text-surface-600')}
                          aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                          title={layer.visible ? 'Hide layer' : 'Show layer'}
                        >
                          <Ico d={layer.visible ? I.eye : I.eyeOff} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }}
                          className={cn('w-8 h-8 inline-flex items-center justify-center rounded-lg', layer.locked ? 'text-amber-400' : 'text-surface-600 hover:text-surface-300')}
                          aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                        >
                          <Ico d={layer.locked ? I.lock : I.unlock} />
                        </button>
                        {renamingLayerId === layer.id ? (
                          <input
                            autoFocus
                            defaultValue={layer.name}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              const name = e.target.value.trim();
                              if (name && name !== layer.name) updateLayer(layer.id, { name });
                              setRenamingLayerId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            className="flex-1 min-w-0 h-7 bg-surface-900 border border-brand-500 rounded px-1.5 text-xs text-white select-text"
                          />
                        ) : (
                          <span
                            onDoubleClick={(e) => { e.stopPropagation(); setRenamingLayerId(layer.id); }}
                            className={cn('flex-1 min-w-0 text-xs font-semibold truncate', isActive ? 'text-white' : 'text-surface-300')}
                            title="Double-click to rename"
                          >
                            {layer.name}
                            <span className="ml-1 font-normal text-[10px] text-surface-500">{layer.strokes.length || ''}</span>
                          </span>
                        )}
                        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => moveLayer(layer.id, 'up')} disabled={idx === layers.length - 1} className="w-7 h-8 inline-flex items-center justify-center text-surface-500 hover:text-white disabled:opacity-25" aria-label="Move layer up" title="Move up">
                            <Ico d={I.up} className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => moveLayer(layer.id, 'down')} disabled={idx === 0} className="w-7 h-8 inline-flex items-center justify-center text-surface-500 hover:text-white disabled:opacity-25" aria-label="Move layer down" title="Move down">
                            <Ico d={I.down} className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isActive && (
                        <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-surface-800/60" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] text-surface-500">Opacity</span>
                          <input
                            type="range"
                            min={0.05}
                            max={1}
                            step={0.05}
                            value={layer.opacity}
                            onChange={(e) => updateLayer(layer.id, { opacity: Number(e.target.value) })}
                            className="flex-1 min-w-0 accent-brand-500"
                            aria-label="Layer opacity"
                          />
                          <span className="text-[10px] font-mono text-surface-400 w-8 text-right">{Math.round(layer.opacity * 100)}%</span>
                          <button
                            type="button"
                            onClick={() => setRenamingLayerId(layer.id)}
                            className="text-[10px] text-surface-400 hover:text-white"
                          >
                            Rename
                          </button>
                          {layers.length > 1 && (
                            <button type="button" onClick={() => deleteLayer(layer.id)} className="w-7 h-7 inline-flex items-center justify-center text-surface-500 hover:text-red-400" aria-label="Delete layer" title="Delete layer">
                              <Ico d={I.trash} className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={clearActiveLayer}
                disabled={!activeLayer || activeLayer.locked || activeLayer.strokes.length === 0}
                className="mt-2 h-8 text-[11px] text-surface-500 hover:text-red-400 disabled:opacity-40 disabled:hover:text-surface-500 transition-colors w-full text-center"
              >
                Clear “{activeLayer?.name}”
              </button>
            </div>

            <div className="p-3 space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">Shot {currentShot.shot_number || currentIndex + 1}</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-surface-900 border border-surface-800 px-2 py-1.5">
                  <span className="block text-surface-500">Type</span>
                  <span className="capitalize text-surface-200">{fmt(currentShot.shot_type) || '—'}</span>
                </div>
                <div className="rounded-lg bg-surface-900 border border-surface-800 px-2 py-1.5">
                  <span className="block text-surface-500">Movement</span>
                  <span className="capitalize text-surface-200">{fmt(currentShot.shot_movement) || '—'}</span>
                </div>
                <div className="rounded-lg bg-surface-900 border border-surface-800 px-2 py-1.5">
                  <span className="block text-surface-500">Lens</span>
                  <span className="text-surface-200">{currentShot.lens || '—'}</span>
                </div>
                <label className="rounded-lg bg-surface-900 border border-surface-800 px-2 py-1.5 focus-within:border-brand-500">
                  <span className="block text-surface-500">Animatic (s)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.5}
                    max={60}
                    step={0.5}
                    key={currentShot.id}
                    defaultValue={currentShot.duration_seconds ?? ''}
                    placeholder="2.5"
                    onBlur={(e) => {
                      const v = e.target.value === '' ? null : clamp(Number(e.target.value), 0.5, 60);
                      if (v !== currentShot.duration_seconds && (v === null || Number.isFinite(v))) queuePatch(currentShot.id, { duration_seconds: v }, 300);
                    }}
                    className="w-full bg-transparent text-surface-200 focus:outline-none select-text"
                  />
                </label>
              </div>

              {currentShot.description && (
                <div>
                  <SectionLabel>Action</SectionLabel>
                  <p className="text-xs text-surface-300 leading-relaxed">{currentShot.description}</p>
                </div>
              )}

              <div>
                <SectionLabel>Storyboard notes</SectionLabel>
                <textarea
                  value={notesDraft}
                  onChange={(e) => {
                    setNotesDraft(e.target.value);
                    queuePatch(currentShot.id, { storyboard_notes: e.target.value }, 900);
                  }}
                  placeholder="Composition, cut cues, VFX…"
                  rows={4}
                  className="w-full bg-surface-900 border border-surface-800 rounded-lg p-2 text-xs text-surface-200 focus:outline-none focus:border-brand-500 resize-y select-text"
                />
              </div>

              {references.length > 0 && (
                <div>
                  <SectionLabel>References</SectionLabel>
                  <div className="grid grid-cols-2 gap-1.5">
                    {references.map((ref, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setRefIndex(idx);
                          setOverlayConfig((c) => ({ ...c, source: 'reference', enabled: true }));
                        }}
                        className="relative rounded-lg overflow-hidden border border-surface-800 hover:border-brand-500 aspect-video bg-surface-900"
                        title="Trace over this reference"
                      >
                        <img src={ref.url} alt={ref.label || `Reference ${idx + 1}`} loading="lazy" className="w-full h-full object-cover" />
                        {ref.label && <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[9px] px-1 py-0.5 truncate text-white text-left">{ref.label}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Filmstrip ──────────────────────────────────────────────── */}
      {showFilmstrip ? (
        <footer className="border-t border-surface-800 bg-surface-950 px-2 sm:px-3 pt-1.5 pb-2 shrink-0 z-30" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-between text-[11px] text-surface-400 px-1 mb-1.5">
            <span>
              <span className="font-semibold text-surface-200">Sequence</span> · {sequenceShots.length} shot{sequenceShots.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLoop((v) => !v)}
                className={cn('h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-medium', loop ? 'text-brand-300 bg-surface-800' : 'text-surface-500 hover:text-surface-300')}
                title="Loop animatic playback"
                aria-pressed={loop}
              >
                <Ico d={I.loop} className="w-3.5 h-3.5" /> Loop
              </button>
              <button type="button" onClick={() => setShowFilmstrip(false)} className="h-7 px-2 rounded-md text-surface-500 hover:text-surface-300" title="Hide filmstrip">
                <Ico d={I.down} className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div ref={filmstripRef} className="flex items-stretch gap-2 overflow-x-auto pb-1 px-1 overscroll-contain" style={{ scrollbarWidth: 'thin' }}>
            {sequenceShots.map((shot, idx) => {
              const isSelected = shot.id === activeShotId;
              return (
                <button
                  key={shot.id}
                  type="button"
                  data-shot-id={shot.id}
                  onClick={() => loadShot(shot.id)}
                  className={cn(
                    'relative rounded-lg border overflow-hidden shrink-0 w-28 sm:w-32 bg-surface-900 text-left transition-colors',
                    isSelected ? 'border-brand-500 ring-2 ring-brand-500/40' : 'border-surface-800 hover:border-surface-600'
                  )}
                  aria-current={isSelected}
                >
                  <StoryboardThumb drawing={shot.storyboard_drawing} imageUrl={shot.storyboard_url} emptyLabel="" />
                  <span className="absolute top-1 left-1 bg-black/80 text-[10px] font-bold px-1 rounded text-white font-mono">
                    {shot.shot_number || idx + 1}
                  </span>
                  <span className="flex items-center justify-between gap-1 px-1.5 h-5 text-[9px] text-surface-400">
                    <span className="truncate capitalize">{fmt(shot.shot_type)}</span>
                    <span className="font-mono text-surface-500 shrink-0">{shot.duration_seconds || 2.5}s</span>
                  </span>
                </button>
              );
            })}
          </div>
        </footer>
      ) : (
        <button
          type="button"
          onClick={() => setShowFilmstrip(true)}
          className="h-8 shrink-0 border-t border-surface-800 bg-surface-950 text-[11px] text-surface-400 hover:text-white inline-flex items-center justify-center gap-1"
        >
          <Ico d={I.up} className="w-3.5 h-3.5" /> Show filmstrip
        </button>
      )}

      {/* Brush footprint for Pencil hover / mouse */}
      <div
        ref={reticleRef}
        className="fixed top-0 left-0 z-[70] pointer-events-none rounded-full border mix-blend-difference"
        style={{ display: 'none', borderColor: '#fff' }}
        aria-hidden
      />

      {/* Shortcuts & gestures */}
      {showHelp && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onPointerDown={() => setShowHelp(false)}>
          <div
            className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl bg-surface-900 border border-surface-700 shadow-2xl p-5"
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Shortcuts and gestures"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold">Shortcuts & gestures</h2>
              <button type="button" onClick={() => setShowHelp(false)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-surface-400 hover:text-white hover:bg-surface-800" aria-label="Close">
                <Ico d={I.close} />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              {[
                ['Two-finger tap', 'Undo'],
                ['Three-finger tap', 'Redo'],
                ['Pinch / two-finger drag', 'Zoom & pan'],
                ['Pencil eraser end', 'Erase'],
                ['⌘Z / ⇧⌘Z', 'Undo / redo'],
                ['P I M F A E', 'Pencil, Ink, Marker, Tech pen, Arrow, Eraser'],
                ['[ / ]', 'Brush size'],
                ['Shift (hold) / S', 'Straight line'],
                ['← / →', 'Previous / next shot'],
                ['Space', 'Play animatic'],
                ['O', 'Onion skin overlay'],
                ['G', 'Rule of thirds'],
                ['L', 'Layers panel'],
                ['0', 'Fit to screen'],
                ['⌘S', 'Save now'],
                ['Esc', 'Close studio'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-1 border-b border-surface-800/60">
                  <span className="font-mono text-surface-200">{k}</span>
                  <span className="text-surface-400 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
