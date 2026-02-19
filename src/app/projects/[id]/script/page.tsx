'use client';

import { useEffect, useState, useRef, useCallback, memo, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useScriptStore, useAuthStore, usePresenceStore } from '@/lib/stores';
import { useProjectStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';

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
import type { ScriptElement, ScriptElementType, Script, ScriptDraft } from '@/lib/types';
import { ELEMENT_LABELS, REVISION_COLOR_HEX } from '@/lib/types';

// ============================================================
// Constants
// ============================================================

const ELEMENT_CYCLE: ScriptElementType[] = [
  'scene_heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition',
];

function getNextElementType(current: ScriptElementType): ScriptElementType {
  switch (current) {
    case 'scene_heading': return 'action';
    case 'action': return 'action';
    case 'character': return 'dialogue';
    case 'dialogue': return 'action';
    case 'parenthetical': return 'dialogue';
    case 'transition': return 'scene_heading';
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
    default: return '';
  }
}

function getElementPlaceholder(type: ScriptElementType): string {
  switch (type) {
    case 'scene_heading': return 'INT./EXT. LOCATION - TIME';
    case 'action': return 'Action...';
    case 'character': return 'CHARACTER NAME';
    case 'dialogue': return 'Dialogue...';
    case 'parenthetical': return '(direction)';
    case 'transition': return 'CUT TO:';
    case 'note': return '[[Note]]';
    default: return '';
  }
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
  const [activeElementType, setActiveElementType] = useState<ScriptElementType>('action');
  const [drafts, setDrafts] = useState<ScriptDraft[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [restoringDraft, setRestoringDraft] = useState(false);
  const [showScriptsSidebar, setShowScriptsSidebar] = useState(false);

  // Role awareness: determine if user can edit
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  useEffect(() => { fetchScripts(params.id); }, [params.id]);
  useEffect(() => { if (currentScript) { fetchElements(currentScript.id); loadDrafts(); } }, [currentScript?.id]);

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
      const focusedId = (u as any).focused_element_id;
      if (!focusedId) return;
      if (!map[focusedId]) map[focusedId] = [];
      map[focusedId].push({
        userId: u.user_id,
        name: (u as any).full_name || (u as any).email || 'User',
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

    const titlePage = script.title_page_data || {} as any;
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
  .title-page { display: flex; flex-direction: column; justify-content: center; align-items: center; }
  .title-page .page-number { display: none; }
  .title-center { text-align: center; margin-top: -2in; }
  .title-bottom { position: absolute; bottom: 1.5in; left: 1.5in; }
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
      alert('Please allow popups to export PDF.');
      return;
    }
    win.document.write(html);
    win.document.close();
  }, []);

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
    <div className="flex h-full" onKeyDown={handleEditorKeyDown}>
      {/* Scripts sidebar toggle on mobile */}
      <button onClick={() => setShowScriptsSidebar(!showScriptsSidebar)}
        className="fixed bottom-4 left-4 z-30 md:hidden p-3 bg-brand-600 text-white rounded-full shadow-lg">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
      </button>

      {/* Sidebar */}
      <div className={cn(
        'w-56 border-r border-surface-800 flex flex-col bg-surface-950',
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
            <button onClick={() => setShowNewScript(true)} className="p-1 rounded text-surface-500 hover:text-white hover:bg-white/10">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          {scripts.map((script) => (
            <button key={script.id} onClick={() => setCurrentScript(script)}
              className={cn('w-full text-left px-2 py-1.5 rounded text-xs transition-colors mb-0.5',
                currentScript?.id === script.id ? 'bg-brand-600/10 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
              )}>
              <div className="flex items-center justify-between">
                <span className="truncate">{script.title}</span>
                <span className="text-[10px] text-surface-600">v{script.version}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">Scenes ({sceneHeadings.length})</p>
          <div className="space-y-0.5">
            {sceneHeadings.map((scene, i) => (
              <button key={scene.id} onClick={() => {
                document.getElementById(`el-${scene.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }} className="w-full text-left px-2 py-1.5 rounded text-xs text-surface-400 hover:text-white hover:bg-white/5 transition-colors">
                <span className="text-surface-600 mr-1">{i + 1}.</span>
                <span className="truncate">{scene.content || 'Untitled Scene'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-surface-800">
          {scriptUsers.length > 0 && (
            <div className="mb-3 pb-3 border-b border-surface-800">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-1.5">Editing Now</p>
              <div className="flex flex-wrap gap-1">
                {scriptUsers.map((u) => (
                  <div key={u.user_id} className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 rounded text-[10px] text-green-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {(u as any).full_name || (u as any).email || 'User'}
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
                className="h-1.5 rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (totalPages / 120) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-surface-600 mt-1">~1 min/page &middot; {totalPages} pages &middot; {wordCount.toLocaleString()} words</p>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm px-3 md:px-4 py-2 flex items-center gap-2 no-print overflow-x-auto">
          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
              {ELEMENT_CYCLE.map((type) => (
                <button key={type} onClick={() => handleToolbarAdd(type)}
                  className={cn('px-2 md:px-2.5 py-1 rounded text-[10px] md:text-[11px] font-medium transition-colors whitespace-nowrap',
                    activeElementType === type ? 'bg-brand-600/20 text-brand-400' : 'text-surface-500 hover:text-white hover:bg-white/5'
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
            <span className="text-[10px] text-surface-600 px-1">Tab: change type &middot; Enter: new line</span>
            <button onClick={() => setShowSearch(!showSearch)} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-white/10" title="Search (Cmd+F)">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <button onClick={() => setShowTitlePage(true)} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-white/10" title="Title Page">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H14" /></svg>
            </button>
            <button onClick={handleExportPDF} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-white/10" title="Export PDF (Cmd+P)">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            </button>
            <button onClick={handleSaveDraft} disabled={savingDraft} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-white/10 disabled:opacity-50" title="Save Draft Snapshot">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            </button>
            <button onClick={() => setShowDrafts(!showDrafts)} className={cn('p-1.5 rounded transition-colors', showDrafts ? 'text-brand-400 bg-brand-500/10' : 'text-surface-500 hover:text-white hover:bg-white/10')} title="Draft Timeline">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <button onClick={() => setDarkMode(!darkMode)}
              className={cn('p-1.5 rounded transition-colors', darkMode ? 'text-yellow-400 hover:bg-white/10' : 'text-surface-500 hover:text-white hover:bg-white/10')}
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
                            ? 'bg-brand-500/15 border border-brand-500/30'
                            : 'hover:bg-surface-800 border border-transparent'
                        )}
                        title={draft.notes || undefined}
                      >
                        <div className={cn(
                          'w-3 h-3 rounded-full border-2',
                          draft.is_current ? 'border-brand-500 bg-brand-500' : 'border-surface-600 bg-surface-800'
                        )} />
                        <span className={cn('text-[11px] font-medium truncate max-w-[90px]', draft.is_current ? 'text-brand-400' : 'text-surface-300')}>
                          {draft.draft_name || `Draft ${draft.draft_number}`}
                        </span>
                        <span className="text-[9px] text-surface-500">
                          {new Date(draft.created_at).toLocaleDateString()} {new Date(draft.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {draft.word_count > 0 && (
                          <span className="text-[9px] text-surface-600">{draft.word_count} words · {draft.page_count}p</span>
                        )}
                        {draft.is_current && (
                          <span className="text-[8px] font-bold text-brand-400 uppercase">Current</span>
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
        <div className="flex-1 overflow-y-auto bg-surface-900/30">
          {/* Title page (rendered in document) */}
          {currentScript?.title_page_data && (currentScript.title_page_data.title || currentScript.title_page_data.author) && (
            <div className={cn('sp-page mx-auto mt-8 mb-0 shadow-2xl rounded-sm cursor-pointer group', darkMode && 'sp-dark')}
              onClick={() => setShowTitlePage(true)}
              title="Click to edit title page"
            >
              <div className="flex flex-col justify-center items-center min-h-[600px] relative">
                <div className="text-center" style={{ marginTop: '-80px' }}>
                  {currentScript.title_page_data.title && (
                    <div className={cn('text-2xl font-bold uppercase tracking-wide mb-2', darkMode ? 'text-white' : 'text-black')}>
                      {currentScript.title_page_data.title}
                    </div>
                  )}
                  {currentScript.title_page_data.credit && (
                    <div className={cn('text-sm mt-6 mb-2', darkMode ? 'text-surface-300' : 'text-gray-600')}>
                      {currentScript.title_page_data.credit}
                    </div>
                  )}
                  {currentScript.title_page_data.author && (
                    <div className={cn('text-sm', darkMode ? 'text-surface-300' : 'text-gray-600')}>
                      {currentScript.title_page_data.author}
                    </div>
                  )}
                  {currentScript.title_page_data.source && (
                    <div className={cn('text-xs mt-4', darkMode ? 'text-surface-400' : 'text-gray-500')}>
                      {currentScript.title_page_data.source}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-12 left-12 text-left">
                  {currentScript.title_page_data.draft_date && (
                    <div className={cn('text-xs', darkMode ? 'text-surface-400' : 'text-gray-500')}>
                      {currentScript.title_page_data.draft_date}
                    </div>
                  )}
                  {currentScript.title_page_data.contact && (
                    <div className={cn('text-xs mt-1', darkMode ? 'text-surface-400' : 'text-gray-500')}>
                      {currentScript.title_page_data.contact}
                    </div>
                  )}
                  {currentScript.title_page_data.copyright && (
                    <div className={cn('text-xs mt-1', darkMode ? 'text-surface-400' : 'text-gray-500')}>
                      {currentScript.title_page_data.copyright}
                    </div>
                  )}
                </div>
                {/* Edit hint */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className={cn('text-[10px] px-2 py-1 rounded', darkMode ? 'bg-surface-700 text-surface-400' : 'bg-gray-100 text-gray-500')}>
                    Click to edit
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className={cn('sp-page mx-auto my-8 shadow-2xl rounded-sm', darkMode && 'sp-dark')}>
            {elements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <svg className="w-12 h-12 mb-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm mb-2">Start writing your screenplay</p>
                <p className="text-xs opacity-60 mb-6">Press Enter to add lines. Tab to change element type.</p>
                <button onClick={() => handleToolbarAdd('scene_heading')}
                  className={cn('px-4 py-2 rounded text-sm', darkMode ? 'bg-surface-700 hover:bg-surface-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}>
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
                />
              ))
            )}
            {elements.length > 0 && canEdit && (
              <div className="py-12 text-center">
                <button onClick={() => {
                  const lastType = elements[elements.length - 1]?.element_type || 'action';
                  handleToolbarAdd(getNextElementType(lastType));
                }} className={cn('inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors',
                  darkMode ? 'text-surface-400 hover:text-white hover:bg-surface-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                )}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Element
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <TitlePageModal isOpen={showTitlePage} onClose={() => setShowTitlePage(false)} script={currentScript} />
      <NewScriptModal isOpen={showNewScript} onClose={() => setShowNewScript(false)}
        projectId={params.id} userId={user?.id || ''}
        onCreated={() => { fetchScripts(params.id); setShowNewScript(false); }}
      />
    </div>
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
        full_name: (auth.user as any).full_name || (auth.user as any).email || '',
        email: (auth.user as any).email || '',
        avatar_url: (auth.user as any).avatar_url || '',
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

  const revisionBg = element.is_revised && element.revision_color && element.revision_color !== 'white'
    ? REVISION_COLOR_HEX[element.revision_color] : undefined;

  return (
    <>
      {showPageBreak && (
        <div className="relative py-2">
          <div className={cn('border-t border-dashed', darkMode ? 'border-surface-600' : 'border-gray-300')} />
          <span className={cn('absolute right-0 -top-2 text-[9px] px-1', darkMode ? 'text-surface-500' : 'text-gray-400')}>Page {pageNumber}</span>
        </div>
      )}
      <div
        className={cn('sp-line group relative',
          isHighlighted && (darkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'),
          element.is_omitted && 'opacity-40 line-through',
          collaborators.length > 0 && COLLAB_COLORS[collaborators[0].colorIdx].bg,
        )}
        style={{
          ...(revisionBg ? { backgroundColor: revisionBg + '40' } : {}),
          ...(collaborators.length > 0 ? { borderLeft: `3px solid ${COLLAB_COLORS[collaborators[0].colorIdx].hex}`, paddingLeft: '8px' } : {}),
        }}
      >
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

        {showTypeMenu && (
          <div className="absolute -left-24 top-6 z-20 bg-surface-800 border border-surface-700 rounded-lg shadow-lg py-1 min-w-[140px]">
            {ELEMENT_CYCLE.map((type) => (
              <button key={type} onClick={() => {
                useScriptStore.getState().updateElement(elementId, { element_type: type });
                setShowTypeMenu(false);
              }} className={cn('w-full text-left px-3 py-1 text-xs hover:bg-surface-700',
                element.element_type === type ? 'text-brand-400 font-medium' : 'text-surface-300'
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
          data-placeholder={getElementPlaceholder(element.element_type)}
        />

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-30 mt-0.5 bg-surface-800 border border-surface-600 rounded-lg shadow-xl py-1 min-w-[180px]" style={{ left: '2.2in' }}>
            {suggestions.map((name, i) => (
              <button key={name} onMouseDown={(ev) => { ev.preventDefault(); applySuggestion(name); }}
                className={cn('w-full text-left px-3 py-1.5 text-xs font-mono',
                  i === selectedSuggestion ? 'bg-brand-600/30 text-brand-300' : 'text-surface-300 hover:bg-surface-700'
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
    && prev.canEdit === next.canEdit;
  // Note: element content changes are handled by the Zustand selector
  // inside the component, not through props. onFocused is intentionally
  // excluded — it's a stable parent callback.
});

// ============================================================
// Title Page Modal
// ============================================================

function TitlePageModal({ isOpen, onClose, script }: { isOpen: boolean; onClose: () => void; script: Script | null }) {
  const [data, setData] = useState(script?.title_page_data || {} as any);
  useEffect(() => { if (script) setData(script.title_page_data || {}); }, [script]);

  const handleSave = async () => {
    if (!script) return;
    const supabase = createClient();
    await supabase.from('scripts').update({ title_page_data: data }).eq('id', script.id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Title Page" size="md">
      <div className="space-y-4">
        <Input label="Title" value={data.title || ''} onChange={(e: any) => setData({ ...data, title: e.target.value })} />
        <Input label="Written by" value={data.author || ''} onChange={(e: any) => setData({ ...data, author: e.target.value })} />
        <Input label="Credit" value={data.credit || ''} onChange={(e: any) => setData({ ...data, credit: e.target.value })} placeholder="Written by / Screenplay by" />
        <Input label="Source" value={data.source || ''} onChange={(e: any) => setData({ ...data, source: e.target.value })} placeholder="Based on..." />
        <Input label="Draft Date" value={data.draft_date || ''} onChange={(e: any) => setData({ ...data, draft_date: e.target.value })} />
        <Input label="Contact" value={data.contact || ''} onChange={(e: any) => setData({ ...data, contact: e.target.value })} />
        <Input label="Copyright" value={data.copyright || ''} onChange={(e: any) => setData({ ...data, copyright: e.target.value })} />
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
        <Input label="Script Title" value={title} onChange={(e: any) => setTitle(e.target.value)} placeholder="Draft 2" required autoFocus />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
