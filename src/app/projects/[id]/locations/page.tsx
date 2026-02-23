'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner } from '@/components/ui';
import { cn, formatCurrency } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { Location, SceneLocationType } from '@/lib/types';

// Dynamic import with SSR disabled for Leaflet
const LocationMap = dynamic(
  () => import('./LocationMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-surface-900">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    ),
  }
);

export default function LocationsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'scouting' | 'needs_setup'>('all');
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const hasSynced = useRef(false);

  useEffect(() => { fetchLocations(); }, [params.id]);

  // Auto-sync locations from script on first load
  useEffect(() => {
    if (!loading && !hasSynced.current && canEdit) {
      hasSynced.current = true;
      handleAutoSync();
    }
  }, [loading]);

  const fetchLocations = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('locations').select('*').eq('project_id', params.id).order('name');
      if (error) console.error('Locations fetch error:', error.message);
      setLocations(data || []);
    } catch (err) {
      console.error('Unexpected error fetching locations:', err);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  // Parse scene heading to extract location info
  function parseSceneHeading(heading: string) {
    let locationType: 'INT' | 'EXT' | 'INT_EXT' = 'INT';
    const h = heading.trim().toUpperCase();
    if (h.startsWith('INT./EXT.') || h.startsWith('INT/EXT') || h.startsWith('I/E.')) locationType = 'INT_EXT';
    else if (h.startsWith('EXT.')) locationType = 'EXT';
    else if (h.startsWith('INT.')) locationType = 'INT';

    let rest = h.replace(/^(INT\.\/EXT\.|INT\/EXT|I\/E\.|INT\.|EXT\.)\s*/i, '').trim();
    const dashParts = rest.split(/\s+-\s+/);
    const locationName = dashParts[0]?.trim() || '';
    return { locationType, locationName };
  }

  // Auto-sync: detect location names from script scene headings
  const handleAutoSync = async () => {
    setSyncing(true);
    try {
      const supabase = createClient();
      const { data: scripts } = await supabase
        .from('scripts').select('id').eq('project_id', params.id).limit(1);
      if (!scripts || scripts.length === 0) { setSyncing(false); return; }

      const { data: elements } = await supabase
        .from('script_elements')
        .select('content')
        .eq('script_id', scripts[0].id)
        .eq('element_type', 'scene_heading')
        .eq('is_omitted', false);

      if (!elements || elements.length === 0) { setSyncing(false); return; }

      // Deduplicate location names  
      const locationMap = new Map<string, SceneLocationType>();
      elements.forEach((el: { content: string }) => {
        const parsed = parseSceneHeading(el.content);
        if (parsed.locationName && !locationMap.has(parsed.locationName)) {
          locationMap.set(parsed.locationName, parsed.locationType as SceneLocationType);
        }
      });

      const existingNames = new Set(locations.map(l => l.name.toUpperCase()));
      const newLocations: Array<{ name: string; type: SceneLocationType }> = [];
      locationMap.forEach((type, name) => {
        if (!existingNames.has(name)) {
          newLocations.push({ name, type });
        }
      });

      if (newLocations.length === 0) { setSyncing(false); return; }

      const locsToCreate = newLocations.map((loc) => ({
        project_id: params.id,
        name: loc.name.charAt(0) + loc.name.slice(1).toLowerCase(), // Title case
        location_type: loc.type,
        created_by: user?.id,
        is_confirmed: false,
        permits_required: false,
        power_available: true,
        photos: [],
        tags: [],
      }));

      await supabase.from('locations').insert(locsToCreate);
      await fetchLocations();
    } catch (err) {
      console.error('Location auto-sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Determine if a location "needs setup"
  const needsSetup = (l: Location) => !l.description && !l.address && !l.is_confirmed;

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    const ok = await confirm({ message: 'Delete this location?', variant: 'danger', confirmLabel: 'Delete' }); if (!ok) return;
    const supabase = createClient();
    await supabase.from('locations').delete().eq('id', id);
    setLocations(locations.filter((l) => l.id !== id));
  };

  const filtered = filter === 'all' ? locations
    : filter === 'confirmed' ? locations.filter((l) => l.is_confirmed)
    : filter === 'needs_setup' ? locations.filter(needsSetup)
    : locations.filter((l) => !l.is_confirmed);

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Locations</h1>
          <p className="text-xs sm:text-sm text-surface-400 mt-1">
            {locations.filter((l) => l.is_confirmed).length} confirmed / {locations.length} total
            {locations.filter(needsSetup).length > 0 && (
              <span className="text-amber-400"> &bull; {locations.filter(needsSetup).length} need setup</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-surface-800 rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              viewMode === 'list' ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white'
            )}>
              <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
            <button onClick={() => setViewMode('map')} className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              viewMode === 'map' ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white'
            )}>
              <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Map
            </button>
          </div>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={handleAutoSync} loading={syncing}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Sync from Script</span>
              <span className="sm:hidden">Sync</span>
            </Button>
          )}
          {canEdit && <Button size="sm" onClick={() => { setSelectedLocation(null); setShowEditor(true); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Add Location</span>
            <span className="sm:hidden">Add</span>
          </Button>}
        </div>
      </div>

      {viewMode === 'map' ? (
        <div className="rounded-xl overflow-hidden border border-surface-800 h-[calc(100dvh-14rem)] md:h-[calc(100dvh-12rem)] relative">
          <LocationMap projectId={params.id} locations={locations} canEdit={canEdit} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
            {(['all', 'confirmed', 'scouting', 'needs_setup'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn(
                'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors',
                filter === f ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
              )}>
                {f === 'needs_setup' ? `Needs Setup (${locations.filter(needsSetup).length})` : f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No locations yet" description="Add locations for your production"
              action={canEdit ? <Button onClick={() => { setSelectedLocation(null); setShowEditor(true); }}>Add Location</Button> : undefined} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {filtered.map((location) => (
            <Card key={location.id} hover className="overflow-hidden" onClick={() => { setSelectedLocation(location); setShowEditor(true); }}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge size="sm" variant="info">{location.location_type}</Badge>
                      <h3 className="font-semibold text-white">{location.name}</h3>
                      {needsSetup(location) && (
                        <Badge variant="warning" size="sm">
                          <svg className="w-3 h-3 mr-0.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                          Set Up
                        </Badge>
                      )}
                    </div>
                    {!location.address && needsSetup(location) && (
                      <p className="text-xs text-amber-400/70 mt-1 italic">Click to add details, address &amp; more</p>
                    )}
                    {location.address && <p className="text-xs text-surface-500 mt-1">{location.address}</p>}
                  </div>
                  {location.is_confirmed ? (
                    <Badge variant="success">Confirmed</Badge>
                  ) : (
                    <Badge variant="warning">Scouting</Badge>
                  )}
                </div>

                {location.description && (
                  <p className="mt-3 text-sm text-surface-400 line-clamp-2">{location.description}</p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  {location.cost_per_day && (
                    <div className="flex items-center gap-1 text-surface-400">
                      <span className="text-surface-500">Cost/Day:</span> {formatCurrency(location.cost_per_day)}
                    </div>
                  )}
                  {location.permits_required && (
                    <div className="flex items-center gap-1">
                      <Badge variant="warning" size="sm">Permit Required</Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-surface-400">
                    <span className="text-surface-500">Power:</span> {location.power_available ? 'Yes' : 'No'}
                  </div>
                  {location.contact_name && (
                    <div className="flex items-center gap-1 text-surface-400">
                      <span className="text-surface-500">Contact:</span> {location.contact_name}
                    </div>
                  )}
                </div>

                {location.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {location.tags.map((tag) => <Badge key={tag} size="sm">{tag}</Badge>)}
                  </div>
                )}
              </div>
            </Card>
          ))}
            </div>
          )}
        </>
      )}

      <LocationEditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        location={selectedLocation}
        projectId={params.id}
        userId={user?.id || ''}
        onSaved={() => { fetchLocations(); setShowEditor(false); }}
        onDelete={handleDelete}
        canEdit={canEdit}
      />
      <ConfirmDialog />
    </div>
  );
}

function LocationEditor({ isOpen, onClose, location, projectId, userId, onSaved, onDelete, canEdit }: {
  isOpen: boolean; onClose: () => void; location: Location | null; projectId: string;
  userId: string; onSaved: () => void; onDelete: (id: string) => void; canEdit: boolean;
}) {
  const [form, setForm] = useState({
    name: '', description: '', address: '', location_type: 'INT' as SceneLocationType,
    contact_name: '', contact_phone: '', contact_email: '', availability_notes: '',
    permits_required: false, permit_notes: '', parking_info: '', power_available: true,
    sound_notes: '', lighting_notes: '', cost_per_day: '', is_confirmed: false, tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    if (location) {
      setForm({
        name: location.name, description: location.description || '', address: location.address || '',
        location_type: location.location_type, contact_name: location.contact_name || '',
        contact_phone: location.contact_phone || '', contact_email: location.contact_email || '',
        availability_notes: location.availability_notes || '', permits_required: location.permits_required,
        permit_notes: location.permit_notes || '', parking_info: location.parking_info || '',
        power_available: location.power_available, sound_notes: location.sound_notes || '',
        lighting_notes: location.lighting_notes || '', cost_per_day: location.cost_per_day?.toString() || '',
        is_confirmed: location.is_confirmed, tags: location.tags || [],
      });
    } else {
      setForm({
        name: '', description: '', address: '', location_type: 'INT', contact_name: '',
        contact_phone: '', contact_email: '', availability_notes: '', permits_required: false,
        permit_notes: '', parking_info: '', power_available: true, sound_notes: '', lighting_notes: '',
        cost_per_day: '', is_confirmed: false, tags: [],
      });
    }
    setTab('details');
  }, [location, isOpen]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const payload = {
      ...form, project_id: projectId, created_by: userId,
      cost_per_day: form.cost_per_day ? parseFloat(form.cost_per_day) : null,
    };

    if (location) {
      await supabase.from('locations').update(payload).eq('id', location.id);
    } else {
      await supabase.from('locations').insert(payload);
    }
    setLoading(false);
    onSaved();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={location ? `Edit: ${location.name}` : 'New Location'} size="xl">
      <div className="flex gap-1 mb-4 md:mb-6 bg-surface-800 rounded-lg p-1 overflow-x-auto">
        {['details', 'logistics', 'technical', 'contact'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            'flex-1 min-w-[70px] px-2 md:px-3 py-1.5 rounded-md text-xs md:text-sm font-medium capitalize transition-colors whitespace-nowrap',
            tab === t ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white'
          )}>{t}</button>
        ))}
      </div>

      <div className="space-y-4 max-h-[50vh] md:max-h-[60vh] overflow-y-auto pr-1 md:pr-2">
        {tab === 'details' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="sm:col-span-2">
                <Input label="Location Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Type</label>
                <select value={form.location_type} onChange={(e) => setForm({ ...form, location_type: e.target.value as SceneLocationType })}
                  className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
                  <option value="INT">INT</option><option value="EXT">EXT</option>
                  <option value="INT_EXT">INT/EXT</option><option value="EXT_INT">EXT/INT</option>
                </select>
              </div>
            </div>
            <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_confirmed} onChange={(e) => setForm({ ...form, is_confirmed: e.target.checked })} />
                <span className="text-sm text-surface-300">Location Confirmed</span>
              </label>
            </div>
          </>
        )}
        {tab === 'logistics' && (
          <>
            <Input label="Cost Per Day ($)" type="number" value={form.cost_per_day} onChange={(e) => setForm({ ...form, cost_per_day: e.target.value })} />
            <Textarea label="Availability Notes" value={form.availability_notes} onChange={(e) => setForm({ ...form, availability_notes: e.target.value })} rows={2} />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.permits_required} onChange={(e) => setForm({ ...form, permits_required: e.target.checked })} />
                <span className="text-sm text-surface-300">Permits Required</span>
              </label>
            </div>
            {form.permits_required && <Textarea label="Permit Notes" value={form.permit_notes} onChange={(e) => setForm({ ...form, permit_notes: e.target.value })} rows={2} />}
            <Textarea label="Parking Info" value={form.parking_info} onChange={(e) => setForm({ ...form, parking_info: e.target.value })} rows={2} />
          </>
        )}
        {tab === 'technical' && (
          <>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.power_available} onChange={(e) => setForm({ ...form, power_available: e.target.checked })} />
                <span className="text-sm text-surface-300">Power Available On-Site</span>
              </label>
            </div>
            <Textarea label="Sound Notes" value={form.sound_notes} onChange={(e) => setForm({ ...form, sound_notes: e.target.value })} rows={2} placeholder="Ambient noise, echo, nearby traffic..." />
            <Textarea label="Lighting Notes" value={form.lighting_notes} onChange={(e) => setForm({ ...form, lighting_notes: e.target.value })} rows={2} placeholder="Natural light, windows, time-of-day considerations..." />
          </>
        )}
        {tab === 'contact' && (
          <>
            <Input label="Contact Name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            <Input label="Phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            <Input label="Email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-6 mt-6 border-t border-surface-800">
        <div>{canEdit && location && <Button variant="danger" size="sm" onClick={() => onDelete(location.id)}>Delete</Button>}</div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {canEdit && <Button onClick={handleSave} loading={loading}>{location ? 'Save' : 'Create'}</Button>}
        </div>
      </div>
    </Modal>
  );
}
