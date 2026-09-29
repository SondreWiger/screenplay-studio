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
  syncKey,
  type DataStoreName,
  type Row,
} from './db';

// Tiny uuid helper (no dep)

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Online check

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// Background refresh helper

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

// Projects

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

// Generic project-scoped reader

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

// Script elements

export async function getScriptElements(scriptId: string): Promise<Row[]> {
  const cached = await getCachedByScript(scriptId);

  backgroundRefresh('script_elements', async () => {
    const sb = createClient();
    const allData: any[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await sb
        .from('script_elements')
        .select('*')
        .eq('script_id', scriptId)
        .order('sort_order', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return { data: null, error };
      if (!data) break;
      allData.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return { data: allData, error: null };
  });

  return cached;
}

// Trigger a sync (without importing queue to avoid circular dep). The queue
// debounces these, so a burst of keystrokes becomes one batched request.

function triggerImmediateSync() {
  if (typeof window !== 'undefined' && navigator.onLine) {
    window.dispatchEvent(new CustomEvent('ss:sync'));
  }
}

// Offline-first write

/**
 * Write a row locally and queue a remote sync.
 * The queue holds one entry per row, so rapid edits collapse into a single
 * upsert carrying the latest content.
 */
export async function offlineUpsert(
  store: DataStoreName,
  row: Row,
  projectId?: string
): Promise<{ data: Row; error: null }> {
  const rowWithId = row.id ? row : { ...row, id: newId() };

  // 1. Write to local cache immediately (optimistic)
  await putCached(store, rowWithId);

  // 2. Queue (persists through crashes/offline), replacing older pending writes
  await enqueueSyncItem({
    id: syncKey(store, rowWithId.id as string),
    table: store,
    operation: 'upsert',
    data: rowWithId,
    projectId,
    timestamp: Date.now(),
  });

  triggerImmediateSync();
  return { data: rowWithId, error: null };
}

/**
 * Delete a row locally and queue a remote sync. Supersedes any pending upsert
 * for the same row.
 */
export async function offlineDelete(
  store: DataStoreName,
  id: string,
  projectId?: string
): Promise<void> {
  await deleteCached(store, id);
  await enqueueSyncItem({
    id: syncKey(store, id),
    table: store,
    operation: 'delete',
    data: { id },
    projectId,
    timestamp: Date.now(),
  });
  triggerImmediateSync();
}

/**
 * Queue many row writes at once (reorders, undo/redo, imports). One IndexedDB
 * transaction and one sync trigger instead of one per row.
 */
export async function offlineUpsertMany(store: DataStoreName, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  const { getDB } = await import('./db');
  const db = await getDB();
  const now = Date.now();
  const tx = db.transaction([store, 'sync_queue'], 'readwrite');
  const data = tx.objectStore(store);
  const queue = tx.objectStore('sync_queue');
  await Promise.all([
    ...rows.map((r) => data.put(r)),
    ...rows.map((r) => queue.put({
      id: syncKey(store, r.id as string), table: store, operation: 'upsert', data: r, timestamp: now, retries: 0,
    })),
    tx.done,
  ]);
  triggerImmediateSync();
}
