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
  if (isElectronMode() && window.electron?.getPreferenceSync) {
    return window.electron.getPreferenceSync('ss-local-mode') === '1';
  }
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
  let stored: string | null = null;
  if (isElectronMode() && window.electron?.getPreferenceSync) {
    stored = window.electron.getPreferenceSync(LOCAL_USER_KEY);
  } else {
    stored = localStorage.getItem(LOCAL_USER_KEY);
  }
  
  if (stored) {
    try {
      return typeof stored === 'string' ? JSON.parse(stored) as Profile : stored as unknown as Profile;
    } catch {
      return null;
    }
  }
  return null;
}

export function createLocalUser(displayName?: string): Profile {
  const existing = getLocalUser();
  if (existing) {
    if (isElectronMode() && window.electron?.setPreference) {
      window.electron.setPreference(LOCAL_MODE_KEY, '1');
    }
    localStorage.setItem(LOCAL_MODE_KEY, '1');
    document.cookie = `${LOCAL_MODE_KEY}=1; path=/; max-age=31536000; SameSite=Lax`;
    return existing;
  }

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
  
  if (isElectronMode() && window.electron?.setPreference) {
    window.electron.setPreference(LOCAL_USER_KEY, JSON.stringify(user));
    window.electron.setPreference(LOCAL_MODE_KEY, '1');
  }
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  localStorage.setItem(LOCAL_MODE_KEY, '1');
  // Set cookie for middleware bypass
  document.cookie = `${LOCAL_MODE_KEY}=1; path=/; max-age=31536000; SameSite=Lax`;
  return user as Profile;
}

export function setLocalMode(enabled: boolean) {
  if (enabled) {
    if (isElectronMode() && window.electron?.setPreference) {
      window.electron.setPreference(LOCAL_MODE_KEY, '1');
    }
    localStorage.setItem(LOCAL_MODE_KEY, '1');
    // Set cookie for middleware bypass (server-side can't read localStorage)
    document.cookie = `${LOCAL_MODE_KEY}=1; path=/; max-age=31536000; SameSite=Lax`;
  } else {
    if (isElectronMode() && window.electron?.setPreference) {
      window.electron.setPreference(LOCAL_MODE_KEY, null);
    }
    localStorage.removeItem(LOCAL_MODE_KEY);
    document.cookie = `${LOCAL_MODE_KEY}=; path=/; max-age=0`;
  }
}

export function clearLocalUser() {
  if (isElectronMode() && window.electron?.setPreference) {
    window.electron.setPreference(LOCAL_USER_KEY, null);
    window.electron.setPreference(LOCAL_MODE_KEY, null);
  }
  localStorage.removeItem(LOCAL_USER_KEY);
  localStorage.removeItem(LOCAL_MODE_KEY);
  document.cookie = `${LOCAL_MODE_KEY}=; path=/; max-age=0`;
}

// ── Stub Supabase client ──────────────────────────────────────

/**
 * Chainable query builder that always resolves to { data: [], error: null }.
 * Supports arbitrary method chaining (eq, limit, order, not, gte, in, etc.)
 * by returning `this` from every method call.
 */
class StubQueryBuilder {
  private _data: unknown;
  private _single: boolean;

  constructor(data: unknown = [], single = false) {
    this._data = data;
    this._single = single;
  }

  single() { return new StubQueryBuilder(this._data, true); }
  maybeSingle() { return new StubQueryBuilder(this._data, true); }
  csv() { return new StubQueryBuilder(this._data, true); }
  head() { return this; }

  // Filter / query methods
  order() { return this; }
  limit() { return this; }
  range() { return this; }
  eq() { return this; }
  neq() { return this; }
  gt() { return this; }
  gte() { return this; }
  lt() { return this; }
  lte() { return this; }
  like() { return this; }
  ilike() { return this; }
  is() { return this; }
  in() { return this; }
  contains() { return this; }
  containedBy() { return this; }
  overlaps() { return this; }
  textSearch() { return this; }
  match() { return this; }
  not() { return this; }
  filter() { return this; }
  or() { return this; }
  and() { return this; }

  // CRUD methods
  select() { return this; }
  insert() { return this; }
  update() { return this; }
  delete() { return this; }
  upsert() { return this; }

  // Resolve
  returns() { return this; }
  then(resolve: (v: { data: unknown; error: null }) => void) {
    resolve({ data: this._single ? null : this._data, error: null });
  }

  // Catch-all for any future methods we haven't listed
  static create(data: unknown = [], single = false): StubQueryBuilder & Record<string, (...args: unknown[]) => StubQueryBuilder> {
    const qb = new StubQueryBuilder(data, single);
    return new Proxy(qb, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver);
        // Unknown method — return a function that returns the target for chaining
        return () => receiver;
      },
    });
  }
}

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
      select: (_cols?: string) => StubQueryBuilder.create(),
      insert: (row: unknown) => ({
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          resolve({ data: row, error: null }),
      }),
      update: (_data: unknown) => StubQueryBuilder.create(),
      upsert: async () => ({ data: null, error: null }),
      delete: () => StubQueryBuilder.create(),
    }),
    rpc: async () => ({ data: null, error: null }),
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
    }),
    removeChannel: () => {},
  };
}
