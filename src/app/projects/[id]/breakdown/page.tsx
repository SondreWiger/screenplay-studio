'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface Scene {
  id: string;
  scene_number: string | null;
  scene_heading: string | null;
  title: string | null;
  location_type: string | null;
  location_name: string | null;
  location_id: string | null;
  time_of_day: string | null;
  page_count: number | null;
  estimated_duration_minutes: number | null;
  is_completed: boolean;
  synopsis: string | null;
  sort_order: number;
  cast_ids: string[];
  extras_count: number;
  props: string[];
  costumes: string[];
  makeup_notes: string | null;
  special_effects: string[];
  stunts: string | null;
  vehicles: string[];
  animals: string[];
  sound_notes: string | null;
  music_cues: string[];
  vfx_notes: string | null;
  mood: string | null;
  weather_required: string | null;
  special_equipment: string[];
  notes: string | null;
}

interface Character { id: string; name: string }
interface Location  { id: string; name: string }

type Tab = 'stripboard' | 'cast' | 'locations' | 'departments';

const DeptTag = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium', color)}>
    {children}
  </span>
);

function DeptSection({ label, items, color }: { label: string; items?: string[] | null; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <span key={i} className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', color)}>{item}</span>
        ))}
      </div>
    </div>
  );
}

const STRIP_COLORS: Record<string, string> = {
  DAY:        'bg-yellow-500/20 border-l-4 border-yellow-500 text-yellow-200',
  NIGHT:      'bg-indigo-500/20 border-l-4 border-indigo-500 text-indigo-200',
  DAWN:       'bg-orange-500/20 border-l-4 border-orange-500 text-orange-200',
  DUSK:       'bg-purple-500/20 border-l-4 border-purple-500 text-purple-200',
  CONTINUOUS: 'bg-teal-500/20 border-l-4 border-teal-500 text-teal-200',
  DEFAULT:    'bg-surface-700/30 border-l-4 border-surface-600 text-surface-300',
};

const INT_EXT_COLORS: Record<string, string> = {
  'INT':     'bg-blue-500/10 text-blue-400',
  'EXT':     'bg-green-500/10 text-green-400',
  'INT/EXT': 'bg-teal-500/10 text-teal-400',
};

export default function BreakdownPage({ params }: { params: { id: string } }) {
  const { currentProject } = useProjectStore();

  const [scenes, setScenes]         = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations]   = useState<Location[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<Tab>('stripboard');
  const [groupBy, setGroupBy]       = useState<'none' | 'time_of_day' | 'location_type'>('none');
  const [showCompleted, setShowCompleted] = useState(true);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [sceneRes, charRes, locRes] = await Promise.all([
        supabase
          .from('scenes')
          .select([
            'id','scene_number','scene_heading','title','location_type','location_name',
            'location_id','time_of_day','page_count','estimated_duration_minutes',
            'is_completed','synopsis','sort_order',
            'cast_ids','extras_count','props','costumes','makeup_notes',
            'special_effects','stunts','vehicles','animals','sound_notes',
            'music_cues','vfx_notes','mood','weather_required','special_equipment','notes',
          ].join(','))
          .eq('project_id', params.id)
          .order('sort_order', { ascending: true }),
        supabase.from('characters').select('id,name').eq('project_id', params.id),
        supabase.from('locations').select('id,name').eq('project_id', params.id),
      ]);
      setScenes((sceneRes.data as unknown as Scene[]) ?? []);
      setCharacters((charRes.data as Character[]) ?? []);
      setLocations((locRes.data as Location[]) ?? []);
      setLoading(false);
    };
    load();
  }, [params.id]);

  const charById = useMemo(() =>
    Object.fromEntries(characters.map((c) => [c.id, c.name])), [characters]);

  const locById = useMemo(() =>
    Object.fromEntries(locations.map((l) => [l.id, l.name])), [locations]);

  const displayScenes = useMemo(() =>
    showCompleted ? scenes : scenes.filter((s) => !s.is_completed), [scenes, showCompleted]);

  const summary = useMemo(() => {
    const totalPages   = displayScenes.reduce((a, s) => a + (s.page_count ?? 0), 0);
    const totalMins    = displayScenes.reduce((a, s) => a + (s.estimated_duration_minutes ?? 0), 0);
    const vfxScenes    = displayScenes.filter((s) => s.vfx_notes).length;
    const stuntScenes  = displayScenes.filter((s) => s.stunts).length;
    const extrasTotal  = displayScenes.reduce((a, s) => a + (s.extras_count ?? 0), 0);
    const allProps     = Array.from(new Set(displayScenes.flatMap((s) => s.props ?? [])));
    const allCostumes  = Array.from(new Set(displayScenes.flatMap((s) => s.costumes ?? [])));
    const allSfx       = Array.from(new Set(displayScenes.flatMap((s) => s.special_effects ?? [])));
    const allVehicles  = Array.from(new Set(displayScenes.flatMap((s) => s.vehicles ?? [])));
    const allAnimals   = Array.from(new Set(displayScenes.flatMap((s) => s.animals ?? [])));
    const allMusicCues = Array.from(new Set(displayScenes.flatMap((s) => s.music_cues ?? [])));
    const allCastIds   = Array.from(new Set(displayScenes.flatMap((s) => s.cast_ids ?? [])));
    const castSceneCounts: Record<string, number> = {};
    displayScenes.forEach((s) => (s.cast_ids ?? []).forEach((id) => {
      castSceneCounts[id] = (castSceneCounts[id] ?? 0) + 1;
    }));
    const locSceneCounts: Record<string, number> = {};
    displayScenes.forEach((s) => {
      const key = s.location_name ?? locById[s.location_id ?? ''] ?? 'Unspecified';
      locSceneCounts[key] = (locSceneCounts[key] ?? 0) + 1;
    });
    return { totalPages, totalMins, vfxScenes, stuntScenes, extrasTotal,
      allProps, allCostumes, allSfx, allVehicles, allAnimals, allMusicCues, allCastIds,
      castSceneCounts, locSceneCounts };
  }, [displayScenes, locById]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { '': displayScenes };
    const groups: Record<string, Scene[]> = {};
    displayScenes.forEach((s) => {
      const key = (groupBy === 'time_of_day' ? s.time_of_day : s.location_type) ?? 'Unspecified';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [displayScenes, groupBy]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const castNames = (ids: string[]) => (ids ?? []).map((id) => charById[id] ?? id).filter(Boolean);

  if (loading) return null;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-black text-white">Production Breakdown</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {displayScenes.length} scenes &middot; {summary.totalPages.toFixed(1)} pages
            {summary.totalMins > 0 && (<> &middot; ~{Math.round(summary.totalMins)} min</>)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-sm text-surface-400 cursor-pointer">
            <input type="checkbox" checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded accent-brand-500" />
            Show completed
          </label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
            className="px-3 py-1.5 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white">
            <option value="none">No grouping</option>
            <option value="time_of_day">Group by Day/Night</option>
            <option value="location_type">Group by INT/EXT</option>
          </select>
          <button onClick={() => window.print()}
            className="px-3 py-1.5 bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-sm text-white flex items-center gap-1.5 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6 print:hidden">
        {[
          { label: 'Total Scenes',  value: displayScenes.length,          color: 'bg-surface-800/60 text-white' },
          { label: 'Total Pages',   value: summary.totalPages.toFixed(1), color: 'bg-surface-800/60 text-white' },
          { label: 'Cast Members',  value: summary.allCastIds.length,     color: 'bg-[#FF5F1F]/10 text-[#FF8F5F]' },
          { label: 'Unique Props',  value: summary.allProps.length,       color: 'bg-amber-500/10 text-amber-300' },
          { label: 'VFX Scenes',    value: summary.vfxScenes,             color: 'bg-purple-500/10 text-purple-300' },
          { label: 'Stunt Scenes',  value: summary.stuntScenes,           color: 'bg-red-500/10 text-red-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className={cn('rounded-xl border border-surface-700/40 p-3', color)}>
            <div className="text-xl font-black">{value}</div>
            <div className="text-xs opacity-60 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800/60 rounded-lg p-1 mb-6 print:hidden w-fit">
        {(['stripboard', 'cast', 'locations', 'departments'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors',
              tab === t ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* STRIPBOARD */}
      {tab === 'stripboard' && (
        displayScenes.length === 0 ? (
          <div className="text-center py-16 text-surface-500">
            <p className="font-medium">No scenes yet</p>
            <p className="text-sm mt-1">Add scenes in the Scenes view first.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([groupKey, groupScenes]) => (
              <div key={groupKey}>
                {groupBy !== 'none' && groupKey && (
                  <h2 className="text-xs font-bold text-surface-400 uppercase tracking-widest mb-2 pl-1">{groupKey}</h2>
                )}
                <div className="rounded-xl border border-surface-700/40 overflow-hidden">
                  <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem] gap-0 bg-surface-800/80 border-b border-surface-700/40 px-2 py-2 text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                    <span>#</span><span>Scene</span>
                    <span className="text-center">Int/Ext</span>
                    <span className="text-center">Time</span>
                    <span className="text-right">Pages</span>
                  </div>
                  {groupScenes.map((scene, i) => {
                    const stripCls  = STRIP_COLORS[scene.time_of_day ?? ''] ?? STRIP_COLORS.DEFAULT;
                    const cast      = castNames(scene.cast_ids);
                    const hasDetail = cast.length > 0 || (scene.props?.length ?? 0) > 0 || !!scene.vfx_notes || !!scene.stunts;
                    const isOpen    = expanded.has(scene.id);
                    return (
                      <div key={scene.id} className={cn('border-b border-surface-700/20 last:border-0', scene.is_completed && 'opacity-50')}>
                        <div
                          className={cn('grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem] gap-0 px-2 py-2 items-center transition-colors', stripCls, hasDetail && 'cursor-pointer hover:brightness-110')}
                          onClick={() => hasDetail && toggleExpand(scene.id)}
                        >
                          <span className="font-mono text-xs font-bold">{scene.scene_number ?? (i + 1)}</span>
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-semibold text-white truncate">
                              {scene.scene_heading ?? scene.title ?? ('Scene ' + (i + 1))}
                            </p>
                            {scene.synopsis && !isOpen && (
                              <p className="text-[10px] text-surface-500 truncate">{scene.synopsis}</p>
                            )}
                            {!isOpen && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {cast.slice(0, 3).map((n) => <DeptTag key={n} color="bg-[#FF5F1F]/10 text-[#FF8F5F]">{n}</DeptTag>)}
                                {cast.length > 3 && <DeptTag color="bg-surface-700/60 text-surface-400">+{cast.length - 3} more</DeptTag>}
                                {(scene.extras_count ?? 0) > 0 && <DeptTag color="bg-surface-700/60 text-surface-400">{scene.extras_count} extras</DeptTag>}
                                {scene.vfx_notes && <DeptTag color="bg-purple-500/10 text-purple-300">VFX</DeptTag>}
                                {scene.stunts && <DeptTag color="bg-red-500/10 text-red-300">Stunts</DeptTag>}
                                {(scene.animals?.length ?? 0) > 0 && <DeptTag color="bg-yellow-500/10 text-yellow-300">Animals</DeptTag>}
                              </div>
                            )}
                          </div>
                          <span className={cn('text-[10px] font-semibold text-center px-1 py-0.5 rounded', INT_EXT_COLORS[scene.location_type ?? ''] ?? 'text-surface-500')}>
                            {scene.location_type ?? '—'}
                          </span>
                          <span className="text-[10px] text-surface-400 text-center">{scene.time_of_day ?? '—'}</span>
                          <span className="text-[10px] font-mono text-surface-300 text-right">
                            {scene.page_count != null ? scene.page_count.toFixed(1) : '—'}
                          </span>
                        </div>
                        {isOpen && (
                          <div className="bg-surface-900/60 border-t border-surface-700/20 px-4 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                            {scene.synopsis && (
                              <div className="col-span-full">
                                <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">Synopsis</p>
                                <p className="text-surface-300">{scene.synopsis}</p>
                              </div>
                            )}
                            <DeptSection label="Cast" color="bg-[#FF5F1F]/10 text-[#FF8F5F]" items={cast} />
                            {(scene.extras_count ?? 0) > 0 && <DeptSection label="Extras" color="bg-surface-700/60 text-surface-300" items={[String(scene.extras_count) + ' extras']} />}
                            <DeptSection label="Location" color="bg-teal-500/10 text-teal-300"
                              items={[scene.location_name ?? locById[scene.location_id ?? ''] ?? ''].filter(Boolean)} />
                            <DeptSection label="Props" color="bg-amber-500/10 text-amber-300" items={scene.props} />
                            <DeptSection label="Costumes" color="bg-pink-500/10 text-pink-300" items={scene.costumes} />
                            <DeptSection label="Special Effects" color="bg-orange-500/10 text-orange-300" items={scene.special_effects} />
                            <DeptSection label="Vehicles" color="bg-cyan-500/10 text-cyan-300" items={scene.vehicles} />
                            <DeptSection label="Animals" color="bg-yellow-500/10 text-yellow-300" items={scene.animals} />
                            <DeptSection label="Music Cues" color="bg-indigo-500/10 text-indigo-300" items={scene.music_cues} />
                            {scene.vfx_notes && <DeptSection label="VFX" color="bg-purple-500/10 text-purple-300" items={[scene.vfx_notes]} />}
                            {scene.stunts && <DeptSection label="Stunts" color="bg-red-500/10 text-red-300" items={[scene.stunts]} />}
                            {scene.makeup_notes && <DeptSection label="Makeup / Hair" color="bg-rose-500/10 text-rose-300" items={[scene.makeup_notes]} />}
                            {scene.sound_notes && <DeptSection label="Sound" color="bg-lime-500/10 text-lime-300" items={[scene.sound_notes]} />}
                            {scene.weather_required && <DeptSection label="Weather" color="bg-sky-500/10 text-sky-300" items={[scene.weather_required]} />}
                            {scene.mood && <DeptSection label="Mood / Tone" color="bg-violet-500/10 text-violet-300" items={[scene.mood]} />}
                            {(scene.special_equipment?.length ?? 0) > 0 && <DeptSection label="Special Equipment" color="bg-surface-700/60 text-surface-300" items={scene.special_equipment} />}
                            {scene.notes && (
                              <div className="col-span-full">
                                <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">Notes</p>
                                <p className="text-surface-400">{scene.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem] gap-0 bg-surface-800/60 border-t border-surface-700/40 px-2 py-1.5 text-xs font-medium text-surface-400">
                    <span /><span>Total — {groupScenes.length} scenes</span><span /><span />
                    <span className="text-right font-bold text-white font-mono">
                      {groupScenes.reduce((a, s) => a + (s.page_count ?? 0), 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* CAST */}
      {tab === 'cast' && (
        <div className="space-y-3">
          {Object.entries(summary.castSceneCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([charId, count]) => {
              const name      = charById[charId] ?? charId;
              const sceneList = displayScenes.filter((s) => (s.cast_ids ?? []).includes(charId));
              return (
                <div key={charId} className="rounded-xl border border-surface-700/40 bg-surface-800/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#E54E15]/40 flex items-center justify-center text-xs font-bold text-[#FF8F5F]">
                        {name[0] ?? '?'}
                      </div>
                      <span className="font-semibold text-white text-sm">{name}</span>
                    </div>
                    <span className="text-xs text-surface-400 font-mono">{count} scene{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sceneList.map((s, i) => (
                      <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-400 font-mono border border-surface-700/40">
                        {s.scene_number ?? ('S' + (i + 1))}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          {summary.allCastIds.length === 0 && (
            <p className="text-surface-500 text-sm text-center py-12">No cast assigned to scenes yet.</p>
          )}
        </div>
      )}

      {/* LOCATIONS */}
      {tab === 'locations' && (
        <div className="space-y-3">
          {Object.entries(summary.locSceneCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([locName, count]) => {
              const sceneList = displayScenes.filter((s) => {
                const key = s.location_name ?? locById[s.location_id ?? ''] ?? 'Unspecified';
                return key === locName;
              });
              const intCount = sceneList.filter((s) => s.location_type === 'INT').length;
              const extCount = sceneList.filter((s) => s.location_type === 'EXT').length;
              const pages    = sceneList.reduce((a, s) => a + (s.page_count ?? 0), 0);
              return (
                <div key={locName} className="rounded-xl border border-surface-700/40 bg-surface-800/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white text-sm">{locName}</span>
                    <div className="flex items-center gap-2 text-xs text-surface-400">
                      {intCount > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">INT &times; {intCount}</span>}
                      {extCount > 0 && <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">EXT &times; {extCount}</span>}
                      <span className="font-mono">{pages.toFixed(1)}pp</span>
                      <span>{count} scene{count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sceneList.map((s, i) => (
                      <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-400 font-mono border border-surface-700/40">
                        {s.scene_number ?? ('S' + (i + 1))} ({s.time_of_day ?? '?'})
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          {Object.keys(summary.locSceneCounts).length === 0 && (
            <p className="text-surface-500 text-sm text-center py-12">No locations assigned to scenes yet.</p>
          )}
        </div>
      )}

      {/* DEPARTMENTS */}
      {tab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'Props',           items: summary.allProps,     color: 'text-amber-400',  bg: 'bg-amber-500/10' },
            { label: 'Costumes',        items: summary.allCostumes,  color: 'text-pink-400',   bg: 'bg-pink-500/10' },
            { label: 'Special Effects', items: summary.allSfx,       color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { label: 'Vehicles',        items: summary.allVehicles,  color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
            { label: 'Animals',         items: summary.allAnimals,   color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { label: 'Music Cues',      items: summary.allMusicCues, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          ].map(({ label, items, color, bg }) => (
            <div key={label} className="rounded-xl border border-surface-700/40 bg-surface-800/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className={cn('text-sm font-semibold', color)}>{label}</span>
                <span className="text-xs text-surface-500">{items.length} unique</span>
              </div>
              {items.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <span key={item} className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', bg, color)}>{item}</span>
                  ))}
                </div>
              ) : (
                <p className="text-surface-600 text-xs italic">None assigned</p>
              )}
            </div>
          ))}
          {summary.vfxScenes > 0 && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-purple-300">VFX Scenes</span>
                <span className="text-xs text-surface-500">{summary.vfxScenes} scenes</span>
              </div>
              <div className="space-y-1.5">
                {displayScenes.filter((s) => s.vfx_notes).map((s, i) => (
                  <div key={s.id} className="text-xs">
                    <span className="font-mono text-purple-400 text-[10px] mr-2">{s.scene_number ?? ('S' + (i + 1))}</span>
                    <span className="text-surface-300">{s.vfx_notes}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.stuntScenes > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-red-300">Stunt Sequences</span>
                <span className="text-xs text-surface-500">{summary.stuntScenes} scenes</span>
              </div>
              <div className="space-y-1.5">
                {displayScenes.filter((s) => s.stunts).map((s, i) => (
                  <div key={s.id} className="text-xs">
                    <span className="font-mono text-red-400 text-[10px] mr-2">{s.scene_number ?? ('S' + (i + 1))}</span>
                    <span className="text-surface-300">{s.stunts}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.extrasTotal > 0 && (
            <div className="rounded-xl border border-surface-700/40 bg-surface-800/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-surface-300">Extras / Background</span>
                <span className="text-xs text-surface-500">{summary.extrasTotal} total</span>
              </div>
              <div className="space-y-1.5">
                {displayScenes.filter((s) => (s.extras_count ?? 0) > 0).map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-surface-400 truncate max-w-[200px]">{s.scene_heading ?? s.title ?? ('Scene ' + (i + 1))}</span>
                    <span className="font-mono text-surface-300 ml-2">{s.extras_count} extras</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

