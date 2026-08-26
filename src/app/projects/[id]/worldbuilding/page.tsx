'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Input, Textarea, Card, Modal } from '@/components/ui';
import { useTranslation } from '@/components/TranslationProvider';
import { WorldEntity, WorldEntityCategory, WorldEntityRelationship } from '@/lib/types';

import { cn } from '@/lib/utils';

const CATEGORIES: { value: WorldEntityCategory; label: string; icon: string }[] = [
  { value: 'lore', label: 'Lore', icon: 'book' },
  { value: 'faction', label: 'Factions', icon: 'shield' },
  { value: 'location', label: 'Locations', icon: 'map' },
  { value: 'magic', label: 'Magic / Tech', icon: 'sparkles' },
  { value: 'species', label: 'Species', icon: 'users' },
  { value: 'item', label: 'Items', icon: 'briefcase' },
  { value: 'event', label: 'Events', icon: 'calendar' },
  { value: 'character', label: 'Characters', icon: 'user' },
  { value: 'other', label: 'Other', icon: 'cube' }
];

export default function WorldbuildingPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const { t } = useTranslation();
  
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : undefined);
  const canEdit = currentUserRole && ['owner', 'admin', 'writer', 'editor'].includes(currentUserRole);

  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [relationships, setRelationships] = useState<WorldEntityRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<WorldEntityCategory>('lore');
  
  const selectedEntity = useMemo(() => entities.find(e => e.id === selectedEntityId) || null, [entities, selectedEntityId]);
  const filteredEntities = useMemo(() => entities.filter(e => e.category === activeCategory), [entities, activeCategory]);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    const [entitiesRes, relsRes] = await Promise.all([
      supabase.from('world_entities').select('*').eq('project_id', params.id).order('name'),
      supabase.from('world_entity_relationships').select('*').eq('project_id', params.id)
    ]);
    
    if (entitiesRes.data) setEntities(entitiesRes.data);
    if (relsRes.data) setRelationships(relsRes.data);
    
    setLoading(false);
  };

  const handleCreateEntity = async () => {
    if (!canEdit) return;
    const newEntity: WorldEntity = {
      id: crypto.randomUUID(),
      project_id: params.id,
      name: 'New ' + activeCategory,
      category: activeCategory,
      content: '',
      properties: {},
      tags: [],
      avatar_url: null,
      color: '#6366f1',
      parent_id: null,
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setEntities(prev => [...prev, newEntity]);
    setSelectedEntityId(newEntity.id);
    
    const supabase = createClient();
    await supabase.from('world_entities').insert(newEntity);
  };

  const handleUpdateEntity = async (id: string, updates: Partial<WorldEntity>) => {
    if (!canEdit) return;
    
    setEntities(prev => prev.map(e => e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e));
    
    const supabase = createClient();
    await supabase.from('world_entities').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  };
  
  const handleDeleteEntity = async (id: string) => {
    if (!canEdit) return;
    if (!confirm('Are you sure you want to delete this entity?')) return;
    
    setEntities(prev => prev.filter(e => e.id !== id));
    if (selectedEntityId === id) setSelectedEntityId(null);
    
    const supabase = createClient();
    await supabase.from('world_entities').delete().eq('id', id);
  };

  if (loading) {
    return <div className="p-8 text-center text-surface-400">Loading World Data...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-surface-900">
      <div className="flex items-center justify-between p-4 border-b border-surface-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Worldbuilding Wiki
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            Build and connect the lore of your universe.
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Categories Sidebar */}
        <div className="w-48 border-r border-surface-800 bg-surface-900 flex flex-col p-2 space-y-1 overflow-y-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => { setActiveCategory(cat.value); setSelectedEntityId(null); }}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                activeCategory === cat.value ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:bg-surface-800 hover:text-white'
              )}
            >
              <span className="truncate">{cat.label}</span>
              <span className="ml-auto text-[11px] bg-surface-800 px-1.5 py-0.5 rounded-full text-surface-400">
                {entities.filter(e => e.category === cat.value).length}
              </span>
            </button>
          ))}
        </div>

        {/* Entities List */}
        <div className="w-64 border-r border-surface-800 bg-surface-950 flex flex-col">
          <div className="p-3 border-b border-surface-800 flex justify-between items-center">
            <h2 className="text-sm font-medium text-white uppercase tracking-[0.04em]">{CATEGORIES.find(c => c.value === activeCategory)?.label}</h2>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={handleCreateEntity} className="h-7 w-7 p-0 rounded-full">
                +
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredEntities.length === 0 ? (
              <p className="text-xs text-surface-500 text-center p-4">No entries yet.</p>
            ) : (
              filteredEntities.map(entity => (
                <button
                  key={entity.id}
                  onClick={() => setSelectedEntityId(entity.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors truncate',
                    selectedEntityId === entity.id ? 'bg-surface-800 text-white font-medium' : 'text-surface-300 hover:bg-surface-800/50'
                  )}
                >
                  {entity.name || 'Untitled'}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto bg-surface-900 p-6">
          {selectedEntity ? (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Input 
                    value={selectedEntity.name}
                    onChange={(e) => handleUpdateEntity(selectedEntity.id, { name: e.target.value })}
                    className="text-2xl font-bold bg-transparent border-none px-0 h-auto focus:ring-0 placeholder:text-surface-600"
                    placeholder="Entity Name"
                    disabled={!canEdit}
                  />
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 bg-surface-800 rounded-md text-surface-300 capitalize">{selectedEntity.category}</span>
                  </div>
                </div>
                {canEdit && (
                  <Button variant="danger" size="sm" onClick={() => handleDeleteEntity(selectedEntity.id)}>
                    Delete
                  </Button>
                )}
              </div>

              <Card className="p-0 overflow-hidden border-surface-800 bg-surface-950">
                <div className="p-4 border-b border-surface-800 bg-surface-900">
                  <h3 className="text-sm font-semibold text-white">Properties</h3>
                </div>
                <div className="p-4 space-y-3">
                  <Textarea
                    value={JSON.stringify(selectedEntity.properties, null, 2) === '{}' ? '' : JSON.stringify(selectedEntity.properties, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : {};
                        handleUpdateEntity(selectedEntity.id, { properties: parsed });
                      } catch (err) {}
                    }}
                    placeholder='{"Population": "10,000", "Leader": "King Arthur"}'
                    rows={3}
                    className="font-mono text-xs"
                    disabled={!canEdit}
                  />
                </div>
              </Card>

              <Card className="p-0 overflow-hidden border-surface-800 bg-surface-950">
                <div className="p-4 border-b border-surface-800 bg-surface-900">
                  <h3 className="text-sm font-semibold text-white">Lore & Description</h3>
                </div>
                <div className="p-4">
                  <Textarea
                    value={selectedEntity.content}
                    onChange={(e) => handleUpdateEntity(selectedEntity.id, { content: e.target.value })}
                    rows={15}
                    placeholder="Write detailed lore here..."
                    className="border-none bg-transparent focus:ring-0 p-0 text-sm leading-relaxed"
                    disabled={!canEdit}
                  />
                </div>
              </Card>

              <Card className="p-0 overflow-hidden border-surface-800 bg-surface-950">
                <div className="p-4 border-b border-surface-800 bg-surface-900">
                  <h3 className="text-sm font-semibold text-white">Relationships</h3>
                </div>
                <div className="p-4 text-sm text-surface-400">
                  {relationships.filter(r => r.source_id === selectedEntity.id || r.target_id === selectedEntity.id).length === 0 ? (
                    <p>No relationships yet. (Link UI coming soon)</p>
                  ) : (
                    <ul className="space-y-2">
                      {relationships.filter(r => r.source_id === selectedEntity.id || r.target_id === selectedEntity.id).map(r => {
                        const isSource = r.source_id === selectedEntity.id;
                        const otherEntityId = isSource ? r.target_id : r.source_id;
                        const otherEntity = entities.find(e => e.id === otherEntityId);
                        return (
                          <li key={r.id} className="flex gap-2 items-center text-sm">
                            <span className="text-surface-300">{selectedEntity.name}</span>
                            <span className="px-2 py-0.5 bg-brand-500/10 text-brand-400 rounded-md text-xs font-mono">{r.relationship_type}</span>
                            <span className="text-surface-300">{otherEntity?.name || 'Unknown'}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </Card>

            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-surface-500 flex-col gap-4">
              <svg className="w-16 h-16 text-surface-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p>Select an entity from the sidebar or create a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
