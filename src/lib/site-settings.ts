import { createClient } from '@supabase/supabase-js';

// Site-settings utilities — server-side (no cookies needed)
// The site_settings table has a public-read RLS policy so
// the anon key is sufficient.

/** Lightweight non-cookie anon client — safe for server components */
function makeAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Module-level cache — avoids a DB roundtrip on every page render.
// TTL of 60s is safe: settings rarely change and instances are short-lived.
let _settingsCache: Record<string, string> | null = null;
let _settingsCacheAt = 0;
const CACHE_TTL_MS = 60_000;

/** Read all site_settings rows into a key→value map (cached 60s) */
export async function getSiteSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (_settingsCache && now - _settingsCacheAt < CACHE_TTL_MS) {
    return _settingsCache;
  }
  try {
    const supabase = makeAnonClient();
    const { data } = await supabase.from('site_settings').select('key,value');
    const result: Record<string, string> = {};
    (data ?? []).forEach((row: { key: string; value: string }) => {
      result[row.key] = row.value;
    });
    _settingsCache = result;
    _settingsCacheAt = now;
    return result;
  } catch {
    return _settingsCache ?? {};
  }
}

/**
 * Returns true unless the admin has explicitly set
 * opensource_enabled = 'false' in site_settings.
 */
export async function isOpenSourceEnabled(): Promise<boolean> {
  const settings = await getSiteSettings();
  return settings['opensource_enabled'] !== 'false';
}
