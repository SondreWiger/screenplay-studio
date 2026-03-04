import { createClient } from '@supabase/supabase-js';

// ============================================================
// Site-settings utilities — server-side (no cookies needed)
// The site_settings table has a public-read RLS policy so
// the anon key is sufficient.
// ============================================================

/** Lightweight non-cookie anon client — safe for server components */
function makeAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Read all site_settings rows into a key→value map */
export async function getSiteSettings(): Promise<Record<string, string>> {
  try {
    const supabase = makeAnonClient();
    const { data } = await supabase.from('site_settings').select('key,value');
    const result: Record<string, string> = {};
    (data ?? []).forEach((row: { key: string; value: string }) => {
      result[row.key] = row.value;
    });
    return result;
  } catch {
    return {};
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
