'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fillEmails } from '@/lib/private-profile';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { weekdayHourGrid } from '@/lib/admin/analytics';
import {
  ActionButton, AdminPage, BarList, Dialog, Dots, EmptyState, Field, Heatmap, PageHeader, Panel, Pill, Reveal,
  SearchInput, Segmented, StatGrid, TabSkeleton, Toolbar, TrendPanel, fieldClass, tally, SERIES, type Tone,
} from '@/components/admin/kit';

// Constants

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

const BAN_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'warning', label: 'Warning' },
  { value: 'temporary', label: 'Temporary Ban' },
  { value: 'permanent', label: 'Permanent Ban' },
];

const EVENT_TONE: Record<string, Tone> = {
  failed_login: 'red', password_changed: 'blue', email_changed: 'blue', suspicious_login: 'brand',
  rate_limited: 'amber', api_abuse: 'red', brute_force: 'red', account_locked: 'red',
  data_export: 'green', account_deletion: 'violet', admin_action: 'aqua', permission_change: 'amber',
};
const BAN_TONE: Record<string, Tone> = { permanent: 'red', temporary: 'amber', warning: 'blue' };
/** How far back the event and audit views load (filtered client-side from there). */
const HISTORY_DAYS = 90;
type DateRange = '24h' | '7d' | '30d' | 'all';

// Types

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


export default function SecurityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('events');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuickStats>({ events24h: 0, events7d: 0, events30d: 0, failedLogins: 0, rateLimits: 0, activeBans: 0 });

  // Security Events
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [eventDateRange, setEventDateRange] = useState<DateRange>('7d');
  const [refreshing, setRefreshing] = useState(false);
  const [banView, setBanView] = useState<'active' | 'all'>('active');
  const [eventUserSearch, setEventUserSearch] = useState('');

  // Audit Log
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditDateRange, setAuditDateRange] = useState<DateRange>('7d');

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

  // Auth Guard

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isFullAdmin(user.id, user.role)) {
      router.replace('/admin');
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Data Loading

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadEvents(), loadAudit(), loadBans()]);
    setLoading(false);
    setRefreshing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const historyCutoff = () => new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();

  // Load the last HISTORY_DAYS once; type/date/search filters apply instantly client-side.
  const loadEvents = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('security_events')
      .select('*, profiles!security_events_user_id_fkey(id, display_name, full_name, email, avatar_url)')
      .gte('created_at', historyCutoff())
      .order('created_at', { ascending: false })
      .limit(2000);
    // Emails come from profile_contact (staff can read all)
    await fillEmails(supabase, (data ?? []).map((e: { profiles?: { id?: string; email?: string | null } | null }) => e.profiles));
    setEvents((data ?? []) as SecurityEvent[]);
  };

  const loadAudit = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('audit_log')
      .select('*, profiles!audit_log_user_id_fkey(id, display_name, full_name, email, avatar_url)')
      .gte('created_at', historyCutoff())
      .order('created_at', { ascending: false })
      .limit(2000);
    await fillEmails(supabase, (data ?? []).map((e: { profiles?: { id?: string; email?: string | null } | null }) => e.profiles));
    setAuditEntries((data ?? []) as AuditEntry[]);
  };

  const loadBans = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('user_bans')
      .select('*, profiles!user_bans_user_id_fkey(id, display_name, full_name, email, avatar_url), banner:profiles!user_bans_banned_by_fkey(id, display_name, full_name, email)')
      .order('created_at', { ascending: false });
    await fillEmails(supabase, (data ?? []).flatMap((b: { profiles?: { id?: string; email?: string | null } | null; banner?: { id?: string; email?: string | null } | null }) => [b.profiles, b.banner]));
    setBans((data ?? []) as UserBan[]);
  };

  // Ban Actions

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

  // Helpers

  const userName = (p?: { display_name: string | null; full_name: string | null; email: string } | null) => {
    if (!p) return 'System';
    return p.display_name || p.full_name || p.email;
  };

  const truncateUA = (ua: string | null) => {
    if (!ua) return '—';
    return ua.length > 60 ? ua.substring(0, 60) + '…' : ua;
  };

  const inRange = (iso: string, range: DateRange) => {
    const cutoff = getDateCutoff(range);
    return !cutoff || iso >= cutoff;
  };

  const visibleEvents = useMemo(() => {
    const q = eventUserSearch.trim().toLowerCase();
    return events
      .filter(e => inRange(e.created_at, eventDateRange))
      .filter(e => !eventTypeFilter || e.event_type === eventTypeFilter)
      .filter(e => !q || `${e.profiles?.email || ''} ${e.profiles?.display_name || ''} ${e.profiles?.full_name || ''} ${e.ip_address || ''}`.toLowerCase().includes(q));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, eventDateRange, eventTypeFilter, eventUserSearch]);

  const visibleAudit = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    const act = auditActionFilter.trim().toLowerCase();
    return auditEntries
      .filter(e => inRange(e.created_at, auditDateRange))
      .filter(e => !act || e.action.toLowerCase().includes(act))
      .filter(e => !q || `${e.action} ${e.entity_type} ${e.entity_id || ''} ${e.profiles?.email || ''} ${e.profiles?.display_name || ''}`.toLowerCase().includes(q));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditEntries, auditDateRange, auditSearch, auditActionFilter]);

  // Render
  if (authLoading || loading) return <TabSkeleton />;

  const now = new Date().toISOString();
  const banLive = (b: UserBan) => b.is_active && (!b.expires_at || b.expires_at > now);
  const visibleBans = banView === 'active' ? bans.filter(banLive) : bans;
  const failed = events.filter(e => e.event_type === 'failed_login' || e.event_type === 'brute_force');
  const topIps = tally(visibleEvents.filter(e => e.ip_address), e => e.ip_address).slice(0, 8);
  const RANGE_OPTS: { key: DateRange; label: string }[] = [{ key: '24h', label: '24H' }, { key: '7d', label: '7D' }, { key: '30d', label: '30D' }, { key: 'all', label: `${HISTORY_DAYS}D` }];

  return (
    <AdminPage>
      <PageHeader
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Security & Audit"
        description="Security events, the audit trail, and user bans."
        meta={<>Events and audit entries cover the last {HISTORY_DAYS} days</>}
        actions={<ActionButton icon={<RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />} onClick={loadAll} disabled={refreshing}>Refresh</ActionButton>}
      />

      <StatGrid
        cols={6}
        layoutGroup="security"
        items={[
          { label: 'Events · 24h', value: stats.events24h, tone: 'blue', onClick: () => { setActiveTab('events'); setEventDateRange('24h'); setEventTypeFilter(''); }, active: activeTab === 'events' && eventDateRange === '24h' && !eventTypeFilter },
          { label: 'Events · 7d', value: stats.events7d, tone: 'aqua', onClick: () => { setActiveTab('events'); setEventDateRange('7d'); setEventTypeFilter(''); }, active: activeTab === 'events' && eventDateRange === '7d' && !eventTypeFilter },
          { label: 'Events · 30d', value: stats.events30d, tone: 'violet' },
          { label: 'Failed logins · 7d', value: stats.failedLogins, tone: 'red', onClick: () => { setActiveTab('events'); setEventDateRange('7d'); setEventTypeFilter('failed_login'); }, active: eventTypeFilter === 'failed_login' },
          { label: 'Rate limits · 7d', value: stats.rateLimits, tone: 'amber', onClick: () => { setActiveTab('events'); setEventDateRange('7d'); setEventTypeFilter('rate_limited'); }, active: eventTypeFilter === 'rate_limited' },
          { label: 'Active bans', value: stats.activeBans, tone: 'red', onClick: () => { setActiveTab('bans'); setBanView('active'); }, active: activeTab === 'bans' },
        ]}
      />

      {events.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-5">
          <TrendPanel
            id="security-events"
            stacked
            className="lg:col-span-3"
            title="Security events"
            subtitle={`Last ${HISTORY_DAYS} days, by kind`}
            defaultRange="30d"
            sources={[
              { key: 'failed', label: 'Failed / brute force', color: SERIES.red, rows: failed, time: e => e.created_at },
              { key: 'rate', label: 'Rate limited', color: SERIES.yellow, rows: events.filter(e => e.event_type === 'rate_limited'), time: e => e.created_at },
              { key: 'other', label: 'Other', color: SERIES.blue, rows: events.filter(e => !['failed_login', 'brute_force', 'rate_limited'].includes(e.event_type)), time: e => e.created_at },
            ]}
          />
          <Panel title="When failed logins happen" subtitle="Weekday × hour, UTC" className="lg:col-span-2">
            <Heatmap grid={weekdayHourGrid(failed.map(e => e.created_at))} label="failed logins" />
          </Panel>
        </div>
      )}

      <Reveal>
        <Segmented
          id="security-tab"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { key: 'events', label: <>Security events <span className="ml-1 text-surface-500">{visibleEvents.length}</span></> },
            { key: 'audit', label: <>Audit log <span className="ml-1 text-surface-500">{visibleAudit.length}</span></> },
            { key: 'bans', label: <>User bans <span className="ml-1 text-surface-500">{bans.filter(banLive).length}</span></> },
          ]}
        />
      </Reveal>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="space-y-4">
          {activeTab === 'events' && (
            <>
              <Toolbar>
                <SearchInput value={eventUserSearch} onChange={setEventUserSearch} placeholder="User email, name or IP…" />
                <select value={eventTypeFilter} onChange={e => setEventTypeFilter(e.target.value)} className={cn(fieldClass, 'w-auto py-2')} aria-label="Event type">
                  {EVENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <Segmented id="sec-event-range" size="sm" value={eventDateRange} onChange={setEventDateRange} options={RANGE_OPTS} />
              </Toolbar>
              <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="Events" subtitle={`${visibleEvents.length} matching`} className="xl:col-span-2" bodyClassName="p-0">
                  {visibleEvents.length === 0 ? (
                    <div className="p-5"><EmptyState title="No security events" description="Nothing matches these filters." /></div>
                  ) : (
                    <ul className="max-h-[640px] divide-y divide-surface-800/70 overflow-y-auto">
                      {visibleEvents.slice(0, 300).map((evt, i) => (
                        <motion.li key={evt.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.015 }} className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill tone={EVENT_TONE[evt.event_type] ?? 'neutral'} dot>{evt.event_type.replace(/_/g, ' ')}</Pill>
                            {evt.user_id ? (
                              <Link href={`/u/${evt.user_id}`} className="text-sm text-brand-400 hover:underline">{userName(evt.profiles)}</Link>
                            ) : <span className="text-sm text-surface-400">System</span>}
                            {evt.ip_address && (
                              <button onClick={() => setEventUserSearch(evt.ip_address!)} className="font-mono text-xs text-surface-400 hover:text-white" title="Filter by this IP">{evt.ip_address}</button>
                            )}
                            <span className="ml-auto text-[11px] text-surface-500" title={formatDate(evt.created_at)}>{timeAgo(evt.created_at)}</span>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-surface-600" title={evt.user_agent ?? ''}>{truncateUA(evt.user_agent)}</p>
                          {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                            <code className="mt-1 block truncate rounded bg-surface-950 px-1.5 py-0.5 text-[11px] text-surface-400">{JSON.stringify(evt.metadata)}</code>
                          )}
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <div className="space-y-5">
                  <Panel title="By type" subtitle="In the current view"><BarList items={tally(visibleEvents, e => e.event_type)} color={SERIES.red} limit={7} /></Panel>
                  <Panel title="Top IP addresses" subtitle="Click one to filter">
                    {topIps.length === 0 ? <p className="py-4 text-center text-xs text-surface-600">No IPs recorded</p> : (
                      <ul className="space-y-1">
                        {topIps.map(ip => (
                          <li key={ip.label}>
                            <button onClick={() => setEventUserSearch(ip.label)} className="flex w-full items-center justify-between rounded-lg px-2 py-1 font-mono text-xs text-surface-300 hover:bg-surface-800/60">
                              {ip.label}<span className="font-sans font-semibold text-white">{ip.count}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </div>
              </div>
            </>
          )}

          {activeTab === 'audit' && (
            <>
              <Toolbar>
                <SearchInput value={auditSearch} onChange={setAuditSearch} placeholder="Action, entity, user…" />
                <input value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)} placeholder="Action contains… e.g. ban_user" className={cn(fieldClass, 'w-auto py-2')} />
                <Segmented id="sec-audit-range" size="sm" value={auditDateRange} onChange={setAuditDateRange} options={RANGE_OPTS} />
              </Toolbar>
              <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="Audit trail" subtitle={`${visibleAudit.length} entries`} className="xl:col-span-2" bodyClassName="p-0">
                  {visibleAudit.length === 0 ? (
                    <div className="p-5"><EmptyState title="No audit entries" /></div>
                  ) : (
                    <ol className="relative max-h-[640px] overflow-y-auto px-5 py-3">
                      <span className="absolute bottom-3 left-[27px] top-3 w-px bg-surface-800" aria-hidden />
                      {visibleAudit.slice(0, 300).map((entry, i) => (
                        <motion.li key={entry.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 20) * 0.015 }} className="relative flex gap-3 py-2">
                          <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-surface-900 bg-brand-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white">
                              {entry.user_id ? <Link href={`/u/${entry.user_id}`} className="font-medium text-brand-400 hover:underline">{userName(entry.profiles)}</Link> : <span className="text-surface-400">System</span>}{' '}
                              <code className="rounded bg-surface-800 px-1.5 py-0.5 text-xs text-surface-200">{entry.action}</code>{' '}
                              <span className="text-surface-400">{entry.entity_type}</span>{' '}
                              {entry.entity_id && <span className="font-mono text-[11px] text-surface-600" title={entry.entity_id}>{entry.entity_id.slice(0, 8)}</span>}
                            </p>
                            <p className="text-[11px] text-surface-500">
                              {formatDate(entry.created_at)} · {timeAgo(entry.created_at)}{entry.ip_address && <> · <span className="font-mono">{entry.ip_address}</span></>}
                            </p>
                            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                              <code className="mt-1 block truncate rounded bg-surface-950 px-1.5 py-0.5 text-[11px] text-surface-400">{JSON.stringify(entry.metadata)}</code>
                            )}
                          </div>
                        </motion.li>
                      ))}
                    </ol>
                  )}
                </Panel>
                <div className="space-y-5">
                  <Panel title="Most common actions"><BarList items={tally(visibleAudit, e => e.action)} color={SERIES.aqua} limit={8} labelFormat={l => <code className="normal-case">{l}</code>} /></Panel>
                  <Panel title="Most active people"><BarList items={tally(visibleAudit, e => userName(e.profiles))} color={SERIES.blue} limit={6} labelFormat={l => <span className="normal-case">{l}</span>} /></Panel>
                </div>
              </div>
            </>
          )}

          {activeTab === 'bans' && (
            <>
              <Toolbar>
                <Segmented id="sec-ban-view" size="sm" value={banView} onChange={setBanView} options={[{ key: 'active', label: 'In effect' }, { key: 'all', label: 'All' }]} />
                <span className="text-xs text-surface-500">{visibleBans.length} shown</span>
                <ActionButton variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setShowBanModal(true)} className="sm:ml-auto">Ban user</ActionButton>
              </Toolbar>
              {visibleBans.length === 0 ? (
                <EmptyState icon={<ShieldCheck className="h-8 w-8 text-emerald-500/60" />} title="No bans" description={banView === 'active' ? 'Nobody is currently banned.' : undefined} />
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  <AnimatePresence initial={false}>
                    {visibleBans.map(ban => {
                      const live = banLive(ban);
                      return (
                        <motion.li
                          key={ban.id}
                          layout="position"
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: live ? 1 : 0.55, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          className={cn('rounded-2xl border p-4', live ? 'border-surface-800 bg-surface-900/60' : 'border-surface-800/60 bg-surface-900/30')}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar src={ban.profiles?.avatar_url} name={userName(ban.profiles)} size="sm" />
                            <div className="min-w-0 flex-1">
                              <Link href={`/u/${ban.user_id}`} className="block truncate text-sm font-medium text-white hover:text-brand-300">{userName(ban.profiles)}</Link>
                              <p className="truncate text-xs text-surface-500">{ban.profiles?.email}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Pill tone={BAN_TONE[ban.ban_type] ?? 'neutral'} dot>{ban.ban_type}</Pill>
                              <Pill tone={live ? 'red' : 'neutral'}>{live ? 'In effect' : ban.is_active ? 'Expired' : 'Revoked'}</Pill>
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-surface-300">{ban.reason}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-surface-500">
                            <span>By {userName(ban.banner)}</span>
                            <span>· {timeAgo(ban.created_at)}</span>
                            {ban.expires_at && <span>· {ban.expires_at > now ? 'Ends' : 'Ended'} {formatDate(ban.expires_at)}</span>}
                            {live && (
                              <span className="ml-auto flex gap-1.5">
                                {ban.ban_type === 'temporary' && <ActionButton variant="ghost" onClick={() => { setExtendBan(ban); setExtendDays('7'); }}>Extend</ActionButton>}
                                <ActionButton variant="danger" onClick={() => revokeBan(ban)}>Revoke</ActionButton>
                              </span>
                            )}
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <Dialog
        open={showBanModal}
        onClose={closeBanModal}
        title="Ban user"
        footer={
          <>
            <ActionButton variant="ghost" onClick={closeBanModal}>Cancel</ActionButton>
            <ActionButton variant="danger" onClick={submitBan} disabled={!selectedBanUser || !banReason.trim() || banSubmitting}>
              {banSubmitting ? <>Banning <Dots /></> : 'Confirm ban'}
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="User">
            {selectedBanUser ? (
              <div className="flex items-center gap-3 rounded-xl bg-surface-800 p-3">
                <Avatar src={selectedBanUser.avatar_url} name={selectedBanUser.display_name || selectedBanUser.email} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{selectedBanUser.display_name || selectedBanUser.full_name || selectedBanUser.email}</p>
                  <p className="truncate text-xs text-surface-400">{selectedBanUser.email}</p>
                </div>
                <button onClick={() => { setSelectedBanUser(null); setBanUserSearch(''); }} className="rounded p-1 text-surface-400 hover:text-white" aria-label="Clear user"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <input autoFocus value={banUserSearch} onChange={e => searchUsersForBan(e.target.value)} placeholder="Search by email or name…" className={fieldClass} />
                {banUserResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-surface-800 bg-surface-950">
                    {banUserResults.map(u => (
                      <button key={u.id} onClick={() => { setSelectedBanUser(u); setBanUserResults([]); }} className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-800">
                        <Avatar src={u.avatar_url} name={u.display_name || u.full_name || u.email} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">{u.display_name || u.full_name || u.email}</p>
                          <p className="truncate text-xs text-surface-400">{u.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Field>
          <Field label="Type">
            <Segmented id="ban-type" value={banType} onChange={setBanType} options={BAN_TYPE_OPTIONS.map(o => ({ key: o.value, label: o.label }))} />
          </Field>
          {banType === 'temporary' && (
            <Field label="Duration (days)">
              <input type="number" value={banDuration} onChange={e => setBanDuration(e.target.value)} min={1} max={365} className={cn(fieldClass, 'w-32')} />
            </Field>
          )}
          <Field label="Reason">
            <textarea value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Why is this user being banned?" rows={3} className={fieldClass} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={!!extendBan}
        onClose={() => setExtendBan(null)}
        title="Extend ban"
        size="sm"
        footer={
          <>
            <ActionButton variant="ghost" onClick={() => setExtendBan(null)}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={submitExtendBan}>Extend</ActionButton>
          </>
        }
      >
        {extendBan && (
          <div className="space-y-3">
            <p className="text-sm text-surface-300">Extending the ban for <span className="font-medium text-white">{userName(extendBan.profiles)}</span>.</p>
            <p className="text-xs text-surface-500">Current expiry: {extendBan.expires_at ? formatDate(extendBan.expires_at) : 'None'}</p>
            <Field label="Extend by (days)">
              <input type="number" value={extendDays} onChange={e => setExtendDays(e.target.value)} min={1} max={365} className={cn(fieldClass, 'w-32')} />
            </Field>
          </div>
        )}
      </Dialog>
    </AdminPage>
  );
}
