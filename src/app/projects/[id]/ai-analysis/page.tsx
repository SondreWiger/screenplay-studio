'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, LoadingPage, EmptyState } from '@/components/ui';

// ============================================================
// Script Analysis — Pro Feature
// Real computational analysis of actual script content
// ============================================================

type ScriptElement = {
  id: string;
  script_id: string;
  element_type: 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'general' | 'shot';
  content: string;
  scene_id: string | null;
  sort_order: number;
  duration_estimate: number | null;
  character_name: string | null;
};

type Scene = {
  id: string;
  project_id: string;
  scene_number: number | null;
  scene_heading: string | null;
  location_type: 'INT' | 'EXT' | 'INT/EXT' | null;
  time_of_day: string | null;
  cast_ids: string[] | null;
  page_count: number | null;
  estimated_duration_minutes: number | null;
  is_completed: boolean;
};

type Character = {
  id: string;
  project_id: string;
  name: string;
  is_main: boolean;
  cast_actor: string | null;
};

type Shot = {
  id: string;
  project_id: string;
  scene_id: string | null;
  is_completed: boolean;
};

// ---- Analysis result types ----

type OverviewStats = {
  totalWords: number;
  totalPages: number;
  estimatedRuntime: number;
  totalScenes: number;
  totalCharacters: number;
  totalElements: number;
  dialogueWords: number;
  actionWords: number;
  dialogueRatio: number;
};

type CharacterDialogue = {
  name: string;
  wordCount: number;
  lineCount: number;
  avgWordsPerLine: number;
  sceneCount: number;
  firstScene: number;
};

type SceneAnalysis = {
  id: string;
  heading: string;
  sceneNumber: number;
  wordCount: number;
  dialogueWords: number;
  actionWords: number;
  dialogueDensity: number;
  speakingCharacters: number;
  pageCount: number;
  locationType: string;
  timeOfDay: string;
};

type PacingBucket = { label: string; count: number; scenes: string[] };

type LocationFreq = { location: string; count: number };

type FullAnalysis = {
  overview: OverviewStats;
  characterDialogues: CharacterDialogue[];
  sceneAnalyses: SceneAnalysis[];
  intExtRatio: { interior: number; exterior: number; intExt: number };
  dayNightRatio: { day: number; night: number; other: number };
  pacingBuckets: PacingBucket[];
  locationFrequencies: LocationFreq[];
  productionStats: {
    scenesCompleted: number;
    scenesTotal: number;
    shotsCompleted: number;
    shotsTotal: number;
    castCoverage: number;
    castTotal: number;
  };
};

// ---- Utility helpers ----

function wc(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractLocation(heading: string | null | undefined): string {
  if (!heading) return 'UNKNOWN';
  const match = heading.match(/(?:INT\.|EXT\.|INT\/EXT\.?)\s*(.+?)(?:\s*[-–—]\s*.+)?$/i);
  return match ? match[1].trim().toUpperCase() : heading.toUpperCase();
}

function computeAnalysis(
  elements: ScriptElement[],
  scenes: Scene[],
  characters: Character[],
  shots: Shot[]
): FullAnalysis {
  // ---- Overview ----
  let totalWords = 0;
  let dialogueWords = 0;
  let actionWords = 0;

  for (const el of elements) {
    const w = wc(el.content);
    totalWords += w;
    if (el.element_type === 'dialogue' || el.element_type === 'parenthetical') {
      dialogueWords += w;
    } else if (el.element_type === 'action') {
      actionWords += w;
    }
  }

  const totalPages = Math.max(totalWords / 250, 0.1);
  const estimatedRuntime = Math.round(totalPages);

  const overview: OverviewStats = {
    totalWords,
    totalPages: Math.round(totalPages * 10) / 10,
    estimatedRuntime,
    totalScenes: scenes.length,
    totalCharacters: characters.length,
    totalElements: elements.length,
    dialogueWords,
    actionWords,
    dialogueRatio: totalWords > 0 ? dialogueWords / totalWords : 0,
  };

  // ---- Character Dialogue Analysis ----
  const charMap = new Map<string, { wordCount: number; lineCount: number; scenes: Set<string>; firstSort: number }>();

  for (const el of elements) {
    if (el.element_type === 'dialogue' && el.character_name) {
      const name = el.character_name.trim().toUpperCase();
      if (!charMap.has(name)) {
        charMap.set(name, { wordCount: 0, lineCount: 0, scenes: new Set(), firstSort: el.sort_order });
      }
      const c = charMap.get(name)!;
      c.wordCount += wc(el.content);
      c.lineCount += 1;
      if (el.scene_id) c.scenes.add(el.scene_id);
      if (el.sort_order < c.firstSort) c.firstSort = el.sort_order;
    }
  }

  const sceneIdToNumber = new Map<string, number>();
  scenes.forEach((s, i) => sceneIdToNumber.set(s.id, s.scene_number ?? i + 1));

  const characterDialogues: CharacterDialogue[] = Array.from(charMap.entries())
    .map(([name, data]) => ({
      name,
      wordCount: data.wordCount,
      lineCount: data.lineCount,
      avgWordsPerLine: data.lineCount > 0 ? Math.round(data.wordCount / data.lineCount) : 0,
      sceneCount: data.scenes.size,
      firstScene: data.scenes.size > 0
        ? Math.min(...Array.from(data.scenes).map(sid => sceneIdToNumber.get(sid) ?? 999))
        : 999,
    }))
    .sort((a, b) => b.wordCount - a.wordCount);

  // ---- Scene Analysis ----
  const sceneElementMap = new Map<string, ScriptElement[]>();
  for (const el of elements) {
    if (el.scene_id) {
      if (!sceneElementMap.has(el.scene_id)) sceneElementMap.set(el.scene_id, []);
      sceneElementMap.get(el.scene_id)!.push(el);
    }
  }

  const sceneAnalyses: SceneAnalysis[] = scenes.map((scene, i) => {
    const els = sceneElementMap.get(scene.id) || [];
    let sceneWords = 0, sceneDlg = 0, sceneAct = 0;
    const speakingChars = new Set<string>();

    for (const el of els) {
      const w = wc(el.content);
      sceneWords += w;
      if (el.element_type === 'dialogue' || el.element_type === 'parenthetical') {
        sceneDlg += w;
        if (el.character_name) speakingChars.add(el.character_name.toUpperCase());
      } else if (el.element_type === 'action') {
        sceneAct += w;
      }
    }

    return {
      id: scene.id,
      heading: scene.scene_heading || `Scene ${scene.scene_number ?? i + 1}`,
      sceneNumber: scene.scene_number ?? i + 1,
      wordCount: sceneWords,
      dialogueWords: sceneDlg,
      actionWords: sceneAct,
      dialogueDensity: sceneWords > 0 ? sceneDlg / sceneWords : 0,
      speakingCharacters: speakingChars.size,
      pageCount: Math.round((sceneWords / 250) * 10) / 10,
      locationType: scene.location_type || 'UNKNOWN',
      timeOfDay: scene.time_of_day || 'UNKNOWN',
    };
  }).sort((a, b) => a.sceneNumber - b.sceneNumber);

  // ---- INT/EXT Ratio ----
  let interior = 0, exterior = 0, intExt = 0;
  for (const s of scenes) {
    if (s.location_type === 'INT') interior++;
    else if (s.location_type === 'EXT') exterior++;
    else if (s.location_type === 'INT/EXT') intExt++;
  }

  // ---- Day/Night Ratio ----
  let day = 0, night = 0, otherTime = 0;
  for (const s of scenes) {
    const tod = (s.time_of_day || '').toUpperCase();
    if (tod.includes('DAY') || tod.includes('MORNING') || tod.includes('AFTERNOON')) day++;
    else if (tod.includes('NIGHT') || tod.includes('EVENING') || tod.includes('DUSK') || tod.includes('DAWN')) night++;
    else otherTime++;
  }

  // ---- Pacing Buckets ----
  const shortScenes: string[] = [], mediumScenes: string[] = [], longScenes: string[] = [];
  for (const sa of sceneAnalyses) {
    if (sa.pageCount < 1) shortScenes.push(sa.heading);
    else if (sa.pageCount <= 3) mediumScenes.push(sa.heading);
    else longScenes.push(sa.heading);
  }

  const pacingBuckets: PacingBucket[] = [
    { label: 'Short (<1 page)', count: shortScenes.length, scenes: shortScenes },
    { label: 'Medium (1-3 pages)', count: mediumScenes.length, scenes: mediumScenes },
    { label: 'Long (3+ pages)', count: longScenes.length, scenes: longScenes },
  ];

  // ---- Location Frequencies ----
  const locMap = new Map<string, number>();
  for (const s of scenes) {
    const loc = extractLocation(s.scene_heading);
    locMap.set(loc, (locMap.get(loc) || 0) + 1);
  }
  const locationFrequencies: LocationFreq[] = Array.from(locMap.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count);

  // ---- Production Stats ----
  const scenesCompleted = scenes.filter(s => s.is_completed).length;
  const shotsCompleted = shots.filter(s => s.is_completed).length;
  const castCoverage = characters.filter(c => c.cast_actor).length;

  return {
    overview,
    characterDialogues,
    sceneAnalyses,
    intExtRatio: { interior, exterior, intExt },
    dayNightRatio: { day, night, other: otherTime },
    pacingBuckets,
    locationFrequencies,
    productionStats: {
      scenesCompleted,
      scenesTotal: scenes.length,
      shotsCompleted,
      shotsTotal: shots.length,
      castCoverage,
      castTotal: characters.length,
    },
  };
}

// ---- Visualization components ----

function HorizontalBar({ value, max, label, sublabel, color = 'bg-amber-500' }: {
  value: number; max: number; label: string; sublabel?: string; color?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-surface-300 truncate mr-2">{label}</span>
        <span className="text-surface-400 shrink-0">{sublabel ?? value}</span>
      </div>
      <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-surface-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-surface-500 mt-0.5">{sub}</p>}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </Card>
  );
}

function ProgressRing({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
          <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="currentColor" strokeWidth="3" className="text-surface-800" />
          <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="currentColor" strokeWidth="3" className={color}
            strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">{pct}%</span>
      </div>
      <div>
        <p className="text-sm text-white font-medium">{value}/{max}</p>
        <p className="text-xs text-surface-400">{label}</p>
      </div>
    </div>
  );
}

// ---- Tab types ----
type Tab = 'overview' | 'dialogue' | 'scenes' | 'pacing' | 'characters' | 'production';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'dialogue', label: 'Dialogue', icon: '💬' },
  { key: 'scenes', label: 'Scenes', icon: '🎬' },
  { key: 'pacing', label: 'Pacing', icon: '⚡' },
  { key: 'characters', label: 'Characters', icon: '👥' },
  { key: 'production', label: 'Production', icon: '🎯' },
];

// ============================================================
// Main page component
// ============================================================

export default function AIAnalysisPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuth();
  const { isPro } = useProFeatures();
  const { currentProject } = useProjectStore();
  const hasProAccess = isPro || currentProject?.pro_enabled === true;

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<FullAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [hasScript, setHasScript] = useState(true);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Get script for this project
    const { data: scripts } = await supabase
      .from('scripts')
      .select('id')
      .eq('project_id', projectId)
      .limit(1);

    if (!scripts?.length) {
      setHasScript(false);
      setLoading(false);
      return;
    }

    const scriptId = scripts[0].id;

    // 2. Fetch all data in parallel
    const [elemRes, sceneRes, charRes, shotRes] = await Promise.all([
      supabase.from('script_elements').select('*').eq('script_id', scriptId).order('sort_order'),
      supabase.from('scenes').select('*').eq('project_id', projectId).order('scene_number'),
      supabase.from('characters').select('*').eq('project_id', projectId).order('name'),
      supabase.from('shots').select('id, project_id, scene_id, is_completed').eq('project_id', projectId),
    ]);

    const elements = (elemRes.data || []) as ScriptElement[];
    const scenes = (sceneRes.data || []) as Scene[];
    const characters = (charRes.data || []) as Character[];
    const shots = (shotRes.data || []) as Shot[];

    if (elements.length === 0 && scenes.length === 0) {
      setHasScript(false);
      setLoading(false);
      return;
    }

    const result = computeAnalysis(elements, scenes, characters, shots);
    setAnalysis(result);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (!hasProAccess) { setLoading(false); return; }
    loadAnalysis();
  }, [hasProAccess, loadAnalysis]);

  // ---- Pro gate ----
  if (!hasProAccess) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-white mb-2">Script Analysis</h2>
          <p className="text-sm text-surface-400 mb-6">Get in-depth computational analysis of your screenplay — dialogue breakdown, pacing, scene metrics, and production readiness.</p>
          <Button onClick={() => { window.location.href = '/pro'; }}>Upgrade to Pro</Button>
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingPage />;

  if (!hasScript || !analysis) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <EmptyState
          icon={<div className="text-5xl">📝</div>}
          title="No script content to analyze"
          description="Write your script first, then come back here for a full analysis of dialogue, pacing, scenes, and more."
        />
      </div>
    );
  }

  const { overview, characterDialogues, sceneAnalyses, intExtRatio, dayNightRatio, pacingBuckets, locationFrequencies, productionStats } = analysis;
  const maxCharWords = characterDialogues.length > 0 ? characterDialogues[0].wordCount : 1;
  const maxSceneWords = sceneAnalyses.length > 0 ? Math.max(...sceneAnalyses.map(s => s.wordCount)) : 1;
  const maxLocFreq = locationFrequencies.length > 0 ? locationFrequencies[0].count : 1;

  const dialogueHeavyScenes = sceneAnalyses.filter(s => s.dialogueDensity > 0.5);
  const actionHeavyScenes = sceneAnalyses.filter(s => s.dialogueDensity <= 0.5 && s.wordCount > 0);
  const avgSpeakersPerScene = sceneAnalyses.length > 0
    ? (sceneAnalyses.reduce((sum, s) => sum + s.speakingCharacters, 0) / sceneAnalyses.length).toFixed(1)
    : '0';

  const sortedByLength = [...sceneAnalyses].filter(s => s.wordCount > 0).sort((a, b) => b.wordCount - a.wordCount);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Script Analysis</h1>
          <p className="text-sm text-surface-400 mt-1">Computed from {overview.totalElements.toLocaleString()} script elements</p>
        </div>
        <Button onClick={loadAnalysis}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </Button>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-surface-800">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-amber-400 border-b-2 border-amber-400 bg-surface-900/50'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-900/30'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ============ OVERVIEW TAB ============ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Words" value={overview.totalWords.toLocaleString()} icon="📝" />
            <StatCard label="Pages" value={overview.totalPages} sub="≈ 250 words/page" icon="📄" />
            <StatCard label="Runtime" value={`${overview.estimatedRuntime} min`} sub="1 page ≈ 1 min" icon="⏱" />
            <StatCard label="Scenes" value={overview.totalScenes} icon="🎬" />
            <StatCard label="Characters" value={overview.totalCharacters} icon="👥" />
            <StatCard label="Elements" value={overview.totalElements.toLocaleString()} icon="🧩" />
          </div>

          {/* Dialogue vs Action */}
          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Dialogue vs Action Ratio</h3>
            <div className="flex gap-4 items-center mb-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-amber-400">Dialogue — {overview.dialogueWords.toLocaleString()} words ({Math.round(overview.dialogueRatio * 100)}%)</span>
                  <span className="text-blue-400">Action — {overview.actionWords.toLocaleString()} words ({overview.totalWords > 0 ? Math.round((overview.actionWords / overview.totalWords) * 100) : 0}%)</span>
                </div>
                <div className="h-4 bg-surface-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${overview.dialogueRatio * 100}%` }} />
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${overview.totalWords > 0 ? (overview.actionWords / overview.totalWords) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
            <p className="text-xs text-surface-500">
              {overview.dialogueRatio > 0.6
                ? '🗣️ Your script is dialogue-heavy. Consider adding more visual storytelling through action lines.'
                : overview.dialogueRatio < 0.3
                  ? '🎥 Your script is action-heavy. Great for visual storytelling. Ensure characters still have strong voices.'
                  : '✅ Good balance between dialogue and action. Industry average is around 40-55% dialogue.'}
            </p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-surface-400 uppercase mb-2">Avg Scene Length</h4>
              <p className="text-xl font-bold text-white">
                {sceneAnalyses.length > 0 ? (overview.totalWords / sceneAnalyses.length).toFixed(0) : 0} words
              </p>
              <p className="text-xs text-surface-500 mt-1">
                ≈ {sceneAnalyses.length > 0 ? (overview.totalPages / sceneAnalyses.length).toFixed(1) : 0} pages per scene
              </p>
            </Card>
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-surface-400 uppercase mb-2">Top Character</h4>
              {characterDialogues.length > 0 ? (
                <>
                  <p className="text-xl font-bold text-white">{characterDialogues[0].name}</p>
                  <p className="text-xs text-surface-500 mt-1">{characterDialogues[0].wordCount.toLocaleString()} dialogue words</p>
                </>
              ) : (
                <p className="text-sm text-surface-500">No dialogue found</p>
              )}
            </Card>
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-surface-400 uppercase mb-2">Speakers per Scene</h4>
              <p className="text-xl font-bold text-white">{avgSpeakersPerScene}</p>
              <p className="text-xs text-surface-500 mt-1">average speaking characters</p>
            </Card>
          </div>
        </div>
      )}

      {/* ============ DIALOGUE TAB ============ */}
      {activeTab === 'dialogue' && (
        <div className="space-y-6">
          {characterDialogues.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-surface-400">No dialogue elements found in the script.</p>
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <h3 className="text-base font-semibold text-white mb-1">Dialogue by Character</h3>
                <p className="text-xs text-surface-500 mb-4">Ranked by total dialogue word count</p>
                <div className="space-y-3">
                  {characterDialogues.slice(0, 15).map((cd, i) => (
                    <HorizontalBar
                      key={cd.name}
                      value={cd.wordCount}
                      max={maxCharWords}
                      label={`${i + 1}. ${cd.name}`}
                      sublabel={`${cd.wordCount.toLocaleString()} words · ${cd.lineCount} lines`}
                      color={i === 0 ? 'bg-amber-500' : i < 3 ? 'bg-amber-500/70' : 'bg-surface-600'}
                    />
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-base font-semibold text-white mb-4">Dialogue Detail</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-800">
                        <th className="text-left text-xs text-surface-400 pb-2 pr-4">Character</th>
                        <th className="text-right text-xs text-surface-400 pb-2 px-3">Lines</th>
                        <th className="text-right text-xs text-surface-400 pb-2 px-3">Words</th>
                        <th className="text-right text-xs text-surface-400 pb-2 px-3">Avg Words/Line</th>
                        <th className="text-right text-xs text-surface-400 pb-2 pl-3">Scenes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {characterDialogues.slice(0, 20).map(cd => (
                        <tr key={cd.name} className="border-b border-surface-800/50">
                          <td className="py-2 pr-4 text-surface-200 font-medium">{cd.name}</td>
                          <td className="py-2 px-3 text-right text-surface-400">{cd.lineCount}</td>
                          <td className="py-2 px-3 text-right text-surface-400">{cd.wordCount.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">
                            <span className={cd.avgWordsPerLine > 30 ? 'text-amber-400' : 'text-surface-400'}>
                              {cd.avgWordsPerLine}
                            </span>
                          </td>
                          <td className="py-2 pl-3 text-right text-surface-400">{cd.sceneCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-surface-500 mt-3">
                  💡 Industry guideline: Keep individual dialogue blocks under 3-4 lines (≈30 words). Highlighted in amber if average exceeds that.
                </p>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h4 className="text-xs font-semibold text-surface-400 uppercase mb-3">Most Dialogue</h4>
                  <div className="space-y-2">
                    {characterDialogues.slice(0, 5).map((cd, i) => (
                      <div key={cd.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                          <span className="text-sm text-surface-200">{cd.name}</span>
                        </div>
                        <span className="text-xs text-surface-400">{cd.wordCount.toLocaleString()} words</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-4">
                  <h4 className="text-xs font-semibold text-surface-400 uppercase mb-3">Least Dialogue</h4>
                  <div className="space-y-2">
                    {[...characterDialogues].reverse().slice(0, 5).map((cd, i) => (
                      <div key={cd.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-surface-700 text-surface-400 text-[10px] flex items-center justify-center font-bold">{characterDialogues.length - i}</span>
                          <span className="text-sm text-surface-200">{cd.name}</span>
                        </div>
                        <span className="text-xs text-surface-400">{cd.wordCount.toLocaleString()} words</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ SCENES TAB ============ */}
      {activeTab === 'scenes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="text-base font-semibold text-white mb-4">Interior vs Exterior</h3>
              {overview.totalScenes > 0 ? (
                <>
                  <div className="h-4 bg-surface-800 rounded-full overflow-hidden flex mb-3">
                    <div className="h-full bg-amber-500" style={{ width: `${(intExtRatio.interior / overview.totalScenes) * 100}%` }} title="Interior" />
                    <div className="h-full bg-blue-500" style={{ width: `${(intExtRatio.exterior / overview.totalScenes) * 100}%` }} title="Exterior" />
                    <div className="h-full bg-purple-500" style={{ width: `${(intExtRatio.intExt / overview.totalScenes) * 100}%` }} title="INT/EXT" />
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> INT: {intExtRatio.interior}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> EXT: {intExtRatio.exterior}</span>
                    {intExtRatio.intExt > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> INT/EXT: {intExtRatio.intExt}</span>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-surface-500">No scene data</p>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-base font-semibold text-white mb-4">Day vs Night</h3>
              {overview.totalScenes > 0 ? (
                <>
                  <div className="h-4 bg-surface-800 rounded-full overflow-hidden flex mb-3">
                    <div className="h-full bg-yellow-400" style={{ width: `${(dayNightRatio.day / overview.totalScenes) * 100}%` }} />
                    <div className="h-full bg-indigo-500" style={{ width: `${(dayNightRatio.night / overview.totalScenes) * 100}%` }} />
                    <div className="h-full bg-surface-600" style={{ width: `${(dayNightRatio.other / overview.totalScenes) * 100}%` }} />
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Day: {dayNightRatio.day}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Night: {dayNightRatio.night}</span>
                    {dayNightRatio.other > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-surface-600" /> Other: {dayNightRatio.other}</span>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-surface-500">No scene data</p>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-1">Location Frequency</h3>
            <p className="text-xs text-surface-500 mb-4">How often each location appears across scenes</p>
            <div className="space-y-2.5">
              {locationFrequencies.slice(0, 15).map((lf, i) => (
                <HorizontalBar
                  key={lf.location}
                  value={lf.count}
                  max={maxLocFreq}
                  label={lf.location}
                  sublabel={`${lf.count} scene${lf.count !== 1 ? 's' : ''}`}
                  color={i < 3 ? 'bg-amber-500' : 'bg-surface-600'}
                />
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-surface-400 uppercase mb-3">Longest Scenes</h4>
              <div className="space-y-2">
                {sortedByLength.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-surface-300 truncate mr-2">#{s.sceneNumber} {s.heading}</span>
                    <span className="text-surface-400 shrink-0">{s.pageCount} pg · {s.wordCount} w</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-surface-400 uppercase mb-3">Shortest Scenes</h4>
              <div className="space-y-2">
                {[...sortedByLength].reverse().slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-surface-300 truncate mr-2">#{s.sceneNumber} {s.heading}</span>
                    <span className="text-surface-400 shrink-0">{s.pageCount} pg · {s.wordCount} w</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ============ PACING TAB ============ */}
      {activeTab === 'pacing' && (
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Scene Length Distribution</h3>
            <div className="space-y-4">
              {pacingBuckets.map(bucket => (
                <div key={bucket.label}>
                  <HorizontalBar
                    value={bucket.count}
                    max={sceneAnalyses.length}
                    label={bucket.label}
                    sublabel={`${bucket.count} scene${bucket.count !== 1 ? 's' : ''} (${sceneAnalyses.length > 0 ? Math.round((bucket.count / sceneAnalyses.length) * 100) : 0}%)`}
                    color={bucket.label.includes('Short') ? 'bg-green-500' : bucket.label.includes('Medium') ? 'bg-amber-500' : 'bg-red-500'}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-surface-500 mt-4">
              💡 A mix of scene lengths creates good pacing variety. Too many long scenes can slow momentum.
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-1">Dialogue Density per Scene</h3>
            <p className="text-xs text-surface-500 mb-4">Percentage of words that are dialogue in each scene</p>
            <div className="space-y-2">
              {sceneAnalyses.filter(s => s.wordCount > 0).map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="text-xs text-surface-500 w-8 text-right shrink-0">#{s.sceneNumber}</span>
                  <div className="flex-1 h-3 bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.dialogueDensity > 0.7 ? 'bg-amber-500' : s.dialogueDensity > 0.4 ? 'bg-amber-500/60' : 'bg-blue-500/60'
                      }`}
                      style={{ width: `${s.dialogueDensity * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-surface-400 w-10 text-right shrink-0">{Math.round(s.dialogueDensity * 100)}%</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 text-xs text-surface-500 mt-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Dialogue-heavy (&gt;70%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500/60" /> Mixed (40-70%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500/60" /> Action-heavy (&lt;40%)</span>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-1">Scene Length Flow</h3>
            <p className="text-xs text-surface-500 mb-4">Word count per scene, in order — helps visualize pacing rhythm</p>
            <div className="flex items-end gap-px" style={{ height: '120px' }}>
              {sceneAnalyses.map(s => {
                const heightPct = maxSceneWords > 0 ? (s.wordCount / maxSceneWords) * 100 : 0;
                return (
                  <div
                    key={s.id}
                    className="flex-1 min-w-[4px] rounded-t transition-all hover:opacity-80 group relative"
                    style={{
                      height: `${Math.max(heightPct, 2)}%`,
                      backgroundColor: s.dialogueDensity > 0.6 ? '#f59e0b' : s.dialogueDensity > 0.3 ? '#6366f1' : '#3b82f6',
                    }}
                    title={`#${s.sceneNumber}: ${s.wordCount} words (${Math.round(s.dialogueDensity * 100)}% dialogue)`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-surface-600 mt-1">
              <span>Scene 1</span>
              <span>Scene {sceneAnalyses.length}</span>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-surface-400 uppercase mb-2">Dialogue-Heavy Scenes</h4>
              <p className="text-2xl font-bold text-amber-400">{dialogueHeavyScenes.length}</p>
              <p className="text-xs text-surface-500">&gt;50% dialogue by word count</p>
            </Card>
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-surface-400 uppercase mb-2">Action-Heavy Scenes</h4>
              <p className="text-2xl font-bold text-blue-400">{actionHeavyScenes.length}</p>
              <p className="text-xs text-surface-500">≤50% dialogue by word count</p>
            </Card>
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-surface-400 uppercase mb-2">Avg Scene Words</h4>
              <p className="text-2xl font-bold text-white">
                {sceneAnalyses.length > 0 ? Math.round(overview.totalWords / sceneAnalyses.length) : 0}
              </p>
              <p className="text-xs text-surface-500">
                {sceneAnalyses.length > 0 && overview.totalWords / sceneAnalyses.length > 500
                  ? '⚠️ Above average — consider trimming some scenes'
                  : '✅ Good scene length average'}
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* ============ CHARACTERS TAB ============ */}
      {activeTab === 'characters' && (
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-1">Character Introduction Order</h3>
            <p className="text-xs text-surface-500 mb-4">First scene appearance for each speaking character</p>
            {characterDialogues.length > 0 ? (
              <div className="space-y-2">
                {[...characterDialogues].sort((a, b) => a.firstScene - b.firstScene).map((cd, i) => (
                  <div key={cd.name} className="flex items-center gap-3">
                    <span className="text-xs text-surface-600 w-6 text-right">#{i + 1}</span>
                    <span className="w-7 h-7 rounded-full bg-surface-800 flex items-center justify-center text-xs font-semibold text-amber-400 shrink-0">
                      {cd.name[0]}
                    </span>
                    <span className="text-sm text-surface-200 flex-1">{cd.name}</span>
                    <Badge variant="default" className="text-xs">
                      Scene {cd.firstScene}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-500">No speaking characters found</p>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-1">Scene Frequency</h3>
            <p className="text-xs text-surface-500 mb-4">Number of scenes each character speaks in</p>
            <div className="space-y-3">
              {[...characterDialogues].sort((a, b) => b.sceneCount - a.sceneCount).slice(0, 15).map(cd => (
                <HorizontalBar
                  key={cd.name}
                  value={cd.sceneCount}
                  max={overview.totalScenes}
                  label={cd.name}
                  sublabel={`${cd.sceneCount}/${overview.totalScenes} scenes`}
                  color="bg-amber-500"
                />
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Dialogue Distribution</h3>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const totalDlgWords = characterDialogues.reduce((s, c) => s + c.wordCount, 0);
                const colors = ['bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500'];
                return characterDialogues.slice(0, 10).map((cd, i) => {
                  const pct = totalDlgWords > 0 ? Math.round((cd.wordCount / totalDlgWords) * 100) : 0;
                  return (
                    <div key={cd.name} className="flex items-center gap-1.5 bg-surface-800 rounded-full px-3 py-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
                      <span className="text-xs text-surface-300">{cd.name}</span>
                      <span className="text-xs font-semibold text-surface-200">{pct}%</span>
                    </div>
                  );
                });
              })()}
            </div>
            {(() => {
              const totalDlgWords = characterDialogues.reduce((s, c) => s + c.wordCount, 0);
              const colors = ['bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500'];
              return (
                <div className="h-5 rounded-full overflow-hidden flex mt-3">
                  {characterDialogues.slice(0, 10).map((cd, i) => {
                    const pct = totalDlgWords > 0 ? (cd.wordCount / totalDlgWords) * 100 : 0;
                    return (
                      <div
                        key={cd.name}
                        className={`h-full ${colors[i % colors.length]} transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${cd.name}: ${Math.round(pct)}%`}
                      />
                    );
                  })}
                </div>
              );
            })()}
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-1">Speaking Characters per Scene</h3>
            <p className="text-xs text-surface-500 mb-4">How many characters speak in each scene</p>
            <div className="flex items-end gap-px" style={{ height: '80px' }}>
              {sceneAnalyses.map(s => {
                const maxSpeakers = Math.max(...sceneAnalyses.map(sa => sa.speakingCharacters), 1);
                const heightPct = (s.speakingCharacters / maxSpeakers) * 100;
                return (
                  <div
                    key={s.id}
                    className="flex-1 min-w-[4px] bg-amber-500/70 rounded-t hover:bg-amber-500 transition-all"
                    style={{ height: `${Math.max(heightPct, 3)}%` }}
                    title={`Scene #${s.sceneNumber}: ${s.speakingCharacters} speakers`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-surface-600 mt-1">
              <span>Scene 1</span>
              <span>Scene {sceneAnalyses.length}</span>
            </div>
            <p className="text-xs text-surface-500 mt-2">Average: {avgSpeakersPerScene} speakers per scene</p>
          </Card>
        </div>
      )}

      {/* ============ PRODUCTION TAB ============ */}
      {activeTab === 'production' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5">
              <ProgressRing
                value={productionStats.scenesCompleted}
                max={productionStats.scenesTotal}
                label="Scenes completed"
                color="text-green-400"
              />
            </Card>
            <Card className="p-5">
              <ProgressRing
                value={productionStats.shotsCompleted}
                max={productionStats.shotsTotal}
                label="Shots completed"
                color="text-blue-400"
              />
            </Card>
            <Card className="p-5">
              <ProgressRing
                value={productionStats.castCoverage}
                max={productionStats.castTotal}
                label="Characters with actors"
                color="text-amber-400"
              />
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Production Progress</h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-surface-300">Scenes Completed</span>
                  <span className="text-surface-400">{productionStats.scenesCompleted}/{productionStats.scenesTotal}</span>
                </div>
                <div className="h-3 bg-surface-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${productionStats.scenesTotal > 0 ? (productionStats.scenesCompleted / productionStats.scenesTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-surface-300">Shots Completed</span>
                  <span className="text-surface-400">{productionStats.shotsCompleted}/{productionStats.shotsTotal}</span>
                </div>
                <div className="h-3 bg-surface-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${productionStats.shotsTotal > 0 ? (productionStats.shotsCompleted / productionStats.shotsTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-surface-300">Cast Coverage</span>
                  <span className="text-surface-400">{productionStats.castCoverage}/{productionStats.castTotal} characters have actors</span>
                </div>
                <div className="h-3 bg-surface-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${productionStats.castTotal > 0 ? (productionStats.castCoverage / productionStats.castTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Readiness Assessment</h3>
            <div className="space-y-3">
              {(() => {
                const checks: { label: string; ok: boolean; detail: string }[] = [
                  {
                    label: 'Script content exists',
                    ok: overview.totalWords > 0,
                    detail: overview.totalWords > 0 ? `${overview.totalWords.toLocaleString()} words written` : 'No script content found',
                  },
                  {
                    label: 'Scenes defined',
                    ok: overview.totalScenes > 0,
                    detail: overview.totalScenes > 0 ? `${overview.totalScenes} scenes` : 'No scenes found',
                  },
                  {
                    label: 'Characters created',
                    ok: overview.totalCharacters > 0,
                    detail: overview.totalCharacters > 0 ? `${overview.totalCharacters} characters` : 'No characters found',
                  },
                  {
                    label: 'Feature-length script (≥80 pages)',
                    ok: overview.totalPages >= 80,
                    detail: `${overview.totalPages} pages (${overview.estimatedRuntime} min est.)`,
                  },
                  {
                    label: 'All scenes completed',
                    ok: productionStats.scenesCompleted === productionStats.scenesTotal && productionStats.scenesTotal > 0,
                    detail: `${productionStats.scenesCompleted}/${productionStats.scenesTotal} completed`,
                  },
                  {
                    label: 'Shots planned',
                    ok: productionStats.shotsTotal > 0,
                    detail: productionStats.shotsTotal > 0 ? `${productionStats.shotsTotal} shots (${productionStats.shotsCompleted} done)` : 'No shots planned',
                  },
                  {
                    label: 'Full cast coverage',
                    ok: productionStats.castCoverage === productionStats.castTotal && productionStats.castTotal > 0,
                    detail: `${productionStats.castCoverage}/${productionStats.castTotal} roles cast`,
                  },
                ];

                return checks.map(check => (
                  <div key={check.label} className="flex items-center gap-3">
                    <span className={`text-lg ${check.ok ? '' : 'opacity-50'}`}>{check.ok ? '✅' : '⬜'}</span>
                    <div className="flex-1">
                      <p className={`text-sm ${check.ok ? 'text-surface-200' : 'text-surface-400'}`}>{check.label}</p>
                      <p className="text-xs text-surface-500">{check.detail}</p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}