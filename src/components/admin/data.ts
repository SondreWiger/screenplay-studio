'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Module-level cache shared by every admin tab. Switching back to a tab shows
 * its last data instantly while a fresh copy loads in the background.
 */
const store = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export function invalidateAdminCache(prefix?: string) {
  Array.from(store.keys()).forEach((k) => {
    if (!prefix || k.startsWith(prefix)) store.delete(k);
  });
}

/** Load once per key; concurrent callers share one request. */
export function loadShared<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const p = loader()
    .then((v) => { store.set(key, v); return v; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function useAdminData<T>(key: string, loader: () => Promise<T>, initial: T) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [data, setData] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));
  const [loading, setLoading] = useState(!store.has(key));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const v = await loadShared(key, () => loaderRef.current());
      setData(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => { reload(); }, [reload]);

  const mutate = useCallback((fn: (prev: T) => T) => {
    setData((prev) => {
      const next = fn(prev);
      store.set(key, next);
      return next;
    });
  }, [key]);

  return { data, loading, error, reload, mutate };
}

/** A boolean/string row in `site_settings`, with an optimistic setter. */
export function useSiteSetting(key: string, fallback: boolean): readonly [boolean, (value: boolean) => Promise<void>];
export function useSiteSetting(key: string, fallback: string): readonly [string, (value: string) => Promise<void>];
export function useSiteSetting<T extends string | boolean>(key: string, fallback: T) {
  const parse = (raw: string | null | undefined): T => {
    if (raw == null) return fallback;
    return (typeof fallback === 'boolean' ? raw === 'true' : raw) as T;
  };
  const { data, mutate } = useAdminData<T>(`setting:${key}`, async () => {
    const { data } = await createClient().from('site_settings').select('value').eq('key', key).maybeSingle();
    return parse(data?.value);
  }, fallback);

  const set = useCallback(async (value: T) => {
    const prev = data;
    mutate(() => value);
    const { error } = await createClient().from('site_settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() });
    if (error) {
      console.error(`Error updating ${key}:`, error);
      mutate(() => prev);
    }
  }, [data, key, mutate]);

  return [data, set] as const;
}
