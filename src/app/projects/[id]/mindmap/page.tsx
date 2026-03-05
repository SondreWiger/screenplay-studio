'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Modal, Input, Badge, LoadingSpinner, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Character, MindMapNode, MindMapEdge, MindMapEdgeStyle, MindMapArrowType, MindMapNodeShape } from '@/lib/types';
import Link from 'next/link';

// ============================================================
// CONSTANTS & HELPERS
// ============================================================

const NODE_COLORS = [
  '#dd574e', '#e8863a', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6',
  '#6366f1', '#a855f7', '#f97316', '#84cc16',
];

const LINE_STYLES: { value: MindMapEdgeStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

const ARROW_TYPES: { value: MindMapArrowType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'forward', label: '→' },
  { value: 'backward', label: '←' },
  { value: 'both', label: '↔' },
];

const NODE_SHAPES: { value: MindMapNodeShape; label: string }[] = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'diamond', label: 'Diamond' },
];

function getDashArray(style: MindMapEdgeStyle): string {
  switch (style) {
    case 'dashed': return '8 4';
    case 'dotted': return '2 4';
    default: return '';
  }
}

function getNodeCenter(node: MindMapNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

// Arrow marker component helper
function getEdgePoints(source: MindMapNode, target: MindMapNode) {
  const sc = getNodeCenter(source);
  const tc = getNodeCenter(target);
  return { x1: sc.x, y1: sc.y, x2: tc.x, y2: tc.y };
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export default function MindMapPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  // Data state
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [edges, setEdges] = useState<MindMapEdge[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  // Canvas state
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState({ x: -400, y: -300, w: 1200, h: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Interaction state
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<MindMapEdge | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [resizingNode, setResizingNode] = useState<string | null>(null);
  const resizeStartRef = useRef<{ svgX: number; svgY: number; origW: number; origH: number } | null>(null);

  // Modal state
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [showEdgeEditor, setShowEdgeEditor] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Edit form state
  const [editNode, setEditNode] = useState<Partial<MindMapNode>>({});
  const [editEdge, setEditEdge] = useState<Partial<MindMapEdge>>({});

  // Tool mode
  const [tool, setTool] = useState<'select' | 'connect' | 'add'>('select');

  // ============================================================
  // FETCH DATA
  // ============================================================

  useEffect(() => {
    fetchAll();
  }, [params.id]);

  const fetchAll = async () => {
    try {
      const supabase = createClient();
      const [nodesRes, edgesRes, charsRes] = await Promise.all([
        supabase.from('mindmap_nodes').select('*').eq('project_id', params.id).order('z_index'),
        supabase.from('mindmap_edges').select('*').eq('project_id', params.id),
        supabase.from('characters').select('*').eq('project_id', params.id).order('sort_order'),
      ]);
      setNodes(nodesRes.data || []);
      setEdges(edgesRes.data || []);
      setCharacters(charsRes.data || []);
    } catch (err) {
      console.error('Error fetching mind map data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SVG COORDINATE CONVERSION
  // ============================================================

  const screenToSVG = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current || !containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w;
    const y = viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h;
    return { x, y };
  }, [viewBox]);

  // ============================================================
  // ZOOM
  // ============================================================

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    const svgPt = screenToSVG(e.clientX, e.clientY);
    setViewBox((vb) => {
      const newW = vb.w * scale;
      const newH = vb.h * scale;
      const newX = svgPt.x - (svgPt.x - vb.x) * scale;
      const newY = svgPt.y - (svgPt.y - vb.y) * scale;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, [screenToSVG]);

  // ============================================================
  // PAN
  // ============================================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey) || (tool === 'select' && e.target === svgRef.current)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, [tool]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, node: MindMapNode) => {
    e.stopPropagation();
    e.preventDefault();
    const svgPt = screenToSVG(e.clientX, e.clientY);
    resizeStartRef.current = { svgX: svgPt.x, svgY: svgPt.y, origW: node.width, origH: node.height };
    setResizingNode(node.id);
  }, [screenToSVG]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const svgPt = screenToSVG(e.clientX, e.clientY);
    setMousePos(svgPt);

    if (isPanning) {
      const dx = (e.clientX - panStart.x) * (viewBox.w / (containerRef.current?.clientWidth || 1));
      const dy = (e.clientY - panStart.y) * (viewBox.h / (containerRef.current?.clientHeight || 1));
      setViewBox((vb) => ({ ...vb, x: vb.x - dx, y: vb.y - dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (resizingNode && resizeStartRef.current) {
      const rs = resizeStartRef.current;
      const newW = Math.max(80, rs.origW + (svgPt.x - rs.svgX));
      const newH = Math.max(40, rs.origH + (svgPt.y - rs.svgY));
      setNodes((prev) => prev.map((n) => n.id === resizingNode ? { ...n, width: newW, height: newH } : n));
      return;
    }

    if (draggingNode) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNode
            ? { ...n, x: svgPt.x - dragOffset.x, y: svgPt.y - dragOffset.y }
            : n
        )
      );
    }
  }, [isPanning, panStart, viewBox, draggingNode, dragOffset, resizingNode, screenToSVG]);

  const handleMouseUp = useCallback(async () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (resizingNode) {
      const node = nodes.find((n) => n.id === resizingNode);
      if (node) {
        const supabase = createClient();
        await supabase
          .from('mindmap_nodes')
          .update({ width: node.width, height: node.height, updated_at: new Date().toISOString() })
          .eq('id', node.id);
      }
      setResizingNode(null);
      resizeStartRef.current = null;
      return;
    }

    if (draggingNode) {
      const node = nodes.find((n) => n.id === draggingNode);
      if (node) {
        const supabase = createClient();
        await supabase
          .from('mindmap_nodes')
          .update({ x: node.x, y: node.y, updated_at: new Date().toISOString() })
          .eq('id', node.id);
      }
      setDraggingNode(null);
    }
  }, [isPanning, resizingNode, draggingNode, nodes]);

  // ============================================================
  // NODE INTERACTIONS
  // ============================================================

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, node: MindMapNode) => {
    e.stopPropagation();

    if (tool === 'connect') {
      // Only set source if not already connecting; if already connecting, let click handler finish it
      if (!connectingFrom) {
        setConnectingFrom(node.id);
      }
      return;
    }

    if (node.is_locked) return;

    const svgPt = screenToSVG(e.clientX, e.clientY);
    setDragOffset({ x: svgPt.x - node.x, y: svgPt.y - node.y });
    setDraggingNode(node.id);
    setSelectedNode(node);
    setSelectedEdge(null);
  }, [tool, connectingFrom, screenToSVG]);

  const handleNodeClick = useCallback((e: React.MouseEvent, node: MindMapNode) => {
    e.stopPropagation();

    if (tool === 'connect' && connectingFrom && connectingFrom !== node.id) {
      createEdge(connectingFrom, node.id);
      setConnectingFrom(null);
      setTool('select');
      return;
    }

    setSelectedNode(node);
    setSelectedEdge(null);
  }, [tool, connectingFrom]);

  const handleNodeDoubleClick = useCallback((node: MindMapNode) => {
    if (!canEdit) return;
    setEditNode({ ...node });
    setShowNodeEditor(true);
  }, [canEdit]);

  const handleEdgeClick = useCallback((e: React.MouseEvent, edge: MindMapEdge) => {
    e.stopPropagation();
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const handleEdgeDoubleClick = useCallback((edge: MindMapEdge) => {
    if (!canEdit) return;
    setEditEdge({ ...edge });
    setShowEdgeEditor(true);
  }, [canEdit]);

  const handleCanvasClick = useCallback(async (e: React.MouseEvent) => {
    if (connectingFrom) {
      setConnectingFrom(null);
      return;
    }

    if (tool === 'add' && canEdit) {
      const svgPt = screenToSVG(e.clientX, e.clientY);
      await createNode({
        label: 'New Node',
        node_type: 'note',
        x: svgPt.x - 60,
        y: svgPt.y - 30,
        color: NODE_COLORS[nodes.length % NODE_COLORS.length],
      });
      setTool('select');
      return;
    }

    setSelectedNode(null);
    setSelectedEdge(null);
  }, [tool, connectingFrom, canEdit, screenToSVG, nodes.length]);

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  const createNode = async (data: Partial<MindMapNode>) => {
    const supabase = createClient();
    const newNode = {
      project_id: params.id,
      label: data.label || 'New Node',
      node_type: data.node_type || 'note',
      x: data.x || 0,
      y: data.y || 0,
      width: data.width || 140,
      height: data.height || 60,
      color: data.color || '#dd574e',
      shape: data.shape || 'rounded',
      font_size: data.font_size || 14,
      character_id: data.character_id || null,
      image_url: data.image_url || null,
      notes: data.notes || null,
      group_id: data.group_id || null,
      is_locked: false,
      z_index: nodes.length,
      created_by: user?.id,
    };

    const { data: created, error } = await supabase
      .from('mindmap_nodes')
      .insert(newNode)
      .select()
      .single();

    if (error) {
      console.error('Error creating node:', error.message);
      return null;
    }

    setNodes((prev) => [...prev, created]);
    return created;
  };

  const updateNode = async (id: string, data: Partial<MindMapNode>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('mindmap_nodes')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating node:', error.message);
      return;
    }

    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...data } : n)));
    if (selectedNode?.id === id) setSelectedNode((prev) => prev ? { ...prev, ...data } : null);
  };

  const deleteNode = async (id: string) => {
    const supabase = createClient();
    await supabase.from('mindmap_edges').delete().or(`source_node_id.eq.${id},target_node_id.eq.${id}`);
    await supabase.from('mindmap_nodes').delete().eq('id', id);
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source_node_id !== id && e.target_node_id !== id));
    if (selectedNode?.id === id) setSelectedNode(null);
  };

  const createEdge = async (sourceId: string, targetId: string) => {
    // Check for duplicate
    const existing = edges.find(
      (e) =>
        (e.source_node_id === sourceId && e.target_node_id === targetId) ||
        (e.source_node_id === targetId && e.target_node_id === sourceId)
    );
    if (existing) return;

    const supabase = createClient();
    const newEdge = {
      project_id: params.id,
      source_node_id: sourceId,
      target_node_id: targetId,
      label: null,
      color: '#888888',
      line_style: 'solid' as MindMapEdgeStyle,
      thickness: 2,
      arrow_type: 'none' as MindMapArrowType,
      animated: false,
      notes: null,
      created_by: user?.id,
    };

    const { data: created, error } = await supabase
      .from('mindmap_edges')
      .insert(newEdge)
      .select()
      .single();

    if (error) {
      console.error('Error creating edge:', error.message);
      return;
    }

    setEdges((prev) => [...prev, created]);
  };

  const updateEdge = async (id: string, data: Partial<MindMapEdge>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('mindmap_edges')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
    }
  };

  const deleteEdge = async (id: string) => {
    const supabase = createClient();
    await supabase.from('mindmap_edges').delete().eq('id', id);
    setEdges((prev) => prev.filter((e) => e.id !== id));
    if (selectedEdge?.id === id) setSelectedEdge(null);
  };

  // ============================================================
  // IMPORT CHARACTERS
  // ============================================================

  const importCharacters = async () => {
    const existingCharIds = new Set(nodes.filter((n) => n.character_id).map((n) => n.character_id));
    const toImport = characters.filter((c) => !existingCharIds.has(c.id));

    if (toImport.length === 0) {
      setShowImportModal(false);
      return;
    }

    // Layout in a circle formation
    const radius = Math.max(200, toImport.length * 50);
    const centerX = 0;
    const centerY = 0;
    const angleStep = (2 * Math.PI) / toImport.length;

    const supabase = createClient();
    const newNodes = toImport.map((char, i) => {
      const isMain = char.is_main ?? false;
      const nodeW = isMain ? 180 : 130;
      const nodeH = isMain ? 72 : 52;
      return {
        project_id: params.id,
        character_id: char.id,
        label: char.name,
        node_type: 'character' as const,
        x: centerX + radius * Math.cos(angleStep * i - Math.PI / 2) - nodeW / 2,
        y: centerY + radius * Math.sin(angleStep * i - Math.PI / 2) - nodeH / 2,
        width: nodeW,
        height: nodeH,
        color: char.color || NODE_COLORS[i % NODE_COLORS.length],
        shape: (isMain ? 'rounded' : 'rounded') as MindMapNodeShape,
        font_size: isMain ? 16 : 13,
        image_url: char.avatar_url,
        notes: char.description,
        group_id: null,
        is_locked: false,
        z_index: nodes.length + i,
        created_by: user?.id,
      };
    });

    const { data: created, error } = await supabase
      .from('mindmap_nodes')
      .insert(newNodes)
      .select();

    if (error) {
      console.error('Error importing characters:', error.message);
      return;
    }

    const createdNodes = created || [];
    setNodes((prev) => [...prev, ...createdNodes]);

    // Auto-create edges for existing character relationships
    const charNodeMap = new Map<string, string>();
    for (const n of [...nodes, ...createdNodes]) {
      if (n.character_id) charNodeMap.set(n.character_id, n.id);
    }

    const edgesToCreate: Array<{
      project_id: string;
      source_node_id: string;
      target_node_id: string;
      label: string | null;
      color: string;
      line_style: MindMapEdgeStyle;
      thickness: number;
      arrow_type: MindMapArrowType;
      animated: boolean;
      notes: string | null;
      created_by: string | undefined;
    }> = [];

    for (const char of toImport) {
      if (char.relationships && char.relationships.length > 0) {
        for (const rel of char.relationships) {
          const sourceNodeId = charNodeMap.get(char.id);
          const targetNodeId = charNodeMap.get(rel.character_id);
          if (sourceNodeId && targetNodeId) {
            // Avoid duplicate edges
            const alreadyExists = edgesToCreate.some(
              (e) =>
                (e.source_node_id === sourceNodeId && e.target_node_id === targetNodeId) ||
                (e.source_node_id === targetNodeId && e.target_node_id === sourceNodeId)
            ) || edges.some(
              (e) =>
                (e.source_node_id === sourceNodeId && e.target_node_id === targetNodeId) ||
                (e.source_node_id === targetNodeId && e.target_node_id === sourceNodeId)
            );

            if (!alreadyExists) {
              edgesToCreate.push({
                project_id: params.id,
                source_node_id: sourceNodeId,
                target_node_id: targetNodeId,
                label: rel.relationship || null,
                color: '#888888',
                line_style: 'solid',
                thickness: 2,
                arrow_type: 'forward',
                animated: false,
                notes: rel.description || null,
                created_by: user?.id,
              });
            }
          }
        }
      }
    }

    if (edgesToCreate.length > 0) {
      const { data: createdEdges } = await supabase
        .from('mindmap_edges')
        .insert(edgesToCreate)
        .select();
      if (createdEdges) setEdges((prev) => [...prev, ...createdEdges]);
    }

    setShowImportModal(false);
  };

  // ============================================================
  // ZOOM CONTROLS
  // ============================================================

  const zoomIn = () => {
    setViewBox((vb) => ({
      x: vb.x + vb.w * 0.1,
      y: vb.y + vb.h * 0.1,
      w: vb.w * 0.8,
      h: vb.h * 0.8,
    }));
  };

  const zoomOut = () => {
    setViewBox((vb) => ({
      x: vb.x - vb.w * 0.1,
      y: vb.y - vb.h * 0.1,
      w: vb.w * 1.2,
      h: vb.h * 1.2,
    }));
  };

  const fitToContent = () => {
    if (nodes.length === 0) {
      setViewBox({ x: -400, y: -300, w: 1200, h: 800 });
      return;
    }
    const padding = 100;
    const minX = Math.min(...nodes.map((n) => n.x)) - padding;
    const minY = Math.min(...nodes.map((n) => n.y)) - padding;
    const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + padding;
    const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + padding;
    setViewBox({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
  };

  // ============================================================
  // SAVE NODE EDITOR
  // ============================================================

  const saveNodeEdit = async () => {
    if (!editNode.id) return;
    await updateNode(editNode.id, {
      label: editNode.label,
      color: editNode.color,
      shape: editNode.shape,
      font_size: editNode.font_size,
      notes: editNode.notes,
      width: editNode.width,
      height: editNode.height,
      is_locked: editNode.is_locked,
    });
    setShowNodeEditor(false);
  };

  const saveEdgeEdit = async () => {
    if (!editEdge.id) return;
    await updateEdge(editEdge.id, {
      label: editEdge.label,
      color: editEdge.color,
      line_style: editEdge.line_style,
      thickness: editEdge.thickness,
      arrow_type: editEdge.arrow_type,
      animated: editEdge.animated,
      notes: editEdge.notes,
    });
    setShowEdgeEditor(false);
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) return <LoadingSpinner className="py-32" />;

  // Group nodes for rendering groups underneath
  const groupNodes = nodes.filter((n) => n.node_type === 'group');
  const regularNodes = nodes.filter((n) => n.node_type !== 'group');
  const importableCount = characters.filter(
    (c) => !nodes.some((n) => n.character_id === c.id)
  ).length;

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen flex flex-col bg-surface-950 relative">
      {/* TOOLBAR */}
      <div className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm px-4 py-2 flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white hidden sm:block">Mind Map</h1>
          <Badge variant="default">{nodes.length} nodes</Badge>
          <Badge variant="default">{edges.length} connections</Badge>
        </div>

        <div className="flex items-center gap-1">
          {/* Tool buttons */}
          {canEdit && (
            <div className="flex items-center bg-surface-900 rounded-lg p-0.5 mr-2">
              <button
                onClick={() => { setTool('select'); setConnectingFrom(null); }}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', tool === 'select' ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white')}
                title="Select & Move (V)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
              </button>
              <button
                onClick={() => setTool('connect')}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', tool === 'connect' ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white')}
                title="Connect Nodes (C)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </button>
              <button
                onClick={() => setTool('add')}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', tool === 'add' ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white')}
                title="Add Node (A)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          )}

          {/* Import characters */}
          {canEdit && characters.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="text-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Import Characters{importableCount > 0 && ` (${importableCount})`}
            </Button>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 ml-2">
            <button onClick={zoomIn} className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-900/5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
            </button>
            <button onClick={zoomOut} className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-900/5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
            </button>
            <button onClick={fitToContent} className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-900/5" title="Fit to content">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* CANVAS */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-hidden relative',
          tool === 'connect' && 'cursor-crosshair',
          tool === 'add' && 'cursor-cell',
          isPanning && 'cursor-grabbing',
        )}
      >
        {nodes.length === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center pointer-events-auto">
              <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="5" r="2.5" strokeWidth={1.5}/>
                  <circle cx="5" cy="18" r="2.5" strokeWidth={1.5}/>
                  <circle cx="19" cy="18" r="2.5" strokeWidth={1.5}/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5v3m0 0l-5.5 5m5.5-5l5.5 5"/>
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-1">Character Relationship Map</h3>
              <p className="text-surface-400 text-sm mb-4 max-w-sm">
                Visualize connections between your characters. Import from your character list or add nodes manually.
              </p>
              <div className="flex gap-2 justify-center">
                {canEdit && characters.length > 0 && (
                  <Button onClick={() => setShowImportModal(true)} size="sm">
                    Import Characters
                  </Button>
                )}
                {canEdit && (
                  <Button variant="secondary" size="sm" onClick={() => setTool('add')}>
                    Add Manually
                  </Button>
                )}
                <Link href={`/projects/${params.id}/characters`}>
                  <Button variant="ghost" size="sm">Go to Characters</Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
        >
          {/* Defs for arrow markers and patterns */}
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
            </marker>
            <marker id="arrowhead-reverse" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
              <polygon points="10 0, 0 3.5, 10 7" fill="#888" />
            </marker>
            {/* Grid pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Grid background */}
          <rect x={viewBox.x - 5000} y={viewBox.y - 5000} width={viewBox.w + 10000} height={viewBox.h + 10000} fill="url(#grid)" />

          {/* Group nodes (rendered as big background rects) */}
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
                strokeWidth={2}
                strokeDasharray="8 4"
                className="cursor-move"
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onClick={(e) => handleNodeClick(e, node)}
                onDoubleClick={() => handleNodeDoubleClick(node)}
              />
              <text
                x={node.x + 12}
                y={node.y + 20}
                fill={node.color}
                fontSize={12}
                fontWeight="600"
                opacity={0.7}
              >
                {node.label}
              </text>
            </g>
          ))}

          {/* Edges */}
          {edges.map((edge) => {
            const source = nodes.find((n) => n.id === edge.source_node_id);
            const target = nodes.find((n) => n.id === edge.target_node_id);
            if (!source || !target) return null;

            const pts = getEdgePoints(source, target);
            const isSelected = selectedEdge?.id === edge.id;
            const midX = (pts.x1 + pts.x2) / 2;
            const midY = (pts.y1 + pts.y2) / 2;

            return (
              <g key={edge.id}>
                {/* Hit area (invisible wider line for easier clicking) */}
                <line
                  x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                  stroke="transparent"
                  strokeWidth={Math.max(edge.thickness + 12, 16)}
                  className="cursor-pointer"
                  onClick={(e) => handleEdgeClick(e, edge)}
                  onDoubleClick={() => handleEdgeDoubleClick(edge)}
                />
                {/* Visible line */}
                <line
                  x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                  stroke={isSelected ? '#dd574e' : edge.color}
                  strokeWidth={edge.thickness}
                  strokeDasharray={getDashArray(edge.line_style)}
                  markerEnd={edge.arrow_type === 'forward' || edge.arrow_type === 'both' ? 'url(#arrowhead)' : undefined}
                  markerStart={edge.arrow_type === 'backward' || edge.arrow_type === 'both' ? 'url(#arrowhead-reverse)' : undefined}
                  className={cn(edge.animated && 'animate-pulse')}
                />
                {/* Selection indicator */}
                {isSelected && (
                  <line
                    x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                    stroke="#dd574e"
                    strokeWidth={edge.thickness + 4}
                    strokeDasharray={getDashArray(edge.line_style)}
                    opacity={0.3}
                  />
                )}
                {/* Edge label */}
                {edge.label && (
                  <g>
                    <rect
                      x={midX - (edge.label.length * 4)}
                      y={midY - 10}
                      width={edge.label.length * 8}
                      height={20}
                      rx={4}
                      fill="#1a1a2e"
                      stroke={edge.color}
                      strokeWidth={1}
                      opacity={0.9}
                    />
                    <text
                      x={midX}
                      y={midY + 4}
                      textAnchor="middle"
                      fill={edge.color}
                      fontSize={11}
                      fontWeight="500"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Connection preview line */}
          {connectingFrom && (() => {
            const fromNode = nodes.find((n) => n.id === connectingFrom);
            if (!fromNode) return null;
            const fc = getNodeCenter(fromNode);
            return (
              <line
                x1={fc.x} y1={fc.y}
                x2={mousePos.x} y2={mousePos.y}
                stroke="#dd574e"
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={0.6}
                pointerEvents="none"
              />
            );
          })()}

          {/* Regular Nodes */}
          {regularNodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const isDragging = draggingNode === node.id;
            const isConnectSource = connectingFrom === node.id;

            return (
              <g
                key={node.id}
                className={cn(
                  'cursor-grab transition-opacity',
                  isDragging && 'cursor-grabbing',
                  node.is_locked && 'cursor-default',
                )}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onClick={(e) => handleNodeClick(e, node)}
                onDoubleClick={() => handleNodeDoubleClick(node)}
              >
                {/* Selection glow */}
                {(isSelected || isConnectSource) && (
                  <rect
                    x={node.x - 4}
                    y={node.y - 4}
                    width={node.width + 8}
                    height={node.height + 8}
                    rx={node.shape === 'circle' ? (node.width + 8) / 2 : node.shape === 'rectangle' ? 4 : 12}
                    fill="none"
                    stroke={isConnectSource ? '#22c55e' : '#dd574e'}
                    strokeWidth={2}
                    opacity={0.6}
                    strokeDasharray={isConnectSource ? '4 4' : ''}
                  />
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
                    rx={node.shape === 'circle' ? node.width / 2 : node.shape === 'rectangle' ? 4 : 12}
                    fill={node.color + '20'}
                    stroke={node.color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                )}

                {/* Character avatar (small circle in top-left) */}
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

                {/* Node label */}
                <text
                  x={node.x + node.width / 2}
                  y={node.y + node.height / 2 + (node.font_size / 3.5)}
                  textAnchor="middle"
                  fill="white"
                  fontSize={node.font_size}
                  fontWeight={node.node_type === 'character' ? '600' : '500'}
                  pointerEvents="none"
                >
                  {node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label}
                </text>

                {/* Character badge */}
                {node.character_id && (
                  <circle
                    cx={node.x + node.width - 6}
                    cy={node.y + 6}
                    r={4}
                    fill={node.color}
                  />
                )}

                {/* Lock indicator */}
                {node.is_locked && (
                  <g transform={`translate(${node.x + node.width - 16}, ${node.y + node.height - 16})`}>
                    <rect width="14" height="14" rx="2" fill="rgba(0,0,0,0.6)" />
                    <path d="M3 6V5a4 4 0 018 0v1M2 6h10v7H2V6z" fill="#888" transform="scale(0.7) translate(3,2)" />
                  </g>
                )}

                {/* Resize handle — only when selected and can edit */}
                {isSelected && canEdit && !node.is_locked && (
                  <g
                    transform={`translate(${node.x + node.width - 10}, ${node.y + node.height - 10})`}
                    className="cursor-se-resize"
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeMouseDown(e, node); }}
                  >
                    <rect width="10" height="10" rx="2" fill={node.color} opacity={0.8} />
                    <line x1="3" y1="8" x2="8" y2="3" stroke="white" strokeWidth="1" opacity="0.7" />
                    <line x1="6" y1="8" x2="8" y2="6" stroke="white" strokeWidth="1" opacity="0.7" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tool hint */}
        {tool !== 'select' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-sm text-surface-300 shadow-xl z-20">
            {tool === 'connect' && (connectingFrom
              ? 'Click a target node to connect'
              : 'Click a source node to start connecting'
            )}
            {tool === 'add' && 'Click anywhere on the canvas to add a node'}
            <button onClick={() => { setTool('select'); setConnectingFrom(null); }} className="ml-3 text-[#FF5F1F] hover:text-[#FF8F5F] text-xs font-medium">Cancel (Esc)</button>
          </div>
        )}
      </div>

      {/* SELECTED NODE PROPERTIES PANEL */}
      {selectedNode && canEdit && (
        <div className="absolute right-4 top-16 w-64 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl p-4 z-20 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white truncate">{selectedNode.label}</h3>
            <button onClick={() => setSelectedNode(null)} className="text-surface-500 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {selectedNode.character_id && (
            <Link
              href={`/projects/${params.id}/characters`}
              className="text-xs text-[#FF5F1F] hover:text-[#FF8F5F] flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              View Character
            </Link>
          )}

          {/* Quick color */}
          <div>
            <label className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Color</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {NODE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateNode(selectedNode.id, { color: c })}
                  className={cn(
                    'w-5 h-5 rounded-full transition-transform hover:scale-125',
                    selectedNode.color === c && 'ring-2 ring-white ring-offset-1 ring-offset-surface-900'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Quick shape */}
          <div>
            <label className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Shape</label>
            <div className="flex gap-1 mt-1">
              {NODE_SHAPES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => updateNode(selectedNode.id, { shape: s.value })}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    selectedNode.shape === s.value ? 'bg-[#FF5F1F]/20 text-[#FF5F1F]' : 'bg-surface-800 text-surface-400 hover:text-white'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-surface-800">
            <button
              onClick={() => { setEditNode({ ...selectedNode }); setShowNodeEditor(true); }}
              className="flex-1 text-xs py-1.5 bg-surface-800 rounded-lg text-surface-300 hover:text-white hover:bg-surface-700 transition-colors"
            >
              Edit Details
            </button>
            <button
              onClick={() => updateNode(selectedNode.id, { is_locked: !selectedNode.is_locked })}
              className={cn('px-3 py-1.5 rounded-lg text-xs transition-colors', selectedNode.is_locked ? 'bg-[#FF5F1F]/20 text-[#FF5F1F]' : 'bg-surface-800 text-surface-400 hover:text-white')}
            >
              {selectedNode.is_locked ? '🔒' : '🔓'}
            </button>
            <button
              onClick={() => { if (confirm('Delete this node?')) deleteNode(selectedNode.id); }}
              className="px-3 py-1.5 bg-red-500/10 rounded-lg text-red-400 text-xs hover:bg-red-500/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* SELECTED EDGE PROPERTIES PANEL */}
      {selectedEdge && canEdit && (
        <div className="absolute right-4 top-16 w-64 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl p-4 z-20 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Connection</h3>
            <button onClick={() => setSelectedEdge(null)} className="text-surface-500 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Label</label>
              <Input
                value={selectedEdge.label || ''}
                onChange={(e) => {
                  setSelectedEdge((prev) => prev ? { ...prev, label: e.target.value } : null);
                  updateEdge(selectedEdge.id, { label: e.target.value || null });
                }}
                placeholder="e.g. married to, rival of"
                className="mt-1"
              />
            </div>

            {/* Style */}
            <div>
              <label className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Style</label>
              <div className="flex gap-1 mt-1">
                {LINE_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => { updateEdge(selectedEdge.id, { line_style: s.value }); setSelectedEdge((prev) => prev ? { ...prev, line_style: s.value } : null); }}
                    className={cn(
                      'px-2 py-1 text-xs rounded transition-colors',
                      selectedEdge.line_style === s.value ? 'bg-[#FF5F1F]/20 text-[#FF5F1F]' : 'bg-surface-800 text-surface-400 hover:text-white'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Arrows */}
            <div>
              <label className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Arrow</label>
              <div className="flex gap-1 mt-1">
                {ARROW_TYPES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => { updateEdge(selectedEdge.id, { arrow_type: a.value }); setSelectedEdge((prev) => prev ? { ...prev, arrow_type: a.value } : null); }}
                    className={cn(
                      'px-2 py-1 text-xs rounded transition-colors',
                      selectedEdge.arrow_type === a.value ? 'bg-[#FF5F1F]/20 text-[#FF5F1F]' : 'bg-surface-800 text-surface-400 hover:text-white'
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Color</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['#888888', '#dd574e', '#e8863a', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    onClick={() => { updateEdge(selectedEdge.id, { color: c }); setSelectedEdge((prev) => prev ? { ...prev, color: c } : null); }}
                    className={cn(
                      'w-5 h-5 rounded-full transition-transform hover:scale-125',
                      selectedEdge.color === c && 'ring-2 ring-white ring-offset-1 ring-offset-surface-900'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Thickness */}
            <div>
              <label className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Thickness</label>
              <input
                type="range"
                min={1}
                max={8}
                value={selectedEdge.thickness}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  updateEdge(selectedEdge.id, { thickness: v });
                  setSelectedEdge((prev) => prev ? { ...prev, thickness: v } : null);
                }}
                className="w-full mt-1 accent-brand-500"
              />
            </div>
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-surface-800">
            <button
              onClick={() => { if (confirm('Delete this connection?')) deleteEdge(selectedEdge.id); }}
              className="w-full text-xs py-1.5 bg-red-500/10 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Delete Connection
            </button>
          </div>
        </div>
      )}

      {/* NODE EDITOR MODAL */}
      <Modal isOpen={showNodeEditor} onClose={() => setShowNodeEditor(false)} title="Edit Node">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Label</label>
            <Input
              value={editNode.label || ''}
              onChange={(e) => setEditNode((prev) => ({ ...prev, label: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Width</label>
              <Input
                type="number"
                value={editNode.width || 140}
                onChange={(e) => setEditNode((prev) => ({ ...prev, width: parseInt(e.target.value) || 140 }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Height</label>
              <Input
                type="number"
                value={editNode.height || 60}
                onChange={(e) => setEditNode((prev) => ({ ...prev, height: parseInt(e.target.value) || 60 }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Font Size</label>
            <Input
              type="number"
              value={editNode.font_size || 14}
              onChange={(e) => setEditNode((prev) => ({ ...prev, font_size: parseInt(e.target.value) || 14 }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Notes</label>
            <textarea
              value={editNode.notes || ''}
              onChange={(e) => setEditNode((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[#FF5F1F]/50"
              placeholder="Notes about this character/node..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editNode.is_locked || false}
              onChange={(e) => setEditNode((prev) => ({ ...prev, is_locked: e.target.checked }))}
              className="rounded bg-surface-800 border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]"
            />
            <span className="text-sm text-surface-300">Lock position</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={saveNodeEdit} className="flex-1">Save</Button>
            <Button variant="secondary" onClick={() => setShowNodeEditor(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* EDGE EDITOR MODAL */}
      <Modal isOpen={showEdgeEditor} onClose={() => setShowEdgeEditor(false)} title="Edit Connection">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Relationship Label</label>
            <Input
              value={editEdge.label || ''}
              onChange={(e) => setEditEdge((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="e.g. married to, sibling, mentor"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Notes</label>
            <textarea
              value={editEdge.notes || ''}
              onChange={(e) => setEditEdge((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[#FF5F1F]/50"
              placeholder="Describe this relationship..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editEdge.animated || false}
              onChange={(e) => setEditEdge((prev) => ({ ...prev, animated: e.target.checked }))}
              className="rounded bg-surface-800 border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]"
            />
            <span className="text-sm text-surface-300">Animated (pulsing) line</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={saveEdgeEdit} className="flex-1">Save</Button>
            <Button variant="secondary" onClick={() => setShowEdgeEditor(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* IMPORT CHARACTERS MODAL */}
      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Import Characters">
        <div className="space-y-3">
          <p className="text-sm text-surface-400">
            Import your project characters as nodes on the mind map. Existing character relationships will be automatically linked.
          </p>

          {characters.length === 0 ? (
            <p className="text-sm text-surface-500 py-4 text-center">
              No characters in this project yet.{' '}
              <Link href={`/projects/${params.id}/characters`} className="text-[#FF5F1F] hover:underline">
                Add some characters first
              </Link>
            </p>
          ) : (
            <>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {characters.map((char) => {
                  const alreadyImported = nodes.some((n) => n.character_id === char.id);
                  return (
                    <div
                      key={char.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg',
                        alreadyImported ? 'opacity-40' : 'bg-surface-800/50'
                      )}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: char.color || '#dd574e' }}
                      >
                        {char.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{char.name}</p>
                        <p className="text-xs text-surface-400 truncate">
                          {char.is_main ? 'Main' : 'Supporting'}
                          {char.relationships?.length ? ` • ${char.relationships.length} relationship(s)` : ''}
                        </p>
                      </div>
                      {alreadyImported && (
                        <Badge variant="default" className="text-[10px]">Added</Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={importCharacters}
                  className="flex-1"
                  disabled={importableCount === 0}
                >
                  Import {importableCount} Character{importableCount !== 1 ? 's' : ''}
                </Button>
                <Button variant="secondary" onClick={() => setShowImportModal(false)}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
