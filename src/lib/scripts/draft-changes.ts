/**
 * Scene-level summary of what changed between a printed draft's snapshot and
 * the script now. Used by /lookup, where the person holding the paper sees
 * which of *their* scenes changed without being shown any new text.
 */

import { diffLines, diffStats, snapshotToLines, type SnapshotElement } from './diff';

type El = Pick<SnapshotElement, 'id' | 'element_type' | 'content' | 'sort_order' | 'scene_number' | 'is_omitted'>;

export interface SceneRef {
  /** Scene number as printed (or its position when the script isn't numbered) */
  number: string;
  heading: string;
}

export interface DraftChangeSummary {
  scenes_then: number;
  scenes_now: number;
  /** Scenes from the printed copy whose text has changed */
  changed: SceneRef[];
  /** Scenes from the printed copy that are gone (deleted or omitted) */
  removed: SceneRef[];
  /** New scenes; headings are only filled in for project members */
  added: SceneRef[];
  added_count: number;
  /** Scenes still there but in a different order */
  moved_count: number;
  words_then: number;
  words_now: number;
  lines_added: number;
  lines_removed: number;
}

interface Scene {
  key: string;
  headingId: string | null;
  heading: string;
  number: string;
  body: string;
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '');
const norm = (s: string) => stripTags(s).trim().replace(/\s+/g, ' ').toUpperCase();
const wordCount = (els: El[]) => els.reduce((n, e) => {
  const t = stripTags(e.content || '').trim();
  return t ? n + t.split(/\s+/).length : n;
}, 0);

function toScenes(elements: El[]): Scene[] {
  const els = [...elements]
    .filter((e) => !e.is_omitted)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const scenes: Scene[] = [];
  let cur: Scene | null = null;
  let n = 0;
  for (const e of els) {
    if (e.element_type === 'scene_heading') {
      n++;
      cur = {
        key: e.id,
        headingId: e.id,
        heading: stripTags(e.content || '').trim() || 'Untitled scene',
        number: (e.scene_number || '').trim() || String(n),
        body: '',
      };
      scenes.push(cur);
    } else if (!cur) {
      // Text before the first heading (cold open, title card…)
      cur = { key: '__opening', headingId: null, heading: 'Opening', number: '—', body: '' };
      scenes.push(cur);
    }
    cur.body += `${e.element_type}:${stripTags(e.content || '')}\n`;
  }
  return scenes;
}

export function summarizeDraftChanges(
  then: El[],
  now: El[],
  opts: { includeNewHeadings: boolean },
): DraftChangeSummary {
  const a = toScenes(then);
  const b = toScenes(now);

  // Match scenes by heading element id first (survives edits to the heading),
  // then by heading text for anything rewritten wholesale.
  const matchOf = new Map<Scene, Scene>();
  const used = new Set<Scene>();
  const bById = new Map(b.filter((s) => s.headingId).map((s) => [s.headingId!, s]));
  for (const s of a) {
    const m = s.headingId ? bById.get(s.headingId) : b.find((x) => x.key === s.key);
    if (m && !used.has(m)) { matchOf.set(s, m); used.add(m); }
  }
  for (const s of a) {
    if (matchOf.has(s)) continue;
    const m = b.find((x) => !used.has(x) && norm(x.heading) === norm(s.heading));
    if (m) { matchOf.set(s, m); used.add(m); }
  }

  const ref = (s: Scene): SceneRef => ({ number: s.number, heading: s.heading });
  const changed: SceneRef[] = [];
  const removed: SceneRef[] = [];
  for (const s of a) {
    const m = matchOf.get(s);
    if (!m) removed.push(ref(s));
    else if (m.body !== s.body || norm(m.heading) !== norm(s.heading)) changed.push(ref(s));
  }
  const addedScenes = b.filter((s) => !used.has(s));

  // Moved: matched scenes that fall outside the longest run kept in order
  const order = a.filter((s) => matchOf.has(s)).map((s) => b.indexOf(matchOf.get(s)!));
  const tails: number[] = [];
  for (const x of order) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < x) lo = mid + 1; else hi = mid; }
    tails[lo] = x;
  }

  const { added: lines_added, removed: lines_removed } = diffStats(
    diffLines(snapshotToLines(then), snapshotToLines(now)),
  );

  return {
    scenes_then: a.filter((s) => s.headingId).length,
    scenes_now: b.filter((s) => s.headingId).length,
    changed,
    removed,
    added: opts.includeNewHeadings ? addedScenes.map(ref) : [],
    added_count: addedScenes.length,
    moved_count: order.length - tails.length,
    words_then: wordCount(then.filter((e) => !e.is_omitted)),
    words_now: wordCount(now.filter((e) => !e.is_omitted)),
    lines_added,
    lines_removed,
  };
}
