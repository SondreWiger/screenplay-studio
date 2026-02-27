'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BroadcastStreamIngest, BroadcastIngestProtocol, BroadcastIngestStatus } from '@/lib/types';
import { BROADCAST_INGEST_PROTOCOL_OPTIONS } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Stream Ingest — RTMP/SRT/WHIP ingest management
// Receive streams from OBS, Wirecast, vMix, hardware encoders
// ────────────────────────────────────────────────────────────

export default function StreamIngestPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [ingests, setIngests] = useState<BroadcastStreamIngest[]>([]);
  const [selectedIngest, setSelectedIngest] = useState<BroadcastStreamIngest | null>(null);
  const [showAddIngest, setShowAddIngest] = useState(false);
  const [showStreamKey, setShowStreamKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [newIngest, setNewIngest] = useState({
    name: '',
    protocol: 'rtmp' as BroadcastIngestProtocol,
    ingest_url: '',
    auto_source: true,
  });

  // ─── Data Fetching ───────────────────────────────
  const fetchIngests = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('broadcast_stream_ingests')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) console.error('Ingest fetch error:', error);
    setIngests(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchIngests(); }, [fetchIngests]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`ingests-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_stream_ingests', filter: `project_id=eq.${projectId}` }, () => fetchIngests())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchIngests]);

  // ─── CRUD ────────────────────────────────────────

  const defaultIngestUrl = (protocol: BroadcastIngestProtocol) => {
    switch (protocol) {
      case 'rtmp': return `rtmp://your-server.com/live`;
      case 'srt': return `srt://your-server.com:9000`;
      case 'whip': return `https://your-server.com/whip/ingest`;
      case 'rtsp': return `rtsp://`;
      case 'ndi': return `ndi://`;
      case 'hls_pull': return `https://`;
      default: return '';
    }
  };

  const handleAddIngest = async () => {
    if (!newIngest.name) { toast.error('Name is required'); return; }
    const supabase = createClient();
    const { data, error } = await supabase.from('broadcast_stream_ingests').insert({
      project_id: projectId,
      name: newIngest.name,
      protocol: newIngest.protocol,
      ingest_url: newIngest.ingest_url || defaultIngestUrl(newIngest.protocol),
      auto_source: newIngest.auto_source,
      created_by: user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success('Ingest endpoint created');
    setShowAddIngest(false);
    setNewIngest({ name: '', protocol: 'rtmp', ingest_url: '', auto_source: true });
    fetchIngests();
    if (data) setSelectedIngest(data);
  };

  const deleteIngest = async (id: string) => {
    const supabase = createClient();
    await supabase.from('broadcast_stream_ingests').delete().eq('id', id);
    if (selectedIngest?.id === id) setSelectedIngest(null);
    fetchIngests();
    toast.success('Ingest removed');
  };

  const updateStatus = async (id: string, status: BroadcastIngestStatus) => {
    const supabase = createClient();
    await supabase.from('broadcast_stream_ingests').update({ status }).eq('id', id);
    fetchIngests();
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ─── Status helpers ──────────────────────────────

  const statusColor = (status: BroadcastIngestStatus) => {
    switch (status) {
      case 'live': return 'bg-red-600 text-white';
      case 'connecting': return 'bg-amber-600 text-black';
      case 'error': return 'bg-red-800 text-red-200';
      case 'stopped': return 'bg-surface-700 text-surface-400';
      default: return 'bg-surface-800 text-surface-500';
    }
  };

  const formatBitrate = (kbps: number | null) => {
    if (!kbps) return '—';
    if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
    return `${kbps} kbps`;
  };

  // ─── Render ──────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* ── Left: Ingest List ────────────────────────── */}
      <div className="w-96 border-r border-surface-800 flex flex-col shrink-0">
        <div className="p-3 border-b border-surface-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white">Stream Ingests</h2>
            <Button size="sm" onClick={() => setShowAddIngest(true)}>+ New</Button>
          </div>
          <p className="text-[10px] text-surface-500">
            Receive streams from OBS Studio, Wirecast, vMix, hardware encoders, or any RTMP/SRT source.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {ingests.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <EmptyState
                title="No ingest endpoints"
                description="Create an ingest to start receiving streams from OBS or other encoders."
                action={<Button onClick={() => setShowAddIngest(true)}>Create Ingest</Button>}
              />
            </div>
          ) : ingests.map(ingest => (
            <button
              key={ingest.id}
              onClick={() => setSelectedIngest(ingest)}
              className={cn(
                'w-full text-left p-3 rounded-lg transition-colors',
                selectedIngest?.id === ingest.id
                  ? 'bg-surface-800 ring-1 ring-surface-600'
                  : 'hover:bg-surface-800/50'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white truncate">{ingest.name}</span>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', statusColor(ingest.status))}>
                  {ingest.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-surface-500">
                <span className="uppercase">{ingest.protocol}</span>
                {ingest.status === 'live' && ingest.width && ingest.height && (
                  <span>{ingest.width}x{ingest.height}</span>
                )}
                {ingest.status === 'live' && ingest.bitrate_kbps && (
                  <span>{formatBitrate(ingest.bitrate_kbps)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: Ingest Details ────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {selectedIngest ? (
          <div className="p-6 max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedIngest.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', statusColor(selectedIngest.status))}>
                    {selectedIngest.status}
                  </span>
                  <span className="text-xs text-surface-500 uppercase">{selectedIngest.protocol}</span>
                  {selectedIngest.auto_source && (
                    <span className="text-[10px] text-green-400">Auto-registers as source</span>
                  )}
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => deleteIngest(selectedIngest.id)}>Delete</Button>
            </div>

            {/* Connection Details */}
            <div className="bg-surface-900 rounded-xl border border-surface-700 p-4 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Connection Details</h3>

              {/* Server URL */}
              <div>
                <label className="text-xs font-medium text-surface-400 block mb-1">Server URL</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-surface-800 text-green-400 text-sm px-3 py-2 rounded-lg font-mono break-all">
                    {selectedIngest.ingest_url}
                  </code>
                  <button
                    onClick={() => copyToClipboard(selectedIngest.ingest_url, 'url')}
                    className="p-2 rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors shrink-0"
                  >
                    {copiedKey === 'url' ? '✓' : '⎘'}
                  </button>
                </div>
              </div>

              {/* Stream Key */}
              <div>
                <label className="text-xs font-medium text-surface-400 block mb-1">Stream Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-surface-800 text-amber-400 text-sm px-3 py-2 rounded-lg font-mono break-all">
                    {showStreamKey === selectedIngest.id
                      ? selectedIngest.stream_key
                      : '••••••••••••••••••••'
                    }
                  </code>
                  <button
                    onClick={() => setShowStreamKey(
                      showStreamKey === selectedIngest.id ? null : selectedIngest.id
                    )}
                    className="p-2 rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors shrink-0"
                  >
                    {showStreamKey === selectedIngest.id ? '🔒' : '👁'}
                  </button>
                  <button
                    onClick={() => copyToClipboard(selectedIngest.stream_key, 'key')}
                    className="p-2 rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors shrink-0"
                  >
                    {copiedKey === 'key' ? '✓' : '⎘'}
                  </button>
                </div>
              </div>

              {/* Full RTMP URL (for easy copy) */}
              {selectedIngest.protocol === 'rtmp' && (
                <div>
                  <label className="text-xs font-medium text-surface-400 block mb-1">Full RTMP URL (paste into OBS)</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-surface-800 text-cyan-400 text-xs px-3 py-2 rounded-lg font-mono break-all">
                      {selectedIngest.ingest_url}/{selectedIngest.stream_key}
                    </code>
                    <button
                      onClick={() => copyToClipboard(`${selectedIngest.ingest_url}/${selectedIngest.stream_key}`, 'full')}
                      className="p-2 rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors shrink-0"
                    >
                      {copiedKey === 'full' ? '✓' : '⎘'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* OBS Setup Guide */}
            <div className="bg-surface-900 rounded-xl border border-surface-700 p-4 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Quick Setup — OBS Studio</h3>
              <ol className="space-y-2 text-xs text-surface-300">
                <li className="flex items-start gap-2">
                  <span className="bg-surface-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                  <span>Open OBS Studio → Settings → Stream</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-surface-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                  <span>Set <strong>Service</strong> to &ldquo;Custom&rdquo;</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-surface-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                  <span>Paste the <strong>Server URL</strong> above into the Server field</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-surface-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                  <span>Paste the <strong>Stream Key</strong> into the Stream Key field</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-surface-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">5</span>
                  <span>Click &ldquo;Start Streaming&rdquo; in OBS — the stream will appear as a source in this project</span>
                </li>
              </ol>
              <div className="bg-surface-800 rounded-lg p-3 text-xs text-surface-400 mt-2">
                <strong className="text-amber-400">Recommended OBS Settings:</strong><br />
                Output → Encoder: x264 or NVENC • Rate Control: CBR • Bitrate: 4500-6000 kbps<br />
                Video → Resolution: 1920x1080 • FPS: 30 or 60<br />
                Advanced → Keyframe Interval: 2 seconds
              </div>
            </div>

            {/* Stream Health (when live) */}
            {selectedIngest.status === 'live' && (
              <div className="bg-surface-900 rounded-xl border border-green-900/50 p-4 space-y-3">
                <h3 className="text-sm font-bold text-green-400 uppercase tracking-wider">Stream Health</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-surface-500">Resolution</div>
                    <div className="text-lg font-bold text-white font-mono">
                      {selectedIngest.width && selectedIngest.height
                        ? `${selectedIngest.width}x${selectedIngest.height}`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">Bitrate</div>
                    <div className="text-lg font-bold text-white font-mono">
                      {formatBitrate(selectedIngest.bitrate_kbps)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">FPS</div>
                    <div className="text-lg font-bold text-white font-mono">
                      {selectedIngest.fps || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">Codec</div>
                    <div className="text-sm font-medium text-white">
                      {selectedIngest.video_codec || '—'} / {selectedIngest.audio_codec || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">Dropped Frames</div>
                    <div className={cn(
                      'text-lg font-bold font-mono',
                      (selectedIngest.dropped_frames || 0) > 0 ? 'text-amber-400' : 'text-green-400'
                    )}>
                      {selectedIngest.dropped_frames || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">Uptime</div>
                    <div className="text-lg font-bold text-white font-mono">
                      {Math.floor((selectedIngest.uptime_seconds || 0) / 60)}m
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => updateStatus(selectedIngest.id, 'live')}
                className={selectedIngest.status === 'live' ? 'ring-1 ring-green-500' : ''}
              >
                Simulate Live
              </Button>
              <Button
                variant="ghost"
                onClick={() => updateStatus(selectedIngest.id, 'idle')}
              >
                Set Idle
              </Button>
              <Button
                variant="ghost"
                onClick={() => updateStatus(selectedIngest.id, 'error')}
                className="text-red-400"
              >
                Simulate Error
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              title="Select an ingest"
              description="Choose an ingest endpoint from the list, or create a new one to start receiving streams."
              icon={<svg className="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
            />
          </div>
        )}
      </div>

      {/* ── Add Ingest Modal ─────────────────────────── */}
      <Modal isOpen={showAddIngest} onClose={() => setShowAddIngest(false)} title="Create Stream Ingest">
        <div className="space-y-4">
          <Input
            label="Name"
            value={newIngest.name}
            onChange={(e) => setNewIngest(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. OBS Main, Camera 1, Remote Reporter"
          />
          <div>
            <label className="text-xs font-medium text-surface-400 block mb-1">Protocol</label>
            <select
              value={newIngest.protocol}
              onChange={(e) => {
                const p = e.target.value as BroadcastIngestProtocol;
                setNewIngest(prev => ({ ...prev, protocol: p, ingest_url: defaultIngestUrl(p) }));
              }}
              className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
            >
              {BROADCAST_INGEST_PROTOCOL_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
              ))}
            </select>
          </div>
          <Input
            label="Ingest URL"
            value={newIngest.ingest_url || defaultIngestUrl(newIngest.protocol)}
            onChange={(e) => setNewIngest(prev => ({ ...prev, ingest_url: e.target.value }))}
            placeholder={defaultIngestUrl(newIngest.protocol)}
          />
          <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
            <input
              type="checkbox"
              checked={newIngest.auto_source}
              onChange={(e) => setNewIngest(prev => ({ ...prev, auto_source: e.target.checked }))}
              className="rounded border-surface-600"
            />
            Automatically register as a source when stream goes live
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddIngest(false)}>Cancel</Button>
            <Button onClick={handleAddIngest}>Create Ingest</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
