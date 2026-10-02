'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Mail, Send, TriangleAlert, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fillEmails } from '@/lib/private-profile';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import {
  ActionButton, AdminPage, AnimatedNumber, BarList, Dialog, Dots, EmptyState, Field, Meter, PageHeader, Panel, Pill,
  SearchInput, Segmented, StatGrid, TabSkeleton, TrendPanel, fieldClass, tally, SERIES,
} from '@/components/admin/kit';
import { sendNotificationEmailAction } from '@/lib/email-actions';

const EMAIL_TEMPLATES = [
  { id: '', label: 'Custom (blank)' },
  { id: 'welcome', label: 'Welcome', subject: "You're in — Screenplay Studio", heading: 'Welcome!', body: "Hey {name},\n\nGlad you signed up. You've got a blank dashboard waiting — go create a project and start writing.\n\nEverything's free. No limits, no paywalls. Just write.\n\nIf you hit anything weird or have ideas, reply to this email. I read every one.\n\n— Sondre", ctaLabel: 'Start Writing', ctaUrl: '/dashboard' },
  { id: 'blog', label: 'Blog Post', subject: 'New post: {title}', heading: 'New on the blog', body: '{title}\n\n{excerpt}\n\nRead the full post below.', ctaLabel: 'Read Post', ctaUrl: '/blog/{slug}' },
  { id: 'poll', label: 'Poll', subject: 'New poll: {question}', heading: 'Vote now', body: '{question}\n\n{description}\n\nCast your vote — it takes 10 seconds.', ctaLabel: 'Vote', ctaUrl: '/polls/{id}' },
  { id: 'challenge', label: 'Challenge', subject: 'New challenge: {title}', heading: 'Challenge time', body: '{title}\n\n{description}\n\nDeadline: {deadline}. Show us what you\'ve got.', ctaLabel: 'Join Challenge', ctaUrl: '/community/challenges/{id}' },
  { id: 'digest', label: 'Weekly Digest', subject: 'Your weekly writing digest', heading: 'This week in your scripts', body: "Here's how your writing week went:\n\n{words} words written\n{pages} pages\n{scenes} scenes created\n{project} was your most active project\n\n{streak_info}", ctaLabel: 'Keep Writing', ctaUrl: '/dashboard' },
  { id: 'feature', label: 'Feature Announcement', subject: 'New feature: {name}', heading: 'Just shipped', body: '{name}\n\n{description}', ctaLabel: 'Check it out', ctaUrl: '/dashboard' },
  { id: 'changelog', label: 'Changelog', subject: "What's new — v{version}", heading: 'Release notes', body: "Here's what changed:\n\n{changes}", ctaLabel: 'View Changelog', ctaUrl: '/changelog' },
  { id: 'reengagement', label: 'Re-engagement', subject: 'We miss you — Screenplay Studio', heading: 'Come back to your story', body: "Hey {name},\n\nIt's been a while since you last visited. Your projects are still here, waiting for you.\n\nWhether you're mid-draft or just starting out, there's always room for one more scene.", ctaLabel: 'Continue Writing', ctaUrl: '/dashboard' },
  { id: 'feedback', label: 'Script Feedback', subject: '{reviewer} left feedback on "{script}"', heading: 'New feedback', body: '{reviewer} left {count} comments on your script {script}.', ctaLabel: 'View Feedback', ctaUrl: '/projects/{id}/script' },
  { id: 'invite', label: 'Project Invite', subject: '{inviter} invited you to "{project}"', heading: "You've been invited!", body: '{inviter} has invited you to join the project {project}. Open the project to start collaborating.', ctaLabel: 'Open Project', ctaUrl: '/projects/{id}' },
  { id: 'badge', label: 'Badge Earned', subject: 'You earned: {badge}', heading: 'Badge unlocked', body: "You just earned the {badge} badge.\n\n{description}\n\nCheck your profile to see it displayed.", ctaLabel: 'View Profile', ctaUrl: '/settings' },
  { id: 'correction', label: 'Correction / Apology', subject: 'Quick correction', heading: 'Oops, wrong link', body: "Hey {name},\n\nThe last email had a broken link. Sorry about that — here's the correct one.", ctaLabel: 'Go to Screenplay Studio', ctaUrl: '/dashboard' },
];

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
const isFullAdmin = (id?: string, role?: string) => id === ADMIN_UID || role === 'admin';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  is_pro: boolean;
  created_at: string;
  last_seen: string | null;
}

interface EmailLogEntry {
  id: string;
  date: string;
  subject: string;
  recipientCount: number;
  sentBy: string;
}

type SendTab = 'all' | 'filtered' | 'specific';

interface EmailBatch {
  id: string;
  subject: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  batch_size: number;
  created_at: string;
}

const DAY_MS = 86_400_000;
/** Days since the user was last seen (falls back to signup date). */
const daysIdle = (u: UserProfile) => (Date.now() - new Date(u.last_seen || u.created_at || 0).getTime()) / DAY_MS;

function getStoredEmailLog(): EmailLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('email_log');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function storeEmailLog(log: EmailLogEntry[]) {
  try {
    localStorage.setItem('email_log', JSON.stringify(log));
  } catch {}
}

export default function AdminEmailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SendTab>('all');

  const [proFilter, setProFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [lastLoginFilter, setLastLoginFilter] = useState('any');
  const [hasProjectsFilter, setHasProjectsFilter] = useState('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const [subject, setSubject] = useState('');
  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [emailLog, setEmailLog] = useState<EmailLogEntry[]>([]);
  const [batches, setBatches] = useState<EmailBatch[]>([]);
  const [userProjectCounts, setUserProjectCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isFullAdmin(user.id, user.role)) {
      router.replace('/dashboard');
      return;
    }
    loadUsers();
    setEmailLog(getStoredEmailLog());
    loadBatches();
  }, [user, authLoading, router]);

  const loadUsers = async () => {
    try {
      const supabase = createClient();
      // Page past PostgREST's 1000-row cap so bulk sends reach everyone
      const [data, projectsData] = await Promise.all([
        fetchAll<UserProfile>(() => supabase.from('profiles').select('id, email, full_name, display_name, avatar_url, role, is_pro, created_at, last_seen')),
        fetchAll<{ id: string; created_by: string }>(() => supabase.from('projects').select('id, created_by')).catch(() => []),
      ]);
      await fillEmails(supabase, data);
      setUsers(data);
      const counts: Record<string, number> = {};
      for (const p of projectsData) counts[p.created_by] = (counts[p.created_by] || 0) + 1;
      setUserProjectCounts(counts);
    } catch (err) {
      console.error('Error loading users:', err);
      toast.error('Failed to load users: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('email_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      setBatches(data || []);
    } catch {}
  };

  const filteredUsers = useCallback(() => {
    let result = users;

    if (activeTab === 'filtered') {
      if (proFilter === 'pro') result = result.filter(u => u.is_pro);
      else if (proFilter === 'free') result = result.filter(u => !u.is_pro);

      if (roleFilter !== 'all') result = result.filter(u => u.role === roleFilter);

      if (lastLoginFilter !== 'any') {
        result = result.filter(u => {
          const daysSince = daysIdle(u);
          if (lastLoginFilter === '7d') return daysSince <= 7;
          if (lastLoginFilter === '30d') return daysSince <= 30;
          if (lastLoginFilter === '30d_inactive') return daysSince > 30 && daysSince <= 90;
          if (lastLoginFilter === '90d_dormant') return daysSince > 90;
          return true;
        });
      }

      if (hasProjectsFilter === 'yes') result = result.filter(u => (userProjectCounts[u.id] || 0) > 0);
      else if (hasProjectsFilter === 'no') result = result.filter(u => (userProjectCounts[u.id] || 0) === 0);
    }

    if (activeTab === 'specific' && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.display_name || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [users, activeTab, proFilter, roleFilter, lastLoginFilter, hasProjectsFilter, searchQuery, userProjectCounts]);

  const targetUsers = filteredUsers();

  const toggleUserSelection = (id: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const visibleIds = targetUsers.map(u => u.id);
    setSelectedUserIds(prev => {
      if (visibleIds.every(id => prev.has(id))) return new Set();
      return new Set(visibleIds);
    });
  };

  const getRecipientUserIds = (): UserProfile[] => {
    if (activeTab === 'all') return users;
    if (activeTab === 'filtered') return targetUsers;
    return users.filter(u => selectedUserIds.has(u.id));
  };


  const handleSend = async () => {
    if (!subject.trim() || !heading.trim() || !body.trim()) {
      toast.error('Subject, heading, and body are required');
      return;
    }
    const recipients = getRecipientUserIds();
    if (recipients.length === 0) {
      toast.error('No recipients to send to');
      return;
    }

    setShowConfirm(false);
    setSending(true);
    setSendProgress({ sent: 0, total: recipients.length });

    if (recipients.length === 1) {
      const r = recipients[0];
      const name = r.full_name || r.display_name || 'there';
      const vars: Record<string, string> = { name, email: r.email };
      const replace = (s: string) => Object.entries(vars).reduce((str, [k, v]) => str.replaceAll(`{${k}}`, v), s);
      const result = await sendNotificationEmailAction(
        r.email,
        name,
        replace(subject),
        replace(heading),
        replace(body),
        ctaLabel ? replace(ctaLabel) : undefined,
        ctaUrl ? replace(ctaUrl) : undefined,
      );
      setSendProgress({ sent: 1, total: 1 });
      if (result.success) {
        toast.success('Email sent!');
        logEmail(1);
      } else {
        toast.error(result.error || 'Failed to send email');
      }
    } else if (activeTab === 'all') {
      // Use batch system for "send to all" — 100 per day to stay under limits
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/email/batches/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            userIds: recipients.map(u => u.id),
            subject,
            heading,
            body,
            ctaLabel: ctaLabel || undefined,
            ctaUrl: ctaUrl || undefined,
            batchSize: 80,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setSendProgress({ sent: 0, total: recipients.length });
          toast.success(`Batch created! ${recipients.length} emails will be sent over ~${data.estimatedDays} day(s) (100/day).`);
          logEmail(0);
        } else {
          toast.error(data.error || 'Bulk send failed');
        }
      } catch (err) {
        console.error('Bulk send error:', err);
        toast.error('Failed to send emails');
      }
    } else {
      // Filtered or specific users — send immediately via API
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            userIds: recipients.map(u => u.id),
            subject,
            heading,
            body,
            ctaLabel: ctaLabel || undefined,
            ctaUrl: ctaUrl || undefined,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          const sent = data.sent || recipients.length;
          setSendProgress({ sent, total: recipients.length });
          toast.success(`Emails sent to ${sent} users!`);
          logEmail(sent);
        } else {
          toast.error(data.error || 'Failed to send');
        }
      } catch (err) {
        console.error('Send error:', err);
        toast.error('Failed to send emails');
      }
    }

    setSending(false);
  };

  const logEmail = (recipientCount: number) => {
    const entry: EmailLogEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      subject,
      recipientCount,
      sentBy: user?.email || 'Admin',
    };
    const updated = [entry, ...emailLog];
    setEmailLog(updated);
    storeEmailLog(updated);
  };

  const roles = useMemo(() => Array.from(new Set(users.map(u => u.role).filter(Boolean))).sort(), [users]);
  const audience = useMemo(() => {
    const a = { pro: 0, active7: 0, active30: 0, dormant: 0, withProjects: 0 };
    users.forEach(u => {
      const d = daysIdle(u);
      if (u.is_pro) a.pro++;
      if (d <= 7) a.active7++;
      if (d <= 30) a.active30++;
      if (d > 90) a.dormant++;
      if ((userProjectCounts[u.id] || 0) > 0) a.withProjects++;
    });
    return a;
  }, [users, userProjectCounts]);

  if (authLoading || loading) return <TabSkeleton />;
  if (!user || !isFullAdmin(user.id, user.role)) return null;

  const recipients = getRecipientUserIds();
  const canSend = subject.trim() && heading.trim() && body.trim() && !sending;
  const previewUser = recipients[0] || users[0];
  const previewName = previewUser?.full_name || previewUser?.display_name || 'there';
  const vars: Record<string, string> = { name: previewName, email: previewUser?.email || 'user@example.com' };
  const fill = (str: string) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), str);
  const unfilled = Array.from(new Set(`${subject} ${heading} ${body} ${ctaLabel} ${ctaUrl}`.match(/\{[a-z_]+\}/g) || [])).filter(t => t !== '{name}' && t !== '{email}');
  const pendingBatches = batches.filter(b => b.status === 'pending');
  const sentTotal = emailLog.reduce((sum, e) => sum + e.recipientCount, 0) + batches.reduce((sum, b) => sum + (b.sent_count || 0), 0);

  const applyTemplate = (id: string) => {
    const tpl = EMAIL_TEMPLATES.find(t => t.id === id);
    setSelectedTemplate(id);
    setSubject(tpl?.subject || '');
    setHeading(tpl?.heading || '');
    setBody(tpl?.body || '');
    setCtaLabel(tpl?.ctaLabel || '');
    setCtaUrl(tpl?.ctaUrl || '');
  };

  const emailPreview = (
    <div className="mx-auto max-w-lg rounded-xl bg-white p-7 text-left shadow-inner">
      <p className="mb-3 border-b border-gray-200 pb-2 text-[11px] text-gray-500"><span className="font-semibold text-gray-700">Subject:</span> {fill(subject) || '—'}</p>
      <h1 className="mb-4 text-xl font-bold text-gray-900">{fill(heading) || 'Email heading'}</h1>
      <div className="mb-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-700" dangerouslySetInnerHTML={{ __html: fill(body) || 'Email body content will appear here.' }} />
      {ctaLabel && (
        <div className="text-center">
          <span className="inline-block rounded-lg bg-brand-500 px-6 py-3 text-sm font-bold text-white">{fill(ctaLabel)}</span>
        </div>
      )}
      <p className="mt-8 border-t border-gray-200 pt-4 text-center text-[11px] text-gray-400">Sent via Screenplay Studio</p>
    </div>
  );

  return (
    <AdminPage>
      <PageHeader
        icon={<Mail className="h-5 w-5" />}
        title="Email"
        description="Compose, target and send emails to users."
        meta={<>{users.length.toLocaleString()} users loaded · {pendingBatches.length} batch{pendingBatches.length === 1 ? '' : 'es'} in progress</>}
      />

      <StatGrid
        cols={5}
        items={[
          { label: 'Reachable users', value: users.length, tone: 'brand' },
          { label: 'Active · 7 days', value: audience.active7, tone: 'green', hint: 'Seen in the last 7 days' },
          { label: 'Active · 30 days', value: audience.active30, tone: 'aqua', hint: 'Seen in the last 30 days' },
          { label: 'Dormant · 90+ days', value: audience.dormant, tone: 'amber', hint: 'Not seen for over 90 days — re-engagement candidates' },
          { label: 'Emails sent', value: sentTotal, tone: 'blue', hint: 'From this browser’s history plus batch sends' },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <TrendPanel
          id="email-signups"
          className="lg:col-span-3"
          title="Audience growth"
          subtitle="New users who can receive email"
          defaultRange="90d"
          sources={[{ key: 'signups', label: 'New users', rows: users, time: u => u.created_at }]}
        />
        <Panel title="Audience mix" subtitle="Who you’d be talking to" className="lg:col-span-2">
          <div className="space-y-3">
            {[
              { label: 'Pro', value: audience.pro, color: SERIES.yellow },
              { label: 'Has projects', value: audience.withProjects, color: SERIES.orange },
              { label: 'Active in 30 days', value: audience.active30, color: SERIES.aqua },
            ].map(x => (
              <div key={x.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-surface-300">{x.label}</span>
                  <span className="tabular-nums text-surface-400"><span className="font-semibold text-white">{x.value.toLocaleString()}</span> · {users.length ? Math.round((x.value / users.length) * 100) : 0}%</span>
                </div>
                <Meter value={x.value} max={users.length || 1} color={x.color} />
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-surface-800 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">By role</p>
            <BarList items={tally(users, u => u.role)} limit={4} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Audience + composer */}
        <div className="space-y-5">
          <Panel
            title={<span className="flex items-center gap-2"><Users className="h-4 w-4 text-brand-400" />Recipients</span>}
            action={
              <Segmented
                id="email-audience"
                size="sm"
                value={activeTab}
                onChange={setActiveTab}
                options={[{ key: 'all', label: 'Everyone' }, { key: 'filtered', label: 'Segment' }, { key: 'specific', label: 'Pick users' }]}
              />
            }
          >
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                {activeTab === 'all' && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-sm text-amber-200">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Sends to <strong>{users.length.toLocaleString()}</strong> users in daily batches (about 100 per day, ~{Math.max(1, Math.ceil(users.length / 80))} day{users.length > 80 ? 's' : ''}). Check the preview first.</span>
                  </div>
                )}

                {activeTab === 'filtered' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Plan">
                        <select value={proFilter} onChange={e => setProFilter(e.target.value)} className={fieldClass}>
                          <option value="all">Everyone</option>
                          <option value="pro">Pro only</option>
                          <option value="free">Free only</option>
                        </select>
                      </Field>
                      <Field label="Role">
                        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={fieldClass}>
                          <option value="all">All roles</option>
                          {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </Field>
                      <Field label="Last active">
                        <select value={lastLoginFilter} onChange={e => setLastLoginFilter(e.target.value)} className={fieldClass}>
                          <option value="any">Any time</option>
                          <option value="7d">Within 7 days</option>
                          <option value="30d">Within 30 days</option>
                          <option value="30d_inactive">31–90 days ago (inactive)</option>
                          <option value="90d_dormant">90+ days ago (dormant)</option>
                        </select>
                      </Field>
                      <Field label="Projects">
                        <select value={hasProjectsFilter} onChange={e => setHasProjectsFilter(e.target.value)} className={fieldClass}>
                          <option value="all">Any</option>
                          <option value="yes">Has projects</option>
                          <option value="no">No projects</option>
                        </select>
                      </Field>
                    </div>
                    <div className="flex items-center gap-3 border-t border-surface-800 pt-3">
                      <AnimatedNumber value={targetUsers.length} className="text-2xl font-bold text-white" />
                      <span className="text-sm text-surface-400">users match ({users.length ? Math.round((targetUsers.length / users.length) * 100) : 0}% of everyone)</span>
                    </div>
                  </div>
                )}

                {activeTab === 'specific' && (
                  <div className="space-y-3">
                    <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by name or email…" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-surface-500"><span className="font-bold text-white">{selectedUserIds.size}</span> selected</span>
                      <button onClick={toggleAllVisible} className="font-medium text-brand-400 hover:underline">
                        {targetUsers.length > 0 && targetUsers.every(u => selectedUserIds.has(u.id)) ? 'Deselect all visible' : 'Select all visible'}
                      </button>
                    </div>
                    <div className="max-h-[320px] space-y-1 overflow-y-auto rounded-xl border border-surface-800 bg-surface-950/50 p-1.5">
                      {targetUsers.length === 0 && <p className="py-8 text-center text-sm text-surface-500">{searchQuery ? 'No users match your search' : 'No users found'}</p>}
                      {targetUsers.slice(0, 300).map(u => (
                        <label
                          key={u.id}
                          className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors', selectedUserIds.has(u.id) ? 'border-brand-500/30 bg-brand-500/10' : 'border-transparent hover:bg-surface-800/60')}
                        >
                          <input type="checkbox" checked={selectedUserIds.has(u.id)} onChange={() => toggleUserSelection(u.id)} className="accent-brand-500" />
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-700 text-[11px] text-surface-300">
                            {(u.display_name || u.full_name || u.email)?.[0]?.toUpperCase() || '?'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-white">{u.display_name || u.full_name || 'No name'}</span>
                            <span className="block truncate text-[11px] text-surface-500">{u.email}</span>
                          </span>
                          {u.is_pro && <Pill tone="amber">Pro</Pill>}
                          <span className="shrink-0 text-[11px] text-surface-600">{userProjectCounts[u.id] || 0} proj</span>
                        </label>
                      ))}
                      {targetUsers.length > 300 && <p className="py-2 text-center text-[11px] text-surface-600">Showing 300 of {targetUsers.length.toLocaleString()} — refine the search</p>}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </Panel>

          <Panel
            title="Compose"
            action={
              <select value={selectedTemplate} onChange={e => applyTemplate(e.target.value)} className={cn(fieldClass, 'w-auto py-1.5 text-xs')} aria-label="Template">
                {EMAIL_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            }
          >
            <div className="space-y-3">
              <Field label="Subject">
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject line…" className={fieldClass} />
              </Field>
              <Field label="Heading">
                <input value={heading} onChange={e => setHeading(e.target.value)} placeholder="Heading shown in the email…" className={fieldClass} />
              </Field>
              <Field label="Body" hint="(HTML supported · {name} and {email} are filled per recipient)">
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Email body content…" className={cn(fieldClass, 'font-mono text-xs')} />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Button label" hint="(optional)">
                  <input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="e.g. Open app" className={fieldClass} />
                </Field>
                <Field label="Button URL" hint="(optional)">
                  <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://…" className={fieldClass} />
                </Field>
              </div>
              {unfilled.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Placeholders still to replace: {unfilled.join(', ')}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <ActionButton variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setShowPreview(true)} disabled={!subject && !heading && !body} className="xl:hidden">Preview</ActionButton>
                <ActionButton
                  variant="primary"
                  icon={<Send className="h-4 w-4" />}
                  onClick={() => {
                    if (recipients.length === 0) { toast.error('No recipients selected'); return; }
                    setShowConfirm(true);
                  }}
                  disabled={!canSend || recipients.length === 0}
                >
                  {sending ? <>Sending <Dots /></> : `Send to ${recipients.length.toLocaleString()} user${recipients.length === 1 ? '' : 's'}`}
                </ActionButton>
              </div>
            </div>
          </Panel>
        </div>

        {/* Live preview (desktop) */}
        <Panel title="Live preview" subtitle={`As ${previewName}${previewUser?.email ? ` (${previewUser.email})` : ''}`} className="hidden xl:block" bodyClassName="sticky top-4">
          <div className="rounded-xl bg-surface-950/60 p-4">{emailPreview}</div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Batches" subtitle="Bulk sends go out in daily batches via cron">
          {batches.length === 0 ? (
            <EmptyState title="No batches yet" description="Sending to everyone creates a batch here." />
          ) : (
            <ul className="space-y-3">
              {batches.map((b, i) => {
                const done = (b.sent_count || 0) + (b.failed_count || 0);
                const progress = b.total_recipients > 0 ? (done / b.total_recipients) * 100 : 0;
                const daysLeft = b.batch_size > 0 ? Math.ceil((b.total_recipients - done) / b.batch_size) : 0;
                return (
                  <motion.li key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-xl border border-surface-800 p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{b.subject}</p>
                        <p className="text-[11px] text-surface-500">{timeAgo(b.created_at)} · {b.total_recipients.toLocaleString()} recipients</p>
                      </div>
                      <Pill tone={b.status === 'completed' ? 'green' : b.status === 'pending' ? 'amber' : 'neutral'} dot>
                        {b.status === 'completed' ? 'Done' : b.status === 'pending' ? `${daysLeft}d left` : b.status}
                      </Pill>
                    </div>
                    <Meter value={progress} color={b.status === 'completed' ? '#22c55e' : SERIES.blue} />
                    <p className="mt-1 text-[11px] text-surface-500">{b.sent_count} sent · {b.failed_count} failed · {b.total_recipients - done} remaining</p>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="History" subtitle="Sends from this browser">
          {emailLog.length === 0 ? (
            <EmptyState title="No emails sent yet" />
          ) : (
            <ul className="divide-y divide-surface-800">
              {emailLog.slice(0, 20).map(entry => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{entry.subject}</p>
                    <p className="text-[11px] text-surface-500">{timeAgo(entry.date)} · {entry.sentBy}</p>
                  </div>
                  <Pill tone="brand">{entry.recipientCount === 0 ? 'batched' : entry.recipientCount.toLocaleString()}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={showPreview} onClose={() => setShowPreview(false)} title={`Preview — ${previewName}`} size="lg">
        {emailPreview}
        <p className="mt-4 text-center text-xs text-surface-500">{'{name}'} and {'{email}'} are replaced per recipient.</p>
      </Dialog>

      <Dialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm send"
        size="sm"
        footer={
          <>
            <ActionButton variant="ghost" onClick={() => setShowConfirm(false)} disabled={sending}>Cancel</ActionButton>
            <ActionButton variant="primary" icon={<Send className="h-4 w-4" />} onClick={handleSend} disabled={sending}>{sending ? <>Sending <Dots /></> : 'Send now'}</ActionButton>
          </>
        }
      >
        <p className="text-sm text-surface-300">
          You’re about to email <span className="font-bold text-white">{recipients.length.toLocaleString()}</span> user{recipients.length === 1 ? '' : 's'}.
        </p>
        <div className="mt-3 space-y-1 rounded-xl bg-surface-950/60 p-3 text-xs text-surface-400">
          <p><span className="font-medium text-surface-200">Subject:</span> {subject}</p>
          <p><span className="font-medium text-surface-200">Heading:</span> {heading}</p>
          {ctaLabel && <p><span className="font-medium text-surface-200">Button:</span> {ctaLabel}</p>}
        </div>
      </Dialog>

      <AnimatePresence>
        {sending && sendProgress.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-surface-700 bg-surface-900 px-5 py-3 shadow-2xl"
          >
            <Send className="h-4 w-4 text-brand-400" />
            <div>
              <p className="text-sm font-bold text-white">Sending emails <Dots /></p>
              <p className="text-xs text-surface-400">{sendProgress.sent} / {sendProgress.total} sent</p>
            </div>
            <div className="w-32"><Meter value={sendProgress.sent} max={sendProgress.total} color={SERIES.blue} /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminPage>
  );
}
