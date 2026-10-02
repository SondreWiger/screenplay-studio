'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Badge, Modal, Input, Textarea, Avatar, toast } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import type { UserRow } from '../types';
import { ADMIN_UID } from '../types';
import { useAdminData } from '../data';
import { TabSkeleton } from '../motion';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { Users as UsersIcon } from 'lucide-react';
import { AdminPage, BarList, PageHeader, Panel, Reveal, StatGrid, TrendPanel, tally, windowCounts, dailySpark } from '../kit';

export function UsersTab({ users, search, onSearchChange, onEdit, onDelete, onRefresh }: {
  users: UserRow[];
  search: string;
  onSearchChange: (s: string) => void;
  onEdit: (u: UserRow) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [dmAllOpen, setDmAllOpen] = useState(false);
  const [dmAllMessage, setDmAllMessage] = useState('');
  const [dmAllSending, setDmAllSending] = useState(false);
  const [dmAllProgress, setDmAllProgress] = useState('');
  const [modAction, setModAction] = useState<{ user: UserRow; action: 'warn' | 'suspend' | 'ban' | 'unban' | 'unsuspend' } | null>(null);
  const [modReason, setModReason] = useState('');
  const [modDays, setModDays] = useState(30);
  const [modLoading, setModLoading] = useState(false);
  const router = useRouter();

  const handleModAction = async () => {
    if (!modAction || !modReason.trim()) return;
    setModLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const actionMap: Record<string, string> = {
        warn: 'warn_user',
        suspend: 'suspend_user',
        ban: 'ban_user',
        unban: 'unban_user',
        unsuspend: 'unsuspend_user',
      };
      const res = await fetch('/api/admin/moderation/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: actionMap[modAction.action],
          user_id: modAction.user.id,
          reason: modReason,
          ...(modAction.action === 'suspend' ? { duration_days: modDays } : {}),
        }),
      });
      if (res.ok) {
        toast.success(`User ${modAction.action === 'unban' || modAction.action === 'unsuspend' ? 'restored' : modAction.action + 'ned'} successfully`);
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Action failed');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setModLoading(false);
      setModAction(null);
      setModReason('');
    }
  };

  const handleDmUser = async (targetUser: UserRow) => {
    const supabase = createClient();
    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) return;

    // Check for existing direct conversation
    const { data: myConvos } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', me.id);
    const myConvoIds = (myConvos || []).map((c) => c.conversation_id);

    if (myConvoIds.length > 0) {
      const { data: theirConvos } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', targetUser.id)
        .in('conversation_id', myConvoIds);

      if (theirConvos && theirConvos.length > 0) {
        // Check which one is direct
        for (const tc of theirConvos) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, conversation_type')
            .eq('id', tc.conversation_id)
            .eq('conversation_type', 'direct')
            .single();
          if (conv) {
            router.push(`/messages?convo=${conv.id}`);
            return;
          }
        }
      }
    }

    // Create new direct conversation
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ conversation_type: 'direct', created_by: me.id })
      .select()
      .single();
    if (!conv) return;

    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: me.id, role: 'admin' },
      { conversation_id: conv.id, user_id: targetUser.id, role: 'member' },
    ]);

    router.push(`/messages?convo=${conv.id}`);
  };

  const handleDmAll = async () => {
    if (!dmAllMessage.trim()) return;
    setDmAllSending(true);
    const supabase = createClient();
    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) { setDmAllSending(false); return; }

    let sent = 0;
    const total = users.filter((u) => u.id !== me.id).length;

    for (const targetUser of users) {
      if (targetUser.id === me.id) continue;
      try {
        // Find or create conversation
        let convoId: string | null = null;

        const { data: myConvos } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', me.id);
        const myConvoIds = (myConvos || []).map((c) => c.conversation_id);

        if (myConvoIds.length > 0) {
          const { data: theirConvos } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', targetUser.id)
            .in('conversation_id', myConvoIds);

          if (theirConvos) {
            for (const tc of theirConvos) {
              const { data: conv } = await supabase
                .from('conversations')
                .select('id, conversation_type')
                .eq('id', tc.conversation_id)
                .eq('conversation_type', 'direct')
                .single();
              if (conv) { convoId = conv.id; break; }
            }
          }
        }

        if (!convoId) {
          const { data: conv } = await supabase
            .from('conversations')
            .insert({ conversation_type: 'direct', created_by: me.id })
            .select()
            .single();
          if (conv) {
            convoId = conv.id;
            await supabase.from('conversation_members').insert([
              { conversation_id: conv.id, user_id: me.id, role: 'admin' },
              { conversation_id: conv.id, user_id: targetUser.id, role: 'member' },
            ]);
          }
        }

        if (convoId) {
          await supabase.from('direct_messages').insert({
            conversation_id: convoId,
            sender_id: me.id,
            content: dmAllMessage.trim(),
            message_type: 'text',
          });
          sent++;
          setDmAllProgress(`Sent ${sent}/${total}`);
        }
      } catch (e) {
        console.error('DM send error for', targetUser.id, e);
      }
    }

    setDmAllSending(false);
    setDmAllOpen(false);
    setDmAllMessage('');
    setDmAllProgress('');
    toast.success(`Message sent to ${sent} user${sent !== 1 ? 's' : ''}`);
  };

  const handleCopyEmails = async () => {
    const emails = users.map((u) => u.email).filter(Boolean).join(', ');
    try {
      await navigator.clipboard.writeText(emails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = emails;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setDmAllOpen(true)}
            title={`Send DM to ${search ? 'filtered' : 'all'} users`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors duration-150 bg-brand-500/10 border-brand-500/30 text-brand-500 hover:bg-brand-500/20 hover:border-brand-500/50"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            DM {search ? `${users.length} filtered` : 'all'} users
          </button>
          <button
            onClick={handleCopyEmails}
            title={`Copy ${users.length} email${users.length !== 1 ? 's' : ''} to clipboard`}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors duration-150',
              copied
                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                : 'bg-surface-800 border-surface-700 text-surface-300 hover:text-white hover:border-surface-600',
            )}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied {users.length} email{users.length !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Copy {search ? `${users.length} filtered` : 'all'} emails
              </>
            )}
          </button>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder:text-surface-500 outline-none focus:border-brand-500 w-64"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-surface-800 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-800 bg-surface-900/50">
              <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">User</th>
              <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Role</th>
              <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Joined</th>
              <th className="text-right text-xs font-medium text-surface-500 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={u.avatar_url} name={u.full_name || u.email} size="sm" />
                    <div>
                      <p className="text-sm text-white">{u.full_name || 'Unnamed'}</p>
                      <p className="text-[11px] text-surface-500 font-mono">{u.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-surface-300">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={u.role === 'admin' || u.id === ADMIN_UID ? 'warning' : u.role === 'moderator' ? 'success' : 'default'} size="sm">
                      {u.role === 'admin' || u.id === ADMIN_UID ? 'Admin' : u.role === 'moderator' ? 'Moderator' : u.role || 'user'}
                    </Badge>
                    {u.is_pro && <Badge variant="success" size="sm">PRO</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.moderation_status && u.moderation_status !== 'clean' ? (
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      u.moderation_status === 'banned' ? 'bg-red-500/20 text-red-400' :
                      u.moderation_status === 'suspended' ? 'bg-orange-500/20 text-orange-400' :
                      u.moderation_status === 'warned' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/15 text-red-300'
                    )}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      {u.moderation_status}{u.moderation_flags ? ` (${u.moderation_flags})` : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-surface-500">Clean</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-surface-400">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => handleDmUser(u)} className="p-1.5 rounded text-surface-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors" title="Send DM">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    </button>
                    {u.id !== ADMIN_UID && (
                      <>
                        {u.moderation_status === 'banned' ? (
                          <button onClick={() => setModAction({ user: u, action: 'unban' })} className="p-1.5 rounded text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors" title="Unban / Pardon">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </button>
                        ) : u.moderation_status === 'suspended' ? (
                          <button onClick={() => setModAction({ user: u, action: 'unsuspend' })} className="p-1.5 rounded text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors" title="Unsuspend">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </button>
                        ) : (
                          <>
                            <button onClick={() => setModAction({ user: u, action: 'warn' })} className="p-1.5 rounded text-surface-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors" title="Warn">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                            </button>
                            <button onClick={() => setModAction({ user: u, action: 'suspend' })} className="p-1.5 rounded text-surface-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors" title="Suspend">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-10V5a2 2 0 00-2-2H8a2 2 0 00-2 2v2m10 0H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-2" /></svg>
                            </button>
                            <button onClick={() => setModAction({ user: u, action: 'ban' })} className="p-1.5 rounded text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Ban">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            </button>
                          </>
                        )}
                      </>
                    )}
                    <button onClick={() => onEdit(u)} className="p-1.5 rounded text-surface-400 hover:text-white hover:bg-surface-900/10 transition-colors" title="Edit">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    {u.id !== ADMIN_UID && (
                      <button onClick={() => onDelete(u.id)} className="p-1.5 rounded text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* DM All Modal */}
      <Modal isOpen={dmAllOpen} onClose={() => { setDmAllOpen(false); setDmAllMessage(''); setDmAllProgress(''); }} title={`DM ${search ? 'Filtered' : 'All'} Users`}>
        <div className="space-y-4">
          <p className="text-sm text-surface-400">
            This will send a direct message to <strong className="text-white">{users.filter((u) => u.id !== ADMIN_UID).length}</strong> user{users.filter((u) => u.id !== ADMIN_UID).length !== 1 ? 's' : ''}. Each user will receive an individual DM.
          </p>
          <Textarea
            value={dmAllMessage}
            onChange={(e) => setDmAllMessage(e.target.value)}
            placeholder="Type your message..."
            rows={4}
          />
          {dmAllProgress && (
            <p className="text-xs text-brand-500 font-mono">{dmAllProgress}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={handleDmAll} disabled={!dmAllMessage.trim() || dmAllSending} className="flex-1">
              {dmAllSending ? 'Sending...' : `Send to ${users.filter((u) => u.id !== ADMIN_UID).length} users`}
            </Button>
            <Button variant="secondary" onClick={() => { setDmAllOpen(false); setDmAllMessage(''); }}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Moderation Action Modal */}
      <Modal isOpen={!!modAction} onClose={() => { setModAction(null); setModReason(''); }} title={
        modAction?.action === 'unban' ? `Unban / Pardon ${modAction.user.full_name || modAction.user.email}` :
        modAction?.action === 'unsuspend' ? `Unsuspend ${modAction?.user.full_name || modAction?.user.email}` :
        modAction?.action === 'ban' ? `Ban ${modAction.user.full_name || modAction.user.email}` :
        modAction?.action === 'suspend' ? `Suspend ${modAction.user.full_name || modAction.user.email}` :
        `Warn ${modAction?.user.full_name || modAction?.user.email}`
      }>
        <div className="space-y-4">
          <p className="text-sm text-surface-400">
            {modAction?.action === 'unban' && 'This will lift the permanent ban, restore access, and clear all IP bans. The user will be notified via a System DM.'}
            {modAction?.action === 'unsuspend' && 'This will lift the suspension early and restore full access. The user will be notified via a System DM.'}
            {modAction?.action === 'warn' && 'This will issue a formal warning. The user will be notified via a System DM with the reason.'}
            {modAction?.action === 'suspend' && 'This will temporarily suspend the user. They cannot access the platform during the suspension. They will be notified via a System DM.'}
            {modAction?.action === 'ban' && 'This will permanently ban the user, remove all project memberships, and block their IP address. They will be notified via a System DM.'}
          </p>
          {modAction?.action === 'suspend' && (
            <div>
              <label className="block text-xs text-surface-400 mb-1">Duration (days)</label>
              <Input type="number" value={modDays} onChange={(e) => setModDays(Number(e.target.value) || 30)} min={1} max={365} />
            </div>
          )}
          <div>
            <label className="block text-xs text-surface-400 mb-1">
              {modAction?.action === 'unban' || modAction?.action === 'unsuspend' ? 'Note (optional but recommended)' : 'Reason *'}
            </label>
            <Textarea
              value={modReason}
              onChange={(e) => setModReason(e.target.value)}
              placeholder={modAction?.action === 'unban' ? 'Why are you lifting this ban?' : modAction?.action === 'unsuspend' ? 'Why are you lifting this suspension?' : 'Describe the reason...'}
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={modAction?.action === 'ban' ? 'danger' : 'primary'}
              onClick={handleModAction}
              disabled={modLoading || (!modReason.trim() && modAction?.action !== 'unban' && modAction?.action !== 'unsuspend')}
              className="flex-1"
            >
              {modLoading ? 'Processing...' :
                modAction?.action === 'unban' ? 'Unban & Restore' :
                modAction?.action === 'unsuspend' ? 'Unsuspend' :
                modAction?.action === 'ban' ? 'Permanently Ban' :
                modAction?.action === 'suspend' ? `Suspend for ${modDays} days` :
                'Issue Warning'
              }
            </Button>
            <Button variant="secondary" onClick={() => { setModAction(null); setModReason(''); }}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}



export function EditUserModal({ user, onClose, onSave }: {
  user: UserRow;
  onClose: () => void;
  onSave: (id: string, updates: Partial<UserRow>) => void;
}) {
  const [fullName, setFullName] = useState(user.full_name || '');
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [role, setRole] = useState(user.role || 'user');
  const [isPro, setIsPro] = useState(user.is_pro || false);

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit User" size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-surface-800">
          <Avatar src={user.avatar_url} name={user.full_name || user.email} size="lg" />
          <div>
            <p className="text-sm text-white font-medium">{user.email}</p>
            <p className="text-xs text-surface-500 font-mono">{user.id}</p>
          </div>
        </div>

        <Input
          label="Full Name"
          value={fullName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
        />
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
        />
        <Input
          label="Role"
          value={role}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole(e.target.value)}
          placeholder="user / admin / writer / producer"
        />

        {/* Pro Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-surface-700 bg-surface-800/50">
          <div>
            <p className="text-sm font-medium text-white">Pro Status</p>
            <p className="text-xs text-surface-400 mt-0.5">
              {isPro ? `Pro since ${user.pro_since ? new Date(user.pro_since).toLocaleDateString() : 'unknown'}` : 'Free tier user'}
            </p>
          </div>
          <button
            onClick={() => setIsPro(!isPro)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              isPro ? 'bg-green-500' : 'bg-surface-600'
            )}
          >
            <span className={cn(
              'inline-block h-5 w-5 rounded-full bg-surface-900 shadow-lg transition-transform duration-200',
              isPro ? 'translate-x-5' : 'translate-x-0'
            )} />
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(user.id, {
            full_name: fullName,
            display_name: displayName,
            role,
            is_pro: isPro,
            pro_since: isPro && !user.is_pro ? new Date().toISOString() : isPro ? user.pro_since : null,
          })}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}


/** Users tab with its own data: all profiles, paged past the 1000-row cap. */
export default function UsersPanel() {
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<'all' | 'pro' | 'staff' | 'new' | 'flagged'>('all');
  const [editing, setEditing] = useState<UserRow | null>(null);
  const { data: users, loading, reload } = useAdminData<UserRow[]>('users', () =>
    fetchAll<UserRow>(() => createClient().from('profiles').select('*').order('created_at', { ascending: false })), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    return users
      .filter((u) => segment === 'all'
        || (segment === 'pro' && u.is_pro)
        || (segment === 'staff' && (u.role === 'admin' || u.role === 'moderator'))
        || (segment === 'new' && u.created_at >= weekAgo)
        || (segment === 'flagged' && !!u.moderation_status && u.moderation_status !== 'clean'))
      .filter((u) => !q || `${u.email} ${u.full_name || ''} ${u.display_name || ''}`.toLowerCase().includes(q));
  }, [users, search, segment]);

  const handleUpdate = async (userId: string, updates: Partial<UserRow>) => {
    const { error } = await createClient().from('profiles').update(updates).eq('id', userId);
    if (error) toast.error(error.message);
    await reload();
    setEditing(null);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure? This will delete the user profile. Their auth account will remain in Supabase Auth.')) return;
    const supabase = createClient();
    await supabase.from('project_members').delete().eq('user_id', userId);
    await supabase.from('user_presence').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);
    await reload();
  };

  if (loading) return <TabSkeleton />;
  const created = (u: UserRow) => u.created_at;
  const week = windowCounts(users, created, 7);
  const pick = (s: typeof segment) => () => setSegment((cur) => (cur === s ? 'all' : s));
  return (
    <AdminPage>
      <PageHeader icon={<UsersIcon className="h-5 w-5" />} title="Users" description="Everyone on the platform — edit roles, moderate, message." meta={<>{week.current} joined in the last 7 days</>} />
      <StatGrid
        cols={5}
        layoutGroup="users"
        items={[
          { label: 'All users', value: users.length, tone: 'brand', onClick: () => setSegment('all'), active: segment === 'all' },
          { label: 'New · 7 days', value: week.current, delta: week.delta, tone: 'blue', spark: dailySpark(users, created), onClick: pick('new'), active: segment === 'new' },
          { label: 'Pro', value: users.filter((u) => u.is_pro).length, tone: 'amber', onClick: pick('pro'), active: segment === 'pro' },
          { label: 'Staff', value: users.filter((u) => u.role === 'admin' || u.role === 'moderator').length, tone: 'violet', onClick: pick('staff'), active: segment === 'staff' },
          { label: 'Flagged', value: users.filter((u) => u.moderation_status && u.moderation_status !== 'clean').length, tone: 'red', onClick: pick('flagged'), active: segment === 'flagged' },
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-5">
        <TrendPanel id="users-signups" className="lg:col-span-3" title="Signups" subtitle="New accounts over time" sources={[{ key: 'signups', label: 'New users', rows: users, time: created }]} />
        <Panel title="Roles" className="lg:col-span-2"><BarList items={tally(users, (u) => u.role)} limit={6} /></Panel>
      </div>
      <Reveal>
        <UsersTab users={filtered} search={search} onSearchChange={setSearch} onEdit={setEditing} onDelete={handleDelete} onRefresh={reload} />
      </Reveal>
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSave={handleUpdate} />}
    </AdminPage>
  );
}
