/**
 * IndexedDB schema for offline-first local storage.
 * Stores a local copy of all key project data so the app
 * works without an internet connection.
 */

import { openDB, type IDBPDatabase } from 'idb';

// Types

export type SyncOperation = 'upsert' | 'delete';

export interface SyncQueueItem {
  id: string;           // uuid
  table: string;        // supabase table name
  operation: SyncOperation;
  data: Record<string, unknown>;
  projectId?: string;
  timestamp: number;    // Date.now()
  retries: number;
}

// Generic row – we store the raw Supabase response objects
export type Row = Record<string, unknown>;

// DB Schema

const DB_NAME = 'ss-offline';
const DB_VERSION = 2;

// All data tables we cache locally
const DATA_STORES = [
  'projects',
  'scripts',
  'script_elements',
  'scenes',
  'characters',
  'locations',
  'shots',
  'ideas',
  'budget_items',
  'production_schedule',
  'project_members',
] as const;

export type DataStoreName = (typeof DATA_STORES)[number];

export function isDataStore(name: string): name is DataStoreName {
  return (DATA_STORES as readonly string[]).includes(name);
}

// Local mode keeps rows for every other table here, keyed `${table}:${id}`.
const LOCAL_ROWS_STORE = 'local_rows';

// Singleton

let _dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Ask the browser not to evict our data under storage pressure (Safari/iOS
 * and low-disk devices otherwise may silently wipe IndexedDB). Returns whether
 * storage is persistent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Write a row and read it back to prove it actually landed. Throws if the
 * browser accepted the write but the data isn't there (broken/evicted storage).
 */
export async function putCachedVerified(store: DataStoreName, row: Row): Promise<void> {
  await putCached(store, row);
  const back = await getCachedById(store, row.id as string);
  if (!back) {
    throw new Error('Browser storage did not keep the data. Storage may be full, blocked or in private mode.');
  }
}

export async function getDB(): Promise<IDBPDatabase> {
  if (_dbPromise) return _dbPromise;

  const reset = () => { _dbPromise = null; };
  _dbPromise = openDB(DB_NAME, DB_VERSION, {
    // Another tab wants to upgrade, or the browser killed the connection:
    // drop our cached handle so the next call reopens instead of failing.
    blocking() { reset(); },
    terminated() { reset(); },
    upgrade(db) {
      // Data caches
      for (const name of DATA_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          // Index on project_id so we can fetch all rows for a project fast
          if (name !== 'projects') {
            store.createIndex('by_project', 'project_id', { unique: false });
          }
          if (name === 'script_elements') {
            store.createIndex('by_script', 'script_id', { unique: false });
          }
        }
      }

      if (!db.objectStoreNames.contains(LOCAL_ROWS_STORE)) {
        const lr = db.createObjectStore(LOCAL_ROWS_STORE, { keyPath: 'key' });
        lr.createIndex('by_table', 'table', { unique: false });
      }

      // Pending writes queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const sq = db.createObjectStore('sync_queue', { keyPath: 'id' });
        sq.createIndex('by_timestamp', 'timestamp', { unique: false });
      }
    },
  }).catch((err) => { reset(); throw err; });

  return _dbPromise;
}

// Helpers

/** Cache an array of rows into a given store (upsert by id). */
export async function cacheRows(store: DataStoreName, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  const db = await getDB();
  const tx = db.transaction(store, 'readwrite');
  await Promise.all([...rows.map((r) => tx.store.put(r)), tx.done]);
}

/** Retrieve all cached rows for a project from a given store. */
export async function getCachedByProject(
  store: DataStoreName,
  projectId: string
): Promise<Row[]> {
  const db = await getDB();
  return db.getAllFromIndex(store, 'by_project', projectId) as Promise<Row[]>;
}

/** Retrieve all cached rows for a script (script_elements). */
export async function getCachedByScript(scriptId: string): Promise<Row[]> {
  const db = await getDB();
  return db.getAllFromIndex('script_elements', 'by_script', scriptId) as Promise<Row[]>;
}

/** Get a single cached row by id. */
export async function getCachedById(store: DataStoreName, id: string): Promise<Row | undefined> {
  const db = await getDB();
  return db.get(store, id) as Promise<Row | undefined>;
}

/** Upsert a single row into the local cache. */
export async function putCached(store: DataStoreName, row: Row): Promise<void> {
  const db = await getDB();
  await db.put(store, row);
}

/** Delete a row from the local cache. */
export async function deleteCached(store: DataStoreName, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(store, id);
}

/** Get all projects from local cache. */
export async function getCachedProjects(): Promise<Row[]> {
  const db = await getDB();
  return db.getAll('projects') as Promise<Row[]>;
}

/** All local rows for any table (local mode). */
export async function getLocalTableRows(table: string): Promise<Row[]> {
  const db = await getDB();
  if (isDataStore(table)) return db.getAll(table) as Promise<Row[]>;
  const entries = await db.getAllFromIndex(LOCAL_ROWS_STORE, 'by_table', table) as { row: Row }[];
  return entries.map((e) => e.row);
}

/** Upsert rows for any table (local mode). */
export async function putLocalTableRows(table: string, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  if (isDataStore(table)) return cacheRows(table, rows);
  const db = await getDB();
  const tx = db.transaction(LOCAL_ROWS_STORE, 'readwrite');
  await Promise.all([
    ...rows.map((row) => tx.store.put({ key: `${table}:${row.id}`, table, row })),
    tx.done,
  ]);
}

/** Delete rows by id for any table (local mode). */
export async function deleteLocalTableRows(table: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDB();
  const store = isDataStore(table) ? table : LOCAL_ROWS_STORE;
  const tx = db.transaction(store, 'readwrite');
  await Promise.all([
    ...ids.map((id) => tx.store.delete(isDataStore(table) ? id : `${table}:${id}`)),
    tx.done,
  ]);
}

// Sync Queue

/** Queue key for a row: one pending entry per row, so repeated saves coalesce. */
export function syncKey(table: string, rowId: string): string {
  return `${table}:${rowId}`;
}

/**
 * Add a pending write to the sync queue. Items keyed by `syncKey()` replace any
 * earlier pending write for the same row — only the latest state is sent.
 */
export async function enqueueSyncItem(item: Omit<SyncQueueItem, 'retries'>): Promise<void> {
  const db = await getDB();
  await db.put('sync_queue', { ...item, retries: 0 });
}

/** Get all pending sync items ordered by timestamp. */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('sync_queue', 'by_timestamp') as Promise<SyncQueueItem[]>;
}

/** Remove a sync item once successfully synced. */
export async function removeSyncItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

/**
 * Remove a synced item only if it wasn't replaced while the request was in
 * flight. A newer write for the same row must stay queued.
 */
export async function removeSyncItemIfUnchanged(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('sync_queue', 'readwrite');
  const current = await tx.store.get(item.id) as SyncQueueItem | undefined;
  if (current && current.timestamp === item.timestamp) await tx.store.delete(item.id);
  await tx.done;
}

/** Increment retry count for a sync item (unless a newer write replaced it). */
export async function incrementRetry(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('sync_queue', 'readwrite');
  const current = await tx.store.get(item.id) as SyncQueueItem | undefined;
  if (current && current.timestamp === item.timestamp) {
    await tx.store.put({ ...current, retries: current.retries + 1 });
  }
  await tx.done;
}

/** How many items are pending sync. */
export async function pendingSyncCount(): Promise<number> {
  const db = await getDB();
  return db.count('sync_queue');
}
