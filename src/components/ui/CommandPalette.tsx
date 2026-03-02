'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────
type ResultGroup =
  | 'Projects' | 'Scripts' | 'Script Lines' | 'Characters'
  | 'Locations' | 'Scenes' | 'Ideas' | 'Documents'
  | 'Chat' | 'Messages' | 'Contacts' | 'Stories'
  | 'Ensemble' | 'Stage Cues';

const GROUP_ORDER: ResultGroup[] = [
  'Projects', 'Scripts', 'Script Lines', 'Characters',
  'Locations', 'Scenes', 'Ideas', 'Documents',
  'Ensemble', 'Stage Cues',
  'Chat', 'Messages', 'Contacts', 'Stories',
];

const GROUP_ICONS: Record<ResultGroup, string> = {
  'Projects': '📁', 'Scripts': '📝', 'Script Lines': '📄', 'Characters': '🎭',
  'Locations': '📍', 'Scenes': '🎬', 'Ideas': '💡', 'Documents': '🗒',
  'Chat': '💬', 'Messages': '✉️', 'Contacts': '📇', 'Stories': '📰',
  'Ensemble': '🎭', 'Stage Cues': '🎛',
};

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  context?: string;
  path: string;
  group: ResultGroup;
}

// ─── Context ──────────────────────────────────────────────
interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
}

const CommandPaletteContext = React.createContext<CommandPaletteContextValue>({
  open: () => {},
  close: () => {},
});

export function useCommandPalette() {
  return React.useContext(CommandPaletteContext);
}

// ─── Provider (mount this once globally in providers.tsx) ─
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const ctx: CommandPaletteContextValue = {
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };

  return (
    <CommandPaletteContext.Provider value={ctx}>
      {children}
      {isOpen && <CommandPaletteModal onClose={() => setIsOpen(false)} />}
    </CommandPaletteContext.Provider>
  );
}

// ─── Modal ────────────────────────────────────────────────
function CommandPaletteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !user?.id) {
      setResults([]);
      setCursor(0);
      return;
    }

    const tid = setTimeout(() => runSearch(query.trim()), 220);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user?.id]);

  const runSearch = useCallback(async (q: string) => {
    if (!user?.id) return;
    setLoading(true);
    const supabase = createClient();
    const like = `%${q}%`;

    // ── Phase 1: Resolve accessible project IDs ───────────────────────────
    // Security: build an explicit allowlist from projects the user owns or is
    // a member of. Every project-scoped query below is filtered to this set.
    // Supabase RLS also enforces access at the DB level (double protection).
    const [{ data: owned }, { data: membered }] = await Promise.all([
      supabase.from('projects').select('id, title').eq('created_by', user.id),
      supabase.from('project_members')
        .select('project_id, project:projects!inner(id, title)').eq('user_id', user.id),
    ]);

    const projectMap: Record<string, string> = {};
    (owned || []).forEach((p: any) => { projectMap[p.id] = p.title || 'Untitled'; });
    (membered || []).forEach((m: any) => {
      if (m.project?.id) projectMap[m.project.id] = m.project.title || 'Untitled';
    });
    const accessibleIds = Object.keys(projectMap);
    if (accessibleIds.length === 0) { setResults([]); setLoading(false); return; }

    // ── Phase 2: Resolve script IDs + channel IDs ─────────────────────────
    // script_elements / channel_messages don't have direct project_id columns.
    const [{ data: scriptRows }, { data: channelRows }] = await Promise.all([
      supabase.from('scripts').select('id, project_id, title').in('project_id', accessibleIds),
      supabase.from('project_channels').select('id, project_id, name').in('project_id', accessibleIds),
    ]);

    const scriptIdToProjectId: Record<string, string> = {};
    const scriptIdToTitle: Record<string, string> = {};
    (scriptRows || []).forEach((s: any) => {
      scriptIdToProjectId[s.id] = s.project_id;
      scriptIdToTitle[s.id] = s.title || 'Untitled Script';
    });
    const accessibleScriptIds = Object.keys(scriptIdToProjectId);

    const channelIdToInfo: Record<string, { project_id: string; name: string }> = {};
    (channelRows || []).forEach((c: any) => {
      channelIdToInfo[c.id] = { project_id: c.project_id, name: c.name };
    });
    const accessibleChannelIds = Object.keys(channelIdToInfo);

    // ── Phase 3: Parallel content searches ────────────────────────────────
    const N = 4;
    const [
      prjRes, scrRes, lineRes, chrRes, locRes,
      scnRes, ideaRes, docRes, chatRes, dmRes, cntRes, stoRes,
      ensembleRes, stageCueRes,
    ] = await Promise.all([
      supabase.from('projects').select('id, title, logline, project_type')
        .in('id', accessibleIds).ilike('title', like).limit(N),
      supabase.from('scripts').select('id, title, project_id, script_type')
        .in('project_id', accessibleIds).ilike('title', like).limit(N),
      accessibleScriptIds.length > 0
        ? supabase.from('script_elements')
            .select('id, content, element_type, sort_order, script_id')
            .in('script_id', accessibleScriptIds)
            .not('element_type', 'in', '("page_break","transition")')
            .eq('is_omitted', false)
            .ilike('content', like).limit(N)
        : Promise.resolve({ data: [] }),
      supabase.from('characters').select('id, name, project_id, role')
        .in('project_id', accessibleIds).ilike('name', like).limit(N),
      supabase.from('locations').select('id, name, project_id, location_type')
        .in('project_id', accessibleIds).ilike('name', like).limit(N),
      supabase.from('scenes').select('id, scene_heading, project_id, synopsis, scene_number')
        .in('project_id', accessibleIds)
        .or(`scene_heading.ilike.${like},synopsis.ilike.${like}`).limit(N),
      supabase.from('ideas').select('id, title, project_id, category')
        .in('project_id', accessibleIds).ilike('title', like).limit(N),
      supabase.from('project_documents').select('id, title, project_id, doc_type')
        .in('project_id', accessibleIds).ilike('title', like).limit(N),
      accessibleChannelIds.length > 0
        ? supabase.from('channel_messages')
            .select('id, content, channel_id')
            .in('channel_id', accessibleChannelIds)
            .eq('is_deleted', false).ilike('content', like).limit(N)
        : Promise.resolve({ data: [] }),
      // DMs: RLS enforces conversation_members check at DB level — no extra filter needed
      supabase.from('direct_messages')
        .select('id, content, conversation_id')
        .eq('is_deleted', false).ilike('content', like).limit(N),
      supabase.from('broadcast_contacts').select('id, name, category, project_id')
        .in('project_id', accessibleIds).ilike('name', like).limit(N),
      supabase.from('broadcast_stories').select('id, headline, project_id, story_type')
        .in('project_id', accessibleIds).ilike('headline', like).limit(N),
      // Stage play — ensemble members
      supabase.from('stage_ensemble_members')
        .select('id, actor_name, character_name, ensemble_group, project_id')
        .in('project_id', accessibleIds)
        .or(`actor_name.ilike.${like},character_name.ilike.${like}`).limit(N),
      // Stage play — cue sheet
      supabase.from('stage_cues')
        .select('id, cue_number, description, cue_type, act_number, project_id')
        .in('project_id', accessibleIds)
        .or(`cue_number.ilike.${like},description.ilike.${like}`).limit(N),
    ]);

    // ── Phase 4: Map to SearchResult[] ────────────────────────────────────
    const mapped: SearchResult[] = [];
    const sn = (s: string, max = 68) => s.length > max ? s.slice(0, max) + '\u2026' : s;

    for (const p of (prjRes.data || []) as any[])
      mapped.push({ id: `prj-${p.id}`, label: p.title || 'Untitled',
        sublabel: p.logline || p.project_type || '', path: `/projects/${p.id}`, group: 'Projects' });

    for (const s of (scrRes.data || []) as any[])
      mapped.push({ id: `scr-${s.id}`, label: s.title || 'Untitled Script',
        sublabel: projectMap[s.project_id] || '', context: s.script_type || '',
        path: `/projects/${s.project_id}/script`, group: 'Scripts' });

    for (const el of (lineRes.data || []) as any[]) {
      const projectId = scriptIdToProjectId[el.script_id];
      if (!projectId) continue;
      mapped.push({ id: `line-${el.id}`, label: sn(el.content),
        sublabel: `${scriptIdToTitle[el.script_id] || 'Script'}  ·  ${projectMap[projectId] || ''}`,
        context: ELEMENT_LABELS[el.element_type] || el.element_type,
        path: `/projects/${projectId}/script?element=${el.id}`, group: 'Script Lines' });
    }

    for (const c of (chrRes.data || []) as any[])
      mapped.push({ id: `chr-${c.id}`, label: c.name || 'Unknown',
        sublabel: projectMap[c.project_id] || '', context: c.role || '',
        path: `/projects/${c.project_id}/characters`, group: 'Characters' });

    for (const l of (locRes.data || []) as any[])
      mapped.push({ id: `loc-${l.id}`, label: l.name || 'Unknown',
        sublabel: projectMap[l.project_id] || '', context: l.location_type || '',
        path: `/projects/${l.project_id}/locations`, group: 'Locations' });

    for (const s of (scnRes.data || []) as any[]) {
      const heading = s.scene_heading || `Scene ${s.scene_number || ''}`;
      mapped.push({ id: `scn-${s.id}`, label: heading,
        sublabel: projectMap[s.project_id] || '',
        context: s.synopsis ? sn(s.synopsis, 55) : '',
        path: `/projects/${s.project_id}/scenes`, group: 'Scenes' });
    }

    for (const i of (ideaRes.data || []) as any[])
      mapped.push({ id: `idea-${i.id}`, label: i.title || 'Untitled',
        sublabel: projectMap[i.project_id] || '', context: i.category || '',
        path: `/projects/${i.project_id}/ideas`, group: 'Ideas' });

    for (const d of (docRes.data || []) as any[])
      mapped.push({ id: `doc-${d.id}`, label: d.title || 'Untitled',
        sublabel: projectMap[d.project_id] || '',
        context: DOC_LABELS[d.doc_type] || d.doc_type || '',
        path: `/projects/${d.project_id}/documents`, group: 'Documents' });

    for (const m of (chatRes.data || []) as any[]) {
      const info = channelIdToInfo[m.channel_id];
      if (!info) continue;
      mapped.push({ id: `chat-${m.id}`, label: sn(m.content),
        sublabel: projectMap[info.project_id] || '', context: `#${info.name}`,
        path: `/projects/${info.project_id}/chat`, group: 'Chat' });
    }

    for (const m of (dmRes.data || []) as any[])
      mapped.push({ id: `dm-${m.id}`, label: sn(m.content), sublabel: 'Direct Message',
        path: `/messages?conversation=${m.conversation_id}`, group: 'Messages' });

    for (const c of (cntRes.data || []) as any[])
      mapped.push({ id: `cnt-${c.id}`, label: c.name || 'Unknown',
        sublabel: projectMap[c.project_id] || '', context: c.category || '',
        path: `/projects/${c.project_id}/contacts`, group: 'Contacts' });

    for (const s of (stoRes.data || []) as any[])
      mapped.push({ id: `sto-${s.id}`, label: s.headline || 'Untitled Story',
        sublabel: projectMap[s.project_id] || '', context: s.story_type || '',
        path: `/projects/${s.project_id}/stories`, group: 'Stories' });

    for (const m of (ensembleRes.data || []) as any[]) {
      const who = m.character_name ? `${m.actor_name} → ${m.character_name}` : m.actor_name;
      mapped.push({ id: `ens-${m.id}`, label: who,
        sublabel: projectMap[m.project_id] || '', context: m.ensemble_group || '',
        path: `/projects/${m.project_id}/ensemble`, group: 'Ensemble' });
    }

    for (const c of (stageCueRes.data || []) as any[]) {
      const actLabel = c.act_number ? `Act ${c.act_number}` : '';
      mapped.push({ id: `cue-${c.id}`, label: `${c.cue_number}${c.description ? ` — ${sn(c.description, 50)}` : ''}`,
        sublabel: projectMap[c.project_id] || '',
        context: [c.cue_type?.toUpperCase(), actLabel].filter(Boolean).join(' · '),
        path: `/projects/${c.project_id}/cues`, group: 'Stage Cues' });
    }

    setResults(mapped);
    setCursor(0);
    setLoading(false);
  }, [user?.id]);

  // Keyboard navigation
  useEffect(() => {
    const flatList = GROUP_ORDER.flatMap(g => results.filter(r => r.group === g));
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, flatList.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
      else if (e.key === 'Enter' && flatList[cursor]) { navigate(flatList[cursor].path); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results, cursor]);

  // Scroll active item into view
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const navigate = (path: string) => {
    router.push(path);
    onClose();
  };

  const flatResults = GROUP_ORDER.flatMap(g => results.filter(r => r.group === g));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-800">
          <svg className="w-5 h-5 text-surface-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search everything — scripts, lines, characters, chat…"
            className="flex-1 bg-transparent text-sm text-white placeholder-surface-500 outline-none"
          />
          {loading && (
            <svg className="w-4 h-4 text-surface-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          <kbd className="text-[10px] font-mono text-surface-600 bg-surface-800 border border-surface-700 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[58vh] overflow-y-auto py-1">
          {query.trim() === '' ? (
            <p className="px-4 py-8 text-sm text-surface-500 text-center">
              Search across projects, scripts, lines, characters, locations, scenes, ideas, documents, chat, messages, contacts and stories.
            </p>
          ) : !loading && results.length === 0 ? (
            <p className="px-4 py-8 text-sm text-surface-500 text-center">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            GROUP_ORDER.map(group => {
              const items = flatResults.filter(r => r.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  <div className="flex items-center gap-2 px-4 pt-2 pb-1">
                    <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap">
                      {GROUP_ICONS[group]} {group}
                    </span>
                    <div className="flex-1 h-px bg-surface-800" />
                  </div>
                  {items.map(result => {
                    const idx = flatResults.indexOf(result);
                    const isActive = cursor === idx;
                    const meta = [result.sublabel, result.context].filter(Boolean).join('  ·  ');
                    return (
                      <button
                        key={result.id}
                        data-active={isActive}
                        onClick={() => navigate(result.path)}
                        onMouseEnter={() => setCursor(idx)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                          isActive ? 'bg-[#FF5F1F]/10' : 'hover:bg-white/[0.03]'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm truncate', isActive ? 'text-white' : 'text-surface-200')}>
                            {result.label}
                          </p>
                          {meta && (
                            <p className="text-[11px] text-surface-500 truncate">{meta}</p>
                          )}
                        </div>
                        {isActive && (
                          <kbd className="text-[10px] font-mono text-surface-600 bg-surface-800 border border-surface-700 rounded px-1.5 py-0.5 shrink-0">↵</kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-surface-800 flex items-center gap-4">
          <span className="text-[10px] text-surface-600 flex items-center gap-1">
            <kbd className="font-mono bg-surface-800 border border-surface-700 rounded px-1">↑↓</kbd> navigate
          </span>
          <span className="text-[10px] text-surface-600 flex items-center gap-1">
            <kbd className="font-mono bg-surface-800 border border-surface-700 rounded px-1">↵</kbd> open
          </span>
          <span className="text-[10px] text-surface-600 flex items-center gap-1">
            <kbd className="font-mono bg-surface-800 border border-surface-700 rounded px-1">Esc</kbd> close
          </span>
          {results.length > 0 && (
            <span className="ml-auto text-[10px] text-surface-600">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Label helpers ───────────────────────────────────────

const ELEMENT_LABELS: Record<string, string> = {
  // Screenplay
  scene_heading: 'Scene Heading', action: 'Action', character: 'Character',
  dialogue: 'Dialogue', parenthetical: 'Parenthetical', note: 'Note', shot: 'Shot',
  transition: 'Transition', general: 'General',
  // Audio drama
  sfx_cue: 'SFX Cue', music_cue: 'Music Cue', ambience_cue: 'Ambience Cue',
  act_break: 'Act Break', announcer: 'Announcer', narrator: 'Narrator',
  sound_cue: 'Sound Cue',
  // Stage play
  song_title: 'Song Title', lyric: 'Lyric', dance_direction: 'Dance Direction',
  musical_cue: 'Musical Cue', lighting_cue: 'Lighting Cue', set_direction: 'Set Direction',
};

const DOC_LABELS: Record<string, string> = {
  plain_text: 'Note', notes: 'Notes', outline: 'Outline',
  treatment: 'Treatment', research: 'Research',
};
