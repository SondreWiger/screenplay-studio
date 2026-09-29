import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchAll, fetchAllResult } from '@/lib/supabase/fetch-all';
import type { SyncQueueItem } from '@/lib/offline/db';

// fetchAll

function pagedQuery(total: number, calls: Array<[number, number]>) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const q: any = {
    order: () => q,
    range: (from: number, to: number) => {
      calls.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
  return q;
}

describe('fetchAll', () => {
  it('pages past the 1000-row cap', async () => {
    const calls: Array<[number, number]> = [];
    const rows = await fetchAll(() => pagedQuery(2500, calls));
    expect(rows).toHaveLength(2500);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('stops after an exact multiple with one empty page', async () => {
    const calls: Array<[number, number]> = [];
    const rows = await fetchAll(() => pagedQuery(1000, calls));
    expect(rows).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });

  it('reports errors instead of returning a partial result', async () => {
    const q: any = { order: () => q, range: () => Promise.resolve({ data: null, error: { message: 'boom' } }) };
    await expect(fetchAll(() => q)).rejects.toThrow('boom');
    expect(await fetchAllResult(() => q)).toEqual({ data: null, error: expect.any(Error) });
  });
});

// Sync queue

let queue: Map<string, SyncQueueItem>;
const upserts: Array<{ table: string; rows: unknown[] }> = [];
let failIds = new Set<string>();

vi.mock('@/lib/offline/db', () => ({
  getPendingSyncItems: async () => Array.from(queue.values()).sort((a, b) => a.timestamp - b.timestamp),
  removeSyncItemIfUnchanged: async (item: SyncQueueItem) => {
    if (queue.get(item.id)?.timestamp === item.timestamp) queue.delete(item.id);
  },
  incrementRetry: async (item: SyncQueueItem) => {
    const cur = queue.get(item.id);
    if (cur && cur.timestamp === item.timestamp) queue.set(item.id, { ...cur, retries: cur.retries + 1 });
  },
  pendingSyncCount: async () => queue.size,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => ({
      upsert: async (rows: Array<{ id: string }>) => {
        if (rows.some((r) => failIds.has(r.id))) return { error: { message: 'rejected' } };
        upserts.push({ table, rows });
        return { error: null };
      },
      delete: () => ({ in: async () => ({ error: null }) }),
    }),
  }),
}));

function item(id: string, data: Record<string, unknown>, ts = 1, retries = 0): SyncQueueItem {
  return { id: `script_elements:${id}`, table: 'script_elements', operation: 'upsert', data: { id, ...data }, timestamp: ts, retries };
}

describe('processSyncQueue', () => {
  beforeEach(() => {
    queue = new Map();
    upserts.length = 0;
    failIds = new Set();
  });

  it('sends many rows in one batched request', async () => {
    const { processSyncQueue } = await import('@/lib/offline/queue');
    for (let i = 0; i < 350; i++) queue.set(`script_elements:${i}`, item(String(i), { content: 'x' }));
    const res = await processSyncQueue();
    expect(res).toEqual({ synced: 350, failed: 0 });
    expect(upserts).toHaveLength(2); // 200 + 150
    expect(queue.size).toBe(0);
  });

  it('never bulk-upserts rows with different columns together', async () => {
    const { processSyncQueue } = await import('@/lib/offline/queue');
    queue.set('script_elements:a', item('a', { content: 'x' }));
    queue.set('script_elements:b', item('b', { content: 'y', metadata: {} }));
    await processSyncQueue();
    expect(upserts).toHaveLength(2);
  });

  it('isolates a bad row and keeps it queued instead of dropping it', async () => {
    const { processSyncQueue } = await import('@/lib/offline/queue');
    queue.set('script_elements:good', item('good', { content: 'x' }));
    queue.set('script_elements:bad', item('bad', { content: 'x' }));
    failIds.add('bad');
    const res = await processSyncQueue();
    expect(res).toEqual({ synced: 1, failed: 1 });
    expect(queue.get('script_elements:bad')?.retries).toBe(1);
  });

  it('keeps failed rows after max retries so they can be retried later', async () => {
    const { processSyncQueue } = await import('@/lib/offline/queue');
    queue.set('script_elements:bad', item('bad', { content: 'x' }, 1, 5));
    failIds.add('bad');
    await processSyncQueue();
    expect(queue.has('script_elements:bad')).toBe(true);
    failIds.clear();
    await processSyncQueue({ includeFailed: true });
    expect(queue.has('script_elements:bad')).toBe(false);
  });
});

describe('local (offline) supabase client', () => {
  it('supports chained realtime subscriptions without crashing', async () => {
    const { createLocalSupabaseClient } = await import('@/lib/supabase/electron-client');
    const client = createLocalSupabaseClient() as any;
    const ch = client.channel('x').on('postgres_changes', {}, () => {}).on('postgres_changes', {}, () => {}).on('presence', {}, () => {}).subscribe();
    expect(ch.presenceState()).toEqual({});
    await expect(ch.track({})).resolves.toBe('ok');
  });
});
