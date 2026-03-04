'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// Client-side site settings hook
// Reads the site_settings table (public read policy) and
// provides reactive access to individual setting values.
// ============================================================

// Module-level cache so all components share one fetch
let settingsCache: Record<string, string> | null = null;
let settingsCacheTime = 0;
const CACHE_TTL = 60_000; // 1 min

export function useSiteSettings() {
  const [settings, setSettings] = useState<Record<string, string>>(
    settingsCache ?? {},
  );
  const [loading, setLoading] = useState(!settingsCache);

  useEffect(() => {
    const now = Date.now();
    if (settingsCache && now - settingsCacheTime < CACHE_TTL) {
      setSettings(settingsCache);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    Promise.resolve(
      supabase.from('site_settings').select('key,value'),
    )
      .then(({ data }) => {
        const result: Record<string, string> = {};
        (data ?? []).forEach((row: { key: string; value: string }) => {
          result[row.key] = row.value;
        });
        settingsCache = result;
        settingsCacheTime = Date.now();
        setSettings(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const get = (key: string, fallback = '') => settings[key] ?? fallback;

  return { settings, loading, get };
}

/**
 * Convenience hook — returns whether the open-source feature is enabled.
 * Defaults to `true` while loading (avoids flash-of-hidden-content).
 */
export function useOpenSource() {
  const { settings, loading } = useSiteSettings();
  // Treat "not set" or "true" as enabled; only "false" disables it
  const enabled = loading ? true : settings['opensource_enabled'] !== 'false';
  return { enabled, loading };
}
