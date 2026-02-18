'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, Avatar, EmptyState, LoadingSpinner } from '@/components/ui';
import { cn, randomColor } from '@/lib/utils';
import type { Character } from '@/lib/types';

export default function CharactersPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filter, setFilter] = useState<'all' | 'main' | 'supporting'>('all');

  useEffect(() => {
    fetchCharacters();
  }, [params.id]);

  const fetchCharacters = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('project_id', params.id)
        .order('is_main', { ascending: false })
        .order('sort_order', { ascending: true });
      if (error) console.error('Characters fetch error:', error.message);
      setCharacters(data || []);
    } catch (err) {
      console.error('Unexpected error fetching characters:', err);
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this character?')) return;
    const supabase = createClient();
    await supabase.from('characters').delete().eq('id', id);
    setCharacters(characters.filter((c) => c.id !== id));
    if (selectedCharacter?.id === id) setSelectedCharacter(null);
  };

  const filtered = filter === 'all'
    ? characters
    : filter === 'main'
      ? characters.filter((c) => c.is_main)
      : characters.filter((c) => !c.is_main);

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Characters</h1>
          <p className="text-sm text-surface-400 mt-1">{characters.length} characters in this project</p>
        </div>
        <Button onClick={() => { setSelectedCharacter(null); setShowEditor(true); }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Character
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'main', 'supporting'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === f
                ? 'bg-brand-600/20 text-brand-400'
                : 'text-surface-400 hover:text-white hover:bg-white/5'
            )}
          >
            {f === 'all' ? 'All' : f === 'main' ? 'Main Cast' : 'Supporting'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No characters yet"
          description="Add characters to build your cast"
          action={
            <Button onClick={() => { setSelectedCharacter(null); setShowEditor(true); }}>
              Add Character
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((character) => (
            <Card
              key={character.id}
              hover
              className="overflow-hidden cursor-pointer"
              onClick={() => { setSelectedCharacter(character); setShowEditor(true); }}
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar
                    src={character.avatar_url}
                    name={character.name}
                    size="lg"
                    color={character.color}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{character.name}</h3>
                      {character.is_main && <Badge variant="success" size="sm">Main</Badge>}
                    </div>
                    {character.full_name && character.full_name !== character.name && (
                      <p className="text-xs text-surface-500">{character.full_name}</p>
                    )}
                    {character.age && (
                      <p className="text-xs text-surface-500 mt-0.5">Age: {character.age} {character.gender ? `• ${character.gender}` : ''}</p>
                    )}
                  </div>
                </div>

                {character.description && (
                  <p className="mt-3 text-sm text-surface-400 line-clamp-2">{character.description}</p>
                )}

                {character.personality_traits?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {character.personality_traits.slice(0, 4).map((trait) => (
                      <Badge key={trait} size="sm">{trait}</Badge>
                    ))}
                    {character.personality_traits.length > 4 && (
                      <Badge size="sm">+{character.personality_traits.length - 4}</Badge>
                    )}
                  </div>
                )}

                {character.cast_actor && (
                  <div className="mt-3 pt-3 border-t border-surface-800">
                    <p className="text-xs text-surface-500">
                      Cast: <span className="text-surface-300">{character.cast_actor}</span>
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Character Editor Modal */}
      <CharacterEditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        character={selectedCharacter}
        projectId={params.id}
        userId={user?.id || ''}
        onSaved={() => {
          fetchCharacters();
          setShowEditor(false);
        }}
        onDelete={handleDelete}
      />
    </div>
  );
}

// ============================================================
// Character Editor Modal
// ============================================================

function CharacterEditor({
  isOpen,
  onClose,
  character,
  projectId,
  userId,
  onSaved,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  character: Character | null;
  projectId: string;
  userId: string;
  onSaved: () => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    full_name: '',
    age: '',
    gender: '',
    description: '',
    backstory: '',
    motivation: '',
    arc: '',
    appearance: '',
    personality_traits: [] as string[],
    quirks: '',
    voice_notes: '',
    is_main: false,
    first_appearance: '',
    cast_actor: '',
    cast_notes: '',
    color: randomColor(),
  });
  const [traitInput, setTraitInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    if (character) {
      setForm({
        name: character.name,
        full_name: character.full_name || '',
        age: character.age || '',
        gender: character.gender || '',
        description: character.description || '',
        backstory: character.backstory || '',
        motivation: character.motivation || '',
        arc: character.arc || '',
        appearance: character.appearance || '',
        personality_traits: character.personality_traits || [],
        quirks: character.quirks || '',
        voice_notes: character.voice_notes || '',
        is_main: character.is_main,
        first_appearance: character.first_appearance || '',
        cast_actor: character.cast_actor || '',
        cast_notes: character.cast_notes || '',
        color: character.color || randomColor(),
      });
    } else {
      setForm({
        name: '', full_name: '', age: '', gender: '', description: '', backstory: '',
        motivation: '', arc: '', appearance: '', personality_traits: [], quirks: '',
        voice_notes: '', is_main: false, first_appearance: '', cast_actor: '',
        cast_notes: '', color: randomColor(),
      });
    }
    setActiveTab('basic');
  }, [character, isOpen]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    const supabase = createClient();

    const payload = {
      ...form,
      project_id: projectId,
      created_by: userId,
    };

    if (character) {
      await supabase.from('characters').update(payload).eq('id', character.id);
    } else {
      await supabase.from('characters').insert(payload);
    }

    setLoading(false);
    onSaved();
  };

  const addTrait = () => {
    if (traitInput.trim() && !form.personality_traits.includes(traitInput.trim())) {
      setForm({ ...form, personality_traits: [...form.personality_traits, traitInput.trim()] });
      setTraitInput('');
    }
  };

  const removeTrait = (trait: string) => {
    setForm({ ...form, personality_traits: form.personality_traits.filter((t) => t !== trait) });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={character ? `Edit: ${character.name}` : 'New Character'} size="xl">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-800 rounded-lg p-1">
        {['basic', 'story', 'appearance', 'casting'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors',
              activeTab === tab ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {activeTab === 'basic' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Character Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="If different from character name" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Age" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="30s" />
              <Input label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
              <div className="flex items-end gap-2 pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_main}
                    onChange={(e) => setForm({ ...form, is_main: e.target.checked })}
                    className="rounded border-surface-600"
                  />
                  <span className="text-sm text-surface-300">Main Character</span>
                </label>
              </div>
            </div>
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Brief character description..." />
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Personality Traits</label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={traitInput}
                  onChange={(e) => setTraitInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTrait())}
                  placeholder="Add trait..."
                  className="flex-1"
                />
                <Button type="button" variant="secondary" onClick={addTrait}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.personality_traits.map((trait) => (
                  <button
                    key={trait}
                    onClick={() => removeTrait(trait)}
                    className="px-2 py-1 rounded-full bg-surface-800 text-xs text-surface-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  >
                    {trait} ×
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'story' && (
          <>
            <Textarea label="Backstory" value={form.backstory} onChange={(e) => setForm({ ...form, backstory: e.target.value })} rows={4} placeholder="Character's history..." />
            <Textarea label="Motivation" value={form.motivation} onChange={(e) => setForm({ ...form, motivation: e.target.value })} rows={3} placeholder="What drives this character?" />
            <Textarea label="Character Arc" value={form.arc} onChange={(e) => setForm({ ...form, arc: e.target.value })} rows={3} placeholder="How does this character change?" />
            <Input label="First Appearance" value={form.first_appearance} onChange={(e) => setForm({ ...form, first_appearance: e.target.value })} placeholder="Scene number or description" />
            <Textarea label="Quirks & Habits" value={form.quirks} onChange={(e) => setForm({ ...form, quirks: e.target.value })} rows={2} />
          </>
        )}

        {activeTab === 'appearance' && (
          <>
            <Textarea label="Physical Appearance" value={form.appearance} onChange={(e) => setForm({ ...form, appearance: e.target.value })} rows={4} placeholder="Height, build, hair, distinguishing features..." />
            <Textarea label="Voice & Speech Notes" value={form.voice_notes} onChange={(e) => setForm({ ...form, voice_notes: e.target.value })} rows={3} placeholder="Accent, speech patterns, vocabulary..." />
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Character Color</label>
              <div className="flex gap-2">
                {['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      'w-8 h-8 rounded-full transition-transform',
                      form.color === c && 'ring-2 ring-white ring-offset-2 ring-offset-surface-900 scale-110'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'casting' && (
          <>
            <Input label="Cast Actor" value={form.cast_actor} onChange={(e) => setForm({ ...form, cast_actor: e.target.value })} placeholder="Actor name" />
            <Textarea label="Casting Notes" value={form.cast_notes} onChange={(e) => setForm({ ...form, cast_notes: e.target.value })} rows={3} placeholder="Casting requirements, alternatives..." />
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-6 mt-6 border-t border-surface-800">
        <div>
          {character && (
            <Button variant="danger" size="sm" onClick={() => onDelete(character.id)}>
              Delete Character
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={loading}>
            {character ? 'Save Changes' : 'Create Character'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
