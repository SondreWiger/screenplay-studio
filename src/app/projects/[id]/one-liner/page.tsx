'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore, useScriptStore } from '@/lib/stores';
import { Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ScriptElement, SceneStatus } from '@/lib/types';

// ── Scene status helpers ──────────────────────────────────────
const SCENE_STATUS_LABELS: Record<SceneStatus, string> = {
  first_draft: 'Draft',
  revised: 'Revised',
  locked: 'Locked',
  cut: 'Cut',
};

const SCENE_STATUS_COLORS: Record<SceneStatus, string> = {
  first_draft: 'text-surface-400 bg-surface-800/60 border-surface-700',
  revised: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  locked: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  cut: 'text-red-400 bg-red-500/10 border-red-500/30 line-through',
};

const SCENE_STATUS_CYCLE: SceneStatus[] = ['first_draft', 'revised', 'locked', 'cut'];

// ── Scene heading parser ──────────────────────────────────────
interface ParsedScene {
  id: string;
  raw: string;
  intExt: string;
  location: string;
  time: string;
  sceneNumber: string | null;
  sortOrder: number;
  status: SceneStatus;
  characters: string[];
  synopsis: string;        // editable one-liner description
}

function parseSceneHeading(content: string): { intExt: string; location: string; time: string } {
  // Match: INT. LOCATION - TIME or EXT./INT.EXT. etc.
  const upper = content.toUpperCase().trim();
  const prefixMatch = upper.match(/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|INT\/EXT\.?)\s*/);
  const intExt = prefixMatch ? prefixMatch[1].replace(/\.$/, '') : '';
  const rest = prefixMatch ? upper.slice(prefixMatch[0].length) : upper;
  const dashIdx = rest.lastIndexOf(' - ');
  const location = dashIdx >= 0 ? rest.slice(0, dashIdx).trim() : rest.trim();
  const time = dashIdx >= 0 ? rest.slice(dashIdx + 3).trim() : '';
  return { intExt, location, time };
}

function buildScenes(elements: ScriptElement[]): ParsedScene[] {
  const scenes: ParsedScene[] = [];
  let sceneIdx = 0;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.element_type !== 'scene_heading') continue;
    sceneIdx++;

    // Collect characters between this scene_heading and the next one
    const chars: string[] = [];
    for (let j = i + 1; j < elements.length; j++) {
      if (elements[j].element_type === 'scene_heading') break;
      if (elements[j].element_type === 'character') {
        const name = elements[j].content.trim().toUpperCase().replace(/\s*\(.*?\)\s*$/, '').trim();
        if (name && !chars.includes(name)) chars.push(name);
      }
    }

    const { intExt, location, time } = parseSceneHeading(el.content);
    scenes.push({
      id: el.id,
      raw: el.content,
      intExt,
      location,
      time,
      sceneNumber: el.scene_number,
      sortOrder: el.sort_order,
      status: (el.scene_status as SceneStatus) || 'first_draft',
      characters: chars,
      synopsis: (el.metadata as Record<string, string>)?.synopsis || '',
    });
  }

  return scenes;
}

export default function OneLinerPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const { currentScript, scripts, fetchScripts } = useScriptStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [elements, setElements] = useState<ScriptElement[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracks whether initial scripts-fetch attempt is done (prevents flash of "No script found")
  const [scriptsChecked, setScriptsChecked] = useState(scripts.length > 0);
  const [synopses, setSynopses] = useState<Record<string, string>>({});

  // Ensure scripts are loaded when navigating here directly
  useEffect(() => {
    const init = async () => {
      if (!scripts || scripts.length === 0) {
        await fetchScripts(params.id);
      }
      setScriptsChecked(true);
    };
    init();
  }, [params.id]);
  const [editingSynopsis, setEditingSynopsis] = useState<string | null>(null);
  const [synopsisValue, setSynopsisValue] = useState('');
  const [savingSynopsis, setSavingSynopsis] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const [showCut, setShowCut] = useState(true);

  const activeScript = currentScript ?? scripts?.[0] ?? null;

  const loadElements = useCallback(async () => {
    if (!activeScript) { setLoading(false); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from('script_elements')
      .select('*')
      .eq('script_id', activeScript.id)
      .order('sort_order', { ascending: true });
    setElements(data || []);
    // Seed synopses from metadata
    const synMap: Record<string, string> = {};
    for (const el of data || []) {
      if (el.element_type === 'scene_heading' && el.metadata?.synopsis) {
        synMap[el.id] = el.metadata.synopsis as string;
      }
    }
    setSynopses(synMap);
    setLoading(false);
  }, [activeScript?.id]);

  useEffect(() => { loadElements(); }, [loadElements]);

  const scenes = useMemo(() => buildScenes(elements).map(s => ({ ...s, synopsis: synopses[s.id] ?? s.synopsis })), [elements, synopses]);

  const visibleScenes = showCut ? scenes : scenes.filter(s => s.status !== 'cut');

  const handleCycleStatus = async (scene: ParsedScene) => {
    if (!canEdit) return;
    const next = SCENE_STATUS_CYCLE[(SCENE_STATUS_CYCLE.indexOf(scene.status) + 1) % SCENE_STATUS_CYCLE.length];
    const supabase = createClient();
    await supabase.from('script_elements').update({ scene_status: next }).eq('id', scene.id);
    setElements(prev => prev.map(e => e.id === scene.id ? { ...e, scene_status: next } : e));
  };

  const startEditSynopsis = (scene: ParsedScene) => {
    if (!canEdit) return;
    setEditingSynopsis(scene.id);
    setSynopsisValue(scene.synopsis);
  };

  const saveSynopsis = async (sceneId: string) => {
    setSavingSynopsis(sceneId);
    const supabase = createClient();
    const el = elements.find(e => e.id === sceneId);
    if (!el) { setSavingSynopsis(null); return; }
    const meta = { ...(el.metadata || {}), synopsis: synopsisValue.trim() };
    await supabase.from('script_elements').update({ metadata: meta }).eq('id', sceneId);
    setSynopses(prev => ({ ...prev, [sceneId]: synopsisValue.trim() }));
    setElements(prev => prev.map(e => e.id === sceneId ? { ...e, metadata: meta } : e));
    setEditingSynopsis(null);
    setSavingSynopsis(null);
  };

  const sceneCountByStatus: Record<SceneStatus, number> = {
    first_draft: scenes.filter(s => s.status === 'first_draft').length,
    revised: scenes.filter(s => s.status === 'revised').length,
    locked: scenes.filter(s => s.status === 'locked').length,
    cut: scenes.filter(s => s.status === 'cut').length,
  };

  const handlePrint = () => {
    const printScenes = showCut ? scenes : scenes.filter(s => s.status !== 'cut');
    const projectTitle = currentProject?.title || 'Untitled';
    const scriptTitle = activeScript?.title || '';
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const statusLabel: Record<SceneStatus, string> = {
      first_draft: 'DRAFT',
      revised: 'REV',
      locked: 'LOCK',
      cut: 'CUT',
    };

    const rows = printScenes.map((scene, idx) => {
      const sceneNum = scene.sceneNumber || String(idx + 1);
      const intExt = scene.intExt || '';
      const location = scene.location || scene.raw;
      const time = scene.time || '';
      const synopsis = scene.synopsis || '';
      const chars = scene.characters.join(', ');
      const status = statusLabel[scene.status];
      const isCut = scene.status === 'cut';
      return `
        <tr class="${isCut ? 'cut' : ''}">
          <td class="num">${sceneNum}</td>
          <td class="ie">${intExt}</td>
          <td class="loc"><strong>${location}</strong></td>
          <td class="tod">${time}</td>
          <td class="syn">${synopsis}</td>
          <td class="chars">${chars}</td>
          <td class="status ${scene.status}">${status}</td>
        </tr>`;
    }).join('');

    const totalDraft = sceneCountByStatus.first_draft;
    const totalRevised = sceneCountByStatus.revised;
    const totalLocked = sceneCountByStatus.locked;
    const totalCut = sceneCountByStatus.cut;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${projectTitle} — One-liner</title>
  <style>
    @page { size: A4 landscape; margin: 18mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt; color: #111; background: #fff; }

    /* ── Header ── */
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10pt; padding-bottom: 7pt; border-bottom: 2px solid #111; }
    .doc-header h1 { font-size: 15pt; font-weight: 900; letter-spacing: -0.3px; }
    .doc-header .sub { font-size: 8.5pt; color: #555; margin-top: 3pt; }
    .doc-header .meta { text-align: right; font-size: 8pt; color: #555; line-height: 1.6; }

    /* ── Stats row ── */
    .stats { display: flex; gap: 14pt; margin-bottom: 9pt; font-size: 8pt; color: #444; }
    .stats span { display: flex; align-items: center; gap: 4pt; }
    .stats .dot { display: inline-block; width: 7pt; height: 7pt; border-radius: 50%; }
    .dot-draft  { background: #aaa; }
    .dot-rev    { background: #3b82f6; }
    .dot-lock   { background: #22c55e; }
    .dot-cut    { background: #ef4444; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; }
    thead tr { border-bottom: 1.5px solid #111; }
    th { text-align: left; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 4pt 5pt 4pt; white-space: nowrap; }
    td { padding: 4pt 5pt; vertical-align: top; border-bottom: 0.5px solid #e0e0e0; font-size: 8.5pt; line-height: 1.4; }
    tbody tr:nth-child(even) { background: #fafafa; }
    tbody tr.cut td { color: #999; text-decoration: line-through; background: #f9f9f9; }

    /* column widths */
    .num   { width: 28pt; color: #888; font-size: 8pt; font-variant-numeric: tabular-nums; }
    .ie    { width: 30pt; font-weight: 700; font-size: 8pt; }
    .loc   { width: 170pt; }
    .tod   { width: 42pt; font-size: 8pt; color: #555; }
    .syn   { }  /* flexible */
    .chars { width: 130pt; font-size: 7.5pt; color: #555; }
    .status { width: 34pt; text-align: center; font-size: 7pt; font-weight: 700; letter-spacing: 0.06em; border-radius: 3pt; padding: 2pt 4pt; }

    .status.first_draft { color: #666; background: #f0f0f0; }
    .status.revised     { color: #1d4ed8; background: #dbeafe; }
    .status.locked      { color: #15803d; background: #dcfce7; }
    .status.cut         { color: #b91c1c; background: #fee2e2; text-decoration: none; }

    /* ── Footer ── */
    .doc-footer { margin-top: 10pt; font-size: 7.5pt; color: #aaa; text-align: right; border-top: 0.5px solid #ddd; padding-top: 5pt; }
  </style>
</head>
<body>
  <div class="doc-header">
    <div>
      <h1>${projectTitle}</h1>
      <div class="sub">One-liner / Scene List &mdash; ${scriptTitle}</div>
    </div>
    <div class="meta">
      <div>${dateStr}</div>
      <div>${printScenes.length} scene${printScenes.length !== 1 ? 's' : ''}</div>
    </div>
  </div>

  <div class="stats">
    ${totalDraft  > 0 ? `<span><span class="dot dot-draft"></span> ${totalDraft} Draft</span>` : ''}
    ${totalRevised > 0 ? `<span><span class="dot dot-rev"></span> ${totalRevised} Revised</span>` : ''}
    ${totalLocked > 0 ? `<span><span class="dot dot-lock"></span> ${totalLocked} Locked</span>` : ''}
    ${totalCut    > 0 ? `<span><span class="dot dot-cut"></span> ${totalCut} Cut</span>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th class="ie">I/E</th>
        <th class="loc">Location</th>
        <th class="tod">Time</th>
        <th class="syn">One-liner</th>
        <th class="chars">Characters</th>
        <th class="status">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="doc-footer">Screenplay Studio &mdash; ${projectTitle}</div>

  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  if (loading || !scriptsChecked) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!activeScript) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <p className="text-surface-400 font-medium">No script found</p>
        <p className="text-surface-600 text-sm mt-1">Create a script in the Script Editor first.</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-surface-800 px-6 py-4 flex items-center justify-between gap-4 shrink-0 no-print">
        <div>
          <h1 className="text-lg font-bold text-white">One-liner</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {scenes.length} scene{scenes.length !== 1 ? 's' : ''} · {activeScript.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status summary */}
          <div className="hidden md:flex items-center gap-1.5">
            {(Object.entries(sceneCountByStatus) as [SceneStatus, number][]).filter(([, c]) => c > 0).map(([status, count]) => (
              <span key={status} className={cn('text-[11px] px-2 py-0.5 rounded-full border', SCENE_STATUS_COLORS[status])}>
                {count} {SCENE_STATUS_LABELS[status]}
              </span>
            ))}
          </div>
          <div className="w-px h-5 bg-surface-700 hidden md:block" />
          <button
            onClick={() => setShowCut(!showCut)}
            className={cn('text-xs px-2.5 py-1 rounded-lg border transition-colors',
              showCut ? 'text-surface-300 bg-surface-800 border-surface-700' : 'text-[#FF5F1F] bg-[#FF5F1F]/10 border-[#FF5F1F]/30'
            )}
          >
            {showCut ? 'Hide Cut' : 'Show Cut'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-surface-700 text-surface-300 hover:text-white hover:border-surface-500 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print
          </button>
        </div>
      </div>

      {/* Scene table */}
      <div className="flex-1 overflow-auto">
        {scenes.length === 0 ? (
          <div className="flex items-center justify-center flex-1 py-24">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
              </div>
              <p className="text-surface-400 font-medium">No scene headings found</p>
              <p className="text-surface-600 text-sm mt-1">Add scene headings in the Script Editor to see them here.</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-950 no-print">
              <tr className="border-b border-surface-800">
                <th className="text-left text-[11px] font-medium text-surface-500 uppercase tracking-wider px-4 py-2.5 w-14">#</th>
                <th className="text-left text-[11px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2.5 w-16">Int/Ext</th>
                <th className="text-left text-[11px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2.5">Location</th>
                <th className="text-left text-[11px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2.5 w-24">Time</th>
                <th className="text-left text-[11px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2.5">One-liner</th>
                <th className="text-left text-[11px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2.5 hidden lg:table-cell">Characters</th>
                <th className="text-left text-[11px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2.5 w-24 no-print">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleScenes.map((scene, idx) => (
                <tr
                  key={scene.id}
                  className={cn(
                    'border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors group',
                    scene.status === 'cut' && 'opacity-50'
                  )}
                >
                  {/* Scene number */}
                  <td className="px-4 py-2.5 font-mono text-surface-400 text-xs">
                    {scene.sceneNumber || (idx + 1)}
                  </td>

                  {/* INT/EXT */}
                  <td className="px-3 py-2.5">
                    <span className={cn(
                      'text-[11px] font-mono font-bold px-1.5 py-0.5 rounded',
                      scene.intExt === 'INT' ? 'text-blue-300 bg-blue-500/10' :
                      scene.intExt === 'EXT' ? 'text-emerald-300 bg-emerald-500/10' :
                      'text-amber-300 bg-amber-500/10'
                    )}>
                      {scene.intExt || '—'}
                    </span>
                  </td>

                  {/* Location */}
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-white text-sm">{scene.location || scene.raw}</span>
                  </td>

                  {/* Time of day */}
                  <td className="px-3 py-2.5 text-surface-300 text-xs font-mono">
                    {scene.time || '—'}
                  </td>

                  {/* One-liner synopsis */}
                  <td className="px-3 py-2.5 min-w-[200px]">
                    {editingSynopsis === scene.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={synopsisValue}
                          onChange={(e) => setSynopsisValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveSynopsis(scene.id);
                            if (e.key === 'Escape') setEditingSynopsis(null);
                          }}
                          className="flex-1 bg-surface-700 border border-surface-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#FF5F1F]/60"
                          placeholder="Brief scene description..."
                          autoFocus
                        />
                        <button
                          onClick={() => saveSynopsis(scene.id)}
                          disabled={!!savingSynopsis}
                          className="text-[10px] px-2 py-1 rounded bg-[#FF5F1F] text-white hover:bg-[#E54E15] transition-colors"
                        >
                          {savingSynopsis === scene.id ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingSynopsis(null)} className="text-[10px] px-2 py-1 rounded bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div
                        className={cn('text-xs text-surface-300 cursor-pointer hover:text-white transition-colors min-h-[20px]', canEdit && 'group-hover:underline decoration-dotted decoration-surface-600')}
                        onClick={() => startEditSynopsis(scene)}
                        title={canEdit ? 'Click to edit one-liner' : undefined}
                      >
                        {scene.synopsis || (canEdit ? <span className="text-surface-600 italic">Add one-liner…</span> : '—')}
                      </div>
                    )}
                  </td>

                  {/* Characters */}
                  <td className="px-3 py-2.5 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {scene.characters.slice(0, 4).map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-300 border border-surface-700">
                          {c}
                        </span>
                      ))}
                      {scene.characters.length > 4 && (
                        <span className="text-[10px] text-surface-500">+{scene.characters.length - 4}</span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2.5 no-print">
                    <button
                      onClick={() => handleCycleStatus(scene)}
                      className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all hover:opacity-80', SCENE_STATUS_COLORS[scene.status])}
                      title="Click to cycle status"
                      disabled={!canEdit}
                    >
                      {SCENE_STATUS_LABELS[scene.status]}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
