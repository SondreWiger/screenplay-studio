'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, toast, Modal, Input, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';

// Beat Sheet — Story structure planning tool
// Supports Save the Cat (15 beats), Three-Act, Hero's Journey
// Plus custom frameworks stored in localStorage
// Stored in projects.content_metadata.beat_sheets.{scope}
// Scope: 'project' | 'ep_{scriptId}' | 'season_{n}'
// Also handles legacy: content_metadata.beat_sheet (migrated)

type FrameworkKey = 'save_the_cat' | 'three_act' | 'hero_journey' | `custom_${string}`;

interface Beat {
  id: string;
  label: string;
  description: string;
  pageHint: string;
  pagePercent: number;
  color: string;
  notes: string;
  scenes: string[];
}

interface BeatSheetData {
  framework: FrameworkKey;
  totalPages: number;
  beats: Record<string, { notes: string; scenes: string[]; customPage?: number; linkedSceneIds?: string[]; completed?: boolean }>;
}

interface SceneRef {
  id: string;
  scene_number: string | null;
  scene_heading: string | null;
}

// Built-in framework definitions

const SAVE_THE_CAT: Beat[] = [
  { id: 'opening_image',   label: 'Opening Image',      description: 'A snapshot of the hero\'s flawed world before the journey begins.',                        pageHint: 'p. 1',      pagePercent: 1,   color: '#6366f1', notes: '', scenes: [] },
  { id: 'theme_stated',    label: 'Theme Stated',       description: 'Someone (not the hero) hints at what the story is about — the lesson to be learned.',       pageHint: 'p. 5',      pagePercent: 4,   color: '#8b5cf6', notes: '', scenes: [] },
  { id: 'setup',           label: 'Set-Up',             description: 'Introduce the hero\'s world, supporting characters, and hint at all six things that need fixing.',   pageHint: 'p. 1–10',  pagePercent: 6,   color: '#a78bfa', notes: '', scenes: [] },
  { id: 'catalyst',        label: 'Catalyst',           description: 'A life-changing event that disrupts the hero\'s world and forces a decision.',             pageHint: 'p. 12',     pagePercent: 10,  color: '#ec4899', notes: '', scenes: [] },
  { id: 'debate',          label: 'Debate',             description: 'The hero wrestles with the choice: should they cross into Act Two?',                      pageHint: 'p. 12–25', pagePercent: 16,  color: '#f97316', notes: '', scenes: [] },
  { id: 'break_into_two',  label: 'Break Into Two',     description: 'The hero makes a choice and steps into Act Two — an upside-down version of their world.', pageHint: 'p. 25',     pagePercent: 21,  color: '#eab308', notes: '', scenes: [] },
  { id: 'b_story',         label: 'B Story',            description: 'A new subplot (often love interest) that carries the theme. The "helper" who teaches the hero.', pageHint: 'p. 30',     pagePercent: 25,  color: '#22c55e', notes: '', scenes: [] },
  { id: 'fun_and_games',   label: 'Fun & Games',        description: 'The promise of the premise. The hero tries and fails, learns the new world rules.',       pageHint: 'p. 30–55', pagePercent: 38,  color: '#10b981', notes: '', scenes: [] },
  { id: 'midpoint',        label: 'Midpoint',           description: 'A false victory or defeat. Stakes are raised. Hero\'s goal shifts from want to need.',    pageHint: 'p. 55',     pagePercent: 50,  color: '#14b8a6', notes: '', scenes: [] },
  { id: 'bad_guys_close',  label: 'Bad Guys Close In',  description: 'The opposition regroups. Internal doubts surface. The hero\'s team starts to fall apart.',  pageHint: 'p. 55–75', pagePercent: 62,  color: '#3b82f6', notes: '', scenes: [] },
  { id: 'all_is_lost',     label: 'All Is Lost',        description: 'The worst moment. The hero loses everything. Often features a "whiff of death".',          pageHint: 'p. 75',     pagePercent: 75,  color: '#ef4444', notes: '', scenes: [] },
  { id: 'dark_night',      label: 'Dark Night of the Soul', description: 'The hero wallows in hopelessness. The old world solution won\'t work here.',         pageHint: 'p. 75–85', pagePercent: 79,  color: '#dc2626', notes: '', scenes: [] },
  { id: 'break_into_three',label: 'Break Into Three',   description: 'A synthesis of Act One and Two. The hero discovers the solution using both worlds.',       pageHint: 'p. 85',     pagePercent: 83,  color: '#9333ea', notes: '', scenes: [] },
  { id: 'finale',          label: 'Finale',             description: 'Hero storms the castle using new skills. The bad guys are defeated for good.',            pageHint: 'p. 85–110',pagePercent: 91,  color: '#7c3aed', notes: '', scenes: [] },
  { id: 'final_image',     label: 'Final Image',        description: 'Mirror of the opening image. Shows how much the hero has changed.',                       pageHint: 'p. 110',    pagePercent: 99,  color: '#6d28d9', notes: '', scenes: [] },
];

const THREE_ACT: Beat[] = [
  { id: 'act1_setup',      label: 'Act 1 — Set-Up',         description: 'Establish world, characters, stakes. End with inciting incident or turning point.',    pageHint: 'p. 1–25',   pagePercent: 12,  color: '#6366f1', notes: '', scenes: [] },
  { id: 'inciting',        label: 'Inciting Incident',      description: 'The event that kicks off the main conflict and locks the hero into the journey.',       pageHint: 'p. 12',     pagePercent: 10,  color: '#ec4899', notes: '', scenes: [] },
  { id: 'act1_break',      label: 'Act 1 Break',            description: 'Point of no return. Hero crosses into Act 2.',                                         pageHint: 'p. 25',     pagePercent: 21,  color: '#f97316', notes: '', scenes: [] },
  { id: 'act2a',           label: 'Act 2A — Rising Action',  description: 'Hero pursues goal. Obstacles escalate. Allies and enemies defined.',                   pageHint: 'p. 25–60', pagePercent: 37,  color: '#22c55e', notes: '', scenes: [] },
  { id: 'midpoint2',       label: 'Midpoint',               description: 'Major shift — up or down. Stakes double.',                                             pageHint: 'p. 55–60', pagePercent: 50,  color: '#14b8a6', notes: '', scenes: [] },
  { id: 'act2b',           label: 'Act 2B — Complications', description: 'Hero\'s situation deteriorates. Major reversal or revelation.',                         pageHint: 'p. 60–85', pagePercent: 65,  color: '#3b82f6', notes: '', scenes: [] },
  { id: 'climax_lead',     label: 'Act 2 Break / Low Point', description: 'Darkest moment. Everything is lost. Hero must change to survive.',                    pageHint: 'p. 85',     pagePercent: 75,  color: '#ef4444', notes: '', scenes: [] },
  { id: 'act3',            label: 'Act 3 — Resolution',     description: 'Final confrontation. Hero uses new understanding to overcome antagonist.',              pageHint: 'p. 85–110',pagePercent: 88,  color: '#9333ea', notes: '', scenes: [] },
  { id: 'resolution',      label: 'Resolution / Denouement','description': 'New equilibrium. Show the aftermath and changed world.',                              pageHint: 'p. 110',    pagePercent: 98,  color: '#7c3aed', notes: '', scenes: [] },
];

const HERO_JOURNEY: Beat[] = [
  { id: 'ordinary_world',  label: 'Ordinary World',         description: 'Hero\'s everyday life before the adventure.',                                          pageHint: 'p. 1–10',  pagePercent: 5,   color: '#6366f1', notes: '', scenes: [] },
  { id: 'call_adventure',  label: 'Call to Adventure',      description: 'Problem or challenge presented to the hero.',                                          pageHint: 'p. 10–15', pagePercent: 12,  color: '#8b5cf6', notes: '', scenes: [] },
  { id: 'refusal',         label: 'Refusal of the Call',    description: 'Hero\'s hesitation or initial resistance.',                                             pageHint: 'p. 15–20', pagePercent: 17,  color: '#a78bfa', notes: '', scenes: [] },
  { id: 'mentor',          label: 'Meeting the Mentor',     description: 'Hero gains guidance, tools, or confidence from a wise figure.',                         pageHint: 'p. 20–25', pagePercent: 21,  color: '#ec4899', notes: '', scenes: [] },
  { id: 'threshold',       label: 'Crossing the Threshold', description: 'Hero leaves the ordinary world and enters the special world.',                          pageHint: 'p. 25',     pagePercent: 25,  color: '#f97316', notes: '', scenes: [] },
  { id: 'tests',           label: 'Tests, Allies, Enemies', description: 'Hero learns the rules of the special world. Gains companions, faces threats.',           pageHint: 'p. 25–55', pagePercent: 38,  color: '#22c55e', notes: '', scenes: [] },
  { id: 'innermost_cave',  label: 'Approach the Inmost Cave','description': 'Hero approaches the central ordeal location, preparing for the big challenge.',      pageHint: 'p. 55',     pagePercent: 50,  color: '#14b8a6', notes: '', scenes: [] },
  { id: 'ordeal',          label: 'The Ordeal',             description: 'The central crisis. Hero faces death (literal or metaphorical) and is transformed.',    pageHint: 'p. 60–70', pagePercent: 60,  color: '#ef4444', notes: '', scenes: [] },
  { id: 'reward',          label: 'The Reward',             description: 'Hero seizes the sword — achieves the goal or claim the prize.',                         pageHint: 'p. 70–80', pagePercent: 72,  color: '#3b82f6', notes: '', scenes: [] },
  { id: 'road_back',       label: 'The Road Back',          description: 'Hero begins the journey home. Chased or pursued; final choices made.',                  pageHint: 'p. 80–90', pagePercent: 82,  color: '#f97316', notes: '', scenes: [] },
  { id: 'resurrection',    label: 'Resurrection',           description: 'Climactic final test. Hero is reborn / transformed. Final confrontation.',               pageHint: 'p. 90–105',pagePercent: 90,  color: '#dc2626', notes: '', scenes: [] },
  { id: 'return_elixir',   label: 'Return with the Elixir', description: 'Hero returns transformed, with knowledge or treasure to share with ordinary world.',    pageHint: 'p. 105–110',pagePercent: 98, color: '#7c3aed', notes: '', scenes: [] },
];

const BUILTIN_FRAMEWORKS: Record<string, { label: string; beats: Beat[] }> = {
  save_the_cat:  { label: 'Save the Cat',     beats: SAVE_THE_CAT },
  three_act:     { label: 'Three-Act',        beats: THREE_ACT },
  hero_journey:  { label: "Hero's Journey",   beats: HERO_JOURNEY },
};

// Custom framework persistence
const CUSTOM_FRAMEWORKS_KEY = 'screenplay-studio-custom-frameworks';

interface CustomFrameworkDef {
  id: string;
  label: string;
  beats: Beat[];
}

function loadCustomFrameworks(): CustomFrameworkDef[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_FRAMEWORKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomFrameworks(fws: CustomFrameworkDef[]) {
  localStorage.setItem(CUSTOM_FRAMEWORKS_KEY, JSON.stringify(fws));
}

const BEAT_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#ec4899', '#f97316',
  '#eab308', '#22c55e', '#10b981', '#14b8a6', '#3b82f6',
  '#ef4444', '#dc2626', '#9333ea', '#7c3aed', '#6d28d9',
  '#0ea5e9', '#06b6d4', '#84cc16', '#d946ef', '#f43f5e',
];

function generateBeatId(): string {
  return `beat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Episodic scope types

interface EpisodeItem { id: string; title: string; season: number | null; }

interface ScopeData {
  framework: FrameworkKey;
  totalPages: number;
  beatNotes: Record<string, string>;
  beatLinkedScenes: Record<string, string[]>;
  beatCompleted?: Record<string, boolean>;
}

const DEFAULT_SCOPE: ScopeData = {
  framework: 'save_the_cat',
  totalPages: 110,
  beatNotes: {},
  beatLinkedScenes: {},
  beatCompleted: {},
};

/** Try to extract a season number from an episode title like "S01E02", "Season 3 Ep1", etc. */
function extractSeason(title: string): number | null {
  const m =
    title.match(/\bS(\d{1,2})E\d+/i) ||
    title.match(/\bSeason\s*(\d{1,2})\b/i) ||
    title.match(/\bSeries\s*(\d{1,2})\b/i) ||
    title.match(/^(\d{1,2})x\d+/i) ||
    title.match(/\bS(\d{1,2})\b(?=\s|$)/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseScopeData(saved: BeatSheetData): ScopeData {
  const beatNotes: Record<string, string> = {};
  const beatLinkedScenes: Record<string, string[]> = {};
  const beatCompleted: Record<string, boolean> = {};
  if (saved.beats) {
    for (const [id, d] of Object.entries(saved.beats)) {
      beatNotes[id] = d.notes;
      if (d.linkedSceneIds?.length) beatLinkedScenes[id] = d.linkedSceneIds;
      if (d.completed) beatCompleted[id] = true;
    }
  }
  return {
    framework: saved.framework ?? 'save_the_cat',
    totalPages: saved.totalPages ?? 110,
    beatNotes,
    beatLinkedScenes,
    beatCompleted,
  };
}

export default function BeatSheetPage({ params }: { params: { id: string } }) {
  const { user }               = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole        = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit                = currentUserRole !== 'viewer';

  const [framework, setFramework] = useState<FrameworkKey>('save_the_cat');
  const [beatNotes, setBeatNotes] = useState<Record<string, string>>({});
  const [totalPages, setTotalPages] = useState(110);
  const [saving, setSaving]    = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [loading, setLoading]  = useState(true);
  const [projectScenes, setProjectScenes] = useState<SceneRef[]>([]);
  const [beatLinkedScenes, setBeatLinkedScenes] = useState<Record<string, string[]>>({});
  const [beatCompleted, setBeatCompleted] = useState<Record<string, boolean>>({});

  // Custom framework state
  const [customFrameworks, setCustomFrameworks] = useState<CustomFrameworkDef[]>([]);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customBuilderName, setCustomBuilderName] = useState('');
  const [customBuilderBeats, setCustomBuilderBeats] = useState<Beat[]>([]);
  const [draggedBeatIdx, setDraggedBeatIdx] = useState<number | null>(null);

  // Timeline hover state
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  // Episodic scope
  const [scope, setScope]           = useState<string>('project');
  const [otherScopes, setOtherScopes] = useState<Record<string, ScopeData>>({});
  const [episodes, setEpisodes]     = useState<EpisodeItem[]>([]);
  const scopeRef = useRef<string>('project');
  const beatRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isEpisodic = currentProject?.script_type === 'episodic';

  // Load custom frameworks from localStorage
  useEffect(() => {
    setCustomFrameworks(loadCustomFrameworks());
  }, []);

  // All frameworks merged (built-in + custom)
  const allFrameworks = useMemo(() => {
    const merged: Record<string, { label: string; beats: Beat[]; isCustom?: boolean }> = { ...BUILTIN_FRAMEWORKS };
    for (const cf of customFrameworks) {
      merged[`custom_${cf.id}`] = { label: cf.label, beats: cf.beats, isCustom: true };
    }
    return merged;
  }, [customFrameworks]);

  // Get beats for current framework
  const beats = allFrameworks[framework]?.beats ?? SAVE_THE_CAT;

  // Load saved data
  useEffect(() => {
    const load = async () => {
      if (!params.id) return;
      const supabase = createClient();
      const [projectRes, scenesRes, scriptsRes] = await Promise.all([
        supabase.from('projects').select('content_metadata').eq('id', params.id).single(),
        supabase.from('scenes').select('id,scene_number,scene_heading')
          .eq('project_id', params.id).order('sort_order', { ascending: true }),
        supabase.from('scripts').select('id,title,metadata,created_at').eq('project_id', params.id).order('created_at', { ascending: true }),
      ]);
      setProjectScenes((scenesRes.data as SceneRef[]) ?? []);
      const rawScripts = (scriptsRes.data as { id: string; title: string; metadata?: { sort_order?: number }; created_at?: string }[]) ?? [];
      rawScripts.sort((a, b) => {
        const oa = a.metadata?.sort_order ?? 9999;
        const ob = b.metadata?.sort_order ?? 9999;
        if (oa !== ob) return oa - ob;
        return (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1;
      });
      const eps: EpisodeItem[] = rawScripts.map((s) => ({
        id: s.id, title: s.title, season: extractSeason(s.title),
      }));
      setEpisodes(eps);

      const meta = projectRes.data?.content_metadata as Record<string, unknown> | null ?? {};
      const allSheets = meta.beat_sheets as Record<string, BeatSheetData> | undefined;
      const legacySheet = meta.beat_sheet as BeatSheetData | undefined;

      const scopeMap: Record<string, ScopeData> = {};
      if (allSheets) {
        for (const [key, data] of Object.entries(allSheets)) {
          scopeMap[key] = parseScopeData(data);
        }
      } else if (legacySheet) {
        scopeMap['project'] = parseScopeData(legacySheet);
      }

      const projectData = scopeMap['project'] ?? DEFAULT_SCOPE;
      setFramework(projectData.framework);
      setTotalPages(projectData.totalPages);
      setBeatNotes(projectData.beatNotes);
      setBeatLinkedScenes(projectData.beatLinkedScenes);
      setBeatCompleted(projectData.beatCompleted ?? {});

      const rest = { ...scopeMap };
      delete rest['project'];
      setOtherScopes(rest);
      setLoading(false);
    };
    load();
  }, [params.id]);

  const save = useCallback(async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: cur } = await supabase
        .from('projects')
        .select('content_metadata')
        .eq('id', params.id)
        .single();
      const existing = cur?.content_metadata ?? {};

      const allScopes: Record<string, ScopeData> = {
        ...otherScopes,
        [scopeRef.current]: { framework, totalPages, beatNotes, beatLinkedScenes, beatCompleted },
      };

      const beat_sheets: Record<string, BeatSheetData> = {};
      for (const [key, data] of Object.entries(allScopes)) {
        beat_sheets[key] = {
          framework: data.framework,
          totalPages: data.totalPages,
          beats: Object.fromEntries(
            Object.entries(data.beatNotes).map(([id, notes]) => [
              id, {
                notes,
                scenes: [],
                linkedSceneIds: data.beatLinkedScenes[id] ?? [],
                completed: data.beatCompleted?.[id] ?? false,
              },
            ]),
          ),
        };
      }

      await supabase
        .from('projects')
        .update({ content_metadata: { ...(existing as object), beat_sheets, beat_sheet: beat_sheets['project'] } })
        .eq('id', params.id);
      toast.success('Beat sheet saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }, [canEdit, framework, totalPages, beatNotes, beatLinkedScenes, beatCompleted, otherScopes, params.id]);

  const switchScope = useCallback((newScope: string) => {
    const currentData: ScopeData = { framework, totalPages, beatNotes, beatLinkedScenes, beatCompleted };
    setOtherScopes((prev) => ({ ...prev, [scope]: currentData }));
    const allData = { ...otherScopes, [scope]: currentData };
    const data = allData[newScope] ?? DEFAULT_SCOPE;
    setFramework(data.framework);
    setTotalPages(data.totalPages);
    setBeatNotes(data.beatNotes);
    setBeatLinkedScenes(data.beatLinkedScenes);
    setBeatCompleted(data.beatCompleted ?? {});
    setScope(newScope);
    scopeRef.current = newScope;
    setActiveNote(null);
  }, [scope, otherScopes, framework, totalPages, beatNotes, beatLinkedScenes, beatCompleted]);

  useEffect(() => { scopeRef.current = scope; }, [scope]);

  const filledCount = beats.filter((b) => beatNotes[b.id]?.trim()).length;
  const completedCount = beats.filter((b) => beatCompleted[b.id]).length;

  const hasSeasonsInfo = episodes.some((e) => e.season !== null);
  const seasons = Array.from(
    new Set(episodes.map((e) => (hasSeasonsInfo ? (e.season ?? 1) : 1)))
  ).sort((a, b) => a - b);

  const scopeLabel = (() => {
    if (scope === 'project') return 'Full Project';
    if (scope.startsWith('season_')) {
      const n = scope.replace('season_', '');
      return `Season ${n}`;
    }
    if (scope.startsWith('ep_')) {
      const id = scope.replace('ep_', '');
      return episodes.find((e) => e.id === id)?.title ?? 'Episode';
    }
    return scope;
  })();

  // Custom framework builder helpers

  const openCustomBuilder = () => {
    setCustomBuilderName('');
    setCustomBuilderBeats([
      { id: generateBeatId(), label: 'Beat 1', description: '', pageHint: 'p. 1', pagePercent: 5, color: BEAT_COLORS[0], notes: '', scenes: [] },
      { id: generateBeatId(), label: 'Beat 2', description: '', pageHint: 'p. 25', pagePercent: 25, color: BEAT_COLORS[1], notes: '', scenes: [] },
      { id: generateBeatId(), label: 'Beat 3', description: '', pageHint: 'p. 50', pagePercent: 50, color: BEAT_COLORS[2], notes: '', scenes: [] },
      { id: generateBeatId(), label: 'Beat 4', description: '', pageHint: 'p. 75', pagePercent: 75, color: BEAT_COLORS[3], notes: '', scenes: [] },
      { id: generateBeatId(), label: 'Beat 5', description: '', pageHint: 'p. 100', pagePercent: 95, color: BEAT_COLORS[4], notes: '', scenes: [] },
    ]);
    setShowCustomBuilder(true);
  };

  const addBuilderBeat = () => {
    const idx = customBuilderBeats.length;
    const lastPct = idx > 0 ? customBuilderBeats[idx - 1].pagePercent : 0;
    const newPct = Math.min(99, lastPct + Math.round((99 - lastPct) / 2) || lastPct + 5);
    setCustomBuilderBeats((prev) => [
      ...prev,
      {
        id: generateBeatId(),
        label: `Beat ${idx + 1}`,
        description: '',
        pageHint: `p. ${Math.round((newPct / 100) * totalPages)}`,
        pagePercent: newPct,
        color: BEAT_COLORS[idx % BEAT_COLORS.length],
        notes: '',
        scenes: [],
      },
    ]);
  };

  const removeBuilderBeat = (idx: number) => {
    setCustomBuilderBeats((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateBuilderBeat = (idx: number, updates: Partial<Beat>) => {
    setCustomBuilderBeats((prev) => prev.map((b, i) => i === idx ? { ...b, ...updates } : b));
  };

  const saveCustomFramework = () => {
    if (!customBuilderName.trim()) {
      toast.error('Please name your framework');
      return;
    }
    if (customBuilderBeats.length < 2) {
      toast.error('A framework needs at least 2 beats');
      return;
    }
    const id = customBuilderName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const newFw: CustomFrameworkDef = {
      id,
      label: customBuilderName.trim(),
      beats: customBuilderBeats,
    };
    const updated = customFrameworks.filter((f) => f.id !== id).concat(newFw);
    setCustomFrameworks(updated);
    saveCustomFrameworks(updated);
    setFramework(`custom_${id}` as FrameworkKey);
    setShowCustomBuilder(false);
    toast.success(`Framework "${customBuilderName.trim()}" created`);
  };

  const deleteCustomFramework = (fwId: string) => {
    const updated = customFrameworks.filter((f) => f.id !== fwId);
    setCustomFrameworks(updated);
    saveCustomFrameworks(updated);
    if (framework === `custom_${fwId}`) {
      setFramework('save_the_cat');
    }
    toast.success('Custom framework deleted');
  };

  // Drag-to-reorder in custom builder

  const handleBuilderDragStart = (idx: number) => {
    setDraggedBeatIdx(idx);
  };

  const handleBuilderDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedBeatIdx === null || draggedBeatIdx === idx) return;
    setCustomBuilderBeats((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedBeatIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDraggedBeatIdx(idx);
  };

  const handleBuilderDragEnd = () => {
    setDraggedBeatIdx(null);
  };

  // Drag-to-reorder main beats
  const [draggedMainBeatIdx, setDraggedMainBeatIdx] = useState<number | null>(null);
  const [mainBeatOrder, setMainBeatOrder] = useState<string[] | null>(null);

  // Only custom frameworks support reorder
  const isCustomFramework = framework.startsWith('custom_');
  const orderedBeats = useMemo(() => {
    if (!isCustomFramework || !mainBeatOrder) return beats;
    return mainBeatOrder
      .map((id) => beats.find((b) => b.id === id))
      .filter(Boolean) as Beat[];
  }, [beats, isCustomFramework, mainBeatOrder]);

  useEffect(() => {
    if (isCustomFramework) {
      setMainBeatOrder(beats.map((b) => b.id));
    } else {
      setMainBeatOrder(null);
    }
  }, [framework, isCustomFramework, beats]);

  const handleMainDragStart = (idx: number) => {
    if (!isCustomFramework) return;
    setDraggedMainBeatIdx(idx);
  };

  const handleMainDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (!isCustomFramework || draggedMainBeatIdx === null || draggedMainBeatIdx === idx) return;
    setMainBeatOrder((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const [moved] = next.splice(draggedMainBeatIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDraggedMainBeatIdx(idx);
  };

  const handleMainDragEnd = () => {
    setDraggedMainBeatIdx(null);
  };

  // Export as text

  const exportAsText = () => {
    const lines: string[] = [];
    lines.push(`BEAT SHEET — ${allFrameworks[framework]?.label ?? framework}`);
    lines.push(`Pages: ${totalPages}`);
    lines.push(`Progress: ${filledCount}/${beats.length} filled, ${completedCount}/${beats.length} completed`);
    lines.push('');

    for (const beat of orderedBeats) {
      const page = Math.round((beat.pagePercent / 100) * totalPages);
      const completed = beatCompleted[beat.id] ? ' [DONE]' : '';
      lines.push(`▸ ${beat.label}${completed} (p. ${page})`);
      if (beatNotes[beat.id]?.trim()) {
        lines.push(`  ${beatNotes[beat.id].trim()}`);
      }
      lines.push('');
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      toast.success('Beat sheet copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  // Timeline segment click → scroll to beat

  const scrollToBeat = (beatId: string) => {
    const el = beatRefs.current[beatId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveNote(beatId);
    }
  };

  // Compute timeline segments

  const timelineSegments = useMemo(() => {
    const sorted = [...orderedBeats].sort((a, b) => a.pagePercent - b.pagePercent);
    return sorted.map((beat, i) => {
      const start = beat.pagePercent;
      const end = i < sorted.length - 1 ? sorted[i + 1].pagePercent : 100;
      const startPage = Math.max(1, Math.round((start / 100) * totalPages));
      const endPage = Math.round((end / 100) * totalPages);
      return {
        beat,
        start,
        end,
        width: Math.max(end - start, 1),
        startPage,
        endPage: Math.max(endPage, startPage + 1),
      };
    });
  }, [orderedBeats, totalPages]);

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      {/* Scope tabs — only for episodic projects with scripts */}
      {isEpisodic && episodes.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-0.5 flex-wrap bg-surface-900/60 rounded-xl border border-surface-800 p-1">
            <button
              onClick={() => switchScope('project')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                scope === 'project' ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white hover:bg-surface-800',
              )}
            >
              📁 Full Project
            </button>

            {seasons.map((seasonNum) => {
              const seasonKey = `season_${seasonNum}`;
              const seasonEps = episodes.filter((e) =>
                hasSeasonsInfo ? (e.season ?? 1) === seasonNum : true
              );
              return (
                <div key={seasonNum} className="flex items-center gap-0.5">
                  {(hasSeasonsInfo || seasons.length > 1) && (
                    <button
                      onClick={() => switchScope(seasonKey)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                        scope === seasonKey ? 'bg-violet-600/80 text-white' : 'text-violet-400 hover:text-white hover:bg-surface-800',
                      )}
                    >
                      S{seasonNum}
                    </button>
                  )}
                  {seasonEps.map((ep) => {
                    const epKey = `ep_${ep.id}`;
                    return (
                      <button
                        key={ep.id}
                        onClick={() => switchScope(epKey)}
                        className={cn(
                          'px-3 py-1.5 text-xs rounded-lg transition-colors truncate max-w-[140px]',
                          scope === epKey ? 'bg-surface-600 text-white' : 'text-surface-400 hover:text-white hover:bg-surface-800',
                        )}
                        title={ep.title}
                      >
                        {ep.title.replace(/S\d+E\d+\s*[-–]?\s*/i, '') || ep.title}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {scope !== 'project' && (
            <p className="text-xs text-surface-500 mt-1.5">Editing beat sheet for: <span className="text-surface-300 font-medium">{scopeLabel}</span></p>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Beat Sheet</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {filledCount}/{beats.length} beats filled · {completedCount}/{beats.length} completed
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export button */}
          <Button onClick={exportAsText} variant="ghost" size="sm">
            Export as Text
          </Button>
          {/* Create custom framework button */}
          {canEdit && (
            <Button onClick={openCustomBuilder} variant="secondary" size="sm">
              + Custom Framework
            </Button>
          )}
          {/* Framework switcher */}
          <div className="flex items-center gap-0.5 bg-surface-800/60 rounded-lg p-0.5">
            {(Object.entries(allFrameworks) as [string, { label: string; isCustom?: boolean }][]).map(([key, { label, isCustom }]) => (
              <div key={key} className="relative group">
                <button
                  onClick={() => setFramework(key as FrameworkKey)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    framework === key ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white',
                  )}
                >
                  {label}
                </button>
                {isCustom && framework === key && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete framework "${label}"?`)) {
                        deleteCustomFramework(key.replace('custom_', ''));
                      }
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete custom framework"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {/* Total pages */}
          <div className="flex items-center gap-1.5 text-xs text-surface-400">
            <span>Pages:</span>
            <input
              type="number"
              value={totalPages}
              onChange={(e) => setTotalPages(Number(e.target.value))}
              className="w-16 px-2 py-1 bg-surface-800/60 border border-surface-700 rounded text-white text-xs text-center"
              min={10}
              max={999}
              disabled={!canEdit}
            />
          </div>
          {canEdit && (
            <Button onClick={save} disabled={saving} size="sm">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {/* Completion progress bar */}
      {completedCount > 0 && (
        <div className="mb-4">
          <Progress value={completedCount} max={beats.length} label={`${completedCount}/${beats.length} beats written`} color="#22c55e" />
        </div>
      )}

      {/* Visual timeline */}
      <div className="mb-6 rounded-xl border border-surface-800 bg-surface-900/60 p-3 overflow-x-auto">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Timeline</span>
        </div>
        {/* Ruler */}
        <div className="relative h-5 mb-1">
          {[0, 25, 50, 75, 100].map((pct) => (
            <div key={pct} className="absolute text-[9px] text-surface-600 font-mono" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
              {Math.round((pct / 100) * totalPages)}
            </div>
          ))}
        </div>
        {/* Segments */}
        <div className="relative h-10 bg-surface-800 rounded-lg overflow-visible">
          {timelineSegments.map(({ beat, start, width, startPage, endPage }) => (
            <div
              key={beat.id}
              className="absolute top-0 h-full rounded-md cursor-pointer transition-colors duration-150 flex items-center justify-center text-[10px] font-semibold text-white/80 hover:text-white hover:brightness-110"
              style={{
                left: `${start}%`,
                width: `${width}%`,
                backgroundColor: beat.color,
                opacity: activeNote === beat.id ? 1 : hoveredSegment === beat.id ? 0.9 : 0.65,
              }}
              onClick={() => scrollToBeat(beat.id)}
              onMouseEnter={() => setHoveredSegment(beat.id)}
              onMouseLeave={() => setHoveredSegment(null)}
              title={`${beat.label} — p. ${startPage}–${endPage}`}
            >
              <span className="truncate px-1 pointer-events-none">{beat.label}</span>
              {activeNote === beat.id && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full" />
              )}
            </div>
          ))}
        </div>
        {/* Act labels */}
        <div className="flex justify-between text-[10px] text-surface-600 mt-1 px-0.5">
          <span>p. 1</span>
          <span>Act 1</span>
          <span>Act 2</span>
          <span>Act 3</span>
          <span>p. {totalPages}</span>
        </div>
      </div>

      {/* Beats grid */}
      {loading ? null : (
        <div className="space-y-3">
          {orderedBeats.map((beat, idx) => {
            const hasNote = !!beatNotes[beat.id]?.trim();
            const isActive = activeNote === beat.id;
            const isCompleted = !!beatCompleted[beat.id];
            const page = Math.round((beat.pagePercent / 100) * totalPages);
            return (
              <div
                key={beat.id}
                ref={(el) => { beatRefs.current[beat.id] = el; }}
                draggable={isCustomFramework}
                onDragStart={() => handleMainDragStart(idx)}
                onDragOver={(e) => handleMainDragOver(e, idx)}
                onDragEnd={handleMainDragEnd}
                className={cn(
                  'rounded-xl border transition-colors duration-150',
                  isActive
                    ? 'border-[#FF5F1F]/50 bg-surface-800/80'
                    : hasNote
                    ? 'border-surface-700/60 bg-surface-800/40'
                    : 'border-surface-800/60 bg-surface-800/20',
                  isCustomFramework && 'cursor-grab active:cursor-grabbing',
                  draggedMainBeatIdx === idx && 'opacity-40',
                )}
              >
                <div
                  className="flex items-start gap-3 p-4"
                >
                  {/* Drag handle + completion checkbox */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0 w-10 text-center">
                    {isCustomFramework && (
                      <div className="text-surface-600 hover:text-surface-400 cursor-grab" title="Drag to reorder">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                    )}
                    {/* Completion checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canEdit) return;
                        setBeatCompleted((prev) => ({ ...prev, [beat.id]: !prev[beat.id] }));
                      }}
                      className={cn(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0',
                        isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-surface-600 hover:border-surface-400 text-transparent',
                      )}
                      title={isCompleted ? 'Mark as not written' : 'Mark as written'}
                    >
                      {isCompleted && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    {/* Color dot */}
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: beat.color }} />
                    <span className="text-[9px] text-surface-600 font-mono">p.{page}</span>
                  </div>

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setActiveNote(isActive ? null : beat.id)}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className={cn('text-sm font-semibold', isCompleted ? 'text-green-400 line-through' : 'text-white')}>{beat.label}</h3>
                      <span className="text-[10px] text-surface-600 font-mono shrink-0">{beat.pageHint}</span>
                      {hasNote && (
                        <Badge size="sm" variant="success">✓</Badge>
                      )}
                    </div>
                    <p className="text-xs text-surface-400">{beat.description}</p>
                    {hasNote && !isActive && (
                      <p className="text-xs text-surface-300 mt-1.5 italic line-clamp-2">&quot;{beatNotes[beat.id]}&quot;</p>
                    )}
                    {/* Linked scene chips (collapsed) */}
                    {!isActive && (beatLinkedScenes[beat.id]?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {beatLinkedScenes[beat.id].map((sid) => {
                          const sc = projectScenes.find((s) => s.id === sid);
                          if (!sc) return null;
                          const label = sc.scene_number ? `S${sc.scene_number}` : sc.scene_heading ?? 'Scene';
                          return (
                            <span key={sid} className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 font-medium">
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <svg
                    className={cn('w-4 h-4 text-surface-500 shrink-0 transition-transform', isActive && 'rotate-180')}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    onClick={() => setActiveNote(isActive ? null : beat.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Notes textarea — expands when active */}
                {isActive && (
                  <div className="px-4 pb-4 pt-0 border-t border-surface-700/40">
                    <textarea
                      value={beatNotes[beat.id] ?? ''}
                      onChange={(e) =>
                        setBeatNotes((prev) => ({ ...prev, [beat.id]: e.target.value }))
                      }
                      placeholder={`What happens at the ${beat.label}? What does your hero want vs. need?`}
                      className="w-full bg-surface-700/40 rounded-lg border border-surface-700/60 p-3 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/60 resize-none mt-3"
                      rows={4}
                      disabled={!canEdit}
                      autoFocus
                    />

                    {/* Scene linker */}
                    {projectScenes.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Linked Scenes</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {(beatLinkedScenes[beat.id] ?? []).map((sid) => {
                            const sc = projectScenes.find((s) => s.id === sid);
                            if (!sc) return null;
                            const label = sc.scene_number ? `S${sc.scene_number}` : sc.scene_heading ?? 'Scene';
                            return (
                              <span key={sid} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 font-medium border border-teal-500/20">
                                {label}
                                {canEdit && (
                                  <button
                                    onClick={() => setBeatLinkedScenes((prev) => ({
                                      ...prev,
                                      [beat.id]: (prev[beat.id] ?? []).filter((id) => id !== sid),
                                    }))}
                                    className="ml-0.5 opacity-60 hover:opacity-100"
                                  >×</button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                        {canEdit && (
                          <select
                            value=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              setBeatLinkedScenes((prev) => {
                                const current = prev[beat.id] ?? [];
                                if (current.includes(val)) return prev;
                                return { ...prev, [beat.id]: [...current, val] };
                              });
                            }}
                            className="w-full bg-surface-800/60 border border-surface-700/60 rounded-lg px-3 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-teal-500/60"
                          >
                            <option value="">+ Link a scene…</option>
                            {projectScenes
                              .filter((s) => !(beatLinkedScenes[beat.id] ?? []).includes(s.id))
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.scene_number ? `S${s.scene_number} — ` : ''}{s.scene_heading ?? 'Untitled Scene'}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    )}

                    {canEdit && (
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => { save(); setActiveNote(null); }}
                          className="text-xs text-[#FF5F1F] hover:text-[#FF8F5F] transition-colors"
                        >
                          Save & close ↵
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && filledCount === beats.length && (
        <div className="mt-8 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-green-400 font-medium text-sm">All beats filled — your story structure is complete!</p>
        </div>
      )}

      {/* ── Custom Framework Builder Modal ──────────────────── */}
      <Modal
        isOpen={showCustomBuilder}
        onClose={() => setShowCustomBuilder(false)}
        title="Create Custom Framework"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Framework Name"
            placeholder="e.g. Dan Harmon's Story Circle"
            value={customBuilderName}
            onChange={(e) => setCustomBuilderName(e.target.value)}
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Beats</p>
              <Button onClick={addBuilderBeat} variant="ghost" size="sm">+ Add Beat</Button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {customBuilderBeats.map((beat, idx) => (
                <div
                  key={beat.id}
                  draggable
                  onDragStart={() => handleBuilderDragStart(idx)}
                  onDragOver={(e) => handleBuilderDragOver(e, idx)}
                  onDragEnd={handleBuilderDragEnd}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border border-surface-800/60 bg-surface-800/30',
                    draggedBeatIdx === idx && 'opacity-40',
                  )}
                >
                  <div className="text-surface-600 hover:text-surface-400 cursor-grab shrink-0" title="Drag to reorder">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>

                  <input
                    type="color"
                    value={beat.color}
                    onChange={(e) => updateBuilderBeat(idx, { color: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer shrink-0 bg-transparent border-none"
                  />

                  <input
                    type="text"
                    value={beat.label}
                    onChange={(e) => updateBuilderBeat(idx, { label: e.target.value })}
                    placeholder="Beat name"
                    className="flex-1 min-w-0 bg-surface-700/40 border border-surface-700/60 rounded px-2 py-1 text-xs text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/60"
                  />

                  <input
                    type="number"
                    value={beat.pagePercent}
                    onChange={(e) => {
                      const pct = Math.min(100, Math.max(0, Number(e.target.value)));
                      updateBuilderBeat(idx, {
                        pagePercent: pct,
                        pageHint: `p. ${Math.round((pct / 100) * totalPages)}`,
                      });
                    }}
                    className="w-16 bg-surface-700/40 border border-surface-700/60 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-[#FF5F1F]/60"
                    min={0}
                    max={100}
                    title="Page %"
                  />

                  <span className="text-[10px] text-surface-500 shrink-0 w-8">%</span>

                  <button
                    onClick={() => removeBuilderBeat(idx)}
                    className="text-surface-600 hover:text-red-400 transition-colors shrink-0 p-1"
                    title="Remove beat"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-800">
            <Button variant="ghost" onClick={() => setShowCustomBuilder(false)}>Cancel</Button>
            <Button onClick={saveCustomFramework}>Save Framework</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
