'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BroadcastStreamOutput, BroadcastOutputPlatform, BroadcastOutputStatus } from '@/lib/types';
import { BROADCAST_OUTPUT_PLATFORMS } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Output / Restream — Push program to YouTube, Twitch, etc.
// Multi-destination output management
// ────────────────────────────────────────────────────────────

export default function OutputPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [outputs, setOutputs] = useState<BroadcastStreamOutput[]>([]);
  const [showAddOutput, setShowAddOutput] = useState(false);
  const [showStreamKeys, setShowStreamKeys] = useState<Set<string>>(new Set());

  const [newOutput, setNewOutput] = useState({
    name: '',
    platform: 'youtube' as BroadcastOutputPlatform,
    rtmp_url: '',
    stream_key: '',
    video_bitrate_kbps: 4500,
    audio_bitrate_kbps: 128,
    resolution: '1920x1080',
    fps: 30,
    is_primary: false,
    auto_start: false,
  });

  // ─── Data Fetching ───────────────────────────────
  const fetchOutputs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_stream_outputs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');
    setOutputs(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchOutputs(); }, [fetchOutputs]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`outputs-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_stream_outputs', filter: `project_id=eq.${projectId}` }, () => fetchOutputs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchOutputs]);

  // ─── CRUD ────────────────────────────────────────

  const platformDefault = (platform: BroadcastOutputPlatform) => {
    const defaults: Record<string, string> = {
      youtube: 'rtmp://a.rtmp.youtube.com/live2',
      twitch: 'rtmp://live.twitch.tv/app',
      facebook: 'rtmps://live-api-s.facebook.com:443/rtmp/',
      tiktok: 'rtmp://push.tiktokcdn.com/live/',
      custom: 'rtmp://',
    };
    return defaults[platform] || 'rtmp://';
  };

  const handleAddOutput = async () => {
    if (!newOutput.name) { toast.error('Name is required'); return; }
    const supabase = createClient();
    const { error } = await supabase.from('broadcast_stream_outputs').insert({
      project_id: projectId,
      name: newOutput.name,
      platform: newOutput.platform,
      rtmp_url: newOutput.rtmp_url || platformDefault(newOutput.platform),
      stream_key: newOutput.stream_key,
      video_bitrate_kbps: newOutput.video_bitrate_kbps,
      audio_bitrate_kbps: newOutput.audio_bitrate_kbps,
      resolution: newOutput.resolution,
      fps: newOutput.fps,
      is_primary: newOutput.is_primary,
      auto_start: newOutput.auto_start,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Output destination added');
    setShowAddOutput(false);
    setNewOutput({ name: '', platform: 'youtube', rtmp_url: '', stream_key: '', video_bitrate_kbps: 4500, audio_bitrate_kbps: 128, resolution: '1920x1080', fps: 30, is_primary: false, auto_start: false });
    fetchOutputs();
  };

  const deleteOutput = async (id: string) => {
    const supabase = createClient();
    await supabase.from('broadcast_stream_outputs').delete().eq('id', id);
    fetchOutputs();
  };

  const toggleStream = async (output: BroadcastStreamOutput) => {
    const supabase = createClient();
    if (output.status === 'live' || output.status === 'starting') {
      await supabase.from('broadcast_stream_outputs').update({
        status: 'idle',
        started_at: null,
      }).eq('id', output.id);
      toast.success(`Stopped: ${output.name}`);
    } else {
      await supabase.from('broadcast_stream_outputs').update({
        status: 'live',
        started_at: new Date().toISOString(),
      }).eq('id', output.id);
      toast.success(`Started: ${output.name}`);
      // Log to as-run
      await supabase.from('broadcast_as_run_log').insert({
        project_id: projectId,
        event_type: 'segment_start',
        title: `OUTPUT STARTED: ${output.name} (${output.platform})`,
        is_automatic: false,
      });
    }
    fetchOutputs();
  };

  const statusColor = (status: BroadcastOutputStatus) => {
    switch (status) {
      case 'live': return 'bg-red-600 text-white';
      case 'starting': return 'bg-amber-600 text-black';
      case 'error': return 'bg-red-800 text-red-200';
      case 'stopping': return 'bg-amber-800 text-amber-200';
      default: return 'bg-surface-800 text-surface-500';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${bytes} B`;
  };

  // ─── Render ──────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  const liveOutputs = outputs.filter(o => o.status === 'live');

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface-800">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">Output Destinations</h1>
          {liveOutputs.length > 0 && (
            <Badge className="bg-red-600 text-white animate-pulse">
              {liveOutputs.length} LIVE
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setShowAddOutput(true)}>+ Add Destination</Button>
      </div>

      {/* ── Output Grid ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {outputs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              title="No output destinations"
              description="Add YouTube, Twitch, or custom RTMP destinations to broadcast your program output."
              action={<Button onClick={() => setShowAddOutput(true)}>Add Destination</Button>}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {outputs.map(output => {
              const platform = BROADCAST_OUTPUT_PLATFORMS.find(p => p.value === output.platform);
              const isLive = output.status === 'live';
              return (
                <div
                  key={output.id}
                  className={cn(
                    'rounded-xl border p-4 space-y-3 transition-all',
                    isLive
                      ? 'border-red-600/50 bg-red-950/20 shadow-lg shadow-red-600/5'
                      : 'border-surface-700 bg-surface-900'
                  )}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                        style={{ backgroundColor: platform?.color + '20', color: platform?.color }}
                      >
                        {platform?.icon || '?'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{output.name}</div>
                        <div className="text-xs text-surface-500">{platform?.label || output.platform}</div>
                      </div>
                    </div>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', statusColor(output.status))}>
                      {output.status}
                    </span>
                  </div>

                  {/* Stream details */}
                  <div className="space-y-1 text-xs text-surface-400">
                    <div className="flex justify-between">
                      <span>Resolution</span>
                      <span className="text-surface-300 font-mono">{output.resolution}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bitrate</span>
                      <span className="text-surface-300 font-mono">{output.video_bitrate_kbps} kbps</span>
                    </div>
                    <div className="flex justify-between">
                      <span>FPS</span>
                      <span className="text-surface-300 font-mono">{output.fps}</span>
                    </div>
                    {isLive && output.started_at && (
                      <div className="flex justify-between">
                        <span>Uptime</span>
                        <span className="text-red-400 font-mono">
                          {Math.floor((Date.now() - new Date(output.started_at).getTime()) / 60000)}m
                        </span>
                      </div>
                    )}
                    {output.bytes_sent > 0 && (
                      <div className="flex justify-between">
                        <span>Data Sent</span>
                        <span className="text-surface-300 font-mono">{formatBytes(output.bytes_sent)}</span>
                      </div>
                    )}
                  </div>

                  {/* Stream Key (masked) */}
                  {output.stream_key && (
                    <div className="bg-surface-800 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-surface-500 uppercase">Stream Key</span>
                        <button
                          onClick={() => {
                            const next = new Set(showStreamKeys);
                            if (next.has(output.id)) next.delete(output.id);
                            else next.add(output.id);
                            setShowStreamKeys(next);
                          }}
                          className="text-[10px] text-surface-500 hover:text-white transition-colors"
                        >
                          {showStreamKeys.has(output.id) ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <code className="text-xs font-mono text-surface-400 break-all">
                        {showStreamKeys.has(output.id)
                          ? output.stream_key
                          : '••••••••••••••••'
                        }
                      </code>
                    </div>
                  )}

                  {output.error_message && (
                    <div className="bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2 text-xs text-red-300">
                      {output.error_message}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => toggleStream(output)}
                      className={cn(
                        'flex-1 py-2 text-xs font-bold rounded-lg transition-all uppercase',
                        isLive
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-green-600 hover:bg-green-500 text-white'
                      )}
                    >
                      {isLive ? 'Stop Stream' : 'Start Stream'}
                    </button>
                    <button
                      onClick={() => deleteOutput(output.id)}
                      className="p-2 rounded-lg text-surface-600 hover:text-red-400 hover:bg-red-600/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>

                  {/* Flags */}
                  <div className="flex items-center gap-2">
                    {output.is_primary && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-400 font-bold">PRIMARY</span>
                    )}
                    {output.auto_start && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-surface-400">Auto-start</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Output Modal ─────────────────────────── */}
      <Modal isOpen={showAddOutput} onClose={() => setShowAddOutput(false)} title="Add Output Destination" size="lg">
        <div className="space-y-4">
          <Input
            label="Name"
            value={newOutput.name}
            onChange={(e) => setNewOutput(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. YouTube Main, Twitch Backup"
          />

          <div>
            <label className="text-xs font-medium text-surface-400 block mb-2">Platform</label>
            <div className="grid grid-cols-5 gap-2">
              {BROADCAST_OUTPUT_PLATFORMS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setNewOutput(prev => ({
                    ...prev,
                    platform: p.value,
                    rtmp_url: platformDefault(p.value),
                  }))}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors border',
                    newOutput.platform === p.value
                      ? 'border-white/30 bg-surface-700'
                      : 'border-surface-700 bg-surface-800 hover:bg-surface-700'
                  )}
                >
                  <span className="text-lg" style={{ color: p.color }}>{p.icon}</span>
                  <span className="text-[10px] text-surface-400 truncate w-full text-center">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Input
            label="RTMP URL"
            value={newOutput.rtmp_url || platformDefault(newOutput.platform)}
            onChange={(e) => setNewOutput(prev => ({ ...prev, rtmp_url: e.target.value }))}
          />
          <Input
            label="Stream Key"
            type="password"
            value={newOutput.stream_key}
            onChange={(e) => setNewOutput(prev => ({ ...prev, stream_key: e.target.value }))}
            placeholder="Paste your stream key here"
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Resolution</label>
              <select
                value={newOutput.resolution}
                onChange={(e) => setNewOutput(prev => ({ ...prev, resolution: e.target.value }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="1920x1080">1080p</option>
                <option value="1280x720">720p</option>
                <option value="3840x2160">4K</option>
                <option value="854x480">480p</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Video Bitrate</label>
              <select
                value={newOutput.video_bitrate_kbps}
                onChange={(e) => setNewOutput(prev => ({ ...prev, video_bitrate_kbps: Number(e.target.value) }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value={2000}>2000 kbps</option>
                <option value={3000}>3000 kbps</option>
                <option value={4500}>4500 kbps</option>
                <option value={6000}>6000 kbps</option>
                <option value={8000}>8000 kbps</option>
                <option value={10000}>10000 kbps</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">FPS</label>
              <select
                value={newOutput.fps}
                onChange={(e) => setNewOutput(prev => ({ ...prev, fps: Number(e.target.value) }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value={24}>24</option>
                <option value={25}>25 (PAL)</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={60}>60</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newOutput.is_primary}
                onChange={(e) => setNewOutput(prev => ({ ...prev, is_primary: e.target.checked }))}
                className="rounded border-surface-600"
              />
              Primary output
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newOutput.auto_start}
                onChange={(e) => setNewOutput(prev => ({ ...prev, auto_start: e.target.checked }))}
                className="rounded border-surface-600"
              />
              Auto-start when show goes live
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddOutput(false)}>Cancel</Button>
            <Button onClick={handleAddOutput}>Add Destination</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
