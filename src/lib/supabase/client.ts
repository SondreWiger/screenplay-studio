import { createBrowserClient } from '@supabase/ssr';
import { isLocalOrElectron, createLocalSupabaseClient } from './electron-client';

export function createClient() {
  if (isLocalOrElectron()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createLocalSupabaseClient() as any;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
