'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { attachProfiles, fetchAllResult } from '@/lib/supabase/fetch-all';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Badge, Button, Card, Input, LoadingSpinner, Modal, toast, ToastContainer } from '@/components/ui';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { timeAgo } from '@/lib/utils';
import { diffLines, diffStats, snapshotToLines, type DiffLine, type SnapshotElement } from '@/lib/scripts/diff';
import { createScriptDraft, normalizeDraftCode, type ScriptDraft } from '@/lib/scripts/drafts';

// Printed Drafts — every print/export of a script gets a 5-character code and
// a frozen snapshot, so a paper copy can be matched to exactly what was on it
// and compared with the script as it is now.

type ScriptRow = { id: string; title: string };
type DraftRow = ScriptDraft & { author?: { full_name?: string | null; display_name?: string | null } | null };

const SOURCE_LABEL: Record<string, string> = { manual: 'Issued by hand', export: 'Export', print: 'Printed from editor' };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DraftsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scriptFilter, setScriptFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Current text of each script, for "changed since print"
  const [currentLines, setCurrentLines] = useState<Record<string, string[]>>({});

  const [showNew, setShowNew] = useState(false);
  const [newScript, setNewScript] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<ScriptDraft | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [scriptRes, draftRes] = await Promise.all([
      supabase.from('scripts').select('id, title').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('script_drafts').select('*').eq('project_id', projectId).order('printed_at', { ascending: false }),
    ]);
    if (draftRes.error) {
      toast(`Could not load drafts: ${draftRes.error.message}`, 'error');
    }
    const scr = (scriptRes.data || []) as ScriptRow[];
    setScripts(scr);
    setNewScript((prev) => prev || scr[0]?.id || '');
    const rows = await attachProfiles(supabase, (draftRes.data || []) as DraftRow[], 'created_by', 'author', 'id, full_name, display_name');
    setDrafts(rows);
    setLoading(false);

    // Load the current text of every script that has drafts
    const ids = Array.from(new Set(rows.map((d) => d.script_id).filter(Boolean))) as string[];
    const entries = await Promise.all(ids.map(async (id) => {
      const { data } = await fetchAllResult(() => supabase
        .from('script_elements')
        .select('element_type, content, sort_order, is_omitted')
        .eq('script_id', id)
        .order('sort_order'));
      return [id, snapshotToLines((data || []) as SnapshotElement[])] as const;
    }));
    setCurrentLines(Object.fromEntries(entries));
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ?code=ABCDE opens that draft (used by /lookup)
  useEffect(() => {
    const code = normalizeDraftCode(searchParams.get('code') || '');
    if (!code || drafts.length === 0) return;
    const hit = drafts.find((d) => d.code === code);
    if (hit) setOpenId(hit.id);
  }, [searchParams, drafts]);

  const snapshotLines = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const d of drafts) out[d.id] = snapshotToLines(d.snapshot || []);
    return out;
  }, [drafts]);

  const isUnchanged = (d: DraftRow): boolean | null => {
    if (!d.script_id) return null;
    const cur = currentLines[d.script_id];
    if (!cur) return null;
    const snap = snapshotLines[d.id];
    return cur.length === snap.length && cur.every((l, i) => l === snap[i]);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const code = normalizeDraftCode(search);
    return drafts.filter((d) => {
      if (scriptFilter !== 'all' && d.script_id !== scriptFilter) return false;
      if (!q) return true;
      if (code) return d.code === code;
      return d.code.toLowerCase().includes(q)
        || (d.recipient || '').toLowerCase().includes(q)
        || (d.notes || '').toLowerCase().includes(q)
        || d.script_title.toLowerCase().includes(q);
    });
  }, [drafts, scriptFilter, search]);

  const openDraft = drafts.find((d) => d.id === openId) || null;
  const isAdmin = !!user && (currentProject?.created_by === user.id
    || members.some((m) => m.user_id === user.id && (m.role === 'owner' || m.role === 'admin')));

  const handleCreate = async () => {
    if (!newScript) return;
    setCreating(true);
    try {
      const draft = await createScriptDraft(newScript, { source: 'manual', recipient: newRecipient, notes: newNotes });
      setJustCreated(draft);
      setNewRecipient('');
      setNewNotes('');
      await fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create draft', 'error');
    } finally {
      setCreating(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(
      () => toast(`Copied ${code}`, 'success'),
      () => toast('Could not copy', 'error'),
    );
  };

  const saveDetails = async (d: DraftRow, recipient: string, notes: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('script_drafts')
      .update({ recipient: recipient.trim() || null, notes: notes.trim() || null })
      .eq('id', d.id)
      .select('id');
    if (error || !data?.length) {
      toast(error?.message || 'You can’t edit this draft', 'error');
      return;
    }
    setDrafts((prev) => prev.map((x) => (x.id === d.id ? { ...x, recipient: recipient.trim() || null, notes: notes.trim() || null } : x)));
    toast('Saved', 'success');
  };

  const deleteDraft = async (d: DraftRow) => {
    const ok = await confirm({
      title: `Delete draft ${d.code}?`,
      message: 'The code will stop resolving and its snapshot is removed. Paper copies carrying this code can no longer be traced.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    const supabase = createClient();
    const { data, error } = await supabase.from('script_drafts').delete().eq('id', d.id).select('id');
    if (error || !data?.length) {
      toast(error?.message || 'Only whoever issued the draft or a project admin can delete it', 'error');
      return;
    }
    setOpenId(null);
    setDrafts((prev) => prev.filter((x) => x.id !== d.id));
    toast(`Deleted ${d.code}`, 'success');
  };

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-5xl">
      <ToastContainer />
      <ConfirmDialog />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Printed Drafts</h1>
          <p className="text-sm text-surface-400 mt-1 max-w-xl">
            Every print and export gets a 5-character code in the page footer and a snapshot of the script at that moment.
            Look up a code to see when it was printed, who had it, and what has changed since.
          </p>
        </div>
        <Button onClick={() => { setJustCreated(null); setShowNew(true); }} disabled={scripts.length === 0}>
          New draft code
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find by code, recipient or notes…"
            aria-label="Search drafts"
          />
        </div>
        {scripts.length > 1 && (
          <select
            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white sm:w-64"
            value={scriptFilter}
            onChange={(e) => setScriptFilter(e.target.value)}
            aria-label="Filter by script"
          >
            <option value="all">All scripts</option>
            {scripts.map((s) => <option key={s.id} value={s.id}>{s.title || 'Untitled'}</option>)}
          </select>
        )}
      </div>

      <p className="text-xs text-surface-500 mb-4">
        Public lookup is <span className={currentProject?.drafts_public_lookup ? 'text-emerald-400' : 'text-surface-300'}>
          {currentProject?.drafts_public_lookup ? 'on' : 'off'}
        </span>
        {currentProject?.drafts_public_lookup
          ? <> — anyone with a code can check it at <Link href="/lookup" className="text-brand-400 hover:underline">/lookup</Link> (date and title only).</>
          : <> — only project members can look codes up.</>}
        {' '}<Link href={`/projects/${projectId}/settings`} className="text-brand-400 hover:underline">Change in settings</Link>
      </p>

      {/* List */}
      {visible.length === 0 ? (
        <Card className="p-10 text-center">
          <h3 className="text-base font-semibold text-white mb-2">{drafts.length === 0 ? 'No drafts yet' : 'No drafts match'}</h3>
          <p className="text-sm text-surface-400">
            {drafts.length === 0
              ? 'Print or export a script and it will show up here — or issue a code by hand.'
              : 'Try another code or clear the filter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((d) => {
            const unchanged = isUnchanged(d);
            return (
              <Card key={d.id} hover className="p-4" onClick={() => setOpenId(d.id)}>
                <div className="flex items-start gap-4">
                  <span className="font-mono text-base font-semibold text-white tracking-[0.12em] bg-surface-800 px-2.5 py-1 rounded shrink-0">{d.code}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white truncate">{d.script_title || 'Untitled'}</span>
                      {unchanged === true && <Badge variant="success">Matches current</Badge>}
                      {unchanged === false && <Badge variant="warning">Changed since</Badge>}
                      {!d.script_id && <Badge variant="default">Script deleted</Badge>}
                    </div>
                    <div className="flex items-center gap-x-4 gap-y-1 mt-1 text-xs text-surface-500 flex-wrap">
                      <span title={formatDateTime(d.printed_at)}>{timeAgo(d.printed_at)}</span>
                      <span>{SOURCE_LABEL[d.source] || d.source}{d.format ? ` · ${d.format.toUpperCase()}` : ''}</span>
                      {d.recipient && <span className="text-surface-300">→ {d.recipient}</span>}
                      {d.author && <span>by {d.author.display_name || d.author.full_name || 'Unknown'}</span>}
                    </div>
                    {d.notes && <p className="text-xs text-surface-400 mt-1 truncate">{d.notes}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New draft */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title={justCreated ? 'Draft code issued' : 'New draft code'} size="md">
        {justCreated ? (
          <div className="text-center py-2">
            <p className="text-sm text-surface-400 mb-3">Write this on the copy, or quote it when sending the file:</p>
            <button
              onClick={() => copyCode(justCreated.code)}
              className="font-mono text-4xl font-bold text-white tracking-[0.2em] bg-surface-800 hover:bg-surface-700 rounded-xl px-6 py-4 transition-colors"
              title="Copy"
            >
              {justCreated.code}
            </button>
            <p className="text-xs text-surface-500 mt-3">
              {justCreated.script_title} · {formatDateTime(justCreated.printed_at)} · click to copy
            </p>
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="ghost" onClick={() => setJustCreated(null)}>Issue another</Button>
              <Button onClick={() => setShowNew(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-surface-400">
              Snapshots the script as it is saved now. Prints and exports do this automatically — use this for copies made some other way.
            </p>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">Script</label>
              <select
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white"
                value={newScript}
                onChange={(e) => setNewScript(e.target.value)}
              >
                {scripts.map((s) => <option key={s.id} value={s.id}>{s.title || 'Untitled'}</option>)}
              </select>
            </div>
            <Input label="Given to (optional)" value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)} placeholder="e.g. Jamie (producer)" />
            <Input label="Notes (optional)" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="e.g. Hand-delivered at table read" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={handleCreate} loading={creating} disabled={!newScript}>Issue code</Button>
            </div>
          </div>
        )}
      </Modal>

      {openDraft && (
        <DraftDetail
          draft={openDraft}
          snapshotLines={snapshotLines[openDraft.id] || []}
          currentLines={openDraft.script_id ? currentLines[openDraft.script_id] : undefined}
          canDelete={isAdmin || openDraft.created_by === user?.id}
          onClose={() => setOpenId(null)}
          onSave={saveDetails}
          onDelete={deleteDraft}
          onCopy={copyCode}
        />
      )}
    </div>
  );
}

function DraftDetail({
  draft, snapshotLines, currentLines, canDelete, onClose, onSave, onDelete, onCopy,
}: {
  draft: DraftRow;
  snapshotLines: string[];
  currentLines: string[] | undefined;
  canDelete: boolean;
  onClose: () => void;
  onSave: (d: DraftRow, recipient: string, notes: string) => Promise<void>;
  onDelete: (d: DraftRow) => void;
  onCopy: (code: string) => void;
}) {
  const [tab, setTab] = useState<'changes' | 'snapshot'>('changes');
  const [recipient, setRecipient] = useState(draft.recipient || '');
  const [notes, setNotes] = useState(draft.notes || '');
  const [saving, setSaving] = useState(false);
  const [onlyChanges, setOnlyChanges] = useState(true);

  const diff: DiffLine[] | null = useMemo(
    () => (currentLines ? diffLines(snapshotLines, currentLines) : null),
    [snapshotLines, currentLines],
  );
  const stats = diff ? diffStats(diff) : null;
  const dirty = recipient !== (draft.recipient || '') || notes !== (draft.notes || '');

  // With "only changes", show changed lines plus one line of context either side.
  const shown = useMemo(() => {
    if (!diff) return [];
    if (!onlyChanges) return diff.map((d) => ({ ...d, gap: false }));
    const keep = new Set<number>();
    diff.forEach((d, i) => { if (d.type !== 'same') { keep.add(i - 1); keep.add(i); keep.add(i + 1); } });
    const out: (DiffLine & { gap: boolean })[] = [];
    let last = -2;
    diff.forEach((d, i) => {
      if (!keep.has(i)) return;
      out.push({ ...d, gap: last >= 0 && i !== last + 1 });
      last = i;
    });
    return out;
  }, [diff, onlyChanges]);

  return (
    <Modal isOpen onClose={onClose} title={`Draft ${draft.code}`} size="xl">
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <span className="text-surface-500">Code</span>
          <button onClick={() => onCopy(draft.code)} className="font-mono text-white tracking-[0.12em] text-left hover:text-brand-400" title="Copy">{draft.code}</button>
          <span className="text-surface-500">Script</span>
          <span className="text-white">{draft.script_title || 'Untitled'}{!draft.script_id && <span className="text-surface-500"> (since deleted)</span>}</span>
          <span className="text-surface-500">Printed</span>
          <span className="text-white">{formatDateTime(draft.printed_at)}</span>
          <span className="text-surface-500">How</span>
          <span className="text-white">{SOURCE_LABEL[draft.source] || draft.source}{draft.format ? ` · ${draft.format.toUpperCase()}` : ''}{draft.author ? ` · by ${draft.author.display_name || draft.author.full_name}` : ''}</span>
          <span className="text-surface-500">Size then</span>
          <span className="text-white">{draft.element_count.toLocaleString()} elements · {draft.word_count.toLocaleString()} words</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Given to" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Nobody recorded" />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="—" />
        </div>
        <div className="flex justify-between gap-2">
          {canDelete ? <Button variant="ghost" onClick={() => onDelete(draft)}>Delete draft</Button> : <span />}
          <Button
            size="sm"
            disabled={!dirty}
            loading={saving}
            onClick={async () => { setSaving(true); await onSave(draft, recipient, notes); setSaving(false); }}
          >
            Save details
          </Button>
        </div>

        <div className="border-t border-surface-800 pt-4">
          <div className="flex items-center gap-1 mb-3">
            {(['changes', 'snapshot'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-surface-800 text-white' : 'text-surface-400 hover:text-white'}`}
              >
                {t === 'changes' ? 'Changes since print' : 'Script as printed'}
              </button>
            ))}
            {tab === 'changes' && diff && (
              <label className="ml-auto flex items-center gap-2 text-xs text-surface-400">
                <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} className="rounded bg-surface-800 border-surface-600" />
                Only changed lines
              </label>
            )}
          </div>

          {tab === 'changes' ? (
            !draft.script_id ? (
              <p className="text-sm text-surface-400">The script has been deleted, so there’s nothing to compare with. The snapshot is still here.</p>
            ) : !diff ? (
              <LoadingSpinner className="py-10" />
            ) : stats && stats.added === 0 && stats.removed === 0 ? (
              <p className="text-sm text-emerald-400">No changes — the script still matches this printed draft.</p>
            ) : (
              <>
                <div className="flex items-center gap-4 text-xs mb-2">
                  <span className="text-green-400 font-medium">+{stats!.added} added</span>
                  <span className="text-red-400 font-medium">−{stats!.removed} removed</span>
                  <span className="text-surface-500">compared with the script now</span>
                </div>
                <div className="max-h-[50vh] overflow-auto space-y-0.5 rounded-lg bg-surface-950/50 p-2">
                  {shown.map((d, i) => (
                    <div key={i}>
                      {d.gap && <p className="text-[11px] text-surface-600 px-2 py-1">⋯</p>}
                      <p
                        className={`px-2 py-0.5 rounded text-xs font-mono whitespace-pre-wrap ${
                          d.type === 'added' ? 'bg-green-500/10 text-green-300 border-l-2 border-green-500/50'
                            : d.type === 'removed' ? 'bg-red-500/10 text-red-300 border-l-2 border-red-500/50 line-through decoration-red-500/40'
                              : 'text-surface-500'
                        }`}
                      >
                        {d.type === 'added' ? '+ ' : d.type === 'removed' ? '− ' : '  '}{d.text || ' '}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )
          ) : (
            <div className="max-h-[50vh] overflow-auto space-y-0.5 rounded-lg bg-surface-950/50 p-2">
              {snapshotLines.length === 0
                ? <p className="text-sm text-surface-400 p-2">The script was empty when this draft was issued.</p>
                : snapshotLines.map((l, i) => (
                  <p key={i} className="px-2 py-0.5 text-xs font-mono whitespace-pre-wrap text-surface-300">{l || ' '}</p>
                ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
