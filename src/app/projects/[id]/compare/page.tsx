'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useScriptStore, useProjectStore } from '@/lib/stores';
import { Card, Select, LoadingSpinner, Badge, EmptyState } from '@/components/ui';
import Link from 'next/link';
import type { ScriptElement } from '@/lib/types';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

type DiffTag = 'equal' | 'added' | 'removed';

interface DiffWord {
  text: string;
  tag: DiffTag;
}

function computeWordDiff(oldWords: string[], newWords: string[]): DiffWord[] {
  if (oldWords.length === 0 && newWords.length === 0) return [];
  if (oldWords.length === 0) return newWords.map(w => ({ text: w, tag: 'added' as DiffTag }));
  if (newWords.length === 0) return oldWords.map(w => ({ text: w, tag: 'removed' as DiffTag }));

  const dp = lcs(oldWords, newWords);
  const result: DiffWord[] = [];
  let i = oldWords.length;
  let j = newWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1].toLowerCase() === newWords[j - 1].toLowerCase()) {
      result.unshift({ text: oldWords[i - 1], tag: 'equal' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ text: newWords[j - 1], tag: 'added' });
      j--;
    } else {
      result.unshift({ text: oldWords[i - 1], tag: 'removed' });
      i--;
    }
  }

  return result;
}

interface ElementDiff {
  elementType: string;
  sortOrder: number;
  oldContent: string;
  newContent: string;
  diff: DiffWord[];
  stats: { added: number; removed: number; modified: number };
}

function computeElementDiff(oldEl: ScriptElement | undefined, newEl: ScriptElement | undefined): ElementDiff | null {
  const oldText = oldEl ? stripHtml(oldEl.content) : '';
  const newText = newEl ? stripHtml(newEl.content) : '';

  if (oldText === newText) return null;

  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);
  const diff = computeWordDiff(oldWords, newWords);

  let added = 0;
  let removed = 0;
  let modified = 0;

  const oldOnly = diff.filter(d => d.tag === 'removed').length;
  const newOnly = diff.filter(d => d.tag === 'added').length;

  if (oldWords.length > 0 && newWords.length > 0) {
    const minLen = Math.min(oldOnly, newOnly);
    modified = minLen;
    added = newOnly - minLen;
    removed = oldOnly - minLen;
  } else {
    added = newOnly;
    removed = oldOnly;
  }

  return {
    elementType: newEl?.element_type || oldEl?.element_type || 'unknown',
    sortOrder: newEl?.sort_order ?? oldEl?.sort_order ?? 0,
    oldContent: oldText,
    newContent: newText,
    diff,
    stats: { added, removed, modified },
  };
}

export default function ComparePage({ params }: { params: { id: string } }) {
  const { loading: authLoading } = useAuth();
  const { currentProject, fetchProject } = useProjectStore();
  const { scripts, fetchScripts } = useScriptStore();

  const [leftScriptId, setLeftScriptId] = useState<string>('current');
  const [rightScriptId, setRightScriptId] = useState<string>('');
  const [leftElements, setLeftElements] = useState<ScriptElement[]>([]);
  const [rightElements, setRightElements] = useState<ScriptElement[]>([]);
  const [loadingElements, setLoadingElements] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchProject(params.id);
      fetchScripts(params.id);
    }
  }, [params.id, fetchProject, fetchScripts]);

  const activeScript = useMemo(() => scripts.find(s => s.is_active) || scripts[0] || null, [scripts]);

  useEffect(() => {
    if (scripts.length >= 2 && !rightScriptId) {
      const nonActive = scripts.filter(s => !s.is_active);
      setRightScriptId(nonActive[0]?.id || scripts[1]?.id || '');
    }
  }, [scripts, rightScriptId]);

  const loadElements = useCallback(async (scriptId: string): Promise<ScriptElement[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from('script_elements')
      .select('*')
      .eq('script_id', scriptId)
      .order('sort_order', { ascending: true });
    return (data || []) as ScriptElement[];
  }, []);

  useEffect(() => {
    if (!leftScriptId && !rightScriptId) return;
    if (!activeScript) return;

    const leftId = leftScriptId === 'current' ? activeScript.id : leftScriptId;
    if (!leftId || !rightScriptId) return;

    setLoadingElements(true);
    Promise.all([loadElements(leftId), loadElements(rightScriptId)])
      .then(([left, right]) => {
        setLeftElements(left);
        setRightElements(right);
      })
      .finally(() => setLoadingElements(false));
  }, [leftScriptId, rightScriptId, activeScript, loadElements]);

  const diffs = useMemo(() => {
    const leftMap = new Map(leftElements.map(e => [`${e.element_type}_${e.sort_order}`, e]));
    const rightMap = new Map(rightElements.map(e => [`${e.element_type}_${e.sort_order}`, e]));
    const allKeys = new Set<string>([...Array.from(leftMap.keys()), ...Array.from(rightMap.keys())]);

    const result: ElementDiff[] = [];
    let totalAdded = 0;
    let totalRemoved = 0;
    let totalModified = 0;

    for (const key of allKeys) {
      const diff = computeElementDiff(leftMap.get(key), rightMap.get(key));
      if (diff) {
        result.push(diff);
        totalAdded += diff.stats.added;
        totalRemoved += diff.stats.removed;
        totalModified += diff.stats.modified;
      }
    }

    return { elements: result, stats: { added: totalAdded, removed: totalRemoved, modified: totalModified } };
  }, [leftElements, rightElements]);

  const leftScript = leftScriptId === 'current' ? activeScript : scripts.find(s => s.id === leftScriptId);
  const rightScript = scripts.find(s => s.id === rightScriptId);

  const leftOptions = [
    { value: 'current', label: `Current (v${activeScript?.version || '?'})` },
    ...scripts.filter(s => s.id !== activeScript?.id).map(s => ({
      value: s.id,
      label: `Version ${s.version}${s.is_active ? ' (active)' : ''}`,
    })),
  ];

  const rightOptions = scripts
    .filter(s => s.id !== (leftScriptId === 'current' ? activeScript?.id : leftScriptId))
    .map(s => ({
      value: s.id,
      label: `Version ${s.version}${s.is_active ? ' (active)' : ''}`,
    }));

  if (authLoading) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <LoadingSpinner className="py-20" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <Link href={`/projects/${params.id}/script`} className="text-sm text-surface-400 hover:text-[#FF5F1F] transition-colors inline-flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Script
          </Link>
          <h1 className="text-2xl font-black text-white">Compare Versions</h1>
          <p className="text-sm text-surface-400 mt-1">
            {currentProject?.title || 'Project'} &bull; Side-by-side diff
          </p>
        </div>
      </div>

      <Card className="p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Left (Older)"
            value={leftScriptId}
            onChange={(e) => setLeftScriptId(e.target.value)}
            options={leftOptions}
          />
          <Select
            label="Right (Newer)"
            value={rightScriptId}
            onChange={(e) => setRightScriptId(e.target.value)}
            options={rightOptions.length > 0 ? rightOptions : [{ value: '', label: 'No versions available' }]}
          />
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <p className="text-2xl font-black text-green-400">{diffs.stats.added}</p>
          <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mt-1">Words Added</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-black text-red-400">{diffs.stats.removed}</p>
          <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mt-1">Words Removed</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-black text-yellow-400">{diffs.stats.modified}</p>
          <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mt-1">Words Modified</p>
        </Card>
      </div>

      {loadingElements ? (
        <LoadingSpinner className="py-20" />
      ) : diffs.elements.length === 0 ? (
        <EmptyState
          title="No differences found"
          description={leftScriptId && rightScriptId ? 'The selected versions are identical.' : 'Select two different versions to compare.'}
        />
      ) : (
        <div className="space-y-4">
          {diffs.elements.map((d, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800/60">
                <Badge size="sm" variant="info">{d.elementType.replace(/_/g, ' ')}</Badge>
                {d.stats.added > 0 && <Badge size="sm" variant="success">+{d.stats.added}</Badge>}
                {d.stats.removed > 0 && <Badge size="sm" variant="error">-{d.stats.removed}</Badge>}
                {d.stats.modified > 0 && <Badge size="sm" variant="warning">~{d.stats.modified}</Badge>}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-surface-800/60">
                <div className="p-4">
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">
                    {leftScript ? `v${leftScript.version}` : 'Left'}
                  </p>
                  <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-wrap">
                    {d.diff.filter(w => w.tag !== 'added').map((w, wi) => {
                      if (w.tag === 'removed') {
                        return <span key={wi} className="bg-red-500/20 text-red-300 rounded px-0.5">{w.text} </span>;
                      }
                      return <span key={wi}>{w.text} </span>;
                    })}
                    {d.diff.every(w => w.tag === 'added') && (
                      <span className="text-surface-600 italic">No content</span>
                    )}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">
                    {rightScript ? `v${rightScript.version}` : 'Right'}
                  </p>
                  <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-wrap">
                    {d.diff.filter(w => w.tag !== 'removed').map((w, wi) => {
                      if (w.tag === 'added') {
                        return <span key={wi} className="bg-green-500/20 text-green-300 rounded px-0.5">{w.text} </span>;
                      }
                      return <span key={wi}>{w.text} </span>;
                    })}
                    {d.diff.every(w => w.tag === 'removed') && (
                      <span className="text-surface-600 italic">No content</span>
                    )}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
