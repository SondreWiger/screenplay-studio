/**
 * IndexedDB schema for offline-first local storage.
 * Stores a local copy of all key project data so the app
 * works without an internet connection.
 */

import { openDB, type IDBPDatabase } from 'idb';

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── DB Schema ────────────────────────────────────────────────────────────────

const DB_NAME = 'ss-offline';
const DB_VERSION = 1;

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

// ── Singleton ────────────────────────────────────────────────────────────────

let _db: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;

  _db = await openDB(DB_NAME, DB_VERSION, {
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

      // Pending writes queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const sq = db.createObjectStore('sync_queue', { keyPath: 'id' });
        sq.createIndex('by_timestamp', 'timestamp', { unique: false });
      }
    },
  });

  return _db;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Sync Queue ───────────────────────────────────────────────────────────────

/** Add a pending write to the sync queue. */
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

/** Increment retry count for a sync item. */
export async function incrementRetry(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('sync_queue', { ...item, retries: item.retries + 1 });
}

/** How many items are pending sync. */
export async function pendingSyncCount(): Promise<number> {
  const db = await getDB();
  return db.count('sync_queue');
}
