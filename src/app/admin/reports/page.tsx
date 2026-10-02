'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Eye, Flag, RefreshCw, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fillEmails } from '@/lib/private-profile';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import {
  ActionButton, AdminPage, BarList, Dialog, Dots, EmptyState, Field, PageHeader, Panel, Pill, Reveal, SearchInput,
  Segmented, Shimmer, StatGrid, TabSkeleton, Toolbar, TrendPanel, fieldClass, tally, SERIES, type Tone,
} from '@/components/admin/kit';

// Constants

const isStaff = (role?: string) => role === 'moderator' || role === 'admin';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Reasons' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'copyright', label: 'Copyright' },
  { value: 'nsfw', label: 'NSFW' },
  { value: 'illegal', label: 'Illegal' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'other', label: 'Other' },
];

const CONTENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'project', label: 'Project' },
  { value: 'comment', label: 'Comment' },
  { value: 'post', label: 'Post' },
  { value: 'message', label: 'Message' },
  { value: 'user', label: 'User' },
  { value: 'script', label: 'Script' },
];

const REASON_TONE: Record<string, Tone> = {
  spam: 'amber', harassment: 'red', hate_speech: 'red', copyright: 'violet', nsfw: 'pink',
  illegal: 'red', impersonation: 'brand', misinformation: 'amber', other: 'neutral',
};
const STATUS_TONE: Record<string, Tone> = { pending: 'amber', reviewing: 'blue', resolved: 'green', dismissed: 'neutral' };
const OPEN = (st: string) => st === 'pending' || st === 'reviewing';

const MOD_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'dismiss', label: 'Dismiss Report' },
  { value: 'remove_content', label: 'Remove Content' },
  { value: 'warn_user', label: 'Warn User' },
  { value: 'suspend_user', label: 'Suspend User (7 days)' },
  { value: 'ban_user', label: 'Ban User (Permanent)' },
];

// Types

interface ContentReport {
  id: string;
  reporter_id: string;
  content_type: string;
  content_id: string;
  reason: string;
  description: string | null;
  status: string;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter?: { display_name: string | null; full_name: string | null; email: string; avatar_url: string | null } | null;
}

interface ModAction {
  id: string;
  mod_user_id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  ticket_id: string | null;
  created_at: string;
  profiles?: { display_name: string | null; full_name: string | null; email: string; avatar_url: string | null } | null;
}

type ActiveTab = 'queue' | 'history';


export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('queue');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Reports
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [reasonFilter, setReasonFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Review modal
  const [reviewReport, setReviewReport] = useState<ContentReport | null>(null);
  const [reviewContent, setReviewContent] = useState<Record<string, unknown> | null>(null);
  const [reviewContentLoading, setReviewContentLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState('dismiss');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Mod history
  const [modActions, setModActions] = useState<ModAction[]>([]);

  // Auth Guard

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isStaff(user.role)) {
      router.replace('/admin');
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Data Loading

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadReports(), loadModActions()]);
    setLoading(false);
    setRefreshing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReports = async () => {
    const supabase = createClient();
    const query = supabase
      .from('content_reports')
      .select('*, reporter:profiles!content_reports_reporter_id_fkey(id, display_name, full_name, email, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(1000);

    const { data } = await query;
    await fillEmails(supabase, (data ?? []).map((r: { reporter?: { id?: string; email?: string | null } | null }) => r.reporter));
    setReports((data ?? []) as ContentReport[]);
  };

  const loadModActions = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('mod_actions')
      .select('*, profiles(id, display_name, full_name, email, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(200);
    await fillEmails(supabase, (data ?? []).map((a: { profiles?: { id?: string; email?: string | null } | null }) => a.profiles));
    setModActions((data ?? []) as ModAction[]);
  };

  // Review Modal

  const openReview = async (report: ContentReport) => {
    setReviewReport(report);
    setReviewContent(null);
    setSelectedAction('dismiss');
    setResolutionNotes('');
    setReviewContentLoading(true);

    const supabase = createClient();
    let content: Record<string, unknown> | null = null;

    try {
      switch (report.content_type) {
        case 'comment': {
          const { data } = await supabase.from('comments').select('*').eq('id', report.content_id).single();
          content = data;
          break;
        }
        case 'post': {
          const { data } = await supabase.from('community_posts').select('*').eq('id', report.content_id).single();
          content = data;
          break;
        }
        case 'project': {
          const { data } = await supabase.from('projects').select('id, title, logline, synopsis, genre, format, status, created_by, created_at').eq('id', report.content_id).single();
          content = data;
          break;
        }
        case 'user': {
          const { data } = await supabase.from('profiles').select('id, email, display_name, full_name, bio, avatar_url, role, created_at').eq('id', report.content_id).single();
          if (data) await fillEmails(supabase, [data]);
          content = data;
          break;
        }
        default: {
          content = { note: `Content type "${report.content_type}" — manual review required`, content_id: report.content_id };
        }
      }
    } catch {
      content = { error: 'Failed to load content', content_id: report.content_id };
    }

    setReviewContent(content);
    setReviewContentLoading(false);
  };

  const resolveReport = async (reportId: string, newStatus: 'resolved' | 'dismissed') => {
    if (!user) return;
    const supabase = createClient();
    await supabase
      .from('content_reports')
      .update({ status: newStatus, resolved_by: user.id, resolution_notes: resolutionNotes || null, resolved_at: new Date().toISOString() })
      .eq('id', reportId);
    setReviewReport(null);
    loadReports();
  };

  const submitModAction = async () => {
    if (!reviewReport || !user) return;
    setSubmitting(true);
    const supabase = createClient();

    // Determine content owner for user-level actions
    let targetUserId: string | null = null;
    if (reviewContent) {
      targetUserId =
        (reviewContent as any).created_by ||
        (reviewContent as any).user_id ||
        (reviewContent as any).author_id ||
        (reviewReport.content_type === 'user' ? reviewReport.content_id : null);
    }

    // Execute the selected action
    switch (selectedAction) {
      case 'dismiss':
        await resolveReport(reviewReport.id, 'dismissed');
        break;

      case 'remove_content':
        // Mark report as resolved
        await resolveReport(reviewReport.id, 'resolved');
        // Log mod action
        await supabase.from('mod_actions').insert({
          mod_user_id: user.id,
          action_type: 'remove_content',
          target_type: reviewReport.content_type,
          target_id: reviewReport.content_id,
          reason: resolutionNotes || reviewReport.reason,
        });
        break;

      case 'warn_user':
        if (targetUserId) {
          await supabase.from('user_bans').insert({
            user_id: targetUserId,
            banned_by: user.id,
            reason: resolutionNotes || `Warning: ${reviewReport.reason}`,
            ban_type: 'warning',
            is_active: true,
          });
        }
        await supabase.from('mod_actions').insert({
          mod_user_id: user.id,
          action_type: 'warn_user',
          target_type: 'user',
          target_id: targetUserId,
          reason: resolutionNotes || reviewReport.reason,
        });
        await resolveReport(reviewReport.id, 'resolved');
        break;

      case 'suspend_user':
        if (targetUserId) {
          const expires = new Date();
          expires.setDate(expires.getDate() + 7);
          await supabase.from('user_bans').insert({
            user_id: targetUserId,
            banned_by: user.id,
            reason: resolutionNotes || `Suspended: ${reviewReport.reason}`,
            ban_type: 'temporary',
            expires_at: expires.toISOString(),
            is_active: true,
          });
        }
        await supabase.from('mod_actions').insert({
          mod_user_id: user.id,
          action_type: 'suspend_user',
          target_type: 'user',
          target_id: targetUserId,
          reason: resolutionNotes || reviewReport.reason,
        });
        await resolveReport(reviewReport.id, 'resolved');
        break;

      case 'ban_user':
        if (targetUserId) {
          await supabase.from('user_bans').insert({
            user_id: targetUserId,
            banned_by: user.id,
            reason: resolutionNotes || `Banned: ${reviewReport.reason}`,
            ban_type: 'permanent',
            is_active: true,
          });
        }
        await supabase.from('mod_actions').insert({
          mod_user_id: user.id,
          action_type: 'ban_user',
          target_type: 'user',
          target_id: targetUserId,
          reason: resolutionNotes || reviewReport.reason,
        });
        await resolveReport(reviewReport.id, 'resolved');
        break;
    }

    // Log to audit_log
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: `mod_${selectedAction}`,
      entity_type: 'content_report',
      entity_id: reviewReport.id,
      metadata: {
        action: selectedAction,
        content_type: reviewReport.content_type,
        content_id: reviewReport.content_id,
        target_user: targetUserId,
        notes: resolutionNotes,
      },
    });

    setSubmitting(false);
    setReviewReport(null);
    loadModActions();
  };

  const quickResolve = async (report: ContentReport, newStatus: 'resolved' | 'dismissed') => {
    if (!user) return;
    const supabase = createClient();
    await supabase
      .from('content_reports')
      .update({ status: newStatus, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', report.id);
    loadReports();
  };

  // Helpers

  const userName = (p?: { display_name: string | null; full_name: string | null; email: string } | null) => {
    if (!p) return 'Unknown';
    return p.display_name || p.full_name || p.email;
  };

  const visibleReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports
      .filter(r => !statusFilter || (statusFilter === 'open' ? OPEN(r.status) : r.status === statusFilter))
      .filter(r => !reasonFilter || r.reason === reasonFilter)
      .filter(r => !typeFilter || r.content_type === typeFilter)
      .filter(r => !q || `${r.description || ''} ${userName(r.reporter)} ${r.content_id}`.toLowerCase().includes(q));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, statusFilter, reasonFilter, typeFilter, search]);

  // Render
  if (authLoading || loading) return <TabSkeleton />;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const today = todayStart.toISOString();
  const openReports = reports.filter(r => OPEN(r.status));
  const resolvedTimes = reports.filter(r => r.resolved_at).map(r => Date.parse(r.resolved_at!) - Date.parse(r.created_at));
  const medianHours = resolvedTimes.length ? [...resolvedTimes].sort((a, b) => a - b)[Math.floor(resolvedTimes.length / 2)] / 3_600_000 : 0;
  const oldestOpen = openReports.length ? openReports[openReports.length - 1] : null;
  const isOpenReview = !!reviewReport && OPEN(reviewReport.status);

  return (
    <AdminPage>
      <PageHeader
        icon={<Flag className="h-5 w-5" />}
        title="Reports"
        description="User reports on content — review, act, and track decisions."
        meta={oldestOpen ? <>Oldest open report: {timeAgo(oldestOpen.created_at)}</> : <>Queue is clear</>}
        actions={<ActionButton icon={<RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />} onClick={loadAll} disabled={refreshing}>Refresh</ActionButton>}
      />

      <StatGrid
        cols={5}
        layoutGroup="reports"
        items={[
          { label: 'Open', value: openReports.length, tone: 'amber', onClick: () => { setActiveTab('queue'); setStatusFilter(c => (c === 'open' ? '' : 'open')); }, active: activeTab === 'queue' && statusFilter === 'open' },
          { label: 'Reported today', value: reports.filter(r => r.created_at >= today).length, tone: 'blue' },
          { label: 'Resolved today', value: reports.filter(r => r.resolved_at && r.resolved_at >= today).length, tone: 'green' },
          { label: 'Median time to resolve', value: medianHours, tone: 'violet', format: n => (n < 1 ? `${Math.round(n * 60)}m` : n < 48 ? `${n.toFixed(1)}h` : `${(n / 24).toFixed(1)}d`), hint: 'From report to resolution' },
          { label: 'Mod actions', value: modActions.length, tone: 'red', onClick: () => setActiveTab('history'), active: activeTab === 'history' },
        ]}
      />

      {reports.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-5">
          <TrendPanel
            id="reports"
            className="lg:col-span-3"
            title="Reports in vs. closed"
            subtitle="Is the queue keeping up?"
            sources={[
              { key: 'in', label: 'Reported', color: SERIES.orange, rows: reports, time: r => r.created_at },
              { key: 'out', label: 'Closed', color: SERIES.aqua, rows: reports, time: r => r.resolved_at },
            ]}
          />
          <Panel title="Why people report" subtitle="All reports, by reason" className="lg:col-span-2">
            <BarList items={tally(reports, r => r.reason)} color={SERIES.orange} limit={6} />
            <div className="mt-4 border-t border-surface-800 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">Open, by content type</p>
              <div className="flex flex-wrap gap-1.5">
                {tally(openReports, r => r.content_type).map(t => (
                  <button key={t.label} onClick={() => { setActiveTab('queue'); setStatusFilter('open'); setTypeFilter(f => (f === t.label ? '' : t.label)); }}>
                    <Pill tone={typeFilter === t.label ? 'brand' : 'neutral'}>{t.label} <span className="text-white">{t.count}</span></Pill>
                  </button>
                ))}
                {openReports.length === 0 && <span className="text-xs text-surface-600">Nothing open</span>}
              </div>
            </div>
          </Panel>
        </div>
      )}

      <Reveal>
        <Segmented
          id="reports-tab"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { key: 'queue', label: <>Reports queue <span className="ml-1 text-surface-500">{reports.length}</span></> },
            { key: 'history', label: <>Moderation history <span className="ml-1 text-surface-500">{modActions.length}</span></> },
          ]}
        />
      </Reveal>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="space-y-4">
          {activeTab === 'queue' && (
            <>
              <Toolbar>
                <SearchInput value={search} onChange={setSearch} placeholder="Search description, reporter or content ID…" />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={cn(fieldClass, 'w-auto py-2')} aria-label="Status">
                  <option value="open">Open (pending + reviewing)</option>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value)} className={cn(fieldClass, 'w-auto py-2')} aria-label="Reason">
                  {REASON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={cn(fieldClass, 'w-auto py-2')} aria-label="Content type">
                  {CONTENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Toolbar>
              {visibleReports.length === 0 ? (
                <EmptyState icon={<Check className="h-8 w-8 text-emerald-500/60" />} title="No reports here" description={statusFilter === 'open' ? 'The queue is clear.' : 'Try different filters.'} />
              ) : (
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {visibleReports.map((report, i) => (
                      <motion.li
                        key={report.id}
                        layout="position"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 15) * 0.02 } }}
                        exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
                        className="flex flex-col gap-3 rounded-xl border border-surface-800 bg-surface-900/60 px-4 py-3 md:flex-row md:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <Avatar src={report.reporter?.avatar_url} name={userName(report.reporter)} size="sm" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Pill tone={REASON_TONE[report.reason] ?? 'neutral'} dot>{report.reason.replace(/_/g, ' ')}</Pill>
                              <Pill>{report.content_type}</Pill>
                              <Pill tone={STATUS_TONE[report.status] ?? 'neutral'}>{report.status}</Pill>
                              <span className="text-[11px] text-surface-500" title={formatDate(report.created_at)}>{timeAgo(report.created_at)}</span>
                            </div>
                            <p className="mt-1 truncate text-sm text-surface-300">{report.description || <span className="text-surface-600">No description</span>}</p>
                            <p className="text-[11px] text-surface-500">by <Link href={`/u/${report.reporter_id}`} className="text-brand-400 hover:underline">{userName(report.reporter)}</Link></p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <ActionButton variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => openReview(report)}>Review</ActionButton>
                          {OPEN(report.status) && (
                            <>
                              <ActionButton variant="success" icon={<Check className="h-3.5 w-3.5" />} onClick={() => quickResolve(report, 'resolved')}>Resolve</ActionButton>
                              <ActionButton variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => quickResolve(report, 'dismissed')}>Dismiss</ActionButton>
                            </>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="grid gap-5 lg:grid-cols-3">
              <Panel title="Action log" subtitle="Latest 200 moderation actions" className="lg:col-span-2" bodyClassName="p-0">
                {modActions.length === 0 ? (
                  <div className="p-5"><EmptyState title="No moderation actions yet" /></div>
                ) : (
                  <ul className="divide-y divide-surface-800/70">
                    {modActions.map((action, i) => (
                      <motion.li key={action.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.015 }} className="flex items-center gap-3 px-5 py-3">
                        <Avatar src={action.profiles?.avatar_url} name={userName(action.profiles)} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white">
                            <span className="font-medium">{userName(action.profiles)}</span>{' '}
                            <code className="rounded bg-surface-800 px-1.5 py-0.5 text-xs text-surface-300">{action.action_type}</code>{' '}
                            <span className="text-surface-500">{action.target_type ?? ''}</span>
                          </p>
                          <p className="truncate text-xs text-surface-500" title={action.reason ?? ''}>{action.reason || '—'}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-surface-500" title={formatDate(action.created_at)}>{timeAgo(action.created_at)}</span>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </Panel>
              <div className="space-y-5">
                <Panel title="Actions taken"><BarList items={tally(modActions, a => a.action_type)} color={SERIES.violet} /></Panel>
                <Panel title="By moderator"><BarList items={tally(modActions, a => userName(a.profiles))} color={SERIES.blue} labelFormat={l => <span className="normal-case">{l}</span>} /></Panel>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <Dialog
        open={!!reviewReport}
        onClose={() => setReviewReport(null)}
        title="Review report"
        size="lg"
        footer={isOpenReview ? (
          <>
            <ActionButton variant="ghost" onClick={() => setReviewReport(null)}>Cancel</ActionButton>
            <ActionButton variant={selectedAction === 'ban_user' || selectedAction === 'remove_content' ? 'danger' : 'primary'} onClick={submitModAction} disabled={submitting}>
              {submitting ? <>Submitting <Dots /></> : MOD_ACTION_OPTIONS.find(o => o.value === selectedAction)?.label ?? 'Submit'}
            </ActionButton>
          </>
        ) : undefined}
      >
        {reviewReport && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="mb-1 text-[11px] text-surface-500">Reporter</p>
                <div className="flex items-center gap-2">
                  <Avatar src={reviewReport.reporter?.avatar_url} name={userName(reviewReport.reporter)} size="sm" />
                  <Link href={`/u/${reviewReport.reporter_id}`} className="text-brand-400 hover:underline">{userName(reviewReport.reporter)}</Link>
                </div>
              </div>
              <div><p className="mb-1 text-[11px] text-surface-500">Reported</p><p className="text-white">{timeAgo(reviewReport.created_at)}</p></div>
              <div><p className="mb-1 text-[11px] text-surface-500">Content type</p><Pill>{reviewReport.content_type}</Pill></div>
              <div><p className="mb-1 text-[11px] text-surface-500">Reason</p><Pill tone={REASON_TONE[reviewReport.reason] ?? 'neutral'} dot>{reviewReport.reason.replace(/_/g, ' ')}</Pill></div>
            </div>
            {reviewReport.description && (
              <div>
                <p className="mb-1 text-[11px] text-surface-500">Reporter’s description</p>
                <p className="rounded-xl border border-surface-800 bg-surface-950 p-3 text-sm text-surface-300">{reviewReport.description}</p>
              </div>
            )}
            <div>
              <p className="mb-2 text-[11px] text-surface-500">Reported content</p>
              <div className="rounded-xl border border-surface-800 bg-surface-950 p-4">
                {reviewContentLoading ? (
                  <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-4" />)}</div>
                ) : reviewContent ? (
                  <dl className="space-y-1.5 text-xs">
                    {Object.entries(reviewContent).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <dt className="min-w-[100px] shrink-0 font-mono text-surface-500">{key}</dt>
                        <dd className="break-all text-surface-300">{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-surface-400">Content not found or deleted</p>
                )}
              </div>
            </div>
            {isOpenReview ? (
              <>
                <Field label="Action">
                  <div className="flex flex-wrap gap-1.5">
                    {MOD_ACTION_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setSelectedAction(o.value)}
                        className={cn('relative rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors', selectedAction === o.value ? 'border-transparent text-white' : 'border-surface-800 text-surface-400 hover:text-white')}
                      >
                        {selectedAction === o.value && <motion.span layoutId="report-action" className="absolute inset-0 rounded-lg bg-brand-500/20 ring-1 ring-brand-500/50" />}
                        <span className="relative">{o.label}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Resolution notes" hint="(optional)">
                  <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} placeholder="Notes about this resolution…" rows={3} className={fieldClass} />
                </Field>
              </>
            ) : (
              <div className="rounded-xl bg-surface-800/50 p-4">
                <p className="mb-1 text-[11px] text-surface-500">Resolution</p>
                <Pill tone={STATUS_TONE[reviewReport.status] ?? 'neutral'} dot>{reviewReport.status}</Pill>
                {reviewReport.resolution_notes && <p className="mt-2 text-sm text-surface-300">{reviewReport.resolution_notes}</p>}
              </div>
            )}
          </div>
        )}
      </Dialog>
    </AdminPage>
  );
}
