'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, LoadingPage, Modal, toast, ToastContainer } from '@/components/ui';
import { SprintTimer } from '@/components/novel/SprintTimer';
import { cn } from '@/lib/utils';
import { setZenMode } from '@/lib/zen-mode';
import { sanitizeProse, countWords, htmlToPlain } from '@/lib/novel/text';
import { numberBinder } from '@/lib/novel/compile';
import { importManuscript } from '@/lib/novel/import';
import { fetchChapters, localDay, logWords, useNovelSettings } from '@/hooks/useNovel';
import {
  NOVEL_KIND_LABELS, NOVEL_STATUS_CONFIG,
  type NovelChapter, type NovelChapterStatus, type NovelItemKind, type NovelSnapshot, type NovelTense,
} from '@/lib/types';

// ── Display preferences (per browser) ───────────────────────────────────────

type FontChoice = 'serif' | 'sans' | 'mono';
interface DisplayPrefs { font: FontChoice; size: number; width: 'narrow' | 'medium' | 'wide'; smartQuotes: boolean; typewriter: boolean }
const DEFAULT_PREFS: DisplayPrefs = { font: 'serif', size: 19, width: 'medium', smartQuotes: true, typewriter: false };
const PREFS_KEY = 'ss-novel-display';
const FONT_STACK: Record<FontChoice, string> = {
  serif: "'Literata', Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  sans: "Inter, ui-sans-serif, system-ui, sans-serif",
  mono: "'Courier Prime', 'Courier New', ui-monospace, monospace",
};
const WIDTH: Record<DisplayPrefs['width'], string> = { narrow: '34rem', medium: '42rem', wide: '54rem' };

function loadPrefs(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

const LABEL_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#64748b'];

const FRONT_TEMPLATES = ['Dedication', 'Epigraph', 'Foreword', 'Preface', 'Prologue', 'Map', 'Cast of Characters'];
const BACK_TEMPLATES = ['Epilogue', 'Afterword', "Author's Note", 'Acknowledgements', 'About the Author', 'Glossary', 'Reading Group Guide'];

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export default function ManuscriptPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const { settings } = useNovelSettings(projectId);

  const [items, setItems] = useState<NovelChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<NovelChapter | null>(null);
  const [characters, setCharacters] = useState<{ id: string; name: string }[]>([]);

  const [liveWords, setLiveWords] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [sessionWords, setSessionWords] = useState(0);
  const [todayLogged, setTodayLogged] = useState(0);

  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_PREFS);
  const [showBinder, setShowBinder] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [focus, setFocus] = useState(false);
  const [showDisplay, setShowDisplay] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [addMenu, setAddMenu] = useState(false);

  const [snapshots, setSnapshots] = useState<NovelSnapshot[]>([]);
  const [previewSnap, setPreviewSnap] = useState<NovelSnapshot | null>(null);
  const [snapLabel, setSnapLabel] = useState('');

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<NovelChapter | null>(null);
  const dirty = useRef(false);
  const lastSavedWords = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Prose waiting for the editor element to mount after a chapter switch. */
  const pendingHtml = useRef<string | null>(null);

  activeRef.current = active;

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setPrefs(loadPrefs());
    // Small screens start with just the page; binder and inspector open as overlays.
    if (window.matchMedia('(max-width: 767px)').matches) setShowBinder(false);
    if (window.matchMedia('(max-width: 1023px)').matches) setShowInspector(false);
  }, []);
  const isNarrow = () => window.matchMedia('(max-width: 767px)').matches;
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
  }, [prefs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [rows, chars, log] = await Promise.all([
        fetchChapters(projectId),
        supabase.from('characters').select('id, name').eq('project_id', projectId).order('name'),
        user ? supabase.from('novel_writing_log').select('words').eq('project_id', projectId).eq('user_id', user.id).eq('day', localDay()) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setItems(rows);
      setCharacters((chars.data as { id: string; name: string }[]) || []);
      setTodayLogged(((log.data as { words: number }[]) || []).reduce((n, r) => n + r.words, 0));
      const firstChapter = rows.find((r) => r.kind === 'chapter') || rows[0];
      if (firstChapter) setActiveId(firstChapter.id);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, user]);

  // ── Saving ────────────────────────────────────────────────────────────────

  const saveNow = useCallback(async () => {
    const chapter = activeRef.current;
    const el = editorRef.current;
    if (!chapter || !el || !dirty.current || !canEdit) return;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    dirty.current = false;
    setSaveState('saving');
    const html = sanitizeProse(el.innerHTML);
    const words = countWords(html);
    const { error } = await createClient().from('novel_chapters').update({ content: html, word_count: words }).eq('id', chapter.id);
    if (error) {
      dirty.current = true;
      setSaveState('error');
      return;
    }
    const delta = words - lastSavedWords.current;
    lastSavedWords.current = words;
    if (delta > 0) {
      setSessionWords((n) => n + delta);
      logWords(projectId, delta);
    }
    setItems((prev) => prev.map((c) => (c.id === chapter.id ? { ...c, word_count: words } : c)));
    setSaveState(dirty.current ? 'unsaved' : 'saved');
  }, [canEdit, projectId]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
    setSaveState('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveNow(); }, 1200);
  }, [saveNow]);

  // Flush on tab close / navigation.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) { saveNow(); e.preventDefault(); }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('beforeunload', onUnload); saveNow(); };
  }, [saveNow]);

  // ── Switching chapters ────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeId) { setActive(null); return; }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [{ data }, snaps] = await Promise.all([
        supabase.from('novel_chapters').select('*').eq('id', activeId).single(),
        supabase.from('novel_snapshots').select('id, project_id, chapter_id, label, title, word_count, created_by, created_at').eq('chapter_id', activeId).order('created_at', { ascending: false }),
      ]);
      if (cancelled || !data) return;
      const chapter = data as NovelChapter;
      setActive(chapter);
      setSnapshots((snaps.data as NovelSnapshot[]) || []);
      const html = sanitizeProse(chapter.content || '');
      pendingHtml.current = html;
      lastSavedWords.current = countWords(html);
      setLiveWords(lastSavedWords.current);
      setSaveState('saved');
      scrollRef.current?.scrollTo({ top: 0 });
    })();
    return () => { cancelled = true; };
  }, [activeId]);

  // The editor is uncontrolled (React re-rendering a contentEditable moves the
  // caret), so prose goes in once per chapter, after the element exists.
  useLayoutEffect(() => {
    if (editorRef.current && pendingHtml.current !== null) {
      editorRef.current.innerHTML = pendingHtml.current;
      pendingHtml.current = null;
    }
  }, [active?.id]);

  const selectChapter = async (id: string) => {
    if (isNarrow()) setShowBinder(false);
    if (id === activeId) return;
    await saveNow();
    setActiveId(id);
  };

  // ── Metadata ──────────────────────────────────────────────────────────────

  const patchChapter = async (id: string, patch: Partial<NovelChapter>) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setActive((a) => (a && a.id === id ? { ...a, ...patch } : a));
    const { error } = await createClient().from('novel_chapters').update(patch).eq('id', id);
    if (error) toast('Could not save that change', 'error');
  };

  const persistOrder = async (list: NovelChapter[]) => {
    const changed = list.map((c, i) => ({ c, i })).filter(({ c, i }) => c.sort_order !== i);
    const next = list.map((c, i) => ({ ...c, sort_order: i }));
    setItems(next);
    const supabase = createClient();
    await Promise.all(changed.map(({ c, i }) => supabase.from('novel_chapters').update({ sort_order: i }).eq('id', c.id)));
  };

  const addItem = async (kind: NovelItemKind, title = '') => {
    if (!canEdit) return;
    setAddMenu(false);
    await saveNow();
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
    let at = ordered.length;
    if (kind === 'front_matter') {
      at = ordered.findIndex((c) => c.kind !== 'front_matter');
      if (at === -1) at = ordered.length;
    } else if (kind !== 'back_matter' && activeId) {
      const idx = ordered.findIndex((c) => c.id === activeId);
      if (idx !== -1 && ordered[idx].kind !== 'back_matter') at = idx + 1;
      else {
        const firstBack = ordered.findIndex((c) => c.kind === 'back_matter');
        if (firstBack !== -1) at = firstBack;
      }
    }
    const { data, error } = await createClient().from('novel_chapters').insert({
      project_id: projectId, kind, title, status: kind === 'part' ? 'final' : 'draft', sort_order: at, created_by: user?.id,
    }).select('*').single();
    if (error || !data) { toast(error?.message || 'Could not add', 'error'); return; }
    const row = { ...(data as NovelChapter), content: '' };
    const list = [...ordered];
    list.splice(at, 0, row);
    await persistOrder(list);
    setActiveId(row.id);
    setTimeout(() => editorRef.current?.focus(), 150);
  };

  const importFile = async (file: File) => {
    setAddMenu(false);
    const raw = await file.text();
    const sections = importManuscript(raw);
    const words = sections.reduce((n, s) => n + countWords(s.content), 0);
    if (!sections.length || !words) { toast('No text found in that file', 'error'); return; }
    if (!confirm(`Add ${sections.length} ${sections.length === 1 ? 'section' : 'sections'} (${words.toLocaleString()} words) from ${file.name} to the end of the binder?`)) return;
    await saveNow();
    const base = items.length;
    const { data, error } = await createClient().from('novel_chapters').insert(sections.map((sec, i) => ({
      project_id: projectId, kind: sec.kind, title: sec.title, content: sec.content, word_count: countWords(sec.content),
      status: sec.kind === 'part' ? 'final' : 'draft', sort_order: base + i, created_by: user?.id,
    }))).select('id, project_id, kind, title, synopsis, status, pov_character_id, pov, tense, label_color, target_words, word_count, notes, include_in_export, sort_order, created_by, created_at, updated_at');
    if (error || !data) { toast(error?.message || 'Import failed', 'error'); return; }
    const rows = (data as NovelChapter[]).map((r) => ({ ...r, content: '' }));
    setItems((prev) => [...prev, ...rows]);
    const first = rows.find((r) => r.kind === 'chapter') || rows[0];
    if (first) setActiveId(first.id);
    toast(`Imported ${rows.length} sections`, 'success');
  };

  const deleteItem = async (id: string) => {
    const item = items.find((c) => c.id === id);
    if (!item) return;
    const what = item.title || NOVEL_KIND_LABELS[item.kind].toLowerCase();
    if (!confirm(`Delete "${what}"${item.word_count ? ` and its ${item.word_count.toLocaleString()} words` : ''}? Its snapshots are deleted too. This can't be undone.`)) return;
    dirty.current = false;
    const { error } = await createClient().from('novel_chapters').delete().eq('id', id);
    if (error) { toast('Could not delete', 'error'); return; }
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex((c) => c.id === id);
    const rest = ordered.filter((c) => c.id !== id);
    setItems(rest);
    if (activeId === id) setActiveId(rest[Math.max(0, idx - 1)]?.id ?? null);
  };

  const move = async (id: string, dir: -1 | 1) => {
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const i = ordered.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    await persistOrder(ordered);
  };

  const dropOn = async (targetId: string, after: boolean) => {
    if (!dragId || dragId === targetId) return;
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const dragged = ordered.find((c) => c.id === dragId)!;
    const rest = ordered.filter((c) => c.id !== dragId);
    let at = rest.findIndex((c) => c.id === targetId);
    if (after) at += 1;
    rest.splice(at, 0, dragged);
    setDragId(null);
    setDropTarget(null);
    await persistOrder(rest);
  };

  // ── Snapshots ─────────────────────────────────────────────────────────────

  const takeSnapshot = async (label?: string) => {
    const chapter = activeRef.current;
    const el = editorRef.current;
    if (!chapter || !el) return null;
    await saveNow();
    const html = sanitizeProse(el.innerHTML);
    const { data, error } = await createClient().from('novel_snapshots').insert({
      project_id: projectId, chapter_id: chapter.id, label: label ?? null, title: chapter.title, content: html,
      word_count: countWords(html), created_by: user?.id,
    }).select('id, project_id, chapter_id, label, title, word_count, created_by, created_at').single();
    if (error || !data) { toast('Snapshot failed', 'error'); return null; }
    setSnapshots((s) => [data as NovelSnapshot, ...s]);
    return data;
  };

  const openSnapshot = async (snap: NovelSnapshot) => {
    const { data } = await createClient().from('novel_snapshots').select('*').eq('id', snap.id).single();
    if (data) setPreviewSnap(data as NovelSnapshot);
  };

  const restoreSnapshot = async (snap: NovelSnapshot) => {
    if (!editorRef.current || !active) return;
    if (!confirm('Replace this chapter with the snapshot? The current text is saved as a snapshot first.')) return;
    await takeSnapshot('Before restore');
    editorRef.current.innerHTML = sanitizeProse(snap.content);
    setLiveWords(countWords(snap.content));
    dirty.current = true;
    await saveNow();
    setPreviewSnap(null);
    toast('Snapshot restored', 'success');
  };

  const deleteSnapshot = async (id: string) => {
    if (!confirm('Delete this snapshot?')) return;
    await createClient().from('novel_snapshots').delete().eq('id', id);
    setSnapshots((s) => s.filter((x) => x.id !== id));
  };

  // ── Editor behaviour ──────────────────────────────────────────────────────

  const centerCaret = useCallback(() => {
    if (!prefs.typewriter || !scrollRef.current) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.height && !rect.top) return;
    const box = scrollRef.current.getBoundingClientRect();
    const target = box.top + box.height * 0.45;
    scrollRef.current.scrollBy({ top: rect.top - target, behavior: 'smooth' });
  }, [prefs.typewriter]);

  const onInput = () => {
    const el = editorRef.current;
    if (!el) return;
    // Text typed into an empty editor or after a scene break is a bare text
    // node; make it a paragraph so indents and spacing apply straight away.
    const anchor = window.getSelection()?.anchorNode;
    if (anchor?.nodeType === Node.TEXT_NODE && anchor.parentNode === el && (anchor.textContent || '').trim()) {
      document.execCommand('formatBlock', false, 'p');
    }
    setLiveWords(countWords(el.innerText));
    scheduleSave();
    centerCaret();
  };

  const charBeforeCaret = (): string => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return '';
    const r = sel.getRangeAt(0);
    if (r.startContainer.nodeType === Node.TEXT_NODE) return (r.startContainer.textContent || '').slice(Math.max(0, r.startOffset - 1), r.startOffset);
    return '';
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); return; }
    if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); setShowFind(true); return; }
    if (!prefs.smartQuotes || mod || e.altKey) return;
    if (e.key === '"' || e.key === "'") {
      e.preventDefault();
      const prev = charBeforeCaret();
      const opening = !prev || /[\s(\[{—–-]/.test(prev);
      const ch = e.key === '"' ? (opening ? '“' : '”') : (opening ? '‘' : '’');
      document.execCommand('insertText', false, ch);
    } else if (e.key === '-' && charBeforeCaret() === '-') {
      e.preventDefault();
      document.execCommand('delete');
      document.execCommand('insertText', false, '—');
    } else if (e.key === '.' && /\.\.$/.test(textBeforeCaret(2))) {
      e.preventDefault();
      document.execCommand('delete');
      document.execCommand('delete');
      document.execCommand('insertText', false, '…');
    }
  };

  const textBeforeCaret = (n: number): string => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return '';
    const r = sel.getRangeAt(0);
    if (r.startContainer.nodeType !== Node.TEXT_NODE) return '';
    return (r.startContainer.textContent || '').slice(Math.max(0, r.startOffset - n), r.startOffset);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    let clean: string;
    if (html) {
      clean = sanitizeProse(html);
    } else {
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const paras = text.split(/\r?\n/).map((l) => l.trim());
      // A single line pastes inline; several become paragraphs.
      clean = paras.length <= 1 ? esc(text) : paras.filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
    }
    document.execCommand('insertHTML', false, clean);
    onInput();
  };

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    onInput();
  };

  const toggleCenter = () => {
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;
    while (node && node !== editorRef.current && !(node instanceof HTMLElement && node.tagName === 'P')) node = node.parentNode;
    if (node instanceof HTMLElement && node.tagName === 'P') {
      node.classList.toggle('center');
      onInput();
    }
  };

  // Focus mode hides the app chrome; Esc leaves it.
  useEffect(() => {
    setZenMode(focus);
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocus(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);
  useEffect(() => () => setZenMode(false), []);

  // Close the Add menu and display panel on an outside click or Escape.
  useEffect(() => {
    if (!addMenu && !showDisplay) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof MouseEvent && (e.target as HTMLElement).closest('[data-popover]')) return;
      setAddMenu(false);
      setShowDisplay(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [addMenu, showDisplay]);

  useEffect(() => {
    const onDefault = () => document.execCommand('defaultParagraphSeparator', false, 'p');
    onDefault();
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const ordered = useMemo(() => [...items].sort((a, b) => a.sort_order - b.sort_order), [items]);
  const labels = useMemo(() => numberBinder(ordered, 'numerals'), [ordered]);
  const bookWords = ordered.reduce((n, c) => n + (c.id === activeId ? liveWords : c.word_count), 0);
  const target = settings.target_words || 0;
  const dailyGoal = settings.daily_goal || 0;
  const todayWords = todayLogged + sessionWords;
  const chapterTarget = active?.target_words || 0;

  // Parts own the chapters that follow them, for indentation in the binder.
  const inPart = useMemo(() => {
    const set = new Set<string>();
    let open = false;
    for (const c of ordered) {
      if (c.kind === 'part') open = true;
      else if (c.kind === 'front_matter' || c.kind === 'back_matter') open = false;
      else if (open) set.add(c.id);
    }
    return set;
  }, [ordered]);

  if (loading) return <LoadingPage />;

  const binderTitle = (c: NovelChapter) => {
    const label = labels.get(c.id);
    if (c.kind === 'part') return c.title || label || 'Untitled part';
    if (c.kind === 'chapter') return c.title ? `${label?.replace('Chapter ', '')}. ${c.title}` : label || 'Chapter';
    return c.title || NOVEL_KIND_LABELS[c.kind];
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn(
      focus ? 'fixed inset-0 z-[200] flex bg-surface-950' : 'relative flex h-[calc(100dvh-3rem)] md:h-[100dvh]',
      'overflow-hidden',
    )}>
      <ToastContainer />
      <style jsx global>{`
        .novel-prose { outline: none; caret-color: rgb(var(--brand-400)); }
        .novel-prose p { margin: 0; text-indent: 1.5em; }
        .novel-prose p:first-child, .novel-prose hr + p, .novel-prose h2 + p, .novel-prose blockquote + p, .novel-prose p.no-indent { text-indent: 0; }
        .novel-prose p.center { text-align: center; text-indent: 0; }
        .novel-prose h2 { font-size: 1.05em; font-weight: 700; text-align: center; margin: 1.4em 0 0.8em; }
        .novel-prose blockquote { margin: 1em 2em; font-style: italic; opacity: 0.9; }
        .novel-prose hr { border: 0; height: 2.2em; margin: 0.4em 0; position: relative; }
        .novel-prose hr::after { content: '* * *'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; letter-spacing: 0.3em; opacity: 0.6; }
        .novel-prose:empty::before { content: attr(data-placeholder); opacity: 0.35; pointer-events: none; }
        .novel-prose mark.find-hit { background: rgb(250 204 21 / 0.4); color: inherit; border-radius: 2px; }
      `}</style>

      {/* ── Binder ─────────────────────────────────────────────────────── */}
      {showBinder && !focus && (
        <aside className="w-64 shrink-0 border-r border-surface-800 bg-surface-900/40 flex flex-col max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:bg-surface-950 max-md:shadow-2xl">
          <div className="flex items-center justify-between px-3 py-3 border-b border-surface-800">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setShowBinder(false)} className="md:hidden -ml-1 p-1 text-surface-400 hover:text-white" aria-label="Close binder">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Binder</h2>
            </div>
            {canEdit && (
              <div className="relative" data-popover>
                <button
                  type="button"
                  onClick={() => setAddMenu((o) => !o)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-300 hover:bg-teal-500/10"
                  aria-haspopup="menu"
                  aria-expanded={addMenu}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M12 5v14M5 12h14" /></svg>
                  Add
                </button>
                {addMenu && (
                  <div role="menu" className="absolute right-0 top-full mt-1 z-30 w-56 rounded-xl border border-surface-700 bg-surface-900 py-1 shadow-xl max-h-[70vh] overflow-y-auto">
                    <MenuItem onClick={() => addItem('chapter')}>Chapter</MenuItem>
                    <MenuItem onClick={() => addItem('part')}>Part</MenuItem>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-surface-500">Front matter</p>
                    {FRONT_TEMPLATES.map((t) => <MenuItem key={t} onClick={() => addItem('front_matter', t)}>{t}</MenuItem>)}
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-surface-500">Back matter</p>
                    {BACK_TEMPLATES.map((t) => <MenuItem key={t} onClick={() => addItem('back_matter', t)}>{t}</MenuItem>)}
                    <div className="my-1 border-t border-surface-800" />
                    <MenuItem onClick={() => importRef.current?.click()}>Import from a text or Markdown file…</MenuItem>
                  </div>
                )}
              </div>
            )}
          </div>

          <input
            ref={importRef}
            type="file"
            accept=".txt,.text,.md,.markdown"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }}
          />
          <ol className="flex-1 overflow-y-auto py-2" aria-label="Manuscript sections">
            {ordered.map((c) => {
              const isActive = c.id === activeId;
              const st = NOVEL_STATUS_CONFIG[c.status];
              const isDrop = dropTarget?.id === c.id;
              return (
                <li
                  key={c.id}
                  draggable={canEdit}
                  onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    const r = e.currentTarget.getBoundingClientRect();
                    setDropTarget({ id: c.id, after: e.clientY > r.top + r.height / 2 });
                  }}
                  onDrop={(e) => { e.preventDefault(); if (dropTarget) dropOn(dropTarget.id, dropTarget.after); }}
                  className={cn(
                    'relative',
                    isDrop && !dropTarget?.after && 'before:absolute before:inset-x-2 before:top-0 before:h-0.5 before:bg-teal-400',
                    isDrop && dropTarget?.after && 'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-teal-400',
                    dragId === c.id && 'opacity-40',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectChapter(c.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'group w-full flex items-center gap-2 pr-2 py-1.5 text-left text-[13px] transition-colors',
                      inPart.has(c.id) ? 'pl-6' : 'pl-3',
                      c.kind === 'part' && 'mt-2 font-semibold uppercase tracking-wide text-[11px]',
                      isActive ? 'bg-teal-500/10 text-white' : 'text-surface-300 hover:bg-surface-800/60 hover:text-white',
                    )}
                  >
                    {c.label_color
                      ? <span className="w-1 h-4 rounded-full shrink-0" style={{ background: c.label_color }} />
                      : <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.kind === 'part' ? 'bg-transparent' : st.dot)} />}
                    <span className={cn('flex-1 truncate', (c.kind === 'front_matter' || c.kind === 'back_matter') && 'italic text-surface-400')}>
                      {binderTitle(c)}
                    </span>
                    {c.kind !== 'part' && (
                      <span className="text-[10px] tabular-nums text-surface-500">
                        {(c.id === activeId ? liveWords : c.word_count).toLocaleString()}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="border-t border-surface-800 px-3 py-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-surface-400">Book</span>
              <span className="tabular-nums text-white font-medium">
                {bookWords.toLocaleString()}{target ? <span className="text-surface-500"> / {target.toLocaleString()}</span> : null}
              </span>
            </div>
            {target > 0 && (
              <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden" role="progressbar" aria-valuenow={bookWords} aria-valuemax={target} aria-label="Book word target">
                <div className="h-full bg-teal-500" style={{ width: `${Math.min(100, (bookWords / target) * 100)}%` }} />
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-surface-400">Today</span>
              <span className="tabular-nums text-white">
                {todayWords.toLocaleString()}{dailyGoal ? <span className="text-surface-500"> / {dailyGoal.toLocaleString()}</span> : null}
              </span>
            </div>
          </div>
        </aside>
      )}

      {/* ── Editor ─────────────────────────────────────────────────────── */}
      <section className="flex-1 min-w-0 flex flex-col">
        <div className={cn(
          'flex items-center gap-1 border-b border-surface-800 px-2 py-1.5 overflow-x-auto',
          focus && 'border-transparent opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300',
        )}>
          {!focus && (
            <ToolButton label={showBinder ? 'Hide binder' : 'Show binder'} onClick={() => setShowBinder((v) => !v)}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5h16v14H4zM9 5v14" />
            </ToolButton>
          )}
          <span className="w-px h-5 bg-surface-800 mx-1" />
          {canEdit && active && (
            <>
              <ToolButton label="Bold (⌘B)" onClick={() => exec('bold')}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" /></ToolButton>
              <ToolButton label="Italic (⌘I)" onClick={() => exec('italic')}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 5h8M6 19h8M14 5l-4 14" /></ToolButton>
              <ToolButton label="Underline (⌘U)" onClick={() => exec('underline')}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v7a5 5 0 0010 0V4M5 20h14" /></ToolButton>
              <ToolButton label="Strikethrough" onClick={() => exec('strikeThrough')}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12h16M16 6.5A4 3 0 008 7c0 4 8 3 8 7a4 3 0 01-8 .5" /></ToolButton>
              <span className="w-px h-5 bg-surface-800 mx-1" />
              <ToolButton label="Paragraph" onClick={() => exec('formatBlock', 'p')}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 4v16M17 4v16M19 4H10a4 4 0 000 8h3" /></ToolButton>
              <ToolButton label="Heading within chapter" onClick={() => exec('formatBlock', 'h2')}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5v14M13 5v14M5 12h8M17 10l2-1v10" /></ToolButton>
              <ToolButton label="Quote / epigraph / letter" onClick={() => exec('formatBlock', 'blockquote')}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6" /></ToolButton>
              <ToolButton label="Centre paragraph" onClick={toggleCenter}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M7 10h10M4 14h16M7 18h10" /></ToolButton>
              <ToolButton label="Scene break" onClick={() => exec('insertHorizontalRule')}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h.01M12 12h.01M18 12h.01" /></ToolButton>
              <span className="w-px h-5 bg-surface-800 mx-1" />
              <ToolButton label="Undo (⌘Z)" onClick={() => exec('undo')}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3" /></ToolButton>
              <ToolButton label="Redo (⇧⌘Z)" onClick={() => exec('redo')}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3" /></ToolButton>
              <ToolButton label="Find & replace (⌘F)" onClick={() => setShowFind((v) => !v)} active={showFind}><circle cx="11" cy="11" r="6" strokeWidth={1.5} /><path strokeLinecap="round" strokeWidth={1.5} d="M20 20l-4.5-4.5" /></ToolButton>
            </>
          )}

          <div className="ml-auto flex items-center gap-1 shrink-0">
            <span className={cn('px-2 text-[11px] tabular-nums', saveState === 'error' ? 'text-red-400' : 'text-surface-500')} aria-live="polite">
              {saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved' : saveState === 'error' ? 'Save failed — retrying on next edit' : 'Saved'}
            </span>
            <span className="px-2 text-xs tabular-nums text-surface-300" title="Words in this section">
              {liveWords.toLocaleString()}{chapterTarget ? <span className="text-surface-500"> / {chapterTarget.toLocaleString()}</span> : null} words
            </span>
            {canEdit && active && (
              <SprintTimer
                getWords={() => countWords(editorRef.current?.innerText || '') + ordered.filter((c) => c.id !== activeId).reduce((n, c) => n + c.word_count, 0)}
                onFinish={({ words }) => { saveNow(); logWords(projectId, 0, 1); toast(`Sprint done: ${words} words`, 'success'); }}
              />
            )}
            <div className="relative" data-popover>
              <ToolButton label="Display settings" onClick={() => setShowDisplay((v) => !v)} active={showDisplay}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7h3m4 0h9M4 17h9m4 0h3M7 4v6M17 14v6" />
              </ToolButton>
              {showDisplay && (
                <DisplayPanel prefs={prefs} onChange={(p) => setPrefs((cur) => ({ ...cur, ...p }))} onClose={() => setShowDisplay(false)} />
              )}
            </div>
            <ToolButton label={focus ? 'Leave focus mode (Esc)' : 'Focus mode'} onClick={() => setFocus((f) => !f)} active={focus}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
            </ToolButton>
            {!focus && (
              <ToolButton label={showInspector ? 'Hide inspector' : 'Show inspector'} onClick={() => setShowInspector((v) => !v)}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5h16v14H4zM15 5v14" />
              </ToolButton>
            )}
          </div>
        </div>

        {showFind && active && (
          <FindReplace editor={editorRef} onChanged={onInput} onClose={() => setShowFind(false)} canEdit={canEdit} />
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!active ? (
            <EmptyBinder canEdit={canEdit} hasItems={ordered.length > 0} onStart={() => addItem('chapter')} onImport={() => importRef.current?.click()} />
          ) : (
            <div className="mx-auto px-6 sm:px-10 pt-12" style={{ maxWidth: WIDTH[prefs.width], paddingBottom: prefs.typewriter ? '50vh' : '30vh' }}>
              {active.kind !== 'front_matter' && active.kind !== 'back_matter' && labels.get(active.id) && (
                <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-surface-500 mb-2">{labels.get(active.id)}</p>
              )}
              <input
                key={active.id}
                defaultValue={active.title}
                readOnly={!canEdit}
                onBlur={(e) => { if (e.target.value !== active.title) patchChapter(active.id, { title: e.target.value }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); } }}
                placeholder={active.kind === 'part' ? 'Part title' : active.kind === 'chapter' ? 'Chapter title (optional)' : 'Title'}
                aria-label="Section title"
                className="w-full bg-transparent text-center text-2xl font-semibold text-white placeholder:text-surface-600 outline-none mb-10"
                style={{ fontFamily: FONT_STACK[prefs.font] }}
              />
              {active.kind === 'part' && (
                <p className="text-center text-sm text-surface-500 mb-6">A part page. Anything you write here appears under the part title, before its first chapter.</p>
              )}
              <div
                ref={editorRef}
                contentEditable={canEdit}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Manuscript text"
                spellCheck
                data-placeholder={canEdit ? 'Start writing…' : ''}
                onInput={onInput}
                onKeyDown={onKeyDown}
                onKeyUp={centerCaret}
                onClick={centerCaret}
                onPaste={onPaste}
                onBlur={() => saveNow()}
                className="novel-prose text-surface-100"
                style={{ fontFamily: FONT_STACK[prefs.font], fontSize: `${prefs.size}px`, lineHeight: prefs.font === 'mono' ? 2 : 1.75 }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Inspector ──────────────────────────────────────────────────── */}
      {showInspector && !focus && active && (
        <aside className="w-72 shrink-0 border-l border-surface-800 bg-surface-900/40 overflow-y-auto max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:bg-surface-950 max-lg:shadow-2xl">
          <div className="p-4 space-y-5">
            <button type="button" onClick={() => setShowInspector(false)} className="lg:hidden flex items-center gap-1 text-xs text-surface-400 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
              Close inspector
            </button>
            <Field label="Type">
              <select
                value={active.kind}
                disabled={!canEdit}
                onChange={(e) => patchChapter(active.id, { kind: e.target.value as NovelItemKind })}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-1.5 text-sm text-white"
              >
                {(Object.keys(NOVEL_KIND_LABELS) as NovelItemKind[]).map((k) => <option key={k} value={k}>{NOVEL_KIND_LABELS[k]}</option>)}
              </select>
            </Field>

            {active.kind !== 'part' && (
              <Field label="Status">
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(NOVEL_STATUS_CONFIG) as NovelChapterStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => patchChapter(active.id, { status: s })}
                      aria-pressed={active.status === s}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
                        active.status === s ? 'bg-surface-700 text-white' : 'text-surface-400 hover:bg-surface-800',
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', NOVEL_STATUS_CONFIG[s].dot)} />
                      {NOVEL_STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field label="Synopsis">
              <textarea
                key={`syn-${active.id}`}
                defaultValue={active.synopsis || ''}
                readOnly={!canEdit}
                onBlur={(e) => { if ((active.synopsis || '') !== e.target.value) patchChapter(active.id, { synopsis: e.target.value || null }); }}
                rows={4}
                placeholder="What happens here, in a sentence or two"
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-2 text-sm text-white placeholder:text-surface-600 resize-y"
              />
            </Field>

            {active.kind === 'chapter' && (
              <>
                <Field label="Point of view">
                  <select
                    value={active.pov_character_id || ''}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const ch = characters.find((c) => c.id === e.target.value);
                      patchChapter(active.id, { pov_character_id: e.target.value || null, pov: ch?.name ?? active.pov });
                    }}
                    className="w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-1.5 text-sm text-white"
                  >
                    <option value="">— No character —</option>
                    {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {!active.pov_character_id && (
                    <input
                      key={`pov-${active.id}`}
                      defaultValue={active.pov || ''}
                      readOnly={!canEdit}
                      onBlur={(e) => { if ((active.pov || '') !== e.target.value) patchChapter(active.id, { pov: e.target.value || null }); }}
                      placeholder="Or describe it: omniscient, first person…"
                      className="mt-1.5 w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-1.5 text-sm text-white placeholder:text-surface-600"
                    />
                  )}
                </Field>

                <Field label="Tense">
                  <div className="flex gap-1">
                    {(['past', 'present', 'future', 'mixed'] as NovelTense[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        disabled={!canEdit}
                        aria-pressed={active.tense === t}
                        onClick={() => patchChapter(active.id, { tense: active.tense === t ? null : t })}
                        className={cn('flex-1 rounded-md px-2 py-1 text-xs capitalize', active.tense === t ? 'bg-surface-700 text-white' : 'text-surface-400 hover:bg-surface-800')}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}

            {active.kind !== 'part' && (
              <Field label="Target words">
                <input
                  key={`tw-${active.id}`}
                  type="number"
                  min={0}
                  step={250}
                  defaultValue={active.target_words ?? ''}
                  readOnly={!canEdit}
                  onBlur={(e) => {
                    const v = e.target.value ? parseInt(e.target.value, 10) : null;
                    if (v !== active.target_words) patchChapter(active.id, { target_words: v });
                  }}
                  placeholder="e.g. 3000"
                  className="w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-1.5 text-sm text-white placeholder:text-surface-600"
                />
                {chapterTarget > 0 && (
                  <div className="mt-2 h-1.5 rounded-full bg-surface-800 overflow-hidden">
                    <div className="h-full bg-teal-500" style={{ width: `${Math.min(100, (liveWords / chapterTarget) * 100)}%` }} />
                  </div>
                )}
              </Field>
            )}

            <Field label="Label">
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => patchChapter(active.id, { label_color: null })}
                  className={cn('w-6 h-6 rounded-full border border-surface-600 text-[10px] text-surface-500', !active.label_color && 'ring-2 ring-white/60')}
                  aria-label="No label"
                >
                  ×
                </button>
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => patchChapter(active.id, { label_color: c })}
                    className={cn('w-6 h-6 rounded-full', active.label_color === c && 'ring-2 ring-white/70 ring-offset-2 ring-offset-surface-900')}
                    style={{ background: c }}
                    aria-label={`Label ${c}`}
                  />
                ))}
              </div>
            </Field>

            <label className="flex items-center gap-2 text-sm text-surface-300">
              <input
                type="checkbox"
                checked={active.include_in_export}
                disabled={!canEdit}
                onChange={(e) => patchChapter(active.id, { include_in_export: e.target.checked })}
                className="rounded border-surface-600 bg-surface-800"
              />
              Include in export
            </label>

            <Field label="Notes">
              <textarea
                key={`notes-${active.id}`}
                defaultValue={active.notes || ''}
                readOnly={!canEdit}
                onBlur={(e) => { if ((active.notes || '') !== e.target.value) patchChapter(active.id, { notes: e.target.value || null }); }}
                rows={5}
                placeholder="Research, reminders, things to fix"
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-2 text-sm text-white placeholder:text-surface-600 resize-y"
              />
            </Field>

            <Field label="Snapshots">
              {canEdit && (
                <form
                  className="flex gap-1.5 mb-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await takeSnapshot(snapLabel.trim() || undefined)) { setSnapLabel(''); toast('Snapshot saved', 'success'); }
                  }}
                >
                  <input
                    value={snapLabel}
                    onChange={(e) => setSnapLabel(e.target.value)}
                    placeholder="Name (optional)"
                    aria-label="Snapshot name"
                    className="min-w-0 flex-1 rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-1.5 text-xs text-white placeholder:text-surface-600"
                  />
                  <Button size="sm" variant="secondary" type="submit">Snapshot</Button>
                </form>
              )}
              {snapshots.length === 0 ? (
                <p className="text-xs text-surface-500">Save a copy before a big rewrite. You can compare and restore it later.</p>
              ) : (
                <ul className="space-y-1">
                  {snapshots.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-800">
                      <button type="button" onClick={() => openSnapshot(s)} className="flex-1 min-w-0 text-left">
                        <p className="text-xs text-white truncate">{s.label || new Date(s.created_at).toLocaleString()}</p>
                        <p className="text-[10px] text-surface-500">{s.label ? `${new Date(s.created_at).toLocaleDateString()} · ` : ''}{s.word_count.toLocaleString()} words</p>
                      </button>
                      {canEdit && (
                        <button type="button" onClick={() => deleteSnapshot(s.id)} className="text-surface-600 hover:text-red-400" aria-label="Delete snapshot">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            {canEdit && (
              <div className="pt-2 border-t border-surface-800 flex items-center gap-2">
                <button type="button" onClick={() => move(active.id, -1)} className="flex-1 rounded-lg border border-surface-700 px-2 py-1.5 text-xs text-surface-300 hover:text-white">Move up</button>
                <button type="button" onClick={() => move(active.id, 1)} className="flex-1 rounded-lg border border-surface-700 px-2 py-1.5 text-xs text-surface-300 hover:text-white">Move down</button>
                <button type="button" onClick={() => deleteItem(active.id)} className="rounded-lg border border-red-500/30 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10">Delete</button>
              </div>
            )}
          </div>
        </aside>
      )}

      <Modal isOpen={!!previewSnap} onClose={() => setPreviewSnap(null)} title={previewSnap?.label || 'Snapshot'} size="lg">
        {previewSnap && (
          <div className="space-y-4">
            <SnapshotDiff before={previewSnap.content} after={editorRef.current?.innerHTML || ''} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPreviewSnap(null)}>Close</Button>
              {canEdit && <Button onClick={() => restoreSnapshot(previewSnap)}>Restore this version</Button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────

function ToolButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep the editor's selection
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn('p-1.5 rounded-md shrink-0 transition-colors', active ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white hover:bg-surface-800')}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">{children}</svg>
    </button>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="block w-full px-3 py-1.5 text-left text-sm text-surface-200 hover:bg-surface-800 hover:text-white">
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-surface-500">{label}</p>
      {children}
    </div>
  );
}

function EmptyBinder({ canEdit, hasItems, onStart, onImport }: { canEdit: boolean; hasItems: boolean; onStart: () => void; onImport?: () => void }) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-300">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5l6.74-6.76zM16 8L2 22M17.5 15H9" /></svg>
        </div>
        <h2 className="text-lg font-semibold text-white">{hasItems ? 'Pick a section from the binder' : 'Your book starts here'}</h2>
        <p className="mt-1 text-sm text-surface-400">
          {hasItems ? 'Choose a chapter on the left to keep writing.' : 'Add your first chapter. Parts, prologues, dedications and acknowledgements are under Add in the binder.'}
        </p>
        {canEdit && !hasItems && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <Button onClick={onStart}>Write Chapter One</Button>
            {onImport && <button type="button" onClick={onImport} className="text-xs text-teal-300 hover:underline">or import an existing manuscript (.txt, .md)</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function DisplayPanel({ prefs, onChange, onClose }: { prefs: DisplayPrefs; onChange: (p: Partial<DisplayPrefs>) => void; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-full mt-2 z-40 w-64 rounded-xl border border-surface-700 bg-surface-900 p-4 shadow-xl space-y-4">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-surface-500">Font</p>
        <div className="flex gap-1">
          {(['serif', 'sans', 'mono'] as FontChoice[]).map((f) => (
            <button key={f} type="button" onClick={() => onChange({ font: f })} aria-pressed={prefs.font === f}
              className={cn('flex-1 rounded-md px-2 py-1 text-xs capitalize', prefs.font === f ? 'bg-surface-700 text-white' : 'text-surface-400 hover:bg-surface-800')}
              style={{ fontFamily: FONT_STACK[f] }}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1.5 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-surface-500">
          Size <span className="tabular-nums normal-case">{prefs.size}px</span>
        </label>
        <input type="range" min={14} max={26} value={prefs.size} onChange={(e) => onChange({ size: parseInt(e.target.value, 10) })} className="w-full accent-teal-500" aria-label="Text size" />
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-surface-500">Page width</p>
        <div className="flex gap-1">
          {(['narrow', 'medium', 'wide'] as const).map((w) => (
            <button key={w} type="button" onClick={() => onChange({ width: w })} aria-pressed={prefs.width === w}
              className={cn('flex-1 rounded-md px-2 py-1 text-xs capitalize', prefs.width === w ? 'bg-surface-700 text-white' : 'text-surface-400 hover:bg-surface-800')}>
              {w}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center justify-between text-sm text-surface-300">
        Typewriter scrolling
        <input type="checkbox" checked={prefs.typewriter} onChange={(e) => onChange({ typewriter: e.target.checked })} />
      </label>
      <label className="flex items-center justify-between text-sm text-surface-300">
        Smart quotes &amp; dashes
        <input type="checkbox" checked={prefs.smartQuotes} onChange={(e) => onChange({ smartQuotes: e.target.checked })} />
      </label>
      <button type="button" onClick={onClose} className="w-full rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-300 hover:text-white">Done</button>
    </div>
  );
}

/** Find & replace inside the open section. Works on text nodes so formatting survives. */
function FindReplace({ editor, onChanged, onClose, canEdit }: {
  editor: React.RefObject<HTMLDivElement>; onChanged: () => void; onClose: () => void; canEdit: boolean;
}) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [count, setCount] = useState(0);

  const pattern = useCallback(() => {
    if (!find) return null;
    const esc = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(wholeWord ? `\\b${esc}\\b` : esc, matchCase ? 'g' : 'gi');
  }, [find, matchCase, wholeWord]);

  useEffect(() => {
    const re = pattern();
    const text = editor.current?.innerText || '';
    setCount(re ? (text.match(re) || []).length : 0);
  }, [pattern, editor]);

  const findNext = () => {
    if (!find) return;
    // window.find is non-standard but supported by Chromium, Safari and Firefox.
    (window as unknown as { find: (s: string, c: boolean, b: boolean, w: boolean) => boolean }).find(find, matchCase, false, true);
  };

  const replaceAll = () => {
    const re = pattern();
    const root = editor.current;
    if (!re || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const t = node.textContent || '';
      const next = t.replace(re, () => { n++; return replace; });
      if (next !== t) node.textContent = next;
    }
    setCount(0);
    if (n) { onChanged(); toast(`Replaced ${n} ${n === 1 ? 'match' : 'matches'}`, 'success'); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-surface-800 bg-surface-900/60 px-3 py-2">
      <input autoFocus value={find} onChange={(e) => setFind(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') findNext(); if (e.key === 'Escape') onClose(); }}
        placeholder="Find" aria-label="Find" className="w-40 rounded-md bg-surface-800 border border-surface-700 px-2 py-1 text-sm text-white" />
      {canEdit && (
        <input value={replace} onChange={(e) => setReplace(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          placeholder="Replace with" aria-label="Replace with" className="w-40 rounded-md bg-surface-800 border border-surface-700 px-2 py-1 text-sm text-white" />
      )}
      <label className="flex items-center gap-1 text-xs text-surface-400"><input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Match case</label>
      <label className="flex items-center gap-1 text-xs text-surface-400"><input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} /> Whole word</label>
      <span className="text-xs tabular-nums text-surface-500">{count} found</span>
      <button type="button" onClick={findNext} className="rounded-md px-2 py-1 text-xs text-surface-300 hover:bg-surface-800">Next</button>
      {canEdit && <button type="button" onClick={replaceAll} disabled={!count} className="rounded-md px-2 py-1 text-xs text-teal-300 hover:bg-teal-500/10 disabled:opacity-40">Replace all</button>}
      <button type="button" onClick={onClose} className="ml-auto text-surface-500 hover:text-white" aria-label="Close find">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

/** Paragraph-level comparison: snapshot vs. what's in the editor now. */
function SnapshotDiff({ before, after }: { before: string; after: string }) {
  const a = htmlToPlain(before).split('\n').filter((p) => p.trim());
  const b = htmlToPlain(after).split('\n').filter((p) => p.trim());
  const inB = new Set(b);
  const inA = new Set(a);
  const removed = a.filter((p) => !inB.has(p)).length;
  const added = b.filter((p) => !inA.has(p)).length;
  return (
    <div>
      <p className="mb-2 text-xs text-surface-400">
        {countWords(before).toLocaleString()} words in the snapshot · {countWords(after).toLocaleString()} now ·{' '}
        <span className="text-red-300">{removed} paragraphs only in the snapshot</span> (highlighted)
        {added ? <> · {added} new since</> : null}
      </p>
      <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-surface-700 bg-surface-950 p-5 space-y-3 font-serif text-[15px] leading-relaxed text-surface-200">
        {a.length === 0 ? <p className="text-surface-500">This snapshot is empty.</p> : a.map((p, i) => (
          <p key={i} className={cn(!inB.has(p) && 'bg-red-500/10 border-l-2 border-red-400 pl-2 -ml-2.5')}>{p}</p>
        ))}
      </div>
    </div>
  );
}
