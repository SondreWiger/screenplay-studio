'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button, Card, Modal, Input, Avatar, Badge, LoadingSpinner, toast } from '@/components/ui';
import { cn, timeAgo, formatTime } from '@/lib/utils';
import { notifyConversationMembers } from '@/lib/notifications';
import Link from 'next/link';
import type { Conversation, ConversationMember, DirectMessage, Profile } from '@/lib/types';
import { FormattedChatText } from '@/components/FormattedChatText';

export default function MessagesClient() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  useNotifications(user?.id);

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);
  const [autoSelectDone, setAutoSelectDone] = useState(false);

  // New conversation form
  const [searchUsers, setSearchUsers] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [searching, setSearching] = useState(false);

  // Add members to existing conversation
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addMemberResults, setAddMemberResults] = useState<Profile[]>([]);
  const [addMemberSelected, setAddMemberSelected] = useState<Profile[]>([]);
  const [addMemberSearching, setAddMemberSearching] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ============================================================
  // FETCH CONVERSATIONS
  // ============================================================

  useEffect(() => {
    if (user) fetchConversations();
  }, [user]);

  // Auto-select conversation from ?convo= query param
  useEffect(() => {
    if (autoSelectDone || loading || conversations.length === 0) return;
    const convoId = searchParams.get('convo');
    if (convoId) {
      const target = conversations.find((c) => c.id === convoId);
      if (target) {
        selectConvo(target);
        setAutoSelectDone(true);
      }
    }
  }, [conversations, loading, autoSelectDone, searchParams]);

  const fetchConversations = async () => {
    try {
      const supabase = createClient();
      const { data: convMembers } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user!.id);

      if (!convMembers || convMembers.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const convIds = convMembers.map((cm) => cm.conversation_id);
      const { data: convos } = await supabase
        .from('conversations')
        .select('*')
        .in('id', convIds)
        .order('last_message_at', { ascending: false });

      if (!convos) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get members for each conversation with profiles
      const { data: allMembers } = await supabase
        .from('conversation_members')
        .select('*, profile:profiles!user_id(*)')
        .in('conversation_id', convIds);

      // Get last message for each conversation
      const enriched: Conversation[] = [];
      for (const conv of convos) {
        const convMembers = (allMembers || []).filter((m) => m.conversation_id === conv.id);
        const myMembership = convMembers.find((m) => m.user_id === user!.id);

        // Get last message
        const { data: lastMsg, error: lastMsgError } = await supabase
          .from('direct_messages')
          .select('*, sender:profiles!sender_id(*)')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastMsgError) console.error('Failed to fetch last message:', lastMsgError.message);

        // Count unread
        let unreadCount = 0;
        if (myMembership) {
          const { count } = await supabase
            .from('direct_messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .gt('created_at', myMembership.last_read_at)
            .neq('sender_id', user!.id);
          unreadCount = count || 0;
        }

        enriched.push({
          ...conv,
          members: convMembers,
          last_message: lastMsg || undefined,
          unread_count: unreadCount,
        });
      }

      setConversations(enriched);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SELECT CONVERSATION
  // ============================================================

  const selectConvo = async (conv: Conversation) => {
    setSelectedConvo(conv);
    setShowMobileList(false);
    setMessagesLoading(true);

    try {
      const supabase = createClient();
      // Fetch messages
      const { data: msgs } = await supabase
        .from('direct_messages')
        .select('*, sender:profiles!sender_id(*)')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(100);

      setMessages(msgs || []);

      // Fetch members
      const { data: mems } = await supabase
        .from('conversation_members')
        .select('*, profile:profiles!user_id(*)')
        .eq('conversation_id', conv.id);

      setMembers(mems || []);

      // Mark as read
      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conv.id)
        .eq('user_id', user!.id);

      // Update unread count in conversations list
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
      );

      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Error loading conversation:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  // ============================================================
  // REALTIME SUBSCRIPTION
  // ============================================================

  useEffect(() => {
    if (!selectedConvo) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${selectedConvo.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${selectedConvo.id}` },
        async (payload) => {
          // Fetch the message with sender profile
          const { data: msg, error: msgError } = await supabase
            .from('direct_messages')
            .select('*, sender:profiles!sender_id(*)')
            .eq('id', payload.new.id)
            .single();

          if (msgError) {
            console.error('Failed to fetch message:', msgError.message);
            return;
          }

          if (msg) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            // Mark as read if in conversation
            await supabase
              .from('conversation_members')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', selectedConvo.id)
              .eq('user_id', user!.id);

            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConvo?.id]);

  // ============================================================
  // SEND MESSAGE
  // ============================================================

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConvo || sending) return;
    setSending(true);

    try {
      const supabase = createClient();
      const { data: msg, error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: selectedConvo.id,
          sender_id: user!.id,
          content: newMessage.trim(),
          message_type: 'text',
        })
        .select('*, sender:profiles!sender_id(*)')
        .single();

      if (error) throw error;

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConvo.id);

      setNewMessage('');
      inputRef.current?.focus();

      // Notify other members of the conversation
      const senderName = (user as Profile)?.display_name || (user as Profile)?.full_name || (user as Profile)?.email || 'Someone';
      notifyConversationMembers({
        conversationId: selectedConvo.id,
        senderId: user!.id,
        senderName,
        messagePreview: newMessage.trim(),
      });

      // Update conversations list
      setConversations((prev) =>
        prev
          .map((c) => (c.id === selectedConvo.id ? { ...c, last_message_at: new Date().toISOString(), last_message: msg } : c))
          .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      );
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  // ============================================================
  // SEARCH USERS
  // ============================================================

  useEffect(() => {
    if (searchUsers.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`full_name.ilike.%${searchUsers}%,display_name.ilike.%${searchUsers}%,email.ilike.%${searchUsers}%`)
        .neq('id', user!.id)
        .limit(10);

      setSearchResults(
        (data || []).filter(
          (p) => !selectedUsers.some((u) => u.id === p.id)
        )
      );
      setSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchUsers]);

  // ============================================================
  // CREATE CONVERSATION
  // ============================================================

  const createConversation = async () => {
    if (selectedUsers.length === 0) return;

    const isGroup = selectedUsers.length > 1;
    const supabase = createClient();

    // For direct messages, check if conversation already exists
    if (!isGroup) {
      const otherUser = selectedUsers[0];
      const existing = conversations.find((c) => {
        if (c.conversation_type !== 'direct') return false;
        return c.members?.some((m) => m.user_id === otherUser.id);
      });

      if (existing) {
        selectConvo(existing);
        setShowNewConvo(false);
        setSelectedUsers([]);
        setSearchUsers('');
        return;
      }
    }

    // Create conversation
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({
        conversation_type: isGroup ? 'group' : 'direct',
        name: isGroup ? (groupName || selectedUsers.map((u) => u.full_name || u.email).join(', ')) : null,
        created_by: user!.id,
      })
      .select()
      .single();

    if (error || !conv) {
      console.error('Error creating conversation:', error?.message);
      return;
    }

    // Add members (self + selected)
    const memberInserts = [
      { conversation_id: conv.id, user_id: user!.id, role: 'admin' },
      ...selectedUsers.map((u) => ({ conversation_id: conv.id, user_id: u.id, role: 'member' })),
    ];

    await supabase.from('conversation_members').insert(memberInserts);

    // Add system message
    await supabase.from('direct_messages').insert({
      conversation_id: conv.id,
      sender_id: user!.id,
      content: `${user!.full_name || user!.email} created this conversation`,
      message_type: 'system',
    });

    setShowNewConvo(false);
    setSelectedUsers([]);
    setSearchUsers('');
    setGroupName('');

    await fetchConversations();

    // Select the new conversation
    const enrichedConv = { ...conv, members: memberInserts.map((m) => ({ ...m, profile: m.user_id === user!.id ? user : selectedUsers.find((u) => u.id === m.user_id) })) } as Conversation;
    selectConvo(enrichedConv);
  };

  // ============================================================
  // ADD MEMBERS TO EXISTING CONVERSATION
  // ============================================================

  // Search for add-members modal (debounced)
  useEffect(() => {
    if (addMemberSearch.length < 2) {
      setAddMemberResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setAddMemberSearching(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`full_name.ilike.%${addMemberSearch}%,display_name.ilike.%${addMemberSearch}%,email.ilike.%${addMemberSearch}%`)
        .neq('id', user!.id)
        .limit(10);

      // Filter out users already in the conversation or already selected
      const existingIds = new Set(members.map((m) => m.user_id));
      setAddMemberResults(
        (data || []).filter(
          (p) => !existingIds.has(p.id) && !addMemberSelected.some((u) => u.id === p.id)
        )
      );
      setAddMemberSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [addMemberSearch]);

  const addMembersToConvo = async () => {
    if (!selectedConvo || addMemberSelected.length === 0 || addingMembers) return;
    setAddingMembers(true);

    try {
      const supabase = createClient();

      // If it's a direct conversation with 2 people, convert to group
      if (selectedConvo.conversation_type === 'direct') {
        const allNames = [
          ...members.map((m) => m.profile?.full_name || m.profile?.email || 'User'),
          ...addMemberSelected.map((u) => u.full_name || u.email || 'User'),
        ];
        await supabase
          .from('conversations')
          .update({
            conversation_type: 'group',
            name: allNames.join(', '),
          })
          .eq('id', selectedConvo.id);
      }

      // Insert new members
      const memberInserts = addMemberSelected.map((u) => ({
        conversation_id: selectedConvo.id,
        user_id: u.id,
        role: 'member',
      }));
      await supabase.from('conversation_members').insert(memberInserts);

      // System messages for each new member
      const systemMsgs = addMemberSelected.map((u) => ({
        conversation_id: selectedConvo.id,
        sender_id: user!.id,
        content: `${user!.full_name || user!.email} added ${u.full_name || u.email}`,
        message_type: 'system',
      }));
      await supabase.from('direct_messages').insert(systemMsgs);

      // Refresh members and messages
      const { data: freshMembers } = await supabase
        .from('conversation_members')
        .select('*, profile:profiles!user_id(*)')
        .eq('conversation_id', selectedConvo.id);
      setMembers(freshMembers || []);

      const { data: freshMsgs } = await supabase
        .from('direct_messages')
        .select('*, sender:profiles!sender_id(*)')
        .eq('conversation_id', selectedConvo.id)
        .order('created_at', { ascending: true })
        .limit(100);
      setMessages(freshMsgs || []);

      // Update selected convo locally
      setSelectedConvo((prev) => prev ? {
        ...prev,
        conversation_type: (prev.conversation_type === 'direct' && addMemberSelected.length > 0) ? 'group' : prev.conversation_type,
        members: freshMembers || prev.members,
      } : null);

      // Refresh sidebar
      await fetchConversations();

      // Reset
      setShowAddMembers(false);
      setAddMemberSearch('');
      setAddMemberResults([]);
      setAddMemberSelected([]);

      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Error adding members:', err);
    } finally {
      setAddingMembers(false);
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================

  const getConvoName = (conv: Conversation): string => {
    if (conv.name) return conv.name;
    if (conv.conversation_type === 'direct') {
      const other = conv.members?.find((m) => m.user_id !== user?.id);
      return other?.profile?.full_name || other?.profile?.email || 'Unknown';
    }
    return conv.members?.map((m) => m.profile?.full_name || m.profile?.email).filter((n) => n).join(', ') || 'Group';
  };

  const getConvoAvatar = (conv: Conversation): Profile | undefined => {
    if (conv.conversation_type === 'direct') {
      const other = conv.members?.find((m) => m.user_id !== user?.id);
      return other?.profile;
    }
    return undefined;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (authLoading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="h-screen flex flex-col bg-surface-950">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-950 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-surface-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <h1 className="text-lg font-bold text-white">Messages</h1>
          <Badge variant="default">{conversations.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowNewConvo(true)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Message
          </Button>
          <NotificationBell />
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation list */}
        <aside className={cn(
          'w-full md:w-80 lg:w-96 border-r border-surface-800 flex flex-col bg-surface-950',
          !showMobileList && 'hidden md:flex',
        )}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-surface-300 font-medium mb-1">No conversations yet</p>
                <p className="text-surface-500 text-sm mb-3">Start a conversation with someone on the platform.</p>
                <Button size="sm" onClick={() => setShowNewConvo(true)}>Start Chatting</Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conv) => {
                const name = getConvoName(conv);
                const avatarProfile = getConvoAvatar(conv);
                const isActive = selectedConvo?.id === conv.id;
                const hasUnread = (conv.unread_count || 0) > 0;

                return (
                  <button
                    key={conv.id}
                    onClick={() => selectConvo(conv)}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-surface-800/50',
                      isActive && 'bg-white/5',
                    )}
                  >
                    {conv.conversation_type === 'group' ? (
                      <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center text-surface-300 text-sm font-bold shrink-0">
                        {conv.members?.length || 0}
                      </div>
                    ) : (
                      <Avatar src={avatarProfile?.avatar_url} name={name} size="md" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn('text-sm font-medium truncate', hasUnread ? 'text-white' : 'text-surface-300')}>{name}</span>
                        {conv.last_message_at && (
                          <span className="text-[10px] text-surface-500 shrink-0 ml-2">{timeAgo(conv.last_message_at)}</span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className={cn('text-xs truncate mt-0.5', hasUnread ? 'text-surface-300' : 'text-surface-500')}>
                          {conv.last_message.message_type === 'system'
                            ? conv.last_message.content
                            : `${conv.last_message.sender?.full_name?.split(' ')[0] || 'User'}: ${conv.last_message.content}`
                          }
                        </p>
                      )}
                    </div>
                    {hasUnread && (
                      <span className="w-5 h-5 bg-[#FF5F1F] text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Message area */}
        <div className={cn(
          'flex-1 flex flex-col',
          showMobileList && 'hidden md:flex',
        )}>
          {!selectedConvo ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <svg className="w-16 h-16 mx-auto mb-4 text-surface-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-surface-500 text-lg">Select a conversation</p>
                <p className="text-surface-600 text-sm mt-1">Choose from your existing conversations or start a new one</p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="border-b border-surface-800 px-4 py-3 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setShowMobileList(true)}
                  className="md:hidden p-1 text-surface-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>

                {selectedConvo.conversation_type === 'group' ? (
                  <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-surface-300 text-xs font-bold">
                    {members.length}
                  </div>
                ) : (
                  <Avatar src={getConvoAvatar(selectedConvo)?.avatar_url} name={getConvoName(selectedConvo)} size="sm" />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-white truncate">{getConvoName(selectedConvo)}</h2>
                  <p className="text-[11px] text-surface-500">
                    {selectedConvo.conversation_type === 'group'
                      ? `${members.length} members`
                      : 'Direct message'}
                  </p>
                </div>

                {/* Add members button */}
                <button
                  onClick={() => setShowAddMembers(true)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-surface-400 hover:text-white transition-colors"
                  title="Add members"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </button>

                {/* Members avatars */}
                <div className="flex -space-x-2">
                  {members.slice(0, 5).map((m) => (
                    <Avatar key={m.user_id} src={m.profile?.avatar_url} name={m.profile?.full_name} size="sm" className="ring-2 ring-surface-950" />
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {messagesLoading ? (
                  <LoadingSpinner className="py-16" />
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center">
                    <div>
                      <p className="text-surface-500">No messages yet</p>
                      <p className="text-surface-600 text-sm mt-1">Say hello!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOwn = msg.sender_id === user?.id;
                    const isSystem = msg.message_type === 'system';
                    const prevMsg = messages[idx - 1];
                    const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id ||
                      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000;

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center py-2">
                          <span className="text-[11px] text-surface-500 bg-surface-900 px-3 py-1 rounded-full">{msg.content}</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={cn('flex gap-2 group', isOwn ? 'flex-row-reverse' : 'flex-row', !showAvatar && 'mt-0.5')}
                      >
                        {showAvatar ? (
                          <Avatar src={msg.sender?.avatar_url} name={msg.sender?.full_name} size="sm" className="shrink-0 mt-1" />
                        ) : (
                          <div className="w-8 shrink-0" />
                        )}
                        <div className={cn('max-w-[70%] min-w-0', isOwn && 'items-end')}>
                          {showAvatar && (
                            <div className={cn('flex items-center gap-2 mb-0.5', isOwn && 'flex-row-reverse')}>
                              <span className="text-xs font-medium text-surface-400">{msg.sender?.full_name || 'User'}</span>
                              <span className="text-[10px] text-surface-600">{formatTime(msg.created_at)}</span>
                            </div>
                          )}
                          <div className={cn(
                            'px-3 py-2 rounded-2xl text-sm break-words',
                            isOwn
                              ? 'bg-[#FF5F1F]/20 text-white rounded-tr-md'
                              : 'bg-surface-800 text-surface-200 rounded-tl-md'
                          )}>
                            <FormattedChatText content={msg.content} />
                          </div>
                        </div>
                        {/* Timestamp on hover */}
                        <span className="text-[10px] text-surface-600 self-end opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {formatTime(msg.created_at)}
                        </span>
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
                    placeholder="Type a message..."
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
      </div>

      {/* ADD MEMBERS MODAL */}
      <Modal
        isOpen={showAddMembers}
        onClose={() => {
          setShowAddMembers(false);
          setAddMemberSearch('');
          setAddMemberResults([]);
          setAddMemberSelected([]);
        }}
        title="Add Members"
      >
        <div className="space-y-4">
          {/* Current members */}
          <div>
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">Current Members ({members.length})</p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <span key={m.user_id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-800 text-surface-300 text-xs rounded-full">
                  <Avatar src={m.profile?.avatar_url} name={m.profile?.full_name} size="sm" />
                  {m.profile?.full_name || m.profile?.email || 'User'}
                </span>
              ))}
            </div>
          </div>

          {/* Selected new members */}
          {addMemberSelected.length > 0 && (
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">Adding ({addMemberSelected.length})</p>
              <div className="flex flex-wrap gap-2">
                {addMemberSelected.map((u) => (
                  <span key={u.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FF5F1F]/20 text-[#FF5F1F] text-xs rounded-full">
                    {u.full_name || u.email}
                    <button onClick={() => setAddMemberSelected((prev) => prev.filter((p) => p.id !== u.id))} className="hover:text-white">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Search People</label>
            <Input
              value={addMemberSearch}
              onChange={(e) => setAddMemberSearch(e.target.value)}
              placeholder="Search by name or email..."
              autoFocus
            />
          </div>

          {/* Results */}
          {addMemberSearching && <LoadingSpinner />}
          {addMemberResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {addMemberResults.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    setAddMemberSelected((prev) => [...prev, profile]);
                    setAddMemberSearch('');
                    setAddMemberResults([]);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{profile.full_name || 'User'}</p>
                    <p className="text-xs text-surface-500 truncate">{profile.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={addMembersToConvo} disabled={addMemberSelected.length === 0 || addingMembers} className="flex-1">
              {addingMembers ? 'Adding...' : `Add ${addMemberSelected.length || ''} Member${addMemberSelected.length !== 1 ? 's' : ''}`}
            </Button>
            <Button variant="secondary" onClick={() => { setShowAddMembers(false); setAddMemberSelected([]); setAddMemberSearch(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* NEW CONVERSATION MODAL */}
      <Modal isOpen={showNewConvo} onClose={() => { setShowNewConvo(false); setSelectedUsers([]); setSearchUsers(''); setGroupName(''); }} title="New Message">
        <div className="space-y-4">
          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FF5F1F]/20 text-[#FF5F1F] text-xs rounded-full">
                  {u.full_name || u.email}
                  <button onClick={() => setSelectedUsers((prev) => prev.filter((p) => p.id !== u.id))} className="hover:text-white">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Group name (if >1 selected) */}
          {selectedUsers.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Group Name (optional)</label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Writing Team"
              />
            </div>
          )}

          {/* Search users */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Search People</label>
            <Input
              value={searchUsers}
              onChange={(e) => setSearchUsers(e.target.value)}
              placeholder="Search by name or email..."
              autoFocus
            />
          </div>

          {/* Search results */}
          {searching && <LoadingSpinner />}
          {searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {searchResults.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    setSelectedUsers((prev) => [...prev, profile]);
                    setSearchUsers('');
                    setSearchResults([]);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{profile.full_name || 'User'}</p>
                    <p className="text-xs text-surface-500 truncate">{profile.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={createConversation} disabled={selectedUsers.length === 0} className="flex-1">
              {selectedUsers.length > 1 ? 'Create Group' : 'Start Conversation'}
            </Button>
            <Button variant="secondary" onClick={() => { setShowNewConvo(false); setSelectedUsers([]); }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
