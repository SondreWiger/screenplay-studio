'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import { clearLocalUser, isLocalOrElectron } from '@/lib/supabase/electron-client';
import { putCached, deleteCached, getCachedProjects, getCachedByProject, getCachedByScript, getCachedById, pendingSyncCount } from '@/lib/offline/db';
import { offlineUpsert, offlineDelete } from '@/lib/offline/sync';
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  signOut: async () => {
    try { sessionStorage.removeItem('ss_session_active'); } catch {}
    if (isLocalOrElectron()) {
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
      if (isLocalOrElectron()) {
        const projects = await getCachedProjects();
        set({ projects: projects as unknown as Project[], loading: false });
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) { set({ projects: [], loading: false }); return; }

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
      set({ projects: data || [], loading: false });
    } catch {
      // Network error — fall back to IndexedDB cache
      try {
        const projects = await getCachedProjects();
        set({ projects: projects as unknown as Project[], loading: false });
      } catch {
        set({ projects: [], loading: false, error: 'Failed to load projects' });
      }
    }
  },
  fetchProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      if (isLocalOrElectron()) {
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
      // Network error — fall back to IndexedDB cache
      try {
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
  fetchScripts: (projectId: string) => Promise<void>;
  fetchElements: (scriptId: string) => Promise<void>;
  addElement: (element: Partial<ScriptElement>) => Promise<ScriptElement | null>;
  updateElement: (id: string, updates: Partial<ScriptElement>) => Promise<void>;
  deleteElement: (id: string) => Promise<void>;
  reorderElements: (elements: ScriptElement[]) => Promise<void>;
}

// Sync a full snapshot of elements to Supabase (or IndexedDB in local mode)
async function syncSnapshotToDB(snapshot: ScriptElement[], scriptId: string) {
  if (isLocalOrElectron()) {
    // In local mode, just write all elements to IndexedDB
    for (const el of snapshot) {
      await putCached('script_elements', el as unknown as Record<string, unknown>);
    }
    return;
  }
  // Cloud mode: offline-first — write locally, enqueue sync, try remote
  for (const el of snapshot) {
    await offlineUpsert('script_elements', el as unknown as Record<string, unknown>);
  }
}

export const useScriptStore = create<ScriptState>((set, get) => ({
  scripts: [],
  currentScript: null,
  elements: [],
  selectedElementId: null,
  loading: true,
  saving: false,
  _undoStack: [],
  _redoStack: [],
  _lastHistoryPush: 0,

  pushHistory: () => {
    const { elements, _undoStack } = get();
    const snapshot = elements.map((e) => ({ ...e }));
    set({ _undoStack: [..._undoStack.slice(-49), snapshot], _redoStack: [], _lastHistoryPush: Date.now() });
  },

  undo: async () => {
    const { elements, _undoStack, _redoStack, currentScript } = get();
    if (_undoStack.length === 0) return;
    const previous = _undoStack[_undoStack.length - 1];
    const current = elements.map((e) => ({ ...e }));
    set({
      elements: previous,
      _undoStack: _undoStack.slice(0, -1),
      _redoStack: [..._redoStack.slice(-49), current],
    });
    if (currentScript) syncSnapshotToDB(previous, currentScript.id);
  },

  redo: async () => {
    const { elements, _undoStack, _redoStack, currentScript } = get();
    if (_redoStack.length === 0) return;
    const next = _redoStack[_redoStack.length - 1];
    const current = elements.map((e) => ({ ...e }));
    set({
      elements: next,
      _undoStack: [..._undoStack.slice(-49), current],
      _redoStack: _redoStack.slice(0, -1),
    });
    if (currentScript) syncSnapshotToDB(next, currentScript.id);
  },

  setScripts: (scripts) => set({ scripts }),
  setCurrentScript: (script) => set({ currentScript: script }),
  setElements: (elements) => set({ elements }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setSaving: (saving) => set({ saving }),
  setLoading: (loading) => set({ loading }),

  fetchScripts: async (projectId: string) => {
    // Clear immediately so stale data from a previous project is never shown.
    set({ currentScript: null, elements: [], scripts: [], _undoStack: [], _redoStack: [] });
    try {
      if (isLocalOrElectron()) {
        const scripts = await getCachedByProject('scripts', projectId) as unknown as Script[];
        scripts.sort((a, b) => (b.version || 0) - (a.version || 0));
        set({ scripts });
        if (scripts.length > 0) {
          const active = scripts.find((s) => s.is_active) || scripts[0];
          set({ currentScript: active });
        }
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false });
      if (error || data === null) throw error || new Error('fetch failed');
      const scripts = data || [];
      set({ scripts });
      if (scripts.length > 0) {
        const active = scripts.find((s) => s.is_active) || scripts[0];
        set({ currentScript: active });
      } else {
        set({ currentScript: null, elements: [] });
      }
    } catch {
      // Network error — fall back to IndexedDB cache
      try {
        const scripts = await getCachedByProject('scripts', projectId) as unknown as Script[];
        scripts.sort((a, b) => (b.version || 0) - (a.version || 0));
        set({ scripts });
        if (scripts.length > 0) {
          const active = scripts.find((s) => s.is_active) || scripts[0];
          set({ currentScript: active });
        }
      } catch {
        logger.error('ScriptStore', 'Error fetching scripts (cache fallback failed)');
        set({ scripts: [] });
      }
    }
  },

  fetchElements: async (scriptId: string) => {
    set({ loading: true });
    try {
      if (isLocalOrElectron()) {
        const elements = await getCachedByScript(scriptId) as unknown as ScriptElement[];
        elements.sort((a, b) => a.sort_order - b.sort_order);
        set({ elements, loading: false });
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from('script_elements')
        .select('*')
        .eq('script_id', scriptId)
        .order('sort_order', { ascending: true });
      if (error || data === null) throw error || new Error('fetch failed');
      set({ elements: data || [], loading: false });
    } catch {
      // Network error — fall back to IndexedDB cache
      try {
        const elements = await getCachedByScript(scriptId) as unknown as ScriptElement[];
        elements.sort((a, b) => a.sort_order - b.sort_order);
        set({ elements, loading: false });
      } catch {
        logger.error('ScriptStore', 'Error fetching elements (cache fallback failed)');
        set({ elements: [], loading: false });
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

    if (isLocalOrElectron()) {
      await putCached('script_elements', newElement as unknown as Record<string, unknown>);
      set({ elements: [...get().elements, newElement].sort((a, b) => a.sort_order - b.sort_order), saving: false });
      return newElement;
    }

    // Cloud mode: offline-first — write locally, enqueue sync, try remote
    await offlineUpsert('script_elements', newElement as unknown as Record<string, unknown>);
    set({ elements: [...get().elements, newElement].sort((a, b) => a.sort_order - b.sort_order), saving: false });
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

    if (isLocalOrElectron()) {
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

    if (isLocalOrElectron()) {
      await deleteCached('script_elements', id);
      set({ elements: get().elements.filter((e) => e.id !== id) });
      return;
    }

    // Cloud mode: offline-first
    await offlineDelete('script_elements', id);
    set({ elements: get().elements.filter((e) => e.id !== id) });
  },

  reorderElements: async (elements) => {
    set({ elements, saving: true });

    if (isLocalOrElectron()) {
      for (const el of elements) {
        await putCached('script_elements', { ...el, sort_order: elements.indexOf(el) } as unknown as Record<string, unknown>);
      }
      set({ saving: false });
      return;
    }

    // Cloud mode: offline-first
    for (let i = 0; i < elements.length; i++) {
      const el = { ...elements[i], sort_order: i };
      await offlineUpsert('script_elements', el as unknown as Record<string, unknown>);
    }
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
