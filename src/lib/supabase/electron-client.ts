/**
 * Electron / local-mode Supabase stub.
 *
 * When running in Electron (or browser local mode), returns a Supabase-compatible
 * client backed by localStorage. All database operations are stubbed — data lives
 * in the Zustand stores and IndexedDB (via the offline layer).
 */

import type { Profile } from '@/lib/types';

// ── Mode detection ─────────────────────────────────────────────

export function isElectronMode(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as Record<string, unknown>).electron;
}

export function isLocalMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('ss-local-mode') === '1';
}

export function isLocalOrElectron(): boolean {
  return isElectronMode() || isLocalMode();
}

// ── Local user management ──────────────────────────────────────

const LOCAL_USER_KEY = 'ss-local-user';
const LOCAL_MODE_KEY = 'ss-local-mode';

export function getLocalUser(): Profile | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LOCAL_USER_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Profile;
    } catch {
      return null;
    }
  }
  return null;
}

export function createLocalUser(displayName?: string): Profile {
  const id = crypto.randomUUID();
  const name = displayName || 'Local Writer';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: any = {
    id,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@local.screenplay-studio`,
    full_name: name,
    display_name: name,
    avatar_url: '',
    bio: null,
    role: 'writer' as const,
    onboarding_completed: true,
    usage_intent: 'screenwriter' as const,
    show_community: false,
    show_production_tools: false,
    show_collaboration: false,
    show_accountability: false,
    preferred_script_type: 'creator' as const,
    theme_preference: 'dark',
    company_id: null,
    is_pro: false,
    is_studio: false,
    studio_since: null,
    pro_since: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    username: null,
    headline: null,
    location: null,
    website: null,
    banner_url: null,
    social_links: {},
    featured_project_ids: [],
    profile_theme: 'dark',
    show_email: false,
    show_projects: true,
    show_activity: false,
    allow_dms: false,
    profile_views: 0,
  };
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  localStorage.setItem(LOCAL_MODE_KEY, '1');
  // Set cookie for middleware bypass
  document.cookie = `${LOCAL_MODE_KEY}=1; path=/; max-age=31536000; SameSite=Lax`;
  return user as Profile;
}

export function setLocalMode(enabled: boolean) {
  if (enabled) {
    localStorage.setItem(LOCAL_MODE_KEY, '1');
    // Set cookie for middleware bypass (server-side can't read localStorage)
    document.cookie = `${LOCAL_MODE_KEY}=1; path=/; max-age=31536000; SameSite=Lax`;
  } else {
    localStorage.removeItem(LOCAL_MODE_KEY);
    document.cookie = `${LOCAL_MODE_KEY}=; path=/; max-age=0`;
  }
}

export function clearLocalUser() {
  localStorage.removeItem(LOCAL_USER_KEY);
  localStorage.removeItem(LOCAL_MODE_KEY);
  document.cookie = `${LOCAL_MODE_KEY}=; path=/; max-age=0`;
}

// ── Stub Supabase client ──────────────────────────────────────

/**
 * Creates a Supabase-compatible client backed by localStorage
 * for use in Electron standalone or browser local mode.
 *
 * Returns `any` because the real SupabaseClient type is complex and
 * this is only used when the real client isn't needed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLocalSupabaseClient(): any {
  const user = getLocalUser() || createLocalUser();

  return {
    auth: {
      getUser: async () => ({ data: { user: { ...user, user_metadata: {} } }, error: null }),
      getSession: async () => ({
        data: {
          session: user
            ? { user: { ...user, user_metadata: {} }, access_token: 'local', refresh_token: 'local' }
            : null,
        },
        error: null,
      }),
      signInWithPassword: async ({ email }: { email: string }) => {
        const localUser = getLocalUser() || createLocalUser();
        localUser.email = email;
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(localUser));
        return { data: { user: { ...localUser, user_metadata: {} }, session: { user: { ...localUser, user_metadata: {} }, access_token: 'local' } }, error: null };
      },
      signUp: async ({ email }: { email: string; password: string }) => {
        const localUser = createLocalUser(email.split('@')[0]);
        localUser.email = email;
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(localUser));
        return { data: { user: { ...localUser, user_metadata: {} }, session: { user: { ...localUser, user_metadata: {} }, access_token: 'local' } }, error: null };
      },
      signOut: async () => {
        clearLocalUser();
        return { error: null };
      },
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: (_table: string) => ({
      select: (_cols?: string) => ({
        eq: (_col: string, _val: string) => ({
          single: async () => ({ data: null, error: null }),
          then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
            resolve({ data: [], error: null }),
        }),
        order: (_col: string, _opts?: { ascending: boolean }) => ({
          limit: (_n: number) => ({
            then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
              resolve({ data: [], error: null }),
          }),
        }),
        or: (_filter: string) => ({
          order: (_col: string, _opts?: { ascending: boolean }) => ({
            then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
              resolve({ data: [], error: null }),
          }),
        }),
        then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
          resolve({ data: [], error: null }),
      }),
      insert: (row: unknown) => ({
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          resolve({ data: row, error: null }),
      }),
      update: (_data: unknown) => ({
        eq: async () => ({ data: null, error: null }),
        in: async () => ({ data: null, error: null }),
      }),
      upsert: async () => ({ data: null, error: null }),
      delete: () => ({
        eq: async () => ({ data: null, error: null }),
        in: async () => ({ data: null, error: null }),
      }),
    }),
    rpc: async () => ({ data: null, error: null }),
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
    }),
    removeChannel: () => {},
  };
}
