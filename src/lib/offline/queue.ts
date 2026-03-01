/**
 * Sync queue processor.
 *
 * Works through pending offline writes and pushes them to Supabase.
 * Called automatically whenever the app comes back online, and after
 * every offline write attempt.
 *
 * Items that fail more than MAX_RETRIES times are dropped to prevent
 * infinite loops on unrecoverable errors (e.g. row deleted by someone else).
 */

import { createClient } from '@/lib/supabase/client';
import {
  getPendingSyncItems,
  removeSyncItem,
  incrementRetry,
  pendingSyncCount,
  type SyncQueueItem,
} from './db';

const MAX_RETRIES = 5;

let _syncRunning = false;

/** Process all pending sync items. Safe to call multiple times concurrently. */
export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (_syncRunning) return { synced: 0, failed: 0 };
  _syncRunning = true;

  let synced = 0;
  let failed = 0;

  try {
    const supabase = createClient();
    const items = await getPendingSyncItems();

    for (const item of items) {
      try {
        await syncItem(supabase, item);
        await removeSyncItem(item.id);
        synced++;
      } catch (err) {
        console.warn(`[offline] Failed to sync ${item.table}:${item.id}`, err);
        if (item.retries >= MAX_RETRIES) {
          console.error(`[offline] Dropping item after ${MAX_RETRIES} retries`, item);
          await removeSyncItem(item.id);
        } else {
          await incrementRetry(item);
        }
        failed++;
      }
    }
  } finally {
    _syncRunning = false;
  }

  return { synced, failed };
}

async function syncItem(supabase: ReturnType<typeof createClient>, item: SyncQueueItem) {
  if (item.operation === 'upsert') {
    const { error } = await supabase.from(item.table).upsert(item.data as any);
    if (error) throw error;
  } else if (item.operation === 'delete') {
    const { error } = await supabase
      .from(item.table)
      .delete()
      .eq('id', (item.data as any).id);
    if (error) throw error;
  }
}

/** Returns the current pending sync count. */
export { pendingSyncCount };
