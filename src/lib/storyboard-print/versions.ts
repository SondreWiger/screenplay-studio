/**
 * Storyboard frame versions. A shot's storyboard_drawing is the frame people
 * see; storyboard_versions keeps the earlier takes (scans, and drawings a scan
 * replaced) so any of them can be brought back.
 */

import { createClient } from '@/lib/supabase/client';
import { compactLayers, hasDrawing, normalizeToLayers, type DrawingLayer, type ShotWithStoryboard } from '@/components/storyboard/engine';

export type VersionSource = 'scan' | 'drawn' | 'restore';

export interface StoryboardVersion {
  id: string;
  label: string;
  source: VersionSource;
  created_at: string;
  created_by: string | null;
  drawing: DrawingLayer[];
  /** Printed sheet code the scan came from, if any. */
  sheet_code?: number;
}

/** Oldest versions are dropped past this, to keep the row a sensible size. */
export const MAX_VERSIONS = 24;

export function getVersions(shot: Pick<ShotWithStoryboard, 'storyboard_versions'>): StoryboardVersion[] {
  return Array.isArray(shot.storyboard_versions) ? (shot.storyboard_versions as StoryboardVersion[]) : [];
}

const sameDrawing = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function newVersion(label: string, source: VersionSource, drawing: DrawingLayer[], userId: string | null, extra?: Partial<StoryboardVersion>): StoryboardVersion {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label,
    source,
    created_at: new Date().toISOString(),
    created_by: userId,
    drawing: compactLayers(drawing),
    ...extra,
  };
}

/** Keeps the current drawing as a version unless it is already stored as one. */
function withCurrentKept(shot: ShotWithStoryboard, versions: StoryboardVersion[], userId: string | null): StoryboardVersion[] {
  if (!hasDrawing(shot.storyboard_drawing)) return versions;
  const current = compactLayers(normalizeToLayers(shot.storyboard_drawing));
  if (versions.some((v) => sameDrawing(v.drawing, current))) return versions;
  return [...versions, newVersion('Drawn on site', 'drawn', current, userId)];
}

const trim = (v: StoryboardVersion[]) => (v.length > MAX_VERSIONS ? v.slice(v.length - MAX_VERSIONS) : v);

export interface ShotStoryboardPatch {
  storyboard_drawing?: DrawingLayer[];
  storyboard_versions: StoryboardVersion[];
}

/**
 * Adds a scanned frame to a shot. With `makeCurrent` the scan replaces the
 * frame people see (the old one is kept as a version); otherwise it is only
 * stored as a version.
 */
export function planScanImport(
  shot: ShotWithStoryboard,
  layers: DrawingLayer[],
  opts: { makeCurrent: boolean; userId: string | null; label?: string; sheetCode?: number }
): ShotStoryboardPatch {
  let versions = getVersions(shot);
  if (opts.makeCurrent) versions = withCurrentKept(shot, versions, opts.userId);
  const label = opts.label || `Scan ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  versions = trim([...versions, newVersion(label, 'scan', layers, opts.userId, opts.sheetCode ? { sheet_code: opts.sheetCode } : {})]);
  return opts.makeCurrent ? { storyboard_drawing: compactLayers(layers), storyboard_versions: versions } : { storyboard_versions: versions };
}

/** Makes a stored version the current frame, keeping what was there. */
export function planRestore(shot: ShotWithStoryboard, versionId: string, userId: string | null): ShotStoryboardPatch | null {
  const versions = getVersions(shot);
  const v = versions.find((x) => x.id === versionId);
  if (!v) return null;
  return { storyboard_drawing: v.drawing, storyboard_versions: trim(withCurrentKept(shot, versions, userId)) };
}

/** Snapshots the current frame as a named version. */
export function planSnapshot(shot: ShotWithStoryboard, label: string, userId: string | null): ShotStoryboardPatch | null {
  if (!hasDrawing(shot.storyboard_drawing)) return null;
  const current = compactLayers(normalizeToLayers(shot.storyboard_drawing));
  return { storyboard_versions: trim([...getVersions(shot), newVersion(label || 'Snapshot', 'drawn', current, userId)]) };
}

export function planDelete(shot: ShotWithStoryboard, versionId: string): ShotStoryboardPatch {
  return { storyboard_versions: getVersions(shot).filter((v) => v.id !== versionId) };
}

export async function saveShotStoryboard(shotId: string, patch: ShotStoryboardPatch): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('shots').update(patch).eq('id', shotId);
  if (error) {
    if (/storyboard_versions/.test(error.message)) {
      throw new Error('Storyboard versions need the latest database migration (20261020140000_storyboard_print_scan).');
    }
    throw new Error(error.message);
  }
}
