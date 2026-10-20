/**
 * Storyboard drawing engine — data model, stroke rendering, raster caches and guides.
 *
 * Kept free of React so the storyboard grid can import it without pulling in the
 * (lazily loaded) Sequence Studio.
 *
 * Coordinates are stored in a fixed 640×360 "base" space and scaled to whatever
 * backing resolution the canvas is rendered at.
 */

import type { Shot } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────

export type BrushTool =
  | 'pencil'      // Rough graphite pencil (pressure + tilt shading)
  | 'ink'         // Studio inking pen (crisp, dynamic taper)
  | 'marker'      // Chisel storyboard marker (semi-transparent wash)
  | 'fineliner'   // Technical pen (uniform width)
  | 'arrow'       // Camera / action vector arrow
  | 'eraser';

export type RulerMode = 'none' | 'straight' | 'perspective1' | 'perspective2' | 'circle';

export type AspectRatioGuide = '16:9' | '2.39:1' | '1.85:1' | '4:3' | '9:16';

export interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
}

export interface DrawingStroke {
  id?: string;
  points: DrawingPoint[];
  color: string;
  width: number;
  tool: BrushTool;
  pressureSensitive?: boolean;
  arrowHead?: 'none' | 'end';
}

export interface DrawingLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  strokes: DrawingStroke[];
}

export interface ReferenceImage {
  url: string;
  label?: string;
}

export interface ShotWithStoryboard extends Shot {
  storyboard_drawing?: any;
  storyboard_references?: ReferenceImage[];
  storyboard_notes?: string;
  /** Earlier versions of the frame — see lib/storyboard-print/versions.ts. */
  storyboard_versions?: any;
}

export interface OverlayConfig {
  enabled: boolean;
  source: 'prev' | 'next' | 'custom' | 'reference';
  customShotId?: string;
  opacity: number;
  tint: 'mono' | 'amber' | 'cyan' | 'original';
}

export interface Vec { x: number; y: number }
export interface RulerGeom { x: number; y: number; angle: number }
export interface EllipseGeom { cx: number; cy: number; rx: number; ry: number }

export const BASE_W = 640;
export const BASE_H = 360;

// ── Helpers ───────────────────────────────────────────────────────────

export function hexToRgba(hex: string, alpha: number): string {
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

/** Relative luminance (0 = black, 1 = white) of a #rgb / #rrggbb colour. */
export function luminance(hex: string): number {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return 1;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.substring(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Storyboards are drawn on white paper. Strokes saved in near-white chalk on
 * the old dark canvas are drawn in charcoal so they stay visible.
 */
export function paperInk(color: string): string {
  return color.startsWith('#') && luminance(color) > 0.85 ? '#111827' : color;
}

export function getPressureWidth(baseWidth: number, pressure = 0.5, tool: BrushTool = 'ink', isPressureSensitive = true): number {
  if (!isPressureSensitive || tool === 'fineliner' || tool === 'eraser') return baseWidth;
  const p = Math.max(0.04, Math.min(1, pressure));
  if (tool === 'pencil') return Math.max(0.6, baseWidth * (0.3 + 1.2 * Math.pow(p, 0.9)));
  if (tool === 'marker') return Math.max(2, baseWidth * (0.75 + 0.5 * p));
  return Math.max(0.6, baseWidth * (0.2 + 1.4 * Math.pow(p, 0.85)));
}

/** Converts any stored drawing (layers, flat strokes, or nothing) into layers. */
export function normalizeToLayers(drawing: any): DrawingLayer[] {
  if (!drawing || !Array.isArray(drawing) || drawing.length === 0) {
    return [
      { id: 'bg', name: 'Background', visible: true, locked: false, opacity: 1, strokes: [] },
      { id: 'char', name: 'Characters / Action', visible: true, locked: false, opacity: 1, strokes: [] },
      { id: 'cam', name: 'Camera & Notes', visible: true, locked: false, opacity: 1, strokes: [] },
    ];
  }
  if (drawing[0] && 'strokes' in drawing[0]) {
    return drawing.map((l: any, i: number) => ({
      id: l.id || `layer-${i}`,
      name: l.name || `Layer ${i + 1}`,
      visible: l.visible !== false,
      locked: Boolean(l.locked),
      opacity: typeof l.opacity === 'number' ? l.opacity : 1,
      strokes: Array.isArray(l.strokes) ? l.strokes : [],
    }));
  }
  return [
    { id: 'bg', name: 'Background', visible: true, locked: false, opacity: 1, strokes: [] },
    { id: 'char', name: 'Artwork', visible: true, locked: false, opacity: 1, strokes: drawing as DrawingStroke[] },
    { id: 'cam', name: 'Camera & Notes', visible: true, locked: false, opacity: 1, strokes: [] },
  ];
}

/** Flatten layers into one list of visible strokes (legacy helper). */
export function flattenLayersToStrokes(layers: DrawingLayer[]): DrawingStroke[] {
  const result: DrawingStroke[] = [];
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    for (const s of layer.strokes) {
      result.push(layer.opacity < 1 ? { ...s, color: hexToRgba(s.color, layer.opacity) } : s);
    }
  }
  return result;
}

/** True when the stored drawing contains at least one stroke. */
export function hasDrawing(drawing: any): boolean {
  if (!Array.isArray(drawing) || drawing.length === 0) return false;
  if (drawing[0] && 'strokes' in drawing[0]) {
    return drawing.some((l: any) => Array.isArray(l?.strokes) && l.strokes.length > 0);
  }
  return true;
}

const round = (v: number, f: number) => Math.round(v * f) / f;

/**
 * Shrinks a drawing before it is persisted: coordinates are rounded to 0.01 of a
 * base unit (sub-pixel at 4K), pressure to 0.01, tilt to whole degrees, and
 * near-duplicate points are dropped. Typically cuts the JSON payload by 60–70%.
 */
export function compactLayers(layers: DrawingLayer[]): DrawingLayer[] {
  return layers.map((l) => ({
    ...l,
    strokes: l.strokes.map((s) => {
      const pts: DrawingPoint[] = [];
      let last: DrawingPoint | null = null;
      for (let i = 0; i < s.points.length; i++) {
        const p = s.points[i];
        const isEnd = i === s.points.length - 1;
        if (last && !isEnd && Math.abs(p.x - last.x) < 0.2 && Math.abs(p.y - last.y) < 0.2) continue;
        const q: DrawingPoint = { x: round(p.x, 100), y: round(p.y, 100) };
        if (typeof p.pressure === 'number') q.pressure = round(p.pressure, 100);
        if (p.tiltX) q.tiltX = Math.round(p.tiltX);
        if (p.tiltY) q.tiltY = Math.round(p.tiltY);
        pts.push(q);
        last = p;
      }
      return { ...s, width: round(s.width, 100), points: pts };
    }),
  }));
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// ── Stroke rendering ──────────────────────────────────────────────────

/** Tools whose translucency must be applied to the stroke as a whole (not per segment). */
const STROKE_ALPHA: Partial<Record<BrushTool, number>> = { marker: 0.32, pencil: 0.9 };

function strokeHasPressure(stroke: DrawingStroke): boolean {
  if (stroke.pressureSensitive === false) return false;
  for (const pt of stroke.points) {
    if (pt.pressure !== undefined && Math.abs(pt.pressure - 0.5) > 0.04) return true;
  }
  return false;
}

/** Per-point widths in base units. */
function strokeWidths(stroke: DrawingStroke): number[] {
  const n = stroke.points.length;
  const pressure = strokeHasPressure(stroke);
  const widths = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const p = stroke.points[i];
    let w = pressure ? getPressureWidth(stroke.width, p.pressure ?? 0.5, stroke.tool, true) : stroke.width;
    // Ink without pressure data (mouse / finger) gets a synthetic brush taper.
    if (!pressure && stroke.tool === 'ink' && n > 4) {
      const edge = Math.min(i, n - 1 - i);
      w *= 0.35 + 0.65 * Math.min(1, edge / 6);
    }
    // Apple Pencil tilt broadens the graphite for side-of-lead shading.
    if (stroke.tool === 'pencil' && (p.tiltX || p.tiltY)) {
      const tilt = Math.min(90, Math.hypot(p.tiltX || 0, p.tiltY || 0));
      w *= 1 + Math.max(0, (tilt - 45) / 45) * 2.2;
    }
    widths[i] = w;
  }
  return widths;
}

/** Strokes the shape of `stroke` opaquely in its colour. Expects the base→pixel transform on ctx. */
function traceStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke, color: string) {
  const pts = stroke.points;
  const n = pts.length;
  if (n === 0) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const widths = strokeWidths(stroke);

  if (n === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, Math.max(0.5, widths[0] / 2), 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const uniform = widths.every((w) => Math.abs(w - widths[0]) < 0.01);

  if (uniform) {
    ctx.lineWidth = widths[0];
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (n === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      for (let i = 1; i < n - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
    }
    ctx.stroke();
  } else if (n === 2) {
    ctx.lineWidth = (widths[0] + widths[1]) / 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
  } else {
    // Variable width: midpoint-to-midpoint quadratic segments, each with its own width.
    // Segments are drawn opaquely, so overlapping round caps never show as beads.
    let mx = pts[0].x;
    let my = pts[0].y;
    for (let i = 1; i < n - 1; i++) {
      const nx = (pts[i].x + pts[i + 1].x) / 2;
      const ny = (pts[i].y + pts[i + 1].y) / 2;
      ctx.lineWidth = widths[i];
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, nx, ny);
      ctx.stroke();
      mx = nx;
      my = ny;
    }
    ctx.lineWidth = widths[n - 1];
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
    ctx.stroke();
  }

  if (stroke.tool === 'arrow') {
    const last = pts[n - 1];
    // Use a point a little way back along the stroke for a stable heading.
    let ref = pts[0];
    for (let i = n - 2; i >= 0; i--) {
      if (Math.hypot(last.x - pts[i].x, last.y - pts[i].y) > 8) { ref = pts[i]; break; }
    }
    const angle = Math.atan2(last.y - ref.y, last.x - ref.x);
    const headLen = Math.max(12, stroke.width * 2.6);
    ctx.beginPath();
    ctx.moveTo(last.x + Math.cos(angle) * stroke.width * 0.5, last.y + Math.sin(angle) * stroke.width * 0.5);
    ctx.lineTo(last.x - headLen * Math.cos(angle - Math.PI / 6), last.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(last.x - headLen * 0.7 * Math.cos(angle), last.y - headLen * 0.7 * Math.sin(angle));
    ctx.lineTo(last.x - headLen * Math.cos(angle + Math.PI / 6), last.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
}

/** Reusable offscreen canvas used to isolate translucent strokes. */
export interface Scratch { canvas?: HTMLCanvasElement }

function scratchFor(scratch: Scratch, w: number, h: number): HTMLCanvasElement {
  if (!scratch.canvas || scratch.canvas.width < w || scratch.canvas.height < h) {
    scratch.canvas = makeCanvas(Math.max(w, scratch.canvas?.width || 0), Math.max(h, scratch.canvas?.height || 0));
  }
  return scratch.canvas;
}

/**
 * Draws one stroke onto a pixel-space context (identity transform expected),
 * scaling base coordinates by sx/sy. Translucent tools are rendered opaquely into
 * a scratch canvas and composited once so their alpha stays even along the stroke.
 */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke, sx: number, sy: number, scratch: Scratch) {
  if (!stroke.points || stroke.points.length === 0) return;
  const isEraser = stroke.tool === 'eraser';
  const alpha = STROKE_ALPHA[stroke.tool];

  if (!alpha) {
    ctx.save();
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    traceStroke(ctx, stroke, isEraser ? '#000' : paperInk(stroke.color));
    ctx.restore();
    return;
  }

  // Bounding box in pixels (padded by the widest possible brush) to keep the scratch pass cheap.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = stroke.width * 4 + 4;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const x0 = Math.max(0, Math.floor((minX - pad) * sx));
  const y0 = Math.max(0, Math.floor((minY - pad) * sy));
  const x1 = Math.min(W, Math.ceil((maxX + pad) * sx));
  const y1 = Math.min(H, Math.ceil((maxY + pad) * sy));
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw <= 0 || bh <= 0) return;

  const sc = scratchFor(scratch, W, H);
  const sctx = sc.getContext('2d');
  if (!sctx) return;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(x0, y0, bw, bh);
  sctx.setTransform(sx, 0, 0, sy, 0, 0);
  traceStroke(sctx, stroke, paperInk(stroke.color));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha *= alpha;
  ctx.drawImage(sc, x0, y0, bw, bh, x0, y0, bw, bh);
  ctx.restore();
}

/**
 * Raster cache with one canvas per layer. Appending a stroke only draws that stroke;
 * any other change (undo, erase, clear) re-renders the layer once.
 */
export class LayerRasterCache {
  private entries = new Map<string, { strokes: DrawingStroke[]; canvas: HTMLCanvasElement }>();
  private scratch: Scratch = {};
  width = 0;
  height = 0;

  resize(w: number, h: number) {
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.entries.clear();
    this.scratch = {};
  }

  get(layer: DrawingLayer): HTMLCanvasElement {
    let entry = this.entries.get(layer.id);
    if (!entry) {
      entry = { strokes: [], canvas: makeCanvas(this.width, this.height) };
      this.entries.set(layer.id, entry);
    }
    if (entry.strokes !== layer.strokes) {
      const prev = entry.strokes;
      const next = layer.strokes;
      let start = 0;
      let incremental = next.length >= prev.length;
      if (incremental) {
        for (let i = 0; i < prev.length; i++) {
          if (prev[i] !== next[i]) { incremental = false; break; }
        }
      }
      const ctx = entry.canvas.getContext('2d')!;
      if (incremental) {
        start = prev.length;
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
      }
      const sx = this.width / BASE_W;
      const sy = this.height / BASE_H;
      for (let i = start; i < next.length; i++) drawStroke(ctx, next[i], sx, sy, this.scratch);
      entry.strokes = next;
    }
    return entry.canvas;
  }

  /** Drop caches for layers that no longer exist. */
  retain(ids: Set<string>) {
    Array.from(this.entries.keys()).forEach((id) => {
      if (!ids.has(id)) this.entries.delete(id);
    });
  }

  clear() {
    this.entries.clear();
  }
}

/** Composites all visible layers of a stored drawing onto ctx (pixel space, identity transform). */
export function renderDrawing(ctx: CanvasRenderingContext2D, drawing: any, w: number, h: number) {
  const layers = normalizeToLayers(drawing);
  const sx = w / BASE_W;
  const sy = h / BASE_H;
  const scratch: Scratch = {};
  let layerCanvas: HTMLCanvasElement | null = null;
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0 || layer.strokes.length === 0) continue;
    // Layers are rendered in isolation so their erasers only affect themselves.
    layerCanvas = layerCanvas || makeCanvas(w, h);
    const lctx = layerCanvas.getContext('2d')!;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, w, h);
    for (const s of layer.strokes) drawStroke(lctx, s, sx, sy, scratch);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(layerCanvas, 0, 0);
    ctx.restore();
  }
}

/** Renders a drawing flattened and recoloured with a single tint (for onion skinning). */
export function renderTintedDrawing(drawing: any, w: number, h: number, tint: OverlayConfig['tint']): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  renderDrawing(ctx, drawing, w, h);
  if (tint !== 'original') {
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = tint === 'amber' ? '#f97316' : tint === 'cyan' ? '#06b6d4' : '#94a3b8';
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

/** Whether a drawing is mostly dark ink, i.e. reads better on a light "paper" backdrop. */
export function prefersPaper(drawing: any): boolean {
  const layers = normalizeToLayers(drawing);
  let dark = 0;
  let total = 0;
  for (const l of layers) {
    for (const s of l.strokes) {
      if (s.tool === 'eraser') continue;
      total++;
      if (luminance(s.color) < 0.35) dark++;
    }
  }
  return total > 0 && dark / total > 0.5;
}

// ── Guides, rulers & handles ──────────────────────────────────────────

export interface GuideOptions {
  aspectRatio: AspectRatioGuide;
  showRuleOfThirds: boolean;
  showSafeAreas: boolean;
  showCenterCrosshair: boolean;
  rulerMode: RulerMode;
  ruler: RulerGeom;
  vp1: Vec;
  vp2: Vec;
  ellipse: EllipseGeom;
  paper: boolean;
  /** One CSS pixel expressed in base units, for hairlines and handle sizes. */
  px: number;
  /** Handle being dragged, drawn highlighted. */
  activeHandle?: HandleKind | null;
}

export type HandleKind = 'ruler-move' | 'ruler-rotate' | 'vp1' | 'vp2' | 'ellipse-move' | 'ellipse-rx' | 'ellipse-ry';

const RULER_HANDLE_DIST = 150;

export function guideHandles(o: Pick<GuideOptions, 'rulerMode' | 'ruler' | 'vp1' | 'vp2' | 'ellipse'>): { kind: HandleKind; x: number; y: number }[] {
  switch (o.rulerMode) {
    case 'straight': {
      const rad = (o.ruler.angle * Math.PI) / 180;
      return [
        { kind: 'ruler-move', x: o.ruler.x, y: o.ruler.y },
        { kind: 'ruler-rotate', x: o.ruler.x + Math.cos(rad) * RULER_HANDLE_DIST, y: o.ruler.y + Math.sin(rad) * RULER_HANDLE_DIST },
      ];
    }
    case 'perspective1':
      return [{ kind: 'vp1', x: o.vp1.x, y: o.vp1.y }];
    case 'perspective2':
      return [
        { kind: 'vp1', x: o.vp1.x, y: o.vp1.y },
        { kind: 'vp2', x: o.vp2.x, y: o.vp2.y },
      ];
    case 'circle':
      return [
        { kind: 'ellipse-move', x: o.ellipse.cx, y: o.ellipse.cy },
        { kind: 'ellipse-rx', x: o.ellipse.cx + o.ellipse.rx, y: o.ellipse.cy },
        { kind: 'ellipse-ry', x: o.ellipse.cx, y: o.ellipse.cy + o.ellipse.ry },
      ];
    default:
      return [];
  }
}

export function hitHandle(o: Parameters<typeof guideHandles>[0], p: Vec, radius: number): HandleKind | null {
  let best: HandleKind | null = null;
  let bestD = radius;
  for (const h of guideHandles(o)) {
    const d = Math.hypot(h.x - p.x, h.y - p.y);
    if (d <= bestD) { best = h.kind; bestD = d; }
  }
  return best;
}

/** Signed distance from p to the ruler's edge line. */
export function distanceToRuler(p: Vec, r: RulerGeom): number {
  const rad = (r.angle * Math.PI) / 180;
  return (p.x - r.x) * -Math.sin(rad) + (p.y - r.y) * Math.cos(rad);
}

export function projectOntoRuler(p: Vec, r: RulerGeom): Vec {
  const rad = (r.angle * Math.PI) / 180;
  const d = distanceToRuler(p, r);
  return { x: p.x + d * Math.sin(rad), y: p.y - d * Math.cos(rad) };
}

/** Normalised radial distance: 1 means exactly on the ellipse. */
export function ellipseRadius(p: Vec, e: EllipseGeom): number {
  return Math.hypot((p.x - e.cx) / Math.max(1, e.rx), (p.y - e.cy) / Math.max(1, e.ry));
}

export function projectOntoEllipse(p: Vec, e: EllipseGeom): Vec {
  const a = Math.atan2((p.y - e.cy) / Math.max(1, e.ry), (p.x - e.cx) / Math.max(1, e.rx));
  return { x: e.cx + Math.cos(a) * e.rx, y: e.cy + Math.sin(a) * e.ry };
}

/** Projects p onto the line through `from` and the nearer vanishing point. */
export function projectOntoPerspective(from: Vec, p: Vec, vps: Vec[]): Vec {
  let best = p;
  let bestD = Infinity;
  for (const vp of vps) {
    const dx = vp.x - from.x;
    const dy = vp.y - from.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1) continue;
    const t = ((p.x - from.x) * dx + (p.y - from.y) * dy) / len2;
    const q = { x: from.x + dx * t, y: from.y + dy * t };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) { bestD = d; best = q; }
  }
  // Also allow plain horizontals / verticals (the third axis in 2-point perspective).
  const h = { x: p.x, y: from.y };
  const v = { x: from.x, y: p.y };
  if (Math.abs(p.y - from.y) < bestD) { bestD = Math.abs(p.y - from.y); best = h; }
  if (Math.abs(p.x - from.x) < bestD) { best = v; }
  return best;
}

/** Draws framing guides, perspective grids, rulers and their handles (pixel-space ctx). */
export function drawGuides(ctx: CanvasRenderingContext2D, w: number, h: number, o: GuideOptions) {
  const sx = w / BASE_W;
  const sy = h / BASE_H;
  const px = o.px;
  const ink = o.paper ? '15, 23, 42' : '255, 255, 255';

  ctx.save();
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';

  if (o.rulerMode === 'perspective1' || o.rulerMode === 'perspective2') {
    const vps = o.rulerMode === 'perspective1' ? [o.vp1] : [o.vp1, o.vp2];
    ctx.strokeStyle = o.paper ? 'rgba(2, 132, 199, 0.32)' : 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = px;
    ctx.setLineDash([4 * px, 4 * px]);
    ctx.beginPath(); ctx.moveTo(0, o.vp1.y); ctx.lineTo(BASE_W, o.vp1.y); ctx.stroke();
    if (o.rulerMode === 'perspective2' && Math.abs(o.vp2.y - o.vp1.y) > 1) {
      ctx.beginPath(); ctx.moveTo(0, o.vp2.y); ctx.lineTo(BASE_W, o.vp2.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    const rays = o.rulerMode === 'perspective1' ? 24 : 18;
    for (const vp of vps) {
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(vp.x, vp.y);
        ctx.lineTo(vp.x + Math.cos(a) * 2000, vp.y + Math.sin(a) * 2000);
        ctx.stroke();
      }
    }
  }

  if (o.rulerMode === 'straight') {
    const rad = (o.ruler.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const L = 2000;
    // Translucent ruler body on the "far" side of the drawing edge.
    ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
    ctx.beginPath();
    ctx.moveTo(o.ruler.x - cos * L, o.ruler.y - sin * L);
    ctx.lineTo(o.ruler.x + cos * L, o.ruler.y + sin * L);
    ctx.lineTo(o.ruler.x + cos * L - sin * 36, o.ruler.y + sin * L + cos * 36);
    ctx.lineTo(o.ruler.x - cos * L - sin * 36, o.ruler.y - sin * L + cos * 36);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.85)';
    ctx.lineWidth = 1.5 * px;
    ctx.beginPath();
    ctx.moveTo(o.ruler.x - cos * L, o.ruler.y - sin * L);
    ctx.lineTo(o.ruler.x + cos * L, o.ruler.y + sin * L);
    ctx.stroke();
    // Tick marks every 10 units
    ctx.lineWidth = px;
    for (let t = -800; t <= 800; t += 10) {
      const len = t % 50 === 0 ? 9 : 4;
      const bx = o.ruler.x + cos * t;
      const by = o.ruler.y + sin * t;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - sin * len, by + cos * len);
      ctx.stroke();
    }
  }

  if (o.rulerMode === 'circle') {
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
    ctx.lineWidth = 1.5 * px;
    ctx.beginPath();
    ctx.ellipse(o.ellipse.cx, o.ellipse.cy, Math.max(1, o.ellipse.rx), Math.max(1, o.ellipse.ry), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([3 * px, 3 * px]);
    ctx.lineWidth = px;
    ctx.beginPath();
    ctx.moveTo(o.ellipse.cx, o.ellipse.cy); ctx.lineTo(o.ellipse.cx + o.ellipse.rx, o.ellipse.cy);
    ctx.moveTo(o.ellipse.cx, o.ellipse.cy); ctx.lineTo(o.ellipse.cx, o.ellipse.cy + o.ellipse.ry);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (o.showRuleOfThirds) {
    ctx.strokeStyle = `rgba(${ink}, 0.16)`;
    ctx.lineWidth = px;
    ctx.setLineDash([6 * px, 6 * px]);
    ctx.beginPath();
    ctx.moveTo(0, BASE_H / 3); ctx.lineTo(BASE_W, BASE_H / 3);
    ctx.moveTo(0, (BASE_H * 2) / 3); ctx.lineTo(BASE_W, (BASE_H * 2) / 3);
    ctx.moveTo(BASE_W / 3, 0); ctx.lineTo(BASE_W / 3, BASE_H);
    ctx.moveTo((BASE_W * 2) / 3, 0); ctx.lineTo((BASE_W * 2) / 3, BASE_H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (o.showSafeAreas) {
    ctx.lineWidth = px;
    ctx.setLineDash([4 * px, 4 * px]);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
    ctx.strokeRect(BASE_W * 0.05, BASE_H * 0.05, BASE_W * 0.9, BASE_H * 0.9);
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
    ctx.strokeRect(BASE_W * 0.1, BASE_H * 0.1, BASE_W * 0.8, BASE_H * 0.8);
    ctx.setLineDash([]);
  }

  if (o.showCenterCrosshair) {
    ctx.strokeStyle = `rgba(${ink}, 0.3)`;
    ctx.lineWidth = px;
    const c = 14;
    ctx.beginPath();
    ctx.moveTo(BASE_W / 2 - c, BASE_H / 2); ctx.lineTo(BASE_W / 2 + c, BASE_H / 2);
    ctx.moveTo(BASE_W / 2, BASE_H / 2 - c); ctx.lineTo(BASE_W / 2, BASE_H / 2 + c);
    ctx.stroke();
  }

  if (o.aspectRatio !== '16:9') {
    const target = o.aspectRatio === '2.39:1' ? 2.39 : o.aspectRatio === '1.85:1' ? 1.85 : o.aspectRatio === '4:3' ? 4 / 3 : 9 / 16;
    ctx.fillStyle = o.paper ? 'rgba(15, 23, 42, 0.18)' : 'rgba(0, 0, 0, 0.6)';
    ctx.strokeStyle = `rgba(${ink}, 0.4)`;
    ctx.lineWidth = px;
    if (target > BASE_W / BASE_H) {
      const activeH = BASE_W / target;
      const bar = (BASE_H - activeH) / 2;
      ctx.fillRect(0, 0, BASE_W, bar);
      ctx.fillRect(0, BASE_H - bar, BASE_W, bar);
      ctx.strokeRect(0, bar, BASE_W, activeH);
    } else {
      const activeW = BASE_H * target;
      const bar = (BASE_W - activeW) / 2;
      ctx.fillRect(0, 0, bar, BASE_H);
      ctx.fillRect(BASE_W - bar, 0, bar, BASE_H);
      ctx.strokeRect(bar, 0, activeW, BASE_H);
    }
  }

  // Draggable handles, sized in screen pixels so they stay easy to grab with a finger.
  for (const hd of guideHandles(o)) {
    const active = o.activeHandle === hd.kind;
    const r = (active ? 9 : 7) * px;
    const color =
      hd.kind.startsWith('ruler') ? '#eab308' : hd.kind.startsWith('ellipse') ? '#a855f7' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(hd.x, hd.y, r + 3 * px, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hd.x, hd.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5 * px;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    if (hd.kind === 'ruler-rotate') {
      ctx.beginPath();
      ctx.arc(hd.x, hd.y, r * 0.45, 0, Math.PI * 1.5);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.2 * px;
      ctx.stroke();
    }
  }

  ctx.restore();
}
