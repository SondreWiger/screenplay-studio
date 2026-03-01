'use client';

/**
 * ArcMindmap — full-screen drag-and-drop mind map canvas
 *
 * Features:
 *   • Multiple node types: Episode, Story Arc, Character, Theme, Event, Note
 *   • Drag nodes freely on infinite canvas
 *   • Pan: drag empty canvas  |  Zoom: scroll wheel / pinch
 *   • Create edges: hover a node connector port → drag to another node
 *   • Multiple edge styles: arc (solid), subplot (dashed), character-link (dotted)
 *   • Select node/edge → edit in Properties panel (right)
 *   • Double-click canvas → add a new Note node
 *   • Delete key → remove selected node or edge
 *   • Ctrl/⌘ + A → select all  |  Escape → deselect
 *   • Zoom-to-fit toolbar button
 *   • Episode nodes auto-populated from scripts table; can be linked into arcs
 *   • Persists to content_metadata.arc_map (JSON-stringified) via Supabase
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Script } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NodeType = 'episode' | 'arc' | 'character' | 'theme' | 'event' | 'note';
export type EdgeType = 'story-arc' | 'subplot' | 'character-link' | 'conflict' | 'cause-effect';

export interface MapNode {
  id: string;
  type: NodeType;
  label: string;
  body?: string;
  x: number;
  y: number;
  color: string; // tailwind-ish hex colour token stored as hex
  episodeRef?: string; // script id
  locked?: boolean;
}

export interface MapEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  type: EdgeType;
}

export interface MindmapData {
  nodes: MapNode[];
  edges: MapEdge[];
  version: 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<NodeType, string> = {
  episode:   '#7c3aed',   // violet-700
  arc:       '#0369a1',   // sky-700
  character: '#047857',   // emerald-700
  theme:     '#b45309',   // amber-700
  event:     '#be185d',   // pink-700 (supports rose)
  note:      '#374151',   // gray-700
};

const NODE_LABEL: Record<NodeType, string> = {
  episode:   'Episode',
  arc:       'Story Arc',
  character: 'Character',
  theme:     'Theme',
  event:     'Event',
  note:      'Note',
};

const EDGE_DEFS: Record<EdgeType, { label: string; dash?: string; color: string }> = {
  'story-arc':     { label: 'Story Arc',       color: '#7c3aed' },
  'subplot':       { label: 'Subplot',         dash: '8 4',     color: '#0369a1' },
  'character-link':{ label: 'Character Link',  dash: '4 4',     color: '#047857' },
  'conflict':      { label: 'Conflict',        color: '#dc2626' },
  'cause-effect':  { label: 'Cause & Effect',  dash: '12 3 3 3', color: '#ca8a04' },
};

const NODE_TYPE_ICONS: Record<NodeType, string> = {
  episode:   'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z',
  arc:       'M13 10V3L4 14h7v7l9-11h-7z',
  character: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  theme:     'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  event:     'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  note:      'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
};

const PORT_OFFSETS = [
  { side: 'top',    px: 0.5, py: 0   },
  { side: 'right',  px: 1,   py: 0.5 },
  { side: 'bottom', px: 0.5, py: 1   },
  { side: 'left',   px: 0,   py: 0.5 },
];

const NODE_W = 168;
const NODE_H = 72;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomUUID();
}

function emptyMap(): MindmapData {
  return { nodes: [], edges: [], version: 1 };
}

function nodeCenter(n: MapNode) {
  return { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 };
}

/** Cubic-bezier SVG path between two points. */
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const cx = dx * 0.6 + 40;
  return `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`;
}

/**
 * Given an edge (from → to), compute the best pair of ports (one per node).
 * We pick the port pair that minimizes the distance.
 */
function bestPorts(from: MapNode, to: MapNode) {
  let best = { x1: 0, y1: 0, x2: 0, y2: 0, dist: Infinity };
  for (const pF of PORT_OFFSETS) {
    const x1 = from.x + pF.px * NODE_W;
    const y1 = from.y + pF.py * NODE_H;
    for (const pT of PORT_OFFSETS) {
      const x2 = to.x + pT.px * NODE_W;
      const y2 = to.y + pT.py * NODE_H;
      const d = Math.hypot(x2 - x1, y2 - y1);
      if (d < best.dist) {
        best = { x1, y1, x2, y2, dist: d };
      }
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  selected,
  onMouseDown,
  onPortMouseDown,
  onPortMouseEnter,
  canEdit,
}: {
  node: MapNode;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onPortMouseDown: (e: React.MouseEvent, side: string) => void;
  onPortMouseEnter: (nodeId: string) => void;
  canEdit: boolean;
}) {
  const ic = NODE_TYPE_ICONS[node.type];

  return (
    <div
      className={cn(
        'absolute select-none rounded-xl border-2 overflow-visible transition-shadow',
        selected
          ? 'border-white shadow-[0_0_0_3px_rgba(255,255,255,0.25)] shadow-xl'
          : 'border-white/10 shadow-lg hover:border-white/30',
      )}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_W,
        minHeight: NODE_H,
        background: node.color,
        cursor: canEdit ? 'grab' : 'default',
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => onPortMouseEnter(node.id)}
    >
      {/* Icon strip */}
      <div className="flex items-start gap-2 px-3 pt-3 pb-2">
        <svg
          className="w-4 h-4 shrink-0 mt-0.5 text-white/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ic} />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-white/50 font-medium uppercase tracking-wider leading-none mb-1">
            {NODE_LABEL[node.type]}
          </div>
          <div className="text-sm font-semibold text-white leading-snug break-words">
            {node.label}
          </div>
        </div>
      </div>
      {node.body && (
        <div className="px-3 pb-3 text-[11px] text-white/60 leading-relaxed line-clamp-3">
          {node.body}
        </div>
      )}

      {/* Connection ports — only shown on hover when canEdit */}
      {canEdit && (
        <>
          {PORT_OFFSETS.map(({ side, px, py }) => (
            <div
              key={side}
              className="absolute w-3 h-3 rounded-full bg-white border-2 border-current opacity-0 hover:opacity-100 group-hover:opacity-100 z-10 cursor-crosshair"
              style={{
                left: px * NODE_W - 6,
                top: py * NODE_H - 6,
                color: node.color,
                transform: 'translate(-1px,-1px)',
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortMouseDown(e, side);
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  initialData?: MindmapData | null;
  episodes?: Script[];
  canEdit?: boolean;
  onSave?: (data: MindmapData) => void;
}

export function ArcMindmap({
  projectId,
  initialData,
  episodes = [],
  canEdit = true,
  onSave,
}: Props) {
  const canvasRef  = useRef<HTMLDivElement>(null);
  const svgRef     = useRef<SVGSVGElement>(null);
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Canvas transform ─────────────────────────────────────────────────────
  const [panX, setPanX]   = useState(0);
  const [panY, setPanY]   = useState(0);
  const [zoom, setZoom]   = useState(1);
  const transform = useMemo(
    () => `translate(${panX}px,${panY}px) scale(${zoom})`,
    [panX, panY, zoom],
  );

  // ── Map data ─────────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [edges, setEdges] = useState<MapEdge[]>([]);
  const [dirty, setDirty] = useState(false);

  // ── Selection ────────────────────────────────────────────────────────────
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // ── Drag state ───────────────────────────────────────────────────────────
  const dragging = useRef<{
    nodeId: string;
    startX: number; startY: number;
    origX: number; origY: number;
  } | null>(null);
  const panning = useRef<{
    startX: number; startY: number;
    origPanX: number; origPanY: number;
  } | null>(null);

  // ── Edge draw state ──────────────────────────────────────────────────────
  const [drawingEdge, setDrawingEdge] = useState<{
    fromNodeId: string;
    curX: number; curY: number;
  } | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const pendingEdgeType = useRef<EdgeType>('story-arc');

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const [newEdgeType, setNewEdgeType] = useState<EdgeType>('story-arc');
  const [saving, setSaving] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Init / load
  // ─────────────────────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    // Position episodes in a row at top of canvas
    const episodeNodes: MapNode[] = episodes.map((ep, i) => ({
      id: `ep-${ep.id}`,
      type: 'episode',
      label: ep.title,
      body: ep.title_page_data?.notes ?? undefined,
      x: 60 + i * (NODE_W + 40),
      y: 60,
      color: NODE_COLORS.episode,
      episodeRef: ep.id,
    }));

    if (initialData) {
      // Merge: keep existing episode nodes updated, keep custom nodes
      const epIds = new Set(episodeNodes.map((n) => n.id));
      const existingCustom = initialData.nodes.filter((n) => !epIds.has(n.id));
      // For episode nodes, prefer the saved position (if present) but update label/body
      const savedEpMap = new Map(initialData.nodes.filter((n) => epIds.has(n.id)).map((n) => [n.id, n]));
      const mergedEpisodes = episodeNodes.map((n) => {
        const saved = savedEpMap.get(n.id);
        return saved ? { ...n, x: saved.x, y: saved.y } : n;
      });
      setNodes([...mergedEpisodes, ...existingCustom]);
      setEdges(initialData.edges);
    } else {
      setNodes(episodeNodes);
      setEdges([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Persistence
  // ─────────────────────────────────────────────────────────────────────────

  const saveMap = useCallback(async (nodeList: MapNode[], edgeList: MapEdge[]) => {
    setSaving(true);
    const data: MindmapData = { nodes: nodeList, edges: edgeList, version: 1 };
    try {
      const supabase = createClient();
      const arcJson  = JSON.stringify(data);

      // Read current content_metadata first so we don't clobber other keys
      const { data: proj } = await supabase
        .from('projects')
        .select('content_metadata')
        .eq('id', projectId)
        .single();

      const existing = (proj?.content_metadata as Record<string, unknown>) ?? {};
      const merged   = { ...existing, arc_map: arcJson };

      const { error } = await supabase
        .from('projects')
        .update({ content_metadata: merged as any })
        .eq('id', projectId);
      if (error) throw error;
      setDirty(false);
      onSave?.(data);
      toast.success('Arc map saved');
    } catch {
      toast.error('Failed to save arc map');
    } finally {
      setSaving(false);
    }
  }, [projectId, onSave]);

  // Auto-save debounced
  useEffect(() => {
    if (!dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMap(nodes, edges), 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dirty, nodes, edges, saveMap]);

  const markDirty = useCallback(() => setDirty(true), []);

  // ─────────────────────────────────────────────────────────────────────────
  // Nodes CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const addNode = useCallback((type: NodeType, x?: number, y?: number) => {
    const cx = canvasRef.current;
    const ox = cx ? (cx.clientWidth  / 2 - panX) / zoom - NODE_W / 2 : 200;
    const oy = cx ? (cx.clientHeight / 2 - panY) / zoom - NODE_H / 2 : 200;
    const newNode: MapNode = {
      id:    uid(),
      type,
      label: `New ${NODE_LABEL[type]}`,
      x:     x ?? ox,
      y:     y ?? oy,
      color: NODE_COLORS[type],
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
    markDirty();
  }, [panX, panY, zoom, markDirty]);

  const updateNode = useCallback(<K extends keyof MapNode>(id: string, key: K, val: MapNode[K]) => {
    setNodes((prev) => prev.map((n) => n.id === id ? { ...n, [key]: val } : n));
    markDirty();
  }, [markDirty]);

  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    markDirty();
  }, [selectedNodeId, markDirty]);

  // ─────────────────────────────────────────────────────────────────────────
  // Edges CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const addEdge = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    if (edges.some((e) => e.from === fromId && e.to === toId)) return;
    const newEdge: MapEdge = {
      id:   uid(),
      from: fromId,
      to:   toId,
      type: pendingEdgeType.current,
    };
    setEdges((prev) => [...prev, newEdge]);
    setSelectedEdgeId(newEdge.id);
    setSelectedNodeId(null);
    markDirty();
  }, [edges, markDirty]);

  const updateEdge = useCallback(<K extends keyof MapEdge>(id: string, key: K, val: MapEdge[K]) => {
    setEdges((prev) => prev.map((e) => e.id === id ? { ...e, [key]: val } : e));
    markDirty();
  }, [markDirty]);

  const deleteEdge = useCallback((id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    if (selectedEdgeId === id) setSelectedEdgeId(null);
    markDirty();
  }, [selectedEdgeId, markDirty]);

  // ─────────────────────────────────────────────────────────────────────────
  // Zoom to fit
  // ─────────────────────────────────────────────────────────────────────────

  const zoomToFit = useCallback(() => {
    if (nodes.length === 0) return;
    const cx = canvasRef.current;
    if (!cx) return;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const x1 = Math.min(...xs) - 60;
    const y1 = Math.min(...ys) - 60;
    const x2 = Math.max(...xs) + NODE_W + 60;
    const y2 = Math.max(...ys) + NODE_H + 60;
    const cw = cx.clientWidth;
    const ch = cx.clientHeight;
    const z  = Math.min(cw / (x2 - x1), ch / (y2 - y1), MAX_ZOOM);
    const z2 = Math.max(z, MIN_ZOOM);
    setZoom(z2);
    setPanX((cw - (x2 - x1) * z2) / 2 - x1 * z2);
    setPanY((ch - (y2 - y1) * z2) / 2 - y1 * z2);
  }, [nodes]);

  // Run zoom-to-fit once on initial mount after nodes are set
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (!fittedOnce.current && nodes.length > 0) {
      requestAnimationFrame(zoomToFit);
      fittedOnce.current = true;
    }
  }, [nodes, zoomToFit]);

  // ─────────────────────────────────────────────────────────────────────────
  // Mouse handlers
  // ─────────────────────────────────────────────────────────────────────────

  const onNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (!canEdit) return;
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.locked) return;
    dragging.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      origX:  node.x,
      origY:  node.y,
    };
  }, [canEdit, nodes]);

  const onPortMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (!canEdit) return;
    e.stopPropagation();
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    setDrawingEdge({
      fromNodeId: nodeId,
      curX: (e.clientX - rect.left - panX) / zoom,
      curY: (e.clientY - rect.top  - panY) / zoom,
    });
    pendingEdgeType.current = newEdgeType;
  }, [canEdit, panX, panY, zoom, newEdgeType]);

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    panning.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPanX: panX,
      origPanY: panY,
    };
  }, [panX, panY]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) {
      const dx = (e.clientX - dragging.current.startX) / zoom;
      const dy = (e.clientY - dragging.current.startY) / zoom;
      const { nodeId, origX, origY } = dragging.current;
      setNodes((prev) =>
        prev.map((n) => n.id === nodeId ? { ...n, x: origX + dx, y: origY + dy } : n),
      );
    } else if (panning.current) {
      const dx = e.clientX - panning.current.startX;
      const dy = e.clientY - panning.current.startY;
      setPanX(panning.current.origPanX + dx);
      setPanY(panning.current.origPanY + dy);
    } else if (drawingEdge) {
      const canvas = canvasRef.current!;
      const rect   = canvas.getBoundingClientRect();
      setDrawingEdge((prev) => prev ? {
        ...prev,
        curX: (e.clientX - rect.left - panX) / zoom,
        curY: (e.clientY - rect.top  - panY) / zoom,
      } : null);
    }
  }, [zoom, drawingEdge, panX, panY]);

  const onCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragging.current) {
      markDirty();
      dragging.current = null;
    }
    if (panning.current) {
      panning.current = null;
    }
    if (drawingEdge) {
      if (hoverNodeId && hoverNodeId !== drawingEdge.fromNodeId) {
        addEdge(drawingEdge.fromNodeId, hoverNodeId);
      }
      setDrawingEdge(null);
    }
  }, [drawingEdge, hoverNodeId, addEdge, markDirty]);

  const onCanvasDblClick = useCallback((e: React.MouseEvent) => {
    if (!canEdit) return;
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const cx     = (e.clientX - rect.left - panX) / zoom;
    const cy     = (e.clientY - rect.top  - panY) / zoom;
    addNode('note', cx - NODE_W / 2, cy - NODE_H / 2);
  }, [canEdit, panX, panY, zoom, addNode]);

  const onScroll = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * delta)));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard shortcuts
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) deleteNode(selectedNodeId);
        else if (selectedEdgeId) deleteEdge(selectedEdgeId);
      }
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setDrawingEdge(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveMap(nodes, edges);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, selectedEdgeId, deleteNode, deleteEdge, nodes, edges, saveMap]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived: selected items
  // ─────────────────────────────────────────────────────────────────────────

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  // ─────────────────────────────────────────────────────────────────────────
  // Edge midpoint label click area
  // ─────────────────────────────────────────────────────────────────────────

  const edgeMidpoint = useCallback((edge: MapEdge) => {
    const fromNode = nodes.find((n) => n.id === edge.from);
    const toNode   = nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) return null;
    const { x1, y1, x2, y2 } = bestPorts(fromNode, toNode);
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }, [nodes]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full bg-[#0d0d14] overflow-hidden select-none relative">
      {/* ── Left palette panel ─────────────────────────────────────────── */}
      <aside className="w-14 flex flex-col items-center py-4 gap-2 border-r border-white/5 bg-black/30 z-10 shrink-0">
        <div className="mb-2">
          <div className="w-2 h-2 rounded-full bg-[#FF5F1F] mx-auto" />
        </div>
        {(Object.keys(NODE_LABEL) as NodeType[]).map((t) => (
          <button
            key={t}
            disabled={!canEdit}
            title={`Add ${NODE_LABEL[t]}`}
            onClick={() => addNode(t)}
            className={cn(
              'group w-10 h-10 rounded-xl flex items-center justify-center transition-all',
              'border border-white/5 hover:border-white/20 hover:scale-110',
            )}
            style={{ background: NODE_COLORS[t] + '33' }}
          >
            <svg
              className="w-5 h-5 transition-colors"
              style={{ color: NODE_COLORS[t] }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={NODE_TYPE_ICONS[t]} />
            </svg>
          </button>
        ))}
        <div className="flex-1" />
        {/* Zoom controls */}
        <button onClick={() => setZoom((z) => Math.min(z + 0.15, MAX_ZOOM))} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-lg leading-none transition-colors">+</button>
        <div className="text-[9px] text-white/30 font-mono">{Math.round(zoom * 100)}%</div>
        <button onClick={() => setZoom((z) => Math.max(z - 0.15, MIN_ZOOM))} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-lg leading-none transition-colors">−</button>
        <button onClick={zoomToFit} title="Fit all nodes" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </aside>

      {/* ── Canvas ─────────────────────────────────────────────────────── */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: panning.current ? 'grabbing' : 'default' }}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onDoubleClick={onCanvasDblClick}
        onWheel={onScroll}
      >
        {/* Dotted grid background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-dot" x={panX % (24 * zoom)} y={panY % (24 * zoom)} width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={0.8} fill="rgba(255,255,255,0.07)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-dot)" />
        </svg>

        {/* Transform layer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ transform, transformOrigin: '0 0', willChange: 'transform' }}
        >
          {/* ── SVG edges layer ── */}
          <svg
            ref={svgRef}
            className="absolute inset-0 overflow-visible pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              {Object.entries(EDGE_DEFS).map(([type, def]) => (
                <marker
                  key={type}
                  id={`arrow-${type}`}
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L8,3 z" fill={def.color} />
                </marker>
              ))}
            </defs>

            {/* Edges */}
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from);
              const toNode   = nodes.find((n) => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const { x1, y1, x2, y2 } = bestPorts(fromNode, toNode);
              const def     = EDGE_DEFS[edge.type];
              const isSelE  = edge.id === selectedEdgeId;
              const mid     = edgeMidpoint(edge);
              return (
                <g key={edge.id}>
                  {/* Wider invisible hit area */}
                  <path
                    d={bezierPath(x1, y1, x2, y2)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                    }}
                  />
                  {/* Visible edge */}
                  <path
                    d={bezierPath(x1, y1, x2, y2)}
                    fill="none"
                    stroke={isSelE ? '#ffffff' : def.color}
                    strokeWidth={isSelE ? 2.5 : 1.8}
                    strokeDasharray={def.dash}
                    strokeLinecap="round"
                    markerEnd={`url(#arrow-${edge.type})`}
                    style={{ pointerEvents: 'none', transition: 'stroke 0.15s, stroke-width 0.15s' }}
                  />
                  {/* Edge label */}
                  {(edge.label || isSelE) && mid && (
                    <foreignObject
                      x={mid.x - 60}
                      y={mid.y - 12}
                      width={120}
                      height={24}
                      style={{ pointerEvents: 'none', overflow: 'visible' }}
                    >
                      <div className="flex justify-center">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                          style={{ background: def.color + 'dd', fontSize: 10 }}
                        >
                          {edge.label || def.label}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}

            {/* Drawing edge preview */}
            {drawingEdge && (() => {
              const fromNode = nodes.find((n) => n.id === drawingEdge.fromNodeId);
              if (!fromNode) return null;
              const c = nodeCenter(fromNode);
              const def = EDGE_DEFS[pendingEdgeType.current];
              return (
                <path
                  d={bezierPath(c.x, c.y, drawingEdge.curX, drawingEdge.curY)}
                  fill="none"
                  stroke={def.color}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  strokeLinecap="round"
                  opacity={0.7}
                />
              );
            })()}
          </svg>

          {/* ── Nodes layer (pointer events re-enabled per-node) ── */}
          {nodes.map((node) => (
            <div key={node.id} style={{ pointerEvents: canEdit ? 'all' : 'none' }}>
              <NodeCard
                node={node}
                selected={node.id === selectedNodeId}
                canEdit={canEdit}
                onMouseDown={(e) => onNodeMouseDown(e, node.id)}
                onPortMouseDown={(e, _side) => onPortMouseDown(e, node.id)}
                onPortMouseEnter={(id) => setHoverNodeId(id)}
              />
            </div>
          ))}
        </div>

        {/* Canvas hints */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-white/20 text-sm">Double-click to add a note, or use the palette on the left</p>
          </div>
        )}
      </div>

      {/* ── Right properties panel ─────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-l border-white/5 bg-black/30 flex flex-col overflow-y-auto z-10">
        {/* Toolbar / header */}
        <div className="p-3 border-b border-white/5 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Arc Planner</span>
          <button
            onClick={() => saveMap(nodes, edges)}
            disabled={!dirty || saving}
            className={cn(
              'px-3 py-1 text-[11px] font-medium rounded-lg transition-all',
              dirty && !saving
                ? 'bg-[#E54E15] text-white hover:bg-[#FF5F1F]'
                : 'bg-white/5 text-white/30 cursor-default',
            )}
          >
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>

        {/* Edge type selector */}
        <div className="p-3 border-b border-white/5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">New connection type</p>
          <div className="space-y-1">
            {(Object.keys(EDGE_DEFS) as EdgeType[]).map((t) => {
              const def = EDGE_DEFS[t];
              return (
                <button
                  key={t}
                  onClick={() => { setNewEdgeType(t); pendingEdgeType.current = t; }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                    newEdgeType === t ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80',
                  )}
                >
                  <svg width="32" height="8" style={{ minWidth: 32 }}>
                    <line
                      x1="0" y1="4" x2="32" y2="4"
                      stroke={def.color}
                      strokeWidth="2"
                      strokeDasharray={def.dash ?? ''}
                      strokeLinecap="round"
                    />
                  </svg>
                  {def.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected item inspector */}
        <div className="p-3 flex-1">
          {selectedNode ? (
            <PropertiesPanel
              node={selectedNode}
              updateNode={updateNode}
              deleteNode={deleteNode}
              canEdit={canEdit}
            />
          ) : selectedEdge ? (
            <EdgePropertiesPanel
              edge={selectedEdge}
              updateEdge={updateEdge}
              deleteEdge={deleteEdge}
              canEdit={canEdit}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-[11px] text-white/20 leading-relaxed">
                Click a node or edge to<br />edit its properties
              </p>
              <div className="mt-4 space-y-1 text-left">
                {[
                  ['Double-click canvas', 'Add note'],
                  ['Drag node', 'Move'],
                  ['Hover node → port', 'Draw edge'],
                  ['Delete / ⌫', 'Remove selected'],
                  ['⌘ S', 'Save'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[10px]">
                    <span className="text-white/30">{v}</span>
                    <kbd className="px-1 bg-white/5 rounded text-white/20 font-mono">{k}</kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="p-3 border-t border-white/5 flex justify-between text-[10px] text-white/30">
          <span>{nodes.length} nodes</span>
          <span>{edges.length} edges</span>
          <span>{episodes.length} episodes</span>
        </div>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Properties panels
// ─────────────────────────────────────────────────────────────────────────────

function PropertiesPanel({
  node,
  updateNode,
  deleteNode,
  canEdit,
}: {
  node: MapNode;
  updateNode: <K extends keyof MapNode>(id: string, key: K, val: MapNode[K]) => void;
  deleteNode: (id: string) => void;
  canEdit: boolean;
}) {
  const ic = NODE_TYPE_ICONS[node.type];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: node.color + '44', border: `1.5px solid ${node.color}55` }}
        >
          <svg className="w-4 h-4" style={{ color: node.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ic} />
          </svg>
        </span>
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">{NODE_LABEL[node.type]}</div>
          <div className="text-xs font-semibold text-white truncate max-w-[140px]">{node.label}</div>
        </div>
      </div>

      {canEdit ? (
        <>
          <div>
            <label className="block text-[10px] text-white/40 mb-1">Label</label>
            <input
              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:border-white/30 focus:outline-none"
              value={node.label}
              onChange={(e) => updateNode(node.id, 'label', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/40 mb-1">Notes / Body</label>
            <textarea
              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:border-white/30 focus:outline-none resize-none"
              rows={4}
              value={node.body ?? ''}
              onChange={(e) => updateNode(node.id, 'body', e.target.value)}
              placeholder="Add details, beats, notes…"
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/40 mb-2">Accent colour</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.values(NODE_COLORS).filter((v, i, a) => a.indexOf(v) === i).map((c) => (
                <button
                  key={c}
                  className={cn(
                    'w-6 h-6 rounded-md border-2 transition-all',
                    node.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105',
                  )}
                  style={{ background: c }}
                  onClick={() => updateNode(node.id, 'color', c)}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-white/40">Locked</label>
            <button
              onClick={() => updateNode(node.id, 'locked', !node.locked)}
              className={cn(
                'w-8 h-5 rounded-full transition-colors relative',
                node.locked ? 'bg-[#E54E15]' : 'bg-white/10',
              )}
            >
              <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-[left]', node.locked ? 'left-3.5' : 'left-0.5')} />
            </button>
          </div>
          <button
            onClick={() => deleteNode(node.id)}
            className="w-full py-1.5 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Delete node
          </button>
        </>
      ) : (
        <>
          {node.body && <p className="text-[11px] text-white/60 leading-relaxed">{node.body}</p>}
        </>
      )}
    </div>
  );
}

function EdgePropertiesPanel({
  edge,
  updateEdge,
  deleteEdge,
  canEdit,
}: {
  edge: MapEdge;
  updateEdge: <K extends keyof MapEdge>(id: string, key: K, val: MapEdge[K]) => void;
  deleteEdge: (id: string) => void;
  canEdit: boolean;
}) {
  const def = EDGE_DEFS[edge.type];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <svg width="28" height="8">
          <line x1="0" y1="4" x2="28" y2="4" stroke={def.color} strokeWidth="2" strokeDasharray={def.dash ?? ''} strokeLinecap="round" />
        </svg>
        <div className="text-[10px] text-white/40 uppercase tracking-wider">{def.label}</div>
      </div>
      {canEdit ? (
        <>
          <div>
            <label className="block text-[10px] text-white/40 mb-1">Label (optional)</label>
            <input
              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:border-white/30 focus:outline-none"
              value={edge.label ?? ''}
              onChange={(e) => updateEdge(edge.id, 'label', e.target.value)}
              placeholder="e.g. triggers, causes, follows…"
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/40 mb-1">Connection type</label>
            <div className="space-y-1">
              {(Object.keys(EDGE_DEFS) as EdgeType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => updateEdge(edge.id, 'type', t)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                    edge.type === t ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5',
                  )}
                >
                  <svg width="24" height="8">
                    <line x1="0" y1="4" x2="24" y2="4" stroke={EDGE_DEFS[t].color} strokeWidth="2" strokeDasharray={EDGE_DEFS[t].dash ?? ''} strokeLinecap="round" />
                  </svg>
                  {EDGE_DEFS[t].label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => deleteEdge(edge.id)}
            className="w-full py-1.5 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Delete connection
          </button>
        </>
      ) : (
        <p className="text-[11px] text-white/50">{def.label} connection</p>
      )}
    </div>
  );
}
