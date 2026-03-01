'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Badge, Input, Modal, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BroadcastCommsChannel } from '@/lib/types';
import { BROADCAST_COMMS_CHANNEL_TYPES } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Comms / Intercom — Production communication channels
// Party lines, IFB channels, ISO talkback, GPIO triggers
// ────────────────────────────────────────────────────────────

export default function CommsPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<BroadcastCommsChannel[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeChannels, setActiveChannels] = useState<Set<string>>(new Set());
  const [talkingChannels, setTalkingChannels] = useState<Set<string>>(new Set());

  // Create form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<string>('party_line');
  const [newDesc, setNewDesc] = useState('');

  // ─── Data Fetching ───────────────────────────────
  const fetchChannels = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_comms_channels')
      .select('*')
      .eq('project_id', projectId)
      .order('channel_type')
      .order('name');
    setChannels(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`comms-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_comms_channels', filter: `project_id=eq.${projectId}` }, () => fetchChannels())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchChannels]);

  // ─── Actions ─────────────────────────────────────

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    const supabase = createClient();
    const { error } = await supabase.from('broadcast_comms_channels').insert({
      project_id: projectId,
      name: newName.trim(),
      channel_type: newType,
      description: newDesc.trim() || null,
      is_active: true,
      members: [],
      created_by: user.id,
    });
    if (error) { toast(error.message, 'error'); return; }
    toast('Channel created', 'success');
    setShowCreateModal(false);
    setNewName('');
    setNewType('party_line');
    setNewDesc('');
    fetchChannels();
  };

  const toggleListen = (channelId: string) => {
    setActiveChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  const startTalk = (channelId: string) => {
    if (!activeChannels.has(channelId)) return;
    setTalkingChannels(prev => new Set(prev).add(channelId));
  };

  const stopTalk = (channelId: string) => {
    setTalkingChannels(prev => {
      const next = new Set(prev);
      next.delete(channelId);
      return next;
    });
  };

  const deleteChannel = async (channelId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('broadcast_comms_channels')
      .delete()
      .eq('id', channelId);
    if (error) toast(error.message, 'error');
    else fetchChannels();
  };

  const toggleActive = async (channel: BroadcastCommsChannel) => {
    const supabase = createClient();
    await supabase
      .from('broadcast_comms_channels')
      .update({ is_active: !channel.is_active })
      .eq('id', channel.id);
    fetchChannels();
  };

  // ─── Render ──────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  const channelsByType = BROADCAST_COMMS_CHANNEL_TYPES.map(t => ({
    ...t,
    channels: channels.filter(c => c.channel_type === t.value),
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <div>
          <h1 className="text-lg font-bold text-white">Comms / Intercom</h1>
          <p className="text-xs text-surface-400">Production communication channels • Push-to-talk</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={activeChannels.size > 0 ? 'info' : 'default'}>
            {activeChannels.size} active
          </Badge>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>+ Channel</Button>
        </div>
      </div>

      {/* ── Channel Grid ──────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-500 gap-4">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-sm">No comms channels. Create one to get started.</p>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>+ New Channel</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {channelsByType.filter(t => t.channels.length > 0).map(typeGroup => (
              <div key={typeGroup.value}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">
                    {typeGroup.label}
                  </span>
                  <div className="flex-1 h-px bg-surface-800" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {typeGroup.channels.map(channel => {
                    const isListening = activeChannels.has(channel.id);
                    const isTalking = talkingChannels.has(channel.id);

                    return (
                      <div
                        key={channel.id}
                        className={cn(
                          'relative rounded-lg border-2 p-4 transition-all',
                          isTalking ? 'border-red-500 bg-red-950/30 shadow-lg shadow-red-500/10' :
                          isListening ? 'border-green-500/50 bg-green-950/20' :
                          'border-surface-700 bg-surface-900/50',
                          !channel.is_active && 'opacity-50'
                        )}
                      >
                        {/* Talking indicator */}
                        {isTalking && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        )}

                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-sm font-bold text-white">{channel.name}</h3>
                            {channel.description && (
                              <p className="text-[10px] text-surface-500 mt-0.5">{channel.description}</p>
                            )}
                          </div>
                          <Badge variant={channel.is_active ? 'info' : 'default'} className="text-[8px]">
                            {typeGroup.label}
                          </Badge>
                        </div>

                        {/* Members */}
                        {channel.members && channel.members.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {(channel.members as any[]).map((m, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-surface-800 rounded text-surface-400">
                                {m.name || m.role || `Member ${i + 1}`}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleListen(channel.id)}
                            disabled={!channel.is_active}
                            className={cn(
                              'flex-1 py-2 rounded text-xs font-bold uppercase transition-colors',
                              isListening
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                            )}
                          >
                            {isListening ? '🎧 Listening' : 'Listen'}
                          </button>
                          <button
                            onMouseDown={() => startTalk(channel.id)}
                            onMouseUp={() => stopTalk(channel.id)}
                            onMouseLeave={() => stopTalk(channel.id)}
                            onTouchStart={() => startTalk(channel.id)}
                            onTouchEnd={() => stopTalk(channel.id)}
                            disabled={!isListening || !channel.is_active}
                            className={cn(
                              'flex-1 py-2 rounded text-xs font-bold uppercase transition-colors',
                              isTalking
                                ? 'bg-red-600 text-white'
                                : isListening
                                  ? 'bg-surface-700 text-white hover:bg-red-600'
                                  : 'bg-surface-800 text-surface-600 cursor-not-allowed'
                            )}
                          >
                            {isTalking ? '🔴 TALK' : 'PTT'}
                          </button>
                        </div>

                        {/* Channel actions */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-800">
                          <button
                            onClick={() => toggleActive(channel)}
                            className="text-[10px] text-surface-500 hover:text-white transition-colors"
                          >
                            {channel.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => deleteChannel(channel.id)}
                            className="text-[10px] text-surface-500 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Status Bar ─────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-surface-800 bg-surface-900">
        <div className="flex items-center gap-4 text-[10px] text-surface-500">
          <span>{channels.length} channel{channels.length !== 1 ? 's' : ''}</span>
          <span>{channels.filter(c => c.is_active).length} active</span>
          <span>{activeChannels.size} monitoring</span>
        </div>
        {talkingChannels.size > 0 && (
          <div className="flex items-center gap-1 text-red-400">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase">TX on {talkingChannels.size} ch</span>
          </div>
        )}
      </div>

      {/* ── Create Modal ──────────────────────────── */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Comms Channel">
        <div className="space-y-4 p-4">
          <div>
            <label className="text-xs font-medium text-surface-400 mb-1 block">Name</label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Directors Line" />
          </div>

          <div>
            <label className="text-xs font-medium text-surface-400 mb-2 block">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {BROADCAST_COMMS_CHANNEL_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setNewType(t.value)}
                  className={cn(
                    'p-2 rounded border text-xs text-left transition-colors',
                    newType === t.value
                      ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 text-white'
                      : 'border-surface-700 text-surface-400 hover:border-surface-500'
                  )}
                >
                  <span className="font-bold block">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-surface-400 mb-1 block">Description (optional)</label>
            <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Channel purpose" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>Create Channel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
