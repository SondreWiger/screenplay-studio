'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Project, Profile } from '@/lib/types';

// ============================================================
// Deep Dive — Script Viewer  (fully redesigned)
// Dark-mode cinema-grade read-only viewer with:
//   - Scene navigation sidebar
//   - Script statistics panel
//   - Character index with line counts
//   - Reading progress indicator
//   - Keyboard navigation (j/k scenes, t toggle sidebar)
//   - Adjustable font size & display options
// ============================================================

type ScriptElementType =
  | 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical'
  | 'transition' | 'shot' | 'note' | 'page_break' | 'title_page'
  | 'centered' | 'lyrics' | 'synopsis' | 'section';

interface ScriptElement {
  id: string;
  script_id: string;
  element_type: ScriptElementType;
  content: string;
  sort_order: number;
  scene_number: string | null;
  revision_color: string | null;
  is_revised: boolean;
  is_omitted: boolean;
  metadata: Record<string, unknown>;
}

interface Script {
  id: string;
  project_id: string;
  title: string;
  version: number;
  title_page_data: {
    title?: string;
    credit?: string;
    author?: string;
    source?: string;
    draft_date?: string;
    contact?: string;
    copyright?: string;
  } | null;
}

// ── Colours ─────────────────────────────────────────────────
const CHARACTER_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#14b8a6', '#e11d48',
  '#0ea5e9', '#a855f7', '#22c55e', '#e879f9',
];

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return CHARACTER_COLORS[Math.abs(h) % CHARACTER_COLORS.length];
}

// ── Scene info ──────────────────────────────────────────────
interface SceneInfo {
  id: string;
  number: string;
  heading: string;
  elementIndex: number;
  lineCount: number;
  setting: string;
  location: string;
  timeOfDay: string;
}

// ── Tabs ────────────────────────────────────────────────────
type SidebarTab = 'scenes' | 'characters' | 'stats';

export default function DeepDiveScriptPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<(Project & { author?: Profile }) | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [elements, setElements] = useState<ScriptElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Display options
  const [showSceneNumbers, setShowSceneNumbers] = useState(true);
  const [showCharacterColors, setShowCharacterColors] = useState(true);
  const [fontSize, setFontSize] = useState(12);
  const [darkScript, setDarkScript] = useState(false);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('scenes');
  const [sceneFilter, setSceneFilter] = useState('');
  const [charFilter, setCharFilter] = useState('');

  // Reading progress
  const [progress, setProgress] = useState(0);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const scriptRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── Fetch data ──────────────────────────────────────────
  useEffect(() => { if (params.id) fetchData(); }, [params.id]);

  const fetchData = async () => {
    const supabase = createClient();
    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .select('*, author:profiles!created_by(*)')
      .eq('id', params.id)
      .eq('is_showcased', true)
      .single();

    if (projErr || !proj) { setError('This project is not available for viewing.'); setLoading(false); return; }
    if (!proj.showcase_script) { setError('The script is not available for this production.'); setLoading(false); return; }
    setProject(proj);

    const { data: scripts } = await supabase
      .from('scripts').select('*').eq('project_id', params.id)
      .order('version', { ascending: false }).limit(1);
    if (!scripts?.length) { setError('No script found for this production.'); setLoading(false); return; }
    setScript(scripts[0]);

    const { data: elems } = await supabase
      .from('script_elements').select('*').eq('script_id', scripts[0].id)
      .order('sort_order');
    setElements(elems || []);
    setLoading(false);
  };

  // ── Derived data ────────────────────────────────────────
  const scenes = useMemo<SceneInfo[]>(() => {
    const result: SceneInfo[] = [];
    let counter = 0;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.element_type !== 'scene_heading') continue;
      counter++;
      const num = el.scene_number || counter.toString();
      const heading = el.content.trim();
      const match = heading.match(/^(INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E\.?)\s+(.+?)(?:\s*[-\u2013\u2014]\s*(.+))?$/i);
      let lineCount = 0;
      for (let j = i + 1; j < elements.length; j++) {
        if (elements[j].element_type === 'scene_heading') break;
        lineCount++;
      }
      result.push({
        id: el.id,
        number: num,
        heading,
        elementIndex: i,
        lineCount,
        setting: match?.[1]?.toUpperCase() || '',
        location: match?.[2]?.trim() || heading,
        timeOfDay: match?.[3]?.trim() || '',
      });
    }
    return result;
  }, [elements]);

  const sceneNumberMap = useMemo(() => {
    const m = new Map<string, string>();
    scenes.forEach((s) => m.set(s.id, s.number));
    return m;
  }, [scenes]);

  // Character stats
  interface CharStat { name: string; lineCount: number; dialogueWords: number; color: string; firstAppearance: number }
  const characterStats = useMemo<CharStat[]>(() => {
    const map = new Map<string, { lines: number; words: number; first: number }>();
    let currentChar = '';
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.element_type === 'character') {
        currentChar = el.content.replace(/\s*\(.*?\)\s*$/, '').trim().toUpperCase();
        if (!map.has(currentChar)) map.set(currentChar, { lines: 0, words: 0, first: i });
      } else if ((el.element_type === 'dialogue' || el.element_type === 'parenthetical') && currentChar) {
        const entry = map.get(currentChar)!;
        entry.lines++;
        entry.words += el.content.split(/\s+/).filter(Boolean).length;
      } else if (el.element_type !== 'parenthetical') {
        currentChar = '';
      }
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, lineCount: d.lines, dialogueWords: d.words, color: hashColor(name), firstAppearance: d.first }))
      .sort((a, b) => b.dialogueWords - a.dialogueWords);
  }, [elements]);

  const elementCharacterMap = useMemo(() => {
    const m = new Map<string, string>();
    let cur = '';
    for (const el of elements) {
      if (el.element_type === 'character') { cur = el.content.replace(/\s*\(.*?\)\s*$/, '').trim().toUpperCase(); m.set(el.id, cur); }
      else if (el.element_type === 'dialogue' || el.element_type === 'parenthetical') { if (cur) m.set(el.id, cur); }
      else cur = '';
    }
    return m;
  }, [elements]);

  // Stats
  const stats = useMemo(() => {
    const totalWords = elements.reduce((n, el) => n + el.content.split(/\s+/).filter(Boolean).length, 0);
    const dialogueElements = elements.filter(e => e.element_type === 'dialogue');
    const actionElements = elements.filter(e => e.element_type === 'action');
    const dialogueWords = dialogueElements.reduce((n, el) => n + el.content.split(/\s+/).filter(Boolean).length, 0);
    const actionWords = actionElements.reduce((n, el) => n + el.content.split(/\s+/).filter(Boolean).length, 0);
    const pageEstimate = Math.ceil(elements.filter(e => e.element_type !== 'title_page').length / 55);
    const intScenes = scenes.filter(s => s.setting.startsWith('INT')).length;
    const extScenes = scenes.filter(s => s.setting.startsWith('EXT')).length;
    const avgSceneLength = scenes.length ? Math.round(scenes.reduce((n, s) => n + s.lineCount, 0) / scenes.length) : 0;
    const longestScene = scenes.length ? scenes.reduce((a, b) => a.lineCount > b.lineCount ? a : b) : null;
    const readingTimeMin = Math.ceil(totalWords / 200);
    return { totalWords, dialogueWords, actionWords, pageEstimate, intScenes, extScenes, avgSceneLength, longestScene, readingTimeMin, dialoguePct: totalWords ? Math.round(dialogueWords / totalWords * 100) : 0 };
  }, [elements, scenes]);

  // ── Progress & active scene tracking ────────────────────
  useEffect(() => {
    const container = scriptRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setProgress(scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) * 100 : 0);
      let active: string | null = null;
      for (const scene of scenes) {
        const el = sceneRefs.current.get(scene.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          if (rect.top <= containerRect.top + 200) active = scene.id;
        }
      }
      if (active) setActiveSceneId(active);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [scenes]);

  // ── Keyboard shortcuts ──────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 't') setSidebarOpen(p => !p);
      if (e.key === 'j' || e.key === 'k') {
        const idx = scenes.findIndex(s => s.id === activeSceneId);
        const next = e.key === 'j' ? Math.min(idx + 1, scenes.length - 1) : Math.max(idx - 1, 0);
        if (scenes[next]) scrollToScene(scenes[next].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scenes, activeSceneId]);

  const scrollToScene = useCallback((id: string) => {
    const el = sceneRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const setSceneRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) sceneRefs.current.set(id, el);
    else sceneRefs.current.delete(id);
  }, []);

  // ── Filtered lists ──────────────────────────────────────
  const filteredScenes = useMemo(() => {
    if (!sceneFilter) return scenes;
    const q = sceneFilter.toLowerCase();
    return scenes.filter(s => s.heading.toLowerCase().includes(q) || s.number.includes(q));
  }, [scenes, sceneFilter]);

  const filteredChars = useMemo(() => {
    if (!charFilter) return characterStats;
    const q = charFilter.toLowerCase();
    return characterStats.filter(c => c.name.toLowerCase().includes(q));
  }, [characterStats, charFilter]);

  // ── Loading / Error ─────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-amber-500" />
          <p className="text-sm text-white/50 animate-pulse">Loading script&hellip;</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">{'\u{1F4DC}'}</div>
        <h1 className="text-2xl font-black">Script Unavailable</h1>
        <p className="text-white/40 text-sm max-w-md text-center">{error || 'Something went wrong.'}</p>
        <Link href={`/community/showcase/${params.id}`} className="mt-4 px-5 py-2.5 text-sm font-medium text-black bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors">
          Back to Project
        </Link>
      </div>
    );
  }

  const titlePage = script?.title_page_data;
  const hasTitlePage = titlePage && (titlePage.title || titlePage.author);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col">
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-black/40">
        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>

      {/* Top nav */}
      <nav className="sticky top-0 z-40 bg-[#0a0a0c]/95 backdrop-blur-lg border-b border-white/[0.06]">
        <div className="max-w-[1800px] mx-auto px-4 flex items-center justify-between h-12">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/community/showcase/${params.id}`} className="flex items-center gap-2 text-white/50 hover:text-white transition shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{script?.title || project.title}</p>
              <p className="text-[10px] text-white/50 truncate">
                by {project.author?.full_name || 'Unknown'} &middot; {scenes.length} scenes &middot; ~{stats.pageEstimate} pages &middot; ~{stats.readingTimeMin} min read
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-md border transition-colors ${sidebarOpen ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'border-white/10 text-white/40 hover:text-white/60'}`} title="Toggle sidebar (T)">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg>
            </button>
            <div className="w-px h-5 bg-surface-900/10 mx-1" />
            <button onClick={() => setDarkScript(!darkScript)} className={`px-2.5 py-1.5 text-[11px] rounded-md border transition-colors ${darkScript ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'border-white/10 text-white/40 hover:text-white/60'}`} title="Dark script mode">
              {darkScript ? '\u{1F319}' : '\u2600\uFE0F'}
            </button>
            <button onClick={() => setShowSceneNumbers(!showSceneNumbers)} className={`px-2.5 py-1.5 text-[11px] rounded-md border transition-colors ${showSceneNumbers ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'border-white/10 text-white/40 hover:text-white/60'}`} title="Scene numbers">
              #
            </button>
            <button onClick={() => setShowCharacterColors(!showCharacterColors)} className={`px-2.5 py-1.5 text-[11px] rounded-md border transition-colors ${showCharacterColors ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'border-white/10 text-white/40 hover:text-white/60'}`} title="Character colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
            </button>
            <div className="flex items-center gap-0.5 ml-1">
              <button onClick={() => setFontSize(Math.max(9, fontSize - 1))} className="px-1.5 py-1 text-[10px] text-white/40 hover:text-white rounded border border-white/10 transition">A&minus;</button>
              <span className="text-[10px] text-white/25 w-5 text-center tabular-nums">{fontSize}</span>
              <button onClick={() => setFontSize(Math.min(18, fontSize + 1))} className="px-1.5 py-1 text-[10px] text-white/40 hover:text-white rounded border border-white/10 transition">A+</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-72 xl:w-80 shrink-0 border-r border-white/[0.06] bg-[#0c0c0e] flex flex-col overflow-hidden">
            <div className="flex border-b border-white/[0.06]">
              {(['scenes', 'characters', 'stats'] as SidebarTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-2.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                    sidebarTab === tab ? 'text-amber-400 border-b-2 border-amber-500' : 'text-white/50 hover:text-white/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {sidebarTab === 'scenes' && (
                <div className="p-3">
                  <input
                    type="text"
                    placeholder="Search scenes\u2026"
                    value={sceneFilter}
                    onChange={(e) => setSceneFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-900/5 border border-white/10 rounded-lg text-white placeholder-white/20 outline-none focus:border-amber-500/40 mb-3"
                  />
                  <div className="space-y-0.5">
                    {filteredScenes.map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => scrollToScene(scene.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition group ${
                          activeSceneId === scene.id ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-surface-900/5 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold tabular-nums shrink-0 w-6 text-center rounded ${
                            activeSceneId === scene.id ? 'text-amber-400' : 'text-white/25'
                          }`}>{scene.number}</span>
                          <span className={`text-xs truncate ${activeSceneId === scene.id ? 'text-white' : 'text-white/50 group-hover:text-white/70'}`}>
                            {scene.location || scene.heading}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 ml-8">
                          {scene.setting && (
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                              scene.setting.startsWith('INT') ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'
                            }`}>{scene.setting}</span>
                          )}
                          {scene.timeOfDay && (
                            <span className="text-[9px] text-white/20">{scene.timeOfDay}</span>
                          )}
                          <span className="text-[9px] text-white/15 ml-auto">{scene.lineCount} lines</span>
                        </div>
                      </button>
                    ))}
                    {filteredScenes.length === 0 && (
                      <p className="text-xs text-white/20 text-center py-4">No scenes match</p>
                    )}
                  </div>
                </div>
              )}

              {sidebarTab === 'characters' && (
                <div className="p-3">
                  <input
                    type="text"
                    placeholder="Search characters\u2026"
                    value={charFilter}
                    onChange={(e) => setCharFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-900/5 border border-white/10 rounded-lg text-white placeholder-white/20 outline-none focus:border-amber-500/40 mb-3"
                  />
                  <div className="space-y-1">
                    {filteredChars.map((char, i) => (
                      <div key={char.name} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-900/5 transition group">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: char.color + '20', color: char.color }}>
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white/70 group-hover:text-white/90 truncate">{char.name}</p>
                          <p className="text-[10px] text-white/25">{char.lineCount} lines &middot; {char.dialogueWords} words</p>
                        </div>
                        <div className="w-16 h-1.5 bg-surface-900/5 rounded-full overflow-hidden shrink-0">
                          <div className="h-full rounded-full" style={{
                            backgroundColor: char.color,
                            width: `${Math.min(100, characterStats.length ? char.dialogueWords / characterStats[0].dialogueWords * 100 : 0)}%`
                          }} />
                        </div>
                      </div>
                    ))}
                    {filteredChars.length === 0 && (
                      <p className="text-xs text-white/20 text-center py-4">No characters match</p>
                    )}
                  </div>
                </div>
              )}

              {sidebarTab === 'stats' && (
                <div className="p-4 space-y-5">
                  {/* Overview numbers */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Pages (est.)', value: `~${stats.pageEstimate}` },
                      { label: 'Scenes', value: scenes.length },
                      { label: 'Characters', value: characterStats.length },
                      { label: 'Total Words', value: stats.totalWords.toLocaleString() },
                      { label: 'Reading Time', value: `~${stats.readingTimeMin} min` },
                      { label: 'Script Version', value: `v${script?.version || 1}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-surface-900/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5">
                        <p className="text-[10px] text-white/25 uppercase tracking-wider">{label}</p>
                        <p className="text-lg font-bold text-white/80 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Dialogue vs Action ratio */}
                  <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Dialogue vs Action</p>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-3 bg-surface-900/5 rounded-full overflow-hidden flex">
                        <div className="h-full bg-amber-500/60" style={{ width: `${stats.dialoguePct}%` }} />
                        <div className="h-full bg-blue-500/40" style={{ width: `${100 - stats.dialoguePct}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-amber-400/70">{stats.dialoguePct}% Dialogue ({stats.dialogueWords.toLocaleString()}w)</span>
                      <span className="text-blue-400/70">{100 - stats.dialoguePct}% Action ({stats.actionWords.toLocaleString()}w)</span>
                    </div>
                  </div>

                  {/* Scene breakdown */}
                  <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Scenes</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-400/70">{'\u{1F3E0}'} Interior</span>
                        <span className="text-xs font-medium text-white/60">{stats.intScenes}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-400/70">{'\u{1F332}'} Exterior</span>
                        <span className="text-xs font-medium text-white/60">{stats.extScenes}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/50">{'\u{1F4CF}'} Avg length</span>
                        <span className="text-xs font-medium text-white/60">{stats.avgSceneLength} elements</span>
                      </div>
                      {stats.longestScene && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/50">{'\u{1F4D0}'} Longest</span>
                          <button onClick={() => scrollToScene(stats.longestScene!.id)} className="text-xs text-amber-400/70 hover:text-amber-300 transition truncate max-w-[140px]">
                            #{stats.longestScene.number} ({stats.longestScene.lineCount})
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top 5 characters */}
                  <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Top Characters</p>
                    <div className="space-y-2">
                      {characterStats.slice(0, 5).map((c, i) => (
                        <div key={c.name} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold w-4 text-center" style={{ color: c.color }}>{i + 1}</span>
                          <span className="text-xs text-white/60 flex-1 truncate">{c.name}</span>
                          <span className="text-[10px] text-white/25 tabular-nums">{c.dialogueWords}w</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Keyboard shortcuts */}
                  <div className="bg-surface-900/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Keyboard</p>
                    <div className="space-y-1.5">
                      {[
                        { key: 'T', desc: 'Toggle sidebar' },
                        { key: 'J', desc: 'Next scene' },
                        { key: 'K', desc: 'Previous scene' },
                      ].map(({ key, desc }) => (
                        <div key={key} className="flex items-center gap-2">
                          <kbd className="text-[10px] font-mono bg-surface-900/10 text-white/50 px-1.5 py-0.5 rounded">{key}</kbd>
                          <span className="text-[10px] text-white/50">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Script content */}
        <main ref={scriptRef} className="flex-1 overflow-y-auto scroll-smooth" style={{ scrollBehavior: 'smooth' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
            {/* Script header card */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 rounded-full border border-amber-500/20">
                  Deep Dive
                </span>
                <span className="text-[10px] text-white/20 uppercase tracking-widest">Read-Only</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight">{script?.title || project.title}</h1>
              <p className="text-sm text-white/40 mt-1">
                Written by {project.author?.full_name || 'Unknown'}
              </p>
            </div>

            {/* The script "paper" */}
            <div
              className={`rounded-xl shadow-2xl mx-auto transition-colors duration-300 ${
                darkScript
                  ? 'bg-[#141418] text-[#c8c8cc] shadow-black/60 border border-white/[0.06]'
                  : 'bg-surface-900 text-black shadow-black/40'
              }`}
              style={{
                fontFamily: "'Courier Prime', 'Courier New', monospace",
                fontSize: `${fontSize}pt`,
                lineHeight: '1.5',
                maxWidth: '8.5in',
                padding: '0.8in 0.8in 0.8in 1.2in',
              }}
            >
              {/* Title page */}
              {hasTitlePage && (
                <div className={`flex flex-col items-center justify-center mb-12 pb-8 border-b ${darkScript ? 'border-white/10' : 'border-white/10'}`} style={{ minHeight: '300px' }}>
                  <div className="text-center space-y-2">
                    {titlePage.title && <h2 className="text-2xl font-black uppercase">{titlePage.title}</h2>}
                    {titlePage.credit && <p className="text-sm">{titlePage.credit}</p>}
                    {titlePage.author && <p className="text-base">{titlePage.author}</p>}
                    {titlePage.source && <p className={`text-sm italic ${darkScript ? 'text-white/40' : ''}`}>{titlePage.source}</p>}
                  </div>
                  <div className={`mt-auto pt-8 self-start text-left text-xs space-y-1 ${darkScript ? 'text-white/50' : ''}`}>
                    {titlePage.draft_date && <p>{titlePage.draft_date}</p>}
                    {titlePage.contact && <p className="whitespace-pre-line">{titlePage.contact}</p>}
                    {titlePage.copyright && <p>{titlePage.copyright}</p>}
                  </div>
                </div>
              )}

              {/* Elements */}
              {elements.filter(el => el.element_type !== 'title_page').map((el) => {
                if (el.element_type === 'page_break') {
                  return <div key={el.id} className={`border-t border-dashed my-6 ${darkScript ? 'border-white/10' : 'border-white/15'}`} />;
                }

                const isScene = el.element_type === 'scene_heading';
                const sceneNum = sceneNumberMap.get(el.id);
                const charName = elementCharacterMap.get(el.id);
                const charColor = charName && showCharacterColors ? hashColor(charName) : undefined;
                const isOmitted = el.is_omitted;

                return (
                  <div
                    key={el.id}
                    ref={isScene ? (ref) => setSceneRef(el.id, ref) : undefined}
                    className={`relative ${isOmitted ? 'opacity-30 line-through' : ''} ${isScene ? 'scroll-mt-16' : ''}`}
                    style={charColor && !isScene ? { borderLeft: `3px solid ${charColor}`, paddingLeft: '8px', backgroundColor: darkScript ? `${charColor}08` : `${charColor}06` } : undefined}
                  >
                    {sceneNum && showSceneNumbers && (
                      <span className={`absolute -left-14 top-0.5 text-[10px] font-bold select-none ${darkScript ? 'text-white/20' : 'text-gray-300'}`}>
                        {sceneNum}
                      </span>
                    )}
                    <div style={getElementStyle(el.element_type, darkScript)}>
                      {el.content}
                    </div>
                  </div>
                );
              })}

              {/* End of script marker */}
              <div className={`text-center mt-12 pt-6 border-t ${darkScript ? 'border-white/10 text-white/20' : 'border-white/10 text-gray-300'}`}>
                <p className="text-xs uppercase tracking-[0.3em]">End of Script</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t border-white/[0.04] py-6 px-6 mt-8">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <span className="text-[10px] text-white/20">Screenplay Studio &mdash; Deep Dive</span>
              <Link href={`/community/showcase/${params.id}`} className="text-[10px] text-white/50 hover:text-amber-400 transition-colors">
                Back to {project.title}
              </Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

// ── Element inline styles ───────────────────────────────────
function getElementStyle(type: ScriptElementType, dark: boolean): React.CSSProperties {
  const muted = dark ? '#666' : '#888';
  const subtle = dark ? '#555' : '#ccc';
  switch (type) {
    case 'scene_heading':
      return { fontWeight: 'bold', textTransform: 'uppercase', marginTop: '1.4em', marginBottom: '0.4em', paddingBottom: '0.2em', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` };
    case 'action':
      return { marginBottom: '0.6em' };
    case 'character':
      return { textTransform: 'uppercase', marginLeft: '2.2in', marginTop: '0.6em', marginBottom: '0', fontWeight: 600 };
    case 'dialogue':
      return { marginLeft: '1in', marginRight: '1.5in', marginBottom: '0.4em' };
    case 'parenthetical':
      return { marginLeft: '1.6in', marginRight: '2in', marginBottom: '0', fontStyle: 'italic', color: muted };
    case 'transition':
      return { textAlign: 'right', textTransform: 'uppercase', marginTop: '0.6em', marginBottom: '0.6em', fontWeight: 600, letterSpacing: '0.05em' };
    case 'centered':
    case 'lyrics':
      return { textAlign: 'center', marginBottom: '0.4em' };
    case 'note':
      return { fontStyle: 'italic', color: muted, borderLeft: `2px solid ${subtle}`, paddingLeft: '0.5em', marginBottom: '0.4em' };
    case 'synopsis':
      return { fontStyle: 'italic', color: muted, marginBottom: '0.6em' };
    case 'section':
      return { fontWeight: 'bold', fontSize: '1.1em', marginTop: '1.5em', marginBottom: '0.5em', textTransform: 'uppercase', letterSpacing: '0.05em' };
    case 'shot':
      return { fontWeight: 'bold', textTransform: 'uppercase', marginTop: '0.6em', marginBottom: '0.3em' };
    default:
      return { marginBottom: '0.4em' };
  }
}
