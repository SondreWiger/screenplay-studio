'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Modal, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import type { OrgChannel, OrgChannelMessage, OrgChannelMember, Profile } from '@/lib/types';

interface Props {
  companyId: string;
  userId: string;
  canManage: boolean;
}

export function OrgChannels({ companyId, userId, canManage }: Props) {
  const [channels, setChannels] = useState<OrgChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<(OrgChannelMessage & { author?: Profile })[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<OrgChannel['channel_type']>('general');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const loadChannels = useCallback(async () => {
    const { data } = await supabase.from('org_channels').select('*').eq('company_id', companyId).eq('is_archived', false).order('is_default', { ascending: false }).order('name');
    setChannels(data || []);
    if (!activeChannel && data && data.length > 0) setActiveChannel(data[0].id);
    setLoading(false);
  }, [companyId]);

  const loadMessages = useCallback(async () => {
    if (!activeChannel) return;
    const { data } = await supabase
      .from('org_channel_messages')
      .select('*, author:profiles!org_channel_messages_author_id_fkey(id, full_name, avatar_url)')
      .eq('channel_id', activeChannel)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [activeChannel]);

  useEffect(() => { loadChannels(); }, [loadChannels]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!activeChannel) return;
    const sub = supabase.channel(`org-msg-${activeChannel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'org_channel_messages', filter: `channel_id=eq.${activeChannel}` },
        () => loadMessages()
      ).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [activeChannel]);

  const sendMessage = async () => {
    if (!messageText.trim() || !activeChannel) return;
    setSending(true);
    const { error } = await supabase.from('org_channel_messages').insert({
      channel_id: activeChannel, author_id: userId, content: messageText.trim(),
    });
    setSending(false);
    if (error) { toast.error('Failed to send'); return; }
    setMessageText('');
    loadMessages();
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return;
    const { error } = await supabase.from('org_channels').insert({
      company_id: companyId, name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
      channel_type: newChannelType, created_by: userId,
    });
    if (error) { toast.error('Failed to create channel'); return; }
    setNewChannelName(''); setShowCreateChannel(false);
    loadChannels();
    toast.success('Channel created!');
  };

  const deleteMessage = async (id: string) => {
    await supabase.from('org_channel_messages').delete().eq('id', id);
    loadMessages();
  };

  const pinMessage = async (id: string, pinned: boolean) => {
    await supabase.from('org_channel_messages').update({ is_pinned: !pinned }).eq('id', id);
    loadMessages();
  };

  if (loading) return <div className="text-center py-12 text-surface-500">Loading channels...</div>;

  const activeChannelData = channels.find(c => c.id === activeChannel);
  const channelTypeIcons: Record<string, string> = {
    general: '#', project: '📁', team: '👥', announcement: '📢', random: '🎲',
  };

  return (
    <div className="flex gap-0 h-[600px] rounded-xl overflow-hidden border border-surface-800">
      {/* Sidebar */}
      <div className="w-60 bg-surface-900 border-r border-surface-800 flex flex-col">
        <div className="p-3 border-b border-surface-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Channels</span>
          {canManage && (
            <button onClick={() => setShowCreateChannel(true)} className="text-surface-400 hover:text-white text-lg">+</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {channels.map(ch => (
            <button key={ch.id} onClick={() => setActiveChannel(ch.id)}
              className={cn('w-full px-3 py-2 text-left flex items-center gap-2 text-sm transition-colors',
                activeChannel === ch.id ? 'bg-surface-800 text-white' : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-300'
              )}>
              <span className="text-xs opacity-60">{channelTypeIcons[ch.channel_type] || '#'}</span>
              <span className="truncate">{ch.name}</span>
            </button>
          ))}
          {channels.length === 0 && (
            <p className="text-xs text-surface-600 text-center py-4">No channels yet</p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-surface-950">
        {activeChannelData ? (
          <>
            <div className="px-4 py-3 border-b border-surface-800 flex items-center gap-2">
              <span className="text-surface-500">{channelTypeIcons[activeChannelData.channel_type] || '#'}</span>
              <span className="font-semibold text-white">{activeChannelData.name}</span>
              {activeChannelData.description && (
                <span className="text-xs text-surface-500 ml-2">{activeChannelData.description}</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-surface-500 text-sm">No messages yet. Start the conversation!</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={cn('group flex gap-3', msg.is_pinned && 'bg-amber-500/5 -mx-2 px-2 py-1 rounded')}>
                  <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">
                    {msg.author?.avatar_url ? (
                      <img src={msg.author.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                    ) : (
                      msg.author?.full_name?.[0] || '?'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{msg.author?.full_name || 'Unknown'}</span>
                      <span className="text-[10px] text-surface-600">{timeAgo(msg.created_at)}</span>
                      {msg.is_pinned && <span className="text-[10px] text-amber-400">📌 Pinned</span>}
                      <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                        {canManage && (
                          <>
                            <button onClick={() => pinMessage(msg.id, msg.is_pinned)} className="text-[10px] text-surface-500 hover:text-white px-1">
                              {msg.is_pinned ? 'Unpin' : 'Pin'}
                            </button>
                            <button onClick={() => deleteMessage(msg.id)} className="text-[10px] text-surface-500 hover:text-red-400 px-1">Delete</button>
                          </>
                        )}
                        {msg.author_id === userId && !canManage && (
                          <button onClick={() => deleteMessage(msg.id)} className="text-[10px] text-surface-500 hover:text-red-400 px-1">Delete</button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-surface-300 whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-surface-800">
              <div className="flex gap-2">
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Message #${activeChannelData.name}`}
                  className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-brand-500"
                />
                <Button size="sm" onClick={sendMessage} disabled={!messageText.trim() || sending}>Send</Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-surface-500 text-sm">
            Select a channel to start chatting
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      <Modal isOpen={showCreateChannel} onClose={() => setShowCreateChannel(false)} title="Create Channel">
        <div className="space-y-4">
          <Input label="Channel Name" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="e.g. writers-room" />
          <div>
            <label className="text-sm text-surface-400 mb-2 block">Type</label>
            <div className="flex gap-2 flex-wrap">
              {(['general', 'project', 'team', 'announcement', 'random'] as const).map(t => (
                <button key={t} onClick={() => setNewChannelType(t)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    newChannelType === t ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white')}>
                  {channelTypeIcons[t]} {t}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={createChannel} disabled={!newChannelName.trim()}>Create Channel</Button>
        </div>
      </Modal>
    </div>
  );
}
