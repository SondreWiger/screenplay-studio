'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, MessageSquare, Radar, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fillEmails } from '@/lib/private-profile';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import {
  ActionButton, AdminPage, AnimatedItem, BarList, Dialog, Dots, EmptyState, Field, PageHeader, Panel, Pill, Reveal,
  SearchInput, Segmented, Shimmer, StatGrid, TabSkeleton, Toolbar, TrendPanel, fieldClass, tally, SERIES, type Tone,
} from '@/components/admin/kit';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
const isFullAdmin = (id?: string, role?: string) => id === ADMIN_UID || role === 'admin';

type SubTab = 'flags' | 'all-projects' | 'evidence';

const SEVERITY_TONE: Record<string, Tone> = { critical: 'red', high: 'brand', medium: 'amber', low: 'neutral' };
const STATUS_TONE: Record<string, Tone> = { pending: 'amber', reviewing: 'blue', confirmed: 'red', false_positive: 'green', actioned: 'violet' };
const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
type FlagView = 'pending' | 'reviewed' | 'all';

const CONTENT_TYPE_LABELS: Record<string, string> = {
  script_element: 'Script',
  idea: 'Idea',
  document: 'Document',
  scene: 'Scene',
  character: 'Character',
  channel_message: 'Project Chat',
  direct_message: 'Direct Message',
  project: 'Project',
  comment: 'Comment',
};

interface ContentFlag {
  id: string;
  content_type: string;
  content_id: string;
  project_id: string | null;
  flagged_user_id: string;
  flag_reason: string;
  matched_terms: string[];
  content_snippet: string;
  severity: string;
  status: string;
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  action_taken: string | null;
  detected_at: string;
  flagged_user?: {
    email: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    username: string | null;
  };
}

interface Evidence {
  id: string;
  flag_id: string;
  content_type: string;
  content_id: string;
  full_content: string;
  content_metadata: Record<string, unknown>;
  author_id: string;
  author_email: string | null;
  author_name: string | null;
  captured_by: string;
  captured_at: string;
  content_hash: string;
}

export default function ModerationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTab>('flags');
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allProjects, setAllProjects] = useState<any[] | null>(null);
  const [flagView, setFlagView] = useState<FlagView>('pending');
  const [severity, setSeverity] = useState<string>('all');
  const [flagSearch, setFlagSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scanResults, setScanResults] = useState<any>(null);
  const [projectSearch, setProjectSearch] = useState('');

  // Action modals
  const [dmModal, setDmModal] = useState<{ userId: string; userName: string } | null>(null);
  const [dmMessage, setDmMessage] = useState('');
  const [actionModal, setActionModal] = useState<{ flag: ContentFlag; action: string } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionDays, setActionDays] = useState(30);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isFullAdmin(user.id, user.role)) {
      router.replace('/dashboard');
      return;
    }
    loadFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const getAuthHeaders = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    };
  }, []);

  const loadFlags = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/moderation/scan', { headers });
      const data = await res.json();
      setFlags(data.flags || []);
    } catch (err) {
      console.error('Error loading flags:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEvidence = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('moderation_evidence')
        .select('*')
        .order('captured_at', { ascending: false })
        .limit(200);
      setEvidence(data || []);
    } catch (err) {
      console.error('Error loading evidence:', err);
    }
  };

  const loadAllProjects = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('projects')
        .select('id, title, logline, status, format, created_by, created_at, updated_at, poster_url, project_members(count), scripts(count), owner:profiles!created_by(id, email, full_name, display_name, avatar_url, username, moderation_status, moderation_flags)')
        .order('updated_at', { ascending: false });
      await fillEmails(supabase, (data || []).map((p: { owner?: { id?: string; email?: string | null } | null }) => p.owner));
      setAllProjects(data || []);
    } catch (err) {
      console.error('Error loading all projects:', err);
      setAllProjects([]);
    }
  };

  const runScan = async () => {
    setScanning(true);
    setScanResults(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/moderation/scan', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      setScanResults(data);
      toast.success(`Scan complete: ${data.new_flags} new flags found`);
      await loadFlags();
    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleAction = async (action: string, params: Record<string, unknown>) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/moderation/actions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...params }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success('Action completed');
        await loadFlags();
      }
    } catch {
      toast.error('Action failed');
    }
  };

  const handleDmUser = async () => {
    if (!dmModal || !dmMessage.trim()) return;
    await handleAction('dm_user', {
      user_id: dmModal.userId,
      message: dmMessage.trim(),
    });
    setDmModal(null);
    setDmMessage('');
  };

  const handleModAction = async () => {
    if (!actionModal || !actionNotes.trim()) return;
    const { flag, action } = actionModal;

    if (action === 'warn') {
      await handleAction('warn_user', {
        user_id: flag.flagged_user_id,
        reason: actionNotes.trim(),
        flag_id: flag.id,
      });
    } else if (action === 'suspend') {
      await handleAction('suspend_user', {
        user_id: flag.flagged_user_id,
        reason: actionNotes.trim(),
        duration_days: actionDays,
        flag_id: flag.id,
      });
    } else if (action === 'ban') {
      await handleAction('ban_user', {
        user_id: flag.flagged_user_id,
        reason: actionNotes.trim(),
        flag_id: flag.id,
      });
    } else if (action === 'delete') {
      await handleAction('delete_content', {
        flag_id: flag.id,
        content_type: flag.content_type,
        content_id: flag.content_id,
      });
    } else if (action === 'dismiss') {
      await handleAction('update_flag', {
        flag_id: flag.id,
        status: 'false_positive',
        review_notes: actionNotes.trim(),
      });
    }

    setActionModal(null);
    setActionNotes('');
  };

  const visibleFlags = useMemo(() => {
    const q = flagSearch.trim().toLowerCase();
    return flags
      .filter(f => flagView === 'all' || (flagView === 'pending' ? f.status === 'pending' || f.status === 'reviewing' : f.status !== 'pending' && f.status !== 'reviewing'))
      .filter(f => severity === 'all' || f.severity === severity)
      .filter(f => !q || `${f.content_snippet} ${f.matched_terms.join(' ')} ${f.flagged_user?.email || ''} ${f.flagged_user?.display_name || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) || b.detected_at.localeCompare(a.detected_at));
  }, [flags, flagView, severity, flagSearch]);

  if (authLoading || loading) return <TabSkeleton />;
  if (!user || !isFullAdmin(user.id, user.role)) return null;

  const pendingFlags = flags.filter(f => f.status === 'pending');
  const criticalFlags = pendingFlags.filter(f => f.severity === 'critical');
  const byStatus = (st: string) => flags.filter(f => f.status === st).length;
  const repeatOffenders = tally(flags, f => f.flagged_user?.display_name || f.flagged_user?.email || f.flagged_user_id.slice(0, 8)).filter(x => x.count > 1);

  const filteredProjects = (allProjects || []).filter(p =>
    !projectSearch || (p.title + ' ' + (p.owner?.email || '') + ' ' + (p.owner?.full_name || '')).toLowerCase().includes(projectSearch.toLowerCase())
  );

  const switchTab = (t: SubTab) => {
    setSubTab(t);
    if (t === 'evidence' && evidence.length === 0) loadEvidence();
    if (t === 'all-projects' && allProjects === null) loadAllProjects();
  };

  const actionTitle: Record<string, string> = {
    warn: 'Warn user', suspend: 'Suspend user', ban: 'Ban user permanently', delete: 'Delete flagged content', dismiss: 'Dismiss as false positive',
  };
  const actionCta: Record<string, string> = {
    warn: 'Send warning', suspend: `Suspend for ${actionDays} days`, ban: 'Permanently ban', delete: 'Delete content', dismiss: 'Mark as false positive',
  };

  return (
    <AdminPage>
      <PageHeader
        icon={<ShieldAlert className="h-5 w-5" />}
        title="Content Moderation"
        description="Child safety, content scanning and evidence preservation."
        actions={
          <>
            <AnimatePresence>
              {criticalFlags.length > 0 && (
                <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
                  <Pill tone="red" dot className="animate-pulse">{criticalFlags.length} critical</Pill>
                </motion.span>
              )}
            </AnimatePresence>
            <ActionButton variant="primary" icon={<Radar className={cn('h-4 w-4', scanning && 'animate-spin')} />} onClick={runScan} disabled={scanning}>
              {scanning ? <>Scanning <Dots /></> : 'Scan platform'}
            </ActionButton>
          </>
        }
      />

      <AnimatePresence>
        {scanResults && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border px-4 py-3 text-sm', (scanResults.new_flags || 0) > 0 ? 'border-red-500/30 bg-red-500/[0.06]' : 'border-emerald-500/30 bg-emerald-500/[0.06]')}>
              <span className={cn('font-bold', (scanResults.new_flags || 0) > 0 ? 'text-red-300' : 'text-emerald-300')}>
                {scanResults.new_flags || 0} new flag{scanResults.new_flags === 1 ? '' : 's'}
              </span>
              {Object.entries(scanResults.scanned || {}).map(([key, val]) => (
                <span key={key} className="text-surface-400"><span className="text-surface-500">{key.replace(/_/g, ' ')}:</span> <span className="font-semibold text-surface-200">{String(val)}</span></span>
              ))}
              <button onClick={() => setScanResults(null)} className="ml-auto rounded p-1 text-surface-500 hover:text-white" aria-label="Dismiss"><X className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <StatGrid
        cols={5}
        layoutGroup="moderation"
        items={[
          { label: 'Pending review', value: pendingFlags.length, tone: 'amber', onClick: () => { switchTab('flags'); setFlagView('pending'); setSeverity('all'); }, active: subTab === 'flags' && flagView === 'pending' && severity === 'all' },
          { label: 'Critical pending', value: criticalFlags.length, tone: 'red', onClick: () => { switchTab('flags'); setFlagView('pending'); setSeverity('critical'); }, active: subTab === 'flags' && severity === 'critical' },
          { label: 'Actioned', value: byStatus('actioned') + byStatus('confirmed'), tone: 'violet', onClick: () => { switchTab('flags'); setFlagView('reviewed'); setSeverity('all'); }, active: subTab === 'flags' && flagView === 'reviewed' },
          { label: 'False positives', value: byStatus('false_positive'), tone: 'green', hint: `${flags.length ? Math.round((byStatus('false_positive') / flags.length) * 100) : 0}% of all flags` },
          { label: 'Evidence items', value: evidence.length, tone: 'blue', hint: 'Loaded when you open the vault', onClick: () => switchTab('evidence'), active: subTab === 'evidence' },
        ]}
      />

      {flags.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-5">
          <TrendPanel
            id="mod-flags"
            stacked
            className="lg:col-span-3"
            title="Flags detected"
            subtitle="Automated scan hits over time, by severity"
            sources={[
              { key: 'critical', label: 'Critical', color: SERIES.red, rows: flags.filter(f => f.severity === 'critical'), time: f => f.detected_at },
              { key: 'high', label: 'High', color: SERIES.orange, rows: flags.filter(f => f.severity === 'high'), time: f => f.detected_at },
              { key: 'other', label: 'Medium / low', color: SERIES.yellow, rows: flags.filter(f => f.severity !== 'critical' && f.severity !== 'high'), time: f => f.detected_at },
            ]}
          />
          <Panel title="What gets flagged" subtitle="By content type" className="lg:col-span-2">
            <BarList items={tally(flags, f => CONTENT_TYPE_LABELS[f.content_type] || f.content_type)} color={SERIES.red} limit={5} labelFormat={l => <span className="normal-case">{l}</span>} />
            {repeatOffenders.length > 0 && (
              <div className="mt-4 border-t border-surface-800 pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">Repeat flags</p>
                <div className="flex flex-wrap gap-1.5">
                  {repeatOffenders.slice(0, 8).map(r => <Pill key={r.label} tone="red">{r.label} <span className="text-white">×{r.count}</span></Pill>)}
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}

      <Reveal>
        <Segmented
          id="mod-subtab"
          value={subTab}
          onChange={switchTab}
          options={[
            { key: 'flags', label: <>Content flags {pendingFlags.length > 0 && <span className="ml-1 rounded bg-red-500/20 px-1 text-red-300">{pendingFlags.length}</span>}</> },
            { key: 'all-projects', label: 'All projects' },
            { key: 'evidence', label: 'Evidence vault' },
          ]}
        />
      </Reveal>

      <AnimatePresence mode="wait">
        <motion.div key={subTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="space-y-4">
          {subTab === 'flags' && (
            <>
              <Toolbar>
                <SearchInput value={flagSearch} onChange={setFlagSearch} placeholder="Search snippet, matched term or user…" />
                <Segmented id="mod-flagview" size="sm" value={flagView} onChange={setFlagView} options={[{ key: 'pending', label: 'Needs review' }, { key: 'reviewed', label: 'Reviewed' }, { key: 'all', label: 'All' }]} />
                <select value={severity} onChange={e => setSeverity(e.target.value)} className={cn(fieldClass, 'w-auto py-2')} aria-label="Severity">
                  <option value="all">All severities</option>
                  {['critical', 'high', 'medium', 'low'].map(sv => <option key={sv} value={sv}>{sv}</option>)}
                </select>
              </Toolbar>
              {visibleFlags.length === 0 ? (
                <EmptyState
                  icon={<ShieldCheck className="h-10 w-10 text-emerald-500/60" />}
                  title={flags.length === 0 ? 'No flags detected' : 'Nothing in this view'}
                  description={flags.length === 0 ? 'Run “Scan platform” to check content.' : 'All clear for these filters.'}
                />
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {visibleFlags.map(flag => (
                      <AnimatedItem
                        key={flag.id}
                        className={cn('rounded-2xl border p-4', flag.severity === 'critical' && flag.status === 'pending' ? 'border-red-500/40 bg-red-500/[0.05]' : 'border-surface-800 bg-surface-900/60')}
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Pill tone={SEVERITY_TONE[flag.severity] ?? 'neutral'} dot>{flag.severity}</Pill>
                          <Pill tone={STATUS_TONE[flag.status] ?? 'neutral'}>{flag.status.replace(/_/g, ' ')}</Pill>
                          <Pill>{CONTENT_TYPE_LABELS[flag.content_type] || flag.content_type}</Pill>
                          <span className="text-xs text-surface-500">{timeAgo(flag.detected_at)}</span>
                          <span className="ml-auto font-mono text-[11px] text-surface-500">{flag.id.slice(0, 8)}</span>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-1">
                          {flag.matched_terms.map((term, i) => (
                            <span key={i} className="rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-300">{term}</span>
                          ))}
                        </div>
                        <p className="mb-3 whitespace-pre-wrap break-words rounded-xl border border-surface-800 bg-surface-950 p-3 font-mono text-sm text-surface-300">{flag.content_snippet}</p>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            {flag.flagged_user && (
                              <>
                                <Avatar src={flag.flagged_user.avatar_url || undefined} name={flag.flagged_user.display_name || flag.flagged_user.email} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">{flag.flagged_user.display_name || flag.flagged_user.full_name || 'Unknown'}</p>
                                  <p className="truncate text-xs text-surface-500">{flag.flagged_user.email}</p>
                                </div>
                                {flag.flagged_user.username && <Link href={`/u/${flag.flagged_user.username}`} className="text-xs text-brand-400 hover:underline">@{flag.flagged_user.username}</Link>}
                              </>
                            )}
                          </div>
                          {flag.status === 'pending' ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <ActionButton variant="ghost" icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => setDmModal({ userId: flag.flagged_user_id, userName: flag.flagged_user?.display_name || flag.flagged_user?.full_name || 'User' })}>DM</ActionButton>
                              <ActionButton
                                variant="ghost"
                                icon={<Archive className="h-3.5 w-3.5" />}
                                onClick={() => handleAction('preserve_evidence', {
                                  flag_id: flag.id,
                                  content_type: flag.content_type,
                                  content_id: flag.content_id,
                                  full_content: flag.content_snippet,
                                  author_id: flag.flagged_user_id,
                                }).then(() => toast.success('Evidence preserved'))}
                              >
                                Preserve
                              </ActionButton>
                              <ActionButton variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setActionModal({ flag, action: 'delete' })} className="text-amber-300">Delete</ActionButton>
                              <ActionButton variant="ghost" onClick={() => setActionModal({ flag, action: 'warn' })} className="text-amber-300">Warn</ActionButton>
                              <ActionButton variant="ghost" onClick={() => setActionModal({ flag, action: 'suspend' })} className="text-orange-300">Suspend</ActionButton>
                              <ActionButton variant="danger" onClick={() => setActionModal({ flag, action: 'ban' })}>Ban</ActionButton>
                              <ActionButton variant="success" onClick={() => setActionModal({ flag, action: 'dismiss' })}>Dismiss</ActionButton>
                            </div>
                          ) : flag.action_taken ? (
                            <span className="text-xs text-surface-500">Action: {flag.action_taken.replace(/_/g, ' ')}</span>
                          ) : null}
                        </div>
                        {flag.review_notes && (
                          <p className="mt-3 border-t border-surface-800 pt-3 text-xs text-surface-500"><span className="font-medium text-surface-400">Review notes:</span> {flag.review_notes}</p>
                        )}
                      </AnimatedItem>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </>
          )}

          {subTab === 'all-projects' && (
            <>
              <Toolbar>
                <SearchInput value={projectSearch} onChange={setProjectSearch} placeholder="Search projects or owners…" />
                <span className="text-xs text-surface-500">{allProjects ? `${filteredProjects.length} of ${allProjects.length} projects · read-only` : 'Loading…'}</span>
              </Toolbar>
              {allProjects === null ? (
                <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} className="h-16 rounded-xl" />)}</div>
              ) : (
                <ul className="space-y-2">
                  {filteredProjects.slice(0, 200).map((p, i) => {
                    const owner = p.owner;
                    const hasModFlags = owner?.moderation_flags > 0;
                    const isFlaggedUser = owner?.moderation_status && owner.moderation_status !== 'clean';
                    return (
                      <motion.li
                        key={p.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 15) * 0.02 }}
                        className={cn('flex items-center gap-4 rounded-xl border px-4 py-3', hasModFlags ? 'border-red-500/30 bg-red-500/[0.05]' : 'border-surface-800 bg-surface-900/60')}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-800 text-sm font-bold text-surface-200">{p.title?.[0] || '?'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-white">{p.title}</p>
                            <Pill>{(p.status || '').replace(/_/g, ' ')}</Pill>
                            {p.format && <Pill tone="blue">{p.format}</Pill>}
                          </div>
                          <p className="truncate text-xs text-surface-500">{p.logline || 'No logline'}</p>
                        </div>
                        <div className="hidden shrink-0 items-center gap-2 md:flex">
                          <Avatar src={owner?.avatar_url || undefined} name={owner?.display_name || owner?.email || '?'} size="sm" />
                          <div className="text-right">
                            <p className="text-xs text-surface-300">{owner?.display_name || owner?.full_name || 'Unknown'}</p>
                            <p className="text-[11px] text-surface-500">{owner?.email}</p>
                          </div>
                          {isFlaggedUser && <Pill tone="red" dot>{owner.moderation_status}</Pill>}
                        </div>
                        <button
                          onClick={() => setDmModal({ userId: p.created_by, userName: owner?.display_name || owner?.full_name || 'Owner' })}
                          className="rounded-lg p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-white"
                          title="DM owner"
                          aria-label="DM owner"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <span className="w-16 shrink-0 text-right text-[11px] text-surface-500">{timeAgo(p.updated_at)}</span>
                      </motion.li>
                    );
                  })}
                  {filteredProjects.length > 200 && <p className="py-2 text-center text-[11px] text-surface-500">Showing 200 of {filteredProjects.length} — search to narrow down</p>}
                </ul>
              )}
            </>
          )}

          {subTab === 'evidence' && (
            <>
              <p className="text-xs text-surface-500">Tamper-proof snapshots — they can’t be edited or deleted.</p>
              {evidence.length === 0 ? (
                <EmptyState icon={<Archive className="h-8 w-8" />} title="No preserved evidence yet" />
              ) : (
                <ul className="space-y-3">
                  {evidence.map((ev, i) => (
                    <motion.li key={ev.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 15) * 0.03 }} className="rounded-2xl border border-surface-800 bg-surface-900/60 p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <Pill tone="violet">{CONTENT_TYPE_LABELS[ev.content_type] || ev.content_type}</Pill>
                        <span className="text-xs text-surface-500">{timeAgo(ev.captured_at)}</span>
                        <span className="ml-auto font-mono text-[11px] text-surface-500" title="SHA-256 integrity hash">#{ev.content_hash.slice(0, 16)}…</span>
                      </div>
                      <p className="mb-3 whitespace-pre-wrap break-words rounded-xl border border-surface-800 bg-surface-950 p-3 font-mono text-sm text-surface-300">{ev.full_content}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
                        <span>Author: <strong className="text-surface-300">{ev.author_name || 'Unknown'}</strong> ({ev.author_email})</span>
                        <span>Author ID: <span className="font-mono">{ev.author_id.slice(0, 8)}</span></span>
                        <span>Flag: <span className="font-mono">{ev.flag_id.slice(0, 8)}</span></span>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <Dialog
        open={!!dmModal}
        onClose={() => { setDmModal(null); setDmMessage(''); }}
        title={`Message ${dmModal?.userName ?? ''}`}
        description="Uses an existing DM conversation or starts a new one."
        footer={
          <>
            <ActionButton variant="ghost" onClick={() => { setDmModal(null); setDmMessage(''); }}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleDmUser} disabled={!dmMessage.trim()}>Send message</ActionButton>
          </>
        }
      >
        <textarea autoFocus value={dmMessage} onChange={e => setDmMessage(e.target.value)} placeholder="Write your message…" rows={4} className={fieldClass} />
      </Dialog>

      <Dialog
        open={!!actionModal}
        onClose={() => { setActionModal(null); setActionNotes(''); }}
        title={actionModal ? actionTitle[actionModal.action] : ''}
        description={
          actionModal?.action === 'ban' ? 'Removes all project memberships and blocks the user permanently.'
            : actionModal?.action === 'delete' ? 'Content is permanently removed (messages are soft-deleted).'
            : actionModal?.action === 'dismiss' ? 'No action will be taken against the user.' : undefined
        }
        footer={
          <>
            <ActionButton variant="ghost" onClick={() => { setActionModal(null); setActionNotes(''); }}>Cancel</ActionButton>
            <ActionButton
              variant={actionModal?.action === 'ban' || actionModal?.action === 'delete' ? 'danger' : actionModal?.action === 'dismiss' ? 'success' : 'primary'}
              onClick={handleModAction}
              disabled={!actionNotes.trim()}
            >
              {actionModal ? actionCta[actionModal.action] : ''}
            </ActionButton>
          </>
        }
      >
        {actionModal && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-xs text-surface-400">
              <Pill>{actionModal.flag.content_type}</Pill>
              User: <strong className="text-surface-200">{actionModal.flag.flagged_user?.display_name || actionModal.flag.flagged_user?.email || 'Unknown'}</strong>
            </p>
            {actionModal.action === 'suspend' && (
              <Field label="Duration (days)">
                <input type="number" value={actionDays} onChange={e => setActionDays(parseInt(e.target.value) || 30)} min={1} max={365} className={cn(fieldClass, 'w-32')} />
              </Field>
            )}
            <textarea
              autoFocus
              value={actionNotes}
              onChange={e => setActionNotes(e.target.value)}
              placeholder={actionModal.action === 'dismiss' ? 'Why is this a false positive?' : 'Reason for this action…'}
              rows={3}
              className={fieldClass}
            />
          </div>
        )}
      </Dialog>
    </AdminPage>
  );
}
