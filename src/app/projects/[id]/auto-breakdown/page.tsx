'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useScriptStore } from '@/lib/stores';
import { Button, Badge, EmptyState, Progress, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ScriptElement } from '@/lib/types';

type Category = 'props' | 'characters' | 'locations' | 'sfx' | 'vehicles' | 'costumes' | 'music' | 'weather';

interface BreakdownItem {
  name: string;
  category: Category;
  elements: { id: string; content: string; sceneNumber: string | null }[];
}

const CATEGORY_META: Record<Category, { label: string; color: string; bg: string; icon: string }> = {
  props: { label: 'Props', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: 'P' },
  characters: { label: 'Characters', color: 'text-[#FF8F5F]', bg: 'bg-[#FF5F1F]/10', icon: 'C' },
  locations: { label: 'Locations', color: 'text-teal-400', bg: 'bg-teal-500/10', icon: 'L' },
  sfx: { label: 'SFX', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: 'S' },
  vehicles: { label: 'Vehicles', color: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: 'V' },
  costumes: { label: 'Costumes', color: 'text-pink-400', bg: 'bg-pink-500/10', icon: 'O' },
  music: { label: 'Music', color: 'text-indigo-400', bg: 'bg-indigo-500/10', icon: 'M' },
  weather: { label: 'Weather', color: 'text-sky-400', bg: 'bg-sky-500/10', icon: 'W' },
};

const PROP_CONTEXT = /\b(holds?|carries?|picks?\s*up|puts?\s*down|grabs?|wields?|sets?\s*down|tosses?|throws?|catches?|places?|lifts?|drops?|sets)\s+(?:the\s+|a\s+|an\s+)?([A-Z][A-Z\s]{1,30})\b/g;

const VEHICLE_KEYWORDS = /\b(car|truck|motorcycle|boat|helicopter|bus|van|suv|bicycle|bike|scooter|train|airplane|plane|limousine|limo|ambulance|police car|fire truck|taxi|cab|wagon|tractor| ATV|jet ski|canoe|kayak|yacht|ferry|submarine)\b/gi;

const COSTUME_KEYWORDS = /\b(dress|suit|jacket|hat|boots|coat|shirt|pants|trousers|skirt|blouse|sweater|cloak|cape|gown|tuxedo|uniform|armor|armour|gloves|scarf|tie|vest|sneakers|sandals|heels|loafers|beret|crown|tiara|mask|visor|belt|suspenders|overalls|robes?|pajamas|nightgown|lingerie|bikini|swimsuit|wetsuit|lab coat|apron)\b/gi;

const SFX_KEYWORDS = /\b(gunshot|explosion|door slam|rain|thunder|glass break|scream|shout|whisper|footsteps|heartbeart|ringing|buzz|hum|crash|bang|clap|crack|ding|clang|boom|whoosh|hiss|sizzle|splash|thud|whack|pop|fizz|roar|howl|siren|alarm|bell|chime|gong|drum|pulse|static|feedback|squeak|creak|rustle|snap|crunch|splinter|shatter|ripple|gurgle|drip|pour|wind|breeze)\b/gi;

const MUSIC_KEYWORDS = /\b(music|song|melody|tune|score|soundtrack|radio|playlist|singing|hums?|hums?\s+a\s+tune|piano|guitar|violin|drum|bass|orchestra|band|concert|symphony|anthem|jingle|theme\s+song|background\s+music|diegetic|non-diegetic|underscore)\b/gi;

const WEATHER_KEYWORDS_SCENE = /\b(day|night|dawn|dusk|magic\s+hour|continuous|same)\b/gi;

const WEATHER_KEYWORDS_ACTION = /\b(rain|snow|fog|mist|storm|thunder|lightning|wind|sleet|hail|drizzle|downpour|overcast|sunny|cloudy|clear|frost|ice|blizzard|tornado|hurricane|cyclone|heatwave|drought)\b/gi;

const HEADING_PATTERN = /^(?:INT\.?|EXT\.?|INT\/EXT\.?|EXT\/INT\.?)\s+(.+?)(?:\s*-\s*(.+))?$/i;

function scanScript(elements: ScriptElement[]): BreakdownItem[] {
  const items = new Map<string, BreakdownItem>();

  function addItem(name: string, category: Category, el: ScriptElement) {
    const key = `${category}:${name.toUpperCase()}`;
    if (!items.has(key)) {
      items.set(key, { name: name.trim(), category, elements: [] });
    }
    items.get(key)!.elements.push({
      id: el.id,
      content: el.content,
      sceneNumber: el.scene_number,
    });
  }

  let currentHeading = '';

  for (const el of elements) {
    const content = el.content || '';
    const upper = content.toUpperCase();

    if (el.element_type === 'scene_heading') {
      currentHeading = upper.trim();

      const headingMatch = currentHeading.match(HEADING_PATTERN);
      if (headingMatch) {
        const locName = headingMatch[1].trim();
        if (locName.length > 1) addItem(locName, 'locations', el);
      }

      const timeMatch = currentHeading.match(WEATHER_KEYWORDS_SCENE);
      if (timeMatch) {
        for (const m of timeMatch) {
          const t = m.trim().toUpperCase();
          if (['DAY', 'NIGHT', 'DAWN', 'DUSK', 'MAGIC HOUR'].includes(t)) {
            addItem(t.charAt(0) + t.slice(1).toLowerCase(), 'weather', el);
          }
        }
      }
    }

    if (el.element_type === 'character') {
      const name = content.replace(/\s*\(.*?\)\s*/g, '').trim();
      if (name.length > 0 && name === name.toUpperCase() && name.length < 40) {
        addItem(name, 'characters', el);
      }
    }

    if (el.element_type === 'action' || el.element_type === 'scene_heading' || el.element_type === 'note') {
      const propMatches = content.matchAll(PROP_CONTEXT);
      for (const m of propMatches) {
        const noun = m[2]?.trim();
        if (noun && noun.length > 1 && noun === noun.toUpperCase()) {
          addItem(noun, 'props', el);
        }
      }

      const vehicleMatches = content.matchAll(VEHICLE_KEYWORDS);
      for (const m of vehicleMatches) {
        const v = m[1]?.trim();
        if (v && v.length > 1) {
          addItem(v.charAt(0).toUpperCase() + v.slice(1).toLowerCase(), 'vehicles', el);
        }
      }

      const costumeMatches = content.matchAll(COSTUME_KEYWORDS);
      for (const m of costumeMatches) {
        const c = m[1]?.trim();
        if (c && c.length > 1) {
          addItem(c.charAt(0).toUpperCase() + c.slice(1).toLowerCase(), 'costumes', el);
        }
      }

      const sfxMatches = content.matchAll(SFX_KEYWORDS);
      for (const m of sfxMatches) {
        const s = m[1]?.trim();
        if (s && s.length > 1) {
          addItem(s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(), 'sfx', el);
        }
      }

      const musicMatches = content.matchAll(MUSIC_KEYWORDS);
      for (const m of musicMatches) {
        const mu = m[1]?.trim();
        if (mu && mu.length > 1) {
          addItem(mu.charAt(0).toUpperCase() + mu.slice(1).toLowerCase(), 'music', el);
        }
      }

      const weatherMatches = content.matchAll(WEATHER_KEYWORDS_ACTION);
      for (const m of weatherMatches) {
        const w = m[1]?.trim();
        if (w && w.length > 2) {
          addItem(w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(), 'weather', el);
        }
      }
    }

    if (el.element_type === 'dialogue') {
      const sfxMatches = content.matchAll(SFX_KEYWORDS);
      for (const m of sfxMatches) {
        const s = m[1]?.trim();
        if (s && s.length > 1) {
          addItem(s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(), 'sfx', el);
        }
      }
    }
  }

  return Array.from(items.values()).sort((a, b) => b.elements.length - a.elements.length);
}

export default function AutoBreakdownPage() {
  const params = useParams();
  const projectId = params.id as string;
  useAuth();
  const { elements, loading: storeLoading, fetchElements, currentScript, fetchScripts } = useScriptStore();

  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedItem, setSelectedItem] = useState<BreakdownItem | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (projectId) {
      fetchScripts(projectId);
    }
  }, [projectId, fetchScripts]);

  useEffect(() => {
    if (currentScript) {
      fetchElements(currentScript.id);
    }
  }, [currentScript, fetchElements]);

  const totalItems = useMemo(() => breakdown.length, [breakdown]);

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return breakdown;
    return breakdown.filter((item) => item.category === selectedCategory);
  }, [breakdown, selectedCategory]);

  const runScan = useCallback(async () => {
    if (elements.length === 0) {
      toast.warning('No script elements to scan. Write some script first.');
      return;
    }

    setScanning(true);
    setScanComplete(false);
    setProgress(0);
    setSelectedItem(null);

    const total = elements.length;
    const batchSize = 50;
    const batches = Math.ceil(total / batchSize);

    for (let i = 0; i < batches; i++) {
      await new Promise((r) => setTimeout(r, 10));
      setProgress(Math.round(((i + 1) / batches) * 100));
    }

    const results = scanScript(elements);
    setBreakdown(results);
    setScanComplete(true);
    setScanning(false);
    toast.success(`Found ${results.length} production elements across ${elements.length} script elements`);
  }, [elements]);

  const exportBreakdown = useCallback(() => {
    const data = {
      script: currentScript?.title || 'Untitled Script',
      scannedAt: new Date().toISOString(),
      totalElements: elements.length,
      breakdown: breakdown.map((item) => ({
        name: item.name,
        category: item.category,
        count: item.elements.length,
        scenes: [...new Set(item.elements.map((e) => e.sceneNumber).filter(Boolean))],
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breakdown-${currentScript?.title?.replace(/\s+/g, '-').toLowerCase() || 'script'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Breakdown exported');
  }, [breakdown, elements.length, currentScript]);

  if (storeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[#FF5F1F] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link
            href={`/projects/${projectId}/script`}
            className="inline-flex items-center gap-1 text-sm text-surface-400 hover:text-white transition-colors mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Script
          </Link>
          <h1 className="text-xl font-black text-white">Auto-Breakdown</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {elements.length} script elements loaded
            {scanComplete && <> &middot; {totalItems} items found</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {scanComplete && (
            <Button variant="outline" size="sm" onClick={exportBreakdown}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </Button>
          )}
          <Button
            size="sm"
            onClick={runScan}
            loading={scanning}
            disabled={elements.length === 0}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Scan Script
          </Button>
        </div>
      </div>

      {scanning && (
        <div className="mb-6 rounded-xl border border-surface-800 bg-surface-900/60 p-4">
          <Progress value={progress} label="Scanning script elements..." showPercent />
        </div>
      )}

      {!scanComplete && !scanning && (
        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
          title="Scan your script for production elements"
          description="Click 'Scan Script' to automatically detect props, characters, locations, SFX, vehicles, costumes, music cues, and weather from your script."
          action={
            <Button onClick={runScan} disabled={elements.length === 0}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scan Script
            </Button>
          }
        />
      )}

      {scanComplete && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 mb-6">
            {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
              const meta = CATEGORY_META[cat];
              const count = breakdown.filter((i) => i.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all',
                    selectedCategory === cat
                      ? `${meta.bg} border-current ${meta.color}`
                      : 'border-surface-800 bg-surface-900/60 hover:bg-surface-800/60'
                  )}
                >
                  <div className="text-xs font-bold mb-0.5">{meta.icon}</div>
                  <div className={cn('text-lg font-black', selectedCategory === cat ? meta.color : 'text-white')}>
                    {count}
                  </div>
                  <div className={cn('text-[10px] font-bold uppercase tracking-wider', selectedCategory === cat ? meta.color : 'text-surface-500')}>
                    {meta.label}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              <div className="rounded-xl border border-surface-800 bg-surface-900/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                    {selectedCategory ? CATEGORY_META[selectedCategory].label : 'All Elements'} ({filteredItems.length})
                  </span>
                  {selectedCategory && (
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="text-xs text-surface-500 hover:text-white transition-colors"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="divide-y divide-surface-800 max-h-[60vh] overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <div className="px-4 py-8 text-center text-surface-500 text-sm">
                      No elements found in this category
                    </div>
                  ) : (
                    filteredItems.map((item) => {
                      const meta = CATEGORY_META[item.category];
                      const isSelected = selectedItem?.name === item.name && selectedItem?.category === item.category;
                      return (
                        <button
                          key={`${item.category}-${item.name}`}
                          onClick={() => setSelectedItem(isSelected ? null : item)}
                          className={cn(
                            'w-full text-left px-4 py-3 flex items-center justify-between transition-colors',
                            isSelected ? `${meta.bg}` : 'hover:bg-surface-800/40'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={cn('text-xs font-bold px-2 py-0.5 rounded', meta.bg, meta.color)}>
                              {item.category.toUpperCase()}
                            </span>
                            <span className="text-sm font-medium text-white truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-surface-500 font-mono">{item.elements.length}</span>
                            <svg
                              className={cn('w-4 h-4 text-surface-500 transition-transform', isSelected && 'rotate-90')}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {selectedItem && (
              <div className="w-80 shrink-0 hidden lg:block">
                <div className={cn('rounded-xl border border-surface-800 bg-surface-900/60 sticky top-4')}>
                  <div className={cn('px-4 py-3 border-b border-surface-800', CATEGORY_META[selectedItem.category].bg)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold">{CATEGORY_META[selectedItem.category].icon}</span>
                      <span className={cn('text-sm font-bold', CATEGORY_META[selectedItem.category].color)}>
                        {selectedItem.name}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500">
                      Found in {selectedItem.elements.length} element{selectedItem.elements.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="divide-y divide-surface-800 max-h-[50vh] overflow-y-auto">
                    {selectedItem.elements.map((el, i) => (
                      <div key={`${el.id}-${i}`} className="px-4 py-3">
                        {el.sceneNumber && (
                          <Badge variant="info" size="sm" className="mb-1.5">
                            Scene {el.sceneNumber}
                          </Badge>
                        )}
                        <p className="text-xs text-surface-300 line-clamp-3">{el.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
