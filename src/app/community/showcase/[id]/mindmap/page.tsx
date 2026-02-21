'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Project, Profile } from '@/lib/types';

// ============================================================
// Deep Dive — Read-Only Mind Map Viewer
// ============================================================

interface MindMapNode {
  id: string;
  project_id: string;
  character_id: string | null;
  label: string;
  node_type: 'character' | 'group' | 'note';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  shape: 'rounded' | 'circle' | 'diamond' | 'rectangle';
  font_size: number;
  image_url: string | null;
  notes: string | null;
  group_id: string | null;
  is_locked: boolean;
  z_index: number;
}

interface MindMapEdge {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  color: string;
  line_style: 'solid' | 'dashed' | 'dotted';
  thickness: number;
  arrow_type: 'none' | 'forward' | 'backward' | 'both';
  animated: boolean;
  notes: string | null;
}

function getDashArray(style: string): string {
  switch (style) {
    case 'dashed': return '8 4';
    case 'dotted': return '2 4';
    default: return '';
  }
}

export default function DeepDiveMindmapPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<(Project & { author?: Profile }) | null>(null);
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [edges, setEdges] = useState<MindMapEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ x: -400, y: -300, w: 1200, h: 800 });
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (params.id) fetchData();
  }, [params.id]);

  const fetchData = async () => {
    const supabase = createClient();

    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .select('*, author:profiles!created_by(*)')
      .eq('id', params.id)
      .eq('is_showcased', true)
      .single();

    if (projErr || !proj) {
      setError('This project is not available for viewing.');
      setLoading(false);
      return;
    }

    if (!proj.showcase_mindmap) {
      setError('The mind map is not available for this production.');
      setLoading(false);
      return;
    }

    setProject(proj);

    const [nodesRes, edgesRes] = await Promise.all([
      supabase.from('mindmap_nodes').select('*').eq('project_id', params.id).order('z_index'),
      supabase.from('mindmap_edges').select('*').eq('project_id', params.id),
    ]);

    const fetchedNodes = nodesRes.data || [];
    const fetchedEdges = edgesRes.data || [];
    setNodes(fetchedNodes);
    setEdges(fetchedEdges);

    // Fit to content
    if (fetchedNodes.length > 0) {
      const padding = 100;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of fetchedNodes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
      }
      setViewBox({
        x: minX - padding,
        y: minY - padding,
        w: maxX - minX + padding * 2,
        h: maxY - minY + padding * 2,
      });
    }

    setLoading(false);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    const mouseX = viewBox.x + ((e.clientX - rect.left) / rect.width) * viewBox.w;
    const mouseY = viewBox.y + ((e.clientY - rect.top) / rect.height) * viewBox.h;

    const newW = viewBox.w * scale;
    const newH = viewBox.h * scale;
    const newX = mouseX - ((mouseX - viewBox.x) / viewBox.w) * newW;
    const newY = mouseY - ((mouseY - viewBox.y) / viewBox.h) * newH;

    setViewBox({ x: newX, y: newY, w: newW, h: newH });
  }, [viewBox]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Allow panning with middle click, alt+click, or just left click on background
    if (e.button === 1 || e.altKey || e.target === svgRef.current || (e.target as SVGElement).tagName === 'rect' && (e.target as SVGElement).getAttribute('fill') === 'url(#grid)') {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - panStart.current.x) / rect.width) * viewBox.w;
    const dy = ((e.clientY - panStart.current.y) / rect.height) * viewBox.h;
    setViewBox((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
    panStart.current = { x: e.clientX, y: e.clientY };
  }, [viewBox.w, viewBox.h]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const fitToContent = () => {
    if (nodes.length === 0) return;
    const padding = 100;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    setViewBox({
      x: minX - padding,
      y: minY - padding,
      w: maxX - minX + padding * 2,
      h: maxY - minY + padding * 2,
    });
  };

  const zoomIn = () => setViewBox((v) => {
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    const nw = v.w * 0.8, nh = v.h * 0.8;
    return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
  });

  const zoomOut = () => setViewBox((v) => {
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    const nw = v.w * 1.2, nh = v.h * 1.2;
    return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-purple-500" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🧠</div>
        <h1 className="text-2xl font-bold">Mind Map Unavailable</h1>
        <p className="text-white/40">{error || 'Something went wrong.'}</p>
        <Link href={`/community/showcase/${params.id}`} className="mt-4 px-5 py-2.5 text-sm font-medium text-black bg-purple-500 hover:bg-purple-400 rounded-lg transition-colors">
          Back to Project
        </Link>
      </div>
    );
  }

  const groupNodes = nodes.filter((n) => n.node_type === 'group');
  const regularNodes = nodes.filter((n) => n.node_type !== 'group');

  return (
    <div className="h-screen flex flex-col bg-[#0a0a14] text-white overflow-hidden">
      {/* Nav */}
      <nav className="shrink-0 bg-[#0d0d0d]/95 backdrop-blur-md border-b border-white/10 z-30">
        <div className="max-w-full mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link href={`/community/showcase/${params.id}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              <span className="text-sm font-medium">Back to {project.title}</span>
            </Link>
            <div className="flex items-center gap-2 ml-4">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 rounded-full border border-purple-500/20">
                Deep Dive
              </span>
              <span className="text-xs text-white/40">Mind Map — Read Only</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={zoomIn} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title="Zoom In">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
            </button>
            <button onClick={zoomOut} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title="Zoom Out">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
            </button>
            <button onClick={fitToContent} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title="Fit to Content">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="select-none"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
            <marker id="arrowhead" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="5.6" orient="auto-start-reverse">
              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
            </marker>
            <marker id="arrowhead-reverse" viewBox="0 0 10 7" refX="0" refY="3.5" markerWidth="8" markerHeight="5.6" orient="auto-start-reverse">
              <polygon points="10 0, 0 3.5, 10 7" fill="currentColor" />
            </marker>
          </defs>

          {/* Grid background */}
          <rect x={viewBox.x - 5000} y={viewBox.y - 5000} width={viewBox.w + 10000} height={viewBox.h + 10000} fill="url(#grid)" />

          {/* Group nodes (background) */}
          {groupNodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={12}
                fill={node.color + '15'}
                stroke={node.color + '40'}
                strokeWidth={1}
                strokeDasharray="8 4"
              />
              <text x={node.x + 12} y={node.y + 20} fill={node.color} fontSize={12} fontWeight={600} opacity={0.7}>
                {node.label}
              </text>
            </g>
          ))}

          {/* Edges */}
          {edges.map((edge) => {
            const source = nodes.find((n) => n.id === edge.source_node_id);
            const target = nodes.find((n) => n.id === edge.target_node_id);
            if (!source || !target) return null;

            const sx = source.x + source.width / 2;
            const sy = source.y + source.height / 2;
            const tx = target.x + target.width / 2;
            const ty = target.y + target.height / 2;

            return (
              <g key={edge.id} style={{ color: edge.color }}>
                <line
                  x1={sx} y1={sy} x2={tx} y2={ty}
                  stroke={edge.color}
                  strokeWidth={edge.thickness}
                  strokeDasharray={getDashArray(edge.line_style)}
                  markerEnd={edge.arrow_type === 'forward' || edge.arrow_type === 'both' ? 'url(#arrowhead)' : undefined}
                  markerStart={edge.arrow_type === 'backward' || edge.arrow_type === 'both' ? 'url(#arrowhead-reverse)' : undefined}
                />
                {edge.label && (
                  <>
                    <rect
                      x={(sx + tx) / 2 - edge.label.length * 3.5 - 6}
                      y={(sy + ty) / 2 - 10}
                      width={edge.label.length * 7 + 12}
                      height={20}
                      rx={4}
                      fill="#1a1a2e"
                      stroke={edge.color}
                      strokeWidth={1}
                    />
                    <text
                      x={(sx + tx) / 2}
                      y={(sy + ty) / 2 + 4}
                      textAnchor="middle"
                      fill="white"
                      fontSize={11}
                      fontWeight={500}
                    >
                      {edge.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Regular nodes */}
          {regularNodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const truncatedLabel = node.label.length > 18 ? node.label.substring(0, 18) + '\u2026' : node.label;

            return (
              <g
                key={node.id}
                onClick={() => setSelectedNode(isSelected ? null : node)}
                className="cursor-pointer"
              >
                {/* Selection highlight */}
                {isSelected && (
                  node.shape === 'diamond' ? (
                    <polygon
                      points={`${node.x + node.width / 2},${node.y - 4} ${node.x + node.width + 4},${node.y + node.height / 2} ${node.x + node.width / 2},${node.y + node.height + 4} ${node.x - 4},${node.y + node.height / 2}`}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      opacity={0.6}
                    />
                  ) : (
                    <rect
                      x={node.x - 4}
                      y={node.y - 4}
                      width={node.width + 8}
                      height={node.height + 8}
                      rx={node.shape === 'circle' ? node.width / 2 + 4 : node.shape === 'rounded' ? 16 : 8}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      opacity={0.6}
                    />
                  )
                )}

                {/* Node shape */}
                {node.shape === 'diamond' ? (
                  <polygon
                    points={`${node.x + node.width / 2},${node.y} ${node.x + node.width},${node.y + node.height / 2} ${node.x + node.width / 2},${node.y + node.height} ${node.x},${node.y + node.height / 2}`}
                    fill={node.color + '20'}
                    stroke={node.color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                ) : (
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rx={node.shape === 'circle' ? node.width / 2 : node.shape === 'rounded' ? 12 : 4}
                    fill={node.color + '20'}
                    stroke={node.color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                )}

                {/* Character avatar */}
                {node.character_id && node.image_url && (
                  <>
                    <clipPath id={`avatar-${node.id}`}>
                      <circle cx={node.x + 18} cy={node.y + 18} r={12} />
                    </clipPath>
                    <image
                      href={node.image_url}
                      x={node.x + 6}
                      y={node.y + 6}
                      width={24}
                      height={24}
                      clipPath={`url(#avatar-${node.id})`}
                    />
                  </>
                )}

                {/* Character badge */}
                {node.node_type === 'character' && (
                  <circle cx={node.x + node.width - 6} cy={node.y + 6} r={4} fill={node.color} />
                )}

                {/* Label */}
                <text
                  x={node.x + node.width / 2}
                  y={node.y + node.height / 2 + (node.font_size || 14) / 3}
                  textAnchor="middle"
                  fill="white"
                  fontSize={node.font_size || 14}
                  fontWeight={node.node_type === 'character' ? 600 : 500}
                >
                  {truncatedLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Node info panel (when selected) */}
      {selectedNode && (
        <div className="absolute bottom-6 left-6 bg-[#1a1a2e]/95 backdrop-blur-md border border-white/10 rounded-xl p-5 max-w-sm shadow-2xl z-20">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.color }} />
              <h3 className="text-sm font-semibold text-white">{selectedNode.label}</h3>
            </div>
            <button onClick={() => setSelectedNode(null)} className="p-1 text-white/40 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <p className="text-white/40">
              Type: <span className="text-white/70 capitalize">{selectedNode.node_type}</span>
            </p>
            {selectedNode.notes && (
              <p className="text-white/50 whitespace-pre-line leading-relaxed">{selectedNode.notes}</p>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 right-6 bg-[#1a1a2e]/80 backdrop-blur-sm border border-white/5 rounded-lg px-3 py-2 z-20">
        <p className="text-[10px] text-white/30">Scroll to zoom &middot; Drag to pan &middot; Click nodes for details</p>
      </div>
    </div>
  );
}
