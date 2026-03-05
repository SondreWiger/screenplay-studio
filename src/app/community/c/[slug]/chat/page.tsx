'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubCommunity } from '@/lib/SubCommunityContext';
import { Button, Input, Modal, Avatar, LoadingSpinner } from '@/components/ui';
import { cn, formatTime } from '@/lib/utils';
import type { CommunityChannel, CommunityMessage, SubCommunityMemberRole } from '@/lib/types';

type RichMessage = CommunityMessage & {
  author: { id: string; full_name: string | null; avatar_url: string | null; username: string | null } | null;
};

type MemberRow = {
  id: string;
  user_id: string;
  role: SubCommunityMemberRole;
  user: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

const ROLE_ORDER: SubCommunityMemberRole[] = ['admin', 'moderator', 'member'];
const ROLE_COLOR: Record<string, string> = {
  admin:     'text-amber-400',
  moderator: 'text-sky-400',
  member:    'text-surface-400',
};

function channelPrefix(type: CommunityChannel['type']) {
  if (type === 'announcement') return '\u{1F4E2}';
  if (type === 'readonly')     return '\u{1F4CC}';
  return '#';
}

export default function CommunityChatPage() {
  const { community, membership, isMod } = useSubCommunity();
  const { user } = useAuth();
  const accent = community.accent_color ?? '#FF5F1F';

  // ─── Discord-only mode ────────────────────────────────────────────────────
  const discordLogoPath = 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.035.056a19.909 19.909 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';

  if (community.chat_mode === 'discord_only') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center bg-[#5865F2]/20">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#7289da">
            <path d={discordLogoPath}/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Chat happens on Discord</h2>
          <p className="text-surface-400 text-sm max-w-sm">
            This community uses Discord for real-time chat. Join the server to talk with other members.
          </p>
        </div>
        {community.discord_invite_url ? (
          <a href={community.discord_invite_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold text-white hover:opacity-90 transition-opacity bg-[#5865F2]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={discordLogoPath}/></svg>
            Join the Discord server
          </a>
        ) : (
          <p className="text-surface-600 text-sm italic">No invite link configured yet.</p>
        )}
      </div>
    );
  }

  // ─── Full chat UI ──────────────────────────────────────────────────────────
  return <CommunityChatUI community={community} membership={membership} isMod={isMod} user={user} accent={accent} discordLogoPath={discordLogoPath} />;
}

// ─── Main chat UI extracted so discord-only can return early ────────────────
function CommunityChatUI({
  community, membership, isMod, user, accent, discordLogoPath,
}: {
  community: import('@/lib/types').SubCommunity;
  membership: import('@/lib/types').SubCommunityMember | null;
  isMod: boolean;
  user: import('@/lib/types').Profile | null;
  accent: string;
  discordLogoPath: string;
}) {
  const [channels,      setChannels]      = useState<CommunityChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<CommunityChannel | null>(null);
  const [loadingChans,  setLoadingChans]  = useState(true);

  const [messages,    setMessages]    = useState<RichMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);

  const [showSidebar,  setShowSidebar]  = useState(true);
  const [showMembers,  setShowMembers]  = useState(false);
  const [showDiscord,  setShowDiscord]  = useState(false);

  const [members,       setMembers]       = useState<MemberRow[]>([]);
  const [loadingMembers,setLoadingMembers] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newDesc,    setNewDesc]    = useState('');
  const [newType,    setNewType]    = useState<CommunityChannel['type']>('text');
  const [creating,   setCreating]   = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [editingMsgId,      setEditingMsgId]      = useState<string | null>(null);
  const [editingMsgContent, setEditingMsgContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const supabase       = createClient();

  const hasDiscord = !!(community.discord_invite_url || community.discord_server_id);

  const canSend = (() => {
    if (!user || !activeChannel) return false;
    if (activeChannel.type === 'readonly')     return false;
    if (activeChannel.type === 'announcement') return isMod;
    if (community.visibility === 'public')     return true;
    return !!(membership && !['banned', 'pending_approval'].includes(membership.role));
  })();

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    const sb = createClient();
    const { data } = await sb
      .from('sub_community_members')
      .select('id, user_id, role, user:user_id(id,full_name,avatar_url)')
      .eq('community_id', community.id)
      .in('role', ['admin', 'moderator', 'member'])
      .order('role', { ascending: true });
    setMembers((data ?? []) as unknown as MemberRow[]);
    setLoadingMembers(false);
  }, [community.id]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectChannel = useCallback(async (ch: CommunityChannel) => {
    setActiveChannel(ch);
    setShowSidebar(false);
    setLoadingMsgs(true);
    const sb = createClient();
    const { data } = await sb
      .from('community_messages')
      .select('*, author:profiles!author_id(id,full_name,avatar_url,username)')
      .eq('channel_id', ch.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages((data ?? []) as RichMessage[]);
    setLoadingMsgs(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  const loadChannels = useCallback(async () => {
    setLoadingChans(true);
    const { data } = await supabase
      .from('community_channels')
      .select('*')
      .eq('community_id', community.id)
      .order('position', { ascending: true });
    const chans = (data ?? []) as CommunityChannel[];
    setChannels(chans);
    if (chans.length > 0) selectChannel(chans[0]);
    setLoadingChans(false);
  }, [community.id, selectChannel]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  useEffect(() => {
    if (!activeChannel) return;
    const sb = createClient();
    const sub = sb
      .channel(`comm_msgs:${activeChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_messages',
        filter: `channel_id=eq.${activeChannel.id}`,
      }, async (payload) => {
        const { data } = await sb
          .from('community_messages')
          .select('*, author:profiles!author_id(id,full_name,avatar_url,username)')
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setMessages(prev => prev.some(m => m.id === (data as RichMessage).id) ? prev : [...prev, data as RichMessage]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'community_messages',
        filter: `channel_id=eq.${activeChannel.id}`,
      }, (payload) => {
        const u = payload.new as CommunityMessage;
        if (u.is_deleted) setMessages(prev => prev.filter(m => m.id !== u.id));
        else setMessages(prev => prev.map(m => m.id === u.id ? { ...m, content: u.content, edited_at: u.edited_at } : m));
      })
      .subscribe();
    return () => { sb.removeChannel(sub); };
  }, [activeChannel?.id]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !activeChannel || !user || sending || !canSend) return;
    setSending(true);
    setInput('');
    await supabase.from('community_messages').insert({ channel_id: activeChannel.id, author_id: user.id, content: text });
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const saveEdit = async (id: string) => {
    const text = editingMsgContent.trim();
    if (!text) return;
    await supabase.from('community_messages').update({ content: text, edited_at: new Date().toISOString() }).eq('id', id);
    setEditingMsgId(null);
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Delete this message?')) return;
    await supabase.from('community_messages').update({ is_deleted: true }).eq('id', id);
  };

  const createChannel = async () => {
    const name = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!name || creating) return;
    setCreating(true);
    const { data, error } = await supabase.from('community_channels').insert({
      community_id: community.id, name, description: newDesc.trim() || null,
      type: newType, position: channels.length,
    }).select().single();
    if (error) {
      if (error.code === '23505') alert('A channel with that name already exists.');
      setCreating(false); return;
    }
    const ch = data as CommunityChannel;
    setChannels(prev => [...prev, ch]);
    setShowCreate(false); setNewName(''); setNewDesc(''); setNewType('text');
    selectChannel(ch);
    setCreating(false);
  };

  const openEditChannel = () => {
    if (!activeChannel) return;
    setEditName(activeChannel.name);
    setEditDesc(activeChannel.description ?? '');
    setShowEdit(true);
  };

  const saveEditChannel = async () => {
    if (!activeChannel || !editName.trim()) return;
    const name = editName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { error } = await supabase.from('community_channels')
      .update({ name, description: editDesc.trim() || null }).eq('id', activeChannel.id);
    if (error) { alert(error.message); return; }
    const updated = { ...activeChannel, name, description: editDesc.trim() || null };
    setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
    setActiveChannel(updated);
    setShowEdit(false);
  };

  const deleteChannel = async () => {
    if (!activeChannel) return;
    if (!confirm(`Delete #${activeChannel.name} and all its messages?`)) return;
    await supabase.from('community_channels').delete().eq('id', activeChannel.id);
    const remaining = channels.filter(c => c.id !== activeChannel.id);
    setChannels(remaining);
    setShowEdit(false);
    if (remaining.length > 0) selectChannel(remaining[0]); else setActiveChannel(null);
  };

  return (
    <div className="h-[calc(100vh-3rem)] md:h-screen flex flex-col bg-surface-950 -mx-4 -my-6">

      {/* ── Top bar ── */}
      <header className="border-b border-surface-800 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSidebar(v => !v)} className="md:hidden p-1 text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-sm font-bold text-white">Community Chat</h1>
          {activeChannel && (
            <span className="text-surface-500 text-sm hidden sm:inline">
              #{activeChannel.name}
              {activeChannel.description && (
                <span className="text-surface-600 ml-2 hidden md:inline">— {activeChannel.description}</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasDiscord && (
            <button
              onClick={() => setShowDiscord(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                showDiscord ? 'bg-[#5865F2]/20 text-[#7289da]' : 'text-surface-400 hover:text-white hover:bg-surface-800',
              )}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={discordLogoPath}/></svg>
              <span className="hidden sm:inline">Discord</span>
            </button>
          )}
          <button
            onClick={() => setShowMembers(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              showMembers ? 'bg-surface-800 text-white' : 'text-surface-400 hover:text-white hover:bg-surface-800',
            )}
            title="Toggle members"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span className="hidden sm:inline">{members.length}</span>
          </button>
        </div>
      </header>

      {/* ── Discord panel ── */}
      {showDiscord && hasDiscord && (
        <div className="border-b border-surface-800 px-4 py-3 flex flex-wrap items-start gap-4 bg-[#5865F2]/5 shrink-0">
          {community.discord_server_id && (
            <iframe
              src={`https://discord.com/widget?id=${community.discord_server_id}&theme=dark`}
              width="350" height="260" frameBorder="0"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              className="rounded-xl shrink-0"
            />
          )}
          {community.discord_invite_url && (
            <div className="rounded-xl p-4 shrink-0" style={{ background: 'rgba(88,101,242,0.12)', border: '1px solid rgba(88,101,242,0.25)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-[#5865F2]/20">
                  {community.icon ?? '\u{1F3A6}'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{community.name}</p>
                  <p className="text-[11px] text-surface-500">Discord Server</p>
                </div>
              </div>
              <a href={community.discord_invite_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity bg-[#5865F2]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={discordLogoPath}/></svg>
                Join Discord
              </a>
            </div>
          )}
          <button onClick={() => setShowDiscord(false)} className="ml-auto text-surface-500 hover:text-surface-300 mt-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">

        {/* ── Channel sidebar ── */}
        <aside className={cn(
          'w-full md:w-56 lg:w-60 shrink-0 border-r border-surface-800 flex flex-col bg-surface-950',
          !showSidebar && 'hidden md:flex',
        )}>
          <div className="px-3 py-2.5 flex items-center justify-between border-b border-surface-800/50">
            <span className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Channels</span>
            {isMod && (
              <button onClick={() => setShowCreate(true)}
                className="p-1 rounded hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
                title="New channel">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
              </button>
            )}
          </div>

          {loadingChans ? (
            <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
          ) : (
            <nav className="flex-1 overflow-y-auto py-1">
              {channels.map(ch => {
                const isActive = activeChannel?.id === ch.id;
                return (
                  <button key={ch.id} onClick={() => selectChannel(ch)}
                    className={cn(
                      'text-left px-3 py-1.5 flex items-center gap-2 hover:bg-surface-800/50 transition-colors rounded-md mx-1',
                      isActive ? 'bg-surface-800 text-white' : 'text-surface-400',
                    )}
                    style={{ width: 'calc(100% - 8px)' }}>
                    <span className="text-surface-500 text-sm shrink-0">{channelPrefix(ch.type)}</span>
                    <span className="text-sm truncate flex-1">{ch.name}</span>
                    {ch.type === 'announcement' && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/70 shrink-0">ann</span>}
                    {ch.type === 'readonly'     && <span className="text-[9px] px-1 py-0.5 rounded bg-surface-800 text-surface-500 shrink-0">ro</span>}
                  </button>
                );
              })}
              {channels.length === 0 && (
                <p className="px-4 py-4 text-[11px] text-surface-600 text-center">No channels yet</p>
              )}
            </nav>
          )}
        </aside>

        {/* ── Message area ── */}
        <div className={cn('flex-1 flex flex-col min-w-0', showSidebar && 'hidden md:flex')}>
          {!activeChannel ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <svg className="w-16 h-16 mx-auto mb-4 text-surface-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
                </svg>
                <p className="text-surface-500 text-lg">Select a channel to start chatting</p>
              </div>
            </div>
          ) : (
            <>
              {/* Channel header */}
              <div className="border-b border-surface-800 px-4 py-2 flex items-center gap-3 shrink-0">
                <button onClick={() => setShowSidebar(true)} className="md:hidden p-1 text-surface-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                  </svg>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-surface-500 mr-0.5">{channelPrefix(activeChannel.type)}</span>
                    <h2 className="text-sm font-semibold text-white">{activeChannel.name}</h2>
                    {activeChannel.type === 'announcement' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400">Announcements</span>
                    )}
                    {activeChannel.type === 'readonly' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-surface-800 text-surface-500">Read-only</span>
                    )}
                    {isMod && (
                      <button onClick={openEditChannel}
                        className="p-0.5 rounded hover:bg-surface-800 text-surface-600 hover:text-surface-300 transition-colors" title="Edit channel">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  {activeChannel.description && (
                    <p className="text-[11px] text-surface-500 truncate">{activeChannel.description}</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center">
                    <div>
                      <div className="text-4xl mb-3">{channelPrefix(activeChannel.type)}</div>
                      <p className="text-surface-400 font-semibold">Welcome to #{activeChannel.name}</p>
                      <p className="text-surface-600 text-sm mt-1">
                        {activeChannel.description ?? 'This is the start of the channel.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const prevMsg = messages[idx - 1];
                    const showHeader =
                      !prevMsg ||
                      prevMsg.author_id !== msg.author_id ||
                      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000;
                    const displayName = msg.author?.full_name ?? msg.author?.username ?? 'Unknown';
                    const isOwn  = msg.author_id === user?.id;
                    const canDel = isOwn || isMod;

                    return (
                      <div key={msg.id}
                        className={cn('group hover:bg-surface-900/30 rounded-lg px-2 py-0.5', showHeader && 'mt-3 pt-1')}>
                        {showHeader ? (
                          <div className="flex items-start gap-3">
                            <Avatar src={msg.author?.avatar_url} name={displayName} size="sm" className="shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold" style={{ color: isOwn ? accent : '#d1d5db' }}>
                                  {displayName}
                                </span>
                                <span className="text-[10px] text-surface-600">{formatTime(msg.created_at)}</span>
                                {msg.edited_at && <span className="text-[10px] text-surface-600 italic">(edited)</span>}
                              </div>
                              {editingMsgId === msg.id ? (
                                <EditBox value={editingMsgContent} onChange={setEditingMsgContent}
                                  onSave={() => saveEdit(msg.id)} onCancel={() => setEditingMsgId(null)} accent={accent} />
                              ) : (
                                <p className="text-sm text-surface-200 break-words mt-0.5 whitespace-pre-wrap">{msg.content}</p>
                              )}
                            </div>
                            {editingMsgId !== msg.id && (
                              <MsgActions isOwn={isOwn} canDel={canDel}
                                onEdit={() => { setEditingMsgId(msg.id); setEditingMsgContent(msg.content); }}
                                onDelete={() => deleteMessage(msg.id)}
                                timestamp={formatTime(msg.created_at)} />
                            )}
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="w-8 shrink-0 text-center">
                              <span className="text-[9px] text-surface-700 opacity-0 group-hover:opacity-100 transition-opacity select-none">
                                {formatTime(msg.created_at)}
                              </span>
                            </div>
                            {editingMsgId === msg.id ? (
                              <div className="flex-1 min-w-0">
                                <EditBox value={editingMsgContent} onChange={setEditingMsgContent}
                                  onSave={() => saveEdit(msg.id)} onCancel={() => setEditingMsgId(null)} accent={accent} />
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-surface-200 break-words flex-1 whitespace-pre-wrap">{msg.content}</p>
                                <MsgActions isOwn={isOwn} canDel={canDel}
                                  onEdit={() => { setEditingMsgId(msg.id); setEditingMsgContent(msg.content); }}
                                  onDelete={() => deleteMessage(msg.id)}
                                  timestamp={formatTime(msg.created_at)} />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="border-t border-surface-800 p-3 shrink-0">
                {!user ? (
                  <p className="text-center text-sm text-surface-500 py-1">
                    <a href="/login" className="underline" style={{ color: accent }}>Sign in</a> to join the conversation
                  </p>
                ) : !canSend ? (
                  <p className="text-center text-sm text-surface-500 py-1">
                    {activeChannel.type === 'readonly' ? 'This channel is read-only'
                      : activeChannel.type === 'announcement' ? 'Only moderators can post announcements'
                      : 'Join this community to chat'}
                  </p>
                ) : (
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message #${activeChannel.name}\u2026`}
                      rows={1}
                      className="flex-1 px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-white text-sm resize-none focus:outline-none focus:ring-2 placeholder-surface-500"
                      style={{ maxHeight: 120, focusRingColor: accent + '80' } as React.CSSProperties}
                      onInput={e => {
                        const t = e.target as HTMLTextAreaElement;
                        t.style.height = 'auto';
                        t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                      }}
                    />
                    <Button onClick={sendMessage} disabled={!input.trim() || sending} className="shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                      </svg>
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Members sidebar ── */}
        {showMembers && (
          <aside className="w-52 lg:w-56 shrink-0 border-l border-surface-800 flex flex-col bg-surface-950 hidden md:flex">
            <div className="px-3 py-2.5 border-b border-surface-800/50 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">
                Members — {members.length}
              </span>
              {loadingMembers && <LoadingSpinner className="w-3 h-3" />}
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
              {ROLE_ORDER.map(role => {
                const roleMembers = members.filter(m => m.role === role);
                if (roleMembers.length === 0) return null;
                return (
                  <div key={role}>
                    <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-1 px-1', ROLE_COLOR[role])}>
                      {role}s — {roleMembers.length}
                    </p>
                    {roleMembers.map(m => (
                      <div key={m.user_id} className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-surface-900/40 transition-colors">
                        <Avatar src={m.user?.avatar_url} name={m.user?.full_name ?? undefined} size="sm" className="shrink-0" />
                        <p className={cn('text-xs font-medium truncate', ROLE_COLOR[m.role])}>
                          {m.user?.full_name ?? 'Member'}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })}
              {members.length === 0 && !loadingMembers && (
                <p className="text-[11px] text-surface-600 text-center px-2 mt-2">No members yet</p>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Create channel modal ── */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setNewName(''); setNewDesc(''); setNewType('text'); }}
        title="New Channel"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Channel Name</label>
            <div className="flex items-center gap-1">
              <span className="text-surface-500 text-lg">#</span>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g. script-feedback"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-surface-600 mt-1">Lowercase, hyphens, no spaces</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Description (optional)</label>
            <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What is this channel about?" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Type</label>
            <div className="flex gap-2">
              {(['text', 'announcement', 'readonly'] as const).map(t => (
                <button key={t} type="button" onClick={() => setNewType(t)}
                  className={cn(
                    'flex-1 py-2 text-xs font-medium rounded-lg border transition-colors capitalize',
                    newType === t ? 'text-white border-transparent' : 'border-surface-700 text-surface-400 hover:text-surface-200',
                  )}
                  style={newType === t ? { background: accent } : undefined}>
                  {t}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-surface-600 mt-1.5">
              {newType === 'text'         && 'Members can post freely'}
              {newType === 'announcement' && 'Only mods can post \u2014 great for pinned updates'}
              {newType === 'readonly'     && 'Nobody posts \u2014 pinboard style'}
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={createChannel} disabled={!newName.trim() || creating} className="flex-1">
              {creating ? 'Creating\u2026' : 'Create Channel'}
            </Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit channel modal ── */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Edit #${activeChannel?.name}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Channel Name</label>
            <div className="flex items-center gap-1">
              <span className="text-surface-500 text-lg">#</span>
              <Input value={editName}
                onChange={e => setEditName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                autoFocus />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Description</label>
            <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Channel description" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={saveEditChannel} disabled={!editName.trim()} className="flex-1">Save Changes</Button>
            <Button variant="secondary" onClick={deleteChannel} className="text-red-400 hover:text-red-300">Delete</Button>
            <Button variant="secondary" onClick={() => setShowEdit(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function EditBox({ value, onChange, onSave, onCancel, accent }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; accent: string;
}) {
  return (
    <div className="mt-1 space-y-1.5">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(); }
          if (e.key === 'Escape') onCancel();
        }}
        autoFocus rows={2}
        className="w-full resize-none px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-surface-600"
      />
      <div className="flex gap-2 items-center text-[11px]">
        <button onClick={onSave}
          className="px-2 py-0.5 rounded-lg text-white text-xs transition-opacity hover:opacity-80"
          style={{ background: accent }}>Save</button>
        <button onClick={onCancel}
          className="px-2 py-0.5 rounded-lg text-xs bg-surface-800 text-surface-300 hover:text-white">Cancel</button>
        <span className="text-surface-600">esc to cancel \u00b7 enter to save</span>
      </div>
    </div>
  );
}

function MsgActions({ isOwn, canDel, onEdit, onDelete, timestamp }: {
  isOwn: boolean; canDel: boolean; onEdit: () => void; onDelete: () => void; timestamp: string;
}) {
  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
      <span className="text-[9px] text-surface-700 mr-1 select-none">{timestamp}</span>
      {isOwn && (
        <button onClick={onEdit}
          className="p-1 rounded hover:bg-surface-800 text-surface-600 hover:text-surface-300 transition-colors" title="Edit">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
          </svg>
        </button>
      )}
      {canDel && (
        <button onClick={onDelete}
          className="p-1 rounded hover:bg-red-500/10 text-surface-600 hover:text-red-400 transition-colors" title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      )}
    </div>
  );
}
