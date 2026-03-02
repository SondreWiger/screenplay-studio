'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Modal, Input, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BroadcastSource, BroadcastSourceType, BroadcastSourceProtocol, BroadcastTallyState } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Sources — live source registry (cameras, feeds, returns, etc.)
// ────────────────────────────────────────────────────────────

const SOURCE_TYPE_COLORS: Record<string, string> = {
  camera: 'bg-blue-600', robocam: 'bg-blue-500', jib: 'bg-blue-400',
  crane: 'bg-blue-300', live_feed: 'bg-red-600', remote: 'bg-purple-600',
  satellite: 'bg-indigo-600', vtr: 'bg-emerald-600', video_server: 'bg-teal-600',
  clip_player: 'bg-teal-500', graphics: 'bg-orange-600', cg: 'bg-orange-500',
  audio_only: 'bg-amber-600', telephone: 'bg-surface-600', skype: 'bg-sky-600',
  ndi: 'bg-green-600', srt: 'bg-green-500', web_feed: 'bg-cyan-600',
  other: 'bg-surface-700',
};

const PROTOCOL_LABELS: Record<BroadcastSourceProtocol, string> = {
  sdi: 'SDI', ndi: 'NDI', srt: 'SRT', hls: 'HLS',
  rtmp: 'RTMP', rtsp: 'RTSP', webrtc: 'WebRTC', nmos: 'NMOS',
};

const SOURCE_TYPES: BroadcastSourceType[] = [
  'camera', 'robocam', 'jib', 'crane', 'vtr', 'video_server', 'clip_player',
  'live_feed', 'satellite', 'remote', 'graphics', 'cg', 'audio_only',
  'telephone', 'skype', 'ndi', 'srt', 'web_feed', 'other',
];

const PROTOCOLS: BroadcastSourceProtocol[] = ['sdi', 'ndi', 'srt', 'hls', 'rtmp', 'rtsp', 'webrtc', 'nmos'];

const TALLY_COLORS: Record<BroadcastTallyState, string> = {
  off: 'bg-surface-600', preview: 'bg-green-500', program: 'bg-red-500',
};

export default function SourcesPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<BroadcastSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<BroadcastSource | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');

  // Form
  const [form, setForm] = useState({
    name: '', short_name: '', source_type: 'camera' as BroadcastSourceType,
    protocol: 'sdi' as BroadcastSourceProtocol,
    connection_url: '', ndi_source_name: '', is_primary: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // ─── Fetch ─────────────────────────────────────────────

  const fetchSources = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_sources')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    setSources(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`sources-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_sources', filter: `project_id=eq.${projectId}` }, () => fetchSources())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchSources]);

  // ─── CRUD ──────────────────────────────────────────────

  const resetForm = () => {
    setForm({ name: '', short_name: '', source_type: 'camera', protocol: 'sdi', connection_url: '', ndi_source_name: '', is_primary: false });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    const supabase = createClient();
    const payload = {
      project_id: projectId,
      name: form.name,
      short_name: form.short_name || null,
      source_type: form.source_type,
      protocol: form.protocol,
      connection_url: form.connection_url || null,
      ndi_source_name: form.ndi_source_name || null,
      is_primary: form.is_primary,
    };

    if (editingId) {
      const { error } = await supabase.from('broadcast_sources').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Source updated');
    } else {
      const { error } = await supabase.from('broadcast_sources').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Source added');
    }
    resetForm();
    setShowForm(false);
    fetchSources();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('broadcast_sources').delete().eq('id', id);
    toast.success('Source deleted');
    if (selectedSource?.id === id) setSelectedSource(null);
    fetchSources();
  };

  const handleToggleActive = async (source: BroadcastSource) => {
    const supabase = createClient();
    await supabase.from('broadcast_sources').update({ is_active: !source.is_active }).eq('id', source.id);
    fetchSources();
  };

  const handleSetTally = async (source: BroadcastSource, state: BroadcastTallyState) => {
    const supabase = createClient();
    await supabase.from('broadcast_sources').update({ tally_state: state }).eq('id', source.id);
    fetchSources();
  };

  const startEdit = (source: BroadcastSource) => {
    setForm({
      name: source.name, short_name: source.short_name || '',
      source_type: source.source_type, protocol: source.protocol || 'sdi',
      connection_url: source.connection_url || '', ndi_source_name: source.ndi_source_name || '',
      is_primary: source.is_primary,
    });
    setEditingId(source.id);
    setShowForm(true);
  };

  // ─── Filter ────────────────────────────────────────────

  const filtered = sources.filter(s => {
    if (filterType !== 'all' && s.source_type !== filterType) return false;
    if (filterActive === 'active' && !s.is_active) return false;
    if (filterActive === 'inactive' && s.is_active) return false;
    return true;
  });

  // Group by type
  const grouped = new Map<string, BroadcastSource[]>();
  for (const s of filtered) {
    const arr = grouped.get(s.source_type) || [];
    arr.push(s);
    grouped.set(s.source_type, arr);
  }

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* Main Source Grid */}
      <div className={cn('flex flex-col', selectedSource ? 'w-2/3' : 'flex-1')}>
        <div className="p-3 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white">Sources</h2>
            <span className="text-xs text-surface-500">
              {sources.length} total · {sources.filter(s => s.is_active).length} active ·
              {' '}{sources.filter(s => s.tally_state === 'program').length} on-air
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-surface-800 text-white border border-surface-700 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Types</option>
              {Array.from(new Set(sources.map(s => s.source_type))).sort().map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="bg-surface-800 text-white border border-surface-700 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
              + Add Source
            </Button>
          </div>
        </div>

        {/* Quick presets */}
        {sources.length === 0 && (
          <div className="px-4 pt-4">
            <p className="text-xs text-surface-500 mb-2 uppercase tracking-wider font-bold">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '🎨 Color Bars', name: 'Color Bars', short_name: 'CBARS', type: 'web_feed' as BroadcastSourceType, url: '/colorbar' },
                { label: '📷 CAM 1', name: 'Camera 1', short_name: 'CAM1', type: 'camera' as BroadcastSourceType, url: '' },
                { label: '📷 CAM 2', name: 'Camera 2', short_name: 'CAM2', type: 'camera' as BroadcastSourceType, url: '' },
                { label: '🖥️ Graphics', name: 'Graphics', short_name: 'GFX', type: 'graphics' as BroadcastSourceType, url: '' },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setForm(prev => ({ ...prev, name: preset.name, short_name: preset.short_name, source_type: preset.type, connection_url: preset.url }));
                    setShowForm(true);
                  }}
                  className="px-3 py-1.5 text-xs bg-surface-800 hover:bg-surface-700 border border-surface-700 hover:border-surface-600 text-surface-300 hover:text-white rounded transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Colorbar preset shortcut (always visible) */}
          {!sources.some(s => s.connection_url === '/colorbar') && (
            <div className="mb-4 flex items-center gap-3 p-3 rounded-lg border border-dashed border-surface-700 bg-surface-900/40">
              <div className="w-16 h-9 rounded flex-shrink-0 overflow-hidden" style={{ background: 'linear-gradient(to right,#c0c0c0 14%,#c0c000 28%,#00c0c0 42%,#00c000 57%,#c000c0 71%,#c00000 85%,#0000c0)' }} />
              <div>
                <p className="text-xs text-white font-medium">SMPTE Color Bars</p>
                <p className="text-[10px] text-surface-500">Built-in test signal source (/colorbar)</p>
              </div>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  const { error } = await supabase.from('broadcast_sources').insert({
                    project_id: projectId, name: 'Color Bars', short_name: 'CBARS',
                    source_type: 'web_feed', connection_url: '/colorbar',
                    is_active: true, is_primary: false, sort_order: 0,
                  });
                  if (error) toast.error(error.message); else { toast.success('Color Bars source added'); fetchSources(); }
                }}
                className="ml-auto px-3 py-1.5 text-xs bg-[#FF5F1F] hover:bg-[#E54E15] text-white rounded font-medium transition-colors"
              >
                + Add
              </button>
            </div>
          )}
          {filtered.length === 0 ? (
            <EmptyState
              title="No Sources"
              description="Add cameras, feeds, and other media sources for your broadcast."
              action={<Button onClick={() => { resetForm(); setShowForm(true); }}>Add Source</Button>}
            />
          ) : (
            Array.from(grouped.entries()).map(([type, items]) => (
              <div key={type} className="mb-6">
                <h3 className="text-xs font-bold text-surface-500 uppercase mb-2 flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', SOURCE_TYPE_COLORS[type] || 'bg-surface-600')} />
                  {type.replace(/_/g, ' ')} ({items.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map(source => (
                    <button
                      key={source.id}
                      onClick={() => setSelectedSource(source)}
                      className={cn(
                        'relative text-left p-3 rounded-lg border transition-all',
                        selectedSource?.id === source.id
                          ? 'border-[#FF5F1F] bg-surface-800'
                          : 'border-surface-800 bg-surface-900 hover:border-surface-700',
                      )}
                    >
                      {/* Tally indicator */}
                      <div className={cn(
                        'absolute top-2 right-2 w-2.5 h-2.5 rounded-full',
                        TALLY_COLORS[source.tally_state],
                        source.tally_state === 'program' && 'animate-pulse',
                      )} />

                      {/* Source thumbnail / placeholder */}
                      <div className={cn(
                        'w-full aspect-video rounded mb-2 flex items-center justify-center',
                        SOURCE_TYPE_COLORS[source.source_type] || 'bg-surface-700',
                        !source.is_active && 'opacity-40',
                      )}>
                        {source.thumbnail_url ? (
                          <img src={source.thumbnail_url} alt="" className="w-full h-full object-cover rounded" />
                        ) : (
                          <span className="text-white/60 text-[10px] font-bold uppercase">
                            {source.short_name || source.source_type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-medium text-white truncate">{source.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {source.protocol && (
                          <span className="text-[10px] text-surface-500">
                            {PROTOCOL_LABELS[source.protocol]}
                          </span>
                        )}
                        {source.is_primary && <span className="text-[9px] text-amber-400 font-bold">PRIMARY</span>}
                        {!source.is_active && <span className="text-[9px] text-surface-600">INACTIVE</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedSource && (
        <div className="w-1/3 border-l border-surface-800 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">{selectedSource.name}</h3>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => startEdit(selectedSource)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => handleToggleActive(selectedSource)}>
                {selectedSource.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <button onClick={() => setSelectedSource(null)} className="p-1 text-surface-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Preview */}
            <div className={cn(
              'w-full aspect-video rounded-lg overflow-hidden flex items-center justify-center relative',
              (selectedSource.source_type === 'web_feed' && selectedSource.connection_url) ? 'bg-black' : SOURCE_TYPE_COLORS[selectedSource.source_type] || 'bg-surface-700',
              !selectedSource.is_active && 'opacity-30',
            )}>
              {selectedSource.thumbnail_url ? (
                <img src={selectedSource.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : selectedSource.source_type === 'web_feed' && selectedSource.connection_url ? (
                <iframe
                  src={selectedSource.connection_url}
                  className="w-full h-full border-0 pointer-events-none"
                  title={selectedSource.name}
                />
              ) : (
                <div className="text-center px-3">
                  {!selectedSource.is_active ? (
                    <span className="text-white/50 text-xs font-bold">INACTIVE</span>
                  ) : selectedSource.protocol === 'ndi' || selectedSource.source_type === 'ndi' ? (
                    <>
                      <div className="text-white/60 text-xs font-bold mb-1">NDI SOURCE</div>
                      <div className="text-white/30 text-[10px]">Requires NDI bridge</div>
                    </>
                  ) : selectedSource.protocol === 'srt' || selectedSource.source_type === 'srt' ? (
                    <>
                      <div className="text-white/60 text-xs font-bold mb-1">SRT STREAM</div>
                      <div className="text-white/30 text-[10px]">Requires SRT ingest</div>
                    </>
                  ) : selectedSource.protocol === 'webrtc' ? (
                    <>
                      <div className="text-white/60 text-xs font-bold mb-1">WebRTC</div>
                      <div className="text-white/30 text-[10px]">Requires WebRTC bridge</div>
                    </>
                  ) : (
                    <>
                      <div className="text-white/60 text-xs font-bold mb-1">{(selectedSource.short_name || selectedSource.source_type).toUpperCase()}</div>
                      <div className="text-white/30 text-[10px]">{selectedSource.protocol ? `${selectedSource.protocol.toUpperCase()} signal` : 'No signal'}</div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Tally control */}
            <div>
              <div className="text-[10px] text-surface-500 uppercase mb-1">Tally</div>
              <div className="flex gap-1">
                {(['off', 'preview', 'program'] as BroadcastTallyState[]).map(state => (
                  <button
                    key={state}
                    onClick={() => handleSetTally(selectedSource, state)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded font-bold transition-all',
                      selectedSource.tally_state === state
                        ? state === 'program' ? 'bg-red-600 text-white' : state === 'preview' ? 'bg-green-600 text-white' : 'bg-surface-600 text-white'
                        : 'bg-surface-800 text-surface-400 hover:text-white',
                    )}
                  >
                    {state.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Field label="Type" value={selectedSource.source_type.replace(/_/g, ' ')} />
              <Field label="Protocol" value={selectedSource.protocol ? PROTOCOL_LABELS[selectedSource.protocol] : '—'} />
              <Field label="Short Name" value={selectedSource.short_name || '—'} />
              <Field label="Status" value={selectedSource.is_active ? 'Active' : 'Inactive'} />
              <Field label="Primary" value={selectedSource.is_primary ? 'Yes' : 'No'} />
              <Field label="Tally" value={selectedSource.tally_state} />
            </div>

            {selectedSource.connection_url && (
              <div className="text-xs">
                <span className="text-surface-500">Connection:</span>
                <code className="block mt-1 text-surface-300 bg-surface-800 p-2 rounded text-[11px] break-all">
                  {selectedSource.connection_url}
                </code>
              </div>
            )}

            {selectedSource.ndi_source_name && (
              <div className="text-xs">
                <span className="text-surface-500">NDI Source:</span>
                <code className="block mt-1 text-surface-300 bg-surface-800 p-2 rounded text-[11px]">
                  {selectedSource.ndi_source_name}
                </code>
              </div>
            )}

            <div className="pt-3 border-t border-surface-800">
              <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleDelete(selectedSource.id)}>
                Delete Source
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingId ? 'Edit Source' : 'Add Source'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Camera 1, Remote NYC, VTR-A..." />
          <Input label="Short Name" value={form.short_name} onChange={(e) => setForm(p => ({ ...p, short_name: e.target.value }))} placeholder="CAM1, RMT-NYC..." />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Type</label>
              <select
                value={form.source_type}
                onChange={(e) => setForm(p => ({ ...p, source_type: e.target.value as BroadcastSourceType }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Protocol</label>
              <select
                value={form.protocol}
                onChange={(e) => setForm(p => ({ ...p, protocol: e.target.value as BroadcastSourceProtocol }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                {PROTOCOLS.map(p => <option key={p} value={p}>{PROTOCOL_LABELS[p]}</option>)}
              </select>
            </div>
          </div>
          <Input label="Connection URL" value={form.connection_url} onChange={(e) => setForm(p => ({ ...p, connection_url: e.target.value }))} placeholder="ndi://studio-a/cam1 or srt://..." />
          <Input label="NDI Source Name" value={form.ndi_source_name} onChange={(e) => setForm(p => ({ ...p, ndi_source_name: e.target.value }))} placeholder="STUDIO-A (Camera 1)" />
          <label className="flex items-center gap-2 text-sm text-surface-300">
            <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm(p => ({ ...p, is_primary: e.target.checked }))} className="rounded bg-surface-800 border-surface-600" />
            Primary source
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? 'Update' : 'Add Source'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-surface-900 rounded">
      <div className="text-[10px] text-surface-500 uppercase">{label}</div>
      <div className="text-surface-200 capitalize">{value}</div>
    </div>
  );
}
