'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Modal, Input, Badge, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { MoodBoardItem, MoodBoardItemType, MoodBoardSection, MoodBoardConnection } from '@/lib/types';

// ============================================================
// CONSTANTS
// ============================================================

const BOARD_SECTIONS: { value: MoodBoardSection; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: 'GEN' },
  { value: 'characters', label: 'Characters', icon: 'CHR' },
  { value: 'locations', label: 'Locations', icon: 'LOC' },
  { value: 'atmosphere', label: 'Atmosphere', icon: 'ATM' },
  { value: 'costumes', label: 'Costumes', icon: 'CST' },
  { value: 'props', label: 'Props', icon: 'PRP' },
];

const PRESET_COLORS = [
  '#dd574e', '#e8863a', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#ffffff',
  '#1a1a2e', '#2d1b69', '#0f3460', '#533483', '#e94560',
  '#f5e6cc', '#c4a882', '#8b7355', '#dda15e', '#606c38',
];

export default function MoodBoardPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Data
  const [items, setItems] = useState<MoodBoardItem[]>([]);
  const [connections, setConnections] = useState<MoodBoardConnection[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [activeSection, setActiveSection] = useState<MoodBoardSection | 'all'>('all');
  const [viewMode, setViewMode] = useState<'canvas' | 'grid'>('grid');
  const canvasRef = useRef<HTMLDivElement>(null);

  // Canvas tool state
  const [canvasTool, setCanvasTool] = useState<'move' | 'connect'>('move');
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedConnection, setSelectedConnection] = useState<MoodBoardConnection | null>(null);

  // Canvas drag state
  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Modals
  const [showAddItem, setShowAddItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);
  const [editItem, setEditItem] = useState<Partial<MoodBoardItem>>({});

  // Add form
  const [newItemType, setNewItemType] = useState<MoodBoardItemType>('image');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [newItemLinkUrl, setNewItemLinkUrl] = useState('');
  const [newItemColor, setNewItemColor] = useState('#dd574e');
  const [newItemSection, setNewItemSection] = useState<MoodBoardSection>('general');
  const [newItemTags, setNewItemTags] = useState('');

  // ============================================================
  // FETCH
  // ============================================================

  useEffect(() => {
    fetchItems();
  }, [params.id]);

  const fetchItems = async () => {
    try {
      const supabase = createClient();
      const [itemsRes, connectionsRes] = await Promise.all([
        supabase
          .from('mood_board_items')
          .select('*')
          .eq('project_id', params.id)
          .order('z_index', { ascending: true }),
        supabase
          .from('mood_board_connections')
          .select('*')
          .eq('project_id', params.id),
      ]);

      if (itemsRes.error) console.error('Error fetching mood board:', itemsRes.error.message);
      setItems(itemsRes.data || []);
      setConnections(connectionsRes.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CRUD
  // ============================================================

  const addItem = async () => {
    const supabase = createClient();
    const newItem = {
      project_id: params.id,
      item_type: newItemType,
      title: newItemTitle || null,
      content: newItemContent || null,
      image_url: newItemImageUrl || null,
      link_url: newItemLinkUrl || null,
      color: newItemType === 'color' ? newItemColor : null,
      x: Math.random() * 400,
      y: Math.random() * 300,
      width: newItemType === 'color' ? 120 : newItemType === 'text' || newItemType === 'note' ? 250 : 200,
      height: newItemType === 'color' ? 120 : newItemType === 'text' || newItemType === 'note' ? 150 : 200,
      rotation: 0,
      z_index: items.length,
      opacity: 1,
      tags: newItemTags ? newItemTags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      board_section: newItemSection,
      created_by: user?.id,
    };

    const { data, error } = await supabase
      .from('mood_board_items')
      .insert(newItem)
      .select()
      .single();

    if (error) {
      console.error('Error adding item:', error.message);
      return;
    }

    setItems((prev) => [...prev, data]);
    resetAddForm();
    setShowAddItem(false);
  };

  const updateItem = async (id: string, data: Partial<MoodBoardItem>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('mood_board_items')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...data } : it)));
    }
  };

  const deleteItem = async (id: string) => {
    const ok = await confirm({ message: 'Delete this item?', variant: 'danger', confirmLabel: 'Delete' }); if (!ok) return;
    const supabase = createClient();
    await supabase.from('mood_board_items').delete().eq('id', id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const saveEdit = async () => {
    if (!editItem.id) return;
    await updateItem(editItem.id, {
      title: editItem.title,
      content: editItem.content,
      image_url: editItem.image_url,
      link_url: editItem.link_url,
      color: editItem.color,
      board_section: editItem.board_section,
      tags: editItem.tags,
    });
    setShowEditItem(false);
  };

  const resetAddForm = () => {
    setNewItemTitle('');
    setNewItemContent('');
    setNewItemImageUrl('');
    setNewItemLinkUrl('');
    setNewItemColor('#dd574e');
    setNewItemTags('');
    setNewItemSection('general');
    setNewItemType('image');
  };

  // ============================================================
  // CONNECTION CRUD
  // ============================================================

  const createConnection = async (sourceId: string, targetId: string) => {
    // Check for duplicate
    const existing = connections.find(
      (c) =>
        (c.source_item_id === sourceId && c.target_item_id === targetId) ||
        (c.source_item_id === targetId && c.target_item_id === sourceId)
    );
    if (existing) return;

    const supabase = createClient();
    const newConn = {
      project_id: params.id,
      source_item_id: sourceId,
      target_item_id: targetId,
      label: null,
      color: '#888888',
      line_style: 'solid' as const,
      created_by: user?.id,
    };

    const { data, error } = await supabase
      .from('mood_board_connections')
      .insert(newConn)
      .select()
      .single();

    if (error) {
      console.error('Error creating connection:', error.message);
      return;
    }
    setConnections((prev) => [...prev, data]);
  };

  const updateConnection = async (id: string, data: Partial<MoodBoardConnection>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('mood_board_connections')
      .update(data)
      .eq('id', id);
    if (!error) {
      setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
      if (selectedConnection?.id === id) setSelectedConnection((prev) => prev ? { ...prev, ...data } : null);
    }
  };

  const deleteConnection = async (id: string) => {
    const supabase = createClient();
    await supabase.from('mood_board_connections').delete().eq('id', id);
    setConnections((prev) => prev.filter((c) => c.id !== id));
    if (selectedConnection?.id === id) setSelectedConnection(null);
  };

  // Get center of an item for drawing lines
  const getItemCenter = (item: MoodBoardItem) => ({
    x: item.x + item.width / 2,
    y: item.y + item.height / 2,
  });

  // ============================================================
  // CANVAS DRAG
  // ============================================================

  const handleItemMouseDown = useCallback((e: React.MouseEvent, item: MoodBoardItem) => {
    if (viewMode !== 'canvas' || !canEdit) return;
    e.preventDefault();
    e.stopPropagation();

    if (canvasTool === 'connect') {
      if (!connectingFrom) {
        setConnectingFrom(item.id);
      } else if (connectingFrom !== item.id) {
        createConnection(connectingFrom, item.id);
        setConnectingFrom(null);
      }
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraggingItem(item.id);
    setDragOffset({
      x: e.clientX - rect.left - item.x,
      y: e.clientY - rect.top - item.y,
    });
    setSelectedConnection(null);
    // Bring to front
    updateItem(item.id, { z_index: items.length + 1 });
  }, [viewMode, canEdit, canvasTool, connectingFrom, items.length]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (viewMode === 'canvas' && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (!draggingItem || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    setItems((prev) =>
      prev.map((it) => (it.id === draggingItem ? { ...it, x, y } : it))
    );
  }, [draggingItem, dragOffset, viewMode]);

  const handleMouseUp = useCallback(() => {
    if (draggingItem) {
      const item = items.find((it) => it.id === draggingItem);
      if (item) {
        updateItem(item.id, { x: item.x, y: item.y });
      }
      setDraggingItem(null);
    }
  }, [draggingItem, items]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // If clicking the canvas background (not an item), cancel connecting
    if (connectingFrom) {
      setConnectingFrom(null);
    }
    setSelectedConnection(null);
  }, [connectingFrom]);

  // ============================================================
  // FILTER
  // ============================================================

  const filteredItems = activeSection === 'all'
    ? items
    : items.filter((it) => it.board_section === activeSection);

  // ============================================================
  // RENDER ITEM
  // ============================================================

  const renderItemCard = (item: MoodBoardItem, isCanvas: boolean) => {
    const isConnectSource = connectingFrom === item.id;
    const isConnectTarget = canvasTool === 'connect' && connectingFrom && connectingFrom !== item.id;
    const baseClass = cn(
      'group relative overflow-hidden transition-all duration-200',
      isCanvas ? (canvasTool === 'connect' ? 'absolute cursor-crosshair' : 'absolute cursor-move') : 'cursor-pointer',
      !isCanvas && 'rounded-xl hover:ring-2 hover:ring-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5',
      isCanvas && isConnectSource && 'ring-2 ring-green-400 ring-offset-2 ring-offset-transparent',
      isCanvas && isConnectTarget && 'hover:ring-2 hover:ring-brand-400',
    );

    const style: React.CSSProperties = isCanvas
      ? {
          left: item.x,
          top: item.y,
          width: item.width,
          height: item.height,
          zIndex: item.z_index,
          transform: `rotate(${item.rotation}deg)`,
          opacity: item.opacity,
        }
      : {};

    return (
      <div
        key={item.id}
        className={baseClass}
        style={style}
        onMouseDown={isCanvas ? (e) => handleItemMouseDown(e, item) : undefined}
        onClick={!isCanvas && canEdit ? () => { setEditItem({ ...item }); setShowEditItem(true); } : undefined}
      >
        {/* Image items */}
        {item.item_type === 'image' && item.image_url && (
          <div className={cn('bg-surface-900 border border-surface-800', isCanvas ? 'w-full h-full rounded-lg' : 'rounded-xl overflow-hidden')}>
            <img
              src={item.image_url}
              alt={item.title || 'Mood board image'}
              className={cn('w-full object-cover rounded-lg', isCanvas ? 'h-full' : 'h-auto')}
              draggable={false}
            />
            {item.title && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 rounded-b-lg">
                <p className="text-xs text-white font-medium truncate">{item.title}</p>
              </div>
            )}
          </div>
        )}

        {/* Color swatch */}
        {item.item_type === 'color' && (
          <div className={cn('border border-surface-700', isCanvas ? 'w-full h-full rounded-lg' : 'rounded-xl aspect-[4/3]')}>
            <div
              className="w-full h-full rounded-lg flex flex-col items-center justify-center"
              style={{ backgroundColor: item.color || '#dd574e' }}
            >
              <span className={cn(
                'text-xs font-mono font-bold',
                isColorLight(item.color || '#dd574e') ? 'text-black/70' : 'text-white/80'
              )}>
                {item.color || '#dd574e'}
              </span>
              {item.title && (
                <span className={cn(
                  'text-[10px] mt-1',
                  isColorLight(item.color || '#dd574e') ? 'text-black/50' : 'text-white/60'
                )}>
                  {item.title}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Text/Note items */}
        {(item.item_type === 'text' || item.item_type === 'note') && (
          <div className={cn(
            'bg-surface-900 border border-surface-800 p-3',
            isCanvas ? 'w-full h-full rounded-lg overflow-hidden' : 'rounded-xl',
            item.item_type === 'note' && 'bg-yellow-500/5 border-yellow-500/20'
          )}>
            {item.title && (
              <p className={cn('text-sm font-semibold mb-1', item.item_type === 'note' ? 'text-yellow-400' : 'text-white')}>
                {item.title}
              </p>
            )}
            {item.content && (
              <p className="text-xs text-surface-400 whitespace-pre-wrap line-clamp-6">
                {item.content}
              </p>
            )}
          </div>
        )}

        {/* Link items */}
        {item.item_type === 'link' && (
          <div className={cn('bg-surface-900 border border-surface-800 p-3', isCanvas ? 'w-full h-full rounded-lg' : 'rounded-xl')}>
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <p className="text-sm font-medium text-white truncate">{item.title || 'Link'}</p>
            </div>
            {item.link_url && (
              <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate block">
                {item.link_url}
              </a>
            )}
            {item.content && <p className="text-xs text-surface-400 mt-1 line-clamp-3">{item.content}</p>}
          </div>
        )}

        {/* Section badge + actions overlay */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setEditItem({ ...item }); setShowEditItem(true); }}
                className="p-1 rounded bg-black/60 text-white/80 hover:text-white text-xs"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                className="p-1 rounded bg-black/60 text-red-400 hover:text-red-300 text-xs"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </>
          )}
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && !isCanvas && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-black/50 text-surface-300">{tag}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen flex flex-col bg-surface-950">
      {/* TOOLBAR */}
      <div className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm px-4 py-2 flex items-center justify-between gap-3 z-10 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <h1 className="text-lg font-bold text-white hidden sm:block shrink-0">Mood Board</h1>
          <Badge variant="default">{filteredItems.length} items</Badge>

          {/* Section filter pills */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setActiveSection('all')}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                activeSection === 'all' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
              )}
            >
              All
            </button>
            {BOARD_SECTIONS.map((section) => (
              <button
                key={section.value}
                onClick={() => setActiveSection(section.value)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                  activeSection === section.value ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
                )}
              >
                {section.icon} {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex items-center bg-surface-900 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-1.5 rounded-md transition-colors', viewMode === 'grid' ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-white')}
              title="Grid View"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button
              onClick={() => setViewMode('canvas')}
              className={cn('p-1.5 rounded-md transition-colors', viewMode === 'canvas' ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-white')}
              title="Canvas View"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm10-2a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" /></svg>
            </button>
          </div>

          {/* Canvas tools (only in canvas mode) */}
          {viewMode === 'canvas' && canEdit && (
            <div className="flex items-center bg-surface-900 rounded-lg p-0.5">
              <button
                onClick={() => { setCanvasTool('move'); setConnectingFrom(null); }}
                className={cn('px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors', canvasTool === 'move' ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-white')}
                title="Move items"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
              </button>
              <button
                onClick={() => setCanvasTool('connect')}
                className={cn('px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors', canvasTool === 'connect' ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-white')}
                title="Connect items"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </button>
            </div>
          )}

          {viewMode === 'canvas' && connections.length > 0 && (
            <Badge variant="default">{connections.length} links</Badge>
          )}

          {canEdit && (
            <Button size="sm" onClick={() => { resetAddForm(); setShowAddItem(true); }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add
            </Button>
          )}
        </div>
      </div>

      {/* CONTENT */}
      {filteredItems.length === 0 && !loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎨</span>
            </div>
            <h3 className="text-white font-semibold mb-1">
              {activeSection === 'all' ? 'Start Your Mood Board' : `No ${BOARD_SECTIONS.find((s) => s.value === activeSection)?.label} Items`}
            </h3>
            <p className="text-surface-400 text-sm mb-4 max-w-sm">
              Collect visual references, color palettes, notes, and links to define the look and feel of your project.
            </p>
            {canEdit && (
              <Button size="sm" onClick={() => { resetAddForm(); setShowAddItem(true); }}>Add Your First Item</Button>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW — masonry columns for tight packing */
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-3 stagger-children">
            {filteredItems.map((item) => (
              <div key={item.id} className="break-inside-avoid mb-3">
                {renderItemCard(item, false)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* CANVAS VIEW */
        <div
          ref={canvasRef}
          className={cn(
            'flex-1 overflow-auto relative bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[length:24px_24px]',
            canvasTool === 'connect' && 'cursor-crosshair',
          )}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        >
          <div className="relative min-w-[2000px] min-h-[1500px]">
            {/* SVG overlay for connection lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10000 }}>
              {connections.map((conn) => {
                const sourceItem = items.find((it) => it.id === conn.source_item_id);
                const targetItem = items.find((it) => it.id === conn.target_item_id);
                if (!sourceItem || !targetItem) return null;
                const sc = getItemCenter(sourceItem);
                const tc = getItemCenter(targetItem);
                const midX = (sc.x + tc.x) / 2;
                const midY = (sc.y + tc.y) / 2;
                const isSelected = selectedConnection?.id === conn.id;
                const dashArray = conn.line_style === 'dashed' ? '8 4' : conn.line_style === 'dotted' ? '2 4' : '';

                return (
                  <g key={conn.id}>
                    {/* Hit area for clicking */}
                    <line
                      x1={sc.x} y1={sc.y} x2={tc.x} y2={tc.y}
                      stroke="transparent"
                      strokeWidth={16}
                      className="cursor-pointer pointer-events-auto"
                      onClick={(e) => { e.stopPropagation(); setSelectedConnection(conn); }}
                    />
                    {/* Selection glow */}
                    {isSelected && (
                      <line
                        x1={sc.x} y1={sc.y} x2={tc.x} y2={tc.y}
                        stroke="#dd574e"
                        strokeWidth={6}
                        opacity={0.3}
                        strokeDasharray={dashArray}
                      />
                    )}
                    {/* Visible line */}
                    <line
                      x1={sc.x} y1={sc.y} x2={tc.x} y2={tc.y}
                      stroke={isSelected ? '#dd574e' : conn.color}
                      strokeWidth={2}
                      strokeDasharray={dashArray}
                    />
                    {/* Label */}
                    {conn.label && (
                      <g>
                        <rect
                          x={midX - (conn.label.length * 3.5)}
                          y={midY - 10}
                          width={conn.label.length * 7}
                          height={20}
                          rx={4}
                          fill="#1a1a2e"
                          stroke={conn.color}
                          strokeWidth={1}
                          opacity={0.9}
                        />
                        <text
                          x={midX}
                          y={midY + 4}
                          textAnchor="middle"
                          fill={conn.color}
                          fontSize={11}
                          fontWeight="500"
                        >
                          {conn.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
              {/* Preview line while connecting */}
              {connectingFrom && (() => {
                const fromItem = items.find((it) => it.id === connectingFrom);
                if (!fromItem) return null;
                const fc = getItemCenter(fromItem);
                return (
                  <line
                    x1={fc.x} y1={fc.y}
                    x2={mousePos.x} y2={mousePos.y}
                    stroke="#dd574e"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    opacity={0.6}
                  />
                );
              })()}
            </svg>

            {filteredItems.map((item) => renderItemCard(item, true))}
          </div>

          {/* Connect tool hint */}
          {canvasTool === 'connect' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-sm text-surface-300 shadow-xl z-[10001]">
              {connectingFrom
                ? 'Click a target item to connect'
                : 'Click a source item to start connecting'
              }
              <button onClick={() => { setCanvasTool('move'); setConnectingFrom(null); }} className="ml-3 text-brand-400 hover:text-brand-300 text-xs font-medium">Cancel</button>
            </div>
          )}

          {/* Selected connection panel */}
          {selectedConnection && canEdit && (
            <div className="absolute right-4 top-4 w-56 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl p-4 z-[10001] space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Connection</h3>
                <button onClick={() => setSelectedConnection(null)} className="text-surface-500 hover:text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div>
                <label className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Label</label>
                <Input
                  value={selectedConnection.label || ''}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setSelectedConnection((prev) => prev ? { ...prev, label: v } : null);
                    updateConnection(selectedConnection.id, { label: v });
                  }}
                  placeholder="e.g. inspired by, similar color"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Color</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {['#888888', '#dd574e', '#e8863a', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'].map((c) => (
                    <button
                      key={c}
                      onClick={() => { updateConnection(selectedConnection.id, { color: c }); setSelectedConnection((prev) => prev ? { ...prev, color: c } : null); }}
                      className={cn(
                        'w-5 h-5 rounded-full transition-transform hover:scale-125',
                        selectedConnection.color === c && 'ring-2 ring-white ring-offset-1 ring-offset-surface-900'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Style</label>
                <div className="flex gap-1 mt-1">
                  {([{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }] as const).map((s) => (
                    <button
                      key={s.value}
                      onClick={() => { updateConnection(selectedConnection.id, { line_style: s.value }); setSelectedConnection((prev) => prev ? { ...prev, line_style: s.value } : null); }}
                      className={cn(
                        'px-2 py-1 text-xs rounded transition-colors',
                        selectedConnection.line_style === s.value ? 'bg-brand-500/20 text-brand-400' : 'bg-surface-800 text-surface-400 hover:text-white'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-surface-800">
                <button
                  onClick={async () => { const ok = await confirm({ message: 'Delete this connection?', variant: 'danger', confirmLabel: 'Delete' }); if (ok) deleteConnection(selectedConnection.id); }}
                  className="w-full text-xs py-1.5 bg-red-500/10 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Delete Connection
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADD ITEM MODAL */}
      <Modal isOpen={showAddItem} onClose={() => setShowAddItem(false)} title="Add to Mood Board">
        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Type</label>
            <div className="grid grid-cols-5 gap-2">
              {([
                { value: 'image', label: 'Image', icon: '🖼️' },
                { value: 'color', label: 'Color', icon: '🎨' },
                { value: 'text', label: 'Text', icon: '📝' },
                { value: 'note', label: 'Note', icon: '📌' },
                { value: 'link', label: 'Link', icon: '🔗' },
              ] as const).map((t) => (
                <button
                  key={t.value}
                  onClick={() => setNewItemType(t.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors',
                    newItemType === t.value ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30' : 'bg-surface-800 text-surface-400 hover:text-white'
                  )}
                >
                  <span className="text-lg">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Title (optional)</label>
            <Input value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="A short description..." />
          </div>

          {/* Type-specific fields */}
          {newItemType === 'image' && (
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Image URL</label>
              <Input value={newItemImageUrl} onChange={(e) => setNewItemImageUrl(e.target.value)} placeholder="https://..." />
              {newItemImageUrl && (
                <div className="mt-2 rounded-lg overflow-hidden border border-surface-700 bg-surface-900 max-h-40">
                  <img src={newItemImageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
          )}

          {newItemType === 'color' && (
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Color</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewItemColor(c)}
                    className={cn(
                      'w-7 h-7 rounded-lg transition-transform hover:scale-110 border',
                      newItemColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900 border-white/30' : 'border-surface-600',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Input type="text" value={newItemColor} onChange={(e) => setNewItemColor(e.target.value)} placeholder="#hex" />
              <div className="mt-2 h-12 rounded-lg border border-surface-700" style={{ backgroundColor: newItemColor }} />
            </div>
          )}

          {(newItemType === 'text' || newItemType === 'note') && (
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Content</label>
              <textarea
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder={newItemType === 'note' ? 'Quick note...' : 'Text content...'}
              />
            </div>
          )}

          {newItemType === 'link' && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">URL</label>
                <Input value={newItemLinkUrl} onChange={(e) => setNewItemLinkUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">Description (optional)</label>
                <textarea
                  value={newItemContent}
                  onChange={(e) => setNewItemContent(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  placeholder="What this link is about..."
                />
              </div>
            </>
          )}

          {/* Section */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Section</label>
            <div className="flex flex-wrap gap-1.5">
              {BOARD_SECTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setNewItemSection(s.value)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full transition-colors',
                    newItemSection === s.value ? 'bg-brand-500/20 text-brand-400' : 'bg-surface-800 text-surface-400 hover:text-white'
                  )}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Tags (comma separated)</label>
            <Input value={newItemTags} onChange={(e) => setNewItemTags(e.target.value)} placeholder="warm, sunset, moody" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={addItem} className="flex-1">Add to Board</Button>
            <Button variant="secondary" onClick={() => setShowAddItem(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* EDIT ITEM MODAL */}
      <Modal isOpen={showEditItem} onClose={() => setShowEditItem(false)} title="Edit Item">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Title</label>
            <Input
              value={editItem.title || ''}
              onChange={(e) => setEditItem((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          {(editItem.item_type === 'text' || editItem.item_type === 'note' || editItem.item_type === 'link') && (
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Content</label>
              <textarea
                value={editItem.content || ''}
                onChange={(e) => setEditItem((prev) => ({ ...prev, content: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          )}

          {editItem.item_type === 'image' && (
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Image URL</label>
              <Input
                value={editItem.image_url || ''}
                onChange={(e) => setEditItem((prev) => ({ ...prev, image_url: e.target.value }))}
              />
            </div>
          )}

          {editItem.item_type === 'color' && (
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Color</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditItem((prev) => ({ ...prev, color: c }))}
                    className={cn(
                      'w-7 h-7 rounded-lg transition-transform hover:scale-110 border',
                      editItem.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900 border-white/30' : 'border-surface-600',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="h-12 rounded-lg border border-surface-700" style={{ backgroundColor: editItem.color || '#dd574e' }} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Section</label>
            <div className="flex flex-wrap gap-1.5">
              {BOARD_SECTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setEditItem((prev) => ({ ...prev, board_section: s.value }))}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full transition-colors',
                    editItem.board_section === s.value ? 'bg-brand-500/20 text-brand-400' : 'bg-surface-800 text-surface-400 hover:text-white'
                  )}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={saveEdit} className="flex-1">Save</Button>
            <Button variant="secondary" onClick={() => setShowEditItem(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog />
    </div>
  );
}

// ============================================================
// Utility
// ============================================================

function isColorLight(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
