'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { Idea, IdeaStatus, IdeaCategory } from '@/lib/types';

interface SceneHead {
  id: string;
  content: string;
  scene_number: string | null;
}

interface Char {
  id: string;
  name: string;
  color: string;
}

interface IdeaWithLinks extends Idea {
  linked_scene_ids: string[];
  linked_character_ids: string[];
  image_url: string | null;
}

const STATUS_COLUMNS: { value: IdeaStatus; label: string; color: string }[] = [
  { value: 'spark', label: 'Spark', color: 'border-yellow-500/30' },
  { value: 'developing', label: 'Developing', color: 'border-blue-500/30' },
  { value: 'ready', label: 'Ready', color: 'border-green-500/30' },
  { value: 'used', label: 'Used', color: 'border-purple-500/30' },
  { value: 'discarded', label: 'Discarded', color: 'border-surface-600/30' },
];

const CATEGORIES: { value: IdeaCategory; label: string }[] = [
  { value: 'plot', label: 'Plot' }, { value: 'character', label: 'Character' },
  { value: 'dialogue', label: 'Dialogue' }, { value: 'visual', label: 'Visual' },
  { value: 'sound', label: 'Sound' }, { value: 'location', label: 'Location' },
  { value: 'prop', label: 'Prop' }, { value: 'costume', label: 'Costume' },
  { value: 'effect', label: 'Effect' }, { value: 'theme', label: 'Theme' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_COLORS: Record<number, string> = {
  1: 'text-surface-500', 2: 'text-surface-400', 3: 'text-yellow-500',
  4: 'text-orange-500', 5: 'text-red-500',
};

const LINK_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'linked_scene', label: 'Linked to Scene' },
  { value: 'linked_char', label: 'Linked to Character' },
  { value: 'has_image', label: 'Has Image' },
  { value: 'unlinked', label: 'Unlinked' },
] as const;

type LinkFilter = typeof LINK_FILTERS[number]['value'];

export default function IdeasPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [ideas, setIdeas] = useState<IdeaWithLinks[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<IdeaWithLinks | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailIdea, setDetailIdea] = useState<IdeaWithLinks | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<SceneHead[]>([]);
  const [characters, setCharacters] = useState<Char[]>([]);
  const [openMenuIdeaId, setOpenMenuIdeaId] = useState<string | null>(null);
  const [imageInputIdeaId, setImageInputIdeaId] = useState<string | null>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchIdeas(); fetchScenes(); fetchCharacters(); }, [params.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuIdeaId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchIdeas = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('ideas').select('*').eq('project_id', params.id).order('priority', { ascending: false });
      if (error) console.error('Ideas fetch error:', error.message);
      const raw = (data || []) as any[];
      const enriched: IdeaWithLinks[] = raw.map((r) => ({
        ...r,
        linked_scene_ids: r.linked_scene_ids || r.linked_scene_id ? [r.linked_scene_id].filter(Boolean) : [],
        linked_character_ids: r.linked_character_ids || [],
        image_url: r.image_url || null,
      }));
      setIdeas(enriched);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchScenes = async () => {
    const supabase = createClient();
    const { data: scripts } = await supabase.from('scripts').select('id').eq('project_id', params.id).limit(1);
    if (!scripts || scripts.length === 0) return;
    const { data: elements } = await supabase
      .from('script_elements')
      .select('id, content, scene_number')
      .eq('script_id', scripts[0].id)
      .eq('element_type', 'scene_heading')
      .eq('is_omitted', false)
      .order('sort_order');
    if (elements) setScenes(elements as SceneHead[]);
  };

  const fetchCharacters = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('characters')
      .select('id, name, color')
      .eq('project_id', params.id)
      .order('sort_order');
    if (data) setCharacters(data as Char[]);
  };

  const updateIdeaLocal = (id: string, patch: Partial<IdeaWithLinks>) => {
    setIdeas((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    const ok = await confirm({ message: 'Delete this idea?', variant: 'danger', confirmLabel: 'Delete' }); if (!ok) return;
    const supabase = createClient();
    await supabase.from('ideas').delete().eq('id', id);
    setIdeas(ideas.filter((i) => i.id !== id));
    setShowEditor(false);
    setShowDetail(false);
  };

  const handleDrop = async (status: IdeaStatus) => {
    if (!canEdit || !draggedId) return;
    const supabase = createClient();
    await supabase.from('ideas').update({ status }).eq('id', draggedId);
    setIdeas(ideas.map((i) => i.id === draggedId ? { ...i, status } : i));
    setDraggedId(null);
    setDragOverCol(null);
  };

  const toggleLinkScene = async (idea: IdeaWithLinks, sceneId: string) => {
    if (!canEdit) return;
    const current = idea.linked_scene_ids || [];
    const next = current.includes(sceneId) ? current.filter((id) => id !== sceneId) : [...current, sceneId];
    const supabase = createClient();
    await supabase.from('ideas').update({ linked_scene_ids: next } as any).eq('id', idea.id);
    updateIdeaLocal(idea.id, { linked_scene_ids: next });
    setOpenMenuIdeaId(null);
  };

  const toggleLinkCharacter = async (idea: IdeaWithLinks, charId: string) => {
    if (!canEdit) return;
    const current = idea.linked_character_ids || [];
    const next = current.includes(charId) ? current.filter((id) => id !== charId) : [...current, charId];
    const supabase = createClient();
    await supabase.from('ideas').update({ linked_character_ids: next } as any).eq('id', idea.id);
    updateIdeaLocal(idea.id, { linked_character_ids: next });
    setOpenMenuIdeaId(null);
  };

  const saveImageUrl = async (idea: IdeaWithLinks) => {
    if (!canEdit) return;
    const url = imageUrlDraft.trim() || null;
    const supabase = createClient();
    await supabase.from('ideas').update({ image_url: url } as any).eq('id', idea.id);
    updateIdeaLocal(idea.id, { image_url: url });
    setImageInputIdeaId(null);
    setImageUrlDraft('');
  };

  const filtered = ideas.filter((i) => {
    if (filterCategory !== 'all' && i.category !== filterCategory) return false;
    if (linkFilter === 'linked_scene' && (!i.linked_scene_ids || i.linked_scene_ids.length === 0)) return false;
    if (linkFilter === 'linked_char' && (!i.linked_character_ids || i.linked_character_ids.length === 0)) return false;
    if (linkFilter === 'has_image' && !i.image_url) return false;
    if (linkFilter === 'unlinked') {
      const hasAny = (i.linked_scene_ids && i.linked_scene_ids.length > 0) ||
        (i.linked_character_ids && i.linked_character_ids.length > 0) || i.image_url;
      if (hasAny) return false;
    }
    return true;
  });

  const openDetail = (idea: IdeaWithLinks, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-detail]')) return;
    setDetailIdea(idea);
    setShowDetail(true);
  };

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Ideas Board</h1>
          <p className="text-sm text-surface-400 mt-1">{ideas.length} ideas captured</p>
        </div>
        {canEdit && <Button onClick={() => { setSelectedIdea(null); setShowEditor(true); }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Capture Idea
        </Button>}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
        <button onClick={() => setFilterCategory('all')} className={cn(
          'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
          filterCategory === 'all' ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'text-surface-400 hover:text-white hover:bg-surface-900/5'
        )}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setFilterCategory(c.value)} className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
            filterCategory === c.value ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'text-surface-400 hover:text-white hover:bg-surface-900/5'
          )}>{c.label}</button>
        ))}
      </div>

      {/* Link filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {LINK_FILTERS.map((f) => (
          <button key={f.value} onClick={() => setLinkFilter(f.value)} className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
            linkFilter === f.value ? 'bg-blue-500/20 text-blue-400' : 'text-surface-400 hover:text-white hover:bg-surface-900/5'
          )}>{f.label}</button>
        ))}
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 min-h-[40vh] sm:min-h-[60vh]">
        {STATUS_COLUMNS.map((col) => {
          const colIdeas = filtered.filter((i) => i.status === col.value);
          return (
            <div key={col.value}
              className={cn(
                'rounded-xl border-2 border-dashed transition-colors p-3',
                dragOverCol === col.value ? 'border-[#FF5F1F]/50 bg-[#E54E15]/5' : col.color,
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.value); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(col.value); }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-surface-300">{col.label}</h3>
                <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded-full">{colIdeas.length}</span>
              </div>
              <div className="space-y-2">
                {colIdeas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    canEdit={canEdit}
                    scenes={scenes}
                    characters={characters}
                    draggedId={draggedId}
                    openMenuIdeaId={openMenuIdeaId}
                    imageInputIdeaId={imageInputIdeaId}
                    imageUrlDraft={imageUrlDraft}
                    menuRef={menuRef}
                    onDragStart={() => setDraggedId(idea.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
                    onClick={(e) => openDetail(idea, e)}
                    onToggleScene={(sid) => toggleLinkScene(idea, sid)}
                    onToggleCharacter={(cid) => toggleLinkCharacter(idea, cid)}
                    onOpenImageInput={() => { setImageInputIdeaId(idea.id); setImageUrlDraft(idea.image_url || ''); }}
                    onCloseImageInput={() => { setImageInputIdeaId(null); setImageUrlDraft(''); }}
                    onSaveImage={() => saveImageUrl(idea)}
                    onImageUrlDraftChange={setImageUrlDraft}
                    onOpenMenu={() => setOpenMenuIdeaId(openMenuIdeaId === idea.id ? null : idea.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <IdeaEditor isOpen={showEditor} onClose={() => setShowEditor(false)} idea={selectedIdea}
        projectId={params.id} userId={user?.id || ''}
        onSaved={() => { fetchIdeas(); setShowEditor(false); }} onDelete={handleDelete} canEdit={canEdit} />

      <IdeaDetailModal
        isOpen={showDetail}
        idea={detailIdea}
        scenes={scenes}
        characters={characters}
        onClose={() => setShowDetail(false)}
        onEdit={(idea) => { setSelectedIdea(idea); setShowDetail(false); setShowEditor(true); }}
        onDelete={(id) => { handleDelete(id); setShowDetail(false); }}
        canEdit={canEdit}
      />

      <ConfirmDialog />
    </div>
  );
}

function IdeaCard({
  idea, canEdit, scenes, characters, draggedId, openMenuIdeaId, imageInputIdeaId,
  imageUrlDraft, menuRef,
  onDragStart, onDragEnd, onClick, onToggleScene, onToggleCharacter,
  onOpenImageInput, onCloseImageInput, onSaveImage, onImageUrlDraftChange, onOpenMenu,
}: {
  idea: IdeaWithLinks;
  canEdit: boolean;
  scenes: SceneHead[];
  characters: Char[];
  draggedId: string | null;
  openMenuIdeaId: string | null;
  imageInputIdeaId: string | null;
  imageUrlDraft: string;
  menuRef: React.RefObject<HTMLDivElement>;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: (e: React.MouseEvent) => void;
  onToggleScene: (sceneId: string) => void;
  onToggleCharacter: (charId: string) => void;
  onOpenImageInput: () => void;
  onCloseImageInput: () => void;
  onSaveImage: () => void;
  onImageUrlDraftChange: (v: string) => void;
  onOpenMenu: () => void;
}) {
  const linkedScenes = scenes.filter((s) => idea.linked_scene_ids?.includes(s.id));
  const linkedChars = characters.filter((c) => idea.linked_character_ids?.includes(c.id));
  const showMenu = openMenuIdeaId === idea.id;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'bg-surface-900 rounded-lg p-3 cursor-grab active:cursor-grabbing border border-surface-800 hover:border-surface-700 transition-all',
        draggedId === idea.id ? 'opacity-50' : ''
      )}
    >
      {idea.image_url && (
        <img src={idea.image_url} alt="" className="w-full h-20 object-cover rounded mb-2" />
      )}

      <h4 className="text-sm font-medium text-white mb-1 line-clamp-2">{idea.title}</h4>
      {idea.description && <p className="text-xs text-surface-400 line-clamp-2 mb-2">{idea.description}</p>}

      {/* Linked badges */}
      {(linkedScenes.length > 0 || linkedChars.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {linkedScenes.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-medium">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" /></svg>
              {s.scene_number ? `#${s.scene_number}` : s.content.slice(0, 15)}
            </span>
          ))}
          {linkedChars.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium"
              style={{ backgroundColor: c.color + '20', borderColor: c.color + '50', color: c.color }}>
              {c.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Badge size="sm">{idea.category}</Badge>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={cn('text-[8px]', i < idea.priority ? PRIORITY_COLORS[idea.priority] : 'text-surface-700')}>●</span>
          ))}
        </div>
      </div>

      {idea.tags && idea.tags.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {idea.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-400">{t}</span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {canEdit && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-surface-800" data-no-detail>
          {/* Link to Scene */}
          <div className="relative" data-no-detail>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenMenu(); }}
              className={cn(
                'text-[10px] px-1.5 py-1 rounded transition-colors',
                showMenu ? 'bg-green-500/20 text-green-400' : 'text-surface-500 hover:text-green-400 hover:bg-green-500/10'
              )}
              title="Link to Scene"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" /></svg>
            </button>
            {showMenu && (
              <div ref={menuRef} className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border border-surface-700 bg-surface-900 shadow-xl p-1 max-h-48 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <p className="text-[10px] font-bold text-surface-500 uppercase px-2 py-1">Scenes</p>
                {scenes.length === 0 && <p className="text-xs text-surface-600 px-2 py-1">No scenes in script</p>}
                {scenes.map((s) => (
                  <button key={s.id} onClick={() => onToggleScene(s.id)}
                    className={cn(
                      'w-full text-left text-xs px-2 py-1.5 rounded flex items-center gap-2 transition-colors',
                      idea.linked_scene_ids?.includes(s.id)
                        ? 'bg-green-500/15 text-green-400'
                        : 'text-surface-300 hover:bg-surface-800'
                    )}>
                    <span className={cn(
                      'w-3 h-3 rounded border flex items-center justify-center text-[8px]',
                      idea.linked_scene_ids?.includes(s.id) ? 'bg-green-500 border-green-500 text-white' : 'border-surface-600'
                    )}>
                      {idea.linked_scene_ids?.includes(s.id) && '✓'}
                    </span>
                    {s.scene_number ? `#${s.scene_number} ` : ''}{s.content.slice(0, 30)}
                  </button>
                ))}
                <div className="border-t border-surface-800 mt-1 pt-1">
                  <p className="text-[10px] font-bold text-surface-500 uppercase px-2 py-1">Characters</p>
                  {characters.length === 0 && <p className="text-xs text-surface-600 px-2 py-1">No characters yet</p>}
                  {characters.map((c) => (
                    <button key={c.id} onClick={() => onToggleCharacter(c.id)}
                      className={cn(
                        'w-full text-left text-xs px-2 py-1.5 rounded flex items-center gap-2 transition-colors',
                        idea.linked_character_ids?.includes(c.id)
                          ? 'text-white'
                          : 'text-surface-300 hover:bg-surface-800'
                      )}
                      style={idea.linked_character_ids?.includes(c.id) ? { backgroundColor: c.color + '20' } : {}}>
                      <span className="w-3 h-3 rounded-full border" style={{ borderColor: c.color, backgroundColor: idea.linked_character_ids?.includes(c.id) ? c.color : 'transparent' }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add Image */}
          <div className="relative" data-no-detail>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenImageInput(); }}
              className="text-[10px] px-1.5 py-1 rounded text-surface-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
              title="Add Image"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            {imageInputIdeaId === idea.id && (
              <div ref={menuRef} className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border border-surface-700 bg-surface-900 shadow-xl p-2" onClick={(e) => e.stopPropagation()}>
                <p className="text-[10px] font-bold text-surface-500 uppercase mb-1.5">Image URL</p>
                <input
                  value={imageUrlDraft}
                  onChange={(e) => onImageUrlDraftChange(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded border border-surface-700 bg-surface-800 px-2 py-1.5 text-xs text-white placeholder:text-surface-600 focus:outline-none focus:border-[#FF5F1F]/50"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSaveImage(); } if (e.key === 'Escape') onCloseImageInput(); }}
                />
                <div className="flex gap-1 mt-1.5">
                  <Button size="sm" variant="secondary" onClick={onCloseImageInput} className="flex-1">Cancel</Button>
                  <Button size="sm" onClick={onSaveImage} className="flex-1">Save</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IdeaDetailModal({ isOpen, idea, scenes, characters, onClose, onEdit, onDelete, canEdit }: {
  isOpen: boolean;
  idea: IdeaWithLinks | null;
  scenes: SceneHead[];
  characters: Char[];
  onClose: () => void;
  onEdit: (idea: IdeaWithLinks) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
}) {
  if (!idea) return null;
  const linkedScenes = scenes.filter((s) => idea.linked_scene_ids?.includes(s.id));
  const linkedChars = characters.filter((c) => idea.linked_character_ids?.includes(c.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={idea.title} size="lg">
      <div className="space-y-5">
        {idea.image_url && (
          <img src={idea.image_url} alt="" className="w-full max-h-64 object-cover rounded-xl border border-surface-800" />
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge size="md">{idea.category}</Badge>
          <Badge variant="info" size="md">{idea.status}</Badge>
          <div className="flex items-center gap-0.5 ml-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={cn('text-xs', i < idea.priority ? PRIORITY_COLORS[idea.priority] : 'text-surface-700')}>●</span>
            ))}
          </div>
        </div>

        {idea.description && (
          <div>
            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Description</h4>
            <p className="text-sm text-surface-300 whitespace-pre-wrap">{idea.description}</p>
          </div>
        )}

        {linkedScenes.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Linked Scenes</h4>
            <div className="flex flex-wrap gap-2">
              {linkedScenes.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" /></svg>
                  {s.scene_number ? `Scene #${s.scene_number}` : s.content}
                </span>
              ))}
            </div>
          </div>
        )}

        {linkedChars.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Linked Characters</h4>
            <div className="flex flex-wrap gap-2">
              {linkedChars.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium"
                  style={{ backgroundColor: c.color + '20', borderColor: c.color + '50', color: c.color }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {idea.tags && idea.tags.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Tags</h4>
            <div className="flex gap-1.5 flex-wrap">
              {idea.tags.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded bg-surface-800 text-surface-400 border border-surface-700">{t}</span>
              ))}
            </div>
          </div>
        )}

        {idea.references && idea.references.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">References</h4>
            <div className="space-y-1">
              {idea.references.map((r, i) => (
                <a key={i} href={r} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-400 hover:underline truncate">{r}</a>
              ))}
            </div>
          </div>
        )}

        <div className="text-[10px] text-surface-600">
          Created {idea.created_at ? timeAgo(idea.created_at) : 'unknown'}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-surface-800">
          <div>{canEdit && <Button variant="danger" size="sm" onClick={() => onDelete(idea.id)}>Delete</Button>}</div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {canEdit && <Button onClick={() => onEdit(idea)}>Edit</Button>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function IdeaEditor({ isOpen, onClose, idea, projectId, userId, onSaved, onDelete, canEdit }: {
  isOpen: boolean; onClose: () => void; idea: IdeaWithLinks | null; projectId: string; userId: string;
  onSaved: () => void; onDelete: (id: string) => void; canEdit: boolean;
}) {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    setForm(idea ? { ...idea } : {
      title: '', description: '', category: 'plot' as IdeaCategory, status: 'spark' as IdeaStatus,
      priority: 3, tags: [], references: [],
      linked_scene_ids: [], linked_character_ids: [], image_url: null,
    });
    setTagInput('');
  }, [idea, isOpen]);

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm({ ...form, tags: [...(form.tags || []), tagInput.trim()] });
    setTagInput('');
  };

  const handleSave = async () => {
    if (!form.title) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const payload = { ...form, project_id: projectId, created_by: userId };
      if (idea) {
        const { error } = await supabase.from('ideas').update(payload).eq('id', idea.id);
        if (error) { toast.error(error.message); setLoading(false); return; }
      } else {
        const { error } = await supabase.from('ideas').insert(payload);
        if (error) { toast.error(error.message); setLoading(false); return; }
      }
    } catch (err) {
      toast.error('Failed to save idea');
    }
    setLoading(false);
    onSaved();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={idea ? `Edit: ${idea.title}` : 'Capture New Idea'} size="md">
      <div className="space-y-4">
        <Input label="Title" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What's the idea?" />
        <Textarea label="Details" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Describe the idea in detail..." />
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Category</label>
            <select value={form.category || 'story'} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Status</label>
            <select value={form.status || 'spark'} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              {STATUS_COLUMNS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Priority</label>
            <select value={form.priority || 3} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              <option value={1}>1 - Low</option><option value={2}>2</option><option value={3}>3 - Medium</option>
              <option value={4}>4</option><option value={5}>5 - Critical</option>
            </select>
          </div>
        </div>
        <Input label="Reference URL" value={(form.references || [])[0] || ''} onChange={(e) => setForm({ ...form, references: e.target.value ? [e.target.value] : [] })} placeholder="https://..." />
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Tags</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {(form.tags || []).map((t: string, i: number) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-800 text-xs text-surface-300">
                {t}
                <button onClick={() => setForm({ ...form, tags: form.tags.filter((_: any, idx: number) => idx !== i) })} className="text-surface-500 hover:text-red-400">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add tag..."
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
            <Button variant="secondary" size="sm" onClick={addTag}>Add</Button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-surface-800">
        <div>{canEdit && idea && <Button variant="danger" size="sm" onClick={() => onDelete(idea.id)}>Delete</Button>}</div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {canEdit && <Button onClick={handleSave} loading={loading}>{idea ? 'Save' : 'Capture'}</Button>}
        </div>
      </div>
    </Modal>
  );
}
