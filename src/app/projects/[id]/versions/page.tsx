'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, LoadingSpinner, toast, ToastContainer } from '@/components/ui';
import type { ScriptVersion } from '@/lib/types';

// ============================================================
// Version History — Pro feature
// Full revision history with visual diff and restore
// ============================================================

export default function VersionHistoryPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { isPro, hasVersionHistory } = useProFeatures();
  const { currentProject } = useProjectStore();
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<ScriptVersion | null>(null);
  const [compareTarget, setCompareTarget] = useState<ScriptVersion | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  useEffect(() => { fetchData(); }, [params.id]);

  const fetchData = async () => {
    const supabase = createClient();
    const [versRes, scriptRes] = await Promise.all([
      supabase.from('script_versions')
        .select('*, user:profiles!user_id(full_name, avatar_url, email)')
        .eq('project_id', params.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('scripts')
        .select('id, title, content, updated_at')
        .eq('project_id', params.id)
        .order('created_at', { ascending: true }),
    ]);
    setVersions(versRes.data || []);
    setScripts(scriptRes.data || []);
    setLoading(false);
  };

  const createSnapshot = async () => {
    if (!user || scripts.length === 0) return;
    setSavingSnapshot(true);
    const supabase = createClient();
    const script = scripts[0];
    const content = Array.isArray(script.content) ? script.content : [];
    const wordCount = content.reduce((sum: number, el: any) => sum + (el.text?.split(/\s+/).length || 0), 0);
    const pageCount = Math.ceil(wordCount / 250);

    const nextVersion = (versions[0]?.version_number || 0) + 1;

    await supabase.from('script_versions').insert({
      script_id: script.id,
      project_id: params.id,
      user_id: user.id,
      version_number: nextVersion,
      title: `Revision ${nextVersion}`,
      content: script.content,
      word_count: wordCount,
      page_count: pageCount,
      change_summary: null,
      is_auto_save: false,
    });

    toast(`Snapshot saved as Revision ${nextVersion}`, 'success');
    await fetchData();
    setSavingSnapshot(false);
  };

  const restoreVersion = async (version: ScriptVersion) => {
    if (!confirm(`Restore Revision ${version.version_number}? This will overwrite the current script content. A snapshot of the current version will be saved first.`)) return;
    setRestoring(true);

    // First, save current as snapshot
    await createSnapshot();

    // Then restore the selected version
    const supabase = createClient();
    await supabase.from('scripts').update({
      content: version.content,
      updated_at: new Date().toISOString(),
    }).eq('id', version.script_id);

    toast(`Restored to Revision ${version.version_number}`, 'success');
    setRestoring(false);
    setSelectedVersion(null);
    fetchData();
  };

  // Simple text diff
  const computeDiff = useMemo(() => {
    if (!selectedVersion || !compareTarget) return null;
    const aLines = extractText(selectedVersion.content);
    const bLines = extractText(compareTarget.content);
    return { a: aLines, b: bLines };
  }, [selectedVersion, compareTarget]);

  if (!hasVersionHistory || !isPro) return null;

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-5xl">
      <ToastContainer />
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Version History</h1>
            <Badge variant="warning">⭐ Pro</Badge>
          </div>
          <p className="text-sm text-surface-400 mt-1">Every revision saved. Compare, review, and restore any version.</p>
        </div>
        <Button onClick={createSnapshot} loading={savingSnapshot}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
          Save Snapshot
        </Button>
      </div>

      {loading ? <LoadingSpinner className="py-32" /> : (
        <>
          {versions.length > 0 ? (
            <div className="space-y-2">
              {versions.map((v, idx) => {
                const vUser = v.user as any;
                const isSelected = selectedVersion?.id === v.id;
                const isCompare = compareTarget?.id === v.id;
                return (
                  <Card
                    key={v.id}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-brand-500' : isCompare ? 'ring-2 ring-amber-500' : 'hover:bg-surface-800/30'
                    }`}
                    onClick={() => {
                      if (selectedVersion && !compareTarget && selectedVersion.id !== v.id) {
                        setCompareTarget(v);
                        setShowCompare(true);
                      } else {
                        setSelectedVersion(v);
                        setCompareTarget(null);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                          v.is_auto_save ? 'bg-surface-800 text-surface-400' : 'bg-brand-500/20 text-brand-400'
                        }`}>
                          v{v.version_number}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-white">{v.title || `Revision ${v.version_number}`}</h3>
                            {v.is_auto_save && <Badge variant="default">Auto</Badge>}
                            {idx === 0 && <Badge variant="success">Latest</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-surface-500 mt-0.5">
                            <span>{vUser?.full_name || vUser?.email || 'Unknown'}</span>
                            <span>{new Date(v.created_at).toLocaleString()}</span>
                            <span>{v.word_count?.toLocaleString()} words</span>
                            <span>~{v.page_count} pages</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="text-[10px] text-brand-400 font-medium">Click another to compare →</span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); restoreVersion(v); }}
                          loading={restoring}
                          disabled={idx === 0}
                        >
                          Restore
                        </Button>
                      </div>
                    </div>
                    {v.change_summary && (
                      <p className="text-xs text-surface-400 mt-2 pl-[52px]">{v.change_summary}</p>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="text-lg font-semibold text-white mb-2">No versions yet</h3>
              <p className="text-sm text-surface-400 mb-4">
                Save a snapshot to start tracking your script revisions. Each snapshot preserves the full script content.
              </p>
              <Button onClick={createSnapshot} loading={savingSnapshot}>Save First Snapshot</Button>
            </Card>
          )}

          {/* Compare Modal */}
          {showCompare && selectedVersion && compareTarget && (
            <Modal isOpen onClose={() => { setShowCompare(false); setCompareTarget(null); }} title="Compare Versions" size="xl">
              <div className="grid grid-cols-2 gap-4 p-1 max-h-[70vh] overflow-auto">
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-surface-800">
                    <Badge variant="info">v{selectedVersion.version_number}</Badge>
                    <span className="text-xs text-surface-400">{new Date(selectedVersion.created_at).toLocaleString()}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {computeDiff?.a.map((line, i) => {
                      const inB = computeDiff.b.includes(line);
                      return (
                        <p key={i} className={`px-2 py-0.5 rounded text-xs font-mono ${!inB ? 'bg-red-500/10 text-red-300' : 'text-surface-400'}`}>
                          {line || '\u00A0'}
                        </p>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-surface-800">
                    <Badge variant="warning">v{compareTarget.version_number}</Badge>
                    <span className="text-xs text-surface-400">{new Date(compareTarget.created_at).toLocaleString()}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {computeDiff?.b.map((line, i) => {
                      const inA = computeDiff.a.includes(line);
                      return (
                        <p key={i} className={`px-2 py-0.5 rounded text-xs font-mono ${!inA ? 'bg-green-500/10 text-green-300' : 'text-surface-400'}`}>
                          {line || '\u00A0'}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}

// Helper: extract text lines from script content
function extractText(content: any): string[] {
  if (!content) return [];
  if (Array.isArray(content)) {
    return content.map((el: any) => {
      const prefix = el.type ? `[${el.type.toUpperCase()}] ` : '';
      return prefix + (el.text || '');
    });
  }
  if (typeof content === 'string') return content.split('\n');
  return [JSON.stringify(content)];
}
