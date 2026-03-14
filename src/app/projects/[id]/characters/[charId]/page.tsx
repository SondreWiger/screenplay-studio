'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { useRouter } from 'next/navigation';
import { Button, Badge, Input, Textarea, Avatar, LoadingSpinner, Modal } from '@/components/ui';
import { cn, randomColor } from '@/lib/utils';
import type { Character, MindMapNode, MindMapEdge } from '@/lib/types';

// ============================================================
// Types
// ============================================================
type InspoImage = { url: string; caption: string };
type RefFolder = { id: string; name: string; type: 'makeup' | 'costume' | 'other'; images: InspoImage[] };
type RelationEntry = {
  edge: MindMapEdge;
  /** true = this character is the source of the edge */
  isSource: boolean;
  otherChar: Pick<Character, 'id' | 'name' | 'color' | 'avatar_url' | 'role' | 'is_main'> | null;
  otherLabel: string; // fallback node label if no character attached
};

// ============================================================
// Role helpers (keep in sync with list page)
// ============================================================
const ROLE_OPTIONS = [
  { value: 'protagonist',  label: 'Protagonist',  activeText: 'text-amber-300',   activeBg: 'bg-amber-400/10',    activeBorder: 'border-amber-400/40' },
  { value: 'antagonist',   label: 'Antagonist',   activeText: 'text-red-400',      activeBg: 'bg-red-400/10',      activeBorder: 'border-red-400/40' },
  { value: 'main',         label: 'Main Cast',    activeText: 'text-sky-400',      activeBg: 'bg-sky-400/10',      activeBorder: 'border-sky-400/40' },
  { value: 'supporting',   label: 'Supporting',   activeText: 'text-emerald-400',  activeBg: 'bg-emerald-400/10',  activeBorder: 'border-emerald-400/40' },
  { value: 'minor',        label: 'Minor',        activeText: 'text-surface-300',  activeBg: 'bg-surface-700/60',  activeBorder: 'border-surface-600' },
  { value: 'ensemble',     label: 'Ensemble',     activeText: 'text-violet-400',   activeBg: 'bg-violet-400/10',   activeBorder: 'border-violet-400/40' },
] as const;
type RoleValue = typeof ROLE_OPTIONS[number]['value'] | '';

function RoleBadge({ role, isMain }: { role: string | null | undefined; isMain: boolean }) {
  const meta = role ? ROLE_OPTIONS.find((r) => r.value === role) : isMain ? ROLE_OPTIONS.find((r) => r.value === 'main') : null;
  if (!meta) return null;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', meta.activeText, meta.activeBg, meta.activeBorder)}>
      {meta.label}
    </span>
  );
}

// Arrow direction label for relations
function arrowLabel(type: string, isSource: boolean): string {
  if (type === 'forward') return isSource ? '→' : '←';
  if (type === 'backward') return isSource ? '←' : '→';
  if (type === 'both') return '↔';
  return '—';
}

// ============================================================
// Main page
// ============================================================
export default function CharacterDetailPage({ params }: { params: { id: string; charId: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const router = useRouter();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [character, setCharacter] = useState<Character | null>(null);
  const [relations, setRelations] = useState<RelationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'inspiration' | 'actor' | 'production' | 'relations'>('overview');
  const [saving, setSaving] = useState(false);

  // Inspiration state
  const [newInspoUrl, setNewInspoUrl] = useState('');
  const [newInspoCaption, setNewInspoCaption] = useState('');

  // Actor state
  const [newActorUrl, setNewActorUrl] = useState('');
  const [showActorUrlForm, setShowActorUrlForm] = useState(false);

  // Production state
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState<'makeup' | 'costume' | 'other'>('makeup');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderAdd, setFolderAdd] = useState<Record<string, { url: string; caption: string }>>({});

  // ---- Load ----
  const loadAll = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [charRes, nodesRes] = await Promise.all([
      supabase.from('characters').select('*').eq('id', params.charId).single(),
      supabase.from('mindmap_nodes').select('id').eq('project_id', params.id).eq('character_id', params.charId),
    ]);

    const char = charRes.data as Character;
    setCharacter(char);
    if (char) document.title = `${char.name} — Screenplay Studio`;

    const myNodeIds: string[] = (nodesRes.data || []).map((n: { id: string }) => n.id);
    if (myNodeIds.length > 0) {
      const orFilter = myNodeIds.map((id) => `source_node_id.eq.${id},target_node_id.eq.${id}`).join(',');
      const { data: edges } = await supabase
        .from('mindmap_edges')
        .select('*')
        .or(orFilter);

      if (edges && edges.length > 0) {
        const otherNodeIds: string[] = (edges as MindMapEdge[]).reduce<string[]>((acc, e) => {
          const otherId = myNodeIds.includes(e.source_node_id) ? e.target_node_id : e.source_node_id;
          if (!acc.includes(otherId)) acc.push(otherId);
          return acc;
        }, []);

        const { data: otherNodes } = await supabase
          .from('mindmap_nodes')
          .select('id, character_id, label')
          .in('id', otherNodeIds);

        const charIds = (otherNodes || [])
          .filter((n: { character_id: string | null }) => n.character_id)
          .map((n: { character_id: string }) => n.character_id);

        const characterMap: Record<string, Pick<Character, 'id' | 'name' | 'color' | 'avatar_url' | 'role' | 'is_main'>> = {};
        if (charIds.length > 0) {
          const { data: chars } = await supabase
            .from('characters')
            .select('id, name, color, avatar_url, role, is_main')
            .in('id', charIds);
          (chars || []).forEach((c: Pick<Character, 'id' | 'name' | 'color' | 'avatar_url' | 'role' | 'is_main'>) => {
            characterMap[c.id] = c;
          });
        }

        const resolved: RelationEntry[] = (edges as MindMapEdge[]).map((edge) => {
          const isSource = myNodeIds.includes(edge.source_node_id);
          const otherNodeId = isSource ? edge.target_node_id : edge.source_node_id;
          const otherNode = (otherNodes || []).find((n: { id: string; character_id: string | null; label: string }) => n.id === otherNodeId);
          return {
            edge,
            isSource,
            otherChar: otherNode?.character_id ? (characterMap[otherNode.character_id] ?? null) : null,
            otherLabel: otherNode?.label ?? 'Unknown',
          };
        });
        setRelations(resolved);
      } else {
        setRelations([]);
      }
    } else {
      setRelations([]);
    }

    setLoading(false);
  }, [params.charId, params.id]);

  useEffect(() => { loadAll(); return () => { document.title = 'Screenplay Studio'; }; }, [loadAll]);

  // ---- Save helpers ----
  const saveField = async (field: string, value: unknown) => {
    if (!character) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('characters')
      .update({ [field]: value })
      .eq('id', character.id)
      .select()
      .single();
    if (data) setCharacter(data as Character);
    setSaving(false);
  };

  const inspoImages: InspoImage[] = (character?.inspo_images as InspoImage[] | null) ?? [];
  const refFolders: RefFolder[] = (character?.reference_folders as RefFolder[] | null) ?? [];

  const addInspoImage = async () => {
    if (!newInspoUrl.trim()) return;
    await saveField('inspo_images', [...inspoImages, { url: newInspoUrl.trim(), caption: newInspoCaption.trim() }]);
    setNewInspoUrl('');
    setNewInspoCaption('');
  };

  const removeInspoImage = (idx: number) =>
    saveField('inspo_images', inspoImages.filter((_, i) => i !== idx));

  const saveActorUrl = async () => {
    await saveField('actor_photo_url', newActorUrl.trim() || null);
    setShowActorUrlForm(false);
    setNewActorUrl('');
  };

  const addFolder = async () => {
    if (!newFolderName.trim()) return;
    const folder: RefFolder = { id: crypto.randomUUID(), name: newFolderName.trim(), type: newFolderType, images: [] };
    await saveField('reference_folders', [...refFolders, folder]);
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const removeFolder = (folderId: string) =>
    saveField('reference_folders', refFolders.filter((f) => f.id !== folderId));

  const addFolderImage = async (folderId: string) => {
    const state = folderAdd[folderId];
    if (!state?.url?.trim()) return;
    const updated = refFolders.map((f) =>
      f.id === folderId
        ? { ...f, images: [...f.images, { url: state.url.trim(), caption: state.caption?.trim() ?? '' }] }
        : f
    );
    await saveField('reference_folders', updated);
    setFolderAdd((prev) => ({ ...prev, [folderId]: { url: '', caption: '' } }));
  };

  const removeFolderImage = (folderId: string, imgIdx: number) =>
    saveField('reference_folders', refFolders.map((f) =>
      f.id === folderId ? { ...f, images: f.images.filter((_, i) => i !== imgIdx) } : f
    ));

  const folderTypeColor: Record<string, string> = {
    makeup: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
    costume: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
    other: 'text-surface-300 bg-surface-700/60 border-surface-600',
  };
  const folderTypeLabel: Record<string, string> = { makeup: 'Makeup', costume: 'Costume', other: 'Other' };

  if (loading) return <LoadingSpinner className="py-32" />;
  if (!character) return (
    <div className="p-8 text-center text-surface-400">
      <p>Character not found.</p>
      <Button variant="ghost" onClick={() => router.push(`/projects/${params.id}/characters`)} className="mt-4">← Back to Characters</Button>
    </div>
  );

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'inspiration', label: 'Inspiration' },
    { key: 'actor', label: 'Actor' },
    { key: 'production', label: 'Production' },
    { key: 'relations', label: `Relations${relations.length > 0 ? ` (${relations.length})` : ''}` },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {/* Back nav */}
      <button
        onClick={() => router.push(`/projects/${params.id}/characters`)}
        className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All characters
      </button>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <Avatar src={character.avatar_url} name={character.name} size="lg" color={character.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-3xl font-black text-white">{character.name}</h1>
            <RoleBadge role={character.role} isMain={character.is_main} />
          </div>
          {character.full_name && character.full_name !== character.name && (
            <p className="text-surface-400 mb-1">{character.full_name}</p>
          )}
          {(character.age || character.gender) && (
            <p className="text-sm text-surface-500">
              {[character.age && `Age: ${character.age}`, character.gender].filter(Boolean).join(' · ')}
            </p>
          )}
          {character.cast_actor && (
            <p className="text-sm text-surface-500 mt-1">
              Cast: <span className="text-surface-300">{character.cast_actor}</span>
            </p>
          )}
        </div>
        {canEdit && (
          <Button
            variant="secondary"
            onClick={() => router.push(`/projects/${params.id}/characters?edit=${character.id}`)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-800 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'text-white border-[#E54E15]'
                : 'text-surface-400 border-transparent hover:text-surface-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ——— OVERVIEW ——— */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {character.description && (
            <Section title="Description">
              <p className="text-surface-200 leading-relaxed">{character.description}</p>
            </Section>
          )}
          {character.personality_traits?.length > 0 && (
            <Section title="Personality">
              <div className="flex flex-wrap gap-1.5">
                {character.personality_traits.map((t) => <Badge key={t}>{t}</Badge>)}
              </div>
            </Section>
          )}
          {character.backstory && (
            <Section title="Backstory">
              <p className="text-surface-300 leading-relaxed whitespace-pre-wrap">{character.backstory}</p>
            </Section>
          )}
          {character.motivation && (
            <Section title="Motivation">
              <p className="text-surface-300 leading-relaxed">{character.motivation}</p>
            </Section>
          )}
          {character.arc && (
            <Section title="Character Arc">
              <p className="text-surface-300 leading-relaxed">{character.arc}</p>
            </Section>
          )}
          {character.appearance && (
            <Section title="Appearance">
              <p className="text-surface-300 leading-relaxed">{character.appearance}</p>
            </Section>
          )}
          {character.quirks && (
            <Section title="Quirks & Habits">
              <p className="text-surface-300 leading-relaxed">{character.quirks}</p>
            </Section>
          )}
          {character.voice_notes && (
            <Section title="Voice & Speech">
              <p className="text-surface-300 leading-relaxed">{character.voice_notes}</p>
            </Section>
          )}
          {!character.description && !character.backstory && !character.motivation && (
            <div className="py-12 text-center text-surface-500">
              <p>No character details yet.</p>
              {canEdit && (
                <button
                  onClick={() => router.push(`/projects/${params.id}/characters?edit=${character.id}`)}
                  className="mt-2 text-sm text-orange-400 hover:text-orange-300"
                >
                  Add details →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ——— INSPIRATION ——— */}
      {activeTab === 'inspiration' && (
        <div className="space-y-5">
          <p className="text-sm text-surface-500">
            Images that capture the vibe, look, or feel of this character. Paste image links from anywhere.
          </p>

          {inspoImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {inspoImages.map((img, idx) => (
                <div key={idx} className="group relative rounded-xl overflow-hidden bg-surface-800 aspect-square">
                  <ImageTile url={img.url} alt={img.caption || `Inspo ${idx + 1}`} />
                  {img.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                      <p className="text-[10px] text-white/90 truncate">{img.caption}</p>
                    </div>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => removeInspoImage(idx)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="rounded-xl border border-dashed border-surface-700 p-5 space-y-3 bg-surface-800/20">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Add image</p>
              <Input
                value={newInspoUrl}
                onChange={(e) => setNewInspoUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                onKeyDown={(e) => e.key === 'Enter' && addInspoImage()}
              />
              <div className="flex gap-2">
                <Input
                  value={newInspoCaption}
                  onChange={(e) => setNewInspoCaption(e.target.value)}
                  placeholder="Caption (optional)"
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && addInspoImage()}
                />
                <Button onClick={addInspoImage} loading={saving} disabled={!newInspoUrl.trim()}>
                  Add
                </Button>
              </div>
            </div>
          )}

          {inspoImages.length === 0 && !canEdit && (
            <p className="text-center text-surface-500 py-12">No inspiration images added yet.</p>
          )}
        </div>
      )}

      {/* ——— ACTOR ——— */}
      {activeTab === 'actor' && (
        <div className="space-y-6 max-w-lg">
          <Section title="Reference Photo">
            {character.actor_photo_url && (
              <div className="rounded-xl overflow-hidden bg-surface-800 max-h-96 mb-3">
                <img
                  src={character.actor_photo_url}
                  alt="Actor reference"
                  className="w-full object-cover object-top"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
            {!character.actor_photo_url && !showActorUrlForm && (
              <div className="rounded-xl border border-dashed border-surface-700 h-48 flex items-center justify-center bg-surface-800/40 mb-3">
                <p className="text-sm text-surface-500">No actor reference photo yet</p>
              </div>
            )}
            {canEdit && (
              <>
                {!showActorUrlForm ? (
                  <button
                    onClick={() => { setShowActorUrlForm(true); setNewActorUrl(character.actor_photo_url || ''); }}
                    className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    {character.actor_photo_url ? '↻ Change photo link' : '+ Add photo link'}
                  </button>
                ) : (
                  <div className="space-y-2 mt-2">
                    <Input
                      value={newActorUrl}
                      onChange={(e) => setNewActorUrl(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button onClick={saveActorUrl} loading={saving}>Save</Button>
                      <Button variant="ghost" onClick={() => setShowActorUrlForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Section>

          {(character.cast_actor || character.cast_notes) && (
            <Section title="Casting">
              {character.cast_actor && (
                <div className="mb-2">
                  <p className="text-xs text-surface-500 mb-0.5">Cast Actor</p>
                  <p className="text-white font-medium">{character.cast_actor}</p>
                </div>
              )}
              {character.cast_notes && (
                <div>
                  <p className="text-xs text-surface-500 mb-0.5">Notes</p>
                  <p className="text-surface-300 leading-relaxed">{character.cast_notes}</p>
                </div>
              )}
            </Section>
          )}
        </div>
      )}

      {/* ——— PRODUCTION ——— */}
      {activeTab === 'production' && (
        <div className="space-y-4">
          <p className="text-sm text-surface-500">
            Versioned reference folders for makeup, costume, and other production departments.
          </p>

          {refFolders.length === 0 && !showNewFolder && (
            <div className="rounded-xl border border-dashed border-surface-700 p-10 text-center">
              <p className="text-surface-500 mb-3">No reference folders yet</p>
              {canEdit && (
                <Button variant="secondary" onClick={() => setShowNewFolder(true)}>
                  Create first folder
                </Button>
              )}
            </div>
          )}

          {refFolders.map((folder) => {
            const fa = folderAdd[folder.id] ?? { url: '', caption: '' };
            return (
              <div key={folder.id} className="rounded-xl border border-surface-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-surface-800/40 border-b border-surface-800">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L10.707 6.7A1 1 0 0011.414 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                    <span className="font-semibold text-white">{folder.name}</span>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', folderTypeColor[folder.type])}>
                      {folderTypeLabel[folder.type]}
                    </span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => removeFolder(folder.id)}
                      className="text-surface-500 hover:text-red-400 transition-colors"
                      title="Delete folder"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {folder.images.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {folder.images.map((img, idx) => (
                        <div key={idx} className="group relative rounded-lg overflow-hidden bg-surface-700 aspect-square">
                          <ImageTile url={img.url} alt={img.caption || `Ref ${idx + 1}`} />
                          {img.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                              <p className="text-[9px] text-white/80 truncate">{img.caption}</p>
                            </div>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => removeFolderImage(folder.id, idx)}
                              className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {canEdit && (
                    <div className="flex flex-col gap-1.5">
                      <Input
                        value={fa.url}
                        onChange={(e) => setFolderAdd((p) => ({ ...p, [folder.id]: { ...fa, url: e.target.value } }))}
                        placeholder="Image URL…"
                        onKeyDown={(e) => e.key === 'Enter' && addFolderImage(folder.id)}
                      />
                      <div className="flex gap-1.5">
                        <Input
                          value={fa.caption}
                          onChange={(e) => setFolderAdd((p) => ({ ...p, [folder.id]: { ...fa, caption: e.target.value } }))}
                          placeholder="Caption (optional)"
                          className="flex-1"
                          onKeyDown={(e) => e.key === 'Enter' && addFolderImage(folder.id)}
                        />
                        <Button size="sm" variant="secondary" onClick={() => addFolderImage(folder.id)} loading={saving} disabled={!fa.url?.trim()}>
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {canEdit && (
            <>
              {showNewFolder ? (
                <div className="rounded-xl border border-surface-700 p-5 space-y-3 bg-surface-800/30">
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">New folder</p>
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name (e.g. Version 1, Final Look…)"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && addFolder()}
                  />
                  <div className="flex gap-2">
                    {(['makeup', 'costume', 'other'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setNewFolderType(type)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize',
                          newFolderType === type ? folderTypeColor[type] : 'text-surface-400 bg-surface-800/50 border-surface-700 hover:border-surface-500'
                        )}
                      >
                        {folderTypeLabel[type]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addFolder} loading={saving} disabled={!newFolderName.trim()}>Create</Button>
                    <Button variant="ghost" onClick={() => setShowNewFolder(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                refFolders.length > 0 && (
                  <button onClick={() => setShowNewFolder(true)} className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
                    + New folder
                  </button>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* ——— RELATIONS ——— */}
      {activeTab === 'relations' && (
        <div className="space-y-4">
          <p className="text-sm text-surface-500">
            Connections from the{' '}
            <button
              onClick={() => router.push(`/projects/${params.id}/mindmap`)}
              className="text-orange-400 hover:text-orange-300 transition-colors"
            >
              Mind Map
            </button>
            . Edit connections there — they&apos;ll appear here automatically.
          </p>

          {relations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-700 p-10 text-center">
              <p className="text-surface-500 mb-3">No connections yet</p>
              <p className="text-xs text-surface-600 mb-4">
                Import this character into the Mind Map and draw connections to other characters.
              </p>
              <Button variant="secondary" onClick={() => router.push(`/projects/${params.id}/mindmap`)}>
                Open Mind Map
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {relations.map((rel) => {
                const arrow = arrowLabel(rel.edge.arrow_type, rel.isSource);
                return (
                  <div
                    key={rel.edge.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-surface-800/40 border border-surface-800 hover:border-surface-700 transition-colors"
                  >
                    {/* This character side */}
                    <div className="flex items-center gap-2 min-w-0 w-28 shrink-0">
                      <Avatar
                        src={character.avatar_url}
                        name={character.name}
                        size="sm"
                        color={character.color}
                      />
                      <span className="text-xs text-surface-400 truncate">{character.name}</span>
                    </div>

                    {/* Arrow + label */}
                    <div className="flex flex-col items-center flex-1 min-w-0">
                      {rel.edge.label && (
                        <span className="text-[10px] text-surface-400 mb-0.5 truncate max-w-full px-1">{rel.edge.label}</span>
                      )}
                      <div className="flex items-center gap-1 w-full">
                        <div
                          className="flex-1 border-t"
                          style={{
                            borderStyle: rel.edge.line_style === 'dashed' ? 'dashed' : rel.edge.line_style === 'dotted' ? 'dotted' : 'solid',
                            borderColor: rel.edge.color || '#4a4a6a',
                            borderWidth: rel.edge.thickness || 1,
                          }}
                        />
                        <span className="text-surface-400 text-sm font-mono shrink-0">{arrow}</span>
                        <div
                          className="flex-1 border-t"
                          style={{
                            borderStyle: rel.edge.line_style === 'dashed' ? 'dashed' : rel.edge.line_style === 'dotted' ? 'dotted' : 'solid',
                            borderColor: rel.edge.color || '#4a4a6a',
                            borderWidth: rel.edge.thickness || 1,
                          }}
                        />
                      </div>
                    </div>

                    {/* Other side */}
                    <div className="flex items-center gap-2 min-w-0 w-28 shrink-0 justify-end">
                      {rel.otherChar ? (
                        <>
                          <span className="text-xs text-surface-400 truncate">{rel.otherChar.name}</span>
                          <button
                            onClick={() => router.push(`/projects/${params.id}/characters/${rel.otherChar!.id}`)}
                            className="shrink-0"
                            title={`View ${rel.otherChar.name}`}
                          >
                            <Avatar
                              src={rel.otherChar.avatar_url}
                              name={rel.otherChar.name}
                              size="sm"
                              color={rel.otherChar.color}
                            />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-surface-500 truncate">{rel.otherLabel}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-6 right-6 text-xs text-surface-500 flex items-center gap-1.5 bg-surface-800 px-3 py-2 rounded-lg border border-surface-700 shadow-lg z-50">
          <div className="w-3 h-3 rounded-full border border-surface-400 border-t-transparent animate-spin" />
          Saving…
        </div>
      )}
    </div>
  );
}

// ============================================================
// Section wrapper
// ============================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}

// ============================================================
// Image tile with broken-link fallback
// ============================================================
function ImageTile({ url, alt }: { url: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  return errored ? (
    <div className="w-full h-full flex flex-col items-center justify-center bg-surface-700/60 p-2 gap-1">
      <svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      <p className="text-[8px] text-surface-500 text-center break-all line-clamp-2 px-1">{url}</p>
    </div>
  ) : (
    <img src={url} alt={alt} className="w-full h-full object-cover" onError={() => setErrored(true)} />
  );
}
