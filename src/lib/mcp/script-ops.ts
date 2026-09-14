/**
 * Pure helpers behind the script tools: where new elements go, how scenes are
 * numbered, find & replace, outlines and stats. Nothing here touches the
 * database, so all of it is unit tested directly.
 */

import type { ScriptElement, ScriptElementType } from '@/lib/types';
import { paginateScript } from '@/lib/screenplay-paginator';

export type ElementLite = Pick<ScriptElement, 'id' | 'element_type' | 'content' | 'sort_order' | 'scene_number' | 'is_omitted'> &
  Partial<Pick<ScriptElement, 'metadata' | 'scene_status'>>;

/** Smallest gap between neighbours before the script gets renumbered. */
const MIN_GAP = 1e-6;

/**
 * Sort orders for `count` new elements placed between two neighbours.
 * `sort_order` is a double, so inserting never has to shift the rows around
 * it — until the gaps get too small, which `null` signals.
 */
export function ordersBetween(prev: number | null, next: number | null, count: number): number[] | null {
  if (count === 0) return [];
  if (prev === null && next === null) return Array.from({ length: count }, (_, i) => i);
  if (next === null) return Array.from({ length: count }, (_, i) => prev! + i + 1);
  if (prev === null) return Array.from({ length: count }, (_, i) => next - count + i);
  const step = (next - prev) / (count + 1);
  if (step < MIN_GAP) return null;
  return Array.from({ length: count }, (_, i) => prev + step * (i + 1));
}

export type Anchor =
  | { position: 'start' }
  | { position: 'end' }
  | { position: 'after'; id: string }
  | { position: 'before'; id: string };

/** The neighbours an anchor sits between, in a list sorted by sort_order. */
export function neighbours(sorted: ElementLite[], anchor: Anchor): { prev: number | null; next: number | null } {
  if (sorted.length === 0) return { prev: null, next: null };
  switch (anchor.position) {
    case 'start': return { prev: null, next: sorted[0].sort_order };
    case 'end': return { prev: sorted[sorted.length - 1].sort_order, next: null };
    case 'after':
    case 'before': {
      const idx = sorted.findIndex((e) => e.id === anchor.id);
      if (idx === -1) throw new Error(`Element ${anchor.id} is not in this script`);
      if (anchor.position === 'after') {
        return { prev: sorted[idx].sort_order, next: sorted[idx + 1]?.sort_order ?? null };
      }
      return { prev: sorted[idx - 1]?.sort_order ?? null, next: sorted[idx].sort_order };
    }
  }
}

/**
 * Scene numbers to rewrite so headings read 1, 2, 3 ... in order.
 *
 * Only runs when every existing number is blank or a plain integer. Once a
 * script carries production numbering like "12A", those numbers are locked
 * on call sheets and schedules, and silently renumbering would break them.
 */
export function renumberScenes(sorted: ElementLite[]): { id: string; scene_number: string }[] {
  const headings = sorted.filter((e) => e.element_type === 'scene_heading' && !e.is_omitted);
  const locked = headings.some((h) => h.scene_number && !/^\d+$/.test(h.scene_number));
  if (locked) return [];
  const updates: { id: string; scene_number: string }[] = [];
  headings.forEach((h, i) => {
    const want = String(i + 1);
    if (h.scene_number !== want) updates.push({ id: h.id, scene_number: want });
  });
  return updates;
}

export interface FindOptions {
  matchCase?: boolean;
  wholeWord?: boolean;
  elementTypes?: ScriptElementType[];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findPattern(find: string, opts: FindOptions): RegExp {
  const body = escapeRegExp(find);
  return new RegExp(opts.wholeWord ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body, opts.matchCase ? 'gu' : 'giu');
}

export interface Replacement {
  id: string;
  element_type: string;
  before: string;
  after: string;
  count: number;
}

export function findReplace(elements: ElementLite[], find: string, replace: string | null, opts: FindOptions = {}): Replacement[] {
  if (!find) return [];
  const pattern = findPattern(find, opts);
  const out: Replacement[] = [];
  for (const el of elements) {
    if (opts.elementTypes?.length && !opts.elementTypes.includes(el.element_type)) continue;
    const matches = el.content.match(pattern);
    if (!matches) continue;
    out.push({
      id: el.id,
      element_type: el.element_type,
      before: el.content,
      after: replace === null ? el.content : el.content.replace(pattern, () => replace),
      count: matches.length,
    });
  }
  return out;
}

export interface OutlineScene {
  scene_number: string | null;
  heading: string;
  element_id: string;
  page: number;
  characters: string[];
  summary: string;
  element_count: number;
}

/** Character cue without extensions: "JOHN (V.O.)" and "JOHN (CONT'D)" are both JOHN. */
export function cueName(content: string): string {
  return content.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*\^\s*$/, '').trim().toUpperCase();
}

export function outline(sorted: ElementLite[]): OutlineScene[] {
  const visible = sorted.filter((e) => !e.is_omitted);
  const pages = pageMap(visible);
  const scenes: OutlineScene[] = [];
  let current: OutlineScene | null = null;

  for (const el of visible) {
    if (el.element_type === 'scene_heading') {
      current = { scene_number: el.scene_number, heading: el.content, element_id: el.id, page: pages[el.id] ?? 1, characters: [], summary: '', element_count: 0 };
      scenes.push(current);
      continue;
    }
    if (!current) continue;
    current.element_count++;
    if (el.element_type === 'character') {
      const name = cueName(el.content);
      if (name && !current.characters.includes(name)) current.characters.push(name);
    }
    if (!current.summary && (el.element_type === 'action' || el.element_type === 'synopsis')) {
      current.summary = el.content.length > 160 ? el.content.slice(0, 157) + '...' : el.content;
    }
  }
  return scenes;
}

function pageMap(elements: ElementLite[]): Record<string, number> {
  return paginateScript(elements as ScriptElement[]).elementPageMap;
}

export function scriptStats(sorted: ElementLite[]) {
  const visible = sorted.filter((e) => !e.is_omitted);
  const paginated = paginateScript(visible as ScriptElement[]);
  const words = visible.reduce((n, e) => n + (e.content.trim() ? e.content.trim().split(/\s+/).length : 0), 0);

  const dialogueBy: Record<string, { lines: number; words: number; scenes: Set<string> }> = {};
  const byType: Record<string, number> = {};
  let currentScene = '(before first scene)';
  let speaker: string | null = null;
  let int = 0, ext = 0, day = 0, night = 0;
  const locations = new Map<string, number>();

  for (const el of visible) {
    byType[el.element_type] = (byType[el.element_type] ?? 0) + 1;
    if (el.element_type === 'scene_heading') {
      currentScene = el.id;
      speaker = null;
      const h = el.content.toUpperCase();
      if (/^(INT\.?\/EXT|I\/E)/.test(h)) { int++; ext++; }
      else if (h.startsWith('EXT')) ext++;
      else if (h.startsWith('INT')) int++;
      if (/\b(NIGHT|EVENING|DUSK)\b/.test(h)) night++;
      else if (/\b(DAY|MORNING|AFTERNOON|DAWN|NOON)\b/.test(h)) day++;
      const place = h.replace(/^(INT\.\/EXT\.|INT\/EXT\.?|I\/E\.?|INT\.?|EXT\.?|EST\.?)\s*/, '').split(/\s+-\s+/)[0].trim();
      if (place) locations.set(place, (locations.get(place) ?? 0) + 1);
    } else if (el.element_type === 'character') {
      speaker = cueName(el.content);
      dialogueBy[speaker] ??= { lines: 0, words: 0, scenes: new Set() };
      dialogueBy[speaker].scenes.add(currentScene);
    } else if (el.element_type === 'dialogue' && speaker) {
      dialogueBy[speaker].lines++;
      dialogueBy[speaker].words += el.content.trim().split(/\s+/).filter(Boolean).length;
    } else if (el.element_type !== 'parenthetical') {
      speaker = null;
    }
  }

  return {
    pages: paginated.pages.length,
    words,
    elements: visible.length,
    scenes: byType.scene_heading ?? 0,
    estimated_runtime_minutes: paginated.pages.length,
    element_types: byType,
    interior_exterior: { int, ext },
    day_night: { day, night },
    characters: Object.entries(dialogueBy)
      .map(([name, d]) => ({ name, dialogue_blocks: d.lines, dialogue_words: d.words, scenes: d.scenes.size }))
      .sort((a, b) => b.dialogue_words - a.dialogue_words),
    locations: Array.from(locations.entries()).map(([name, scenes]) => ({ name, scenes })).sort((a, b) => b.scenes - a.scenes),
  };
}
