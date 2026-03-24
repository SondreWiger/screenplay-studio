'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectStore } from '@/lib/stores';
import { Button, Input, Modal, Avatar, Badge, LoadingSpinner, toast } from '@/components/ui';
import { cn, timeAgo, formatTime } from '@/lib/utils';
import type { ProjectChannel, ChannelMessage, ProjectMember, UserRole, ProductionRole } from '@/lib/types';
import { FormattedChatText } from '@/components/FormattedChatText';
import { automodCheck } from '@/lib/automod';
import { PRODUCTION_ROLES } from '@/lib/types';

// ============================================================
// Role → colour mapping for chat name display
// ============================================================

const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'text-amber-400',
  admin: 'text-red-400',
  writer: 'text-sky-400',
  editor: 'text-emerald-400',
  viewer: 'text-surface-400',
};

const ROLE_BADGES: Record<UserRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-[#FF5F1F]/20 text-[#FF5F1F]' },
  admin: { label: 'Admin', color: 'bg-red-500/20 text-red-400' },
  writer: { label: 'Writer', color: 'bg-sky-500/20 text-sky-400' },
  editor: { label: 'Editor', color: 'bg-emerald-500/20 text-emerald-400' },
  viewer: { label: 'Viewer', color: 'bg-surface-700 text-surface-400' },
};

export default function ProjectChatPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { currentProject, members } = useProjectStore();
  const projectId = params.id;

  // Channels
  const [channels, setChannels] = useState<ProjectChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ProjectChannel | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);

  // Messages
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Create channel modal
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);

  // Edit / delete channel
  const [showEditChannel, setShowEditChannel] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Mobile sidebar
  const [showChannelList, setShowChannelList] = useState(true);
  // Members sidebar
  const [showMembers, setShowMembers] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Current user's project role
  const currentMember = members.find((m) => m.user_id === user?.id);
  const currentRole: UserRole =
    currentMember?.role || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  // Member lookup by user_id → ProjectMember (for role colours)
  const memberMap = new Map(members.map((m) => [m.user_id, m]));

  const getRoleForUser = (userId: string): UserRole => {
    const m = memberMap.get(userId);
    if (m) return m.role;
    if (currentProject?.created_by === userId) return 'owner';
    return 'viewer';
  };

  const getProductionRoleLabel = (userId: string): string | null => {
    const m = memberMap.get(userId);
    if (!m?.production_role) return null;
    return PRODUCTION_ROLES.find((r) => r.value === m.production_role)?.label || null;
  };

  // ============================================================
  // FETCH CHANNELS
  // ============================================================

  useEffect(() => {
    if (user && projectId) fetchChannels();
  }, [user, projectId]);

  const fetchChannels = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('project_channels')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      let channelsList = data || [];

      // Auto-create #general if no channels exist
      if (channelsList.length === 0 && user) {
        const { data: general, error: createErr } = await supabase
          .from('project_channels')
          .insert({
            project_id: projectId,
            name: 'general',
            description: 'General discussion',
            is_default: true,
            sort_order: 0,
            created_by: user.id,
          })
          .select()
          .single();

        if (!createErr && general) {
          channelsList = [general];

          // System welcome message
          await supabase.from('channel_messages').insert({
            channel_id: general.id,
            sender_id: user.id,
            content: 'Welcome to the project chat! This is the #general channel.',
            message_type: 'system',
          });
        }
      }

      setChannels(channelsList);

      // Auto-select first channel
      if (channelsList.length > 0 && !selectedChannel) {
        selectChannel(channelsList[0]);
      }
    } catch (err) {
      console.error('Error fetching channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  };

  // ============================================================
  // SELECT CHANNEL & LOAD MESSAGES
  // ============================================================

  const selectChannel = async (channel: ProjectChannel) => {
    setSelectedChannel(channel);
    setShowChannelList(false);
    setLoadingMessages(true);

    try {
      const supabase = createClient();
      const { data: msgs } = await supabase
        .from('channel_messages')
        .select('*, sender:profiles!sender_id(*)')
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: true })
        .limit(200);

      setMessages(msgs || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // ============================================================
  // REALTIME
  // ============================================================

  useEffect(() => {
    if (!selectedChannel) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`chan:${selectedChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${selectedChannel.id}`,
        },
        async (payload) => {
          const { data: msg, error: msgError } = await supabase
            .from('channel_messages')
            .select('*, sender:profiles!sender_id(*)')
            .eq('id', payload.new.id)
            .single();

          if (msgError) {
            console.error('Failed to fetch channel message:', msgError.message);
            return;
          }

          if (msg) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChannel?.id]);

  // ============================================================
  // SEND MESSAGE
  // ============================================================

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || sending) return;
    setSending(true);

    try {
      const supabase = createClient();
      const { data: msg } = await supabase.from('channel_messages').insert({
        channel_id: selectedChannel.id,
        sender_id: user!.id,
        content: newMessage.trim(),
        message_type: 'text',
      }).select('id').single();

      // Auto-mod check (fire-and-forget)
      if (msg) {
        automodCheck({
          text: newMessage.trim(),
          contentType: 'channel_message',
          contentId: msg.id,
          projectId: projectId,
          userId: user!.id,
          getAccessToken: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            return session?.access_token;
          },
        });
      }

      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ============================================================
  // CREATE CHANNEL
  // ============================================================

  const createChannel = async () => {
    if (!channelName.trim() || creatingChannel) return;
    setCreatingChannel(true);

    try {
      const supabase = createClient();
      const sanitized = channelName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');

      const { data: ch, error } = await supabase
        .from('project_channels')
        .insert({
          project_id: projectId,
          name: sanitized,
          description: channelDesc.trim() || null,
          sort_order: channels.length,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') alert('A channel with that name already exists.');
        else throw error;
        return;
      }

      // System message
      await supabase.from('channel_messages').insert({
        channel_id: ch.id,
        sender_id: user!.id,
        content: `${user!.full_name || user!.email} created #${sanitized}`,
        message_type: 'system',
      });

      setChannels((prev) => [...prev, ch]);
      setShowCreateChannel(false);
      setChannelName('');
      setChannelDesc('');
      selectChannel(ch);
    } catch (err) {
      console.error('Error creating channel:', err);
    } finally {
      setCreatingChannel(false);
    }
  };

  // ============================================================
  // EDIT CHANNEL
  // ============================================================

  const openEditChannel = () => {
    if (!selectedChannel) return;
    setEditName(selectedChannel.name);
    setEditDesc(selectedChannel.description || '');
    setShowEditChannel(true);
  };

  const saveEditChannel = async () => {
    if (!selectedChannel || !editName.trim()) return;

    try {
      const supabase = createClient();
      const sanitized = editName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');

      const { error } = await supabase
        .from('project_channels')
        .update({ name: sanitized, description: editDesc.trim() || null })
        .eq('id', selectedChannel.id);

      if (error) throw error;

      const updated = { ...selectedChannel, name: sanitized, description: editDesc.trim() || null };
      setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelectedChannel(updated);
      setShowEditChannel(false);
    } catch (err) {
      console.error('Error updating channel:', err);
    }
  };

  const deleteChannel = async () => {
    if (!selectedChannel || selectedChannel.is_default) return;
    if (!confirm(`Delete #${selectedChannel.name}? All messages will be lost.`)) return;

    try {
      const supabase = createClient();
      await supabase.from('project_channels').delete().eq('id', selectedChannel.id);

      setChannels((prev) => prev.filter((c) => c.id !== selectedChannel.id));
      setShowEditChannel(false);

      // Select next available channel
      const remaining = channels.filter((c) => c.id !== selectedChannel.id);
      if (remaining.length > 0) selectChannel(remaining[0]);
      else setSelectedChannel(null);
    } catch (err) {
      console.error('Error deleting channel:', err);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="h-[calc(100vh-3rem)] md:h-screen flex flex-col bg-surface-950">
      {/* Top bar */}
      <header className="border-b border-surface-800 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowChannelList((v) => !v)} className="md:hidden p-1 text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-lg font-bold text-white">Project Chat</h1>
          {selectedChannel && (
            <span className="text-surface-500 text-sm hidden sm:inline">#{selectedChannel.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMembers((v) => !v)}
            className={cn('p-1.5 rounded-lg transition-colors', showMembers ? 'bg-surface-900/10 text-white' : 'text-surface-400 hover:text-white')}
            title="Toggle members"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ============================================================ */}
        {/* CHANNEL SIDEBAR */}
        {/* ============================================================ */}
        <aside className={cn(
          'w-full md:w-56 lg:w-60 border-r border-surface-800 flex flex-col bg-surface-950 shrink-0',
          !showChannelList && 'hidden md:flex',
        )}>
          <div className="px-3 py-2.5 flex items-center justify-between border-b border-surface-800/50">
            <span className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Channels</span>
            {isAdmin && (
              <button
                onClick={() => setShowCreateChannel(true)}
                className="p-1 rounded hover:bg-surface-900/10 text-surface-400 hover:text-white transition-colors"
                title="New channel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            )}
          </div>

          {loadingChannels ? (
            <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
          ) : channels.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4 text-center">
              <p className="text-surface-500 text-sm">No channels yet</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-1">
              {channels.map((ch) => {
                const isActive = selectedChannel?.id === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => selectChannel(ch)}
                    className={cn(
                      'w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-surface-900/5 transition-colors group rounded-md mx-1',
                      isActive && 'bg-surface-900/10 text-white',
                      !isActive && 'text-surface-400',
                    )}
                    style={{ width: 'calc(100% - 8px)' }}
                  >
                    <span className="text-surface-500 text-sm">#</span>
                    <span className="text-sm truncate flex-1">{ch.name}</span>
                    {ch.is_default && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-500 shrink-0">default</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* ============================================================ */}
        {/* MESSAGE AREA */}
        {/* ============================================================ */}
        <div className={cn('flex-1 flex flex-col min-w-0', showChannelList && 'hidden md:flex')}>
          {!selectedChannel ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <svg className="w-16 h-16 mx-auto mb-4 text-surface-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <p className="text-surface-500 text-lg">Select a channel</p>
              </div>
            </div>
          ) : (
            <>
              {/* Channel header */}
              <div className="border-b border-surface-800 px-4 py-2 flex items-center gap-3 shrink-0">
                <button onClick={() => setShowChannelList(true)} className="md:hidden p-1 text-surface-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">#{selectedChannel.name}</h2>
                    {isAdmin && (
                      <button onClick={openEditChannel} className="p-0.5 rounded hover:bg-surface-900/10 text-surface-500 hover:text-white transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    )}
                  </div>
                  {selectedChannel.description && (
                    <p className="text-[11px] text-surface-500 truncate">{selectedChannel.description}</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {loadingMessages ? (
                  <LoadingSpinner className="py-16" />
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center">
                    <div>
                      <p className="text-surface-500">No messages in #{selectedChannel.name}</p>
                      <p className="text-surface-600 text-sm mt-1">Be the first to say something!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOwn = msg.sender_id === user?.id;
                    const isSystem = msg.message_type === 'system';
                    const prevMsg = messages[idx - 1];
                    const showHeader =
                      !prevMsg ||
                      prevMsg.sender_id !== msg.sender_id ||
                      prevMsg.message_type === 'system' ||
                      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000;

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center py-2">
                          <span className="text-[11px] text-surface-500 bg-surface-900 px-3 py-1 rounded-full">{msg.content}</span>
                        </div>
                      );
                    }

                    const senderRole = getRoleForUser(msg.sender_id);
                    const roleColor = ROLE_COLORS[senderRole];
                    const roleBadge = ROLE_BADGES[senderRole];
                    const prodRole = getProductionRoleLabel(msg.sender_id);

                    return (
                      <div key={msg.id} className={cn('group hover:bg-surface-900/[0.02] rounded-lg px-2 py-0.5', showHeader && 'mt-3 pt-1')}>
                        {showHeader ? (
                          <div className="flex items-start gap-3">
                            <Avatar
                              src={msg.sender?.avatar_url}
                              name={msg.sender?.full_name}
                              size="sm"
                              className="shrink-0 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn('text-sm font-semibold', roleColor)}>
                                  {msg.sender?.full_name || msg.sender?.display_name || 'User'}
                                </span>
                                <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', roleBadge.color)}>
                                  {roleBadge.label}
                                </span>
                                {prodRole && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-[#FF5F1F]/20 text-[#FF5F1F]">
                                    {prodRole}
                                  </span>
                                )}
                                <span className="text-[10px] text-surface-600">{formatTime(msg.created_at)}</span>
                              </div>
                              <p className="text-sm text-surface-200 break-words mt-0.5"><FormattedChatText content={msg.content} /></p>
                            </div>
                            <span className="text-[10px] text-surface-600 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="w-8 shrink-0 text-center">
                              <span className="text-[9px] text-surface-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                {formatTime(msg.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-surface-200 break-words flex-1"><FormattedChatText content={msg.content} /></p>
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
                <div className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message #${selectedChannel.name}...`}
                    className="flex-1 px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#FF5F1F]/50 placeholder-surface-500"
                    rows={1}
                    style={{ maxHeight: '120px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                    }}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="shrink-0 self-end"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ============================================================ */}
        {/* MEMBERS SIDEBAR */}
        {/* ============================================================ */}
        {showMembers && (
          <aside className="w-56 lg:w-60 border-l border-surface-800 flex flex-col bg-surface-950 shrink-0 hidden md:flex">
            <div className="px-3 py-2.5 border-b border-surface-800/50">
              <span className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">
                Members — {members.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {/* Group by role */}
              {(['owner', 'admin', 'writer', 'editor', 'viewer'] as UserRole[]).map((role) => {
                const roleMembers = members.filter((m) => m.role === role);
                if (roleMembers.length === 0) return null;

                return (
                  <div key={role} className="mb-3">
                    <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-1 px-2', ROLE_COLORS[role])}>
                      {role}s — {roleMembers.length}
                    </p>
                    {roleMembers.map((m) => (
                      <div key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-900/5">
                        <Avatar src={m.profile?.avatar_url} name={m.profile?.full_name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-xs font-medium truncate', ROLE_COLORS[role])}>
                            {m.profile?.full_name || m.profile?.email || 'User'}
                          </p>
                          {m.production_role && (
                            <p className="text-[10px] text-[#FF5F1F] truncate">
                              {PRODUCTION_ROLES.find((r) => r.value === m.production_role)?.label || m.production_role}
                            </p>
                          )}
                          {!m.production_role && m.job_title && (
                            <p className="text-[10px] text-surface-600 truncate">{m.job_title}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Also show the project creator if not in members list */}
              {currentProject && !members.some((m) => m.user_id === currentProject.created_by) && (
                <div className="mb-3">
                  <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-1 px-2', ROLE_COLORS.owner)}>
                    Owner — 1
                  </p>
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-900/5">
                    <Avatar src={user?.avatar_url} name={user?.full_name} size="sm" />
                    <p className={cn('text-xs font-medium truncate', ROLE_COLORS.owner)}>
                      {user?.full_name || user?.email || 'Project Owner'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ============================================================ */}
      {/* CREATE CHANNEL MODAL */}
      {/* ============================================================ */}
      <Modal isOpen={showCreateChannel} onClose={() => { setShowCreateChannel(false); setChannelName(''); setChannelDesc(''); }} title="New Channel">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Channel Name</label>
            <div className="flex items-center gap-1">
              <span className="text-surface-500 text-lg">#</span>
              <Input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, ''))}
                placeholder="e.g. script-notes"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-surface-600 mt-1">Lowercase, hyphens, no spaces</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Description (optional)</label>
            <Input
              value={channelDesc}
              onChange={(e) => setChannelDesc(e.target.value)}
              placeholder="What's this channel about?"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={createChannel} disabled={!channelName.trim() || creatingChannel} className="flex-1">
              {creatingChannel ? 'Creating...' : 'Create Channel'}
            </Button>
            <Button variant="secondary" onClick={() => setShowCreateChannel(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* EDIT CHANNEL MODAL */}
      {/* ============================================================ */}
      <Modal isOpen={showEditChannel} onClose={() => setShowEditChannel(false)} title={`Edit #${selectedChannel?.name}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Channel Name</label>
            <div className="flex items-center gap-1">
              <span className="text-surface-500 text-lg">#</span>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, ''))}
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Description</label>
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Channel description"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={saveEditChannel} disabled={!editName.trim()} className="flex-1">
              Save Changes
            </Button>
            {!selectedChannel?.is_default && (
              <Button variant="secondary" onClick={deleteChannel} className="text-red-400 hover:text-red-300">
                Delete
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowEditChannel(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
