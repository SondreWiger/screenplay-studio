/**
 * Sync queue processor.
 *
 * Pushes pending offline writes to Supabase. The queue holds at most one entry
 * per row (see `syncKey`), so this sends each row's latest state once.
 *
 * - Upserts are batched per table (one request per BATCH_SIZE rows) instead of
 *   one request per row, which is what made large scripts crawl.
 * - A trigger that arrives mid-run schedules another pass instead of being
 *   dropped, so writes never sit waiting for an unrelated event.
 * - Failed writes are never silently discarded. After MAX_RETRIES they stay in
 *   the queue marked as failed and are reported through `ss:sync-status`, so
 *   the UI can tell the user instead of losing their work.
 */

import { createClient } from '@/lib/supabase/client';
import {
  getPendingSyncItems,
  removeSyncItemIfUnchanged,
  incrementRetry,
  pendingSyncCount,
  type SyncQueueItem,
} from './db';

const MAX_RETRIES = 5;
const BATCH_SIZE = 200;

export interface SyncStatus {
  /** Items waiting to be sent (includes failed). */
  pending: number;
  /** Items that exhausted their retries and need attention. */
  failed: number;
  syncing: boolean;
  lastError: string | null;
}

let status: SyncStatus = { pending: 0, failed: 0, syncing: false, lastError: null };

export function getSyncStatus(): SyncStatus {
  return status;
}

function publish(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<SyncStatus>('ss:sync-status', { detail: status }));
  }
}

let running: Promise<{ synced: number; failed: number }> | null = null;
let rerun = false;

/**
 * Process pending sync items. Concurrent calls share the running pass and
 * trigger one follow-up pass so nothing queued during the run is missed.
 */
export function processSyncQueue(opts: { includeFailed?: boolean } = {}): Promise<{ synced: number; failed: number }> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    let total = { synced: 0, failed: 0 };
    do {
      rerun = false;
      const r = await runPass(opts.includeFailed ?? false);
      total = { synced: total.synced + r.synced, failed: total.failed + r.failed };
      // Stop looping on failures; the retry timer will pick them up.
      if (r.failed > 0) break;
    } while (rerun);
    return total;
  })().finally(() => { running = null; });
  return running;
}

async function runPass(includeFailed: boolean): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await refreshCounts();
    return { synced: 0, failed: 0 };
  }

  const all = await getPendingSyncItems();
  const items = includeFailed ? all : all.filter((i) => i.retries < MAX_RETRIES);
  if (items.length === 0) {
    await refreshCounts();
    return { synced: 0, failed: 0 };
  }

  publish({ syncing: true });
  const supabase = createClient();
  let synced = 0;
  let failed = 0;
  let lastError: string | null = null;

  // Keep upserts before deletes within a table, and group upserts by shape:
  // a bulk upsert sets missing columns to NULL, so rows must share a key set.
  const groups = new Map<string, SyncQueueItem[]>();
  for (const item of items) {
    const shape = item.operation === 'upsert' ? Object.keys(item.data).sort().join(',') : '';
    const key = `${item.table}|${item.operation}|${shape}`;
    const list = groups.get(key);
    if (list) list.push(item); else groups.set(key, [item]);
  }

  for (const [key, group] of Array.from(groups.entries())) {
    const [table, operation] = key.split('|');
    for (let i = 0; i < group.length; i += BATCH_SIZE) {
      const batch = group.slice(i, i + BATCH_SIZE);
      const error = await sendBatch(supabase, table, operation, batch);
      if (!error) {
        await Promise.all(batch.map(removeSyncItemIfUnchanged));
        synced += batch.length;
        continue;
      }
      // Batch rejected — retry row by row so one bad row can't block the rest.
      for (const item of batch) {
        const rowError = await sendBatch(supabase, table, operation, [item]);
        if (!rowError) {
          await removeSyncItemIfUnchanged(item);
          synced++;
        } else {
          console.warn(`[offline] Failed to sync ${item.table}:${String(item.data.id)}`, rowError);
          lastError = rowError;
          await incrementRetry(item);
          failed++;
        }
      }
    }
  }

  publish({ syncing: false, lastError: failed ? lastError : null });
  await refreshCounts();
  if (failed > 0) scheduleRetry();
  return { synced, failed };
}

async function sendBatch(
  supabase: ReturnType<typeof createClient>,
  table: string,
  operation: string,
  batch: SyncQueueItem[],
): Promise<string | null> {
  try {
    if (operation === 'upsert') {
      const { error } = await supabase.from(table).upsert(batch.map((b) => b.data));
      return error ? error.message : null;
    }
    const ids = batch.map((b) => b.data.id);
    const { error } = await supabase.from(table).delete().in('id', ids);
    return error ? error.message : null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function refreshCounts() {
  try {
    const all = await getPendingSyncItems();
    publish({ pending: all.length, failed: all.filter((i) => i.retries >= MAX_RETRIES).length });
  } catch { /* IndexedDB unavailable */ }
}

// Exponential-ish backoff for failed writes: 5s, 15s, 30s, 60s…
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 5_000;
function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    processSyncQueue().then((r) => {
      retryDelay = r.failed ? Math.min(retryDelay * 2, 60_000) : 5_000;
    });
  }, retryDelay);
}

/** Debounced trigger: coalesces bursts of writes into a single pass. */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
export function requestSync(delayMs = 250) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    processSyncQueue().catch(console.warn);
  }, delayMs);
}

/** Send everything now (tab hidden / closing). */
export function flushSyncQueue() {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  return processSyncQueue().catch(console.warn);
}

/** Returns the current pending sync count. */
export { pendingSyncCount };
