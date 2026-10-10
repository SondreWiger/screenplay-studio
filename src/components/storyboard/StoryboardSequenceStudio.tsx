'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Badge, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Shot, Scene } from '@/lib/types';
import { requestSidebarCompact, isSidebarCurrentlyCollapsed } from '@/lib/sidebar-collapse';

// ── Types ─────────────────────────────────────────────────────────────

export type BrushTool =
  | 'pencil'      // Rough graphite pencil (organic texture & pressure)
  | 'ink'         // Studio inking pen (crisp, dynamic taper)
  | 'marker'      // Chisel storyboard marker (semi-transparent wash for values)
  | 'fineliner'   // Technical pen (uniform architectural lines)
  | 'arrow'       // Camera / Action vector arrow (draws directional movement with arrowhead)
  | 'eraser';     // Precision brush eraser

export type RulerMode =
  | 'none'
  | 'straight'     // Draggable straightedge ruler with angle snapping
  | 'perspective1' // 1-Point Perspective grid & vanishing point
  | 'perspective2' // 2-Point Perspective grid & 2 vanishing points
  | 'circle';      // Circle / Ellipse guide

export type AspectRatioGuide =
  | '16:9'         // 1.78:1 (Standard HD/4K)
  | '2.39:1'       // 2.39:1 (Anamorphic CinemaScope)
  | '1.85:1'       // 1.85:1 (Theatrical Flat)
  | '4:3'          // 1.33:1 (Academy ratio)
  | '9:16';        // 0.56:1 (Vertical social / mobile)

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
  opacity: number; // 0.0 to 1.0
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
}

export interface OverlayConfig {
  enabled: boolean;
  source: 'prev' | 'next' | 'custom' | 'reference';
  customShotId?: string;
  opacity: number; // 0.1 to 0.8
  tint: 'mono' | 'amber' | 'cyan' | 'original';
}

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

export function getPressureWidth(baseWidth: number, pressure = 0.5, tool: BrushTool = 'ink', isPressureSensitive = true): number {
  if (!isPressureSensitive || tool === 'fineliner') return baseWidth;
  const p = Math.max(0.04, Math.min(1, pressure));

  if (tool === 'pencil') {
    // Softer response curve for graphite
    const factor = 0.35 + 1.15 * Math.pow(p, 0.9);
    return Math.max(1, baseWidth * factor);
  }
  if (tool === 'marker') {
    // Marker width expands subtly
    const factor = 0.75 + 0.5 * p;
    return Math.max(2, baseWidth * factor);
  }
  // Ink & Arrow default dynamic curve
  const factor = 0.25 + 1.35 * Math.pow(p, 0.85);
  return Math.max(1, baseWidth * factor);
}

/** Converts any existing database drawing into a normalized array of DrawingLayer */
export function normalizeToLayers(drawing: any): DrawingLayer[] {
  if (!drawing || !Array.isArray(drawing) || drawing.length === 0) {
    return [
      { id: 'bg', name: 'Background', visible: true, locked: false, opacity: 1, strokes: [] },
      { id: 'char', name: 'Characters / Action', visible: true, locked: false, opacity: 1, strokes: [] },
      { id: 'cam', name: 'Camera & Notes', visible: true, locked: false, opacity: 1, strokes: [] },
    ];
  }

  // Already layers format: items have .strokes
  if ('strokes' in drawing[0]) {
    return drawing.map((l: any, i: number) => ({
      id: l.id || `layer-${i}`,
      name: l.name || `Layer ${i + 1}`,
      visible: l.visible !== false,
      locked: Boolean(l.locked),
      opacity: typeof l.opacity === 'number' ? l.opacity : 1,
      strokes: Array.isArray(l.strokes) ? l.strokes : [],
    }));
  }

  // Flat array of strokes: put into middle Artwork layer
  return [
    { id: 'bg', name: 'Background', visible: true, locked: false, opacity: 1, strokes: [] },
    { id: 'char', name: 'Artwork', visible: true, locked: false, opacity: 1, strokes: drawing as DrawingStroke[] },
    { id: 'cam', name: 'Camera & Notes', visible: true, locked: false, opacity: 1, strokes: [] },
  ];
}

/** Flatten layers into single list of visible strokes (for thumbnail generation) */
export function flattenLayersToStrokes(layers: DrawingLayer[]): DrawingStroke[] {
  const result: DrawingStroke[] = [];
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    for (const s of layer.strokes) {
      if (layer.opacity < 1) {
        result.push({
          ...s,
          color: hexToRgba(s.color, layer.opacity),
        });
      } else {
        result.push(s);
      }
    }
  }
  return result;
}

// ── Rendering Engine ──────────────────────────────────────────────────

export function renderStudioCanvas(
  ctx: CanvasRenderingContext2D,
  layers: DrawingLayer[],
  activeStroke: { layerId: string; stroke: DrawingStroke } | null,
  overlayShot: ShotWithStoryboard | null,
  overlayConfig: OverlayConfig,
  targetWidth: number,
  targetHeight: number,
  baseWidth = 640,
  baseHeight = 360,
  options?: {
    aspectRatio?: AspectRatioGuide;
    showRuleOfThirds?: boolean;
    showSafeAreas?: boolean;
    showCenterCrosshair?: boolean;
    rulerMode?: RulerMode;
    rulerAngle?: number;
    rulerPos?: { x: number; y: number };
    vp1?: { x: number; y: number };
    vp2?: { x: number; y: number };
    ellipseGuide?: { cx: number; cy: number; rx: number; ry: number };
    dpr?: number;
  }
) {
  const dpr = options?.dpr ?? 1;
  ctx.save();
  ctx.clearRect(0, 0, targetWidth * dpr, targetHeight * dpr);
  ctx.scale((targetWidth / baseWidth) * dpr, (targetHeight / baseHeight) * dpr);

  // 1. Subtle canvas background grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < baseWidth; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, baseHeight); ctx.stroke();
  }
  for (let y = 0; y < baseHeight; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(baseWidth, y); ctx.stroke();
  }

  // 2. Onion Skin / Shot Overlay Layer
  if (overlayConfig.enabled && overlayShot) {
    ctx.save();
    ctx.globalAlpha = overlayConfig.opacity;

    // Overlay drawing from normalized layers or flat strokes
    const overlayLayers = normalizeToLayers(overlayShot.storyboard_drawing);
    const overlayStrokes = flattenLayersToStrokes(overlayLayers);

    for (const stroke of overlayStrokes) {
      if (!stroke.points || stroke.points.length === 0) continue;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let tintColor = stroke.color;
      if (overlayConfig.tint === 'amber') tintColor = '#f97316';
      else if (overlayConfig.tint === 'cyan') tintColor = '#06b6d4';
      else if (overlayConfig.tint === 'mono') tintColor = '#94a3b8';

      ctx.strokeStyle = tintColor;
      ctx.fillStyle = tintColor;
      ctx.lineWidth = stroke.width;

      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, Math.max(1, stroke.width / 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // 3. Render Active Drawing Layers
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;

    ctx.save();
    ctx.globalAlpha = layer.opacity;

    const layerStrokes = [...layer.strokes];
    if (activeStroke && activeStroke.layerId === layer.id) {
      layerStrokes.push(activeStroke.stroke);
    }

    for (const stroke of layerStrokes) {
      if (!stroke.points || stroke.points.length === 0) continue;

      const isEraser = stroke.tool === 'eraser';
      const isMarker = stroke.tool === 'marker';
      const isPencil = stroke.tool === 'pencil';
      const isArrow = stroke.tool === 'arrow';

      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let strokeColor = stroke.color;
      if (isEraser) {
        strokeColor = 'rgba(0,0,0,1)';
      } else if (isMarker) {
        strokeColor = hexToRgba(stroke.color, 0.32);
      } else if (isPencil) {
        strokeColor = hexToRgba(stroke.color, 0.88);
      }

      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;

      // Single point dot / tap
      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        const pr = p.pressure ?? 0.5;
        const width = isEraser
          ? stroke.width
          : getPressureWidth(stroke.width, pr, stroke.tool, stroke.pressureSensitive !== false);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, width / 2), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      // Multi-point stroke
      const hasPressureVariation =
        stroke.pressureSensitive !== false &&
        !isEraser &&
        stroke.tool !== 'fineliner' &&
        stroke.points.some(pt => pt.pressure !== undefined && Math.abs(pt.pressure - 0.5) > 0.04);

      if (hasPressureVariation) {
        for (let i = 0; i < stroke.points.length - 1; i++) {
          const p1 = stroke.points[i];
          const p2 = stroke.points[i + 1];
          const pr = ((p1.pressure ?? 0.5) + (p2.pressure ?? 0.5)) / 2;
          ctx.lineWidth = getPressureWidth(stroke.width, pr, stroke.tool, true);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      } else {
        // Smooth quadratic Bezier curve
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

      // If Arrow tool, render sharp cinematic directional arrowhead at the tip!
      if (isArrow && stroke.points.length >= 2) {
        const lastPt = stroke.points[stroke.points.length - 1];
        // Calculate tangent angle from previous points
        const lookback = Math.max(0, stroke.points.length - 4);
        const refPt = stroke.points[lookback];
        const angle = Math.atan2(lastPt.y - refPt.y, lastPt.x - refPt.x);
        const headLen = Math.max(12, stroke.width * 2.6);

        ctx.beginPath();
        ctx.moveTo(lastPt.x, lastPt.y);
        ctx.lineTo(
          lastPt.x - headLen * Math.cos(angle - Math.PI / 6),
          lastPt.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          lastPt.x - (headLen * 0.7) * Math.cos(angle),
          lastPt.y - (headLen * 0.7) * Math.sin(angle)
        );
        ctx.lineTo(
          lastPt.x - headLen * Math.cos(angle + Math.PI / 6),
          lastPt.y - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // 4. Overlays & Rulers (Perspective, Straightedge, Aspect Mattes)
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  // 4a. 1-Point Perspective Guide
  if (options?.rulerMode === 'perspective1') {
    const vp = options.vp1 || { x: baseWidth / 2, y: baseHeight / 2 };
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 1;

    // Horizon line
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, vp.y); ctx.lineTo(baseWidth, vp.y); ctx.stroke();

    // Perspective rays radiating from VP
    ctx.setLineDash([]);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(vp.x + Math.cos(angle) * 1200, vp.y + Math.sin(angle) * 1200);
      ctx.stroke();
    }

    // Vanishing Point Reticle
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(vp.x, vp.y, 4, 0, Math.PI * 2); ctx.fill();
  }

  // 4b. 2-Point Perspective Guide
  if (options?.rulerMode === 'perspective2') {
    const vp1 = options.vp1 || { x: 40, y: baseHeight * 0.55 };
    const vp2 = options.vp2 || { x: baseWidth - 40, y: baseHeight * 0.55 };
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1;

    // Horizon line
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, vp1.y); ctx.lineTo(baseWidth, vp1.y); ctx.stroke();

    ctx.setLineDash([]);
    for (let angle = -Math.PI / 2; angle <= Math.PI / 2; angle += Math.PI / 10) {
      ctx.beginPath(); ctx.moveTo(vp1.x, vp1.y); ctx.lineTo(vp1.x + Math.cos(angle) * 800, vp1.y + Math.sin(angle) * 800); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(vp2.x, vp2.y); ctx.lineTo(vp2.x - Math.cos(angle) * 800, vp2.y + Math.sin(angle) * 800); ctx.stroke();
    }

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(vp1.x, vp1.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(vp2.x, vp2.y, 4, 0, Math.PI * 2); ctx.fill();
  }

  // 4c. Straightedge Ruler Guide
  if (options?.rulerMode === 'straight') {
    const rPos = options.rulerPos || { x: baseWidth / 2, y: baseHeight / 2 };
    const angle = options.rulerAngle || 0;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    ctx.strokeStyle = 'rgba(234, 179, 8, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rPos.x - cos * 600, rPos.y - sin * 600);
    ctx.lineTo(rPos.x + cos * 600, rPos.y + sin * 600);
    ctx.stroke();

    // Normal edge / ruler body
    ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
    ctx.beginPath();
    ctx.moveTo(rPos.x - cos * 600, rPos.y - sin * 600);
    ctx.lineTo(rPos.x + cos * 600, rPos.y + sin * 600);
    ctx.lineTo(rPos.x + cos * 600 - sin * 40, rPos.y + sin * 600 + cos * 40);
    ctx.lineTo(rPos.x - cos * 600 - sin * 40, rPos.y - sin * 600 + cos * 40);
    ctx.closePath();
    ctx.fill();

    // Center pivot point
    ctx.fillStyle = '#eab308';
    ctx.beginPath(); ctx.arc(rPos.x, rPos.y, 5, 0, Math.PI * 2); ctx.fill();
  }

  // 4d. Rule of Thirds
  if (options?.showRuleOfThirds) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(0, baseHeight / 3); ctx.lineTo(baseWidth, baseHeight / 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, (baseHeight * 2) / 3); ctx.lineTo(baseWidth, (baseHeight * 2) / 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(baseWidth / 3, 0); ctx.lineTo(baseWidth / 3, baseHeight); ctx.stroke();
    ctx.beginPath(); ctx.moveTo((baseWidth * 2) / 3, 0); ctx.lineTo((baseWidth * 2) / 3, baseHeight); ctx.stroke();
    ctx.setLineDash([]);
  }

  // 4e. Broadcast Safe Areas (90% Action Safe & 80% Title Safe)
  if (options?.showSafeAreas) {
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.28)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    // 90% Action Safe
    ctx.strokeRect(baseWidth * 0.05, baseHeight * 0.05, baseWidth * 0.9, baseHeight * 0.9);
    // 80% Title Safe
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.28)';
    ctx.strokeRect(baseWidth * 0.1, baseHeight * 0.1, baseWidth * 0.8, baseHeight * 0.8);
    ctx.setLineDash([]);
  }

  // 4f. Center Crosshair
  if (options?.showCenterCrosshair) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(baseWidth / 2, 0); ctx.lineTo(baseWidth / 2, baseHeight); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, baseHeight / 2); ctx.lineTo(baseWidth, baseHeight / 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // 4g. Aspect Ratio Framing Mattes (CinemaScope 2.39:1, Theatrical Flat 1.85:1, 4:3, 9:16)
  const ratio = options?.aspectRatio || '16:9';
  if (ratio !== '16:9') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    if (ratio === '2.39:1') {
      const activeH = baseWidth / 2.39;
      const barH = (baseHeight - activeH) / 2;
      ctx.fillRect(0, 0, baseWidth, barH);
      ctx.fillRect(0, baseHeight - barH, baseWidth, barH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.strokeRect(0, barH, baseWidth, activeH);
    } else if (ratio === '1.85:1') {
      const activeH = baseWidth / 1.85;
      const barH = (baseHeight - activeH) / 2;
      ctx.fillRect(0, 0, baseWidth, barH);
      ctx.fillRect(0, baseHeight - barH, baseWidth, barH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.strokeRect(0, barH, baseWidth, activeH);
    } else if (ratio === '4:3') {
      const activeW = baseHeight * (4 / 3);
      const barW = (baseWidth - activeW) / 2;
      ctx.fillRect(0, 0, barW, baseHeight);
      ctx.fillRect(baseWidth - barW, 0, barW, baseHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.strokeRect(barW, 0, activeW, baseHeight);
    } else if (ratio === '9:16') {
      const activeW = baseHeight * (9 / 16);
      const barW = (baseWidth - activeW) / 2;
      ctx.fillRect(0, 0, barW, baseHeight);
      ctx.fillRect(baseWidth - barW, 0, barW, baseHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.strokeRect(barW, 0, activeW, baseHeight);
    }
  }

  ctx.restore();
  ctx.restore();
}

// ── Color Palette & Brush Presets ─────────────────────────────────────

export const STUDIO_COLORS = [
  { label: 'Chalk White', hex: '#ffffff' },
  { label: 'Charcoal Black', hex: '#1e293b' },
  { label: 'Action Red', hex: '#ef4444' },
  { label: 'Camera Blue', hex: '#3b82f6' },
  { label: 'Key Light Amber', hex: '#f59e0b' },
  { label: 'Practical Green', hex: '#10b981' },
  { label: 'VFX Purple', hex: '#a855f7' },
  { label: 'Sketch Slate', hex: '#64748b' },
];

export const TOOL_DEFINITIONS: { tool: BrushTool; label: string; icon: string; desc: string }[] = [
  { tool: 'pencil', label: 'Rough Pencil', icon: '✏️', desc: 'Soft graphite lead simulation with pressure & tilt' },
  { tool: 'ink', label: 'Studio Ink', icon: '✒️', desc: 'Clean, bold contour ink pen with dynamic taper' },
  { tool: 'marker', label: 'Chisel Marker', icon: '🖍️', desc: 'Semi-transparent wash for lighting & shading values' },
  { tool: 'fineliner', label: 'Tech Pen', icon: '🖊️', desc: 'Uniform precision width for architecture & props' },
  { tool: 'arrow', label: 'Action Arrow', icon: '↗️', desc: 'Draws directional camera moves and actor vectors' },
  { tool: 'eraser', label: 'Eraser', icon: '🧼', desc: 'Erases strokes on the active layer' },
];

// ── Storyboard Sequence Studio Component ──────────────────────────────

interface StoryboardSequenceStudioProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  initialShotId?: string;
  scenes: Scene[];
  allShots: ShotWithStoryboard[];
  onShotsUpdated: (updatedShots: ShotWithStoryboard[]) => void;
}

export function StoryboardSequenceStudio({
  isOpen,
  onClose,
  projectId,
  initialShotId,
  scenes,
  allShots,
  onShotsUpdated,
}: StoryboardSequenceStudioProps) {
  // Navigation & Active Shot
  const [shots, setShots] = useState<ShotWithStoryboard[]>(allShots);
  const [activeShotId, setActiveShotId] = useState<string>(initialShotId || allShots[0]?.id || '');
  const [activeSceneId, setActiveSceneId] = useState<string>('all');

  useEffect(() => {
    setShots(allShots);
  }, [allShots]);

  useEffect(() => {
    if (initialShotId) setActiveShotId(initialShotId);
  }, [initialShotId]);

  // ── Auto-compact Project Sidebar on Open & Restore on Close ─────────
  useEffect(() => {
    if (!isOpen) return;

    // Record whether sidebar was already collapsed before Sequence Studio opened
    const wasAlreadyCollapsed = isSidebarCurrentlyCollapsed();

    // Auto-compact the sidebar to give the studio maximum canvas space
    requestSidebarCompact(true);

    // Escape key listener to close studio
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Restore previous state if sidebar was originally expanded
      if (!wasAlreadyCollapsed) {
        requestSidebarCompact(false);
      }
    };
  }, [isOpen, onClose]);

  // Find active shot
  const currentShot = useMemo(() => {
    return shots.find((s) => s.id === activeShotId) || shots[0] || null;
  }, [shots, activeShotId]);

  // Set active scene matching current shot
  useEffect(() => {
    if (currentShot?.scene_id) {
      setActiveSceneId(currentShot.scene_id);
    }
  }, [currentShot?.id]);

  // Shots in the current sequence (scene-filtered or all)
  const sequenceShots = useMemo(() => {
    if (activeSceneId === 'all') return shots;
    return shots.filter((s) => s.scene_id === activeSceneId);
  }, [shots, activeSceneId]);

  const currentIndexInSeq = useMemo(() => {
    return sequenceShots.findIndex((s) => s.id === activeShotId);
  }, [sequenceShots, activeShotId]);

  // ── Multi-Layer Drawing State ───────────────────────────────────────
  const [layers, setLayers] = useState<DrawingLayer[]>(() => normalizeToLayers(currentShot?.storyboard_drawing));
  const [activeLayerId, setActiveLayerId] = useState<string>('char');
  const [undoStack, setUndoStack] = useState<DrawingLayer[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingLayer[][]>([]);

  // Reload layers when active shot changes
  useEffect(() => {
    if (currentShot) {
      const initial = normalizeToLayers(currentShot.storyboard_drawing);
      setLayers(initial);
      setActiveLayerId(initial[1]?.id || initial[0]?.id || 'char');
      setUndoStack([]);
      setRedoStack([]);
    }
  }, [currentShot?.id]);

  // ── Drawing Tool & Apple Pencil State ──────────────────────────────
  const [tool, setTool] = useState<BrushTool>('pencil');
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(5);
  const [pressureSensitive, setPressureSensitive] = useState(true);
  const [palmRejectionMode, setPalmRejectionMode] = useState<'auto' | 'pencil-only' | 'all'>('auto');
  const [isApplePencilActive, setIsApplePencilActive] = useState(false);
  const [livePressure, setLivePressure] = useState(0);

  // ── Rulers & Framing Guides ─────────────────────────────────────────
  const [rulerMode, setRulerMode] = useState<RulerMode>('none');
  const [rulerAngle, setRulerAngle] = useState(0);
  const [rulerPos, setRulerPos] = useState({ x: 320, y: 180 });
  const [vp1, setVp1] = useState({ x: 320, y: 180 });
  const [vp2, setVp2] = useState({ x: 600, y: 180 });
  const [aspectRatio, setAspectRatio] = useState<AspectRatioGuide>('16:9');
  const [showRuleOfThirds, setShowRuleOfThirds] = useState(true);
  const [showSafeAreas, setShowSafeAreas] = useState(false);
  const [showCenterCrosshair, setShowCenterCrosshair] = useState(false);
  const [straightLineMode, setStraightLineMode] = useState(false);

  // ── Overlay & Onion Skinning ────────────────────────────────────────
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>({
    enabled: false,
    source: 'prev',
    opacity: 0.35,
    tint: 'amber',
  });
  const [showOverlayMenu, setShowOverlayMenu] = useState(false);
  const [showRulerMenu, setShowRulerMenu] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(true);
  const [showFilmstrip, setShowFilmstrip] = useState(true);

  // Determine which shot to overlay
  const overlayShot = useMemo(() => {
    if (!overlayConfig.enabled) return null;
    if (overlayConfig.source === 'prev') {
      return currentIndexInSeq > 0 ? sequenceShots[currentIndexInSeq - 1] : null;
    }
    if (overlayConfig.source === 'next') {
      return currentIndexInSeq < sequenceShots.length - 1 ? sequenceShots[currentIndexInSeq + 1] : null;
    }
    if (overlayConfig.source === 'custom' && overlayConfig.customShotId) {
      return shots.find((s) => s.id === overlayConfig.customShotId) || null;
    }
    return null;
  }, [overlayConfig, currentIndexInSeq, sequenceShots, shots]);

  // ── Animatic Playback ───────────────────────────────────────────────
  const [isPlayingAnimatic, setIsPlayingAnimatic] = useState(false);
  const [animaticLoop, setAnimaticLoop] = useState(true);
  const animaticTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Canvas References & DPR ─────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dpr, setDpr] = useState(1);
  const [hoverPos, setHoverPos] = useState<DrawingPoint | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDpr(Math.min(window.devicePixelRatio || 1, 3));
    }
  }, []);

  const activeStrokeRef = useRef<{ layerId: string; stroke: DrawingStroke } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const isPencilDrawingRef = useRef(false);
  const lastPencilTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // ── Synchronize Canvas Rendering ────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderStudioCanvas(
      ctx,
      layers,
      activeStrokeRef.current,
      overlayShot,
      overlayConfig,
      640,
      360,
      640,
      360,
      {
        aspectRatio,
        showRuleOfThirds,
        showSafeAreas,
        showCenterCrosshair,
        rulerMode,
        rulerAngle,
        rulerPos,
        vp1,
        vp2,
        dpr,
      }
    );
  }, [
    layers,
    overlayShot,
    overlayConfig,
    aspectRatio,
    showRuleOfThirds,
    showSafeAreas,
    showCenterCrosshair,
    rulerMode,
    rulerAngle,
    rulerPos,
    vp1,
    vp2,
    dpr,
  ]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // ── Auto-Save to Supabase ───────────────────────────────────────────
  const saveCurrentShot = useCallback(async (customLayers?: DrawingLayer[]) => {
    if (!currentShot) return;
    const layersToSave = customLayers || layers;
    const supabase = createClient();

    try {
      await supabase.from('shots').update({
        storyboard_drawing: layersToSave,
      }).eq('id', currentShot.id);

      // Update in-memory state
      setShots((prev) =>
        prev.map((s) => (s.id === currentShot.id ? { ...s, storyboard_drawing: layersToSave } : s))
      );
      onShotsUpdated(
        shots.map((s) => (s.id === currentShot.id ? { ...s, storyboard_drawing: layersToSave } : s))
      );
    } catch (err) {
      console.error('Failed to save shot:', err);
    }
  }, [currentShot, layers, shots, onShotsUpdated]);

  // ── Sequence Navigation ─────────────────────────────────────────────
  const goToShot = useCallback(async (targetId: string) => {
    if (targetId === activeShotId) return;
    await saveCurrentShot();
    setActiveShotId(targetId);
  }, [activeShotId, saveCurrentShot]);

  const goToNextShot = useCallback(async () => {
    if (currentIndexInSeq < sequenceShots.length - 1) {
      await goToShot(sequenceShots[currentIndexInSeq + 1].id);
    } else if (animaticLoop && sequenceShots.length > 0) {
      await goToShot(sequenceShots[0].id);
    }
  }, [currentIndexInSeq, sequenceShots, animaticLoop, goToShot]);

  const goToPrevShot = useCallback(async () => {
    if (currentIndexInSeq > 0) {
      await goToShot(sequenceShots[currentIndexInSeq - 1].id);
    }
  }, [currentIndexInSeq, sequenceShots, goToShot]);

  // ── Animatic Playback Engine ────────────────────────────────────────
  useEffect(() => {
    if (!isPlayingAnimatic) {
      if (animaticTimerRef.current) clearTimeout(animaticTimerRef.current);
      return;
    }

    const durationSec = currentShot?.duration_seconds || 2.5;
    animaticTimerRef.current = setTimeout(() => {
      goToNextShot();
    }, durationSec * 1000);

    return () => {
      if (animaticTimerRef.current) clearTimeout(animaticTimerRef.current);
    };
  }, [isPlayingAnimatic, currentShot?.id, currentShot?.duration_seconds, goToNextShot]);

  // ── Undo / Redo System ──────────────────────────────────────────────
  const pushHistory = useCallback(() => {
    setUndoStack((prev) => [...prev, layers]);
    setRedoStack([]);
  }, [layers]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, layers]);
    setLayers(previous);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack, layers]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, layers]);
    setLayers(next);
    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack, layers]);

  // ── Layer Management ────────────────────────────────────────────────
  const activeLayer = useMemo(() => {
    return layers.find((l) => l.id === activeLayerId) || layers[0];
  }, [layers, activeLayerId]);

  const toggleLayerVisible = (layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  };

  const toggleLayerLocked = (layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l))
    );
  };

  const updateLayerOpacity = (layerId: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
  };

  const addLayer = () => {
    pushHistory();
    const newId = `layer-${Date.now()}`;
    const newLayer: DrawingLayer = {
      id: newId,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      strokes: [],
    };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newId);
  };

  const deleteLayer = (layerId: string) => {
    if (layers.length <= 1) {
      toast('Cannot delete the last remaining layer', 'info');
      return;
    }
    pushHistory();
    setLayers((prev) => prev.filter((l) => l.id !== layerId));
    if (activeLayerId === layerId) {
      setActiveLayerId(layers[0]?.id || '');
    }
  };

  const moveLayer = (layerId: string, dir: 'up' | 'down') => {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= layers.length) return;
    pushHistory();
    const copy = [...layers];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    setLayers(copy);
  };

  const clearActiveLayer = () => {
    if (!activeLayer || activeLayer.locked) return;
    pushHistory();
    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayer.id ? { ...l, strokes: [] } : l))
    );
  };

  // ── Pointer Coordinates Calculation ────────────────────────────────
  const getCanvasPos = useCallback((e: PointerEvent): DrawingPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = 640 / rect.width;
    const scaleY = 360 / rect.height;
    let x = Math.max(0, Math.min(640, (e.clientX - rect.left) * scaleX));
    let y = Math.max(0, Math.min(360, (e.clientY - rect.top) * scaleY));

    // Snapping to Ruler edge if active
    if (rulerMode === 'straight') {
      const rad = (rulerAngle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      // Distance from point to line
      const dist = (x - rulerPos.x) * -sin + (y - rulerPos.y) * cos;
      if (Math.abs(dist) < 28) {
        x = x + dist * sin;
        y = y - dist * cos;
      }
    }

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
  }, [rulerMode, rulerAngle, rulerPos]);

  // ── High Performance Native Pointer Events ──────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.buttons !== 1) return;
      const isPen = e.pointerType === 'pen';

      if (isPen) {
        lastPencilTimeRef.current = Date.now();
        isPencilDrawingRef.current = true;
        setIsApplePencilActive(true);
        setLivePressure(e.pressure || 0.5);
      }

      // Palm Rejection Guard
      if (palmRejectionMode === 'pencil-only' && !isPen) return;
      if (palmRejectionMode === 'auto') {
        if (!isPen && (isPencilDrawingRef.current || Date.now() - lastPencilTimeRef.current < 1200)) return;
        if (!isPen && (e.width > 22 || e.height > 22)) return;
      }

      if (activeLayer?.locked) {
        toast('Active layer is locked. Unlock it in the Layers panel to draw.', 'warning');
        return;
      }

      if (activePointerIdRef.current !== null) return;

      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      activePointerIdRef.current = e.pointerId;

      const pt = getCanvasPos(e);
      activeStrokeRef.current = {
        layerId: activeLayer.id,
        stroke: {
          points: [pt],
          color,
          width: brushSize,
          tool,
          pressureSensitive,
        },
      };

      redrawCanvas();
    };

    const onPointerMove = (e: PointerEvent) => {
      const isPen = e.pointerType === 'pen';

      // Apple Pencil Hover
      if (e.buttons === 0) {
        if (isPen) {
          setIsApplePencilActive(true);
          setHoverPos(getCanvasPos(e));
        } else {
          setHoverPos(null);
        }
        return;
      }

      if (activePointerIdRef.current !== e.pointerId || !activeStrokeRef.current) return;
      e.preventDefault();

      if (isPen) {
        lastPencilTimeRef.current = Date.now();
        setLivePressure(e.pressure || 0.5);
      }

      // Read high-frequency coalesced events from digitizer (120-240Hz)
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      for (const cev of events) {
        const pt = getCanvasPos(cev);
        activeStrokeRef.current.stroke.points.push(pt);
      }

      if (animFrameRef.current === null) {
        animFrameRef.current = requestAnimationFrame(() => {
          animFrameRef.current = null;
          redrawCanvas();
        });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      e.preventDefault();

      try { canvas.releasePointerCapture(e.pointerId); } catch {}

      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      activePointerIdRef.current = null;
      isPencilDrawingRef.current = false;
      setLivePressure(0);

      const active = activeStrokeRef.current;
      if (active && active.stroke.points.length > 0) {
        pushHistory();

        // If Straight Line Mode is on, simplify points to straight line
        let finalStroke = active.stroke;
        if (straightLineMode && finalStroke.points.length > 2) {
          finalStroke = {
            ...finalStroke,
            points: [finalStroke.points[0], finalStroke.points[finalStroke.points.length - 1]],
          };
        }

        const nextLayers = layers.map((l) =>
          l.id === active.layerId ? { ...l, strokes: [...l.strokes, finalStroke] } : l
        );
        setLayers(nextLayers);
      }

      activeStrokeRef.current = null;
      redrawCanvas();
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      activePointerIdRef.current = null;
      isPencilDrawingRef.current = false;
      activeStrokeRef.current = null;
      setLivePressure(0);
      redrawCanvas();
    };

    const onTouchPrevent = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp, { passive: false });
    canvas.addEventListener('pointercancel', onPointerCancel, { passive: false });
    canvas.addEventListener('touchstart', onTouchPrevent, { passive: false });
    canvas.addEventListener('touchmove', onTouchPrevent, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('touchstart', onTouchPrevent);
      canvas.removeEventListener('touchmove', onTouchPrevent);
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    isOpen,
    tool,
    color,
    brushSize,
    pressureSensitive,
    palmRejectionMode,
    activeLayer,
    layers,
    straightLineMode,
    getCanvasPos,
    redrawCanvas,
    pushHistory,
  ]);

  // ── Keyboard Shortcuts (P, I, M, F, A, E, O, R, G, Space) ───────────
  useEffect(() => {
    if (!isOpen) return;

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
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevShot();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextShot();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlayingAnimatic((prev) => !prev);
      } else if (e.key.toLowerCase() === 'p') {
        setTool('pencil');
      } else if (e.key.toLowerCase() === 'i') {
        setTool('ink');
      } else if (e.key.toLowerCase() === 'm') {
        setTool('marker');
      } else if (e.key.toLowerCase() === 'f' && !e.metaKey) {
        setTool('fineliner');
      } else if (e.key.toLowerCase() === 'a') {
        setTool('arrow');
      } else if (e.key.toLowerCase() === 'e') {
        setTool('eraser');
      } else if (e.key.toLowerCase() === 'o') {
        setOverlayConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
      } else if (e.key.toLowerCase() === 'g') {
        setShowRuleOfThirds((prev) => !prev);
      } else if (e.key === '[') {
        setBrushSize((b) => Math.max(1, b - 2));
      } else if (e.key === ']') {
        setBrushSize((b) => Math.min(48, b + 2));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleUndo, handleRedo, goToPrevShot, goToNextShot]);

  if (!isOpen || !currentShot) return null;

  return (
    <div className="fixed inset-y-0 right-0 left-0 md:left-[var(--sidebar-width,3.5rem)] z-30 flex flex-col bg-surface-950 text-white select-none overflow-hidden transition-[left] duration-300 ease-spring">
      {/* ── Studio Top Header ────────────────────────────────────────── */}
      <header className="h-14 px-3 sm:px-5 flex items-center justify-between border-b border-surface-800 bg-surface-950/95 backdrop-blur-md shrink-0">
        {/* Left: Sequence Breadcrumb & Scene Selector */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-brand-400">Sequence Studio</span>
            <span className="text-surface-600 hidden sm:inline">&middot;</span>
          </div>

          {/* Scene Dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              value={activeSceneId}
              onChange={(e) => setActiveSceneId(e.target.value)}
              className="bg-surface-900 border border-surface-700 text-xs rounded-lg px-2.5 py-1.5 text-surface-200 focus:outline-none focus:border-brand-500 font-medium"
            >
              <option value="all">All Scenes ({shots.length} shots)</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  Scene {s.scene_number || '?'}: {s.location_name || 'Scene'} ({shots.filter(x => x.scene_id === s.id).length} shots)
                </option>
              ))}
            </select>

            <Badge variant="info" size="sm" className="hidden md:inline-flex">
              Shot {currentIndexInSeq + 1} of {sequenceShots.length}
            </Badge>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-surface-400">
            <Badge size="sm">{currentShot.shot_type.replace('_', ' ')}</Badge>
            <Badge size="sm">{currentShot.shot_movement.replace('_', ' ')}</Badge>
            {currentShot.lens && <Badge size="sm">{currentShot.lens}</Badge>}
            {currentShot.duration_seconds && (
              <span className="text-[11px] text-surface-500 font-mono">{currentShot.duration_seconds}s</span>
            )}
          </div>
        </div>

        {/* Center: Sequence Navigation & Animatic Playback */}
        <div className="flex items-center gap-1 bg-surface-900/90 p-1 rounded-xl border border-surface-800">
          <button
            type="button"
            onClick={goToPrevShot}
            disabled={currentIndexInSeq <= 0}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-surface-300 hover:text-white hover:bg-surface-800 disabled:opacity-30 transition-colors flex items-center gap-1"
            title="Previous Shot (Left Arrow)"
          >
            <span>◀</span>
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Play Animatic */}
          <button
            type="button"
            onClick={() => setIsPlayingAnimatic(!isPlayingAnimatic)}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5',
              isPlayingAnimatic
                ? 'bg-amber-500 text-black shadow-sm animate-pulse'
                : 'bg-brand-600 text-white hover:bg-brand-500 shadow-sm'
            )}
            title="Play sequence animatic (Spacebar)"
          >
            <span>{isPlayingAnimatic ? '⏸ Pause' : '▶ Play'}</span>
          </button>

          <button
            type="button"
            onClick={goToNextShot}
            disabled={currentIndexInSeq >= sequenceShots.length - 1 && !animaticLoop}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-surface-300 hover:text-white hover:bg-surface-800 disabled:opacity-30 transition-colors flex items-center gap-1"
            title="Next Shot (Right Arrow)"
          >
            <span className="hidden sm:inline">Next</span>
            <span>▶</span>
          </button>
        </div>

        {/* Right: Studio Toggles, Save & Done */}
        <div className="flex items-center gap-2">
          {/* Apple Pencil Status Pill */}
          <div
            className={cn(
              'hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
              isApplePencilActive
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-surface-900 border-surface-800 text-surface-400'
            )}
          >
            <span>✏️</span>
            <span>{isApplePencilActive ? 'Apple Pencil' : 'Pencil Ready'}</span>
            {isApplePencilActive && livePressure > 0 && (
              <span className="text-[10px] font-mono opacity-80">{Math.round(livePressure * 100)}%</span>
            )}
          </div>

          {/* Save & Close */}
          <Button
            size="sm"
            onClick={async () => {
              setSaving(true);
              await saveCurrentShot();
              setSaving(false);
              onClose();
            }}
            loading={saving}
            className="h-8 text-xs font-medium"
          >
            Done
          </Button>
        </div>
      </header>

      {/* ── Studio Top Toolbar (Overlay, Rulers, Guides, History) ─────── */}
      <div className="h-11 px-3 sm:px-5 flex items-center justify-between border-b border-surface-800/80 bg-surface-900/60 shrink-0 text-xs gap-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          {/* 🧅 Onion Skin & Overlay Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOverlayConfig(prev => ({ ...prev, enabled: !prev.enabled }));
                setShowOverlayMenu(prev => !prev);
              }}
              className={cn(
                'px-2.5 py-1 rounded-lg border font-medium transition-colors flex items-center gap-1.5',
                overlayConfig.enabled
                  ? 'bg-brand-600/20 border-brand-500/50 text-brand-300'
                  : 'bg-surface-900 border-surface-700/60 text-surface-400 hover:text-white'
              )}
              title="Toggle Shot Overlay / Onion Skin (O)"
            >
              <span>🧅 Overlay</span>
              <span className="text-[10px] opacity-75">{overlayConfig.enabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Overlay settings popover */}
            {showOverlayMenu && (
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Shot Overlay / Onion Skin</span>
                  <button
                    type="button"
                    onClick={() => setOverlayConfig(c => ({ ...c, enabled: !c.enabled }))}
                    className={cn('text-[11px] px-2 py-0.5 rounded font-semibold', overlayConfig.enabled ? 'bg-brand-600 text-white' : 'bg-surface-800 text-surface-400')}
                  >
                    {overlayConfig.enabled ? 'Active' : 'Disabled'}
                  </button>
                </div>

                {/* Source Selection */}
                <div className="space-y-1">
                  <span className="text-[11px] text-surface-400">Overlay Source:</span>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setOverlayConfig(c => ({ ...c, source: 'prev', enabled: true }))}
                      className={cn('p-1.5 rounded-lg border text-center transition-colors', overlayConfig.source === 'prev' ? 'bg-brand-600 text-white border-brand-500' : 'bg-surface-800 border-surface-700 text-surface-300')}
                    >
                      ◀ Previous Shot
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverlayConfig(c => ({ ...c, source: 'next', enabled: true }))}
                      className={cn('p-1.5 rounded-lg border text-center transition-colors', overlayConfig.source === 'next' ? 'bg-brand-600 text-white border-brand-500' : 'bg-surface-800 border-surface-700 text-surface-300')}
                    >
                      Next Shot ▶
                    </button>
                  </div>
                </div>

                {/* Tint Mode */}
                <div className="space-y-1">
                  <span className="text-[11px] text-surface-400">Ghost Tint:</span>
                  <div className="flex gap-1 text-[11px]">
                    {(['amber', 'cyan', 'mono'] as const).map(tint => (
                      <button
                        key={tint}
                        type="button"
                        onClick={() => setOverlayConfig(c => ({ ...c, tint }))}
                        className={cn('flex-1 py-1 rounded border capitalize transition-colors', overlayConfig.tint === tint ? 'bg-surface-700 text-white border-brand-500' : 'bg-surface-800/80 border-surface-700 text-surface-400')}
                      >
                        {tint}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-surface-400">
                    <span>Ghost Opacity:</span>
                    <span>{Math.round(overlayConfig.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={0.8}
                    step={0.05}
                    value={overlayConfig.opacity}
                    onChange={(e) => setOverlayConfig(c => ({ ...c, opacity: Number(e.target.value) }))}
                    className="w-full accent-brand-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 📐 Rulers & Guides Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRulerMenu(prev => !prev)}
              className={cn(
                'px-2.5 py-1 rounded-lg border font-medium transition-colors flex items-center gap-1.5',
                rulerMode !== 'none' || showRuleOfThirds || showSafeAreas
                  ? 'bg-surface-800 border-surface-600 text-white'
                  : 'bg-surface-900 border-surface-700/60 text-surface-400 hover:text-white'
              )}
            >
              <span>📐 Guides & Rulers</span>
            </button>

            {showRulerMenu && (
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-50 space-y-3">
                <span className="text-xs font-bold text-white block">Cinematic Framing & Rulers</span>

                {/* Ruler Mode */}
                <div className="space-y-1">
                  <span className="text-[11px] text-surface-400">Drawing Ruler:</span>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setRulerMode('straight')}
                      className={cn('p-1.5 rounded-lg border text-left flex items-center gap-1', rulerMode === 'straight' ? 'bg-amber-500/20 text-amber-300 border-amber-500' : 'bg-surface-800 border-surface-700 text-surface-300')}
                    >
                      <span>📏</span> Straightedge
                    </button>
                    <button
                      type="button"
                      onClick={() => setRulerMode('perspective1')}
                      className={cn('p-1.5 rounded-lg border text-left flex items-center gap-1', rulerMode === 'perspective1' ? 'bg-sky-500/20 text-sky-300 border-sky-500' : 'bg-surface-800 border-surface-700 text-surface-300')}
                    >
                      <span>📐</span> 1-Point Persp.
                    </button>
                    <button
                      type="button"
                      onClick={() => setRulerMode('perspective2')}
                      className={cn('p-1.5 rounded-lg border text-left flex items-center gap-1', rulerMode === 'perspective2' ? 'bg-sky-500/20 text-sky-300 border-sky-500' : 'bg-surface-800 border-surface-700 text-surface-300')}
                    >
                      <span>📐</span> 2-Point Persp.
                    </button>
                    <button
                      type="button"
                      onClick={() => setRulerMode('none')}
                      className={cn('p-1.5 rounded-lg border text-left', rulerMode === 'none' ? 'bg-surface-700 text-white border-surface-600' : 'bg-surface-800 border-surface-700 text-surface-400')}
                    >
                      Off
                    </button>
                  </div>
                </div>

                {/* Aspect Ratio Mattes */}
                <div className="space-y-1">
                  <span className="text-[11px] text-surface-400">Aspect Ratio Framing:</span>
                  <div className="grid grid-cols-3 gap-1 text-[11px]">
                    {(['16:9', '2.39:1', '1.85:1', '4:3', '9:16'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setAspectRatio(r)}
                        className={cn('py-1 px-1.5 rounded border text-center transition-colors', aspectRatio === r ? 'bg-brand-600 text-white border-brand-500 font-semibold' : 'bg-surface-800 border-surface-700 text-surface-300')}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid checkboxes */}
                <div className="space-y-1 pt-1 border-t border-surface-800 text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer text-surface-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showRuleOfThirds}
                      onChange={(e) => setShowRuleOfThirds(e.target.checked)}
                      className="accent-brand-500 rounded"
                    />
                    <span>Rule of Thirds Grid</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-surface-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showSafeAreas}
                      onChange={(e) => setShowSafeAreas(e.target.checked)}
                      className="accent-brand-500 rounded"
                    />
                    <span>Action & Title Safe Lines</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-surface-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showCenterCrosshair}
                      onChange={(e) => setShowCenterCrosshair(e.target.checked)}
                      className="accent-brand-500 rounded"
                    />
                    <span>Center Crosshair</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Quick Straight Line Mode */}
          <button
            type="button"
            onClick={() => setStraightLineMode(!straightLineMode)}
            className={cn(
              'px-2.5 py-1 rounded-lg border font-medium transition-colors hidden sm:flex items-center gap-1',
              straightLineMode
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-surface-900 border-surface-700/60 text-surface-400 hover:text-white'
            )}
            title="Snap strokes to straight lines"
          >
            <span>📏 Straight Line</span>
          </button>
        </div>

        {/* Center / Right Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Palm Rejection Mode Picker */}
          <div className="flex items-center bg-surface-950 p-0.5 rounded-lg border border-surface-800 text-[11px]">
            <button
              type="button"
              onClick={() => setPalmRejectionMode('pencil-only')}
              className={cn(
                'px-2 py-1 rounded-md transition-colors flex items-center gap-1',
                palmRejectionMode === 'pencil-only'
                  ? 'bg-brand-600 text-white font-medium shadow-sm'
                  : 'text-surface-400 hover:text-white'
              )}
              title="Strict Palm Rejection: Rest entire palm on screen; only Apple Pencil draws"
            >
              <span>🖐️ Pencil Only</span>
            </button>
            <button
              type="button"
              onClick={() => setPalmRejectionMode('auto')}
              className={cn(
                'px-2 py-1 rounded-md transition-colors',
                palmRejectionMode === 'auto'
                  ? 'bg-brand-600 text-white font-medium shadow-sm'
                  : 'text-surface-400 hover:text-white'
              )}
              title="Auto Palm Rejection"
            >
              Auto
            </button>
          </div>

          {/* Pressure Dynamics */}
          <button
            type="button"
            onClick={() => setPressureSensitive(!pressureSensitive)}
            className={cn(
              'px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors hidden md:flex items-center gap-1',
              pressureSensitive
                ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                : 'bg-surface-900 border-surface-700/60 text-surface-400 hover:text-white'
            )}
          >
            <span>〰️ Pressure</span>
            <span className="text-[10px] opacity-75">{pressureSensitive ? 'ON' : 'OFF'}</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 bg-surface-950 p-0.5 rounded-lg border border-surface-800">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-1 rounded-md text-surface-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Undo (Cmd+Z)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1 rounded-md text-surface-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Redo (Cmd+Shift+Z)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
              </svg>
            </button>
          </div>

          {/* Layers Panel Toggle */}
          <button
            type="button"
            onClick={() => setShowLayersPanel(!showLayersPanel)}
            className={cn(
              'px-2.5 py-1 rounded-lg border font-medium transition-colors flex items-center gap-1',
              showLayersPanel
                ? 'bg-surface-700 border-surface-600 text-white'
                : 'bg-surface-900 border-surface-700/60 text-surface-400 hover:text-white'
            )}
            title="Toggle Layers Panel"
          >
            <span>📚 Layers</span>
            <span className="text-[10px] bg-surface-800 px-1 rounded">{layers.length}</span>
          </button>
        </div>
      </div>

      {/* ── Main Creative Studio Center ──────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Artist Brush Dock */}
        <aside className="w-16 sm:w-20 bg-surface-950 border-r border-surface-800 flex flex-col items-center py-3 gap-3 shrink-0 z-20 overflow-y-auto">
          {/* Tools */}
          <div className="flex flex-col gap-1 w-full px-2">
            {TOOL_DEFINITIONS.map(td => (
              <button
                key={td.tool}
                type="button"
                onClick={() => setTool(td.tool)}
                className={cn(
                  'flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all w-full text-center group',
                  tool === td.tool
                    ? 'bg-brand-600 text-white shadow-lg ring-1 ring-brand-400'
                    : 'text-surface-400 hover:text-white hover:bg-surface-900'
                )}
                title={`${td.label} (${td.tool.toUpperCase()}) - ${td.desc}`}
              >
                <span className="text-lg mb-0.5">{td.icon}</span>
                <span className="text-[10px] font-medium leading-tight truncate w-full">{td.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          <div className="w-8 h-px bg-surface-800" />

          {/* Color Palette */}
          <div className="flex flex-col gap-1.5">
            {STUDIO_COLORS.map(c => (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  setColor(c.hex);
                  if (tool === 'eraser') setTool('pencil');
                }}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-transform',
                  color === c.hex && tool !== 'eraser'
                    ? 'border-white scale-110 shadow-md ring-2 ring-brand-500/50'
                    : 'border-surface-700 hover:scale-105'
                )}
                style={{ backgroundColor: c.hex }}
                title={c.label}
              />
            ))}
          </div>

          <div className="w-8 h-px bg-surface-800" />

          {/* Brush Size Slider */}
          <div className="flex flex-col items-center gap-1 w-full px-2">
            <span className="text-[10px] font-mono text-surface-400">{brushSize}px</span>
            <input
              type="range"
              min={1}
              max={48}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-12 h-24 -rotate-90 my-3 accent-brand-500 cursor-pointer"
              title="Brush Size ([ / ])"
            />
          </div>
        </aside>

        {/* Center Drawing Canvas Viewport */}
        <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 bg-surface-900/40 relative overflow-hidden">
          <div
            className="relative rounded-2xl overflow-hidden bg-surface-950 border border-surface-700/80 shadow-2xl touch-none select-none"
            style={{
              width: '100%',
              maxWidth: '920px',
              aspectRatio: '16/9',
              touchAction: 'none',
            }}
          >
            <canvas
              ref={canvasRef}
              width={640 * dpr}
              height={360 * dpr}
              className="w-full h-full block cursor-crosshair select-none touch-none"
              style={{
                aspectRatio: '16/9',
                touchAction: 'none',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
              }}
            />

            {/* Apple Pencil Hover Reticle (iPad Pro M2/M4) */}
            {hoverPos && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/20 shadow-md transition-transform"
                style={{
                  left: `${(hoverPos.x / 640) * 100}%`,
                  top: `${(hoverPos.y / 360) * 100}%`,
                  width: `${Math.max(4, tool === 'eraser' ? brushSize : getPressureWidth(brushSize, hoverPos.pressure || 0.5, tool, pressureSensitive))}px`,
                  height: `${Math.max(4, tool === 'eraser' ? brushSize : getPressureWidth(brushSize, hoverPos.pressure || 0.5, tool, pressureSensitive))}px`,
                  borderColor: tool === 'eraser' ? '#ffffff' : color,
                }}
              />
            )}

            {/* Canvas Aspect Overlay Badge */}
            <div className="absolute top-2 left-2 pointer-events-none px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-surface-300">
              {aspectRatio} &middot; Shot #{currentShot.shot_number || currentIndexInSeq + 1}
            </div>

            {/* Active Onion Skin Notification */}
            {overlayConfig.enabled && overlayShot && (
              <div className="absolute top-2 right-2 pointer-events-none px-2 py-0.5 rounded bg-amber-500/20 backdrop-blur-sm border border-amber-500/40 text-[10px] font-medium text-amber-300 flex items-center gap-1">
                <span>🧅 Overlay: Shot #{overlayShot.shot_number || '?'}</span>
              </div>
            )}
          </div>
        </main>

        {/* Right Collapsible Layers & Shot Inspector Panel */}
        {showLayersPanel && (
          <aside className="w-64 sm:w-72 bg-surface-950 border-l border-surface-800 flex flex-col shrink-0 z-20 overflow-y-auto">
            {/* Layers Stack */}
            <div className="p-3 border-b border-surface-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Layers</span>
                <button
                  type="button"
                  onClick={addLayer}
                  className="px-2 py-1 bg-surface-800 hover:bg-surface-700 text-brand-400 rounded-md text-xs font-medium transition-colors"
                >
                  + Add Layer
                </button>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {/* Renders from top to bottom (last in array is rendered top-most) */}
                {[...layers].reverse().map((layer) => {
                  const isActive = layer.id === activeLayerId;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => setActiveLayerId(layer.id)}
                      className={cn(
                        'p-2 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5',
                        isActive
                          ? 'bg-brand-600/15 border-brand-500/60 shadow-sm'
                          : 'bg-surface-900/60 border-surface-800 hover:border-surface-700'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {/* Visibility toggle */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLayerVisible(layer.id);
                            }}
                            className={cn('p-1 rounded text-xs', layer.visible ? 'text-surface-300 hover:text-white' : 'text-surface-600')}
                            title={layer.visible ? 'Hide layer' : 'Show layer'}
                          >
                            {layer.visible ? '👁️' : '👁️‍🗨️'}
                          </button>

                          {/* Lock toggle */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLayerLocked(layer.id);
                            }}
                            className={cn('p-1 rounded text-xs', layer.locked ? 'text-amber-400' : 'text-surface-600 hover:text-surface-400')}
                            title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                          >
                            {layer.locked ? '🔒' : '🔓'}
                          </button>

                          <span className={cn('text-xs font-semibold truncate', isActive ? 'text-white' : 'text-surface-300')}>
                            {layer.name}
                          </span>
                        </div>

                        {/* Layer actions */}
                        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => moveLayer(layer.id, 'up')}
                            className="p-1 text-surface-500 hover:text-white text-[10px]"
                            title="Move layer up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLayer(layer.id, 'down')}
                            className="p-1 text-surface-500 hover:text-white text-[10px]"
                            title="Move layer down"
                          >
                            ▼
                          </button>
                          {layers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => deleteLayer(layer.id)}
                              className="p-1 text-surface-500 hover:text-red-400 text-[10px]"
                              title="Delete layer"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Opacity slider for active layer */}
                      {isActive && (
                        <div className="flex items-center gap-2 pt-1 border-t border-surface-800/60" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] text-surface-500">Opacity</span>
                          <input
                            type="range"
                            min={0.05}
                            max={1}
                            step={0.05}
                            value={layer.opacity}
                            onChange={(e) => updateLayerOpacity(layer.id, Number(e.target.value))}
                            className="w-full h-1 accent-brand-500"
                          />
                          <span className="text-[10px] font-mono text-surface-400 w-7 text-right">
                            {Math.round(layer.opacity * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Clear layer button */}
              <button
                type="button"
                onClick={clearActiveLayer}
                className="mt-2 text-[11px] text-surface-500 hover:text-red-400 transition-colors w-full text-center"
              >
                Clear strokes on &ldquo;{activeLayer?.name}&rdquo;
              </button>
            </div>

            {/* Shot Details & Director Notes */}
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">Shot Details</span>

              <div className="space-y-1">
                <span className="text-[11px] text-surface-400">Description / Action:</span>
                <p className="text-xs text-surface-200 bg-surface-900 p-2 rounded-lg border border-surface-800">
                  {currentShot.description || 'No description provided in shot list.'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-surface-400">Storyboard Notes:</span>
                <textarea
                  value={currentShot.storyboard_notes || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShots((prev) =>
                      prev.map((s) => (s.id === currentShot.id ? { ...s, storyboard_notes: val } : s))
                    );
                  }}
                  onBlur={() => saveCurrentShot()}
                  placeholder="Composition notes, camera cut cues, VFX..."
                  rows={3}
                  className="w-full bg-surface-900 border border-surface-800 rounded-lg p-2 text-xs text-surface-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* References list */}
              {(currentShot.storyboard_references?.length || 0) > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] text-surface-400">Reference Images:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {currentShot.storyboard_references!.map((ref, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-surface-800 group aspect-video bg-surface-900">
                        <img src={ref.url} alt={ref.label || `Ref ${idx + 1}`} className="w-full h-full object-cover" />
                        {ref.label && (
                          <div className="absolute inset-x-0 bottom-0 bg-black/70 text-[9px] px-1 py-0.5 truncate text-white">
                            {ref.label}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Sequence Filmstrip & Animatic Timeline (Bottom) ─────────── */}
      {showFilmstrip && (
        <footer className="h-28 border-t border-surface-800 bg-surface-950/95 backdrop-blur-md px-3 py-2 flex flex-col justify-between shrink-0 z-30">
          <div className="flex items-center justify-between text-[11px] text-surface-400 px-1 mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Filmstrip Sequence Reel</span>
              <span>&middot;</span>
              <span>{sequenceShots.length} shots in current sequence</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAnimaticLoop(!animaticLoop)}
                className={cn('px-2 py-0.5 rounded text-[10px] font-medium transition-colors', animaticLoop ? 'bg-surface-800 text-brand-400 border border-brand-500/40' : 'text-surface-500')}
              >
                {animaticLoop ? '↺ Loop Playback' : 'Play Once'}
              </button>
            </div>
          </div>

          {/* Filmstrip cards */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {sequenceShots.map((shot, idx) => {
              const isSelected = shot.id === activeShotId;
              return (
                <div
                  key={shot.id}
                  onClick={() => goToShot(shot.id)}
                  className={cn(
                    'group relative rounded-xl border overflow-hidden shrink-0 cursor-pointer transition-all flex flex-col',
                    'w-32 h-18 bg-surface-900',
                    isSelected
                      ? 'border-brand-500 ring-2 ring-brand-500/40 scale-105 shadow-lg'
                      : 'border-surface-800 hover:border-surface-600'
                  )}
                >
                  {/* Thumbnail Preview */}
                  <div className="h-11 w-full bg-surface-950 flex items-center justify-center relative overflow-hidden">
                    {shot.storyboard_url ? (
                      <img src={shot.storyboard_url} alt="" className="w-full h-full object-cover" />
                    ) : (shot.storyboard_drawing || []).length > 0 ? (
                      <div className="text-[10px] text-brand-400 font-mono">Drawn Frame</div>
                    ) : (
                      <span className="text-[9px] text-surface-600 font-mono">Empty</span>
                    )}

                    {/* Shot Number Badge */}
                    <span className="absolute top-1 left-1 bg-black/80 text-[10px] font-bold px-1 rounded text-white font-mono">
                      #{shot.shot_number || idx + 1}
                    </span>
                  </div>

                  {/* Card Footer */}
                  <div className="h-5 px-1.5 bg-surface-900 flex items-center justify-between text-[9px] text-surface-400">
                    <span className="truncate">{shot.shot_type.replace('_', ' ')}</span>
                    <span className="font-mono text-surface-500">{shot.duration_seconds ? `${shot.duration_seconds}s` : '2.5s'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </footer>
      )}
    </div>
  );
}
