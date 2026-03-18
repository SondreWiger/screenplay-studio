'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { parseScreenplayElements } from '@/components/ScreenplayRenderer';
import { estimateLines, PAGE_CONFIGS } from '@/lib/screenplay-paginator';
import type { Profile } from '@/lib/types';

// ============================================================
// Community Script Reader — Info Panel + Full-screen Modal
//
// Design mirrors the Deep Dive script viewer with:
//   - Script stats info panel (words, pages, scenes, chars)
//   - Full-screen cinema-mode reader overlay
//   - Inline annotations (community post pages, per line)
//   - Scene navigation sidebar
//   - Character index with word counts
//   - Reading progress bar
//   - Keyboard shortcuts (Esc, T, J/K)
//   - Font size & display options
//   - Accepts both structured JSON (Fountain-parsed) and plaintext
// ============================================================

// ── Colour helpers ───────────────────────────────────────────
const CHARACTER_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#14b8a6', '#e11d48',
];
function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return CHARACTER_COLORS[Math.abs(h) % CHARACTER_COLORS.length];
}

// ── Script stats ─────────────────────────────────────────────
interface ScriptStats {
  wordCount: number;
  sceneCount: number;
  charCount: number;
  pageEstimate: number;
  readingTimeMin: number;
  dialoguePct: number;
  dialogueWords: number;
  actionWords: number;
  isStructured: boolean;
}

function computeStats(content: string | null): ScriptStats {
  const empty: ScriptStats = { wordCount: 0, sceneCount: 0, charCount: 0, pageEstimate: 0, readingTimeMin: 0, dialoguePct: 0, dialogueWords: 0, actionWords: 0, isStructured: false };
  if (!content) return empty;

  const elements = parseScreenplayElements(content);
  if (elements) {
    const totalWords = elements.reduce((n, el) => n + el.content.split(/\s+/).filter(Boolean).length, 0);
    const sceneCount = elements.filter(e => e.element_type === 'scene_heading').length;
    const charCount = new Set(
      elements.filter(e => e.element_type === 'character').map(e => e.content.replace(/\s*\(.*?\)$/, '').trim().toUpperCase())
    ).size;
    const dia = elements.filter(e => e.element_type === 'dialogue').reduce((n, e) => n + e.content.split(/\s+/).filter(Boolean).length, 0);
    const act = elements.filter(e => e.element_type === 'action').reduce((n, e) => n + e.content.split(/\s+/).filter(Boolean).length, 0);
    const cfg = PAGE_CONFIGS['letter'];
    const totalLines = elements
      .filter(e => e.element_type !== 'title_page' && !e.is_omitted)
      .reduce((n, el) => n + estimateLines(el, cfg), 0);
    const pageEstimate = Math.max(1, Math.ceil(totalLines / cfg.linesPerPage));
    return {
      wordCount: totalWords,
      sceneCount,
      charCount,
      pageEstimate,
      readingTimeMin: Math.max(1, Math.ceil(totalWords / 200)),
      dialoguePct: totalWords ? Math.round(dia / totalWords * 100) : 0,
      dialogueWords: dia,
      actionWords: act,
      isStructured: true,
    };
  }
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return {
    wordCount,
    sceneCount: 0,
    charCount: 0,
    pageEstimate: Math.max(1, Math.ceil(wordCount / 250)),
    readingTimeMin: Math.max(1, Math.ceil(wordCount / 200)),
    dialoguePct: 0,
    dialogueWords: 0,
    actionWords: 0,
    isStructured: false,
  };
}

// ── Scene info ────────────────────────────────────────────────
interface SceneInfo {
  elementIndex: number;
  number: string;
  heading: string;
  setting: string;
  location: string;
  timeOfDay: string;
  lineCount: number;
}

function extractScenes(elements: ReturnType<typeof parseScreenplayElements>): SceneInfo[] {
  if (!elements) return [];
  const scenes: SceneInfo[] = [];
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
    scenes.push({
      elementIndex: i,
      number: num,
      heading,
      setting: match?.[1]?.toUpperCase() || '',
      location: match?.[2]?.trim() || heading,
      timeOfDay: match?.[3]?.trim() || '',
      lineCount,
    });
  }
  return scenes;
}

interface CharStat { name: string; lineCount: number; dialogueWords: number; color: string }

function extractCharacters(elements: ReturnType<typeof parseScreenplayElements>): CharStat[] {
  if (!elements) return [];
  const map = new Map<string, { lines: number; words: number }>();
  let cur = '';
  for (const el of elements) {
    if (el.element_type === 'character') {
      cur = el.content.replace(/\s*\(.*?\)$/, '').trim().toUpperCase();
      if (!map.has(cur)) map.set(cur, { lines: 0, words: 0 });
    } else if ((el.element_type === 'dialogue' || el.element_type === 'parenthetical') && cur) {
      const e = map.get(cur)!;
      e.lines++;
      e.words += el.content.split(/\s+/).filter(Boolean).length;
    } else if (el.element_type !== 'parenthetical') {
      cur = '';
    }
  }
  return Array.from(map.entries())
    .map(([name, d]) => ({ name, lineCount: d.lines, dialogueWords: d.words, color: hashColor(name) }))
    .sort((a, b) => b.dialogueWords - a.dialogueWords);
}

// ── Annotation type ───────────────────────────────────────────
interface Annotation {
  id: string;
  line_ref: string | null;
  author_id: string;
  content: string;
  created_at: string;
  author?: Profile;
}

// ── Element style (mirrors Deep Dive) ───────────────────────
function getElementStyle(type: string, dark: boolean): React.CSSProperties {
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

// =============================================================
// Script Info Panel — summary card shown on post/submission
// =============================================================
export interface CommunityScriptInfoPanelProps {
  content: string | null;
  fileType?: string | null;
  fileUrl?: string | null;
  title: string;
  /** postId enables annotations; omit for challenge submissions */
  postId?: string | null;
  user?: Profile | null;
}

export function CommunityScriptInfoPanel({
  content,
  fileType,
  fileUrl,
  title,
  postId,
  user,
}: CommunityScriptInfoPanelProps) {
  const [readerOpen, setReaderOpen] = useState(false);
  const stats = useMemo(() => computeStats(content), [content]);

  const formatLabel =
    fileType === 'fdx' ? 'Final Draft' :
    fileType === 'fountain' ? 'Fountain' :
    fileType === 'pdf' ? 'PDF' :
    fileType === 'txt' ? 'Plain Text' :
    stats.isStructured ? 'Structured' : 'Plain Text';

  if (!content && fileType !== 'pdf') {
    return (
      <div className="rounded-xl border border-white/10 bg-surface-900 p-5">
        <p className="text-sm text-white/30 italic">No script content attached.</p>
      </div>
    );
  }

  if (fileType === 'pdf' && fileUrl) {
    return (
      <div className="rounded-xl border border-white/10 overflow-hidden bg-surface-900">
        <iframe
          src={`${fileUrl}#toolbar=1&navpanes=0&scrollbar=1`}
          title={`${title} — PDF`}
          className="w-full"
          style={{ height: '75vh', minHeight: 500 }}
        />
        <div className="px-5 py-3 border-t border-white/[0.07] flex items-center justify-between">
          <span className="text-xs text-white/30">PDF viewer</span>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#FF5F1F] hover:underline">
            Open in new tab ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-surface-900 overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          {/* Format badges */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border"
              style={{ background: '#FF5F1F14', color: '#FF8F5F', borderColor: '#FF5F1F28' }}
            >
              {formatLabel}
            </span>
            {stats.isStructured && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-white/[0.07] text-white/25">
                Structured
              </span>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-[#0a0a14] border border-white/[0.07] rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-white/25 uppercase tracking-wide">Words</p>
              <p className="text-xl font-bold text-white/80 mt-0.5">{stats.wordCount.toLocaleString()}</p>
            </div>
            <div className="bg-[#0a0a14] border border-white/[0.07] rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-white/25 uppercase tracking-wide">Pages (~)</p>
              <p className="text-xl font-bold text-white/80 mt-0.5">~{stats.pageEstimate}</p>
            </div>
            {stats.isStructured ? (
              <>
                <div className="bg-[#0a0a14] border border-white/[0.07] rounded-lg px-3 py-2.5">
                  <p className="text-[10px] text-white/25 uppercase tracking-wide">Scenes</p>
                  <p className="text-xl font-bold text-white/80 mt-0.5">{stats.sceneCount}</p>
                </div>
                <div className="bg-[#0a0a14] border border-white/[0.07] rounded-lg px-3 py-2.5">
                  <p className="text-[10px] text-white/25 uppercase tracking-wide">Characters</p>
                  <p className="text-xl font-bold text-white/80 mt-0.5">{stats.charCount}</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-[#0a0a14] border border-white/[0.07] rounded-lg px-3 py-2.5">
                  <p className="text-[10px] text-white/25 uppercase tracking-wide">Read time</p>
                  <p className="text-xl font-bold text-white/80 mt-0.5">~{stats.readingTimeMin}m</p>
                </div>
                <div className="bg-[#0a0a14] border border-white/[0.07] rounded-lg px-3 py-2.5">
                  <p className="text-[10px] text-white/25 uppercase tracking-wide">Format</p>
                  <p className="text-base font-bold text-white/70 mt-0.5 truncate">{formatLabel}</p>
                </div>
              </>
            )}
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setReaderOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#E54E15' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Read Script
            </button>
            {stats.isStructured && (
              <span className="text-xs text-white/30">~{stats.readingTimeMin} min read</span>
            )}
            {fileUrl && fileType !== 'pdf' && (
              <a
                href={fileUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-white/50 border border-white/10 hover:border-white/20 hover:text-white/70 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </a>
            )}
          </div>
        </div>

        {/* Dialogue vs action ratio bar (structured only) */}
        {stats.isStructured && stats.wordCount > 0 && (
          <div className="px-5 pb-4">
            <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.04] flex">
              <div className="h-full transition-all" style={{ width: `${stats.dialoguePct}%`, background: '#FF5F1F55' }} />
              <div className="h-full" style={{ width: `${100 - stats.dialoguePct}%`, background: '#3b82f635' }} />
            </div>
            <div className="flex justify-between text-[10px] mt-1">
              <span style={{ color: '#FF8F5F70' }}>{stats.dialoguePct}% Dialogue ({stats.dialogueWords.toLocaleString()}w)</span>
              <span className="text-blue-400/40">{100 - stats.dialoguePct}% Action ({stats.actionWords.toLocaleString()}w)</span>
            </div>
          </div>
        )}
      </div>

      {readerOpen && (
        <CommunityScriptReaderModal
          content={content!}
          title={title}
          postId={postId}
          user={user}
          onClose={() => setReaderOpen(false)}
        />
      )}
    </>
  );
}

// =============================================================
// Fullscreen Reader Modal
// =============================================================
type SidebarTab = 'scenes' | 'characters' | 'stats' | 'annotations';

interface ReaderModalProps {
  content: string;
  title: string;
  postId?: string | null;
  user?: Profile | null;
  onClose: () => void;
}

function CommunityScriptReaderModal({ content, title, postId, user, onClose }: ReaderModalProps) {
  const elements = useMemo(() => parseScreenplayElements(content), [content]);
  const paragraphs = useMemo(() => {
    if (elements) return null;
    return content.split(/\n\n+/).filter(Boolean);
  }, [content, elements]);

  const scenes = useMemo(() => extractScenes(elements), [elements]);
  const characterStats = useMemo(() => extractCharacters(elements), [elements]);
  const stats = useMemo(() => computeStats(content), [content]);

  // Display options
  const [fontSize, setFontSize] = useState(12);
  const [darkScript, setDarkScript] = useState(true);
  const [showSceneNumbers, setShowSceneNumbers] = useState(true);
  const [showCharColors, setShowCharColors] = useState(true);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(scenes.length > 0);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(scenes.length > 0 ? 'scenes' : 'stats');
  const [sceneFilter, setSceneFilter] = useState('');
  const [charFilter, setCharFilter] = useState('');

  // Progress
  const [progress, setProgress] = useState(0);
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const scriptRef = useRef<HTMLDivElement>(null);
  const sceneElemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Annotations
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotatingLine, setAnnotatingLine] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [postingAnnotation, setPostingAnnotation] = useState(false);
  const [activeAnnotationLine, setActiveAnnotationLine] = useState<string | null>(null);

  const canAnnotate = !!postId && !!user;

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't') setSidebarOpen(p => !p);
      if ((e.key === 'j' || e.key === 'k') && scenes.length > 0) {
        setActiveSceneIdx(prev => {
          const next = e.key === 'j' ? Math.min(prev + 1, scenes.length - 1) : Math.max(prev - 1, 0);
          const scene = scenes[next];
          if (scene) {
            const el = sceneElemRefs.current.get(scene.elementIndex);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scenes, onClose]);

  // Scroll progress & active scene tracking
  useEffect(() => {
    const container = scriptRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setProgress(scrollHeight > clientHeight ? (scrollTop / (scrollHeight - clientHeight)) * 100 : 0);
      let activeIdx = 0;
      for (let i = 0; i < scenes.length; i++) {
        const el = sceneElemRefs.current.get(scenes[i].elementIndex);
        if (el) {
          const rect = el.getBoundingClientRect();
          const cRect = container.getBoundingClientRect();
          if (rect.top <= cRect.top + 200) activeIdx = i;
        }
      }
      setActiveSceneIdx(activeIdx);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [scenes]);

  const scrollToScene = useCallback((idx: number) => {
    setActiveSceneIdx(idx);
    const scene = scenes[idx];
    if (!scene) return;
    const el = sceneElemRefs.current.get(scene.elementIndex);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scenes]);

  // Fetch annotations for this post
  useEffect(() => {
    if (!postId) return;
    const fetchAnnotations = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('community_comments')
        .select('*, author:profiles!author_id(*)')
        .eq('post_id', postId)
        .eq('comment_type', 'annotation')
        .order('created_at');
      setAnnotations((data || []) as Annotation[]);
    };
    fetchAnnotations();
  }, [postId]);

  const annotationsByLine = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    for (const a of annotations) {
      if (!a.line_ref) continue;
      const list = map.get(a.line_ref) || [];
      list.push(a);
      map.set(a.line_ref, list);
    }
    return map;
  }, [annotations]);

  const handlePostAnnotation = async () => {
    if (!user || !postId || !annotatingLine || !annotationText.trim()) return;
    setPostingAnnotation(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('community_comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        content: annotationText.trim(),
        comment_type: 'annotation',
        line_ref: annotatingLine,
      })
      .select('*, author:profiles!author_id(*)')
      .single();
    if (data && !error) {
      setAnnotations(prev => [...prev, data as Annotation]);
    }
    setAnnotationText('');
    setAnnotatingLine(null);
    setPostingAnnotation(false);
  };

  // Map element index → speaker name (for coloring)
  const elementCharMap = useMemo(() => {
    if (!elements) return new Map<number, string>();
    const m = new Map<number, string>();
    let cur = '';
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.element_type === 'character') {
        cur = el.content.replace(/\s*\(.*?\)$/, '').trim().toUpperCase();
        m.set(i, cur);
      } else if (el.element_type === 'dialogue' || el.element_type === 'parenthetical') {
        if (cur) m.set(i, cur);
      } else {
        cur = '';
      }
    }
    return m;
  }, [elements]);

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

  const annotationCount = annotations.length;

  // Build sidebar tabs
  const sidebarTabs: { key: SidebarTab; label: string }[] = [
    ...(scenes.length > 0 ? [{ key: 'scenes' as const, label: 'Scenes' }] : []),
    ...(characterStats.length > 0 ? [{ key: 'characters' as const, label: 'Cast' }] : []),
    { key: 'stats' as const, label: 'Stats' },
    ...(canAnnotate && annotationCount > 0 ? [{ key: 'annotations' as const, label: `Notes (${annotationCount})` }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-[#0a0a0c] text-white flex flex-col">
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[201] h-[3px] bg-black/40">
        <div
          className="h-full transition-[width] duration-150"
          style={{ width: `${progress}%`, background: 'linear-gradient(to right, #FF5F1F, #f97316)' }}
        />
      </div>

      {/* Top nav */}
      <nav className="sticky top-0 z-[200] bg-[#0a0a0c]/95 backdrop-blur-lg border-b border-white/[0.06]">
        <div className="px-4 flex items-center justify-between h-12">
          {/* Left: close + title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-white/50 hover:text-white transition shrink-0 text-sm"
              title="Close (Esc)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline text-xs">Close</span>
            </button>
            <div className="w-px h-5 bg-white/10" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{title}</p>
              {stats.isStructured && (
                <p className="text-[10px] text-white/40 truncate">
                  {scenes.length} scenes · ~{stats.pageEstimate} pages · ~{stats.readingTimeMin} min read
                </p>
              )}
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {scenes.length > 0 && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`p-2 rounded-md border transition-colors ${sidebarOpen ? 'bg-[#FF5F1F]/10 border-[#FF5F1F]/30 text-[#FF8F5F]' : 'border-white/10 text-white/40 hover:text-white/60'}`}
                title="Toggle sidebar (T)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
                </svg>
              </button>
            )}
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            <button
              onClick={() => setDarkScript(!darkScript)}
              className={`px-2.5 py-1.5 text-[11px] rounded-md border transition-colors ${darkScript ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'border-white/10 text-white/40 hover:text-white/60'}`}
              title="Toggle script background"
            >
              {darkScript ? '🌙' : '☀️'}
            </button>
            {elements && (
              <>
                <button
                  onClick={() => setShowSceneNumbers(!showSceneNumbers)}
                  className={`px-2.5 py-1.5 text-[11px] rounded-md border transition-colors ${showSceneNumbers ? 'bg-[#FF5F1F]/10 border-[#FF5F1F]/30 text-[#FF8F5F]' : 'border-white/10 text-white/40 hover:text-white/60'}`}
                  title="Scene numbers"
                >
                  #
                </button>
                <button
                  onClick={() => setShowCharColors(!showCharColors)}
                  className={`px-2.5 py-1.5 text-[11px] rounded-md border transition-colors ${showCharColors ? 'bg-[#FF5F1F]/10 border-[#FF5F1F]/30 text-[#FF8F5F]' : 'border-white/10 text-white/40 hover:text-white/60'}`}
                  title="Character colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </button>
              </>
            )}
            <div className="flex items-center gap-0.5 ml-1">
              <button onClick={() => setFontSize(s => Math.max(9, s - 1))} className="px-1.5 py-1 text-[10px] text-white/40 hover:text-white rounded border border-white/10 transition">A−</button>
              <span className="text-[10px] text-white/25 w-5 text-center tabular-nums">{fontSize}</span>
              <button onClick={() => setFontSize(s => Math.min(18, s + 1))} className="px-1.5 py-1 text-[10px] text-white/40 hover:text-white rounded border border-white/10 transition">A+</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-72 xl:w-80 shrink-0 border-r border-white/[0.06] bg-[#0c0c0e] flex flex-col overflow-hidden">
            {/* Sidebar tab bar */}
            <div className="flex border-b border-white/[0.06]">
              {sidebarTabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSidebarTab(key)}
                  className={`flex-1 py-2.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                    sidebarTab === key
                      ? 'text-[#FF8F5F] border-b-2 border-[#FF5F1F]'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Scenes tab */}
              {sidebarTab === 'scenes' && (
                <div className="p-3">
                  <input
                    type="text"
                    placeholder="Search scenes…"
                    value={sceneFilter}
                    onChange={e => setSceneFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white/[0.03] border border-white/10 rounded-lg text-white placeholder-white/20 outline-none focus:border-[#FF5F1F]/40 mb-3"
                  />
                  <div className="space-y-0.5">
                    {filteredScenes.map(scene => {
                      const sceneIdx = scenes.indexOf(scene);
                      const isActive = sceneIdx === activeSceneIdx;
                      return (
                        <button
                          key={scene.elementIndex}
                          onClick={() => scrollToScene(sceneIdx)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition group ${
                            isActive
                              ? 'bg-[#FF5F1F]/10 border border-[#FF5F1F]/20'
                              : 'hover:bg-white/[0.03] border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold tabular-nums shrink-0 w-6 text-center ${isActive ? 'text-[#FF8F5F]' : 'text-white/25'}`}>
                              {scene.number}
                            </span>
                            <span className={`text-xs truncate ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/70'}`}>
                              {scene.location || scene.heading}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 ml-8">
                            {scene.setting && (
                              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                                scene.setting.startsWith('INT') ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'
                              }`}>{scene.setting}</span>
                            )}
                            {scene.timeOfDay && <span className="text-[9px] text-white/20">{scene.timeOfDay}</span>}
                            <span className="text-[9px] text-white/15 ml-auto">{scene.lineCount} lines</span>
                          </div>
                        </button>
                      );
                    })}
                    {filteredScenes.length === 0 && (
                      <p className="text-xs text-white/20 text-center py-4">No scenes match</p>
                    )}
                  </div>
                </div>
              )}

              {/* Characters tab */}
              {sidebarTab === 'characters' && (
                <div className="p-3">
                  <input
                    type="text"
                    placeholder="Search characters…"
                    value={charFilter}
                    onChange={e => setCharFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white/[0.03] border border-white/10 rounded-lg text-white placeholder-white/20 outline-none focus:border-[#FF5F1F]/40 mb-3"
                  />
                  <div className="space-y-1">
                    {filteredChars.map((char, i) => (
                      <div key={char.name} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: char.color + '20', color: char.color }}
                        >
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white/70 truncate">{char.name}</p>
                          <p className="text-[10px] text-white/25">{char.lineCount} lines · {char.dialogueWords} words</p>
                        </div>
                        <div className="w-14 h-1.5 bg-white/[0.04] rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: char.color,
                              width: `${Math.min(100, characterStats.length ? char.dialogueWords / characterStats[0].dialogueWords * 100 : 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats tab */}
              {sidebarTab === 'stats' && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Pages (est.)', value: `~${stats.pageEstimate}` },
                      { label: 'Read Time', value: `~${stats.readingTimeMin}m` },
                      { label: 'Total Words', value: stats.wordCount.toLocaleString() },
                      ...(stats.isStructured ? [
                        { label: 'Scenes', value: stats.sceneCount.toString() },
                        { label: 'Characters', value: stats.charCount.toString() },
                      ] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2.5">
                        <p className="text-[10px] text-white/25 uppercase tracking-wider">{label}</p>
                        <p className="text-lg font-bold text-white/75 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  {stats.isStructured && stats.wordCount > 0 && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                      <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Dialogue vs Action</p>
                      <div className="h-2.5 rounded-full overflow-hidden bg-white/[0.04] flex mb-1.5">
                        <div className="h-full" style={{ width: `${stats.dialoguePct}%`, background: '#FF5F1F55' }} />
                        <div className="h-full" style={{ width: `${100 - stats.dialoguePct}%`, background: '#3b82f635' }} />
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span style={{ color: '#FF8F5F70' }}>{stats.dialoguePct}% Dialogue</span>
                        <span className="text-blue-400/40">{100 - stats.dialoguePct}% Action</span>
                      </div>
                    </div>
                  )}

                  {scenes.length > 0 && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                      <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Scene Breakdown</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-blue-400/70">🏠 Interior</span>
                          <span className="text-white/50">{scenes.filter(s => s.setting.startsWith('INT')).length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-green-400/70">🌲 Exterior</span>
                          <span className="text-white/50">{scenes.filter(s => s.setting.startsWith('EXT')).length}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Keyboard</p>
                    {[
                      { key: 'Esc', desc: 'Close reader' },
                      { key: 'T', desc: 'Toggle sidebar' },
                      { key: 'J', desc: 'Next scene' },
                      { key: 'K', desc: 'Prev scene' },
                    ].map(({ key, desc }) => (
                      <div key={key} className="flex items-center gap-2 mb-1">
                        <kbd className="text-[10px] font-mono bg-white/[0.06] text-white/50 px-1.5 py-0.5 rounded">{key}</kbd>
                        <span className="text-[10px] text-white/40">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Annotations tab */}
              {sidebarTab === 'annotations' && (
                <div className="p-3">
                  {annotationCount === 0 ? (
                    <p className="text-xs text-white/20 text-center py-6">No annotations yet</p>
                  ) : (
                    <div className="space-y-3">
                      {annotations.map(a => (
                        <div
                          key={a.id}
                          className="rounded-lg border p-3 cursor-pointer hover:border-[#FF5F1F]/30 transition-colors"
                          style={{ background: '#FF5F1F06', borderColor: '#FF5F1F20' }}
                          onClick={() => setActiveAnnotationLine(a.line_ref)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold" style={{ color: '#FF8F5F' }}>
                              {a.author?.full_name || 'User'}
                            </span>
                            <span className="text-[10px] text-white/20">line {a.line_ref}</span>
                          </div>
                          <p className="text-xs text-white/55 leading-relaxed">{a.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Script content area */}
        <main ref={scriptRef} className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
            {/* Script header */}
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span
                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border"
                  style={{ color: '#FF8F5F', background: '#FF5F1F14', borderColor: '#FF5F1F28' }}
                >
                  Community Script
                </span>
                <span className="text-[10px] text-white/20 uppercase tracking-widest">Read-Only</span>
                {canAnnotate && (
                  <span
                    className="px-2 py-0.5 text-[10px] font-medium rounded-full border"
                    style={{ color: '#FF5F1F80', borderColor: '#FF5F1F25', background: '#FF5F1F06' }}
                  >
                    ✏️ Hover any line to annotate
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-black tracking-tight">{title}</h1>
            </div>

            {/* Script "paper" */}
            <div
              className={`rounded-xl shadow-2xl mx-auto transition-colors duration-300 ${
                darkScript
                  ? 'bg-[#141418] text-[#c8c8cc] shadow-black/60 border border-white/[0.06]'
                  : 'bg-white text-black shadow-black/40'
              }`}
              style={{
                fontFamily: "'Courier Prime', 'Courier New', monospace",
                fontSize: `${fontSize}pt`,
                lineHeight: '1.5',
                maxWidth: '8.5in',
                padding: '0.8in 1.4in 0.8in 1.2in',
              }}
            >
              {/* ── Structured screenplay elements ── */}
              {elements && elements.filter(el => el.element_type !== 'title_page').map((el, i) => {
                if (el.element_type === 'page_break') {
                  return (
                    <div
                      key={i}
                      className={`border-t border-dashed my-6 ${darkScript ? 'border-white/10' : 'border-black/10'}`}
                    />
                  );
                }

                const isScene = el.element_type === 'scene_heading';
                const charName = elementCharMap.get(i);
                const charColor = charName && showCharColors ? hashColor(charName) : undefined;
                const lineRef = i.toString();
                const lineAnnotations = annotationsByLine.get(lineRef) || [];
                const isAnnotating = annotatingLine === lineRef;
                const isAnnotationActive = activeAnnotationLine === lineRef;

                return (
                  <div
                    key={i}
                    ref={isScene ? (ref => {
                      if (ref) sceneElemRefs.current.set(i, ref);
                      else sceneElemRefs.current.delete(i);
                    }) : undefined}
                    className={`relative group ${isScene ? 'scroll-mt-16' : ''}`}
                    style={charColor && !isScene
                      ? { borderLeft: `3px solid ${charColor}`, paddingLeft: '8px', backgroundColor: darkScript ? `${charColor}08` : `${charColor}06` }
                      : undefined
                    }
                  >
                    {/* Annotation count pin */}
                    {lineAnnotations.length > 0 && (
                      <button
                        onClick={() => setActiveAnnotationLine(isAnnotationActive ? null : lineRef)}
                        className="absolute -right-10 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white z-10"
                        style={{ background: '#FF5F1F', opacity: 0.9 }}
                        title={`${lineAnnotations.length} annotation${lineAnnotations.length > 1 ? 's' : ''}`}
                      >
                        {lineAnnotations.length}
                      </button>
                    )}

                    {/* Annotation "+" button (hover, no existing annotations) */}
                    {canAnnotate && !isAnnotating && lineAnnotations.length === 0 && (
                      <button
                        onClick={() => { setAnnotatingLine(lineRef); setAnnotationText(''); }}
                        className="absolute -right-10 top-0.5 w-6 h-6 rounded-full border border-dashed flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        style={{ borderColor: '#FF5F1F50', color: '#FF5F1F70', background: '#FF5F1F08' }}
                      >
                        +
                      </button>
                    )}

                    {/* Scene number */}
                    {isScene && showSceneNumbers && el.scene_number && (
                      <span
                        className={`absolute -left-14 top-0.5 text-[10px] font-bold select-none tabular-nums ${darkScript ? 'text-white/20' : 'text-gray-400'}`}
                      >
                        {el.scene_number}
                      </span>
                    )}

                    {/* Element content */}
                    <div style={getElementStyle(el.element_type, darkScript)}>{el.content}</div>

                    {/* Inline annotation form */}
                    {isAnnotating && (
                      <div className="my-2 flex gap-2" onClick={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={annotationText}
                          onChange={e => setAnnotationText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostAnnotation(); }
                            if (e.key === 'Escape') setAnnotatingLine(null);
                          }}
                          placeholder="Add annotation…"
                          className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none"
                          style={{ background: '#1a1a20', borderColor: '#FF5F1F35', color: '#e8e8ee' }}
                        />
                        <button
                          onClick={handlePostAnnotation}
                          disabled={postingAnnotation || !annotationText.trim()}
                          className="px-3 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-40"
                          style={{ background: '#E54E15' }}
                        >
                          {postingAnnotation ? '…' : 'Add'}
                        </button>
                        <button
                          onClick={() => setAnnotatingLine(null)}
                          className="px-3 py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Annotation thread */}
                    {isAnnotationActive && lineAnnotations.length > 0 && (
                      <div
                        className="my-2 rounded-lg border p-3 space-y-2"
                        style={{ background: '#FF5F1F06', borderColor: '#FF5F1F22' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {lineAnnotations.map(a => (
                          <div key={a.id}>
                            <span className="text-[10px] font-semibold" style={{ color: '#FF8F5F' }}>
                              {a.author?.full_name || 'User'}
                            </span>
                            <p className="text-xs mt-0.5" style={{ color: darkScript ? '#c8c8cc' : '#555' }}>
                              {a.content}
                            </p>
                          </div>
                        ))}
                        {/* Reply input for annotations with existing thread */}
                        {canAnnotate && annotatingLine !== lineRef && (
                          <button
                            onClick={() => { setAnnotatingLine(lineRef); setAnnotationText(''); }}
                            className="text-[10px] mt-1 transition-colors"
                            style={{ color: '#FF5F1F70' }}
                          >
                            + Reply
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Plaintext mode ── */}
              {paragraphs && paragraphs.map((para, i) => {
                const lineRef = i.toString();
                const lineAnnotations = annotationsByLine.get(lineRef) || [];
                const isAnnotating = annotatingLine === lineRef;
                const isAnnotationActive = activeAnnotationLine === lineRef;

                return (
                  <div key={i} className="relative group mb-4">
                    {lineAnnotations.length > 0 && (
                      <button
                        onClick={() => setActiveAnnotationLine(isAnnotationActive ? null : lineRef)}
                        className="absolute -right-10 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white z-10"
                        style={{ background: '#FF5F1F' }}
                      >
                        {lineAnnotations.length}
                      </button>
                    )}
                    {canAnnotate && !isAnnotating && lineAnnotations.length === 0 && (
                      <button
                        onClick={() => { setAnnotatingLine(lineRef); setAnnotationText(''); }}
                        className="absolute -right-10 top-0.5 w-6 h-6 rounded-full border border-dashed flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        style={{ borderColor: '#FF5F1F50', color: '#FF5F1F70', background: '#FF5F1F08' }}
                      >
                        +
                      </button>
                    )}
                    <p className={`text-xs leading-relaxed whitespace-pre-wrap ${darkScript ? 'text-[#c8c8cc]' : 'text-gray-800'}`}>
                      {para}
                    </p>
                    {isAnnotating && (
                      <div className="mt-1.5 flex gap-2">
                        <input
                          autoFocus
                          value={annotationText}
                          onChange={e => setAnnotationText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostAnnotation(); }
                            if (e.key === 'Escape') setAnnotatingLine(null);
                          }}
                          placeholder="Add annotation…"
                          className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none"
                          style={{ background: '#1a1a20', borderColor: '#FF5F1F35', color: '#e8e8ee' }}
                        />
                        <button
                          onClick={handlePostAnnotation}
                          disabled={postingAnnotation || !annotationText.trim()}
                          className="px-3 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-40"
                          style={{ background: '#E54E15' }}
                        >
                          {postingAnnotation ? '…' : 'Add'}
                        </button>
                        <button
                          onClick={() => setAnnotatingLine(null)}
                          className="px-3 py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {isAnnotationActive && lineAnnotations.length > 0 && (
                      <div
                        className="mt-1.5 rounded-lg border p-3 space-y-2"
                        style={{ background: '#FF5F1F06', borderColor: '#FF5F1F22' }}
                      >
                        {lineAnnotations.map(a => (
                          <div key={a.id}>
                            <span className="text-[10px] font-semibold" style={{ color: '#FF8F5F' }}>
                              {a.author?.full_name || 'User'}
                            </span>
                            <p className="text-xs mt-0.5" style={{ color: darkScript ? '#c8c8cc' : '#555' }}>
                              {a.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* End of script marker */}
              <div className={`text-center mt-12 pt-6 border-t ${darkScript ? 'border-white/10 text-white/20' : 'border-black/[0.08] text-gray-300'}`}>
                <p className="text-xs uppercase tracking-[0.3em]">End of Script</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t border-white/[0.04] py-6 px-6 mt-8">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <span className="text-[10px] text-white/20">Screenplay Studio — Community</span>
              <button
                onClick={onClose}
                className="text-[10px] text-white/40 hover:text-[#FF8F5F] transition-colors"
              >
                Close reader ×
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
