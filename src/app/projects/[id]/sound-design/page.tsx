'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/lib/stores';
import { Card, Button, Badge, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────

type CueType = 'SFX' | 'MUSIC' | 'AMBIENCE' | 'ALL';

interface AudioCue {
  id: string;
  raw: string;       // original element content e.g. "SFX: Heavy rain on window"
  type: CueType;
  description: string; // stripped of prefix
  scriptId: string;
  scriptTitle: string;
  elementType: string;
  sortOrder: number;
}

interface ScriptRow {
  id: string;
  title: string;
  project_id: string;
}

interface ElementRow {
  id: string;
  content: string;
  element_type: string;
  sort_order: number;
  script_id: string;
}

function detectCueType(content: string): CueType | null {
  const upper = content.trimStart().toUpperCase();
  if (upper.startsWith('SFX:') || upper.startsWith('SFX ')) return 'SFX';
  if (upper.startsWith('MUSIC:') || upper.startsWith('MUSIC ')) return 'MUSIC';
  if (upper.startsWith('AMBIENCE:') || upper.startsWith('AMBIENCE ') || upper.startsWith('AMB:')) return 'AMBIENCE';
  return null;
}

function stripPrefix(content: string): string {
  return content.replace(/^(SFX|MUSIC|AMBIENCE|AMB)\s*:\s*/i, '').trim();
}

const CUE_COLORS: Record<CueType | string, string> = {
  SFX: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  MUSIC: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  AMBIENCE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  ALL: 'bg-surface-700 text-surface-300 border-surface-600',
};

const CUE_ICONS: Record<string, string> = {
  SFX: '🔊',
  MUSIC: '🎵',
  AMBIENCE: '🌊',
};

// ─── Component ───────────────────────────────────────────────

export default function SoundDesignPage({ params }: { params: { id: string } }) {
  const { currentProject } = useProjectStore();
  const [cues, setCues] = useState<AudioCue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CueType>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'script' | 'order' | 'alpha'>('script');
  const [scriptFilter, setScriptFilter] = useState<string>('all');
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  // Notes panel
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesDocId, setNotesDocId] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    fetchCues();
    fetchNotes();
  }, [params.id]);

  const fetchCues = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: scriptRows } = await supabase
      .from('scripts')
      .select('id, title, project_id')
      .eq('project_id', params.id);

    if (!scriptRows?.length) { setLoading(false); return; }
    setScripts(scriptRows);

    const scriptIds = scriptRows.map((s: ScriptRow) => s.id);
    const scriptMap: Record<string, string> = {};
    scriptRows.forEach((s: ScriptRow) => { scriptMap[s.id] = s.title || 'Untitled Script'; });

    const { data: elements } = await supabase
      .from('script_elements')
      .select('id, content, element_type, sort_order, script_id')
      .in('script_id', scriptIds)
      .in('element_type', [
        'action', 'note',
        // audio drama dedicated types
        'sfx_cue', 'music_cue', 'ambience_cue', 'sound_cue',
        // legacy / alternate names tolerated
        'sound_effect', 'ambience',
      ])
      .order('sort_order');

    const discovered: AudioCue[] = [];

    for (const el of (elements || []) as ElementRow[]) {
      if (!el.content?.trim()) continue;

      // Try element_type first (dedicated audio drama cue types)
      let cueType: CueType | null = null;
      if (el.element_type === 'sfx_cue' || el.element_type === 'sound_effect' || el.element_type === 'sound_cue') cueType = 'SFX';
      else if (el.element_type === 'music_cue') cueType = 'MUSIC';
      else if (el.element_type === 'ambience_cue' || el.element_type === 'ambience') cueType = 'AMBIENCE';
      else cueType = detectCueType(el.content);

      if (!cueType) continue;

      discovered.push({
        id: el.id,
        raw: el.content,
        type: cueType,
        description: stripPrefix(el.content),
        scriptId: el.script_id,
        scriptTitle: scriptMap[el.script_id] || 'Unknown Script',
        elementType: el.element_type,
        sortOrder: el.sort_order,
      });
    }

    setCues(discovered);
    setLoading(false);
  };

  const fetchNotes = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('project_documents')
      .select('id, content')
      .eq('project_id', params.id)
      .eq('doc_type', 'research')
      .ilike('title', '%Sound Design Bible%')
      .maybeSingle();
    if (data) {
      setNotesDocId(data.id);
      setNotes(data.content || '');
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    const supabase = createClient();
    if (notesDocId) {
      await supabase.from('project_documents').update({ content: notes, updated_at: new Date().toISOString() }).eq('id', notesDocId);
    } else {
      const { data } = await supabase.from('project_documents').insert({
        project_id: params.id,
        title: 'Sound Design Bible',
        doc_type: 'research',
        content: notes,
      }).select('id').single();
      if (data) setNotesDocId(data.id);
    }
    setNotesDirty(false);
    setSavingNotes(false);
    toast.success('Sound Design Bible saved');
  };

  // ── Filtered / sorted cues ──
  const filtered = useMemo(() => {
    let list = cues;
    if (activeTab !== 'ALL') list = list.filter(c => c.type === activeTab);
    if (scriptFilter !== 'all') list = list.filter(c => c.scriptId === scriptFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.description.toLowerCase().includes(q) || c.scriptTitle.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'alpha': return [...list].sort((a, b) => a.description.localeCompare(b.description));
      case 'order': return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
      case 'script': return [...list].sort((a, b) => a.scriptTitle.localeCompare(b.scriptTitle) || a.sortOrder - b.sortOrder);
      default: return list;
    }
  }, [cues, activeTab, scriptFilter, search, sortBy]);

  const counts = useMemo(() => ({
    SFX: cues.filter(c => c.type === 'SFX').length,
    MUSIC: cues.filter(c => c.type === 'MUSIC').length,
    AMBIENCE: cues.filter(c => c.type === 'AMBIENCE').length,
  }), [cues]);

  const TABS: { label: string; value: CueType; count: number }[] = [
    { label: 'All Cues', value: 'ALL', count: cues.length },
    { label: '🔊 SFX', value: 'SFX', count: counts.SFX },
    { label: '🎵 Music', value: 'MUSIC', count: counts.MUSIC },
    { label: '🌊 Ambience', value: 'AMBIENCE', count: counts.AMBIENCE },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Sound Design</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            All SFX, music and ambience cues auto-discovered from your scripts
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchCues} title="Refresh cues from scripts">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115-6.7M20 15a9 9 0 01-15 6.7" />
          </svg>
          Refresh
        </Button>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-3">
        {(['SFX', 'MUSIC', 'AMBIENCE'] as const).map(type => (
          <Card key={type} className="p-4 text-center border-surface-800/80">
            <p className="text-2xl font-bold text-white">{counts[type]}</p>
            <p className="text-xs text-surface-500 mt-0.5">{CUE_ICONS[type]} {type} cue{counts[type] !== 1 ? 's' : ''}</p>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ── Cues panel ── */}
          <div className="xl:col-span-2 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl w-fit">
              {TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    activeTab === tab.value
                      ? 'bg-surface-700 text-white shadow'
                      : 'text-surface-400 hover:text-white'
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1.5 text-[10px] opacity-60">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search cues…"
                className="flex-1 min-w-[160px] bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-surface-500 outline-none focus:border-violet-500/50"
              />
              {scripts.length > 1 && (
                <select
                  value={scriptFilter}
                  onChange={e => setScriptFilter(e.target.value)}
                  className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-300 outline-none"
                >
                  <option value="all">All scripts</option>
                  {scripts.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              )}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-300 outline-none"
              >
                <option value="script">Sort by script</option>
                <option value="order">Sort by order</option>
                <option value="alpha">Sort A–Z</option>
              </select>
            </div>

            {/* Cue list */}
            {filtered.length === 0 ? (
              <Card className="p-8 text-center border-surface-800/80 border-dashed">
                <p className="text-2xl mb-3">🎧</p>
                {cues.length === 0 ? (
                  <>
                    <p className="text-sm font-medium text-white mb-1">No audio cues found yet</p>
                    <p className="text-xs text-surface-500 max-w-sm mx-auto">
                      Add cue lines to your script starting with <code className="text-violet-400">SFX:</code>,{' '}
                      <code className="text-violet-400">MUSIC:</code>, or{' '}
                      <code className="text-violet-400">AMBIENCE:</code> — they'll appear here automatically.
                    </p>
                    <Link href={`/projects/${params.id}/script`}>
                      <Button variant="ghost" size="sm" className="mt-4">Open Script Editor</Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-surface-500">No cues match your filters</p>
                )}
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map(cue => (
                  <div
                    key={cue.id}
                    className="flex items-start gap-3 p-3 bg-surface-900/60 border border-surface-800/80 rounded-xl hover:border-surface-700 transition-colors group"
                  >
                    <span className={cn(
                      'shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border mt-0.5',
                      CUE_COLORS[cue.type]
                    )}>
                      {cue.type === 'AMBIENCE' ? 'AMB' : cue.type}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{cue.description}</p>
                      <p className="text-[11px] text-surface-500 mt-0.5">{cue.scriptTitle}</p>
                    </div>
                    <Link
                      href={`/projects/${params.id}/script?element=${cue.id}`}
                      className="shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      title="Jump to this line in the script"
                    >
                      <span className="text-[10px] text-surface-500 hover:text-violet-400 transition-colors px-2 py-1 rounded-lg hover:bg-violet-500/10">
                        ↗ Script
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Sound Design Bible (notes panel) ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Sound Design Bible</h2>
              {notesDirty && (
                <Button
                  size="sm"
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="text-[11px] px-2 py-1 h-auto"
                >
                  {savingNotes ? 'Saving…' : 'Save'}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-surface-500">
              Notes for your director, sound designer and composer. Saved as a project document.
            </p>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesDirty(true); }}
              placeholder={`# Sound Design Notes\n\n## Tone\nDescribe the sonic world of the drama…\n\n## SFX Notes\n\n## Music\nComposer brief, leitmotifs…\n\n## Ambience\nScene-by-scene atmosphere…`}
              rows={28}
              className="w-full bg-surface-900/60 border border-surface-800 rounded-xl p-4 text-sm text-surface-200 placeholder-surface-600 outline-none focus:border-violet-500/40 resize-none font-mono leading-relaxed"
            />
            <p className="text-[10px] text-surface-600">
              Tip: This document is also accessible from the Documents section.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
