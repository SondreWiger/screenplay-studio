'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Badge, Input, Modal, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BroadcastMosDevice, BroadcastMosDeviceType, BroadcastMosConnectionStatus } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// MOS Devices — MOS protocol device registry and monitoring
// Graphics servers, video servers, prompters, routers, etc.
// ────────────────────────────────────────────────────────────

const DEVICE_TYPES: { value: BroadcastMosDeviceType; label: string; icon: string }[] = [
  { value: 'graphics', label: 'Graphics / CG', icon: '🎨' },
  { value: 'video_server', label: 'Video Server', icon: '🎬' },
  { value: 'prompter', label: 'Prompter', icon: '📜' },
  { value: 'audio', label: 'Audio Console', icon: '🎚️' },
  { value: 'playout', label: 'Playout Server', icon: '▶️' },
  { value: 'router', label: 'Video Router', icon: '🔀' },
  { value: 'other', label: 'Other', icon: '📡' },
];

const STATUS_COLORS: Record<BroadcastMosConnectionStatus, { dot: string; bg: string; label: string }> = {
  connected: { dot: 'bg-green-500', bg: 'bg-green-500/10 text-green-400', label: 'Connected' },
  disconnected: { dot: 'bg-surface-500', bg: 'bg-surface-500/10 text-surface-400', label: 'Disconnected' },
  error: { dot: 'bg-red-500', bg: 'bg-red-500/10 text-red-400', label: 'Error' },
  timeout: { dot: 'bg-yellow-500', bg: 'bg-yellow-500/10 text-yellow-400', label: 'Timeout' },
};

export default function MosDevicesPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<BroadcastMosDevice[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<BroadcastMosDevice | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newMosId, setNewMosId] = useState('');
  const [newNcsId, setNewNcsId] = useState('');
  const [newType, setNewType] = useState<BroadcastMosDeviceType>('graphics');
  const [newHost, setNewHost] = useState('');
  const [newUpperPort, setNewUpperPort] = useState('10540');
  const [newLowerPort, setNewLowerPort] = useState('10541');

  // ─── Data Fetching ───────────────────────────────
  const fetchDevices = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_mos_devices')
      .select('*')
      .eq('project_id', projectId)
      .order('device_type')
      .order('name');
    setDevices(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`mos-devices-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_mos_devices', filter: `project_id=eq.${projectId}` }, () => fetchDevices())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, fetchDevices]);

  // ─── Actions ─────────────────────────────────────

  const handleCreate = async () => {
    if (!newName.trim() || !newMosId.trim() || !newHost.trim() || !user) return;
    const supabase = createClient();
    const { error } = await supabase.from('broadcast_mos_devices').insert({
      project_id: projectId,
      name: newName.trim(),
      mos_id: newMosId.trim(),
      ncs_id: newNcsId.trim() || null,
      device_type: newType,
      host: newHost.trim(),
      upper_port: parseInt(newUpperPort) || 10540,
      lower_port: parseInt(newLowerPort) || 10541,
      is_active: true,
      connection_status: 'disconnected',
    });
    if (error) { toast(error.message, 'error'); return; }
    toast('Device added', 'success');
    setShowCreateModal(false);
    resetForm();
    fetchDevices();
  };

  const resetForm = () => {
    setNewName('');
    setNewMosId('');
    setNewNcsId('');
    setNewType('graphics');
    setNewHost('');
    setNewUpperPort('10540');
    setNewLowerPort('10541');
  };

  const toggleActive = async (device: BroadcastMosDevice) => {
    const supabase = createClient();
    await supabase
      .from('broadcast_mos_devices')
      .update({ is_active: !device.is_active })
      .eq('id', device.id);
    fetchDevices();
  };

  const deleteDevice = async (deviceId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('broadcast_mos_devices').delete().eq('id', deviceId);
    if (error) toast(error.message, 'error');
    else {
      if (selectedDevice?.id === deviceId) setSelectedDevice(null);
      fetchDevices();
    }
  };

  const simulateHeartbeat = async (device: BroadcastMosDevice) => {
    const supabase = createClient();
    const statuses: BroadcastMosConnectionStatus[] = ['connected', 'disconnected', 'error', 'timeout'];
    const currentIdx = statuses.indexOf(device.connection_status);
    const nextStatus = statuses[(currentIdx + 1) % statuses.length];
    await supabase.from('broadcast_mos_devices').update({
      connection_status: nextStatus,
      last_heartbeat: nextStatus === 'connected' ? new Date().toISOString() : device.last_heartbeat,
      last_error: nextStatus === 'error' ? 'MOS heartbeat timeout after 30s' : null,
    }).eq('id', device.id);
    fetchDevices();
  };

  // ─── Render ──────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  const connectedCount = devices.filter(d => d.connection_status === 'connected').length;
  const errorCount = devices.filter(d => d.connection_status === 'error' || d.connection_status === 'timeout').length;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <div>
          <h1 className="text-lg font-bold text-white">MOS Devices</h1>
          <p className="text-xs text-surface-400">Media Object Server protocol devices</p>
        </div>
        <div className="flex items-center gap-2">
          {connectedCount > 0 && (
            <Badge variant="info">{connectedCount} connected</Badge>
          )}
          {errorCount > 0 && (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/30">{errorCount} error</Badge>
          )}
          <Button size="sm" onClick={() => setShowCreateModal(true)}>+ Device</Button>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Device List */}
        <div className={cn(
          'overflow-y-auto border-r border-surface-800',
          selectedDevice ? 'w-2/3' : 'w-full'
        )}>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-surface-500 gap-4">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              <p className="text-sm">No MOS devices registered</p>
              <Button size="sm" onClick={() => setShowCreateModal(true)}>+ Add Device</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-900 z-10">
                <tr className="text-[10px] text-surface-500 uppercase tracking-wider border-b border-surface-800">
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">MOS ID</th>
                  <th className="px-4 py-2 text-left">Host</th>
                  <th className="px-4 py-2 text-left">Ports</th>
                  <th className="px-4 py-2 text-left">Last Heartbeat</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {devices.map(device => {
                  const status = STATUS_COLORS[device.connection_status];
                  const deviceType = DEVICE_TYPES.find(t => t.value === device.device_type);
                  const isSelected = selectedDevice?.id === device.id;

                  return (
                    <tr
                      key={device.id}
                      onClick={() => setSelectedDevice(isSelected ? null : device)}
                      className={cn(
                        'cursor-pointer hover:bg-surface-800/30 transition-colors',
                        isSelected && 'bg-surface-800/50',
                        !device.is_active && 'opacity-50'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', status.dot,
                            device.connection_status === 'connected' && 'animate-pulse'
                          )} />
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', status.bg)}>
                            {status.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {device.name}
                      </td>
                      <td className="px-4 py-3 text-surface-400">
                        <span className="mr-1">{deviceType?.icon}</span>
                        {deviceType?.label}
                      </td>
                      <td className="px-4 py-3 text-surface-500 font-mono text-xs">
                        {device.mos_id}
                      </td>
                      <td className="px-4 py-3 text-surface-500 font-mono text-xs">
                        {device.host}
                      </td>
                      <td className="px-4 py-3 text-surface-500 font-mono text-xs">
                        {device.upper_port}/{device.lower_port}
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-500">
                        {device.last_heartbeat
                          ? new Date(device.last_heartbeat).toLocaleTimeString('nb-NO')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); simulateHeartbeat(device); }}
                            className="text-[10px] px-2 py-1 rounded bg-surface-800 text-surface-400 hover:text-white transition-colors"
                            title="Simulate status change"
                          >
                            Ping
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleActive(device); }}
                            className="text-[10px] px-2 py-1 rounded bg-surface-800 text-surface-400 hover:text-white transition-colors"
                          >
                            {device.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteDevice(device.id); }}
                            className="text-[10px] px-2 py-1 rounded text-surface-500 hover:text-red-400 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selectedDevice && (
          <div className="w-1/3 overflow-y-auto bg-surface-900/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">{selectedDevice.name}</h2>
              <button
                onClick={() => setSelectedDevice(null)}
                className="text-surface-500 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-surface-500 block mb-1">MOS ID</span>
                  <span className="text-white font-mono">{selectedDevice.mos_id}</span>
                </div>
                {selectedDevice.ncs_id && (
                  <div>
                    <span className="text-surface-500 block mb-1">NCS ID</span>
                    <span className="text-white font-mono">{selectedDevice.ncs_id}</span>
                  </div>
                )}
                <div>
                  <span className="text-surface-500 block mb-1">Host</span>
                  <span className="text-white font-mono">{selectedDevice.host}</span>
                </div>
                <div>
                  <span className="text-surface-500 block mb-1">Ports</span>
                  <span className="text-white font-mono">{selectedDevice.upper_port} / {selectedDevice.lower_port}</span>
                </div>
                <div>
                  <span className="text-surface-500 block mb-1">Type</span>
                  <span className="text-white">{DEVICE_TYPES.find(t => t.value === selectedDevice.device_type)?.label}</span>
                </div>
                <div>
                  <span className="text-surface-500 block mb-1">Active</span>
                  <span className={selectedDevice.is_active ? 'text-green-400' : 'text-surface-500'}>
                    {selectedDevice.is_active ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-surface-500 text-xs block mb-1">Connection</span>
                <div className={cn(
                  'px-3 py-2 rounded text-xs font-medium',
                  STATUS_COLORS[selectedDevice.connection_status].bg
                )}>
                  {STATUS_COLORS[selectedDevice.connection_status].label}
                  {selectedDevice.last_heartbeat && (
                    <span className="block text-[10px] opacity-75 mt-0.5">
                      Last heartbeat: {new Date(selectedDevice.last_heartbeat).toLocaleString('nb-NO')}
                    </span>
                  )}
                </div>
              </div>

              {selectedDevice.last_error && (
                <div>
                  <span className="text-surface-500 text-xs block mb-1">Last Error</span>
                  <div className="px-3 py-2 rounded bg-red-500/10 text-red-400 text-xs font-mono">
                    {selectedDevice.last_error}
                  </div>
                </div>
              )}

              {/* MOS protocol reference */}
              <div className="pt-2 border-t border-surface-800">
                <span className="text-[10px] text-surface-500 block mb-2">MOS TCP Ports</span>
                <div className="space-y-1 text-[10px] text-surface-400">
                  <div className="flex justify-between">
                    <span>Upper Port (MOS → NCS)</span>
                    <span className="font-mono text-white">{selectedDevice.upper_port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lower Port (NCS → MOS)</span>
                    <span className="font-mono text-white">{selectedDevice.lower_port}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-surface-800">
                <span className="text-[10px] text-surface-500 block mb-2">Timestamps</span>
                <div className="space-y-1 text-[10px] text-surface-400">
                  <div className="flex justify-between">
                    <span>Created</span>
                    <span>{new Date(selectedDevice.created_at).toLocaleString('nb-NO')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Updated</span>
                    <span>{new Date(selectedDevice.updated_at).toLocaleString('nb-NO')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Modal ──────────────────────────── */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetForm(); }} title="Add MOS Device">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-surface-400 mb-1 block">Device Name</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Viz Engine 1" />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 mb-1 block">MOS ID *</label>
              <Input value={newMosId} onChange={e => setNewMosId(e.target.value)} placeholder="e.g. VIZ.ENGINE.1" className="font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 mb-1 block">NCS ID</label>
              <Input value={newNcsId} onChange={e => setNewNcsId(e.target.value)} placeholder="e.g. ENPS.NCS" className="font-mono" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-surface-400 mb-2 block">Device Type</label>
            <div className="grid grid-cols-4 gap-2">
              {DEVICE_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setNewType(t.value)}
                  className={cn(
                    'p-2 rounded border text-[10px] text-center transition-colors',
                    newType === t.value
                      ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 text-white'
                      : 'border-surface-700 text-surface-400 hover:border-surface-500'
                  )}
                >
                  <span className="text-lg block">{t.icon}</span>
                  <span className="block mt-0.5">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="text-xs font-medium text-surface-400 mb-1 block">Host / IP *</label>
              <Input value={newHost} onChange={e => setNewHost(e.target.value)} placeholder="192.168.1.100" className="font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 mb-1 block">Upper Port</label>
              <Input value={newUpperPort} onChange={e => setNewUpperPort(e.target.value)} placeholder="10540" className="font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 mb-1 block">Lower Port</label>
              <Input value={newLowerPort} onChange={e => setNewLowerPort(e.target.value)} placeholder="10541" className="font-mono" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowCreateModal(false); resetForm(); }}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || !newMosId.trim() || !newHost.trim()}>
              Add Device
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
