'use client';

import { useEffect, useState, useRef, useCallback, memo, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useScriptStore, useAuthStore, usePresenceStore } from '@/lib/stores';
import { useProjectStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, Select, LoadingSpinner, Avatar, Textarea, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import { parseFDX, generateFDX, parseFountain, generateFountain } from '@/lib/scripts';
import { useWorkTimeTracker } from '@/hooks/useWorkTimeTracker';

// ============================================================
// Display Settings — persisted in localStorage
// ============================================================
interface DisplaySettings {
  showSceneNumbers: boolean;
  showCharacterHighlights: boolean;
  fontSize: number; // 10-16
  pageWidth: 'narrow' | 'standard' | 'wide';
  showNotes: boolean;
  showRevisionColors: boolean;
}

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showSceneNumbers: true,
  showCharacterHighlights: true,
  fontSize: 12,
  pageWidth: 'standard',
  showNotes: true,
  showRevisionColors: true,
};

function loadDisplaySettings(): DisplaySettings {
  try {
    const saved = localStorage.getItem('ss_display_settings');
    if (saved) return { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_DISPLAY_SETTINGS;
}

function saveDisplaySettings(settings: DisplaySettings) {
  try { localStorage.setItem('ss_display_settings', JSON.stringify(settings)); } catch {}
}

// ============================================================
// Character color map — deterministic colors for character names
// ============================================================
const CHARACTER_COLORS = [
  { bg: 'bg-blue-500/10', border: 'border-l-blue-400', text: 'text-blue-300', hex: '#60a5fa' },
  { bg: 'bg-emerald-500/10', border: 'border-l-emerald-400', text: 'text-emerald-300', hex: '#34d399' },
  { bg: 'bg-purple-500/10', border: 'border-l-purple-400', text: 'text-purple-300', hex: '#a78bfa' },
  { bg: 'bg-amber-500/10', border: 'border-l-amber-400', text: 'text-amber-300', hex: '#fbbf24' },
  { bg: 'bg-rose-500/10', border: 'border-l-rose-400', text: 'text-rose-300', hex: '#fb7185' },
  { bg: 'bg-cyan-500/10', border: 'border-l-cyan-400', text: 'text-cyan-300', hex: '#22d3ee' },
  { bg: 'bg-pink-500/10', border: 'border-l-pink-400', text: 'text-pink-300', hex: '#f472b6' },
  { bg: 'bg-lime-500/10', border: 'border-l-lime-400', text: 'text-lime-300', hex: '#a3e635' },
  { bg: 'bg-indigo-500/10', border: 'border-l-indigo-400', text: 'text-indigo-300', hex: '#818cf8' },
  { bg: 'bg-orange-500/10', border: 'border-l-orange-400', text: 'text-orange-300', hex: '#fb923c' },
  { bg: 'bg-teal-500/10', border: 'border-l-teal-400', text: 'text-teal-300', hex: '#2dd4bf' },
  { bg: 'bg-fuchsia-500/10', border: 'border-l-fuchsia-400', text: 'text-fuchsia-300', hex: '#e879f9' },
];

function getCharacterColorIndex(name: string): number {
  let hash = 0;
  const normalized = name.toUpperCase().replace(/\s*\(.*?\)\s*$/, '').trim();
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % CHARACTER_COLORS.length;
}

// Collaborator colors for cursors
const COLLAB_COLORS = [
  { bg: 'bg-blue-500/15', border: 'border-blue-400', text: 'text-blue-400', hex: '#60a5fa' },
  { bg: 'bg-emerald-500/15', border: 'border-emerald-400', text: 'text-emerald-400', hex: '#34d399' },
  { bg: 'bg-purple-500/15', border: 'border-purple-400', text: 'text-purple-400', hex: '#a78bfa' },
  { bg: 'bg-amber-500/15', border: 'border-amber-400', text: 'text-amber-400', hex: '#fbbf24' },
  { bg: 'bg-rose-500/15', border: 'border-rose-400', text: 'text-rose-400', hex: '#fb7185' },
  { bg: 'bg-cyan-500/15', border: 'border-cyan-400', text: 'text-cyan-400', hex: '#22d3ee' },
];

interface CollabCursor {
  userId: string;
  name: string;
  colorIdx: number;
}
import type { ScriptElement, ScriptElementType, Script, ScriptDraft, Comment, CommentType, Profile, UserPresence, TitlePageData } from '@/lib/types';
import { ELEMENT_LABELS, REVISION_COLOR_HEX } from '@/lib/types';

// ============================================================
// Constants
// ============================================================

const ELEMENT_CYCLE: ScriptElementType[] = [
  'scene_heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition',
];

// YouTube/Content Creator element cycle
const YOUTUBE_ELEMENT_CYCLE: ScriptElementType[] = [
  'chapter_marker', 'hook', 'talking_point', 'broll_note', 'cta', 'sponsor_read',
];

function getNextElementType(current: ScriptElementType): ScriptElementType {
  switch (current) {
    case 'scene_heading': return 'action';
    case 'action': return 'action';
    case 'character': return 'dialogue';
    case 'dialogue': return 'action';
    case 'parenthetical': return 'dialogue';
    case 'transition': return 'scene_heading';
    // YouTube elements
    case 'chapter_marker': return 'talking_point';
    case 'hook': return 'talking_point';
    case 'talking_point': return 'talking_point';
    case 'broll_note': return 'talking_point';
    case 'cta': return 'talking_point';
    case 'sponsor_read': return 'talking_point';
    default: return 'action';
  }
}

function getElementClass(type: ScriptElementType): string {
  switch (type) {
    case 'scene_heading': return 'sp-scene-heading';
    case 'action': return 'sp-action';
    case 'character': return 'sp-character';
    case 'dialogue': return 'sp-dialogue';
    case 'parenthetical': return 'sp-parenthetical';
    case 'transition': return 'sp-transition';
    case 'centered': return 'sp-centered';
    case 'note': return 'sp-note';
    // YouTube elements
    case 'chapter_marker': return 'sp-chapter';
    case 'hook': return 'sp-hook';
    case 'talking_point': return 'sp-talking-point';
    case 'broll_note': return 'sp-broll-note';
    case 'cta': return 'sp-cta';
    case 'sponsor_read': return 'sp-sponsor';
    default: return '';
  }
}

// ============================================================
// Screenplay Studio Creator Format (SSCF) 
// A custom script format designed for content creators
// ============================================================
const YOUTUBE_FORMAT_GUIDE = {
  title: 'Screenplay Studio Creator Format',
  tagline: 'A structured script format designed for content creators',
  elements: [
    { type: 'chapter_marker', symbol: '#', name: 'Chapter', desc: 'Timestamp & section title. Creates video chapters.' },
    { type: 'hook', symbol: '!', name: 'Hook', desc: 'Opening hook or attention grabber. Keep it punchy!' },
    { type: 'talking_point', symbol: '>', name: 'Script', desc: 'Your main spoken content. What you\'ll say on camera.' },
    { type: 'broll_note', symbol: '[', name: 'Visual', desc: 'B-roll, graphics, or visual cue. What viewers see.' },
    { type: 'cta', symbol: '*', name: 'CTA', desc: 'Call to action. Subscribe, like, comment prompts.' },
    { type: 'sponsor_read', symbol: '$', name: 'Sponsor', desc: 'Sponsored segment with talking points.' },
  ],
  shortcuts: {
    '#': 'chapter_marker',
    '!': 'hook', 
    '>': 'talking_point',
    '[': 'broll_note',
    '*': 'cta',
    '$': 'sponsor_read',
  },
};

function getElementPlaceholder(type: ScriptElementType, isYouTube = false): string {
  switch (type) {
    // Traditional screenplay elements
    case 'scene_heading': return isYouTube ? '# SECTION TITLE' : 'INT./EXT. LOCATION - TIME';
    case 'action': return isYouTube ? 'What you\'ll say or do...' : 'Action...';
    case 'character': return 'CHARACTER NAME';
    case 'dialogue': return 'Dialogue...';
    case 'parenthetical': return '(direction)';
    case 'transition': return 'CUT TO:';
    case 'note': return '[[Note]]';
    // YouTube/Creator elements
    case 'chapter_marker': return '# Chapter Title (00:00)';
    case 'hook': return '! Hook or attention grabber...';
    case 'talking_point': return '> What you\'ll say on camera...';
    case 'broll_note': return '[ B-roll or visual description ]';
    case 'cta': return '* Call to action...';
    case 'sponsor_read': return '$ SPONSOR: Talking points...';
    default: return '';
  }
}

// ============================================================
// Download helper
// ============================================================
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// Focus helper — places cursor at start or end of an element
// ============================================================
function focusElement(elementId: string, position: 'start' | 'end' = 'end') {
  requestAnimationFrame(() => {
    const el = document.getElementById(`el-${elementId}`);
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    if (el.childNodes.length > 0) {
      if (position === 'end') {
        range.selectNodeContents(el);
        range.collapse(false);
      } else {
        range.setStart(el.childNodes[0] || el, 0);
        range.collapse(true);
      }
    } else {
      range.selectNodeContents(el);
      range.collapse(true);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  });
}

// ============================================================
// Main Page
// ============================================================

export default function ScriptEditorPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const {
    scripts, currentScript, elements,
    setCurrentScript, fetchScripts, fetchElements, saving,
  } = useScriptStore();
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);

  const [showTitlePage, setShowTitlePage] = useState(false);
  const [showNewScript, setShowNewScript] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const importExportRef = useRef<HTMLButtonElement>(null);
  const displaySettingsRef = useRef<HTMLButtonElement>(null);
  const [activeElementType, setActiveElementType] = useState<ScriptElementType>('action');
  const [drafts, setDrafts] = useState<ScriptDraft[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [restoringDraft, setRestoringDraft] = useState(false);
  const [showScriptsSidebar, setShowScriptsSidebar] = useState(false);
  const [showFormatIntro, setShowFormatIntro] = useState(false);
  const [useCreatorFormat, setUseCreatorFormat] = useState(true); // vs plaintext
  const [showFormatReminder, setShowFormatReminder] = useState(() => {
    try { return localStorage.getItem('ss_hide_format_reminder') !== 'true'; } catch { return true; }
  });

  // Role awareness: determine if user can edit
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  // ⏱ Work-time tracking — fires heartbeats every 30s while the user is active
  useWorkTimeTracker({ projectId: params.id, context: 'script', disabled: !canEdit });

  // Detect YouTube/Content Creator project
  const isContentCreator = useMemo(() => {
    const projectType = currentProject?.project_type;
    const scriptType = currentProject?.script_type;
    return ['youtube', 'tiktok', 'podcast', 'educational', 'livestream'].includes(projectType || '') ||
           ['youtube', 'tiktok'].includes(scriptType || '');
  }, [currentProject]);

  // Element cycle based on project type
  const elementCycle = isContentCreator ? YOUTUBE_ELEMENT_CYCLE : ELEMENT_CYCLE;

  // ── Inline comments ──────────────────────────────────────────
  const [scriptComments, setScriptComments] = useState<(Comment & { profile?: Profile })[]>([]);
  const [commentPanelElement, setCommentPanelElement] = useState<string | null>(null); // element id
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentType, setNewCommentType] = useState<CommentType>('note');
  const [postingComment, setPostingComment] = useState(false);

  // Map: element_id → comment count (for badge display)
  const commentCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    scriptComments.forEach((c) => {
      map[c.entity_id] = (map[c.entity_id] || 0) + 1;
    });
    return map;
  }, [scriptComments]);

  const fetchScriptComments = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles!created_by(*)')
      .eq('project_id', params.id)
      .eq('entity_type', 'script_element')
      .order('created_at', { ascending: true });
    setScriptComments(data || []);
  }, [params.id]);

  // Subscribe to comments via realtime
  useEffect(() => {
    fetchScriptComments();
    const supabase = createClient();
    const channel = supabase.channel(`script-comments:${params.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `project_id=eq.${params.id}` }, () => {
        fetchScriptComments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id, fetchScriptComments]);

  const handlePostScriptComment = async (elementId: string) => {
    if (!newCommentText.trim() || !user) return;
    setPostingComment(true);
    const supabase = createClient();
    await supabase.from('comments').insert({
      project_id: params.id,
      entity_type: 'script_element',
      entity_id: elementId,
      parent_id: null,
      content: newCommentText.trim(),
      comment_type: newCommentType,
      created_by: user.id,
    });
    setNewCommentText('');
    setNewCommentType('note');
    setPostingComment(false);
  };

  const handleReplyScriptComment = async (parentId: string, content: string, type: CommentType) => {
    if (!user) return;
    const supabase = createClient();
    const parentComment = scriptComments.find(c => c.id === parentId);
    await supabase.from('comments').insert({
      project_id: params.id,
      entity_type: 'script_element',
      entity_id: parentComment?.entity_id || commentPanelElement || '',
      parent_id: parentId,
      content,
      comment_type: type,
      created_by: user.id,
    });
  };

  const handleResolveComment = async (id: string) => {
    const supabase = createClient();
    await supabase.from('comments').update({ is_resolved: true, resolved_by: user?.id }).eq('id', id);
    fetchScriptComments();
  };

  const handleDeleteComment = async (id: string) => {
    if (!confirm('Delete this comment?')) return;
    const supabase = createClient();
    await supabase.from('comments').delete().eq('id', id);
    fetchScriptComments();
  };

  const openCommentPanel = useCallback((elementId: string) => {
    setCommentPanelElement(elementId);
    setShowCommentPanel(true);
    setNewCommentText('');
  }, []);

  useEffect(() => { fetchScripts(params.id); }, [params.id]);
  useEffect(() => { if (currentScript) { fetchElements(currentScript.id); loadDrafts(); } }, [currentScript?.id]);
  
  // Show format intro for content creator projects (once per project)
  useEffect(() => {
    if (isContentCreator && currentScript) {
      const key = `sscf_intro_seen_${params.id}`;
      const seen = localStorage.getItem(key);
      if (!seen) {
        setShowFormatIntro(true);
      }
      // Load user's format preference
      const formatPref = localStorage.getItem(`sscf_use_format_${params.id}`);
      if (formatPref !== null) {
        setUseCreatorFormat(formatPref === 'true');
      }
    }
  }, [isContentCreator, currentScript, params.id]);

  const dismissFormatIntro = (useFormat: boolean) => {
    localStorage.setItem(`sscf_intro_seen_${params.id}`, 'true');
    localStorage.setItem(`sscf_use_format_${params.id}`, String(useFormat));
    setUseCreatorFormat(useFormat);
    setShowFormatIntro(false);
  };

  const loadDrafts = async () => {
    if (!currentScript) return;
    const supabase = createClient();
    const { data } = await supabase.from('script_drafts')
      .select('*')
      .eq('script_id', currentScript.id)
      .order('draft_number', { ascending: false });
    setDrafts(data || []);
  };

  const handleSaveDraft = async () => {
    if (!currentScript) return;
    setSavingDraft(true);
    const name = prompt('Draft name (optional):', `Draft ${drafts.length + 1}`);
    if (name === null) { setSavingDraft(false); return; }
    const supabase = createClient();
    await supabase.rpc('save_script_draft', {
      p_script_id: currentScript.id,
      p_draft_name: name || `Draft ${drafts.length + 1}`,
      p_notes: null,
    });
    await loadDrafts();
    setSavingDraft(false);
  };

  const handleRestoreDraft = async (draftId: string, draftName: string) => {
    if (!confirm(`Restore "${draftName}"? Current state will be auto-saved first.`)) return;
    setRestoringDraft(true);
    const supabase = createClient();
    await supabase.rpc('restore_script_draft', { p_draft_id: draftId });
    if (currentScript) fetchElements(currentScript.id);
    await loadDrafts();
    setRestoringDraft(false);
  };

  // Character names for autocomplete
  const characterNames = useMemo(() => {
    const names = new Set<string>();
    elements.forEach((e) => {
      if (e.element_type === 'character' && e.content?.trim()) {
        names.add(e.content.trim().toUpperCase());
      }
    });
    return Array.from(names).sort();
  }, [elements]);

  // Character color map — assigns stable colors to each character
  const characterColorMap = useMemo(() => {
    const map: Record<string, number> = {};
    characterNames.forEach((name) => {
      map[name] = getCharacterColorIndex(name);
    });
    return map;
  }, [characterNames]);

  // Load display settings from localStorage
  useEffect(() => {
    setDisplaySettings(loadDisplaySettings());
  }, []);

  // Save display settings when changed
  const updateDisplaySettings = useCallback((updates: Partial<DisplaySettings>) => {
    setDisplaySettings((prev) => {
      const next = { ...prev, ...updates };
      saveDisplaySettings(next);
      return next;
    });
  }, []);

  // Page numbers (rough estimate: 56 lines per page)
  const elementPages = useMemo(() => {
    const pages: Record<string, number> = {};
    let lineCount = 0;
    const linesPerPage = 56;
    elements.forEach((el) => {
      const lines = Math.max(1, Math.ceil((el.content || '').length / 60));
      if (el.element_type === 'scene_heading') lineCount += 2;
      pages[el.id] = Math.floor(lineCount / linesPerPage) + 1;
      lineCount += lines;
      if (el.element_type === 'scene_heading' || el.element_type === 'transition') lineCount += 1;
    });
    return pages;
  }, [elements]);

  const sceneHeadings = elements.filter((e) => e.element_type === 'scene_heading');
  const chapterMarkers = elements.filter((e) => e.element_type === 'chapter_marker');

  // Map scene_heading element IDs → sequential scene number (use existing scene_number if set, otherwise auto-index)
  const sceneNumberMap = useMemo(() => {
    const map: Record<string, string> = {};
    let autoIndex = 0;
    for (const el of elements) {
      if (el.element_type === 'scene_heading') {
        autoIndex++;
        map[el.id] = el.scene_number || String(autoIndex);
      }
    }
    return map;
  }, [elements]);

  const totalPages = Object.values(elementPages).length > 0
    ? Math.max(...Object.values(elementPages)) : 1;

  // Word count
  const wordCount = useMemo(() => {
    return elements.reduce((count, el) => {
      return count + (el.content || '').split(/\s+/).filter(Boolean).length;
    }, 0);
  }, [elements]);

  // Last saved timestamp
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  useEffect(() => {
    if (!saving && lastSaved === null && elements.length > 0) {
      setLastSaved(new Date());
    }
    if (saving) return;
    // When saving just finished
    setLastSaved(new Date());
  }, [saving]);
  const filteredElements = searchQuery
    ? elements.filter((e) => (e.content || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : elements;

  // Other users viewing the script
  const scriptUsers = onlineUsers.filter(
    (u) => u.current_page === 'script' && u.user_id !== user?.id
  );

  // Build a map: elementId → array of collaborators focused on it
  const collabMap = useMemo(() => {
    const map: Record<string, CollabCursor[]> = {};
    scriptUsers.forEach((u, i) => {
      const presence = u as UserPresence & { focused_element_id?: string; full_name?: string; email?: string; avatar_url?: string };
      const focusedId = presence.focused_element_id;
      if (!focusedId) return;
      if (!map[focusedId]) map[focusedId] = [];
      map[focusedId].push({
        userId: u.user_id,
        name: presence.full_name || presence.email || 'User',
        colorIdx: i % COLLAB_COLORS.length,
      });
    });
    return map;
  }, [scriptUsers]);

  // Toolbar add
  const handleToolbarAdd = async (type: ScriptElementType) => {
    const store = useScriptStore.getState();
    const auth = useAuthStore.getState();
    if (!store.currentScript || !auth.user) return;
    const maxOrder = store.elements.length > 0 ? Math.max(...store.elements.map((e) => e.sort_order)) : 0;
    const newEl = await store.addElement({
      script_id: store.currentScript.id,
      element_type: type,
      content: '',
      sort_order: maxOrder + 1,
      created_by: auth.user.id,
      last_edited_by: auth.user.id,
    });
    if (newEl) {
      setActiveElementType(type);
      focusElement(newEl.id);
    }
  };

  // ---- PDF Export ----
  const handleExportPDF = useCallback(() => {
    const store = useScriptStore.getState();
    const script = store.currentScript;
    const els = store.elements;
    if (!script) return;

    const titlePage = script.title_page_data || ({} as TitlePageData);
    const hasTitlePage = titlePage.title || titlePage.author;

    // Build element HTML
    const elementHTML = (el: ScriptElement) => {
      const content = (el.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const cls = el.element_type.replace('_', '-');
      if (el.is_omitted) return '';
      return `<div class="el el-${cls}">${content}</div>`;
    };

    // Paginate: ~56 lines per page
    const linesPerPage = 56;
    const pages: string[][] = [[]];
    let lineCount = 0;
    for (const el of els) {
      if (el.is_omitted) continue;
      const lines = Math.max(1, Math.ceil((el.content || '').length / 60));
      if (el.element_type === 'scene_heading') lineCount += 2;
      if (lineCount + lines > linesPerPage && pages[pages.length - 1].length > 0) {
        pages.push([]);
        lineCount = 0;
      }
      pages[pages.length - 1].push(elementHTML(el));
      lineCount += lines;
      if (el.element_type === 'scene_heading' || el.element_type === 'transition') lineCount += 1;
    }

    const pageHTML = pages.map((p, i) => `
      <div class="page">
        <div class="page-content">${p.join('')}</div>
        <div class="page-number">${i + 1}.</div>
      </div>
    `).join('');

    const titlePageHTML = hasTitlePage ? `
      <div class="page title-page">
        <div class="page-content">
          <div class="title-center">
            ${titlePage.title ? `<div class="tp-title">${titlePage.title}</div>` : ''}
            ${titlePage.credit ? `<div class="tp-credit">${titlePage.credit}</div>` : ''}
            ${titlePage.author ? `<div class="tp-author">${titlePage.author}</div>` : ''}
            ${titlePage.source ? `<div class="tp-source">${titlePage.source}</div>` : ''}
          </div>
          <div class="title-bottom">
            ${titlePage.draft_date ? `<div class="tp-info">${titlePage.draft_date}</div>` : ''}
            ${titlePage.contact ? `<div class="tp-info">${titlePage.contact}</div>` : ''}
            ${titlePage.copyright ? `<div class="tp-info">${titlePage.copyright}</div>` : ''}
          </div>
        </div>
      </div>
    ` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${script.title || 'Screenplay'} - Export</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Courier Prime', 'Courier New', Courier, monospace;
    font-size: 12pt;
    line-height: 1;
    color: black;
    background: white;
  }

  .page {
    width: 8.5in;
    min-height: 11in;
    padding: 1in 1in 1in 1.5in;
    position: relative;
    page-break-after: always;
    margin: 0 auto;
  }
  .page:last-child { page-break-after: auto; }

  .page-content {
    min-height: calc(11in - 2in);
  }

  .page-number {
    position: absolute;
    top: 0.5in;
    right: 1in;
    font-size: 12pt;
  }

  /* Title page */
  .title-page { position: relative; }
  .title-page .page-number { display: none; }
  .title-page .page-content { display: flex; flex-direction: column; min-height: calc(11in - 2in); }
  .title-center { text-align: center; padding-top: 3in; }
  .title-bottom { position: absolute; bottom: 1in; left: 0; }
  .tp-title { font-size: 24pt; font-weight: bold; text-transform: uppercase; margin-bottom: 24pt; }
  .tp-credit { font-size: 12pt; margin-bottom: 12pt; }
  .tp-author { font-size: 12pt; margin-bottom: 12pt; }
  .tp-source { font-size: 12pt; font-style: italic; margin-bottom: 12pt; }
  .tp-info { font-size: 10pt; margin-bottom: 6pt; }

  /* Element types */
  .el {
    font-family: 'Courier Prime', 'Courier New', Courier, monospace;
    font-size: 12pt;
    line-height: 1;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .el-scene-heading {
    font-weight: bold;
    text-transform: uppercase;
    margin-top: 24pt;
    padding-bottom: 12pt;
  }
  .page-content > .el-scene-heading:first-child { margin-top: 0; }

  .el-action { padding-top: 12pt; }

  .el-character {
    text-transform: uppercase;
    margin-left: 2.2in;
    padding-top: 12pt;
  }

  .el-parenthetical {
    margin-left: 1.6in;
    margin-right: 2in;
  }

  .el-dialogue {
    margin-left: 1in;
    margin-right: 1.5in;
  }

  .el-transition {
    text-transform: uppercase;
    text-align: right;
    padding-top: 12pt;
    padding-bottom: 12pt;
  }

  .el-centered {
    text-align: center;
    padding-top: 12pt;
  }

  .el-note {
    font-style: italic;
    color: #666;
    border-left: 2px solid #ccc;
    padding-left: 12pt;
    padding-top: 12pt;
  }

  /* Screen preview */
  @media screen {
    body { background: #e0e0e0; padding: 20px 0; }
    .page {
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      margin-bottom: 20px;
    }
  }

  /* Print */
  @media print {
    body { background: white; }
    .page {
      width: auto;
      min-height: auto;
      padding: 0;
      margin: 0;
      page-break-after: always;
    }
    .page-content { min-height: auto; }
    .title-page {
      min-height: 100vh;
      padding: 0;
      position: relative;
    }
    .title-page .page-content { min-height: 100vh; }
    .title-page .title-center { padding-top: 30vh; }
    .title-page .title-bottom { position: absolute; bottom: 0.5in; left: 0; }
  }

  @page {
    size: letter;
    margin: 1in 1in 1in 1.5in;
  }
</style>
</head>
<body>
${titlePageHTML}
${pageHTML}
<script>
  // Auto-trigger print after fonts load
  document.fonts.ready.then(() => {
    setTimeout(() => window.print(), 300);
  });
<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      toast.warning('Please allow popups to export PDF.');
      return;
    }
    win.document.write(html);
    win.document.close();
  }, []);

  // ============================================================
  // Import / Export Handlers
  // ============================================================

  const handleImportFile = useCallback(async (format: 'fdx' | 'fountain') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = format === 'fdx' ? '.fdx' : '.fountain,.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();

      try {
        let titlePage: TitlePageData = {};
        let importedElements: Partial<ScriptElement>[] = [];

        if (format === 'fdx') {
          const result = parseFDX(text);
          titlePage = result.titlePage;
          importedElements = result.elements;
        } else {
          const result = parseFountain(text);
          titlePage = result.titlePage;
          importedElements = result.elements;
        }

        if (!currentScript) {
          toast.warning('Please select or create a script first.');
          return;
        }

        // Confirm import
        const count = importedElements.length;
        if (!confirm(`Import ${count} elements from ${file.name}? This will replace the current script content.`)) return;

        const supabase = createClient();

        // Save current as draft first
        if (elements.length > 0) {
          await supabase.rpc('save_script_draft', {
            p_script_id: currentScript.id,
            p_draft_name: `Pre-import backup`,
            p_notes: `Auto-saved before importing ${file.name}`,
          });
        }

        // Delete existing elements
        await supabase.from('script_elements').delete().eq('script_id', currentScript.id);

        // Update title page
        if (titlePage.title || titlePage.author) {
          await supabase.from('scripts').update({ title_page_data: titlePage }).eq('id', currentScript.id);
          // Update the Zustand store so exports pick up the title page immediately
          setCurrentScript({ ...currentScript, title_page_data: titlePage });
        }

        // Insert new elements
        const inserts = importedElements.map((el, i) => ({
          script_id: currentScript.id,
          element_type: el.element_type || 'action',
          content: el.content || '',
          sort_order: i,
          scene_number: el.scene_number || null,
          created_by: user?.id,
          last_edited_by: user?.id,
        }));

        // Insert in batches of 100
        for (let b = 0; b < inserts.length; b += 100) {
          await supabase.from('script_elements').insert(inserts.slice(b, b + 100));
        }

        // Refresh
        fetchElements(currentScript.id);
        setShowImportExport(false);
        toast.success(`Successfully imported ${count} elements from ${file.name}!`);
      } catch (err: unknown) {
        toast.error('Import error: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };
    input.click();
  }, [currentScript, elements, user, fetchElements, setCurrentScript]);

  const handleExportFDX = useCallback(() => {
    if (!currentScript || elements.length === 0) return;
    const xml = generateFDX({
      titlePage: currentScript.title_page_data || undefined,
      elements,
      scriptTitle: currentScript.title,
    });
    downloadFile(xml, `${currentScript.title || 'script'}.fdx`, 'application/xml');
    setShowImportExport(false);
  }, [currentScript, elements]);

  const handleExportFountain = useCallback(() => {
    if (!currentScript || elements.length === 0) return;
    const text = generateFountain({
      titlePage: currentScript.title_page_data || undefined,
      elements,
    });
    downloadFile(text, `${currentScript.title || 'script'}.fountain`, 'text/plain');
    setShowImportExport(false);
  }, [currentScript, elements]);

  const handleExportPlainText = useCallback(() => {
    if (!currentScript || elements.length === 0) return;
    const tp = currentScript.title_page_data;
    let lines: string[] = [];
    // Title page
    if (tp && (tp.title || tp.author)) {
      lines.push('', '');
      if (tp.title) { lines.push(tp.title.toUpperCase()); lines.push(''); }
      if (tp.credit) { lines.push(tp.credit); lines.push(''); }
      if (tp.author) { lines.push(tp.author); lines.push(''); }
      if (tp.source) { lines.push(tp.source); lines.push(''); }
      if (tp.draft_date) lines.push(tp.draft_date);
      if (tp.contact) lines.push(tp.contact);
      if (tp.copyright) lines.push(tp.copyright);
      lines.push('', '---', '');
    }
    for (const el of elements) {
      const c = (el.content || '').trim();
      if (!c) { lines.push(''); continue; }
      switch (el.element_type) {
        case 'scene_heading': lines.push('', c.toUpperCase(), ''); break;
        case 'character': lines.push('', '    ' + c.toUpperCase()); break;
        case 'parenthetical': lines.push('    ' + c); break;
        case 'dialogue': lines.push('    ' + c); break;
        case 'transition': lines.push('', c.toUpperCase(), ''); break;
        default: lines.push(c); break;
      }
    }
    downloadFile(lines.join('\n'), `${currentScript.title || 'script'}.txt`, 'text/plain');
    setShowImportExport(false);
  }, [currentScript, elements]);

  const handleExportHTML = useCallback(() => {
    if (!currentScript || elements.length === 0) return;
    const tp = currentScript.title_page_data;
    let html = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${currentScript.title || 'Script'}</title>
<style>
  body { font-family: 'Courier Prime', 'Courier New', monospace; max-width: 8in; margin: 1in auto; font-size: 12pt; line-height: 1.5; color: #000; }
  .scene-heading { font-weight: bold; text-transform: uppercase; margin-top: 1.5em; }
  .action { margin: 1em 0; }
  .character { text-transform: uppercase; margin-left: 2.5in; margin-top: 1em; margin-bottom: 0; }
  .parenthetical { margin-left: 2in; margin-top: 0; margin-bottom: 0; }
  .dialogue { margin-left: 1.5in; margin-right: 2in; margin-top: 0; }
  .transition { text-align: right; text-transform: uppercase; margin-top: 1em; }
  .note { color: #666; font-style: italic; border-left: 3px solid #ddd; padding-left: 0.5em; }
  .title-page { text-align: center; min-height: 80vh; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .title-page h1 { text-transform: uppercase; letter-spacing: 0.1em; }
  .title-page .contact { position: absolute; bottom: 1in; left: 1in; text-align: left; font-size: 10pt; }
  @media print { body { margin: 0; } }
</style></head><body>\n`;
    if (tp && (tp.title || tp.author)) {
      html += '<div class="title-page">';
      if (tp.title) html += `<h1>${tp.title}</h1>`;
      if (tp.credit) html += `<p>${tp.credit}</p>`;
      if (tp.author) html += `<p>${tp.author}</p>`;
      if (tp.source) html += `<p><em>${tp.source}</em></p>`;
      if (tp.draft_date || tp.contact || tp.copyright) {
        html += '<div class="contact">';
        if (tp.draft_date) html += `<p>${tp.draft_date}</p>`;
        if (tp.contact) html += `<p>${tp.contact}</p>`;
        if (tp.copyright) html += `<p>${tp.copyright}</p>`;
        html += '</div>';
      }
      html += '</div>\n';
    }
    for (const el of elements) {
      const c = (el.content || '').trim();
      if (!c) continue;
      const cls = el.element_type.replace('_', '-');
      html += `<p class="${cls}">${c}</p>\n`;
    }
    html += '</body></html>';
    downloadFile(html, `${currentScript.title || 'script'}.html`, 'text/html');
    setShowImportExport(false);
  }, [currentScript, elements]);

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      handleExportPDF();
    }
  };

  return (
    <>
      {/* Creator Format Intro Modal */}
      {showFormatIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-surface-800 bg-gradient-to-r from-brand-600/20 to-purple-600/20">
              <h2 className="text-2xl font-black text-white">Welcome to Creator Format</h2>
              <p className="text-surface-300 mt-1">A structured script format designed for YouTubers & content creators</p>
            </div>
            
            <div className="p-6">
              <p className="text-surface-300 mb-4">
                Unlike traditional screenplays, content creator scripts focus on what you'll <strong className="text-white">say</strong> and what viewers will <strong className="text-white">see</strong>. 
                Our format helps you organize your video structure clearly.
              </p>
              
              <div className="bg-surface-800 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-white mb-3">Element Types</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {YOUTUBE_FORMAT_GUIDE.elements.map(el => (
                    <div key={el.type} className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-700/50">
                      <code className="px-2 py-1 bg-surface-700 text-[#FF5F1F] rounded font-mono text-sm">{el.symbol}</code>
                      <div>
                        <p className="text-white font-medium text-sm">{el.name}</p>
                        <p className="text-surface-400 text-xs">{el.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-800/50 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-white mb-2">Quick Start</h3>
                <pre className="text-sm text-surface-300 font-mono whitespace-pre-wrap">
{`# Intro (0:00)
! Ever wondered how to get 10x more views?
> In today's video, I'll show you exactly how...
[ Screen recording of analytics ]

# Main Content (0:30)
> First, let's talk about the algorithm...
[ B-roll of typing ]

* Don't forget to subscribe!
$ SPONSOR: Bored VPN - Get 60% off with code...`}
                </pre>
              </div>

              <p className="text-xs text-surface-500 mb-4">
                You can change your preference anytime in Display Settings.
              </p>
            </div>

            <div className="p-4 border-t border-surface-800 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => dismissFormatIntro(false)}>
                Use Plain Text Instead
              </Button>
              <Button onClick={() => dismissFormatIntro(true)}>
                Use Creator Format
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100dvh-3rem)] md:h-[100dvh] overflow-hidden" onKeyDown={handleEditorKeyDown}>
      {/* Scripts sidebar toggle on mobile */}
      <button onClick={() => setShowScriptsSidebar(!showScriptsSidebar)}
        className="fixed bottom-4 left-4 z-30 md:hidden p-3 bg-[#E54E15] text-white rounded-full shadow-lg">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
      </button>

      {/* Sidebar */}
      <div className={cn(
        'w-56 border-r border-surface-800 flex flex-col bg-surface-950 overflow-hidden shrink-0',
        'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-64 max-md:transition-transform max-md:duration-200',
        showScriptsSidebar ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
      )}>
        {/* Mobile close */}
        <button onClick={() => setShowScriptsSidebar(false)}
          className="md:hidden absolute top-2 right-2 p-1.5 text-surface-500 hover:text-white z-10">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="p-3 border-b border-surface-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">Scripts</span>
            <button onClick={() => setShowNewScript(true)} className="p-1 rounded text-surface-500 hover:text-white hover:bg-surface-900/10">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          {scripts.map((script) => (
            <button key={script.id} onClick={() => setCurrentScript(script)}
              className={cn('w-full text-left px-2 py-1.5 rounded text-xs transition-colors mb-0.5',
                currentScript?.id === script.id ? 'bg-[#E54E15]/10 text-[#FF5F1F]' : 'text-surface-400 hover:text-white hover:bg-surface-900/5'
              )}>
              <div className="flex items-center justify-between">
                <span className="truncate">{script.title}</span>
                <span className="text-[10px] text-surface-600">v{script.version}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isContentCreator ? (
            <>
              <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">Chapters ({chapterMarkers.length})</p>
              <div className="space-y-0.5">
                {chapterMarkers.map((chapter, i) => (
                  <button key={chapter.id} onClick={() => {
                    document.getElementById(`el-${chapter.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }} className="w-full text-left px-2 py-1.5 rounded text-xs text-surface-400 hover:text-white hover:bg-surface-900/5 transition-colors">
                    <span className="text-[#FF5F1F] mr-1">#</span>
                    <span className="truncate">{(chapter.content || '# Untitled Chapter').replace(/^#\s*/, '')}</span>
                  </button>
                ))}
                {chapterMarkers.length === 0 && (
                  <p className="text-xs text-surface-600 px-2 py-1">No chapters yet. Start a line with # to create one.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">Scenes ({sceneHeadings.length})</p>
              <div className="space-y-0.5">
                {sceneHeadings.map((scene, i) => (
                  <button key={scene.id} onClick={() => {
                    document.getElementById(`el-${scene.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }} className="w-full text-left px-2 py-1.5 rounded text-xs text-surface-400 hover:text-white hover:bg-surface-900/5 transition-colors">
                    <span className="text-surface-600 mr-1">{i + 1}.</span>
                    <span className="truncate">{scene.content || 'Untitled Scene'}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t border-surface-800">
          {scriptUsers.length > 0 && (
            <div className="mb-3 pb-3 border-b border-surface-800">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-1.5">Editing Now</p>
              <div className="flex flex-wrap gap-1">
                {scriptUsers.map((u) => (
                  <div key={u.user_id} className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 rounded text-[10px] text-green-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {(u as UserPresence & { full_name?: string; email?: string }).full_name || (u as UserPresence & { full_name?: string; email?: string }).email || 'User'}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-bold text-white">{totalPages}</p><p className="text-[10px] text-surface-500">Pages</p></div>
            <div><p className="text-lg font-bold text-white">{elements.length}</p><p className="text-[10px] text-surface-500">Elements</p></div>
            <div><p className="text-lg font-bold text-white">{wordCount.toLocaleString()}</p><p className="text-[10px] text-surface-500">Words</p></div>
          </div>
          {/* Estimated screen time */}
          <div className="mt-3 pt-3 border-t border-surface-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-surface-500 uppercase tracking-wider">Est. Screen Time</span>
              <span className="text-sm font-semibold text-white">
                {totalPages >= 60
                  ? `${Math.floor(totalPages / 60)}h ${totalPages % 60}m`
                  : `${totalPages} min`
                }
              </span>
            </div>
            <div className="mt-1.5 w-full bg-surface-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-[#FF5F1F] transition-all duration-500"
                style={{ width: `${Math.min(100, (totalPages / 120) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-surface-600 mt-1">~1 min/page &middot; {totalPages} pages &middot; {wordCount.toLocaleString()} words</p>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm px-2 md:px-4 py-2 flex items-center gap-1.5 md:gap-2 no-print overflow-x-auto" style={{ overflow: 'visible' }}>
          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
              {elementCycle.map((type) => (
                <button key={type} onClick={() => handleToolbarAdd(type)}
                  className={cn('px-2 md:px-2.5 py-1 rounded text-[10px] md:text-[11px] font-medium transition-colors whitespace-nowrap',
                    activeElementType === type ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'text-surface-500 hover:text-white hover:bg-surface-900/5'
                  )} title={`Add ${ELEMENT_LABELS[type]}`}>
                  {ELEMENT_LABELS[type]}
                </button>
              ))}
            </div>
          )}
          {!canEdit && (
            <span className="text-[11px] text-surface-500 px-2 py-1 bg-surface-800 rounded font-medium shrink-0">Read Only</span>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            {saving ? (
              <span className="flex items-center gap-1.5 text-[11px] text-surface-500">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />Saving
              </span>
            ) : lastSaved && (
              <span className="flex items-center gap-1.5 text-[11px] text-surface-600">
                <div className="w-2 h-2 rounded-full bg-green-500" />Saved
              </span>
            )}
            <span className="text-[10px] text-surface-600 px-1 hidden md:inline">Tab: change type &middot; Enter: new line</span>
            <button onClick={() => setShowSearch(!showSearch)} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-surface-900/10" title="Search (Cmd+F)">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <button
              onClick={() => setShowCommentPanel(!showCommentPanel)}
              className={cn('p-1.5 rounded transition-colors relative', showCommentPanel ? 'text-[#FF5F1F] bg-[#FF5F1F]/10' : 'text-surface-500 hover:text-white hover:bg-surface-900/10')}
              title="Comments"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
              {scriptComments.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#FF5F1F] text-[7px] font-bold text-white flex items-center justify-center">
                  {scriptComments.filter(c => !c.parent_id).length}
                </span>
              )}
            </button>
            <button onClick={() => setShowTitlePage(true)} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-surface-900/10" title="Title Page">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H14" /></svg>
            </button>
            <button onClick={handleExportPDF} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-surface-900/10" title="Export PDF (Cmd+P)">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            </button>
            {/* Import / Export dropdown */}
            <div className="relative">
              <button ref={importExportRef} onClick={() => setShowImportExport(!showImportExport)} className={cn('p-1.5 rounded transition-colors', showImportExport ? 'text-[#FF5F1F] bg-[#FF5F1F]/10' : 'text-surface-500 hover:text-white hover:bg-surface-900/10')} title="Import / Export">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              </button>
            </div>
            {showImportExport && (
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setShowImportExport(false)} />
                <div className="fixed z-[9999] bg-surface-800 border border-surface-700 rounded-lg shadow-2xl py-1.5 min-w-[220px] animate-fade-in-up"
                  style={{
                    top: importExportRef.current ? importExportRef.current.getBoundingClientRect().bottom + 6 : 60,
                    right: importExportRef.current ? window.innerWidth - importExportRef.current.getBoundingClientRect().right : 16,
                  }}>
                  <p className="px-3 py-1.5 text-[10px] text-surface-500 font-medium uppercase tracking-wider">Import</p>
                  <button onClick={() => handleImportFile('fdx')} className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-white flex items-center gap-2 transition-colors">
                    <span className="w-8 text-[10px] font-mono text-[#FF5F1F]">.fdx</span> Final Draft
                  </button>
                  <button onClick={() => handleImportFile('fountain')} className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-white flex items-center gap-2 transition-colors">
                    <span className="w-8 text-[10px] font-mono text-[#FF5F1F]">.ftn</span> Fountain
                  </button>
                  <div className="border-t border-surface-700 my-1" />
                  <p className="px-3 py-1.5 text-[10px] text-surface-500 font-medium uppercase tracking-wider">Export</p>
                  <button onClick={handleExportPDF} className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-white flex items-center gap-2 transition-colors">
                    <span className="w-8 text-[10px] font-mono text-emerald-400">.pdf</span> PDF (Print)
                  </button>
                  <button onClick={handleExportFDX} className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-white flex items-center gap-2 transition-colors">
                    <span className="w-8 text-[10px] font-mono text-emerald-400">.fdx</span> Final Draft
                  </button>
                  <button onClick={handleExportFountain} className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-white flex items-center gap-2 transition-colors">
                    <span className="w-8 text-[10px] font-mono text-emerald-400">.ftn</span> Fountain
                  </button>
                  <button onClick={handleExportPlainText} className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-white flex items-center gap-2 transition-colors">
                    <span className="w-8 text-[10px] font-mono text-emerald-400">.txt</span> Plain Text
                  </button>
                  <button onClick={handleExportHTML} className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-white flex items-center gap-2 transition-colors">
                    <span className="w-8 text-[10px] font-mono text-emerald-400">.html</span> HTML
                  </button>
                </div>
              </>
            )}
            <button onClick={handleSaveDraft} disabled={savingDraft} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-surface-900/10 disabled:opacity-50" title="Save Draft Snapshot">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            </button>
            <button onClick={() => setShowDrafts(!showDrafts)} className={cn('p-1.5 rounded transition-colors', showDrafts ? 'text-[#FF5F1F] bg-[#FF5F1F]/10' : 'text-surface-500 hover:text-white hover:bg-surface-900/10')} title="Draft Timeline">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            {/* Format Guide Button (for content creators) */}
            {isContentCreator && (
              <button onClick={() => setShowFormatIntro(true)}
                className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-surface-900/10"
                title="Format Guide">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </button>
            )}
            {/* Display Settings */}
            <div className="relative">
              <button ref={displaySettingsRef} onClick={() => setShowDisplaySettings(!showDisplaySettings)}
                className={cn('p-1.5 rounded transition-colors', showDisplaySettings ? 'text-[#FF5F1F] bg-[#FF5F1F]/10' : 'text-surface-500 hover:text-white hover:bg-surface-900/10')}
                title="Display Settings">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              </button>
            </div>
            {showDisplaySettings && (
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setShowDisplaySettings(false)} />
                <div className="fixed z-[9999] bg-surface-800 border border-surface-700 rounded-lg shadow-2xl p-4 min-w-[260px] animate-fade-in-up"
                  style={{
                    top: displaySettingsRef.current ? displaySettingsRef.current.getBoundingClientRect().bottom + 6 : 60,
                    right: displaySettingsRef.current ? window.innerWidth - displaySettingsRef.current.getBoundingClientRect().right : 16,
                  }}>
                  <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Display Settings</h4>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <span className="text-xs text-surface-300">Scene Numbers</span>
                      <input type="checkbox" checked={displaySettings.showSceneNumbers}
                        onChange={(e) => updateDisplaySettings({ showSceneNumbers: e.target.checked })}
                        className="rounded border-surface-600 bg-surface-700 text-[#FF5F1F] focus:ring-[#FF5F1F]" />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-xs text-surface-300">Character Highlights</span>
                      <input type="checkbox" checked={displaySettings.showCharacterHighlights}
                        onChange={(e) => updateDisplaySettings({ showCharacterHighlights: e.target.checked })}
                        className="rounded border-surface-600 bg-surface-700 text-[#FF5F1F] focus:ring-[#FF5F1F]" />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-xs text-surface-300">Show Notes</span>
                      <input type="checkbox" checked={displaySettings.showNotes}
                        onChange={(e) => updateDisplaySettings({ showNotes: e.target.checked })}
                        className="rounded border-surface-600 bg-surface-700 text-[#FF5F1F] focus:ring-[#FF5F1F]" />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-xs text-surface-300">Revision Colors</span>
                      <input type="checkbox" checked={displaySettings.showRevisionColors}
                        onChange={(e) => updateDisplaySettings({ showRevisionColors: e.target.checked })}
                        className="rounded border-surface-600 bg-surface-700 text-[#FF5F1F] focus:ring-[#FF5F1F]" />
                    </label>
                    <div>
                      <span className="text-xs text-surface-300 mb-1 block">Font Size: {displaySettings.fontSize}pt</span>
                      <input type="range" min={10} max={16} value={displaySettings.fontSize}
                        onChange={(e) => updateDisplaySettings({ fontSize: Number(e.target.value) })}
                        className="w-full accent-brand-500" />
                    </div>
                    <div>
                      <span className="text-xs text-surface-300 mb-1 block">Page Width</span>
                      <div className="flex gap-1">
                        {(['narrow', 'standard', 'wide'] as const).map((w) => (
                          <button key={w} onClick={() => updateDisplaySettings({ pageWidth: w })}
                            className={cn('flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors capitalize',
                              displaySettings.pageWidth === w ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'text-surface-500 hover:text-white hover:bg-surface-900/5'
                            )}>{w}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            <button onClick={() => setDarkMode(!darkMode)}
              className={cn('p-1.5 rounded transition-colors', darkMode ? 'text-yellow-400 hover:bg-surface-900/10' : 'text-surface-500 hover:text-white hover:bg-surface-900/10')}
              title={darkMode ? 'Light Mode' : 'Dark Mode'}>
              {darkMode ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="border-b border-surface-800 bg-surface-900 px-4 py-2 flex items-center gap-2 no-print">
            <svg className="w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search script..." className="flex-1 bg-transparent text-sm text-white placeholder:text-surface-600 outline-none" autoFocus />
            <span className="text-xs text-surface-500">{searchQuery ? `${filteredElements.length} results` : ''}</span>
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1 rounded text-surface-500 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Draft Timeline Panel */}
        {showDrafts && (
          <div className="border-b border-surface-800 bg-surface-900/80 px-4 py-3 no-print">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Draft Timeline</h4>
              <button onClick={() => setShowDrafts(false)} className="p-1 rounded text-surface-500 hover:text-white">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {drafts.length === 0 ? (
              <p className="text-xs text-surface-500 py-2">No drafts saved yet. Use the save button to create snapshots.</p>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {/* Timeline line */}
                <div className="relative flex items-center gap-0">
                  {drafts.map((draft, i) => (
                    <div key={draft.id} className="flex items-center">
                      {i > 0 && <div className="w-8 h-px bg-surface-700" />}
                      <button
                        onClick={() => handleRestoreDraft(draft.id, draft.draft_name || `Draft ${draft.draft_number}`)}
                        disabled={restoringDraft || draft.is_current}
                        className={cn(
                          'relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-left transition-all min-w-[100px]',
                          draft.is_current
                            ? 'bg-[#FF5F1F]/15 border border-[#FF5F1F]/30'
                            : 'hover:bg-surface-800 border border-transparent'
                        )}
                        title={draft.notes || undefined}
                      >
                        <div className={cn(
                          'w-3 h-3 rounded-full border-2',
                          draft.is_current ? 'border-[#FF5F1F] bg-[#FF5F1F]' : 'border-surface-600 bg-surface-800'
                        )} />
                        <span className={cn('text-[11px] font-medium truncate max-w-[90px]', draft.is_current ? 'text-[#FF5F1F]' : 'text-surface-300')}>
                          {draft.draft_name || `Draft ${draft.draft_number}`}
                        </span>
                        <span className="text-[9px] text-surface-500">
                          {new Date(draft.created_at).toLocaleDateString()} {new Date(draft.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {draft.word_count > 0 && (
                          <span className="text-[9px] text-surface-600">{draft.word_count} words · {draft.page_count}p</span>
                        )}
                        {draft.is_current && (
                          <span className="text-[8px] font-bold text-[#FF5F1F] uppercase">Current</span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Document */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-surface-900/30">
          {/* Title page (rendered in document) */}
          {currentScript?.title_page_data && (currentScript.title_page_data.title || currentScript.title_page_data.author) && (
            <div className={cn('sp-page mx-auto mt-4 md:mt-8 mb-0 shadow-2xl rounded-sm cursor-pointer group', darkMode && 'sp-dark')}
              onClick={() => setShowTitlePage(true)}
              title="Click to edit title page"
            >
              <div className="flex flex-col justify-center items-center min-h-[300px] md:min-h-[600px] relative">
                <div className="text-center" style={{ marginTop: '-80px' }}>
                  {currentScript.title_page_data.title && (
                    <div className={cn('text-2xl font-black uppercase tracking-wide mb-2', darkMode ? 'text-white' : 'text-black')}>
                      {currentScript.title_page_data.title}
                    </div>
                  )}
                  {currentScript.title_page_data.credit && (
                    <div className={cn('text-sm mt-6 mb-2', darkMode ? 'text-surface-300' : 'text-white/60')}>
                      {currentScript.title_page_data.credit}
                    </div>
                  )}
                  {currentScript.title_page_data.author && (
                    <div className={cn('text-sm', darkMode ? 'text-surface-300' : 'text-white/60')}>
                      {currentScript.title_page_data.author}
                    </div>
                  )}
                  {currentScript.title_page_data.source && (
                    <div className={cn('text-xs mt-4', darkMode ? 'text-surface-400' : 'text-white/40')}>
                      {currentScript.title_page_data.source}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-12 left-12 text-left">
                  {currentScript.title_page_data.draft_date && (
                    <div className={cn('text-xs', darkMode ? 'text-surface-400' : 'text-white/40')}>
                      {currentScript.title_page_data.draft_date}
                    </div>
                  )}
                  {currentScript.title_page_data.contact && (
                    <div className={cn('text-xs mt-1', darkMode ? 'text-surface-400' : 'text-white/40')}>
                      {currentScript.title_page_data.contact}
                    </div>
                  )}
                  {currentScript.title_page_data.copyright && (
                    <div className={cn('text-xs mt-1', darkMode ? 'text-surface-400' : 'text-white/40')}>
                      {currentScript.title_page_data.copyright}
                    </div>
                  )}
                </div>
                {/* Edit hint */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className={cn('text-[10px] px-2 py-1 rounded', darkMode ? 'bg-surface-700 text-surface-400' : 'bg-surface-800 text-white/40')}>
                    Click to edit
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className={cn(
            'sp-page mx-auto my-4 md:my-8 shadow-2xl rounded-sm',
            darkMode && 'sp-dark',
            displaySettings.pageWidth === 'narrow' && 'md:max-w-[6.5in]',
            displaySettings.pageWidth === 'wide' && 'md:max-w-[9in]',
          )} style={{ fontSize: `${displaySettings.fontSize}pt` }}>
            {elements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <svg className="w-12 h-12 mb-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm mb-2">Start writing your screenplay</p>
                <p className="text-xs opacity-60 mb-6">Press Enter to add lines. Tab to change element type.</p>
                <button onClick={() => handleToolbarAdd('scene_heading')}
                  className={cn('px-4 py-2 rounded text-sm', darkMode ? 'bg-surface-700 hover:bg-surface-600 text-white' : 'bg-surface-800 hover:bg-gray-200 text-white/60')}>
                  + Add Scene Heading
                </button>
              </div>
            ) : (
              filteredElements.map((element, index) => (
                <LineEditor
                  key={element.id}
                  elementId={element.id}
                  darkMode={darkMode}
                  characterNames={characterNames}
                  isHighlighted={searchQuery !== '' && (element.content || '').toLowerCase().includes(searchQuery.toLowerCase())}
                  showPageBreak={index > 0 && elementPages[element.id] !== elementPages[filteredElements[index - 1]?.id]}
                  pageNumber={elementPages[element.id]}
                  onFocused={(type) => setActiveElementType(type)}
                  collaborators={collabMap[element.id] || []}
                  projectId={params.id}
                  canEdit={canEdit}
                  displaySettings={displaySettings}
                  characterColorMap={characterColorMap}
                  sceneNumberMap={sceneNumberMap}
                  commentCount={commentCountMap[element.id] || 0}
                  onComment={openCommentPanel}
                  isContentCreator={isContentCreator}
                />
              ))
            )}
            {elements.length > 0 && canEdit && (
              <div className="py-12 text-center">
                <button onClick={() => {
                  const lastType = elements[elements.length - 1]?.element_type || 'action';
                  handleToolbarAdd(getNextElementType(lastType));
                }} className={cn('inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors',
                  darkMode ? 'text-surface-400 hover:text-white hover:bg-surface-700' : 'text-gray-400 hover:text-white/60 hover:bg-surface-800'
                )}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Element
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Comment Panel (right sidebar) ────────────────────── */}
      {showCommentPanel && (
        <ScriptCommentPanel
          elementId={commentPanelElement}
          elements={elements}
          comments={scriptComments}
          userId={user?.id || ''}
          darkMode={darkMode}
          onClose={() => { setShowCommentPanel(false); setCommentPanelElement(null); }}
          onPost={handlePostScriptComment}
          onReply={handleReplyScriptComment}
          onResolve={handleResolveComment}
          onDelete={handleDeleteComment}
          onSelectElement={(id) => {
            setCommentPanelElement(id);
            document.getElementById(`el-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          newCommentText={newCommentText}
          setNewCommentText={setNewCommentText}
          newCommentType={newCommentType}
          setNewCommentType={setNewCommentType}
          posting={postingComment}
        />
      )}

      {/* Modals */}
      <TitlePageModal isOpen={showTitlePage} onClose={() => setShowTitlePage(false)} script={currentScript} />
      <NewScriptModal isOpen={showNewScript} onClose={() => setShowNewScript(false)}
        projectId={params.id} userId={user?.id || ''}
        onCreated={() => { fetchScripts(params.id); setShowNewScript(false); }}
      />

      {/* Format Guide Reminder Card (floating, for content creators) */}
      {isContentCreator && !showFormatIntro && showFormatReminder && (
        <div className="fixed bottom-6 right-6 z-40 no-print">
          <div className="bg-surface-800 border border-surface-700 rounded-xl shadow-xl p-4 max-w-xs animate-fade-in-up">
            <button
              onClick={() => {
                setShowFormatReminder(false);
                try { localStorage.setItem('ss_hide_format_reminder', 'true'); } catch {}
              }}
              className="absolute top-2 right-2 p-1 text-surface-500 hover:text-white rounded"
              title="Dismiss"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FF5F1F]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#FF5F1F]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-medium text-white">Creator Format</p>
                <p className="text-xs text-surface-400 mt-0.5">
                  Use <code className="px-1 py-0.5 bg-surface-700 rounded text-[#FF5F1F]">#</code> for chapters,
                  <code className="px-1 py-0.5 bg-surface-700 rounded text-[#FF5F1F] ml-1">!</code> for hooks,
                  <code className="px-1 py-0.5 bg-surface-700 rounded text-[#FF5F1F] ml-1">&gt;</code> for script
                </p>
                <button
                  onClick={() => setShowFormatIntro(true)}
                  className="text-xs text-[#FF5F1F] hover:text-[#FF8F5F] mt-2 inline-flex items-center gap-1"
                >
                  View full guide
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// ============================================================
// SCRIPT COMMENT PANEL — right sidebar for inline comments
// ============================================================

interface ScriptCommentPanelProps {
  elementId: string | null;
  elements: ScriptElement[];
  comments: (Comment & { profile?: Profile })[];
  userId: string;
  darkMode: boolean;
  onClose: () => void;
  onPost: (elementId: string) => Promise<void>;
  onReply: (parentId: string, content: string, type: CommentType) => Promise<void>;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectElement: (id: string) => void;
  newCommentText: string;
  setNewCommentText: (v: string) => void;
  newCommentType: CommentType;
  setNewCommentType: (v: CommentType) => void;
  posting: boolean;
}

function ScriptCommentPanel({
  elementId, elements, comments, userId, darkMode,
  onClose, onPost, onReply, onResolve, onDelete, onSelectElement,
  newCommentText, setNewCommentText, newCommentType, setNewCommentType, posting,
}: ScriptCommentPanelProps) {
  // Get unique elements that have comments
  const commentedElementIds = useMemo(() => {
    const ids = new Set<string>();
    comments.forEach(c => { if (!c.parent_id) ids.add(c.entity_id); });
    return Array.from(ids);
  }, [comments]);

  const selectedElement = elements.find(e => e.id === elementId);
  const elementComments = elementId
    ? comments.filter(c => c.entity_id === elementId)
    : [];
  const rootComments = elementComments.filter(c => !c.parent_id);

  // Mini thread component
  function MiniThread({ comment, depth }: { comment: Comment & { profile?: Profile }; depth: number }) {
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [replyType, setReplyType] = useState<CommentType>('note');
    const [submitting, setSubmitting] = useState(false);
    const replies = elementComments.filter(c => c.parent_id === comment.id);

    const handleReply = async () => {
      if (!replyText.trim()) return;
      setSubmitting(true);
      await onReply(comment.id, replyText.trim(), replyType);
      setReplyText('');
      setShowReply(false);
      setSubmitting(false);
    };

    return (
      <div className={cn(depth > 0 && 'ml-4 border-l border-surface-800 pl-3')}>
        <div className="py-2">
          <div className="flex items-center gap-2 mb-1">
            <Avatar src={comment.profile?.avatar_url} name={comment.profile?.full_name || 'User'} size="sm" />
            <span className="text-xs font-medium text-surface-300">{comment.profile?.full_name || 'Anonymous'}</span>
            {comment.comment_type === 'issue' && !comment.is_resolved && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">Issue</span>
            )}
            {comment.comment_type === 'suggestion' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">Suggestion</span>
            )}
            {comment.is_resolved && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Resolved</span>
            )}
            <span className="text-[10px] text-surface-600 ml-auto">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-sm text-surface-300 whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1">
            <button onClick={() => setShowReply(!showReply)} className="text-[11px] text-surface-500 hover:text-[#FF5F1F]">Reply</button>
            {comment.comment_type === 'issue' && !comment.is_resolved && (
              <button onClick={() => onResolve(comment.id)} className="text-[11px] text-surface-500 hover:text-green-400">Resolve</button>
            )}
            {comment.created_by === userId && (
              <button onClick={() => onDelete(comment.id)} className="text-[11px] text-surface-500 hover:text-red-400">Delete</button>
            )}
          </div>
          {showReply && (
            <div className="mt-2 space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Reply..."
                rows={2}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:border-[#FF5F1F] focus:outline-none resize-none"
              />
              <div className="flex items-center gap-2">
                <select value={replyType} onChange={(e) => setReplyType(e.target.value as CommentType)}
                  className="rounded-lg border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white" aria-label="Comment type">
                  <option value="note">Note</option>
                  <option value="suggestion">Suggestion</option>
                  <option value="issue">Issue</option>
                </select>
                <Button size="sm" onClick={handleReply} loading={submitting}>Reply</Button>
              </div>
            </div>
          )}
        </div>
        {replies.map(r => <MiniThread key={r.id} comment={r} depth={depth + 1} />)}
      </div>
    );
  }

  return (
    <aside className="w-80 lg:w-96 border-l border-surface-800 flex flex-col bg-surface-950 shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Script Comments</h3>
        <button onClick={onClose} className="p-1 rounded text-surface-400 hover:text-white hover:bg-surface-900/5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Element selector — list of elements with comments */}
      {commentedElementIds.length > 0 && !elementId && (
        <div className="border-b border-surface-800 px-3 py-2 overflow-y-auto max-h-60">
          <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">Elements with comments</p>
          {commentedElementIds.map(id => {
            const el = elements.find(e => e.id === id);
            const count = comments.filter(c => c.entity_id === id && !c.parent_id).length;
            return (
              <button key={id} onClick={() => onSelectElement(id)}
                className="w-full text-left px-2 py-1.5 rounded text-xs text-surface-400 hover:text-white hover:bg-surface-900/5 flex items-center gap-2 mb-0.5">
                <span className="text-[9px] text-surface-600 font-medium uppercase shrink-0">{ELEMENT_LABELS[el?.element_type || 'action']}</span>
                <span className="truncate flex-1">{el?.content || 'Empty'}</span>
                <span className="text-[9px] bg-[#FF5F1F]/20 text-[#FF5F1F] px-1.5 py-0.5 rounded-full shrink-0">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected element context */}
      {selectedElement && (
        <div className="border-b border-surface-800 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] text-surface-500 uppercase font-medium tracking-wider">{ELEMENT_LABELS[selectedElement.element_type]}</span>
            <button onClick={() => onSelectElement('')} className="text-[10px] text-surface-500 hover:text-white ml-auto">
              ← All comments
            </button>
          </div>
          <p className={cn('text-sm line-clamp-3', darkMode ? 'text-surface-300' : 'text-white/60')}>
            {selectedElement.content || <span className="italic text-surface-600">Empty element</span>}
          </p>
        </div>
      )}

      {/* Comments thread */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {elementId ? (
          rootComments.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-8">No comments on this element yet</p>
          ) : (
            rootComments.map(c => <MiniThread key={c.id} comment={c} depth={0} />)
          )
        ) : (
          <div className="text-center py-8">
            <svg className="w-8 h-8 text-surface-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
            <p className="text-sm text-surface-500">Click the comment icon on any script element to start a thread</p>
            {commentedElementIds.length > 0 && (
              <p className="text-xs text-surface-600 mt-2">
                {commentedElementIds.length} element{commentedElementIds.length !== 1 ? 's' : ''} with comments
              </p>
            )}
          </div>
        )}
      </div>

      {/* New comment form */}
      {elementId && (
        <div className="border-t border-surface-800 px-4 py-3">
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:border-[#FF5F1F] focus:outline-none resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onPost(elementId);
              }
            }}
          />
          <div className="flex items-center justify-between mt-2">
            <select value={newCommentType} onChange={(e) => setNewCommentType(e.target.value as CommentType)}
              className="rounded-lg border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white" aria-label="Comment type">
              <option value="note">Note</option>
              <option value="suggestion">Suggestion</option>
              <option value="issue">Issue</option>
            </select>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-surface-600">⌘↵</span>
              <Button size="sm" onClick={() => onPost(elementId)} loading={posting} disabled={!newCommentText.trim()}>
                Post
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

// ============================================================
// LINE EDITOR — fully self-contained, reads fresh state via getState()
// No function props go through the memo boundary.
// ============================================================

interface LineEditorProps {
  elementId: string;
  darkMode: boolean;
  characterNames: string[];
  isHighlighted: boolean;
  showPageBreak: boolean;
  pageNumber?: number;
  onFocused: (type: ScriptElementType) => void;
  collaborators: CollabCursor[];
  projectId: string;
  canEdit: boolean;
  displaySettings: DisplaySettings;
  characterColorMap: Record<string, number>;
  sceneNumberMap: Record<string, string>;
  commentCount: number;
  onComment: (elementId: string) => void;
  isContentCreator: boolean;
}

const LineEditor = memo(function LineEditor({
  elementId,
  darkMode,
  characterNames,
  isHighlighted,
  showPageBreak,
  pageNumber,
  onFocused,
  collaborators,
  projectId,
  canEdit,
  displaySettings,
  characterColorMap,
  sceneNumberMap,
  commentCount,
  onComment,
  isContentCreator,
}: LineEditorProps) {
  // Subscribe to just this element via a Zustand selector
  const element = useScriptStore((s) => s.elements.find((e) => e.id === elementId));

  const divRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localContentRef = useRef('');
  const skipAutoDetectRef = useRef(false);
  const isFocusedRef = useRef(false);

  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  // Mount: populate DOM from element content
  useEffect(() => {
    if (divRef.current && element) {
      divRef.current.textContent = element.content || '';
      localContentRef.current = element.content || '';
    }
  }, [elementId]); // eslint-disable-line react-hooks/exhaustive-deps

  // External content updates (other users) — only apply if not focused
  useEffect(() => {
    if (!divRef.current || !element) return;
    if (element.content !== localContentRef.current && !isFocusedRef.current) {
      divRef.current.textContent = element.content || '';
      localContentRef.current = element.content || '';
    }
  }, [element?.content]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!element) return null;

  // --- Save debounced ---
  const save = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const u = useAuthStore.getState().user;
      useScriptStore.getState().updateElement(elementId, {
        content: text,
        last_edited_by: u?.id,
        updated_at: new Date().toISOString(),
      });
    }, 400);
  };

  // --- Input handler ---
  const handleInput = () => {
    if (!divRef.current) return;
    const text = divRef.current.textContent || '';
    localContentRef.current = text;

    // Auto-detect type from content
    if (!skipAutoDetectRef.current) {
      const trimmed = text.trimStart().toUpperCase();
      if (element.element_type !== 'scene_heading' && /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/.test(trimmed)) {
        useScriptStore.getState().updateElement(elementId, { element_type: 'scene_heading' });
      }
      if (element.element_type !== 'transition' && text.trim().length > 2 && /^[A-Z\s]+:$/.test(text.trim())) {
        useScriptStore.getState().updateElement(elementId, { element_type: 'transition' });
      }
    }

    // Character autocomplete
    if (element.element_type === 'character' && text.length > 0) {
      const upper = text.toUpperCase();
      const matches = characterNames.filter((n) => n.startsWith(upper) && n !== upper);
      setSuggestions(matches.slice(0, 5));
      setSelectedSuggestion(0);
    } else {
      if (suggestions.length > 0) setSuggestions([]);
    }

    save(text);
  };

  // --- Apply character autocomplete ---
  const applySuggestion = (name: string) => {
    if (!divRef.current) return;
    divRef.current.textContent = name;
    localContentRef.current = name;
    setSuggestions([]);
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(divRef.current);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    save(name);
  };

  // --- Cursor position detection ---
  const getCursorPosition = (): { atStart: boolean; atEnd: boolean } => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !divRef.current) return { atStart: false, atEnd: false };
    const range = sel.getRangeAt(0);
    const text = divRef.current.textContent || '';

    // Check if at start
    const preRange = document.createRange();
    preRange.selectNodeContents(divRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const atStart = preRange.toString().length === 0;

    // Check if at end
    const postRange = document.createRange();
    postRange.selectNodeContents(divRef.current);
    postRange.setStart(range.endContainer, range.endOffset);
    const atEnd = postRange.toString().length === 0;

    return { atStart, atEnd };
  };

  // --- Keyboard handler (all store access via getState) ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Viewers cannot edit
    if (!canEdit) return;

    // Character autocomplete navigation
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestion((p) => Math.min(p + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestion((p) => Math.max(p - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySuggestion(suggestions[selectedSuggestion]); return; }
      if (e.key === 'Escape') { setSuggestions([]); return; }
    }

    // ========== ENTER — create new element below ==========
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();

      const store = useScriptStore.getState();
      const auth = useAuthStore.getState();
      if (!store.currentScript || !auth.user) {
        console.warn('[Enter] No script or user', { script: !!store.currentScript, user: !!auth.user });
        return;
      }

      const els = store.elements;
      const idx = els.findIndex((el) => el.id === elementId);
      // Place new element between current and next
      const currentOrder = idx >= 0 ? els[idx].sort_order : 0;
      const nextOrder = idx < els.length - 1 ? els[idx + 1].sort_order : currentOrder + 2;
      const newOrder = (currentOrder + nextOrder) / 2;
      const nextType = getNextElementType(element.element_type);

      console.log('[Enter] Creating element:', { nextType, newOrder, scriptId: store.currentScript.id });

      store.addElement({
        script_id: store.currentScript.id,
        element_type: nextType,
        content: '',
        sort_order: newOrder,
        created_by: auth.user.id,
        last_edited_by: auth.user.id,
      }).then((newEl) => {
        if (newEl) {
          console.log('[Enter] Element created:', newEl.id);
          focusElement(newEl.id, 'start');
        } else {
          console.error('[Enter] addElement returned null — check RLS / Supabase errors');
        }
      }).catch((err) => {
        console.error('[Enter] addElement threw:', err);
      });
      return;
    }

    // ========== TAB — cycle element type ==========
    if (e.key === 'Tab') {
      e.preventDefault();
      skipAutoDetectRef.current = true;
      setTimeout(() => { skipAutoDetectRef.current = false; }, 300);
      const ci = ELEMENT_CYCLE.indexOf(element.element_type);
      const ni = e.shiftKey
        ? (ci - 1 + ELEMENT_CYCLE.length) % ELEMENT_CYCLE.length
        : (ci + 1) % ELEMENT_CYCLE.length;
      useScriptStore.getState().updateElement(elementId, { element_type: ELEMENT_CYCLE[ni] });
      onFocused(ELEMENT_CYCLE[ni]);
      return;
    }

    // ========== BACKSPACE on empty — delete element ==========
    if (e.key === 'Backspace') {
      const text = divRef.current?.textContent || '';
      if (text === '') {
        const els = useScriptStore.getState().elements;
        if (els.length > 1) {
          e.preventDefault();
          const idx = els.findIndex((el) => el.id === elementId);
          const prevId = idx > 0 ? els[idx - 1].id : null;
          useScriptStore.getState().deleteElement(elementId);
          if (prevId) focusElement(prevId, 'end');
        }
        return;
      }
    }

    // ========== ARROW UP at start — focus previous element ==========
    if (e.key === 'ArrowUp') {
      const { atStart } = getCursorPosition();
      if (atStart) {
        const els = useScriptStore.getState().elements;
        const idx = els.findIndex((el) => el.id === elementId);
        if (idx > 0) {
          e.preventDefault();
          focusElement(els[idx - 1].id, 'end');
        }
        return;
      }
    }

    // ========== ARROW DOWN at end — focus next element ==========
    if (e.key === 'ArrowDown') {
      const { atEnd } = getCursorPosition();
      if (atEnd) {
        const els = useScriptStore.getState().elements;
        const idx = els.findIndex((el) => el.id === elementId);
        if (idx < els.length - 1) {
          e.preventDefault();
          focusElement(els[idx + 1].id, 'start');
        }
        return;
      }
    }

    // ========== ARROW LEFT at start — end of previous element ==========
    if (e.key === 'ArrowLeft' && !e.shiftKey) {
      const { atStart } = getCursorPosition();
      if (atStart) {
        const els = useScriptStore.getState().elements;
        const idx = els.findIndex((el) => el.id === elementId);
        if (idx > 0) {
          e.preventDefault();
          focusElement(els[idx - 1].id, 'end');
        }
        return;
      }
    }

    // ========== ARROW RIGHT at end — start of next element ==========
    if (e.key === 'ArrowRight' && !e.shiftKey) {
      const { atEnd } = getCursorPosition();
      if (atEnd) {
        const els = useScriptStore.getState().elements;
        const idx = els.findIndex((el) => el.id === elementId);
        if (idx < els.length - 1) {
          e.preventDefault();
          focusElement(els[idx + 1].id, 'start');
        }
        return;
      }
    }
  };

  // Broadcast focus to presence channel
  const broadcastFocus = (elId: string | null) => {
    const auth = useAuthStore.getState();
    if (!auth.user) return;
    const supabase = createClient();
    const ch = supabase.channel(`presence-${projectId}`);
    try {
      ch.track({
        user_id: auth.user.id,
        project_id: projectId,
        current_page: 'script',
        is_online: true,
        last_seen: new Date().toISOString(),
        full_name: auth.user.full_name || auth.user.email || '',
        email: auth.user.email || '',
        avatar_url: auth.user.avatar_url || '',
        focused_element_id: elId,
      });
    } catch {}
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    onFocused(element.element_type);
    broadcastFocus(elementId);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    broadcastFocus(null);
  };

  const revisionBg = (displaySettings.showRevisionColors && element.is_revised && element.revision_color && element.revision_color !== 'white')
    ? REVISION_COLOR_HEX[element.revision_color] : undefined;

  // Character highlight color — for character and their dialogue/parenthetical lines
  const charColorIdx = (() => {
    if (!displaySettings.showCharacterHighlights) return -1;
    if (element.element_type === 'character') {
      const name = (element.content || '').trim().toUpperCase();
      return characterColorMap[name] ?? -1;
    }
    // For dialogue/parenthetical: find the nearest preceding character element
    if (element.element_type === 'dialogue' || element.element_type === 'parenthetical') {
      const els = useScriptStore.getState().elements;
      const idx = els.findIndex((e) => e.id === element.id);
      for (let j = idx - 1; j >= 0; j--) {
        if (els[j].element_type === 'character') {
          const name = (els[j].content || '').trim().toUpperCase();
          return characterColorMap[name] ?? -1;
        }
        if (els[j].element_type !== 'dialogue' && els[j].element_type !== 'parenthetical') break;
      }
    }
    return -1;
  })();

  // Hide notes if display settings say so
  if (!displaySettings.showNotes && element.element_type === 'note') return null;

  return (
    <>
      {showPageBreak && (
        <div className="relative py-2">
          <div className={cn('border-t border-dashed', darkMode ? 'border-surface-600' : 'border-white/15')} />
          <span className={cn('absolute right-0 -top-2 text-[9px] px-1', darkMode ? 'text-surface-500' : 'text-gray-400')}>Page {pageNumber}</span>
        </div>
      )}
      <div
        className={cn('sp-line group relative',
          isHighlighted && (darkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'),
          element.is_omitted && 'opacity-40 line-through',
          collaborators.length > 0 && COLLAB_COLORS[collaborators[0].colorIdx].bg,
          charColorIdx >= 0 && CHARACTER_COLORS[charColorIdx].bg,
        )}
        style={{
          ...(revisionBg ? { backgroundColor: revisionBg + '40' } : {}),
          ...(collaborators.length > 0 ? { borderLeft: `3px solid ${COLLAB_COLORS[collaborators[0].colorIdx].hex}`, paddingLeft: '8px' } : {}),
          ...(charColorIdx >= 0 && collaborators.length === 0 ? { borderLeft: `3px solid ${CHARACTER_COLORS[charColorIdx].hex}`, paddingLeft: '8px' } : {}),
          fontSize: `${displaySettings.fontSize}pt`,
        }}
      >
        {/* Scene number badge */}
        {displaySettings.showSceneNumbers && element.element_type === 'scene_heading' && sceneNumberMap[element.id] && (
          <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <span className={cn('text-[10px] font-bold tabular-nums', darkMode ? 'text-surface-500' : 'text-gray-400')}>
              {sceneNumberMap[element.id]}
            </span>
          </div>
        )}
        {/* Collaborator labels */}
        {collaborators.length > 0 && (
          <div className="absolute -top-4 left-0 flex gap-1 z-10">
            {collaborators.map((c) => (
              <span key={c.userId} className={cn('px-1.5 py-0 rounded-t text-[9px] font-medium', COLLAB_COLORS[c.colorIdx].text)} style={{ backgroundColor: COLLAB_COLORS[c.colorIdx].hex + '30' }}>
                {c.name}
              </span>
            ))}
          </div>
        )}
        {/* Gutter — shown on hover */}
        <div className="sp-gutter">
          <button onClick={() => setShowTypeMenu(!showTypeMenu)}
            className="px-1.5 py-0.5 rounded text-[9px] font-medium text-surface-400 hover:bg-surface-700 whitespace-nowrap">
            {ELEMENT_LABELS[element.element_type]}
          </button>
        </div>

        {/* Comment button — right side */}
        <button
          onClick={(e) => { e.stopPropagation(); onComment(elementId); }}
          className={cn(
            'absolute -right-8 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full transition-all',
            commentCount > 0
              ? 'text-[#FF5F1F] bg-[#FF5F1F]/15 opacity-100'
              : 'text-surface-500 opacity-0 group-hover:opacity-100 hover:bg-surface-700 hover:text-white'
          )}
          title={commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}` : 'Add comment'}
          aria-label={commentCount > 0 ? `${commentCount} comments on this element` : 'Add comment'}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
          {commentCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF5F1F] text-[8px] font-bold text-white flex items-center justify-center">
              {commentCount > 9 ? '9+' : commentCount}
            </span>
          )}
        </button>

        {showTypeMenu && (
          <div className="absolute -left-24 top-6 z-20 bg-surface-800 border border-surface-700 rounded-lg shadow-lg py-1 min-w-[140px]">
            {ELEMENT_CYCLE.map((type) => (
              <button key={type} onClick={() => {
                useScriptStore.getState().updateElement(elementId, { element_type: type });
                setShowTypeMenu(false);
              }} className={cn('w-full text-left px-3 py-1 text-xs hover:bg-surface-700',
                element.element_type === type ? 'text-[#FF5F1F] font-medium' : 'text-surface-300'
              )}>{ELEMENT_LABELS[type]}</button>
            ))}
          </div>
        )}

        {/* Editable element */}
        <div
          ref={divRef}
          id={`el-${elementId}`}
          contentEditable={canEdit}
          suppressContentEditableWarning
          className={cn('sp-element', getElementClass(element.element_type))}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          data-placeholder={getElementPlaceholder(element.element_type, isContentCreator)}
        />

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-30 mt-0.5 bg-surface-800 border border-surface-600 rounded-lg shadow-xl py-1 min-w-[180px]" style={{ left: '2.2in' }}>
            {suggestions.map((name, i) => (
              <button key={name} onMouseDown={(ev) => { ev.preventDefault(); applySuggestion(name); }}
                className={cn('w-full text-left px-3 py-1.5 text-xs font-mono',
                  i === selectedSuggestion ? 'bg-[#E54E15]/30 text-[#FF8F5F]' : 'text-surface-300 hover:bg-surface-700'
                )}>{name}</button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}, (prev, next) => {
  // Only re-render if these shallow values change
  return prev.elementId === next.elementId
    && prev.darkMode === next.darkMode
    && prev.isHighlighted === next.isHighlighted
    && prev.showPageBreak === next.showPageBreak
    && prev.pageNumber === next.pageNumber
    && prev.characterNames === next.characterNames
    && prev.collaborators === next.collaborators
    && prev.projectId === next.projectId
    && prev.canEdit === next.canEdit
    && prev.displaySettings === next.displaySettings
    && prev.characterColorMap === next.characterColorMap
    && prev.commentCount === next.commentCount
    && prev.isContentCreator === next.isContentCreator;
  // Note: element content changes are handled by the Zustand selector
  // inside the component, not through props. onFocused and onComment
  // are intentionally excluded — they're stable parent callbacks.
});

// ============================================================
// Title Page Modal
// ============================================================

function TitlePageModal({ isOpen, onClose, script }: { isOpen: boolean; onClose: () => void; script: Script | null }) {
  const [data, setData] = useState<TitlePageData>(script?.title_page_data || {});
  const { setCurrentScript } = useScriptStore();
  useEffect(() => { if (script) setData(script.title_page_data || {}); }, [script]);

  const handleSave = async () => {
    if (!script) return;
    const supabase = createClient();
    await supabase.from('scripts').update({ title_page_data: data }).eq('id', script.id);
    // Update the Zustand store so exports pick up the title page immediately
    setCurrentScript({ ...script, title_page_data: data });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Title Page" size="md">
      <div className="space-y-4">
        <Input label="Title" value={data.title || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, title: e.target.value })} />
        <Input label="Written by" value={data.author || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, author: e.target.value })} />
        <Input label="Credit" value={data.credit || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, credit: e.target.value })} placeholder="Written by / Screenplay by" />
        <Input label="Source" value={data.source || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, source: e.target.value })} placeholder="Based on..." />
        <Input label="Draft Date" value={data.draft_date || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, draft_date: e.target.value })} />
        <Input label="Contact" value={data.contact || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, contact: e.target.value })} />
        <Input label="Copyright" value={data.copyright || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, copyright: e.target.value })} />
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Title Page</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// New Script Modal
// ============================================================

function NewScriptModal({ isOpen, onClose, projectId, userId, onCreated }: {
  isOpen: boolean; onClose: () => void; projectId: string; userId: string; onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from('scripts').insert({
      project_id: projectId,
      title: title.trim(),
      created_by: userId,
    });
    setLoading(false);
    setTitle('');
    onCreated();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Script Version" size="sm">
      <form onSubmit={handleCreate} className="space-y-4">
        <Input label="Script Title" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="Draft 2" required autoFocus />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
