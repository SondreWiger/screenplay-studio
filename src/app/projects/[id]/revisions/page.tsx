'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, LoadingPage, Modal, LoadingSpinner, toast, ToastContainer } from '@/components/ui';
import { timeAgo } from '@/lib/utils';

// ============================================================
// Revisions (Diff Comparison) — Pro Feature
// Real snapshot-based revisions with side-by-side diff and restore.
// ============================================================

type SnapshotElement = {
  id: string;
  element_type: string;
  content: string;
  sort_order: number;
  scene_number: string | null;
  revision_color: string;
  is_revised: boolean;
  is_omitted: boolean;
  metadata: Record<string, any>;
};

type Revision = {
  id: string;
  script_id: string;
  version: number;
  revision_color: string;
  notes: string | null;
  snapshot: SnapshotElement[] | null;
  created_by: string;
  created_at: string;
  author_name: string;
  page_count: number;
  word_count: number;
};

const REVISION_COLORS: { value: string; name: string; hex: string }[] = [
  { value: 'white', name: 'White', hex: '#FFFFFF' },
  { value: 'blue', name: 'Blue', hex: '#60A5FA' },
  { value: 'pink', name: 'Pink', hex: '#F472B6' },
  { value: 'yellow', name: 'Yellow', hex: '#FBBF24' },
  { value: 'green', name: 'Green', hex: '#34D399' },
  { value: 'goldenrod', name: 'Goldenrod', hex: '#DAA520' },
  { value: 'buff', name: 'Buff', hex: '#F0DC82' },
  { value: 'salmon', name: 'Salmon', hex: '#FA8072' },
  { value: 'cherry', name: 'Cherry', hex: '#DE3163' },
  { value: 'tan', name: 'Tan', hex: '#D2B48C' },
];

function getColorHex(dbValue: string): string {
  return REVISION_COLORS.find(c => c.value === dbValue)?.hex || '#FFFFFF';
}

function getColorName(dbValue: string): string {
  return REVISION_COLORS.find(c => c.value === dbValue)?.name || dbValue;
}

/** Calculate page count from elements (~250 words/page). */
function calcStats(elements: SnapshotElement[] | null): { pages: number; words: number } {
  if (!elements || elements.length === 0) return { pages: 0, words: 0 };
  const words = elements.reduce((sum, el) => sum + (el.content?.split(/\s+/).filter(Boolean).length || 0), 0);
  return { pages: Math.max(1, Math.ceil(words / 250)), words };
}

/** LCS-based line diff. Falls back to set-based diff for very large scripts. */
function diffLines(aLines: string[], bLines: string[]): { type: 'same' | 'added' | 'removed'; text: string }[] {
  const m = aLines.length;
  const n = bLines.length;
  if (m * n > 500_000) return diffSimple(aLines, bLines);

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aLines[i - 1] === bLines[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const stack: { type: 'same' | 'added' | 'removed'; text: string }[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      stack.push({ type: 'same', text: aLines[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'added', text: bLines[j - 1] }); j--;
    } else {
      stack.push({ type: 'removed', text: aLines[i - 1] }); i--;
    }
  }
  stack.reverse();
  return stack;
}

function diffSimple(aLines: string[], bLines: string[]): { type: 'same' | 'added' | 'removed'; text: string }[] {
  const bSet = new Set(bLines);
  const aSet = new Set(aLines);
  const result: { type: 'same' | 'added' | 'removed'; text: string }[] = [];
  for (const line of aLines) result.push({ type: bSet.has(line) ? 'same' : 'removed', text: line });
  for (const line of bLines) { if (!aSet.has(line)) result.push({ type: 'added', text: line }); }
  return result;
}

/** Convert snapshot elements into labelled text lines for diffing. */
function snapshotToLines(elements: SnapshotElement[]): string[] {
  return [...elements]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter(el => !el.is_omitted)
    .map(el => {
      const prefix = el.element_type ? `[${el.element_type.toUpperCase().replace(/_/g, ' ')}] ` : '';
      return prefix + (el.content || '');
    });
}

export default function RevisionsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuth();
  const { isPro } = useProFeatures();
  const { currentProject } = useProjectStore();
  const hasProAccess = isPro || currentProject?.pro_enabled === true;

  const [activeScript, setActiveScript] = useState<{ id: string; version: number; revision_color: string } | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

  // ------- Data loading -------

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const { data: scriptData } = await supabase
      .from('scripts')
      .select('id, version, revision_color')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!scriptData) {
      setActiveScript(null);
      setRevisions([]);
      setLoading(false);
      return;
    }
    setActiveScript(scriptData);

    const { data: revData } = await supabase
      .from('revisions')
      .select('*, author:profiles!created_by(full_name, email)')
      .eq('script_id', scriptData.id)
      .order('version', { ascending: false });

    const mapped: Revision[] = (revData || []).map((r: any) => {
      const snap: SnapshotElement[] | null = r.snapshot ? (Array.isArray(r.snapshot) ? r.snapshot : []) : null;
      const stats = calcStats(snap);
      return {
        id: r.id,
        script_id: r.script_id,
        version: r.version,
        revision_color: r.revision_color || 'white',
        notes: r.notes,
        snapshot: snap,
        created_by: r.created_by,
        created_at: r.created_at,
        author_name: r.author?.full_name || r.author?.email || 'Unknown',
        page_count: stats.pages,
        word_count: stats.words,
      };
    });

    setRevisions(mapped);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (!hasProAccess) { setLoading(false); return; }
    fetchData();
  }, [hasProAccess, fetchData]);

  // ------- Create new revision -------

  const createRevision = async () => {
    if (!user || !activeScript) return;
    setCreating(true);
    const supabase = createClient();

    try {
      const { data: elements, error: elErr } = await supabase
        .from('script_elements')
        .select('id, element_type, content, sort_order, scene_number, revision_color, is_revised, is_omitted, metadata')
        .eq('script_id', activeScript.id)
        .order('sort_order', { ascending: true });

      if (elErr) throw elErr;

      const maxVersion = revisions.length > 0 ? Math.max(...revisions.map(r => r.version)) : 0;
      const nextVersion = maxVersion + 1;
      const nextColorIdx = nextVersion % REVISION_COLORS.length;
      const nextColor = REVISION_COLORS[nextColorIdx].value;

      const { error: insErr } = await supabase
        .from('revisions')
        .insert({
          script_id: activeScript.id,
          version: nextVersion,
          revision_color: nextColor,
          notes: null,
          snapshot: elements || [],
          created_by: user.id,
        });

      if (insErr) throw insErr;

      await supabase.from('scripts')
        .update({ version: nextVersion, revision_color: nextColor })
        .eq('id', activeScript.id);

      toast(`Revision ${nextVersion} (${getColorName(nextColor)}) saved`, 'success');
      await fetchData();
    } catch (err: any) {
      console.error('Failed to create revision:', err);
      toast(err.message || 'Failed to create revision', 'error');
    } finally {
      setCreating(false);
    }
  };

  // ------- Restore a revision -------

  const restoreRevision = async (rev: Revision) => {
    if (!rev.snapshot || rev.snapshot.length === 0) {
      toast('This revision has no snapshot data to restore', 'error');
      return;
    }
    if (!confirm(`Restore revision v${rev.version} (${getColorName(rev.revision_color)})? This will replace ALL current script elements. A snapshot of the current state will be saved first.`)) return;

    setRestoring(rev.id);
    const supabase = createClient();

    try {
      // Save current state first so nothing is lost
      await createRevision();

      const { error: delErr } = await supabase
        .from('script_elements')
        .delete()
        .eq('script_id', rev.script_id);
      if (delErr) throw delErr;

      const elementsToInsert = rev.snapshot.map(el => ({
        script_id: rev.script_id,
        element_type: el.element_type,
        content: el.content,
        sort_order: el.sort_order,
        scene_number: el.scene_number,
        revision_color: el.revision_color || 'white',
        is_revised: el.is_revised || false,
        is_omitted: el.is_omitted || false,
        metadata: el.metadata || {},
        created_by: user!.id,
      }));

      if (elementsToInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('script_elements')
          .insert(elementsToInsert);
        if (insErr) throw insErr;
      }

      await supabase.from('scripts')
        .update({ version: rev.version, revision_color: rev.revision_color })
        .eq('id', rev.script_id);

      toast(`Restored to revision v${rev.version}`, 'success');
      await fetchData();
    } catch (err: any) {
      console.error('Restore failed:', err);
      toast(err.message || 'Failed to restore revision', 'error');
    } finally {
      setRestoring(null);
    }
  };

  // ------- Save revision notes -------

  const saveNotes = async (revId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('revisions')
      .update({ notes: notesValue || null })
      .eq('id', revId);
    if (error) {
      toast('Failed to save notes', 'error');
    } else {
      setRevisions(prev => prev.map(r => r.id === revId ? { ...r, notes: notesValue || null } : r));
      toast('Notes saved', 'success');
    }
    setEditingNotes(null);
  };

  // ------- Compare diff -------

  const diffResult = useMemo(() => {
    if (!compareA || !compareB) return null;
    const revA = revisions.find(r => r.id === compareA);
    const revB = revisions.find(r => r.id === compareB);
    if (!revA?.snapshot || !revB?.snapshot) return null;
    const aLines = snapshotToLines(revA.snapshot);
    const bLines = snapshotToLines(revB.snapshot);
    const diff = diffLines(aLines, bLines);
    const added = diff.filter(d => d.type === 'added').length;
    const removed = diff.filter(d => d.type === 'removed').length;
    const same = diff.filter(d => d.type === 'same').length;
    return { diff, added, removed, same, revA, revB };
  }, [compareA, compareB, revisions]);

  // ------- Render: Pro gate -------

  if (!hasProAccess) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md p-8 text-center">
          <div className="text-4xl mb-4">🔄</div>
          <h2 className="text-xl font-bold text-white mb-2">Revisions & Comparisons</h2>
          <p className="text-sm text-surface-400 mb-6">Track every revision with industry-standard color coding. Compare any two drafts side by side.</p>
          <Button onClick={() => { window.location.href = '/pro'; }}>Upgrade to Pro</Button>
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Revisions</h1>
            <Badge variant="warning">⭐ Pro</Badge>
          </div>
          <p className="text-sm text-surface-400 mt-1">
            Track changes with industry-standard color-coded revisions
            {activeScript ? ` · Script v${activeScript.version}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={compareMode ? 'primary' : 'secondary'}
            onClick={() => { setCompareMode(!compareMode); setCompareA(null); setCompareB(null); setShowDiffModal(false); }}
          >
            {compareMode ? 'Exit Compare' : 'Compare Drafts'}
          </Button>
          <Button onClick={createRevision} loading={creating} disabled={!activeScript}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Revision
          </Button>
        </div>
      </div>

      {/* No active script */}
      {!activeScript && (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-white mb-2">No active script</h3>
          <p className="text-sm text-surface-400">Create a script first to start tracking revisions.</p>
        </Card>
      )}

      {/* Compare Mode Panel */}
      {compareMode && activeScript && (
        <Card className="p-4 border-brand-500/30">
          <p className="text-sm text-surface-300 mb-3">Select two revisions to compare:</p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-surface-500 mb-1 block">From (older)</label>
              <select
                value={compareA || ''}
                onChange={(e) => setCompareA(e.target.value || null)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              >
                <option value="">Select revision...</option>
                {revisions.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.id === compareB}>
                    v{r.version} — {getColorName(r.revision_color)} ({r.word_count.toLocaleString()} words)
                  </option>
                ))}
              </select>
            </div>
            <svg className="w-5 h-5 text-surface-500 shrink-0 mt-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <div className="flex-1">
              <label className="text-xs text-surface-500 mb-1 block">To (newer)</label>
              <select
                value={compareB || ''}
                onChange={(e) => setCompareB(e.target.value || null)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              >
                <option value="">Select revision...</option>
                {revisions.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.id === compareA}>
                    v{r.version} — {getColorName(r.revision_color)} ({r.word_count.toLocaleString()} words)
                  </option>
                ))}
              </select>
            </div>
            {compareA && compareB && (
              <Button className="mt-5 shrink-0" onClick={() => setShowDiffModal(true)}>
                Compare
              </Button>
            )}
          </div>

          {compareA && compareB && (() => {
            const a = revisions.find(r => r.id === compareA);
            const b = revisions.find(r => r.id === compareB);
            if (!a || !b) return null;
            return (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-surface-700 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorHex(a.revision_color) }} />
                    <p className="text-sm font-semibold text-white">v{a.version} — {getColorName(a.revision_color)}</p>
                  </div>
                  <p className="text-xs text-surface-400">{a.page_count} pages · {a.word_count.toLocaleString()} words</p>
                </div>
                <div className="rounded-lg border border-surface-700 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorHex(b.revision_color) }} />
                    <p className="text-sm font-semibold text-white">v{b.version} — {getColorName(b.revision_color)}</p>
                  </div>
                  <p className="text-xs text-surface-400">{b.page_count} pages · {b.word_count.toLocaleString()} words</p>
                </div>
                <div className="col-span-2 rounded-lg bg-surface-800/50 p-4">
                  <p className="text-sm text-surface-300">
                    <span className={`font-medium ${b.word_count >= a.word_count ? 'text-green-400' : 'text-red-400'}`}>
                      {b.word_count >= a.word_count ? '+' : ''}{b.word_count - a.word_count}
                    </span> net words ·{' '}
                    <span className="text-brand-400 font-medium">{Math.abs(b.page_count - a.page_count)}</span> page difference
                  </p>
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {/* Revision Timeline */}
      {activeScript && revisions.length > 0 && (
        <div className="space-y-3">
          {revisions.map((rev, idx) => {
            const colorHex = getColorHex(rev.revision_color);
            const isRestoring = restoring === rev.id;
            return (
              <Card key={rev.id} className="p-4 hover:border-surface-700 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-4 h-4 rounded-full border-2 shrink-0"
                      style={{ borderColor: colorHex, backgroundColor: colorHex + '30' }}
                    />
                    {idx < revisions.length - 1 && <div className="w-0.5 h-full bg-surface-800 mt-1" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-surface-400 bg-surface-800 px-2 py-0.5 rounded">v{rev.version}</span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: colorHex + '20', color: colorHex }}
                        >
                          {getColorName(rev.revision_color)}
                        </span>
                        {idx === 0 && <Badge variant="success">Latest</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-surface-500">{timeAgo(rev.created_at)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => restoreRevision(rev)}
                          loading={isRestoring}
                          disabled={idx === 0 || restoring !== null}
                        >
                          Restore
                        </Button>
                      </div>
                    </div>

                    {editingNotes === rev.id ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          autoFocus
                          className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                          placeholder="Add revision notes..."
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveNotes(rev.id); if (e.key === 'Escape') setEditingNotes(null); }}
                        />
                        <Button variant="ghost" size="sm" onClick={() => saveNotes(rev.id)}>Save</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingNotes(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <p
                        className="text-xs text-surface-400 mt-1 cursor-pointer hover:text-surface-300 transition-colors"
                        onClick={() => { setEditingNotes(rev.id); setNotesValue(rev.notes || ''); }}
                        title="Click to edit notes"
                      >
                        {rev.notes || <span className="italic text-surface-600">Click to add notes...</span>}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
                      <span>{rev.page_count} pages</span>
                      <span>{rev.word_count.toLocaleString()} words</span>
                      <span>{rev.snapshot?.length || 0} elements</span>
                      <span>by {rev.author_name}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {activeScript && revisions.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-4">🔄</div>
          <h3 className="text-lg font-semibold text-white mb-2">No revisions yet</h3>
          <p className="text-sm text-surface-400 mb-4">
            Save a revision snapshot to start tracking changes. Each revision captures the full script state.
          </p>
          <Button onClick={createRevision} loading={creating}>Save First Revision</Button>
        </Card>
      )}

      {/* Color Legend */}
      <Card className="p-4">
        <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Industry Revision Colors</h4>
        <div className="flex flex-wrap gap-3">
          {REVISION_COLORS.map((rc) => (
            <div key={rc.value} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border border-surface-600" style={{ backgroundColor: rc.hex }} />
              <span className="text-xs text-surface-400">{rc.name}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Diff Modal */}
      {showDiffModal && diffResult && (
        <Modal
          isOpen
          onClose={() => setShowDiffModal(false)}
          title={`Compare v${diffResult.revA.version} → v${diffResult.revB.version}`}
          size="xl"
        >
          <div className="space-y-4 p-1">
            <div className="flex items-center gap-4 text-xs px-2">
              <span className="text-green-400 font-medium">+{diffResult.added} added</span>
              <span className="text-red-400 font-medium">−{diffResult.removed} removed</span>
              <span className="text-surface-400">{diffResult.same} unchanged</span>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[65vh] overflow-auto">
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-surface-800 sticky top-0 bg-surface-950 z-10">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorHex(diffResult.revA.revision_color) }} />
                  <Badge variant="info">v{diffResult.revA.version}</Badge>
                  <span className="text-xs text-surface-400">{getColorName(diffResult.revA.revision_color)}</span>
                </div>
                <div className="space-y-0.5">
                  {diffResult.diff
                    .filter(d => d.type === 'same' || d.type === 'removed')
                    .map((d, i) => (
                    <p
                      key={i}
                      className={`px-2 py-0.5 rounded text-xs font-mono whitespace-pre-wrap ${
                        d.type === 'removed'
                          ? 'bg-red-500/10 text-red-300 border-l-2 border-red-500/50'
                          : 'text-surface-400'
                      }`}
                    >
                      {d.type === 'removed' ? '− ' : '  '}{d.text || '\u00A0'}
                    </p>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-surface-800 sticky top-0 bg-surface-950 z-10">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorHex(diffResult.revB.revision_color) }} />
                  <Badge variant="warning">v{diffResult.revB.version}</Badge>
                  <span className="text-xs text-surface-400">{getColorName(diffResult.revB.revision_color)}</span>
                </div>
                <div className="space-y-0.5">
                  {diffResult.diff
                    .filter(d => d.type === 'same' || d.type === 'added')
                    .map((d, i) => (
                    <p
                      key={i}
                      className={`px-2 py-0.5 rounded text-xs font-mono whitespace-pre-wrap ${
                        d.type === 'added'
                          ? 'bg-green-500/10 text-green-300 border-l-2 border-green-500/50'
                          : 'text-surface-400'
                      }`}
                    >
                      {d.type === 'added' ? '+ ' : '  '}{d.text || '\u00A0'}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
