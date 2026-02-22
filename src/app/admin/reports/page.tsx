'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Badge, Modal, Input, Textarea, Select, Avatar } from '@/components/ui';
import { cn, formatDate, timeAgo } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────────────

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
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

const REASON_BADGE_COLORS: Record<string, string> = {
  spam: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  harassment: 'bg-red-500/20 text-red-400 border-red-500/30',
  hate_speech: 'bg-red-500/20 text-red-400 border-red-500/30',
  copyright: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  nsfw: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  illegal: 'bg-red-500/20 text-red-400 border-red-500/30',
  impersonation: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  misinformation: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  other: 'bg-surface-700/50 text-surface-300 border-surface-600',
};

const STATUS_BADGE: Record<string, { variant: 'warning' | 'info' | 'success' | 'default'; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  reviewing: { variant: 'info', label: 'Reviewing' },
  resolved: { variant: 'success', label: 'Resolved' },
  dismissed: { variant: 'default', label: 'Dismissed' },
};

const MOD_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'dismiss', label: 'Dismiss Report' },
  { value: 'remove_content', label: 'Remove Content' },
  { value: 'warn_user', label: 'Warn User' },
  { value: 'suspend_user', label: 'Suspend User (7 days)' },
  { value: 'ban_user', label: 'Ban User (Permanent)' },
];

// ── Types ──────────────────────────────────────────────────────────────────────

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

interface QuickStats {
  pending: number;
  today: number;
  resolvedToday: number;
  topContentType: string;
}

type ActiveTab = 'queue' | 'history';

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('queue');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuickStats>({ pending: 0, today: 0, resolvedToday: 0, topContentType: '—' });

  // Reports
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
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

  // ── Auth Guard ─────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isStaff(user.role)) {
      router.replace('/admin');
      return;
    }
    loadAll();
  }, [user, authLoading]);

  // ── Data Loading ───────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadReports(), loadModActions()]);
    setLoading(false);
  }, []);

  const loadStats = async () => {
    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const [rPending, rToday, rResolved, rTypes] = await Promise.all([
      supabase.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('content_reports').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
      supabase.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'resolved').gte('resolved_at', todayISO),
      supabase.from('content_reports').select('content_type').eq('status', 'pending'),
    ]);

    // Figure out most-reported content type from pending reports
    let topType = '—';
    if (rTypes.data && rTypes.data.length > 0) {
      const counts: Record<string, number> = {};
      rTypes.data.forEach((r: any) => { counts[r.content_type] = (counts[r.content_type] || 0) + 1; });
      topType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    }

    setStats({
      pending: rPending.count ?? 0,
      today: rToday.count ?? 0,
      resolvedToday: rResolved.count ?? 0,
      topContentType: topType,
    });
  };

  const loadReports = async () => {
    const supabase = createClient();
    let query = supabase
      .from('content_reports')
      .select('*, reporter:profiles!content_reports_reporter_id_fkey(display_name, full_name, email, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(300);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (reasonFilter) query = query.eq('reason', reasonFilter);
    if (typeFilter) query = query.eq('content_type', typeFilter);

    const { data } = await query;
    setReports((data ?? []) as ContentReport[]);
  };

  const loadModActions = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('mod_actions')
      .select('*, profiles(display_name, full_name, email, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(200);
    setModActions((data ?? []) as ModAction[]);
  };

  // Reload on filter changes
  useEffect(() => {
    if (!user || !isStaff(user.role)) return;
    loadReports();
  }, [statusFilter, reasonFilter, typeFilter]);

  // ── Review Modal ───────────────────────────────────────────

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
    loadStats();
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
    loadStats();
  };

  // ── Helpers ────────────────────────────────────────────────

  const userName = (p?: { display_name: string | null; full_name: string | null; email: string } | null) => {
    if (!p) return 'Unknown';
    return p.display_name || p.full_name || p.email;
  };

  // ── Render ─────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  const TABS: { id: ActiveTab; label: string; count?: number }[] = [
    { id: 'queue', label: 'Reports Queue', count: reports.length },
    { id: 'history', label: 'Moderation History', count: modActions.length },
  ];

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-xs text-surface-500 hover:text-white transition-colors mb-2 inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Admin
          </Link>
          <h1 className="text-2xl font-bold text-white">Content Reports &amp; Moderation</h1>
          <p className="text-sm text-surface-400 mt-1">Review reports, moderate content, and track actions</p>
        </div>
        <Button onClick={loadAll} variant="secondary" size="sm">
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending Reports', value: stats.pending, color: 'text-amber-400' },
          { label: 'Reports Today', value: stats.today, color: 'text-white' },
          { label: 'Resolved Today', value: stats.resolvedToday, color: 'text-green-400' },
          { label: 'Top Reported Type', value: stats.topContentType, color: 'text-surface-300', isText: true },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-surface-400 mb-1">{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>
              {'isText' in s ? s.value : (s.value as number).toLocaleString()}
            </p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-800 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-surface-400 hover:text-white'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-2 text-xs bg-surface-800 rounded-full px-2 py-0.5">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Reports Queue Tab ── */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select label="Status" options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
              <Select label="Reason" options={REASON_OPTIONS} value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)} />
              <Select label="Content Type" options={CONTENT_TYPE_OPTIONS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} />
            </div>
          </Card>

          {/* Reports Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 text-left">
                    <th className="px-4 py-3 text-surface-400 font-medium">Date</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Reporter</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Content Type</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Reason</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Description</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Status</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-surface-400">
                        No reports found
                      </td>
                    </tr>
                  )}
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="px-4 py-3 text-surface-300 whitespace-nowrap text-xs" title={formatDate(report.created_at)}>
                        {timeAgo(report.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar src={report.reporter?.avatar_url} name={userName(report.reporter)} size="sm" />
                          <Link href={`/u/${report.reporter_id}`} className="text-amber-400 hover:underline text-sm">
                            {userName(report.reporter)}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-surface-800 rounded px-2 py-0.5 text-surface-300">
                          {report.content_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                            REASON_BADGE_COLORS[report.reason] ?? 'bg-surface-800 text-surface-300 border-surface-700'
                          )}
                        >
                          {report.reason.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-400 text-xs max-w-[200px] truncate" title={report.description ?? ''}>
                        {report.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[report.status]?.variant ?? 'default'}>
                          {STATUS_BADGE[report.status]?.label ?? report.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openReview(report)}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            Review
                          </button>
                          {(report.status === 'pending' || report.status === 'reviewing') && (
                            <>
                              <button
                                onClick={() => quickResolve(report, 'resolved')}
                                className="text-xs text-green-400 hover:text-green-300 transition-colors"
                              >
                                Resolve
                              </button>
                              <button
                                onClick={() => quickResolve(report, 'dismissed')}
                                className="text-xs text-surface-400 hover:text-surface-300 transition-colors"
                              >
                                Dismiss
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Moderation History Tab ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 text-left">
                    <th className="px-4 py-3 text-surface-400 font-medium">Date</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Moderator</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Action</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Target Type</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Target ID</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {modActions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-surface-400">
                        No moderation actions yet
                      </td>
                    </tr>
                  )}
                  {modActions.map((action) => (
                    <tr key={action.id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="px-4 py-3 text-surface-300 whitespace-nowrap text-xs" title={formatDate(action.created_at)}>
                        {timeAgo(action.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar src={action.profiles?.avatar_url} name={userName(action.profiles)} size="sm" />
                          <span className="text-sm text-white">{userName(action.profiles)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-surface-800 rounded px-1.5 py-0.5 text-surface-300">
                          {action.action_type}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-surface-300 text-sm">{action.target_type ?? '—'}</td>
                      <td className="px-4 py-3 text-surface-400 font-mono text-xs max-w-[120px] truncate" title={action.target_id ?? ''}>
                        {action.target_id ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-400 text-xs max-w-[200px] truncate" title={action.reason ?? ''}>
                        {action.reason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Review Modal ── */}
      <Modal isOpen={!!reviewReport} onClose={() => setReviewReport(null)} title="Review Report" size="lg">
        {reviewReport && (
          <div className="p-6 space-y-5">
            {/* Report Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-surface-400 mb-1">Reporter</p>
                <div className="flex items-center gap-2">
                  <Avatar src={reviewReport.reporter?.avatar_url} name={userName(reviewReport.reporter)} size="sm" />
                  <Link href={`/u/${reviewReport.reporter_id}`} className="text-amber-400 hover:underline text-sm">
                    {userName(reviewReport.reporter)}
                  </Link>
                </div>
              </div>
              <div>
                <p className="text-xs text-surface-400 mb-1">Reported</p>
                <p className="text-sm text-white">{timeAgo(reviewReport.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-surface-400 mb-1">Content Type</p>
                <span className="text-xs bg-surface-800 rounded px-2 py-0.5 text-surface-300">
                  {reviewReport.content_type}
                </span>
              </div>
              <div>
                <p className="text-xs text-surface-400 mb-1">Reason</p>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                    REASON_BADGE_COLORS[reviewReport.reason] ?? 'bg-surface-800 text-surface-300 border-surface-700'
                  )}
                >
                  {reviewReport.reason.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {reviewReport.description && (
              <div>
                <p className="text-xs text-surface-400 mb-1">Reporter&apos;s Description</p>
                <p className="text-sm text-surface-300 bg-surface-950 rounded-lg p-3 border border-surface-800">
                  {reviewReport.description}
                </p>
              </div>
            )}

            {/* Content Preview */}
            <div>
              <p className="text-xs text-surface-400 mb-2">Reported Content</p>
              <div className="bg-surface-950 rounded-lg border border-surface-800 p-4">
                {reviewContentLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  </div>
                ) : reviewContent ? (
                  <div className="space-y-2 text-sm">
                    {Object.entries(reviewContent).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-surface-400 font-mono text-xs min-w-[100px] shrink-0">{key}:</span>
                        <span className="text-surface-300 text-xs break-all">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-surface-400 text-sm">Content not found or deleted</p>
                )}
              </div>
            </div>

            {/* Action Selection */}
            {(reviewReport.status === 'pending' || reviewReport.status === 'reviewing') && (
              <>
                <Select
                  label="Action"
                  options={MOD_ACTION_OPTIONS}
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                />

                <Textarea
                  label="Resolution Notes"
                  placeholder="Optional notes about this resolution…"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                />

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setReviewReport(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={submitModAction} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit Action'}
                  </Button>
                </div>
              </>
            )}

            {/* Already resolved */}
            {reviewReport.status !== 'pending' && reviewReport.status !== 'reviewing' && (
              <div className="rounded-lg bg-surface-800/50 p-4">
                <p className="text-xs text-surface-400 mb-1">Resolution</p>
                <Badge variant={STATUS_BADGE[reviewReport.status]?.variant ?? 'default'}>
                  {STATUS_BADGE[reviewReport.status]?.label ?? reviewReport.status}
                </Badge>
                {reviewReport.resolution_notes && (
                  <p className="text-sm text-surface-300 mt-2">{reviewReport.resolution_notes}</p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
}
