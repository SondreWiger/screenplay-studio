'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import { clearLocalUser, isLocalMode, isElectronMode } from '@/lib/supabase/electron-client';
import { loadProjectFromDisk, listLocalProjects } from '@/lib/local-files';
import { putCached, deleteCached, cacheRows, getCachedProjects, getCachedByProject, getCachedByScript, getCachedById, pendingSyncCount } from '@/lib/offline/db';
import { offlineUpsert, offlineDelete, offlineUpsertMany } from '@/lib/offline/sync';
import logger from '@/lib/logger';
import type {
  Project, Script, ScriptElement, Character, Location,
  Scene, Shot, Idea, BudgetItem, ScheduleEvent, Comment,
  Profile, ProjectMember, UserPresence, Notification
} from '@/lib/types';

// Auth Store

interface AuthState {
  user: Profile | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  signOut: () => Promise<void>;
}

/**
 * Profiles are refetched on several auth events (sign-in, tab refocus, token
 * refresh). Swapping in a new object with identical contents would re-run every
 * effect that depends on `user`, so identical profiles keep the old reference.
 */
function sameProfile(a: Profile | null, b: Profile | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,
  setUser: (user) => { if (!sameProfile(get().user, user)) set({ user }); },
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  signOut: async () => {
    try { sessionStorage.removeItem('ss_session_active'); } catch { }
    if (isLocalMode()) {
      clearLocalUser();
    } else {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    set({ user: null });
  },
}));

// Project Store

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  members: ProjectMember[];
  loading: boolean;
  error: string | null;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  setMembers: (members: ProjectMember[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  members: [],
  loading: true,
  error: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),
  setMembers: (members) => set({ members }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      let diskProjects: Project[] = [];
      if (isElectronMode()) {
        diskProjects = await listLocalProjects();
      }

      if (isLocalMode() || !navigator.onLine) {
        const idbProjects = await getCachedProjects() as unknown as Project[];
        const merged = new Map<string, Project>();
        for (const p of diskProjects) merged.set(p.id, p);
        for (const p of idbProjects) {
          const existing = merged.get(p.id);
          if (!existing || (p.updated_at || p.created_at || '') > (existing.updated_at || existing.created_at || '')) {
            merged.set(p.id, p);
          }
        }
        set({
          projects: Array.from(merged.values()).sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')),
          loading: false
        });
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) { set({ projects: diskProjects, loading: false }); return; }

      const { data: memberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);
      const memberProjectIds = (memberships || []).map((m: { project_id: string }) => m.project_id);

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .or(`created_by.eq.${user.id}${memberProjectIds.length ? `,id.in.(${memberProjectIds.join(',')})` : ''}`)
        .order('updated_at', { ascending: false });
      if (error || data === null) throw error || new Error('fetch failed');

      const merged = new Map<string, Project>();
      for (const p of diskProjects) merged.set(p.id, p);
      for (const p of data) {
        const existing = merged.get(p.id);
        if (!existing || (p.updated_at || p.created_at || '') > (existing.updated_at || existing.created_at || '')) {
          merged.set(p.id, p);
        }
      }

      set({
        projects: Array.from(merged.values()).sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')),
        loading: false
      });
    } catch {
      // Network error — fall back to cache
      try {
        let diskProjects: Project[] = [];
        if (isElectronMode()) {
          diskProjects = await listLocalProjects();
        }
        const idbProjects = await getCachedProjects() as unknown as Project[];
        const merged = new Map<string, Project>();
        for (const p of diskProjects) merged.set(p.id, p);
        for (const p of idbProjects) {
          const existing = merged.get(p.id);
          if (!existing || (p.updated_at || p.created_at || '') > (existing.updated_at || existing.created_at || '')) {
            merged.set(p.id, p);
          }
        }
        set({
          projects: Array.from(merged.values()).sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')),
          loading: false
        });
      } catch {
        set({ projects: [], loading: false, error: 'Failed to load projects' });
      }
    }
  },
  fetchProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      if (isLocalMode() || !navigator.onLine) {
        if (isElectronMode()) {
          const diskData = await loadProjectFromDisk(id);
          if (diskData) {
            set({ currentProject: diskData.project, members: [], loading: false });
            return;
          }
        }
        const project = await getCachedById('projects', id);
        set({ currentProject: (project as unknown as Project) || null, members: [], loading: false });
        return;
      }
      const supabase = createClient();
      const [projectRes, membersRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('project_members').select('*, profile:profiles!user_id(*)').eq('project_id', id),
      ]);
      if (projectRes.error || !projectRes.data) throw projectRes.error || new Error('fetch failed');
      set({
        currentProject: projectRes.data,
        members: membersRes.data || [],
        loading: false,
      });
    } catch {
      // Network error — fall back to cache
      try {
        if (isElectronMode()) {
          const diskData = await loadProjectFromDisk(id);
          if (diskData) {
            set({ currentProject: diskData.project, members: [], loading: false });
            return;
          }
        }
        const project = await getCachedById('projects', id);
        set({ currentProject: (project as unknown as Project) || null, members: [], loading: false });
      } catch {
        set({ currentProject: null, members: [], loading: false, error: 'Failed to load project' });
      }
    }
  },
}));

// Script Store

interface ScriptState {
  scripts: Script[];
  currentScript: Script | null;
  elements: ScriptElement[];
  selectedElementId: string | null;
  loading: boolean;
  saving: boolean;
  _isInitialLoad: boolean;
  // Undo / Redo
  _undoStack: ScriptElement[][];
  _redoStack: ScriptElement[][];
  _lastHistoryPush: number;
  pushHistory: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  setScripts: (scripts: Script[]) => void;
  setCurrentScript: (script: Script | null) => void;
  setElements: (elements: ScriptElement[]) => void;
  setSelectedElementId: (id: string | null) => void;
  setSaving: (saving: boolean) => void;
  setLoading: (loading: boolean) => void;
  /** Project the loaded `scripts` belong to. */
  scriptsProjectId: string | null;
  /**
   * Load a project's scripts. Repeat calls for the already-loaded project are
   * no-ops unless `force` is set; a forced refresh updates the list in place
   * without clearing the open script or its elements.
   */
  fetchScripts: (projectId: string, opts?: { force?: boolean }) => Promise<void>;
  fetchElements: (scriptId: string) => Promise<void>;
  addElement: (element: Partial<ScriptElement>) => Promise<ScriptElement | null>;
  updateElement: (id: string, updates: Partial<ScriptElement>) => Promise<void>;
  deleteElement: (id: string) => Promise<void>;
  reorderElements: (elements: ScriptElement[]) => Promise<void>;
}

/**
 * Persist the difference between two element snapshots (undo/redo/reorder).
 * Only rows that changed are written, in one batch, and rows missing from the
 * new snapshot are deleted — undoing an "add line" must remove it remotely too.
 */
async function syncSnapshotDiff(prev: ScriptElement[], next: ScriptElement[]) {
  const before = new Map(prev.map((e) => [e.id, e]));
  const changed = next.filter((e) => before.get(e.id) !== e);
  const nextIds = new Set(next.map((e) => e.id));
  const removed = prev.filter((e) => !nextIds.has(e.id)).map((e) => e.id);

  if (isLocalMode()) {
    await cacheRows('script_elements', changed as unknown as Record<string, unknown>[]);
    for (const id of removed) await deleteCached('script_elements', id);
    return;
  }
  await offlineUpsertMany('script_elements', changed as unknown as Record<string, unknown>[]);
  for (const id of removed) await offlineDelete('script_elements', id);
}

/**
 * The project whose scripts were most recently requested.
 *
 * `fetchScripts` has four independent sources (Supabase, Electron disk, the
 * offline cache, and the cache fallback after a network error) and they resolve
 * at very different speeds. Opening project A, then B, then A again can land the
 * responses out of order, leaving `currentScript` pointing at one project while
 * the editor shows another's elements. Every write checks this first and drops
 * results that belong to a project the user has already navigated away from.
 */
let latestScriptsRequest: string | null = null;
let inflightScripts: { projectId: string; promise: Promise<void> } | null = null;

/** Picks which draft to open: the one last opened, else the active one, else the newest. */
function pickActiveScript(projectId: string, scripts: Script[]): Script | null {
  if (scripts.length === 0) return null;
  let savedId: string | null = null;
  try { savedId = localStorage.getItem(`ss-active-script-${projectId}`); } catch { /* ssr */ }
  return (savedId ? scripts.find((s) => s.id === savedId) : null)
    ?? scripts.find((s) => s.is_active)
    ?? scripts[0];
}

export const useScriptStore = create<ScriptState>((set, get) => ({
  scripts: [],
  scriptsProjectId: null,
  currentScript: null,
  elements: [],
  selectedElementId: null,
  loading: true,
  saving: false,
  _isInitialLoad: false,
  _undoStack: [],
  _redoStack: [],
  _lastHistoryPush: 0,

  pushHistory: () => {
    const { elements, _undoStack } = get();
    // Elements are immutable (every update replaces the object), so the array
    // itself is a safe snapshot. Copying every row per keystroke was O(n).
    set({ _undoStack: [..._undoStack.slice(-49), elements], _redoStack: [], _lastHistoryPush: Date.now() });
  },

  undo: async () => {
    const { elements, _undoStack, _redoStack, currentScript } = get();
    if (_undoStack.length === 0) return;
    const previous = _undoStack[_undoStack.length - 1];
    set({
      elements: previous,
      _undoStack: _undoStack.slice(0, -1),
      _redoStack: [..._redoStack.slice(-49), elements],
    });
    if (currentScript) syncSnapshotDiff(elements, previous);
  },

  redo: async () => {
    const { elements, _undoStack, _redoStack, currentScript } = get();
    if (_redoStack.length === 0) return;
    const next = _redoStack[_redoStack.length - 1];
    set({
      elements: next,
      _undoStack: [..._undoStack.slice(-49), elements],
      _redoStack: _redoStack.slice(0, -1),
    });
    if (currentScript) syncSnapshotDiff(elements, next);
  },

  setScripts: (scripts) => set({ scripts }),
  setCurrentScript: (script) => {
    set({ currentScript: script });
    if (script) {
      try { localStorage.setItem(`ss-active-script-${script.project_id}`, script.id); } catch { }
    }
  },
  setElements: (elements) => set({ elements }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setSaving: (saving) => set({ saving }),
  setLoading: (loading) => set({ loading }),

  fetchScripts: async (projectId: string, opts?: { force?: boolean }) => {
    if (inflightScripts?.projectId === projectId) return inflightScripts.promise;
    if (!opts?.force && get().scriptsProjectId === projectId) return;

    // Claim this request so slower in-flight fetches for other projects know
    // they have been superseded and must not write their results.
    latestScriptsRequest = projectId;
    const switching = get().scriptsProjectId !== projectId;
    if (switching) {
      // Clear immediately so stale data from a previous project is never shown.
      // Flag prevents autosave from writing empty data during load.
      set({ currentScript: null, elements: [], scripts: [], scriptsProjectId: null, _undoStack: [], _redoStack: [], _isInitialLoad: true });
    }

    const apply = (scripts: Script[]) => {
      if (latestScriptsRequest !== projectId) return;
      const current = get().currentScript;
      // Refreshing the same project: keep the open script if it still exists.
      const keep = !switching && current ? scripts.find((s) => s.id === current.id) : null;
      const active = keep ?? pickActiveScript(projectId, scripts);
      set(active
        ? { scripts, scriptsProjectId: projectId, currentScript: active }
        : { scripts, scriptsProjectId: projectId, currentScript: null, elements: [] });
    };

    const loadLocal = async (): Promise<Script[]> => {
      if (isElectronMode()) {
        const diskData = await loadProjectFromDisk(projectId);
        if (diskData?.scripts) return [...diskData.scripts];
      }
      return await getCachedByProject('scripts', projectId) as unknown as Script[];
    };
    const byVersion = (list: Script[]) => list.sort((a, b) => (b.version || 0) - (a.version || 0));

    const run = async () => {
      try {
        if (isLocalMode() || !navigator.onLine) {
          apply(byVersion(await loadLocal()));
          return;
        }
        const supabase = createClient();
        const { data, error } = await supabase
          .from('scripts')
          .select('*')
          .eq('project_id', projectId)
          .order('version', { ascending: false });
        if (error || data === null) throw error || new Error('fetch failed');
        apply((data || []) as Script[]);
      } catch {
        // Network error — fall back to cache
        try {
          apply(byVersion(await loadLocal()));
        } catch {
          logger.error('ScriptStore', 'Error fetching scripts (cache fallback failed)');
          if (switching && latestScriptsRequest === projectId) set({ scripts: [] });
        }
      }
    };

    const promise = run().finally(() => {
      if (inflightScripts?.promise === promise) inflightScripts = null;
    });
    inflightScripts = { projectId, promise };
    return promise;
  },

  fetchElements: async (scriptId: string) => {
    set({ loading: true, _isInitialLoad: true });
    try {
      if (isLocalMode() || !navigator.onLine) {
        if (isElectronMode()) {
          const currentProject = useProjectStore.getState().currentProject;
          if (currentProject) {
            const diskData = await loadProjectFromDisk(currentProject.id);
            if (diskData?.elements) {
              const elements = diskData.elements.filter(e => e.script_id === scriptId);
              elements.sort((a, b) => a.sort_order - b.sort_order);
              set({ elements, loading: false, _isInitialLoad: false });
              return;
            }
          }
        }
        const elements = await getCachedByScript(scriptId) as unknown as ScriptElement[];
        elements.sort((a, b) => a.sort_order - b.sort_order);
        set({ elements, loading: false, _isInitialLoad: false });
        return;
      }
      const supabase = createClient();
      const allElements: any[] = [];
      let from = 0;
      const PAGE_SIZE = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('script_elements')
          .select('*')
          .eq('script_id', scriptId)
          .order('sort_order', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
          
        if (error || data === null) throw error || new Error('fetch failed');
        allElements.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      
      set({ elements: allElements, loading: false, _isInitialLoad: false });
    } catch {
      // Network error — fall back to cache
      try {
        if (isElectronMode()) {
          const currentProject = useProjectStore.getState().currentProject;
          if (currentProject) {
            const diskData = await loadProjectFromDisk(currentProject.id);
            if (diskData?.elements) {
              const elements = diskData.elements.filter(e => e.script_id === scriptId);
              elements.sort((a, b) => a.sort_order - b.sort_order);
              set({ elements, loading: false, _isInitialLoad: false });
              return;
            }
          }
        }
        const elements = await getCachedByScript(scriptId) as unknown as ScriptElement[];
        elements.sort((a, b) => a.sort_order - b.sort_order);
        set({ elements, loading: false, _isInitialLoad: false });
      } catch {
        logger.error('ScriptStore', 'Error fetching elements (cache fallback failed)');
        set({ elements: [], loading: false, _isInitialLoad: false });
      }
    }
  },

  addElement: async (element) => {
    get().pushHistory();
    set({ saving: true });
    const elements = get().elements;
    const maxOrder = elements.length > 0 ? Math.max(...elements.map((e) => e.sort_order)) : 0;
    const insertData = {
      ...element,
      sort_order: element.sort_order ?? maxOrder + 1,
    };

    const newElement = { ...insertData, id: insertData.id || crypto.randomUUID() } as ScriptElement;

    // Show the line immediately so the editor can focus it on the same frame
    // as the Enter key. Waiting for the IndexedDB write first left a gap in
    // which fast typing landed in the previous line.
    set({ elements: [...get().elements, newElement].sort((a, b) => a.sort_order - b.sort_order) });

    if (isLocalMode()) {
      await putCached('script_elements', newElement as unknown as Record<string, unknown>);
    } else {
      // Cloud mode: offline-first — write locally, enqueue sync, try remote
      await offlineUpsert('script_elements', newElement as unknown as Record<string, unknown>);
    }
    set({ saving: false });
    return newElement;
  },

  updateElement: async (id, updates) => {
    const { _lastHistoryPush } = get();
    // Always snapshot before type changes; snapshot content changes every ≥2 s
    if ('element_type' in updates || Date.now() - _lastHistoryPush > 2000) {
      get().pushHistory();
    }
    // Optimistic update — apply immediately, then persist
    set({
      elements: get().elements.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      saving: true,
    });

    const updated = get().elements.find((e) => e.id === id);
    if (!updated) { set({ saving: false }); return; }

    if (isLocalMode()) {
      await putCached('script_elements', updated as unknown as Record<string, unknown>);
      set({ saving: false });
      return;
    }

    // Cloud mode: offline-first
    await offlineUpsert('script_elements', updated as unknown as Record<string, unknown>);
    set({ saving: false });
  },

  deleteElement: async (id) => {
    get().pushHistory();

    if (isLocalMode()) {
      await deleteCached('script_elements', id);
      set({ elements: get().elements.filter((e) => e.id !== id) });
      return;
    }

    // Cloud mode: offline-first
    await offlineDelete('script_elements', id);
    set({ elements: get().elements.filter((e) => e.id !== id) });
  },

  reorderElements: async (elements) => {
    const prev = get().elements;
    // Renumber, keeping the object identity of rows whose position didn't change
    // so only moved rows are written.
    const renumbered = elements.map((el, i) => (el.sort_order === i ? el : { ...el, sort_order: i }));
    set({ elements: renumbered, saving: true });
    await syncSnapshotDiff(prev, renumbered);
    set({ saving: false });
  },
}));

// Presence Store (Real-time collaboration)

interface PresenceState {
  onlineUsers: UserPresence[];
  setOnlineUsers: (users: UserPresence[]) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: [],
  setOnlineUsers: (users) => set({ onlineUsers: users }),
}));

// Notification Store

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  setNotifications: (notifications: Notification[]) => void;
  setUnreadCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addNotification: (n: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: true,
  setNotifications: (notifications) => set({ notifications }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setLoading: (loading) => set({ loading }),
  addNotification: (n) => {
    const existing = get().notifications;
    if (existing.some((e) => e.id === n.id)) return;
    set({
      notifications: [n, ...existing],
      unreadCount: get().unreadCount + (n.read ? 0 : 1),
    });
    // Trigger device notification if service worker is active
    if (!n.read && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.active && Notification.permission === 'granted') {
          reg.showNotification(n.title, {
            body: n.body || undefined,
            icon: '/icon-192',
            badge: '/icon-192',
            tag: `notif-${n.id}`,
            data: { url: n.link || '/notifications' },
          });
        }
      }).catch((err) => console.debug('Service worker notification failed (expected in some contexts):', err));
    }
  },
  fetchNotifications: async () => {
    if (!navigator.onLine) { set({ loading: false }); return; }
    const supabase = createClient();
    set({ loading: true });
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*, actor:profiles!notifications_actor_id_fkey(*)')
        .order('created_at', { ascending: false })
        .limit(100);
      const notifications = (data || []) as Notification[];
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
  markAsRead: async (id) => {
    const supabase = createClient();
    set({
      notifications: get().notifications.map((n) => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, get().unreadCount - (get().notifications.find((n) => n.id === id && !n.read) ? 1 : 0)),
    });
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  },
  markAllAsRead: async () => {
    const supabase = createClient();
    set({
      notifications: get().notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    });
    await supabase.from('notifications').update({ read: true }).eq('read', false);
  },
  deleteNotification: async (id) => {
    const supabase = createClient();
    const n = get().notifications.find((n) => n.id === id);
    set({
      notifications: get().notifications.filter((n) => n.id !== id),
      unreadCount: Math.max(0, get().unreadCount - (n && !n.read ? 1 : 0)),
    });
    await supabase.from('notifications').delete().eq('id', id);
  },
}));

// Theme Store
import type { AppTheme, ThemeColors } from '@/lib/theme';
import { DEFAULT_THEME, applyTheme, clearTheme } from '@/lib/theme';

const THEME_STORAGE_KEY = 'ss-custom-theme';

interface ThemeStore {
  theme: AppTheme;
  isCustom: boolean;
  editorOpen: boolean;
  setTheme: (theme: AppTheme) => void;
  updateColor: (key: keyof ThemeColors, value: string) => void;
  resetTheme: () => void;
  setEditorOpen: (open: boolean) => void;
  loadSaved: () => void;
  saveToStorage: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: DEFAULT_THEME,
  isCustom: false,
  editorOpen: false,

  setTheme: (theme) => {
    set({ theme, isCustom: true });
    applyTheme(theme);
    get().saveToStorage();
  },

  updateColor: (key, value) => {
    const current = get().theme;
    const updated: AppTheme = {
      ...current,
      colors: { ...current.colors, [key]: value },
    };
    set({ theme: updated, isCustom: true });
    applyTheme(updated);
    get().saveToStorage();
  },

  resetTheme: () => {
    set({ theme: DEFAULT_THEME, isCustom: false });
    clearTheme();
    localStorage.removeItem(THEME_STORAGE_KEY);
  },

  setEditorOpen: (open) => set({ editorOpen: open }),

  loadSaved: () => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) {
        const theme = JSON.parse(saved) as AppTheme;
        if (theme.colors && typeof theme.colors.bgBase === 'string') {
          set({ theme, isCustom: true });
          applyTheme(theme);
        }
      }
    } catch { /* ignore */ }
  },

  saveToStorage: () => {
    const { theme } = get();
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  },
}));
