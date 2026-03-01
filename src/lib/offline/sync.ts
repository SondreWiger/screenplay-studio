/**
 * Offline-first data access layer.
 *
 * Every function here returns data immediately from the local IndexedDB cache,
 * then fires a background refresh from Supabase when online. Writes are
 * applied locally first and queued for remote sync.
 */

import { createClient } from '@/lib/supabase/client';
import {
  cacheRows,
  putCached,
  deleteCached,
  getCachedByProject,
  getCachedByScript,
  getCachedById,
  getCachedProjects,
  enqueueSyncItem,
  type DataStoreName,
  type Row,
} from './db';

// ── Tiny uuid helper (no dep) ─────────────────────────────────────────────

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Online check ──────────────────────────────────────────────────────────

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// ── Background refresh helper ─────────────────────────────────────────────

/**
 * Silently fetches fresh data from Supabase in the background
 * and updates the local cache. Never throws.
 */
async function backgroundRefresh(
  store: DataStoreName,
  query: () => Promise<{ data: Row[] | null; error: unknown }>
): Promise<void> {
  if (!isOnline()) return;
  try {
    const { data } = await query();
    if (data?.length) await cacheRows(store, data);
  } catch {
    // silently ignore – user is working offline
  }
}

// ── Projects ──────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Row[]> {
  const cached = await getCachedProjects();

  backgroundRefresh('projects', async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user?.id) return { data: [], error: null };

    const { data: memberships } = await sb
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id);
    const ids = (memberships || []).map((m: Row) => m.project_id as string);

    return sb
      .from('projects')
      .select('*')
      .or(`created_by.eq.${user.id}${ids.length ? `,id.in.(${ids.join(',')})` : ''}`)
      .order('updated_at', { ascending: false }) as any;
  });

  return cached;
}

export async function getProject(id: string): Promise<Row | undefined> {
  const cached = await getCachedById('projects', id);

  backgroundRefresh('projects', async () => {
    const sb = createClient();
    const res = await sb.from('projects').select('*').eq('id', id).single();
    return { data: res.data ? [res.data] : [], error: res.error };
  });

  return cached;
}

// ── Generic project-scoped reader ─────────────────────────────────────────

export async function getProjectRows(
  store: DataStoreName,
  projectId: string,
  selectQuery = '*',
  orderBy = 'updated_at'
): Promise<Row[]> {
  const cached = await getCachedByProject(store, projectId);

  backgroundRefresh(store, () => {
    const sb = createClient();
    return sb
      .from(store)
      .select(selectQuery)
      .eq('project_id', projectId)
      .order(orderBy, { ascending: false }) as any;
  });

  return cached;
}

// ── Script elements ───────────────────────────────────────────────────────

export async function getScriptElements(scriptId: string): Promise<Row[]> {
  const cached = await getCachedByScript(scriptId);

  backgroundRefresh('script_elements', () => {
    const sb = createClient();
    return sb
      .from('script_elements')
      .select('*')
      .eq('script_id', scriptId)
      .order('position', { ascending: true }) as any;
  });

  return cached;
}

// ── Trigger immediate sync (without importing queue to avoid circular dep) ───

function triggerImmediateSync() {
  if (typeof window !== 'undefined' && navigator.onLine) {
    window.dispatchEvent(new CustomEvent('ss:sync'));
  }
}

// ── Offline-first write ───────────────────────────────────────────────────

/**
 * Write a row locally and queue a remote sync.
 * Immediately attempts remote write if online; the queue is the safety net.
 */
export async function offlineUpsert(
  store: DataStoreName,
  row: Row,
  projectId?: string
): Promise<{ data: Row; error: null }> {
  const rowWithId = row.id ? row : { ...row, id: newId() };

  // 1. Write to local cache immediately (optimistic)
  await putCached(store, rowWithId);

  // 2. Add to sync queue (persists through crashes/offline)
  const queueId = newId();
  await enqueueSyncItem({
    id: queueId,
    table: store,
    operation: 'upsert',
    data: rowWithId,
    projectId,
    timestamp: Date.now(),
  });

  // 3. Try immediate remote sync if online
  if (isOnline()) {
    triggerImmediateSync();
  }

  return { data: rowWithId, error: null };
}

/**
 * Delete a row locally and queue a remote sync.
 */
export async function offlineDelete(
  store: DataStoreName,
  id: string,
  projectId?: string
): Promise<void> {
  // 1. Remove from local cache
  await deleteCached(store, id);

  // 2. Add to sync queue
  await enqueueSyncItem({
    id: newId(),
    table: store,
    operation: 'delete',
    data: { id },
    projectId,
    timestamp: Date.now(),
  });

  // 3. Try immediate remote sync
  if (isOnline()) {
    triggerImmediateSync();
  }
}
