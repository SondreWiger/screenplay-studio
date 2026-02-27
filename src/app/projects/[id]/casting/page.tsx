'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Avatar, LoadingPage, Input, Textarea, Modal, toast, ToastContainer } from '@/components/ui';

// ============================================================
// Casting — Pro Feature (Film/TV)
// Connect characters with team members, assign actors,
// track casting status across the entire project.
// ============================================================

type Character = {
  id: string;
  name: string;
  full_name: string | null;
  age: string | null;
  gender: string | null;
  description: string | null;
  backstory: string | null;
  is_main: boolean;
  personality_traits: string[];
  color: string;
  cast_actor: string | null;
  cast_notes: string | null;
  avatar_url: string | null;
};

type TeamMember = {
  id: string;
  user_id: string;
  role: string;
  department: string | null;
  job_title: string | null;
  profile: {
    id: string;
    email: string;
    display_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
};

type Scene = {
  id: string;
  scene_number: string | null;
  scene_heading: string | null;
  cast_ids: string[];
  page_count: number;
};

type ScriptElement = {
  id: string;
  element_type: string;
  content: string;
  scene_number: string | null;
  sort_order: number;
};

type FilterMode = 'all' | 'cast' | 'uncast';

export default function CastingPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuth();
  const { isPro } = useProFeatures();
  const { currentProject } = useProjectStore();
  const hasProAccess = isPro || currentProject?.pro_enabled === true;

  const [characters, setCharacters] = useState<Character[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scriptElements, setScriptElements] = useState<ScriptElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Filter & search
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail modal
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [editActor, setEditActor] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  // Casting Call state
  const [showCastingCallBuilder, setShowCastingCallBuilder] = useState(false);
  const [castingCallLinks, setCastingCallLinks] = useState<any[]>([]);
  const [castingInstructions, setCastingInstructions] = useState('');
  const [castingCharacterIds, setCastingCharacterIds] = useState<string[]>([]);
  const [castingQuestions, setCastingQuestions] = useState<{ label: string; type: 'text' | 'textarea' | 'select'; options?: string[]; required: boolean }[]>([
    { label: 'Full Name', type: 'text', required: true },
    { label: 'Email', type: 'text', required: true },
    { label: 'Phone Number', type: 'text', required: false },
    { label: 'Experience / Credits', type: 'textarea', required: false },
  ]);
  const [castingCallTitle, setCastingCallTitle] = useState('');
  const [creatingCall, setCreatingCall] = useState(false);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});

  const supabase = createClient();

  // ── Load data ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // First get script ID
      const { data: scripts } = await supabase
        .from('scripts')
        .select('id')
        .eq('project_id', projectId)
        .limit(1);

      const [charRes, teamRes, sceneRes, elemRes] = await Promise.all([
        supabase
          .from('characters')
          .select('id, name, full_name, age, gender, description, backstory, is_main, personality_traits, color, cast_actor, cast_notes, avatar_url')
          .eq('project_id', projectId)
          .order('is_main', { ascending: false })
          .order('name'),
        supabase
          .from('project_members')
          .select('id, user_id, role, department, job_title, profiles:user_id(id, email, display_name, full_name, avatar_url)')
          .eq('project_id', projectId),
        supabase
          .from('scenes')
          .select('id, scene_number, scene_heading, cast_ids, page_count')
          .eq('project_id', projectId)
          .order('scene_number'),
        scripts?.[0]?.id
          ? supabase
              .from('script_elements')
              .select('id, element_type, content, scene_number, sort_order')
              .eq('script_id', scripts[0].id)
              .in('element_type', ['character', 'dialogue'])
              .order('sort_order')
          : Promise.resolve({ data: [] }),
      ]);

      if (charRes.data) setCharacters(charRes.data as Character[]);
      if (teamRes.data) {
        const mapped = (teamRes.data as any[]).map((m) => ({
          ...m,
          profile: m.profiles || { id: m.user_id, email: '', display_name: null, full_name: null, avatar_url: null },
        }));
        setTeamMembers(mapped);
      }
      if (sceneRes.data) setScenes(sceneRes.data as Scene[]);
      if (elemRes.data) setScriptElements(elemRes.data as ScriptElement[]);

      // Load casting call links
      const { data: shares } = await supabase
        .from('external_shares')
        .select('*')
        .eq('project_id', projectId)
        .eq('share_type', 'casting')
        .order('created_at', { ascending: false });
      if (shares) {
        setCastingCallLinks(shares);
        // Count submissions per link
        const counts: Record<string, number> = {};
        for (const s of shares) {
          const snapshot = s.content_snapshot as any;
          counts[s.id] = snapshot?.submissions?.length || 0;
        }
        setSubmissionCounts(counts);
      }
    } catch (err) {
      console.error('Failed to load casting data:', err);
      toast('Failed to load casting data', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!hasProAccess) { setLoading(false); return; }
    loadData();
  }, [hasProAccess, loadData]);

  // ── Derived data ───────────────────────────────────────────
  // Build a map of character_id -> scene numbers they appear in.
  // Prefers cast_ids on scenes, but also detects character names in script_elements.
  const sceneCountMap = useMemo(() => {
    const map: Record<string, string[]> = {};

    // Method 1: from scene.cast_ids 
    for (const scene of scenes) {
      if (!scene.cast_ids || scene.cast_ids.length === 0) continue;
      for (const cid of scene.cast_ids) {
        if (!map[cid]) map[cid] = [];
        map[cid].push(scene.scene_number || scene.id);
      }
    }

    // Method 2: from script_elements (positional character name → scene_number)
    // This catches characters that appear in dialogue but aren't linked via cast_ids
    if (scriptElements.length > 0) {
      const charNameToId = new Map<string, string>();
      for (const c of characters) {
        charNameToId.set(c.name.toUpperCase(), c.id);
      }

      // Derive character names positionally: 'character' element content is the name,
      // subsequent 'dialogue' elements belong to that character until the next 'character'
      let currentCharName: string | null = null;
      let currentSceneNum: string | null = null;
      const charSceneSet = new Map<string, Set<string>>();

      for (const el of scriptElements) {
        if (el.element_type === 'character') {
          currentCharName = (el.content || '').replace(/\s*\(.*\)\s*$/, '').trim().toUpperCase();
          currentSceneNum = el.scene_number || currentSceneNum;
        } else if (el.element_type === 'dialogue' && currentCharName) {
          const charId = charNameToId.get(currentCharName);
          if (charId && currentSceneNum) {
            if (!charSceneSet.has(charId)) charSceneSet.set(charId, new Set());
            charSceneSet.get(charId)!.add(currentSceneNum);
          }
        }
      }

      // Merge: only add scenes not already captured by cast_ids
      charSceneSet.forEach((sceneNums, charId) => {
        const existing = new Set(map[charId] || []);
        sceneNums.forEach(sn => {
          if (!existing.has(sn)) {
            if (!map[charId]) map[charId] = [];
            map[charId].push(sn);
          }
        });
      });
    }

    return map;
  }, [scenes, scriptElements, characters]);

  const scenesForCharacter = useCallback((charId: string): Scene[] => {
    return scenes.filter((s) => s.cast_ids && s.cast_ids.includes(charId));
  }, [scenes]);

  const stats = useMemo(() => {
    const total = characters.length;
    const castCount = characters.filter((c) => c.cast_actor).length;
    const uncast = total - castCount;
    const mainChars = characters.filter((c) => c.is_main);
    const mainCast = mainChars.filter((c) => c.cast_actor).length;
    const supportingChars = characters.filter((c) => !c.is_main);
    const supportingCast = supportingChars.filter((c) => c.cast_actor).length;
    return { total, castCount, uncast, mainTotal: mainChars.length, mainCast, supportingTotal: supportingChars.length, supportingCast };
  }, [characters]);

  const filteredCharacters = useMemo(() => {
    let result = characters;
    if (filterMode === 'cast') result = result.filter((c) => c.cast_actor);
    if (filterMode === 'uncast') result = result.filter((c) => !c.cast_actor);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.cast_actor && c.cast_actor.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [characters, filterMode, searchQuery]);

  const selectedChar = useMemo(() => characters.find((c) => c.id === selectedCharId) || null, [characters, selectedCharId]);

  // ── Actions ────────────────────────────────────────────────
  const openDetail = (char: Character) => {
    setSelectedCharId(char.id);
    setEditActor(char.cast_actor || '');
    setEditNotes(char.cast_notes || '');
    setShowTeamPicker(false);
  };

  const closeDetail = () => {
    setSelectedCharId(null);
    setEditActor('');
    setEditNotes('');
    setShowTeamPicker(false);
  };

  const saveCasting = async () => {
    if (!selectedCharId) return;
    setSaving(selectedCharId);
    try {
      const { error } = await supabase
        .from('characters')
        .update({ cast_actor: editActor.trim() || null, cast_notes: editNotes.trim() || null })
        .eq('id', selectedCharId);

      if (error) throw error;

      setCharacters((prev) =>
        prev.map((c) =>
          c.id === selectedCharId
            ? { ...c, cast_actor: editActor.trim() || null, cast_notes: editNotes.trim() || null }
            : c
        )
      );
      toast('Casting updated', 'success');
      closeDetail();
    } catch (err) {
      console.error('Save error:', err);
      toast('Failed to save casting', 'error');
    } finally {
      setSaving(null);
    }
  };

  const clearCasting = async (charId: string) => {
    setSaving(charId);
    try {
      const { error } = await supabase
        .from('characters')
        .update({ cast_actor: null, cast_notes: null })
        .eq('id', charId);

      if (error) throw error;

      setCharacters((prev) =>
        prev.map((c) => (c.id === charId ? { ...c, cast_actor: null, cast_notes: null } : c))
      );
      toast('Casting cleared', 'success');
      if (selectedCharId === charId) closeDetail();
    } catch (err) {
      toast('Failed to clear casting', 'error');
    } finally {
      setSaving(null);
    }
  };

  const assignTeamMember = (member: TeamMember) => {
    const name = member.profile.full_name || member.profile.display_name || member.profile.email;
    setEditActor(name);
    setShowTeamPicker(false);
  };

  // ── Casting Call actions ───────────────────────────────────
  const addQuestion = () => {
    setCastingQuestions(prev => [...prev, { label: '', type: 'text', required: false }]);
  };
  const removeQuestion = (idx: number) => {
    setCastingQuestions(prev => prev.filter((_, i) => i !== idx));
  };
  const updateQuestion = (idx: number, field: string, value: any) => {
    setCastingQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };
  const toggleCastingChar = (id: string) => {
    setCastingCharacterIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const createCastingCall = async () => {
    if (!user) return;
    setCreatingCall(true);
    try {
      const selectedChars = characters.filter(c => castingCharacterIds.includes(c.id)).map(c => ({
        id: c.id,
        name: c.name,
        full_name: c.full_name,
        age: c.age,
        gender: c.gender,
        description: c.description,
        is_main: c.is_main,
      }));
      const payload = {
        project_id: projectId,
        created_by: user.id,
        share_type: 'casting',
        title: castingCallTitle || `Casting Call — ${currentProject?.title || 'Untitled'}`,
        allow_comments: false,
        allow_download: false,
        is_active: true,
        content_snapshot: {
          instructions: castingInstructions,
          questions: castingQuestions.filter(q => q.label.trim()),
          characters: selectedChars,
          project_title: currentProject?.title || 'Untitled',
          submissions: [],
        },
      };
      const { data, error } = await supabase.from('external_shares').insert(payload).select().single();
      if (error) throw error;
      setCastingCallLinks(prev => [data, ...prev]);
      setShowCastingCallBuilder(false);
      setCastingCallTitle('');
      setCastingInstructions('');
      setCastingCharacterIds([]);
      toast('Casting call link created!', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to create casting call', 'error');
    } finally {
      setCreatingCall(false);
    }
  };

  const deleteCastingCall = async (id: string) => {
    const { error } = await supabase.from('external_shares').delete().eq('id', id);
    if (error) { toast('Failed to delete', 'error'); return; }
    setCastingCallLinks(prev => prev.filter(l => l.id !== id));
    toast('Casting call deleted', 'success');
  };

  const copyCastingLink = (token: string) => {
    const url = `${window.location.origin}/casting/${token}`;
    navigator.clipboard.writeText(url);
    toast('Link copied to clipboard', 'success');
  };

  // ── Role type label ────────────────────────────────────────
  const roleLabel = (char: Character) => {
    if (char.is_main) return 'Lead';
    return 'Supporting';
  };

  const roleBadgeColor = (char: Character) => {
    if (char.is_main) return 'bg-amber-500/20 text-amber-400';
    return 'bg-surface-700 text-surface-300';
  };

  // ── Pro gate ───────────────────────────────────────────────
  if (!hasProAccess) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md p-8 text-center">
          <div className="text-4xl mb-4">🎭</div>
          <h2 className="text-xl font-bold text-white mb-2">Casting</h2>
          <p className="text-sm text-surface-400 mb-6">
            Connect characters with team members, assign actors, and track casting status across your project.
          </p>
          <Button onClick={() => { window.location.href = '/pro'; }}>Upgrade to Pro</Button>
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingPage />;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Casting</h1>
          <p className="text-sm text-surface-400 mt-1">
            Connect characters with actors &amp; team members
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Characters', value: stats.total, color: 'text-white' },
          { label: 'Cast', value: stats.castCount, color: 'text-green-400' },
          { label: 'Uncast', value: stats.uncast, color: stats.uncast > 0 ? 'text-amber-400' : 'text-surface-400' },
          { label: 'Main / Cast', value: `${stats.mainCast}/${stats.mainTotal}`, color: 'text-amber-400' },
          { label: 'Supporting / Cast', value: `${stats.supportingCast}/${stats.supportingTotal}`, color: 'text-blue-400' },
          { label: 'Total Scenes', value: scenes.length, color: 'text-surface-300' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-surface-900 border border-surface-800 p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-surface-500 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Casting progress bar */}
      {stats.total > 0 && (
        <div className="rounded-lg bg-surface-900 border border-surface-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-surface-400">Casting Progress</span>
            <span className="text-xs font-medium text-white">
              {stats.castCount}/{stats.total} ({Math.round((stats.castCount / stats.total) * 100)}%)
            </span>
          </div>
          <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${(stats.castCount / stats.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Casting Call Section ────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Casting Calls</h3>
            <p className="text-xs text-surface-400 mt-0.5">Share a public form for actors to submit applications</p>
          </div>
          <Button size="sm" onClick={() => setShowCastingCallBuilder(true)}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Casting Call
          </Button>
        </div>

        {/* Existing casting call links */}
        {castingCallLinks.length > 0 ? (
          <div className="space-y-2">
            {castingCallLinks.map((link) => (
              <div key={link.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/50 border border-surface-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{link.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-surface-500">{new Date(link.created_at).toLocaleDateString()}</span>
                    <span className="text-[10px] text-surface-500">{link.view_count} views</span>
                    <span className="text-[10px] text-amber-400">{submissionCounts[link.id] || 0} submissions</span>
                    {!link.is_active && <Badge variant="default">Inactive</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Button size="sm" variant="ghost" onClick={() => copyCastingLink(link.access_token)}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copy Link
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => window.open(`/casting/${link.access_token}`, '_blank')}>
                    View
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => deleteCastingCall(link.id)}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-surface-400">No casting calls yet. Create one to share a public audition form.</p>
          </div>
        )}
      </Card>

      {/* ── Casting Call Builder Modal ─────────────────────────── */}
      {showCastingCallBuilder && (
        <Modal isOpen onClose={() => setShowCastingCallBuilder(false)} title="Create Casting Call" size="lg">
          <div className="space-y-5 p-1 max-h-[70vh] overflow-y-auto">
            {/* Title */}
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">Call Title</label>
              <Input
                placeholder={`Casting Call — ${currentProject?.title || 'Untitled'}`}
                value={castingCallTitle}
                onChange={(e) => setCastingCallTitle(e.target.value)}
              />
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">Instructions for Applicants</label>
              <Textarea
                placeholder="Describe what you're looking for, audition details, deadline, etc."
                value={castingInstructions}
                onChange={(e) => setCastingInstructions(e.target.value)}
                rows={3}
              />
            </div>

            {/* Select Characters */}
            <div>
              <label className="block text-sm text-surface-400 mb-2">Roles Available</label>
              <p className="text-[11px] text-surface-500 mb-2">Select which characters are open for casting</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {characters.filter(c => !c.cast_actor).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleCastingChar(c.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                      castingCharacterIds.includes(c.id)
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-surface-700 text-surface-300 hover:border-surface-600'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#666' }} />
                    <div className="truncate">
                      <p className="font-medium truncate">{c.name}</p>
                      {c.age && <p className="text-[10px] text-surface-500">{c.age}{c.gender ? ` · ${c.gender}` : ''}</p>}
                    </div>
                  </button>
                ))}
              </div>
              {castingCharacterIds.length > 0 && (
                <p className="text-[11px] text-amber-400 mt-2">{castingCharacterIds.length} role(s) selected</p>
              )}
            </div>

            {/* Custom Questions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-surface-400">Application Questions</label>
                <button onClick={addQuestion} className="text-[11px] text-brand-400 hover:text-brand-300">+ Add Question</button>
              </div>
              <div className="space-y-2">
                {castingQuestions.map((q, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Input
                      placeholder="Question label..."
                      value={q.label}
                      onChange={(e) => updateQuestion(idx, 'label', e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                      className="rounded-lg border border-surface-700 bg-surface-900 px-2 py-2 text-xs text-white"
                    >
                      <option value="text">Short Text</option>
                      <option value="textarea">Long Text</option>
                      <option value="select">Select</option>
                    </select>
                    <label className="flex items-center gap-1 text-[10px] text-surface-400 whitespace-nowrap pt-2.5">
                      <input type="checkbox" checked={q.required} onChange={() => updateQuestion(idx, 'required', !q.required)} className="accent-amber-500" />
                      Req.
                    </label>
                    <button onClick={() => removeQuestion(idx)} className="text-red-400 hover:text-red-300 pt-2.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-surface-800">
              <Button variant="ghost" onClick={() => setShowCastingCallBuilder(false)}>Cancel</Button>
              <Button onClick={createCastingCall} loading={creatingCall} disabled={castingCharacterIds.length === 0}>
                Create Casting Call
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {(['all', 'cast', 'uncast'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterMode === mode
                  ? 'bg-amber-500 text-black'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800'
              }`}
            >
              {mode === 'all' ? 'All' : mode === 'cast' ? 'Cast' : 'Uncast'}
              <span className="ml-1 opacity-70">
                ({mode === 'all' ? stats.total : mode === 'cast' ? stats.castCount : stats.uncast})
              </span>
            </button>
          ))}
        </div>
        <div className="flex-1">
          <Input
            placeholder="Search characters or actors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Characters Grid */}
      {filteredCharacters.length === 0 ? (
        <div className="text-center py-16 text-surface-500">
          {characters.length === 0 ? (
            <>
              <div className="text-4xl mb-3">🎭</div>
              <p className="text-sm">No characters in this project yet.</p>
              <p className="text-xs text-surface-600 mt-1">Add characters in the Characters section first.</p>
            </>
          ) : (
            <p className="text-sm">No characters match your filter.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCharacters.map((char) => {
            const charScenes = sceneCountMap[char.id] || [];
            const isCast = !!char.cast_actor;

            return (
              <Card
                key={char.id}
                className="p-4 hover:border-surface-700 transition-colors cursor-pointer"
                onClick={() => openDetail(char)}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0 font-bold"
                    style={{
                      backgroundColor: char.color ? `${char.color}20` : '#6366f120',
                      color: char.color || '#6366f1',
                    }}
                  >
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt={char.name || 'Character avatar'} className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      char.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Name row */}
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{char.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${roleBadgeColor(char)}`}>
                        {roleLabel(char)}
                      </span>
                    </div>

                    {/* Actor / meta */}
                    <div className="flex items-center gap-2 mt-0.5">
                      {isCast ? (
                        <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {char.cast_actor}
                        </span>
                      ) : (
                        <span className="text-xs italic text-surface-500">Uncast</span>
                      )}
                    </div>

                    {/* Details row */}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-500">
                      {char.gender && <span>{char.gender}</span>}
                      {char.age && <span>Age: {char.age}</span>}
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                        </svg>
                        {charScenes.length} scene{charScenes.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Description preview */}
                    {char.description && (
                      <p className="text-xs text-surface-400 mt-1.5 line-clamp-1">{char.description}</p>
                    )}

                    {/* Cast notes preview */}
                    {char.cast_notes && (
                      <p className="text-[11px] text-surface-500 mt-1 italic line-clamp-1">
                        📝 {char.cast_notes}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Detail / Assignment Modal ─────────────────────── */}
      <Modal isOpen={!!selectedChar} onClose={closeDetail} title={selectedChar?.name || 'Character'} size="lg">
        {selectedChar && (
          <div className="p-6 space-y-6">
            {/* Character info header */}
            <div className="flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold shrink-0"
                style={{
                  backgroundColor: selectedChar.color ? `${selectedChar.color}20` : '#6366f120',
                  color: selectedChar.color || '#6366f1',
                }}
              >
                {selectedChar.avatar_url ? (
                  <img src={selectedChar.avatar_url} alt={selectedChar.name || 'Character avatar'} className="w-full h-full rounded-xl object-cover" />
                ) : (
                  selectedChar.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-white">{selectedChar.name}</h3>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${roleBadgeColor(selectedChar)}`}>
                    {roleLabel(selectedChar)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                  {selectedChar.gender && <span>{selectedChar.gender}</span>}
                  {selectedChar.age && <span>Age: {selectedChar.age}</span>}
                </div>
                {selectedChar.description && (
                  <p className="text-sm text-surface-300 mt-2">{selectedChar.description}</p>
                )}
                {selectedChar.backstory && (
                  <p className="text-xs text-surface-500 mt-1 line-clamp-2">{selectedChar.backstory}</p>
                )}
                {selectedChar.personality_traits && selectedChar.personality_traits.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedChar.personality_traits.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-800 text-surface-300 border border-surface-700">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Scene breakdown */}
            <div>
              <h4 className="text-xs font-semibold text-surface-300 uppercase tracking-wide mb-2">
                Scene Appearances ({scenesForCharacter(selectedChar.id).length})
              </h4>
              {scenesForCharacter(selectedChar.id).length === 0 ? (
                <p className="text-xs text-surface-500 italic">Not assigned to any scenes yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {scenesForCharacter(selectedChar.id).map((scene) => (
                    <span
                      key={scene.id}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-800 text-surface-300 border border-surface-700"
                      title={scene.scene_heading || ''}
                    >
                      {scene.scene_number ? `Sc ${scene.scene_number}` : 'Scene'}
                      {scene.page_count ? ` (${scene.page_count}p)` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-surface-800" />

            {/* Assignment section */}
            <div>
              <h4 className="text-xs font-semibold text-surface-300 uppercase tracking-wide mb-3">Cast Assignment</h4>

              <div className="space-y-3">
                {/* Actor name input */}
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Actor Name</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editActor}
                      onChange={(e) => setEditActor(e.target.value)}
                      placeholder="Type actor name or pick from team..."
                      className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                    />
                    {teamMembers.length > 0 && (
                      <button
                        onClick={() => setShowTeamPicker(!showTeamPicker)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          showTeamPicker
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-surface-800 text-surface-300 border-surface-700 hover:border-surface-600'
                        }`}
                        title="Pick from team"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Team member picker */}
                {showTeamPicker && teamMembers.length > 0 && (
                  <div className="rounded-lg border border-surface-700 bg-surface-800/50 p-2 max-h-48 overflow-y-auto space-y-1">
                    <p className="text-[10px] text-surface-500 uppercase tracking-wide px-2 py-1">Project Team Members</p>
                    {teamMembers.map((member) => {
                      const memberName = member.profile.full_name || member.profile.display_name || member.profile.email;
                      return (
                        <button
                          key={member.id}
                          onClick={() => assignTeamMember(member)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-surface-700 transition-colors group"
                        >
                          <Avatar
                            src={member.profile.avatar_url || undefined}
                            name={memberName}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate group-hover:text-amber-400 transition-colors">
                              {memberName}
                            </p>
                            <p className="text-[11px] text-surface-500 truncate">
                              {member.job_title || member.role}
                              {member.department ? ` · ${member.department}` : ''}
                            </p>
                          </div>
                          <svg className="w-4 h-4 text-surface-600 group-hover:text-amber-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Cast notes */}
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Casting Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Audition notes, special requirements, schedule constraints..."
                    rows={3}
                    className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-800">
              <div>
                {selectedChar.cast_actor && (
                  <button
                    onClick={() => clearCasting(selectedChar.id)}
                    disabled={saving === selectedChar.id}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    Clear casting
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closeDetail}>Cancel</Button>
                <Button
                  onClick={saveCasting}
                  loading={saving === selectedCharId}
                  className="bg-amber-500 hover:bg-amber-600 text-black"
                >
                  Save Casting
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Team overview */}
      {teamMembers.length > 0 && (
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
          <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
            Team Members Available ({teamMembers.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {teamMembers.map((member) => {
              const name = member.profile.full_name || member.profile.display_name || member.profile.email;
              const isAssigned = characters.some((c) => c.cast_actor === name);
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                    isAssigned
                      ? 'border-green-500/30 bg-green-500/10 text-green-400'
                      : 'border-surface-700 bg-surface-800 text-surface-300'
                  }`}
                >
                  <Avatar
                    src={member.profile.avatar_url || undefined}
                    name={name}
                    size="sm"
                  />
                  <span>{name}</span>
                  {isAssigned && (
                    <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="text-surface-500">{member.job_title || member.role}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
