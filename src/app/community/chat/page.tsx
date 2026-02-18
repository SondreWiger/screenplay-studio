'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { timeAgo, cn } from '@/lib/utils';
import type { ChatChannel, ChatMessage, Profile } from '@/lib/types';

// ============================================================
// Community Chat Forum
// ============================================================

const MESSAGES_PER_PAGE = 50;

export default function ChatPage() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load channels
  useEffect(() => {
    const loadChannels = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('chat_channels').select('*').order('sort_order');
      const channelList = data || [];
      setChannels(channelList);
      if (channelList.length > 0) setActiveChannel(channelList[0]);
      setLoading(false);
    };
    loadChannels();
  }, []);

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel.id);

    // Subscribe to realtime
    const supabase = createClient();
    const subscription = supabase
      .channel(`chat:${activeChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`,
      }, async (payload) => {
        const msg = payload.new as ChatMessage;
        // Load author
        if (!profiles[msg.author_id]) {
          const { data } = await supabase.from('profiles').select('*').eq('id', msg.author_id).single();
          if (data) setProfiles(prev => ({ ...prev, [data.id]: data }));
        }
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`,
      }, (payload) => {
        const updated = payload.new as ChatMessage;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`,
      }, (payload) => {
        const deleted = payload.old as any;
        setMessages(prev => prev.filter(m => m.id !== deleted.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [activeChannel?.id]);

  const loadMessages = async (channelId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(MESSAGES_PER_PAGE);

    const msgs = data || [];
    setMessages(msgs);

    // Load profiles for all authors
    const authorIds = Array.from(new Set(msgs.map(m => m.author_id)));
    const unknownIds = authorIds.filter(id => !profiles[id]);
    if (unknownIds.length > 0) {
      const { data: profileData } = await supabase.from('profiles').select('*').in('id', unknownIds);
      if (profileData) {
        const map: Record<string, Profile> = {};
        profileData.forEach(p => { map[p.id] = p; });
        setProfiles(prev => ({ ...prev, ...map }));
      }
    }

    setTimeout(scrollToBottom, 100);
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSend = async () => {
    if (!user || !activeChannel || !newMessage.trim()) return;
    setSending(true);
    try {
      const supabase = createClient();
      await supabase.from('chat_messages').insert({
        channel_id: activeChannel.id,
        author_id: user.id,
        content: newMessage.trim(),
        reply_to_id: replyTo?.id || null,
      });
      setNewMessage('');
      setReplyTo(null);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleEdit = async (msgId: string) => {
    if (!editContent.trim()) return;
    const supabase = createClient();
    await supabase.from('chat_messages').update({
      content: editContent.trim(),
      edited_at: new Date().toISOString(),
    }).eq('id', msgId);
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm('Delete this message?')) return;
    const supabase = createClient();
    await supabase.from('chat_messages').update({ is_deleted: true }).eq('id', msgId);
  };

  const handlePin = async (msg: ChatMessage) => {
    const supabase = createClient();
    await supabase.from('chat_messages').update({ is_pinned: !msg.is_pinned }).eq('id', msg.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const switchChannel = (channel: ChatChannel) => {
    setActiveChannel(channel);
    setShowMobileSidebar(false);
    setReplyTo(null);
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#faf9f7]">
      {/* Nav */}
      <nav className="shrink-0 bg-[#faf9f7]/90 backdrop-blur-md border-b border-stone-200 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="md:hidden text-stone-500 hover:text-stone-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Community
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm text-stone-500">
            <span className="text-stone-900 font-medium">💬 Chat</span>
            {user ? (
              <Link href="/dashboard" className="hover:text-stone-900 transition-colors">Dashboard</Link>
            ) : (
              <Link href="/auth/login?redirect=/community/chat" className="hover:text-stone-900 transition-colors">Sign In</Link>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">
        {/* Channel sidebar - Desktop */}
        <aside className={cn(
          'w-60 shrink-0 border-r border-stone-200 bg-white overflow-y-auto',
          'hidden md:block'
        )}>
          <div className="p-4">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Channels</h3>
            <div className="space-y-0.5">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => switchChannel(ch)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2',
                    activeChannel?.id === ch.id
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  )}
                >
                  <span>{ch.icon}</span>
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div className="w-60 bg-white shadow-xl border-r border-stone-200 overflow-y-auto">
              <div className="p-4">
                <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Channels</h3>
                <div className="space-y-0.5">
                  {channels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => switchChannel(ch)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2',
                        activeChannel?.id === ch.id
                          ? 'bg-brand-50 text-brand-700 font-medium'
                          : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                      )}
                    >
                      <span>{ch.icon}</span>
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 bg-black/30" onClick={() => setShowMobileSidebar(false)} />
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel header */}
          {activeChannel && (
            <div className="shrink-0 px-5 py-3 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">{activeChannel.icon}</span>
                <h2 className="text-sm font-semibold text-stone-900">{activeChannel.name}</h2>
              </div>
              {activeChannel.description && (
                <p className="text-xs text-stone-400 mt-0.5">{activeChannel.description}</p>
              )}
            </div>
          )}

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-20">
                <div className="text-4xl mb-3">{activeChannel?.icon || '💬'}</div>
                <p className="text-sm text-stone-500">No messages yet. Start the conversation!</p>
              </div>
            )}

            {messages.map((msg, i) => {
              const author = profiles[msg.author_id];
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const sameAuthor = prevMsg?.author_id === msg.author_id;
              const timeDiff = prevMsg ? (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) / 60000 : Infinity;
              const compact = sameAuthor && timeDiff < 5;
              const isOwn = user?.id === msg.author_id;
              const isEditing = editingId === msg.id;

              return (
                <div key={msg.id} className={cn('group', !compact && i > 0 && 'mt-4')}>
                  {msg.is_pinned && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600 mb-1 ml-12">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" /><path d="M8 12a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M9 14a1 1 0 011-1h0a1 1 0 110 2h0a1 1 0 01-1-1z" /></svg>
                      Pinned
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    {compact ? (
                      <div className="w-9 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-500 shrink-0" style={author?.avatar_url ? {} : { backgroundColor: `hsl(${(msg.author_id.charCodeAt(0) * 47) % 360}, 40%, 90%)`, color: `hsl(${(msg.author_id.charCodeAt(0) * 47) % 360}, 40%, 40%)` }}>
                        {author?.avatar_url ? (
                          <img src={author.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (author?.full_name || author?.email || '?')[0].toUpperCase()
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {!compact && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-stone-900">
                            {author?.full_name || author?.email || 'Unknown'}
                          </span>
                          <span className="text-[10px] text-stone-400">{timeAgo(msg.created_at)}</span>
                        </div>
                      )}

                      {/* Reply indicator */}
                      {msg.reply_to_id && (
                        <div className="flex items-center gap-1 text-[10px] text-stone-400 mb-1 border-l-2 border-stone-200 pl-2">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                          Reply
                        </div>
                      )}

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(msg.id); if (e.key === 'Escape') setEditingId(null); }}
                            className="flex-1 text-sm text-stone-800 bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400"
                            autoFocus
                          />
                          <button onClick={() => handleEdit(msg.id)} className="text-xs text-brand-600 hover:text-brand-700">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
                        </div>
                      ) : (
                        <p className="text-sm text-stone-700 whitespace-pre-wrap break-words">
                          {msg.content}
                          {msg.edited_at && <span className="text-[10px] text-stone-400 ml-1">(edited)</span>}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {user && !isEditing && (
                      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        <button
                          onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                          className="p-1 text-stone-400 hover:text-stone-600 rounded transition-colors"
                          title="Reply"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        </button>
                        {isOwn && (
                          <>
                            <button
                              onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}
                              className="p-1 text-stone-400 hover:text-stone-600 rounded transition-colors"
                              title="Edit"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(msg.id)}
                              className="p-1 text-stone-400 hover:text-red-500 rounded transition-colors"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          {user ? (
            <div className="shrink-0 px-5 py-3 border-t border-stone-200 bg-white">
              {replyTo && (
                <div className="flex items-center justify-between mb-2 px-3 py-1.5 bg-stone-50 rounded-lg border border-stone-200">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    <span>Replying to <strong className="text-stone-700">{profiles[replyTo.author_id]?.full_name || 'someone'}</strong></span>
                    <span className="text-stone-400 truncate max-w-[200px]">{replyTo.content}</span>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-stone-400 hover:text-stone-600">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${activeChannel?.name || 'general'}...`}
                  rows={1}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 focus:outline-none focus:border-brand-400 resize-none max-h-32"
                  style={{ minHeight: '40px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
                >
                  {sending ? '...' : 'Send'}
                </button>
              </div>
            </div>
          ) : (
            <div className="shrink-0 px-5 py-4 border-t border-stone-200 bg-white text-center">
              <Link href="/auth/login?redirect=/community/chat" className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors">
                Sign in to join the conversation →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
