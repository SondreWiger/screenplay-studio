'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Card, Button, Badge, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

// ============================================================
// Beat Sheet — Story structure planning tool
// Supports Save the Cat (15 beats), Three-Act, Hero's Journey
// Stored in projects.content_metadata.beat_sheet
// ============================================================

type Framework = 'save_the_cat' | 'three_act' | 'hero_journey';

interface Beat {
  id: string;
  label: string;
  description: string;
  pageHint: string;   // e.g. "p. 1" or "p. 25-30"
  pagePercent: number; // 0-100, position in script
  color: string;
  notes: string;
  scenes: string[];    // associated scene IDs
}

interface BeatSheetData {
  framework: Framework;
  totalPages: number;
  beats: Record<string, { notes: string; scenes: string[]; customPage?: number; linkedSceneIds?: string[] }>;
}

interface SceneRef {
  id: string;
  scene_number: string | null;
  scene_heading: string | null;
  title: string | null;
}

// ── Framework definitions ─────────────────────────────────────
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

const FRAMEWORKS: Record<Framework, { label: string; beats: Beat[] }> = {
  save_the_cat:  { label: 'Save the Cat',     beats: SAVE_THE_CAT },
  three_act:     { label: 'Three-Act',        beats: THREE_ACT },
  hero_journey:  { label: "Hero's Journey",   beats: HERO_JOURNEY },
};

export default function BeatSheetPage({ params }: { params: { id: string } }) {
  const { user }               = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole        = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit                = currentUserRole !== 'viewer';

  const [framework, setFramework] = useState<Framework>('save_the_cat');
  const [beatNotes, setBeatNotes] = useState<Record<string, string>>({});
  const [totalPages, setTotalPages] = useState(110);
  const [saving, setSaving]    = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [loading, setLoading]  = useState(true);
  const [projectScenes, setProjectScenes] = useState<SceneRef[]>([]);
  const [beatLinkedScenes, setBeatLinkedScenes] = useState<Record<string, string[]>>({});
  const [scenePicker, setScenePicker] = useState<string | null>(null); // beatId being edited for scene linking

  // Load saved data
  useEffect(() => {
    const load = async () => {
      if (!params.id) return;
      const supabase = createClient();
      const [projectRes, scenesRes] = await Promise.all([
        supabase.from('projects').select('content_metadata').eq('id', params.id).single(),
        supabase.from('scenes').select('id,scene_number,scene_heading,title')
          .eq('project_id', params.id).order('sort_order', { ascending: true }),
      ]);
      setProjectScenes((scenesRes.data as SceneRef[]) ?? []);
      if (projectRes.data?.content_metadata?.beat_sheet) {
        const saved = projectRes.data.content_metadata.beat_sheet as BeatSheetData;
        if (saved.framework) setFramework(saved.framework);
        if (saved.totalPages) setTotalPages(saved.totalPages);
        if (saved.beats) {
          const notes: Record<string, string> = {};
          const linked: Record<string, string[]> = {};
          Object.entries(saved.beats).forEach(([id, d]) => {
            notes[id] = d.notes;
            if (d.linkedSceneIds?.length) linked[id] = d.linkedSceneIds;
          });
          setBeatNotes(notes);
          setBeatLinkedScenes(linked);
        }
      }
      setLoading(false);
    };
    load();
  }, [params.id]);

  const save = useCallback(async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const supabase = createClient();
      // Read existing content_metadata first to avoid overwriting other keys
      const { data: cur } = await supabase
        .from('projects')
        .select('content_metadata')
        .eq('id', params.id)
        .single();
      const existing = cur?.content_metadata ?? {};
      const beatSheetData: BeatSheetData = {
        framework,
        totalPages,
        beats: Object.fromEntries(
          Object.entries(beatNotes).map(([id, notes]) => [
            id,
            { notes, scenes: [], linkedSceneIds: beatLinkedScenes[id] ?? [] },
          ]),
        ),
      };
      await supabase
        .from('projects')
        .update({ content_metadata: { ...existing, beat_sheet: beatSheetData } })
        .eq('id', params.id);
      toast.success('Beat sheet saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }, [canEdit, framework, totalPages, beatNotes, beatLinkedScenes, params.id]);

  const beats     = FRAMEWORKS[framework].beats;
  const filledCount = beats.filter((b) => beatNotes[b.id]?.trim()).length;

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Beat Sheet</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {filledCount}/{beats.length} beats filled · {framework === 'save_the_cat' ? '15 beats' : framework === 'three_act' ? '9 beats' : '12 beats'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Framework switcher */}
          <div className="flex items-center gap-0.5 bg-surface-800/60 rounded-lg p-0.5">
            {(Object.entries(FRAMEWORKS) as [Framework, { label: string }][]).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => setFramework(key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  framework === key ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white',
                )}
              >
                {label}
              </button>
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

      {/* Progress bar */}
      <div className="mb-8">
        <div className="relative h-8 bg-surface-800 rounded-xl overflow-hidden border border-surface-700/40">
          {beats.map((beat) => {
            const hasNote = !!beatNotes[beat.id]?.trim();
            return (
              <div
                key={beat.id}
                className={cn(
                  'absolute top-0 h-full flex items-center justify-center transition-all',
                  hasNote ? 'opacity-90' : 'opacity-30',
                  activeNote === beat.id && 'opacity-100 z-10',
                )}
                style={{
                  left:   `${beat.pagePercent}%`,
                  width:  '2px',
                  backgroundColor: beat.color,
                  transform: 'translateX(-50%)',
                }}
                title={beat.label}
              />
            );
          })}
          {/* Page scale labels */}
          <div className="absolute inset-0 flex items-center px-2">
            {[0, 25, 50, 75, 100].map((pct) => (
              <div key={pct} className="absolute text-[9px] text-surface-600" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
                {Math.round((pct / 100) * totalPages)}p
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-surface-600 mt-1">
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
          {beats.map((beat) => {
            const hasNote = !!beatNotes[beat.id]?.trim();
            const isActive = activeNote === beat.id;
            const page = Math.round((beat.pagePercent / 100) * totalPages);
            return (
              <div
                key={beat.id}
                className={cn(
                  'rounded-xl border transition-all duration-150',
                  isActive
                    ? 'border-[#FF5F1F]/50 bg-surface-800/80'
                    : hasNote
                    ? 'border-surface-700/60 bg-surface-800/40'
                    : 'border-surface-800/60 bg-surface-800/20',
                )}
              >
                <div
                  className="flex items-start gap-4 p-4 cursor-pointer"
                  onClick={() => setActiveNote(isActive ? null : beat.id)}
                >
                  {/* Color dot + page */}
                  <div className="flex flex-col items-center gap-1 shrink-0 w-10 text-center">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: beat.color }} />
                    <span className="text-[9px] text-surface-600 font-mono">p.{page}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-white">{beat.label}</h3>
                      <span className="text-[10px] text-surface-600 font-mono shrink-0">{beat.pageHint}</span>
                      {hasNote && (
                        <Badge size="sm" variant="success">✓</Badge>
                      )}
                    </div>
                    <p className="text-xs text-surface-400">{beat.description}</p>
                    {hasNote && !isActive && (
                      <p className="text-xs text-surface-300 mt-1.5 italic line-clamp-2">"{beatNotes[beat.id]}"</p>
                    )}
                    {/* Linked scene chips (collapsed) */}
                    {!isActive && (beatLinkedScenes[beat.id]?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {beatLinkedScenes[beat.id].map((sid) => {
                          const sc = projectScenes.find((s) => s.id === sid);
                          if (!sc) return null;
                          const label = sc.scene_number ? `S${sc.scene_number}` : sc.scene_heading ?? sc.title ?? 'Scene';
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
                            const label = sc.scene_number ? `S${sc.scene_number}` : sc.scene_heading ?? sc.title ?? 'Scene';
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
                                  {s.scene_number ? `S${s.scene_number} — ` : ''}{s.scene_heading ?? s.title ?? 'Untitled Scene'}
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
          <p className="text-green-400 font-medium text-sm">🎉 All beats filled — your story structure is complete!</p>
        </div>
      )}
    </div>
  );
}
