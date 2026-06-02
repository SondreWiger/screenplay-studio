'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Textarea, Modal, Select, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
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
  const [batches, setBatches] = useState<any[]>([]);
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
      const { data, error } = await supabase.from('profiles').select('id, email, full_name, display_name, avatar_url, role, is_pro, created_at');
      if (error) {
        console.error('Profiles query error:', error.message, error);
        toast.error('Failed to load users: ' + error.message);
        setUsers([]);
      } else {
        setUsers((data || []) as UserProfile[]);
        if (!data || data.length === 0) {
          console.warn('Profiles query returned 0 rows');
        }
      }

      const { data: projectsData, error: projErr } = await supabase.from('projects').select('created_by');
      if (projErr) console.error('Projects query error:', projErr.message);
      const counts: Record<string, number> = {};
      for (const p of projectsData || []) {
        counts[p.created_by] = (counts[p.created_by] || 0) + 1;
      }
      setUserProjectCounts(counts);
    } catch (err) {
      console.error('Error loading users:', err);
      toast.error('Error loading users');
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
        const now = Date.now();
        result = result.filter(u => {
          const createdAt = u.created_at ? new Date(u.created_at).getTime() : 0;
          const daysSince = (now - createdAt) / (1000 * 60 * 60 * 24);
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

  const handlePreview = () => setShowPreview(true);

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isFullAdmin(user.id, user.role)) return null;

  const canSend = subject.trim() && heading.trim() && body.trim() && !sending;

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <div className="border-b border-surface-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-surface-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-black flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Management
              </h1>
              <p className="text-xs text-surface-500">Send emails to users and manage outreach</p>
            </div>
          </div>
          <span className="text-xs text-surface-500 bg-surface-800 px-3 py-1.5 rounded-lg">
            {users.length.toLocaleString()} users loaded
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="flex flex-wrap gap-1 p-1 bg-surface-900/80 border border-surface-800/60 rounded-xl">
          {[
            { key: 'all' as SendTab, label: 'All Users' },
            { key: 'filtered' as SendTab, label: 'Filtered Users' },
            { key: 'specific' as SendTab, label: 'Specific Users' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 min-w-[140px] px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-surface-700 text-white shadow-md'
                  : 'text-surface-500 hover:text-surface-200 hover:bg-surface-800/60'
              )}
              style={activeTab === tab.key ? { boxShadow: '0 0 0 1px rgba(255,95,31,0.25) inset' } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-surface-800 bg-surface-900/60 p-6 space-y-4">
          {activeTab === 'all' && (
            <div>
              <p className="text-sm text-surface-300 mb-1">
                Sending to <span className="font-bold text-white">{users.length.toLocaleString()}</span> users
              </p>
              <p className="text-xs text-surface-500 mb-4">This will send an email to every user on the platform.</p>
              <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/25 text-amber-300 text-sm flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>This will send to <strong>{users.length.toLocaleString()}</strong> users. Make sure your email content is correct before sending.</span>
              </div>
            </div>
          )}

          {activeTab === 'filtered' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Select
                  label="Pro Status"
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'pro', label: 'Pro Only' },
                    { value: 'free', label: 'Free Only' },
                  ]}
                  value={proFilter}
                  onChange={(e) => setProFilter(e.target.value)}
                />
                <Select
                  label="Role"
                  options={[
                    { value: 'all', label: 'All Roles' },
                    { value: 'writer', label: 'Writer' },
                    { value: 'director', label: 'Director' },
                    { value: 'producer', label: 'Producer' },
                  ]}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                />
                <Select
                  label="Last Login"
                  options={[
                    { value: 'any', label: 'Any Time' },
                    { value: '7d', label: 'Last 7 Days' },
                    { value: '30d', label: 'Last 30 Days' },
                    { value: '30d_inactive', label: '30+ Days (Inactive)' },
                    { value: '90d_dormant', label: '90+ Days (Dormant)' },
                  ]}
                  value={lastLoginFilter}
                  onChange={(e) => setLastLoginFilter(e.target.value)}
                />
                <Select
                  label="Has Projects"
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'yes', label: 'Has Projects' },
                    { value: 'no', label: 'No Projects' },
                  ]}
                  value={hasProjectsFilter}
                  onChange={(e) => setHasProjectsFilter(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-surface-800">
                <p className="text-sm text-surface-400">
                  <span className="font-bold text-white">{targetUsers.length.toLocaleString()}</span> users match the current filters
                </p>
              </div>
            </div>
          )}

          {activeTab === 'specific' && (
            <div className="space-y-4">
              <Input
                label="Search Users"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-surface-500">
                  <span className="font-bold text-white">{selectedUserIds.size}</span> users selected
                </p>
                <button
                  onClick={toggleAllVisible}
                  className="text-xs text-[#FF5F1F] hover:underline font-medium"
                >
                  {targetUsers.length > 0 && targetUsers.every(u => selectedUserIds.has(u.id))
                    ? 'Deselect all visible'
                    : 'Select all visible'}
                </button>
              </div>
              <div className="max-h-[320px] overflow-y-auto space-y-1 rounded-lg border border-surface-800 bg-surface-950/50 p-2">
                {targetUsers.length === 0 && (
                  <p className="text-sm text-surface-500 text-center py-8">
                    {searchQuery ? 'No users match your search' : 'No users found'}
                  </p>
                )}
                {targetUsers.map(u => (
                  <label
                    key={u.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                      selectedUserIds.has(u.id) ? 'bg-[#FF5F1F]/8 border border-[#FF5F1F]/20' : 'hover:bg-surface-800/60 border border-transparent'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(u.id)}
                      onChange={() => toggleUserSelection(u.id)}
                      className="rounded border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]/30 bg-surface-800"
                    />
                    <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-[10px] text-surface-400 shrink-0">
                      {(u.display_name || u.full_name || u.email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {u.display_name || u.full_name || 'No Name'}
                      </p>
                      <p className="text-[11px] text-surface-500 truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {u.is_pro && (
                        <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">PRO</span>
                      )}
                      <span className="text-[10px] text-surface-600">{userProjectCounts[u.id] || 0} projects</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-surface-800 bg-surface-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Email Composer</h2>
            <select
              value={selectedTemplate}
              onChange={(e) => {
                const tpl = EMAIL_TEMPLATES.find(t => t.id === e.target.value);
                setSelectedTemplate(e.target.value);
                if (tpl && tpl.id) {
                  setSubject(tpl.subject || '');
                  setHeading(tpl.heading || '');
                  setBody(tpl.body || '');
                  setCtaLabel(tpl.ctaLabel || '');
                  setCtaUrl(tpl.ctaUrl || '');
                } else {
                  setSubject('');
                  setHeading('');
                  setBody('');
                  setCtaLabel('');
                  setCtaUrl('');
                }
              }}
              className="text-xs bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white"
            >
              {EMAIL_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <Input
            label="Subject"
            placeholder="Email subject line..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Input
            label="Heading"
            placeholder="Heading shown in email template..."
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
          />
          <Textarea
            label="Body"
            placeholder="Email body content. HTML is supported."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="font-mono text-xs"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="CTA Label (optional)"
              placeholder="e.g. Open App"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
            />
            <Input
              label="CTA URL (optional)"
              placeholder="https://..."
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={handlePreview} disabled={!subject && !heading && !body}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const count = getRecipientUserIds().length;
                if (count === 0) {
                  toast.error('No recipients selected');
                  return;
                }
                setShowConfirm(true);
              }}
              disabled={!canSend || getRecipientUserIds().length === 0}
              loading={sending}
            >
              Send to {activeTab === 'all' ? `${users.length.toLocaleString()} Users` : activeTab === 'filtered' ? `${targetUsers.length.toLocaleString()} Users` : `${selectedUserIds.size} Users`}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-surface-800 bg-surface-900/60 p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Email History</h2>
          {emailLog.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-8">No emails sent yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800">
                    <th className="text-left py-2 px-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider">Date</th>
                    <th className="text-left py-2 px-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider">Subject</th>
                    <th className="text-left py-2 px-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider">Recipients</th>
                    <th className="text-left py-2 px-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider">Sent By</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLog.map(entry => (
                    <tr key={entry.id} className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-xs text-surface-400 whitespace-nowrap">{timeAgo(entry.date)}</td>
                      <td className="py-2.5 px-3 text-sm text-white font-medium truncate max-w-[300px]">{entry.subject}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs font-bold text-[#FF5F1F] bg-[#FF5F1F]/10 px-2 py-0.5 rounded-full">
                          {entry.recipientCount.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-surface-400">{entry.sentBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {batches.length > 0 && (
        <div className="rounded-xl border border-surface-800 bg-surface-900/60 p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Email Batches</h2>
          <p className="text-xs text-surface-500 mb-4">Bulk emails are sent in batches of 100/day. A cron job processes one batch per day.</p>
          <div className="space-y-3">
            {batches.map((b: any) => {
              const progress = b.total_recipients > 0 ? Math.round(((b.sent_count + b.failed_count) / b.total_recipients) * 100) : 0;
              const daysLeft = b.batch_size > 0 ? Math.ceil((b.total_recipients - b.sent_count - b.failed_count) / b.batch_size) : 0;
              return (
                <div key={b.id} className="p-4 rounded-lg border border-surface-700 bg-surface-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{b.subject}</p>
                      <p className="text-[11px] text-surface-500">
                        Created {new Date(b.created_at).toLocaleDateString()} · {b.total_recipients} recipients
                      </p>
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                      b.status === 'completed' ? 'bg-green-500/15 text-green-400' :
                      b.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-surface-700 text-surface-400'
                    )}>
                      {b.status === 'completed' ? 'Done' : b.status === 'pending' ? `${daysLeft}d left` : b.status}
                    </span>
                  </div>
                  <div className="w-full bg-surface-700 rounded-full h-1.5 mb-1">
                    <div
                      className={cn('h-1.5 rounded-full transition-all', b.status === 'completed' ? 'bg-green-500' : 'bg-[#FF5F1F]')}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-surface-500">{b.sent_count} sent · {b.failed_count} failed · {b.total_recipients - b.sent_count - b.failed_count} remaining</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showPreview && (() => {
        const previewUser = getRecipientUserIds()[0];
        const previewName = previewUser?.full_name || previewUser?.display_name || 'there';
        const vars: Record<string, string> = { name: previewName, email: previewUser?.email || 'user@example.com' };
        const replace = (s: string) => Object.entries(vars).reduce((str, [k, v]) => str.replaceAll(`{${k}}`, v), s);
        return (
          <Modal isOpen onClose={() => setShowPreview(false)} title={`Email Preview — ${previewName}`} size="lg">
            <div className="rounded-xl border border-surface-800 bg-white p-8 max-w-lg mx-auto">
              <h1 className="text-xl font-bold text-gray-900 mb-4">{replace(heading) || 'Email Heading'}</h1>
              <div
                className="text-sm text-gray-700 leading-relaxed mb-6 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: replace(body) || 'Email body content will appear here.' }}
              />
              {ctaLabel && (
                <div className="text-center">
                  <span className="inline-block px-6 py-3 rounded-lg bg-[#FF5F1F] text-white font-bold text-sm">
                    {replace(ctaLabel)}
                  </span>
                </div>
              )}
              <div className="mt-8 pt-4 border-t border-gray-200 text-center">
                <p className="text-[10px] text-gray-400">Sent via Screenplay Studio</p>
              </div>
            </div>
            <p className="text-xs text-surface-500 text-center mt-4">
              Previewing as: {previewName} ({previewUser?.email}). {'{name}'} and {'{email}'} will be replaced per recipient.
            </p>
          </Modal>
        );
      })()}

      {showConfirm && (
        <Modal isOpen onClose={() => setShowConfirm(false)} title="Confirm Send" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-surface-300">
              You are about to send an email to{' '}
              <span className="font-bold text-white">{getRecipientUserIds().length.toLocaleString()}</span>{' '}
              users.
            </p>
            <div className="rounded-lg bg-surface-800/50 p-3 text-xs text-surface-400 space-y-1">
              <p><span className="font-medium text-surface-300">Subject:</span> {subject}</p>
              <p><span className="font-medium text-surface-300">Heading:</span> {heading}</p>
              {ctaLabel && <p><span className="font-medium text-surface-300">CTA:</span> {ctaLabel}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={sending}>Cancel</Button>
              <Button variant="primary" onClick={handleSend} loading={sending}>
                Confirm Send
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {sending && sendProgress.total > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-900 border border-surface-700 rounded-xl px-6 py-4 shadow-2xl flex items-center gap-4">
          <div className="w-5 h-5 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm font-bold text-white">Sending emails...</p>
            <p className="text-xs text-surface-400">{sendProgress.sent} / {sendProgress.total} sent</p>
          </div>
          <div className="w-32 h-2 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#FF5F1F] transition-all duration-300"
              style={{ width: `${sendProgress.total > 0 ? (sendProgress.sent / sendProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
