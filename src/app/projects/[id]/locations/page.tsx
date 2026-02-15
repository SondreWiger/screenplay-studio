'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner } from '@/components/ui';
import { cn, formatCurrency } from '@/lib/utils';
import type { Location, SceneLocationType } from '@/lib/types';

export default function LocationsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'scouting'>('all');

  useEffect(() => { fetchLocations(); }, [params.id]);

  const fetchLocations = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('locations').select('*').eq('project_id', params.id).order('name');
    setLocations(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    const supabase = createClient();
    await supabase.from('locations').delete().eq('id', id);
    setLocations(locations.filter((l) => l.id !== id));
  };

  const filtered = filter === 'all' ? locations
    : filter === 'confirmed' ? locations.filter((l) => l.is_confirmed)
    : locations.filter((l) => !l.is_confirmed);

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Locations</h1>
          <p className="text-sm text-surface-400 mt-1">
            {locations.filter((l) => l.is_confirmed).length} confirmed / {locations.length} total
          </p>
        </div>
        <Button onClick={() => { setSelectedLocation(null); setShowEditor(true); }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Location
        </Button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['all', 'confirmed', 'scouting'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
            filter === f ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
          )}>
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No locations yet" description="Add locations for your production"
          action={<Button onClick={() => { setSelectedLocation(null); setShowEditor(true); }}>Add Location</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((location) => (
            <Card key={location.id} hover className="overflow-hidden" onClick={() => { setSelectedLocation(location); setShowEditor(true); }}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge size="sm" variant="info">{location.location_type}</Badge>
                      <h3 className="font-semibold text-white">{location.name}</h3>
                    </div>
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

      <LocationEditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        location={selectedLocation}
        projectId={params.id}
        userId={user?.id || ''}
        onSaved={() => { fetchLocations(); setShowEditor(false); }}
        onDelete={handleDelete}
      />
    </div>
  );
}

function LocationEditor({ isOpen, onClose, location, projectId, userId, onSaved, onDelete }: {
  isOpen: boolean; onClose: () => void; location: Location | null; projectId: string;
  userId: string; onSaved: () => void; onDelete: (id: string) => void;
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
      <div className="flex gap-1 mb-6 bg-surface-800 rounded-lg p-1">
        {['details', 'logistics', 'technical', 'contact'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            'flex-1 px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors',
            tab === t ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white'
          )}>{t}</button>
        ))}
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {tab === 'details' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
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
        <div>{location && <Button variant="danger" size="sm" onClick={() => onDelete(location.id)}>Delete</Button>}</div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={loading}>{location ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}
