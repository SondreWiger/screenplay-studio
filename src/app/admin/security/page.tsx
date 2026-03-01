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
const isFullAdmin = (id?: string, role?: string) => id === ADMIN_UID || role === 'admin';

const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Events' },
  { value: 'failed_login', label: 'Failed Login' },
  { value: 'password_changed', label: 'Password Changed' },
  { value: 'email_changed', label: 'Email Changed' },
  { value: 'suspicious_login', label: 'Suspicious Login' },
  { value: 'rate_limited', label: 'Rate Limited' },
  { value: 'api_abuse', label: 'API Abuse' },
  { value: 'brute_force', label: 'Brute Force' },
  { value: 'account_locked', label: 'Account Locked' },
  { value: 'data_export', label: 'Data Export' },
  { value: 'account_deletion', label: 'Account Deletion' },
  { value: 'admin_action', label: 'Admin Action' },
  { value: 'permission_change', label: 'Permission Change' },
];

const DATE_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

const BAN_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'warning', label: 'Warning' },
  { value: 'temporary', label: 'Temporary Ban' },
  { value: 'permanent', label: 'Permanent Ban' },
];

const EVENT_BADGE_COLORS: Record<string, string> = {
  failed_login: 'bg-red-500/20 text-red-400 border-red-500/30',
  password_changed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  email_changed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  suspicious_login: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  rate_limited: 'bg-[#FF5F1F]/20 text-[#FF5F1F] border-amber-500/30',
  api_abuse: 'bg-red-500/20 text-red-400 border-red-500/30',
  brute_force: 'bg-red-500/20 text-red-400 border-red-500/30',
  account_locked: 'bg-red-500/20 text-red-400 border-red-500/30',
  data_export: 'bg-green-500/20 text-green-400 border-green-500/30',
  account_deletion: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  admin_action: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  permission_change: 'bg-[#FF5F1F]/20 text-[#FF5F1F] border-yellow-500/30',
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface SecurityEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles?: { display_name: string | null; full_name: string | null; email: string; avatar_url: string | null } | null;
}

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles?: { display_name: string | null; full_name: string | null; email: string; avatar_url: string | null } | null;
}

interface UserBan {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string;
  ban_type: 'warning' | 'temporary' | 'permanent';
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  profiles?: { display_name: string | null; full_name: string | null; email: string; avatar_url: string | null } | null;
  banner?: { display_name: string | null; full_name: string | null; email: string } | null;
}

interface UserSearchResult {
  id: string;
  email: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface QuickStats {
  events24h: number;
  events7d: number;
  events30d: number;
  failedLogins: number;
  rateLimits: number;
  activeBans: number;
}

type ActiveTab = 'events' | 'audit' | 'bans';

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('events');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuickStats>({ events24h: 0, events7d: 0, events30d: 0, failedLogins: 0, rateLimits: 0, activeBans: 0 });

  // Security Events
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [eventDateRange, setEventDateRange] = useState('7d');
  const [eventUserSearch, setEventUserSearch] = useState('');

  // Audit Log
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditDateRange, setAuditDateRange] = useState('7d');

  // Bans
  const [bans, setBans] = useState<UserBan[]>([]);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banUserSearch, setBanUserSearch] = useState('');
  const [banUserResults, setBanUserResults] = useState<UserSearchResult[]>([]);
  const [selectedBanUser, setSelectedBanUser] = useState<UserSearchResult | null>(null);
  const [banType, setBanType] = useState('temporary');
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('7'); // days
  const [banSubmitting, setBanSubmitting] = useState(false);

  // Extend ban modal
  const [extendBan, setExtendBan] = useState<UserBan | null>(null);
  const [extendDays, setExtendDays] = useState('7');

  // ── Auth Guard ─────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isFullAdmin(user.id, user.role)) {
      router.replace('/admin');
      return;
    }
    loadAll();
  }, [user, authLoading]);

  // ── Data Loading ───────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadEvents(), loadAudit(), loadBans()]);
    setLoading(false);
  }, []);

  const loadStats = async () => {
    const supabase = createClient();
    const now = new Date();
    const d24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const d7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const d30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [r24h, r7d, r30d, rFailed, rRate, rBans] = await Promise.all([
      supabase.from('security_events').select('id', { count: 'exact', head: true }).gte('created_at', d24h),
      supabase.from('security_events').select('id', { count: 'exact', head: true }).gte('created_at', d7d),
      supabase.from('security_events').select('id', { count: 'exact', head: true }).gte('created_at', d30d),
      supabase.from('security_events').select('id', { count: 'exact', head: true }).eq('event_type', 'failed_login').gte('created_at', d7d),
      supabase.from('security_events').select('id', { count: 'exact', head: true }).eq('event_type', 'rate_limited').gte('created_at', d7d),
      supabase.from('user_bans').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    setStats({
      events24h: r24h.count ?? 0,
      events7d: r7d.count ?? 0,
      events30d: r30d.count ?? 0,
      failedLogins: rFailed.count ?? 0,
      rateLimits: rRate.count ?? 0,
      activeBans: rBans.count ?? 0,
    });
  };

  const getDateCutoff = (range: string) => {
    const now = new Date();
    if (range === '24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return null;
  };

  const loadEvents = async () => {
    const supabase = createClient();
    let query = supabase
      .from('security_events')
      .select('*, profiles!security_events_user_id_fkey(display_name, full_name, email, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (eventTypeFilter) query = query.eq('event_type', eventTypeFilter);
    const cutoff = getDateCutoff(eventDateRange);
    if (cutoff) query = query.gte('created_at', cutoff);

    const { data } = await query;
    let filtered = (data ?? []) as SecurityEvent[];
    if (eventUserSearch.trim()) {
      const s = eventUserSearch.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.profiles?.email?.toLowerCase().includes(s) ||
          e.profiles?.display_name?.toLowerCase().includes(s) ||
          e.profiles?.full_name?.toLowerCase().includes(s)
      );
    }
    setEvents(filtered);
  };

  const loadAudit = async () => {
    const supabase = createClient();
    let query = supabase
      .from('audit_log')
      .select('*, profiles!audit_log_user_id_fkey(display_name, full_name, email, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(200);

    const cutoff = getDateCutoff(auditDateRange);
    if (cutoff) query = query.gte('created_at', cutoff);
    if (auditActionFilter) query = query.ilike('action', `%${auditActionFilter}%`);

    const { data } = await query;
    let filtered = (data ?? []) as AuditEntry[];
    if (auditSearch.trim()) {
      const s = auditSearch.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.action.toLowerCase().includes(s) ||
          e.entity_type.toLowerCase().includes(s) ||
          e.entity_id?.toLowerCase().includes(s) ||
          e.profiles?.email?.toLowerCase().includes(s) ||
          e.profiles?.display_name?.toLowerCase().includes(s)
      );
    }
    setAuditEntries(filtered);
  };

  const loadBans = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('user_bans')
      .select('*, profiles!user_bans_user_id_fkey(display_name, full_name, email, avatar_url), banner:profiles!user_bans_banned_by_fkey(display_name, full_name, email)')
      .order('created_at', { ascending: false });
    setBans((data ?? []) as UserBan[]);
  };

  // Reload on filter changes
  useEffect(() => {
    if (!user || !isFullAdmin(user.id, user.role)) return;
    loadEvents();
  }, [eventTypeFilter, eventDateRange, eventUserSearch]);

  useEffect(() => {
    if (!user || !isFullAdmin(user.id, user.role)) return;
    loadAudit();
  }, [auditSearch, auditActionFilter, auditDateRange]);

  // ── Ban Actions ────────────────────────────────────────────

  const searchUsersForBan = async (q: string) => {
    setBanUserSearch(q);
    if (q.length < 2) { setBanUserResults([]); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name, full_name, avatar_url')
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(10);
    setBanUserResults((data ?? []) as UserSearchResult[]);
  };

  const submitBan = async () => {
    if (!selectedBanUser || !banReason.trim() || !user) return;
    setBanSubmitting(true);
    const supabase = createClient();

    let expiresAt: string | null = null;
    if (banType === 'temporary') {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(banDuration, 10));
      expiresAt = d.toISOString();
    }

    await supabase.from('user_bans').insert({
      user_id: selectedBanUser.id,
      banned_by: user.id,
      reason: banReason,
      ban_type: banType,
      expires_at: expiresAt,
      is_active: true,
    });

    // Audit
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'ban_user',
      entity_type: 'user',
      entity_id: selectedBanUser.id,
      metadata: { ban_type: banType, reason: banReason, duration_days: banType === 'temporary' ? parseInt(banDuration) : null },
    });

    setBanSubmitting(false);
    closeBanModal();
    loadBans();
    loadStats();
  };

  const revokeBan = async (ban: UserBan) => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from('user_bans').update({ is_active: false }).eq('id', ban.id);
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'revoke_ban',
      entity_type: 'user_ban',
      entity_id: ban.id,
      metadata: { target_user: ban.user_id },
    });
    loadBans();
    loadStats();
  };

  const submitExtendBan = async () => {
    if (!extendBan || !user) return;
    const supabase = createClient();
    const base = extendBan.expires_at ? new Date(extendBan.expires_at) : new Date();
    base.setDate(base.getDate() + parseInt(extendDays, 10));
    await supabase.from('user_bans').update({ expires_at: base.toISOString() }).eq('id', extendBan.id);
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'extend_ban',
      entity_type: 'user_ban',
      entity_id: extendBan.id,
      metadata: { target_user: extendBan.user_id, extended_days: parseInt(extendDays) },
    });
    setExtendBan(null);
    loadBans();
  };

  const closeBanModal = () => {
    setShowBanModal(false);
    setBanUserSearch('');
    setBanUserResults([]);
    setSelectedBanUser(null);
    setBanType('temporary');
    setBanReason('');
    setBanDuration('7');
  };

  // ── Helpers ────────────────────────────────────────────────

  const userName = (p?: { display_name: string | null; full_name: string | null; email: string } | null) => {
    if (!p) return 'System';
    return p.display_name || p.full_name || p.email;
  };

  const truncateUA = (ua: string | null) => {
    if (!ua) return '—';
    return ua.length > 60 ? ua.substring(0, 60) + '…' : ua;
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
    { id: 'events', label: 'Security Events', count: events.length },
    { id: 'audit', label: 'Audit Log', count: auditEntries.length },
    { id: 'bans', label: 'User Bans', count: bans.filter((b) => b.is_active).length },
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
          <h1 className="text-2xl font-black text-white">Security &amp; Audit</h1>
          <p className="text-sm text-surface-400 mt-1">Monitor security events, audit trails, and user bans</p>
        </div>
        <Button onClick={loadAll} variant="secondary" size="sm">
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Events (24h)', value: stats.events24h, color: 'text-white' },
          { label: 'Events (7d)', value: stats.events7d, color: 'text-white' },
          { label: 'Events (30d)', value: stats.events30d, color: 'text-white' },
          { label: 'Failed Logins (7d)', value: stats.failedLogins, color: 'text-red-400' },
          { label: 'Rate Limits (7d)', value: stats.rateLimits, color: 'text-amber-400' },
          { label: 'Active Bans', value: stats.activeBans, color: 'text-red-400' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-surface-400 mb-1">{s.label}</p>
            <p className={cn('text-2xl font-black', s.color)}>{s.value.toLocaleString()}</p>
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

      {/* ── Security Events Tab ── */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select
                label="Event Type"
                options={EVENT_TYPE_OPTIONS}
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
              />
              <Select
                label="Date Range"
                options={DATE_RANGE_OPTIONS}
                value={eventDateRange}
                onChange={(e) => setEventDateRange(e.target.value)}
              />
              <Input
                label="Search User"
                placeholder="Email or name…"
                value={eventUserSearch}
                onChange={(e) => setEventUserSearch(e.target.value)}
              />
            </div>
          </Card>

          {/* Events Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 text-left">
                    <th className="px-4 py-3 text-surface-400 font-medium">Time</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">User</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Event</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">IP Address</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">User Agent</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-surface-400">
                        No security events found
                      </td>
                    </tr>
                  )}
                  {events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="px-4 py-3 text-surface-300 whitespace-nowrap" title={formatDate(evt.created_at)}>
                        {timeAgo(evt.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {evt.user_id ? (
                          <Link href={`/u/${evt.user_id}`} className="text-amber-400 hover:underline text-sm">
                            {userName(evt.profiles)}
                          </Link>
                        ) : (
                          <span className="text-surface-400">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                            EVENT_BADGE_COLORS[evt.event_type] ?? 'bg-surface-800 text-surface-300 border-surface-700'
                          )}
                        >
                          {evt.event_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-300 font-mono text-xs">
                        {evt.ip_address ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-400 text-xs max-w-[200px] truncate" title={evt.user_agent ?? ''}>
                        {truncateUA(evt.user_agent)}
                      </td>
                      <td className="px-4 py-3 text-surface-400 text-xs max-w-[200px]">
                        {evt.metadata && Object.keys(evt.metadata).length > 0 ? (
                          <code className="text-xs bg-surface-800 rounded px-1.5 py-0.5">
                            {JSON.stringify(evt.metadata).substring(0, 80)}
                          </code>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Audit Log Tab ── */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Search"
                placeholder="Action, entity, user…"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
              <Input
                label="Filter Action"
                placeholder="e.g. ban_user, delete…"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
              />
              <Select
                label="Date Range"
                options={DATE_RANGE_OPTIONS}
                value={auditDateRange}
                onChange={(e) => setAuditDateRange(e.target.value)}
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 text-left">
                    <th className="px-4 py-3 text-surface-400 font-medium">Timestamp</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">User</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Action</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Entity Type</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Entity ID</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">IP</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {auditEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-surface-400">
                        No audit entries found
                      </td>
                    </tr>
                  )}
                  {auditEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="px-4 py-3 text-surface-300 whitespace-nowrap text-xs" title={formatDate(entry.created_at)}>
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {entry.user_id ? (
                          <Link href={`/u/${entry.user_id}`} className="text-amber-400 hover:underline text-sm">
                            {userName(entry.profiles)}
                          </Link>
                        ) : (
                          <span className="text-surface-400">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-surface-800 rounded px-1.5 py-0.5 text-surface-300">
                          {entry.action}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-surface-300 text-sm">{entry.entity_type}</td>
                      <td className="px-4 py-3 text-surface-400 font-mono text-xs max-w-[120px] truncate" title={entry.entity_id ?? ''}>
                        {entry.entity_id ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-300 font-mono text-xs">{entry.ip_address ?? '—'}</td>
                      <td className="px-4 py-3 text-surface-400 text-xs max-w-[200px]">
                        {entry.metadata && Object.keys(entry.metadata).length > 0 ? (
                          <code className="text-xs bg-surface-800 rounded px-1.5 py-0.5">
                            {JSON.stringify(entry.metadata).substring(0, 80)}
                          </code>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── User Bans Tab ── */}
      {activeTab === 'bans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">User Bans</h2>
            <Button onClick={() => setShowBanModal(true)} variant="primary" size="sm">
              + Ban User
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 text-left">
                    <th className="px-4 py-3 text-surface-400 font-medium">User</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Type</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Reason</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Expires</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Status</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Banned By</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Created</th>
                    <th className="px-4 py-3 text-surface-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {bans.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-surface-400">
                        No bans found
                      </td>
                    </tr>
                  )}
                  {bans.map((ban) => (
                    <tr key={ban.id} className={cn('hover:bg-surface-800/30 transition-colors', !ban.is_active && 'opacity-50')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar src={ban.profiles?.avatar_url} name={userName(ban.profiles)} size="sm" />
                          <div>
                            <Link href={`/u/${ban.user_id}`} className="text-amber-400 hover:underline text-sm">
                              {userName(ban.profiles)}
                            </Link>
                            <p className="text-xs text-surface-400">{ban.profiles?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                            ban.ban_type === 'permanent'
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : ban.ban_type === 'temporary'
                                ? 'bg-[#FF5F1F]/20 text-[#FF5F1F] border-amber-500/30'
                                : 'bg-[#FF5F1F]/20 text-[#FF5F1F] border-yellow-500/30'
                          )}
                        >
                          {ban.ban_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-300 text-sm max-w-[200px] truncate" title={ban.reason}>
                        {ban.reason}
                      </td>
                      <td className="px-4 py-3 text-surface-300 text-sm whitespace-nowrap">
                        {ban.expires_at ? formatDate(ban.expires_at) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {ban.is_active ? (
                          <Badge variant="error">Active</Badge>
                        ) : (
                          <Badge variant="default">Expired</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-300 text-sm">{userName(ban.banner)}</td>
                      <td className="px-4 py-3 text-surface-400 text-xs whitespace-nowrap">{timeAgo(ban.created_at)}</td>
                      <td className="px-4 py-3">
                        {ban.is_active && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => revokeBan(ban)}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                              Revoke
                            </button>
                            {ban.ban_type === 'temporary' && (
                              <button
                                onClick={() => { setExtendBan(ban); setExtendDays('7'); }}
                                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                              >
                                Extend
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Ban User Modal ── */}
      <Modal isOpen={showBanModal} onClose={closeBanModal} title="Ban User" size="md">
        <div className="p-6 space-y-4">
          {/* User search */}
          <div>
            <Input
              label="Search User"
              placeholder="Search by email or name…"
              value={banUserSearch}
              onChange={(e) => searchUsersForBan(e.target.value)}
            />
            {banUserResults.length > 0 && !selectedBanUser && (
              <div className="mt-2 border border-surface-800 rounded-lg bg-surface-950 max-h-48 overflow-y-auto">
                {banUserResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedBanUser(u); setBanUserResults([]); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-800 transition-colors text-left"
                  >
                    <Avatar src={u.avatar_url} name={u.display_name || u.full_name || u.email} size="sm" />
                    <div>
                      <p className="text-sm text-white">{u.display_name || u.full_name || u.email}</p>
                      <p className="text-xs text-surface-400">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedBanUser && (
              <div className="mt-2 flex items-center gap-3 p-3 bg-surface-800 rounded-lg">
                <Avatar src={selectedBanUser.avatar_url} name={selectedBanUser.display_name || selectedBanUser.email} size="sm" />
                <div className="flex-1">
                  <p className="text-sm text-white">{selectedBanUser.display_name || selectedBanUser.full_name || selectedBanUser.email}</p>
                  <p className="text-xs text-surface-400">{selectedBanUser.email}</p>
                </div>
                <button onClick={() => { setSelectedBanUser(null); setBanUserSearch(''); }} className="text-surface-400 hover:text-white">
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Ban type */}
          <Select
            label="Ban Type"
            options={BAN_TYPE_OPTIONS}
            value={banType}
            onChange={(e) => setBanType(e.target.value as any)}
          />

          {/* Duration (for temp bans) */}
          {banType === 'temporary' && (
            <Input
              label="Duration (days)"
              type="number"
              value={banDuration}
              onChange={(e) => setBanDuration(e.target.value)}
              min={1}
              max={365}
            />
          )}

          {/* Reason */}
          <Textarea
            label="Reason"
            placeholder="Why is this user being banned?"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeBanModal}>Cancel</Button>
            <Button
              variant="primary"
              onClick={submitBan}
              disabled={!selectedBanUser || !banReason.trim() || banSubmitting}
            >
              {banSubmitting ? 'Banning…' : 'Confirm Ban'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Extend Ban Modal ── */}
      <Modal isOpen={!!extendBan} onClose={() => setExtendBan(null)} title="Extend Ban" size="sm">
        <div className="p-6 space-y-4">
          {extendBan && (
            <>
              <p className="text-sm text-surface-300">
                Extending ban for <span className="text-white font-medium">{userName(extendBan.profiles)}</span>
              </p>
              <p className="text-xs text-surface-400">
                Current expiry: {extendBan.expires_at ? formatDate(extendBan.expires_at) : 'None'}
              </p>
              <Input
                label="Extend by (days)"
                type="number"
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
                min={1}
                max={365}
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setExtendBan(null)}>Cancel</Button>
                <Button variant="primary" onClick={submitExtendBan}>Extend</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
      </div>
    </div>
  );
}
