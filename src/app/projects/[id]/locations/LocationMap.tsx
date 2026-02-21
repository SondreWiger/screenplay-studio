'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Badge, Input, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Location, LocationMarker, LocationRoute, MarkerType, RouteType } from '@/lib/types';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Dark mode tile providers
const TILE_PROVIDERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  darkNolabels: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  stamenToner: {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia</a>',
  },
};

/* ── marker icon factory ── */
const MARKER_COLORS: Record<MarkerType, string> = {
  location: '#dd574e',
  bus_stop: '#3b82f6',
  train_station: '#8b5cf6',
  parking: '#f59e0b',
  base_camp: '#10b981',
  custom: '#6b7280',
};
const MARKER_LABELS: Record<MarkerType, string> = {
  location: '📍 Location', bus_stop: '🚌 Bus Stop', train_station: '🚂 Train Station',
  parking: '🅿️ Parking', base_camp: '🏕️ Base Camp', custom: '📌 Custom',
};

function markerIcon(type: MarkerType, color?: string, count?: number) {
  const c = color || MARKER_COLORS[type];
  const symbols: Record<MarkerType, string> = {
    location: '📍', bus_stop: '🚌', train_station: '🚂', parking: '🅿️', base_camp: '🏕️', custom: '📌',
  };
  // Show location count badge if multiple locations
  const badge = count && count > 1 
    ? `<span style="position:absolute;top:-6px;right:-6px;background:#fff;color:#000;font-size:10px;font-weight:600;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:2px solid ${c};">${count}</span>` 
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="
      position:relative;width:36px;height:36px;border-radius:50%;
      background:${c};border:2px solid rgba(255,255,255,0.8);
      box-shadow:0 2px 12px rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;
      font-size:16px;cursor:pointer;
    ">${symbols[type]}${badge}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

const ROUTE_COLORS: Record<RouteType, string> = {
  bus: '#3b82f6', train: '#8b5cf6', walking: '#10b981', driving: '#f59e0b', custom: '#6b7280',
};

/* ── click handler component ── */
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e: any) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function FitBounds({ markers, routes }: { markers: LocationMarker[]; routes: LocationRoute[] }) {
  const map = useMap();
  useEffect(() => {
    const allPoints: [number, number][] = [
      ...markers.map((m) => [m.lat, m.lng] as [number, number]),
      ...routes.flatMap((r) => r.coordinates.map((c) => [c.lat, c.lng] as [number, number])),
    ];
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [markers.length, routes.length, map]);
  return null;
}

/* ── main component ── */
interface LocationMapProps {
  projectId: string;
  locations: Location[];
  canEdit: boolean;
}

export default function LocationMap({ projectId, locations, canEdit }: LocationMapProps) {
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [routes, setRoutes] = useState<LocationRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'add_marker' | 'add_route'>('view');
  const [newMarkerType, setNewMarkerType] = useState<MarkerType>('location');
  const [newRouteType, setNewRouteType] = useState<RouteType>('bus');
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [editingMarker, setEditingMarker] = useState<LocationMarker | null>(null);
  const [markerForm, setMarkerForm] = useState<{ name: string; description: string; location_ids: string[] }>({ name: '', description: '', location_ids: [] });
  const [routeForm, setRouteForm] = useState({ name: '', notes: '', color: '' });
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<MarkerType>>(() => new Set<MarkerType>(['location', 'bus_stop', 'train_station', 'parking', 'base_camp', 'custom']));

  useEffect(() => { fetchData(); }, [projectId]);

  const fetchData = async () => {
    const supabase = createClient();
    const [{ data: m }, { data: r }] = await Promise.all([
      supabase.from('location_markers').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('location_routes').select('*').eq('project_id', projectId).order('created_at'),
    ]);
    // Migrate old location_id to location_ids array
    const migrated = (m || []).map(marker => ({
      ...marker,
      location_ids: marker.location_ids || (marker.location_id ? [marker.location_id] : []),
    }));
    setMarkers(migrated);
    setRoutes(r || []);
    setLoading(false);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (mode === 'add_marker') {
      const supabase = createClient();
      const name = `New ${MARKER_LABELS[newMarkerType].split(' ').slice(1).join(' ')}`;
      const { data, error } = await supabase.from('location_markers').insert({
        project_id: projectId, name, marker_type: newMarkerType,
        lat, lng, color: MARKER_COLORS[newMarkerType], tags: [], location_ids: [],
      }).select().single();
      if (data) {
        const migratedData = { ...data, location_ids: data.location_ids || [] };
        setMarkers((p) => [...p, migratedData]);
        setEditingMarker(migratedData);
        setMarkerForm({ name: data.name, description: '', location_ids: [] });
      }
    } else if (mode === 'add_route') {
      setRoutePoints((p) => [...p, { lat, lng }]);
    }
  };

  const saveMarker = async () => {
    if (!editingMarker) return;
    const supabase = createClient();
    await supabase.from('location_markers').update({
      name: markerForm.name, 
      description: markerForm.description || null,
      location_ids: markerForm.location_ids,
      // Keep legacy field in sync
      location_id: markerForm.location_ids.length > 0 ? markerForm.location_ids[0] : null,
    }).eq('id', editingMarker.id);
    setMarkers((prev) => prev.map((m) =>
      m.id === editingMarker.id ? { ...m, name: markerForm.name, description: markerForm.description, location_ids: markerForm.location_ids } : m
    ));
    setEditingMarker(null);
  };

  const toggleLocationId = (locationId: string) => {
    setMarkerForm(prev => ({
      ...prev,
      location_ids: prev.location_ids.includes(locationId)
        ? prev.location_ids.filter(id => id !== locationId)
        : [...prev.location_ids, locationId],
    }));
  };

  const deleteMarker = async (id: string) => {
    const supabase = createClient();
    await supabase.from('location_markers').delete().eq('id', id);
    setMarkers((p) => p.filter((m) => m.id !== id));
    setEditingMarker(null);
  };

  const finishRoute = async () => {
    if (routePoints.length < 2) return;
    const supabase = createClient();
    const { data } = await supabase.from('location_routes').insert({
      project_id: projectId, name: routeForm.name || `${newRouteType} route`,
      route_type: newRouteType, color: routeForm.color || ROUTE_COLORS[newRouteType],
      coordinates: routePoints, notes: routeForm.notes || null,
    }).select().single();
    if (data) setRoutes((p) => [...p, data]);
    setRoutePoints([]);
    setMode('view');
    setShowRouteForm(false);
    setRouteForm({ name: '', notes: '', color: '' });
  };

  const deleteRoute = async (id: string) => {
    const supabase = createClient();
    await supabase.from('location_routes').delete().eq('id', id);
    setRoutes((p) => p.filter((r) => r.id !== id));
  };

  const toggleType = (t: MarkerType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const filteredMarkers = markers.filter((m) => visibleTypes.has(m.marker_type));
  // Default to Larvik, Norway if no content
  const defaultCenter: [number, number] = [59.05, 10.03];
  const hasContent = markers.length > 0 || routes.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-2 p-3 bg-surface-900 border-b border-surface-800">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <Button size="sm" variant={mode === 'add_marker' ? 'primary' : 'secondary'}
                onClick={() => setMode(mode === 'add_marker' ? 'view' : 'add_marker')}>
                {mode === 'add_marker' ? '✕ Cancel' : '+ Marker'}
              </Button>
              {mode === 'add_marker' && (
                <select value={newMarkerType}
                  onChange={(e) => setNewMarkerType(e.target.value as MarkerType)}
                  className="rounded-lg border border-surface-700 bg-surface-800 px-2 py-1.5 text-xs text-white">
                  {(Object.keys(MARKER_LABELS) as MarkerType[]).map((t) => (
                    <option key={t} value={t}>{MARKER_LABELS[t]}</option>
                  ))}
                </select>
              )}
              <Button size="sm" variant={mode === 'add_route' ? 'primary' : 'secondary'}
                onClick={() => {
                  if (mode === 'add_route') { setMode('view'); setRoutePoints([]); setShowRouteForm(false); }
                  else { setMode('add_route'); setShowRouteForm(true); }
                }}>
                {mode === 'add_route' ? '✕ Cancel' : '+ Route'}
              </Button>
              {mode === 'add_route' && (
                <select value={newRouteType}
                  onChange={(e) => setNewRouteType(e.target.value as RouteType)}
                  className="rounded-lg border border-surface-700 bg-surface-800 px-2 py-1.5 text-xs text-white">
                  <option value="bus">🚌 Bus</option>
                  <option value="train">🚂 Train</option>
                  <option value="walking">🚶 Walking</option>
                  <option value="driving">🚗 Driving</option>
                  <option value="custom">📌 Custom</option>
                </select>
              )}
            </>
          )}
          <div className="ml-auto text-xs text-surface-400">
            {markers.length} markers &bull; {routes.length} routes
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1">
          {(Object.keys(MARKER_LABELS) as MarkerType[]).map((t) => (
            <button key={t} onClick={() => toggleType(t)}
              className={cn('px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                visibleTypes.has(t)
                  ? 'border-transparent text-white' : 'border-surface-700 text-surface-500 bg-transparent'
              )}
              style={visibleTypes.has(t) ? { background: MARKER_COLORS[t] } : undefined}>
              {MARKER_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Route drawing helper */}
        {mode === 'add_route' && (
          <div className="flex flex-wrap items-center gap-2 p-2 bg-surface-800 rounded-lg text-xs">
            <span className="text-surface-300">Click map to add points ({routePoints.length} placed)</span>
            <Input placeholder="Route name" value={routeForm.name}
              onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
              className="!py-1 !text-xs max-w-[160px]" />
            {routePoints.length >= 2 && (
              <Button size="sm" onClick={finishRoute}>Save Route</Button>
            )}
            {routePoints.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setRoutePoints((p) => p.slice(0, -1))}>Undo</Button>
            )}
          </div>
        )}

        {mode === 'add_marker' && (
          <p className="text-xs text-surface-400 px-1">Click anywhere on the map to place a marker</p>
        )}
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative min-h-[300px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-900">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <MapContainer center={defaultCenter} zoom={12}
            style={{ height: '100%', width: '100%', background: '#0a0a12' }}
            className="z-0">
            <TileLayer
              attribution={TILE_PROVIDERS.dark.attribution}
              url={TILE_PROVIDERS.dark.url}
            />
            <MapClickHandler onClick={handleMapClick} />
            {hasContent && <FitBounds markers={markers} routes={routes} />}

            {/* Markers */}
            {filteredMarkers.map((m) => (
              <Marker key={m.id} position={[m.lat, m.lng]} icon={markerIcon(m.marker_type, m.color, m.location_ids?.length)}>
                <Popup>
                  <div className="min-w-[200px] text-sm bg-surface-900 text-white -m-2 p-3 rounded-lg">
                    <p className="font-bold">{m.name}</p>
                    <p className="text-xs text-surface-400 mt-0.5">{MARKER_LABELS[m.marker_type]}</p>
                    {m.description && <p className="text-xs text-surface-300 mt-1">{m.description}</p>}
                    {m.location_ids && m.location_ids.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-surface-700">
                        <p className="text-xs text-surface-400 mb-1">Linked Locations:</p>
                        <div className="flex flex-wrap gap-1">
                          {m.location_ids.map(locId => {
                            const loc = locations.find(l => l.id === locId);
                            return loc ? (
                              <span key={locId} className="px-2 py-0.5 bg-surface-800 rounded text-xs">{loc.name}</span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex gap-2 mt-2 pt-2 border-t border-surface-700">
                        <button className="text-xs text-brand-400 hover:text-brand-300"
                          onClick={() => {
                            setEditingMarker(m);
                            setMarkerForm({ name: m.name, description: m.description || '', location_ids: m.location_ids || [] });
                          }}>Edit</button>
                        <button className="text-xs text-red-400 hover:text-red-300" onClick={() => deleteMarker(m.id)}>Delete</button>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* routes */}
            {routes.map((r) => (
              <Polyline key={r.id} positions={r.coordinates.map((c) => [c.lat, c.lng] as [number, number])}
                pathOptions={{ color: r.color || ROUTE_COLORS[r.route_type], weight: 4, opacity: 0.8, dashArray: r.route_type === 'walking' ? '8 8' : undefined }}>
                <Popup>
                  <div className="min-w-[160px] text-sm bg-surface-900 text-white -m-2 p-3 rounded-lg">
                    <p className="font-bold">{r.name}</p>
                    <p className="text-xs text-surface-400">{r.route_type}</p>
                    {r.notes && <p className="text-xs text-surface-300 mt-1">{r.notes}</p>}
                    {canEdit && <button className="text-xs text-red-400 hover:text-red-300 mt-2" onClick={() => deleteRoute(r.id)}>Delete</button>}
                  </div>
                </Popup>
              </Polyline>
            ))}

            {/* Route being drawn */}
            {routePoints.length >= 2 && (
              <Polyline positions={routePoints.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: ROUTE_COLORS[newRouteType], weight: 4, opacity: 0.6, dashArray: '4 8' }} />
            )}
          </MapContainer>
        )}
      </div>

      {/* ── Marker edit panel ── */}
      {editingMarker && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[1000] bg-surface-900 border border-surface-700 rounded-xl p-4 shadow-xl">
          <h3 className="font-semibold text-white text-sm mb-3">Edit Marker</h3>
          <div className="space-y-3">
            <Input label="Name" value={markerForm.name}
              onChange={(e) => setMarkerForm({ ...markerForm, name: e.target.value })} />
            <Textarea label="Description" value={markerForm.description} rows={2}
              onChange={(e) => setMarkerForm({ ...markerForm, description: e.target.value })} />
            <div>
              <label className="text-xs text-surface-400 mb-2 block">Link to Locations</label>
              {locations.length === 0 ? (
                <p className="text-xs text-surface-500 italic">No locations created yet</p>
              ) : (
                <div className="max-h-[150px] overflow-y-auto space-y-1 bg-surface-800 rounded-lg p-2">
                  {locations.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={markerForm.location_ids.includes(l.id)}
                        onChange={() => toggleLocationId(l.id)}
                        className="rounded border-surface-600 bg-surface-700 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-sm text-white">{l.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {markerForm.location_ids.length > 0 && (
                <p className="text-xs text-surface-400 mt-1">{markerForm.location_ids.length} location(s) linked</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={saveMarker}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingMarker(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Routes list sidebar ── */}
      {routes.length > 0 && (
        <div className="border-t border-surface-800 p-3 bg-surface-900 max-h-[160px] overflow-y-auto">
          <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Routes</h4>
          <div className="space-y-1">
            {routes.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm text-surface-300 py-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: r.color || ROUTE_COLORS[r.route_type] }} />
                  <span>{r.name}</span>
                  <Badge size="sm">{r.route_type}</Badge>
                </div>
                {canEdit && (
                  <button className="text-xs text-red-400 hover:text-red-300" onClick={() => deleteRoute(r.id)}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
