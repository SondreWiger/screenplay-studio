'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { useAuth } from '@/hooks/useAuth';
import { logWork, fetchMyWorkLogs, calculateStreak, aggregateLogsByDate } from '@/lib/work-tracker';
import ActivityGrid from '@/components/activity/ActivityGrid';
import { toast, LoadingSpinner, LoadingPage } from '@/components/ui';
import type { AccountabilityBuddy, AccountabilityGroup, AccountabilityGroupMember, AccountabilityFeedPost } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';

type Tab = 'stats' | 'buddies' | 'groups';

interface BuddyProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  activity_color: string | null;
  daily_goal_pages: number | null;
}

// ── ManualLogModal ────────────────────────────────────────────────────────────

function ManualLogModal({ onClose, onSave }: { onClose: () => void; onSave: () => Promise<void> }) {
  const [pages, setPages] = useState('');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const pagesVal = parseFloat(pages) || 0;
    const minutesVal = parseInt(minutes, 10) || 0;
    if (pagesVal === 0 && minutesVal === 0 && !note.trim()) {
      toast.warning('Nothing to log — enter pages, time, or a note.');
      setSaving(false);
      return;
    }
    const result = await logWork({
      pagesWritten: pagesVal,
      sessionMinutes: minutesVal,
      manualNote: note.trim() || undefined,
      isManual: true,
    });
    if (result === null) {
      toast.error('Could not save — make sure the accountability migration has been applied in Supabase.');
      setSaving(false);
      return;
    }
    toast.success('Work logged!');
    await onSave();
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">Log today's work</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Pages written</label>
            <input
              type="number" min="0" step="0.5" value={pages}
              onChange={e => setPages(e.target.value)}
              placeholder="e.g. 3"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Time spent (minutes)</label>
            <input
              type="number" min="0" step="5" value={minutes}
              onChange={e => setMinutes(e.target.value)}
              placeholder="e.g. 90"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Note (optional)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              rows={2} placeholder="What did you work on?"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm text-white/50 hover:text-white/80 border border-white/10 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm font-semibold text-white bg-[#FF5F1F] rounded-lg hover:bg-[#ff7a45] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Log Work'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── BuddyCard ─────────────────────────────────────────────────────────────────

function BuddyCard({
  buddy,
  profile,
  onAction,
}: {
  buddy: AccountabilityBuddy;
  profile: BuddyProfile;
  onAction: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const [acting, setActing] = useState(false);

  const isRequester = buddy.requester_id === user?.id;
  const isPending = buddy.status === 'pending';
  const isAccepted = buddy.status === 'accepted';

  const accept = async () => {
    setActing(true);
    const supabase = createClient();
    await supabase.from('accountability_buddies').update({ status: 'accepted' }).eq('id', buddy.id);
    toast.success(`You and ${profile.display_name || 'them'} are now accountability buddies!`);
    setActing(false);
    onAction();
  };

  const decline = async () => {
    setActing(true);
    const supabase = createClient();
    await supabase.from('accountability_buddies').update({ status: 'declined' }).eq('id', buddy.id);
    setActing(false);
    onAction();
  };

  const remove = async () => {
    if (!confirm('Remove this accountability buddy?')) return;
    setActing(true);
    const supabase = createClient();
    await supabase.from('accountability_buddies').delete().eq('id', buddy.id);
    setActing(false);
    onAction();
  };

  return (
    <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.display_name || ''} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-lg font-bold">
            {(profile.display_name || profile.username || '?')[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/u/${profile.username || profile.id}`} className="text-sm font-medium text-white hover:text-white/80 transition-colors truncate block">
          {profile.display_name || profile.username || 'Anonymous'}
        </Link>
        {isPending && (
          <p className="text-xs text-white/30 mt-0.5">
            {isRequester ? 'Request sent · waiting for response' : 'Wants to be your accountability buddy'}
          </p>
        )}
        {isAccepted && (
          <p className="text-xs text-white/30 mt-0.5">Accountability buddy</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {isPending && !isRequester && (
          <>
            <button onClick={accept} disabled={acting}
              className="text-xs px-3 py-1.5 bg-[#FF5F1F] text-white rounded-lg hover:bg-[#ff7a45] transition-colors disabled:opacity-40">
              Accept
            </button>
            <button onClick={decline} disabled={acting}
              className="text-xs px-3 py-1.5 bg-white/5 text-white/50 hover:text-white/80 rounded-lg transition-colors disabled:opacity-40">
              Decline
            </button>
          </>
        )}
        {(isAccepted || (isPending && isRequester)) && (
          <button onClick={remove} disabled={acting}
            className="text-xs px-3 py-1.5 bg-white/5 text-white/30 hover:text-red-400 rounded-lg transition-colors disabled:opacity-40">
            {isPending ? 'Cancel' : 'Remove'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── GroupCard ────────────────────────────────────────────────────────────────

function GroupCard({ group, myRole, onEnter }: { group: AccountabilityGroup; myRole: string; onEnter: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/30 to-pink-500/30 border border-white/10 shrink-0 overflow-hidden">
        {group.avatar_url ? (
          <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40 text-lg">🎯</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{group.name}</p>
        {group.description && (
          <p className="text-xs text-white/30 mt-0.5 truncate">{group.description}</p>
        )}
        <p className="text-xs text-white/20 mt-0.5 capitalize">{myRole}</p>
      </div>
      <button onClick={onEnter}
        className="text-xs px-3 py-1.5 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
        Open
      </button>
    </div>
  );
}

// ── GroupModal ────────────────────────────────────────────────────────────────

function GroupModal({ group, onClose, onUpdated }: {
  group: AccountabilityGroup;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const [members, setMembers] = useState<(AccountabilityGroupMember & { profile: BuddyProfile })[]>([]);
  const [feed, setFeed] = useState<AccountabilityFeedPost[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [membersRes, feedRes] = await Promise.all([
      supabase
        .from('accountability_group_members')
        .select('*, profile:profiles(id, display_name, username, avatar_url, activity_color, daily_goal_pages)')
        .eq('group_id', group.id),
      supabase
        .from('accountability_feed')
        .select('*, author:profiles(id, display_name, username, avatar_url)')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (membersRes.data) setMembers(membersRes.data as any);
    if (feedRes.data) setFeed(feedRes.data as any);
    setLoading(false);
  }, [group.id]);

  useEffect(() => { load(); }, [load]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from('accountability_feed').insert({
      author_id: user.id,
      group_id: group.id,
      content: message.trim(),
      post_type: 'message',
    });
    if (!error) {
      setMessage('');
      load();
    }
    setSending(false);
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-white">{group.name}</h2>
          <div className="flex items-center gap-2">
            <button onClick={copyInvite}
              className="text-xs px-2.5 py-1 bg-white/5 text-white/40 hover:text-white/70 rounded-lg transition-colors">
              {copied ? '✓ Copied' : '📎 Invite'}
            </button>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors text-xl leading-none">×</button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Members */}
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Members ({members.length})</p>
              <div className="flex -space-x-2">
                {members.slice(0, 8).map(m => (
                  <Link key={m.user_id} href={`/u/${m.profile.username || m.user_id}`}
                    title={m.profile.display_name || m.profile.username || 'Member'}
                    className="w-7 h-7 rounded-full overflow-hidden border-2 border-[#181818] bg-white/10">
                    {m.profile.avatar_url ? (
                      <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-white/40 font-bold">
                        {(m.profile.display_name || m.profile.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </Link>
                ))}
                {members.length > 8 && (
                  <div className="w-7 h-7 rounded-full border-2 border-[#181818] bg-white/10 flex items-center justify-center text-[9px] text-white/30">
                    +{members.length - 8}
                  </div>
                )}
              </div>
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {feed.length === 0 ? (
                <p className="text-center text-white/20 text-sm py-8">No posts yet. Start the conversation!</p>
              ) : (
                [...feed].reverse().map(post => (
                  <div key={post.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10 shrink-0 mt-0.5">
                      {(post.author as any)?.avatar_url ? (
                        <img src={(post.author as any).avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-white/30 font-bold">
                          {((post.author as any)?.display_name || '?')[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-white/70">
                          {(post.author as any)?.display_name || (post.author as any)?.username || 'Member'}
                        </span>
                        <span className="text-[10px] text-white/20">
                          {new Date(post.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-white/80 mt-0.5 leading-relaxed">{post.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message input */}
            <form onSubmit={sendMessage} className="px-5 py-3 border-t border-white/[0.06] flex gap-2">
              <input
                value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Cheer someone on, share progress…"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
              />
              <button type="submit" disabled={sending || !message.trim()}
                className="px-4 py-2 bg-[#FF5F1F] text-white text-sm rounded-lg hover:bg-[#ff7a45] transition-colors disabled:opacity-40">
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountabilityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('stats');
  const [loading, setLoading] = useState(true);

  // ── Stats state ──
  const [logs, setLogs] = useState<Array<{ log_date: string; pages_written: number; session_minutes: number }>>([]);
  const [showLogModal, setShowLogModal] = useState(false);

  // ── Buddies state ──
  const [buddies, setBuddies] = useState<AccountabilityBuddy[]>([]);
  const [buddyProfiles, setBuddyProfiles] = useState<Record<string, BuddyProfile>>({});
  const [buddySearch, setBuddySearch] = useState('');
  const [buddyResults, setBuddyResults] = useState<BuddyProfile[]>([]);
  const [sendingRequest, setSendingRequest] = useState(false);

  // ── Groups state ──
  const [groups, setGroups] = useState<AccountabilityGroup[]>([]);
  const [myRoles, setMyRoles] = useState<Record<string, string>>({});
  const [openGroup, setOpenGroup] = useState<AccountabilityGroup | null>(null);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);

  const activityColor = user?.activity_color || '#22c55e';
  const dailyGoal = user?.daily_goal_pages || 1;

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    const data = await fetchMyWorkLogs(365);
    setLogs(data);
  }, []);

  const loadBuddies = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('accountability_buddies')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false });

    if (!data) return;
    setBuddies(data as AccountabilityBuddy[]);

    // Fetch profiles for the other side
    const otherIds = data.map(b => b.requester_id === user.id ? b.addressee_id : b.requester_id);
    if (otherIds.length === 0) return;
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, activity_color, daily_goal_pages')
      .in('id', otherIds);
    if (profiles) {
      const map: Record<string, BuddyProfile> = {};
      for (const p of profiles) map[p.id] = p as BuddyProfile;
      setBuddyProfiles(map);
    }
  }, [user]);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data: memberRows } = await supabase
      .from('accountability_group_members')
      .select('group_id, role')
      .eq('user_id', user.id);

    if (!memberRows || memberRows.length === 0) return;

    const groupIds = memberRows.map(r => r.group_id);
    const roleMap: Record<string, string> = {};
    for (const r of memberRows) roleMap[r.group_id] = r.role;
    setMyRoles(roleMap);

    const { data: groupData } = await supabase
      .from('accountability_groups')
      .select('*')
      .in('id', groupIds);
    if (groupData) setGroups(groupData as AccountabilityGroup[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    Promise.all([loadStats(), loadBuddies(), loadGroups()]).then(() => setLoading(false));
  }, [user, loadStats, loadBuddies, loadGroups]);

  // ── Search buddies ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!buddySearch.trim() || buddySearch.trim().length < 2) {
      setBuddyResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const supabase = createClient();
      const q = buddySearch.trim().toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, activity_color, daily_goal_pages')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq('id', user?.id)
        .limit(6);
      setBuddyResults((data || []) as BuddyProfile[]);
    }, 300);
    return () => clearTimeout(t);
  }, [buddySearch, user]);

  const sendBuddyRequest = async (toId: string) => {
    if (!user) return;
    setSendingRequest(true);
    const supabase = createClient();
    const { error } = await supabase.from('accountability_buddies').insert({
      requester_id: user.id,
      addressee_id: toId,
      status: 'pending',
    });
    if (error) {
      if (error.code === '23505') toast.warning('Request already sent!');
      else toast.error('Could not send request');
    } else {
      toast.success('Buddy request sent!');
      setBuddySearch('');
      setBuddyResults([]);
      loadBuddies();
    }
    setSendingRequest(false);
  };

  // ── Groups actions ────────────────────────────────────────────────────────

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !user) return;
    setCreatingGroup(true);
    const supabase = createClient();
    const { data: grp, error } = await supabase
      .from('accountability_groups')
      .insert({ name: createName.trim(), description: createDesc.trim() || null, created_by: user.id })
      .select()
      .single();
    if (error || !grp) {
      toast.error('Could not create group');
      setCreatingGroup(false);
      return;
    }
    await supabase.from('accountability_group_members').insert({ group_id: grp.id, user_id: user.id, role: 'owner' });
    toast.success('Group created!');
    setCreateName('');
    setCreateDesc('');
    setCreatingGroup(false);
    loadGroups();
  };

  const joinByInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoiningGroup(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('join_accountability_group', { p_invite_code: inviteCode.trim() });
    if (error) {
      toast.error(error.message.includes('Invalid') ? 'Invalid invite code' : 'Could not join group');
    } else {
      toast.success('Joined group!');
      setInviteCode('');
      loadGroups();
    }
    setJoiningGroup(false);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────

  const streak = calculateStreak(logs);
  const agg = aggregateLogsByDate(logs);
  const totalPages = Array.from(agg.values()).reduce((s, v) => s + v.pages, 0);
  const totalMinutes = Array.from(agg.values()).reduce((s, v) => s + v.minutes, 0);
  const daysWorked = Array.from(agg.values()).filter(v => v.pages > 0 || v.minutes > 0).length;

  const pendingIncoming = buddies.filter(b => b.status === 'pending' && b.addressee_id === user?.id);

  useEffect(() => {
    if (!authLoading && user && user.show_accountability === false) {
      router.replace('/settings?tab=preferences');
    }
  }, [authLoading, user, router]);

  if (authLoading) return <LoadingPage />;
  if (!user) return null;
  if (user.show_accountability === false) return <LoadingPage />;

  return (
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      {/* Dot-grid texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <AppHeader />

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Glow orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-20 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #FF5F1F 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-1/4 w-64 h-32 rounded-full opacity-5"
            style={{ background: 'radial-gradient(circle, #FF5F1F 0%, transparent 70%)' }} />
        </div>
        <div className="max-w-5xl mx-auto px-6 py-10 relative">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-3 h-px shrink-0" style={{ background: '#FF5F1F' }} />
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>work tracking</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>
                ACCOUNTABILITY
              </h1>
              <p className="text-sm mt-2 max-w-md" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Track your writing, stay consistent, keep each other going.
              </p>
            </div>
            {/* Quick summary chips */}
            {!loading && (
              <div className="hidden sm:flex items-center gap-3 shrink-0 mt-2">
                <div className="text-center px-4 py-2.5 rounded-2xl" style={{ border: '1px solid rgba(255,95,31,0.2)', background: 'rgba(255,95,31,0.06)' }}>
                  <p className="text-2xl font-black" style={{ color: '#FF5F1F', letterSpacing: '-0.02em' }}>{streak}</p>
                  <p className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>day streak</p>
                </div>
                <div className="text-center px-4 py-2.5 rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-2xl font-black text-white" style={{ letterSpacing: '-0.02em' }}>{totalPages.toFixed(0)}</p>
                  <p className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>pages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {([
            { key: 'stats', label: 'My Stats', icon: '📊' },
            { key: 'buddies', label: `Buddies${pendingIncoming.length > 0 ? ` · ${pendingIncoming.length}` : ''}`, icon: '🤝' },
            { key: 'groups', label: 'Groups', icon: '🎯' },
          ] as { key: Tab; label: string; icon: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-lg transition-all"
              style={tab === t.key
                ? { background: '#FF5F1F', color: '#fff' }
                : { color: 'rgba(255,255,255,0.4)' }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* ── STATS TAB ─────────────────────────────────────────── */}
            {tab === 'stats' && (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Current Streak', value: String(streak), suffix: streak === 1 ? 'day' : 'days', icon: '🔥', accentColor: '#FF5F1F', glow: true },
                    { label: 'Days Wrote', value: String(daysWorked), suffix: 'sessions', icon: '📅', accentColor: '#818cf8', glow: false },
                    { label: 'Pages Written', value: totalPages.toFixed(1), suffix: 'total', icon: '📄', accentColor: '#22c55e', glow: false },
                    { label: 'Time Spent', value: (totalMinutes / 60).toFixed(1), suffix: 'hours', icon: '⏱', accentColor: '#f59e0b', glow: false },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      className="relative overflow-hidden rounded-2xl p-5"
                      style={{
                        background: stat.glow ? 'rgba(255,95,31,0.07)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${stat.glow ? 'rgba(255,95,31,0.22)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      {stat.glow && (
                        <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-30"
                          style={{ background: 'radial-gradient(circle, #FF5F1F 0%, transparent 70%)' }} />
                      )}
                      <div className="text-2xl mb-3">{stat.icon}</div>
                      <p className="text-2xl font-black text-white" style={{ letterSpacing: '-0.02em' }}>
                        {stat.value}
                        <span className="text-xs font-normal ml-1.5" style={{ color: stat.accentColor }}>{stat.suffix}</span>
                      </p>
                      <p className="text-[10px] font-mono uppercase tracking-widest mt-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Activity grid */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <p className="text-sm font-semibold text-white">Activity — Past Year</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{daysWorked} session{daysWorked !== 1 ? 's' : ''} logged</p>
                    </div>
                    <button
                      onClick={() => setShowLogModal(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-colors hover:opacity-90"
                      style={{ background: '#FF5F1F', color: '#fff' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      Log work
                    </button>
                  </div>
                  <div className="px-5 py-5 overflow-x-auto">
                    <ActivityGrid
                      logs={logs}
                      activityColor={activityColor}
                      dailyGoal={dailyGoal}
                      cellSize={12}
                      cellGap={2}
                      showMonthLabels
                      showDayLabels
                      showLegend
                    />
                  </div>
                  <div className="px-5 pb-4">
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      Daily goal: {dailyGoal} page{dailyGoal === 1 ? '' : 's'} ·{' '}
                      <Link href="/settings#accountability" className="hover:opacity-60 underline underline-offset-2 transition-opacity">
                        Change in settings
                      </Link>
                    </p>
                  </div>
                </div>

                {/* Recent sessions */}
                {logs.length > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="text-sm font-semibold text-white">Recent Sessions</p>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      {[...logs].reverse().slice(0, 10).map(log => (
                        <div key={log.log_date + log.session_minutes} className="flex items-center justify-between px-5 py-3.5 group">
                          <span className="text-sm transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            {new Date(log.log_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <div className="flex items-center gap-2">
                            {log.pages_written > 0 && (
                              <span className="text-xs px-2.5 py-1 rounded-full font-mono" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                                {log.pages_written.toFixed(1)} pg
                              </span>
                            )}
                            {log.session_minutes > 0 && (
                              <span className="text-xs px-2.5 py-1 rounded-full font-mono" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                                {log.session_minutes}min
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── BUDDIES TAB ───────────────────────────────────────── */}
            {tab === 'buddies' && (
              <div className="space-y-6">
                {/* Search / add */}
                <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Find a buddy</p>
                  <input
                    value={buddySearch}
                    onChange={e => setBuddySearch(e.target.value)}
                    placeholder="Search by username or name…"
                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  {buddyResults.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {buddyResults.map(r => (
                        <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0">
                            {r.avatar_url ? (
                              <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {(r.display_name || r.username || '?')[0]}
                              </div>
                            )}
                          </div>
                          <span className="flex-1 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{r.display_name || r.username}</span>
                          <button
                            onClick={() => sendBuddyRequest(r.id)}
                            disabled={sendingRequest}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 hover:opacity-90"
                            style={{ background: '#FF5F1F', color: '#fff' }}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending incoming */}
                {pendingIncoming.length > 0 && (
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Pending requests
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-white" style={{ background: '#FF5F1F' }}>
                        {pendingIncoming.length}
                      </span>
                    </p>
                    <div className="space-y-2">
                      {pendingIncoming.map(b => {
                        const otherId = b.requester_id === user.id ? b.addressee_id : b.requester_id;
                        const profile = buddyProfiles[otherId];
                        if (!profile) return null;
                        return <BuddyCard key={b.id} buddy={b} profile={profile} onAction={loadBuddies} />;
                      })}
                    </div>
                  </div>
                )}

                {/* Buddies list */}
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Your buddies ({buddies.filter(b => b.status === 'accepted').length})
                  </p>
                  {buddies.filter(b => b.status === 'accepted').length === 0 ? (
                    <div className="rounded-2xl py-16 text-center" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      <div className="text-4xl mb-3">🤝</div>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No buddies yet.</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Search above to add one.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {buddies.filter(b => b.status === 'accepted').map(b => {
                        const otherId = b.requester_id === user.id ? b.addressee_id : b.requester_id;
                        const profile = buddyProfiles[otherId];
                        if (!profile) return null;
                        return <BuddyCard key={b.id} buddy={b} profile={profile} onAction={loadBuddies} />;
                      })}
                    </div>
                  )}
                </div>

                {/* Sent-pending */}
                {buddies.filter(b => b.status === 'pending' && b.requester_id === user.id).length > 0 && (
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Sent requests</p>
                    <div className="space-y-2">
                      {buddies.filter(b => b.status === 'pending' && b.requester_id === user.id).map(b => {
                        const profile = buddyProfiles[b.addressee_id];
                        if (!profile) return null;
                        return <BuddyCard key={b.id} buddy={b} profile={profile} onAction={loadBuddies} />;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── GROUPS TAB ────────────────────────────────────────── */}
            {tab === 'groups' && (
              <div className="space-y-6">
                {/* Your groups */}
                {groups.length > 0 && (
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Your groups</p>
                    <div className="space-y-2">
                      {groups.map(g => (
                        <GroupCard key={g.id} group={g} myRole={myRoles[g.id] || 'member'} onEnter={() => setOpenGroup(g)} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Create */}
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Create a group</p>
                    <form onSubmit={createGroup} className="space-y-3">
                      <input
                        value={createName} onChange={e => setCreateName(e.target.value)}
                        placeholder="Group name"
                        className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                      />
                      <input
                        value={createDesc} onChange={e => setCreateDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                      />
                      <button type="submit" disabled={creatingGroup || !createName.trim()}
                        className="w-full py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 hover:opacity-90"
                        style={{ background: '#FF5F1F', color: '#fff' }}>
                        {creatingGroup ? 'Creating…' : 'Create Group'}
                      </button>
                    </form>
                  </div>

                  {/* Join by invite */}
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Join with invite code</p>
                    <p className="text-xs mb-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      Have a code? Paste it below to join an existing accountability group instantly.
                    </p>
                    <form onSubmit={joinByInvite} className="space-y-3">
                      <input
                        value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                        placeholder="e.g. a1b2c3"
                        className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none font-mono tracking-widest"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                        maxLength={12}
                      />
                      <button type="submit" disabled={joiningGroup || !inviteCode.trim()}
                        className="w-full py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
                        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
                        {joiningGroup ? 'Joining…' : 'Join Group'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 relative z-10" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 flex items-center justify-center shrink-0" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-[9px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Screenplay Studio — Accountability</span>
          </div>
          <div className="flex items-center gap-6">
            {[
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/community', label: 'Community' },
              { href: '/settings', label: 'Settings' },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="text-[11px] font-mono uppercase tracking-widest transition-colors hover:text-white/60"
                style={{ color: 'rgba(255,255,255,0.25)' }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showLogModal && (
        <ManualLogModal
          onClose={() => setShowLogModal(false)}
          onSave={loadStats}
        />
      )}
      {openGroup && (
        <GroupModal
          group={openGroup}
          onClose={() => setOpenGroup(null)}
          onUpdated={loadGroups}
        />
      )}
    </div>
  );
}
