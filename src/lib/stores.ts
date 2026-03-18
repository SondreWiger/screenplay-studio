'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type {
  Project, Script, ScriptElement, Character, Location,
  Scene, Shot, Idea, BudgetItem, ScheduleEvent, Comment,
  Profile, ProjectMember, UserPresence, Notification
} from '@/lib/types';

// ============================================================
// Auth Store
// ============================================================

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
    const supabase = createClient();
    try { sessionStorage.removeItem('ss_session_active'); } catch {}
    await supabase.auth.signOut();
    set({ user: null });
  },
}));

// ============================================================
// Project Store
// ============================================================

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  members: ProjectMember[];
  loading: boolean;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  setMembers: (members: ProjectMember[]) => void;
  setLoading: (loading: boolean) => void;
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  members: [],
  loading: true,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),
  setMembers: (members) => set({ members }),
  setLoading: (loading) => set({ loading }),
  fetchProjects: async () => {
    const supabase = createClient();
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) { set({ projects: [], loading: false }); return; }

      // Get projects where user is a member
      const { data: memberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);
      const memberProjectIds = (memberships || []).map((m: { project_id: string }) => m.project_id);

      const { data } = await supabase
        .from('projects')
        .select('*')
        .or(`created_by.eq.${user.id}${memberProjectIds.length ? `,id.in.(${memberProjectIds.join(',')})` : ''}`)
        .order('updated_at', { ascending: false });
      set({ projects: data || [], loading: false });
    } catch (err) {
      console.error('Error fetching projects:', err);
      set({ projects: [], loading: false });
    }
  },
  fetchProject: async (id: string) => {
    const supabase = createClient();
    set({ loading: true });
    try {
      const [projectRes, membersRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('project_members').select('*, profile:profiles!user_id(*)').eq('project_id', id),
      ]);
      set({
        currentProject: projectRes.data,
        members: membersRes.data || [],
        loading: false,
      });
    } catch (err) {
      console.error('Error fetching project:', err);
      set({ currentProject: null, members: [], loading: false });
    }
  },
}));

// ============================================================
// Script Store
// ============================================================

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

// ── Sync a full snapshot of elements to Supabase ────────────────────────────
async function syncSnapshotToDB(snapshot: ScriptElement[], scriptId: string) {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from('script_elements').select('id').eq('script_id', scriptId);
  const currentIds = new Set((rows ?? []).map((r: { id: string }) => r.id));
  const snapshotIds = new Set(snapshot.map((e) => e.id));
  const toDelete = Array.from(currentIds).filter((id) => !snapshotIds.has(id));
  if (toDelete.length > 0) {
    await supabase.from('script_elements').delete().in('id', toDelete);
  }
  for (let i = 0; i < snapshot.length; i += 100) {
    await supabase.from('script_elements').upsert(snapshot.slice(i, i + 100));
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
    const supabase = createClient();
    // Clear immediately so stale data from a previous project is never shown.
    set({ currentScript: null, elements: [], scripts: [], _undoStack: [], _redoStack: [] });
    try {
      const { data } = await supabase
        .from('scripts')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false });
      const scripts = data || [];
      set({ scripts });
      if (scripts.length > 0) {
        const active = scripts.find((s) => s.is_active) || scripts[0];
        set({ currentScript: active });
      } else {
        set({ currentScript: null, elements: [] });
      }
    } catch (err) {
      console.error('Error fetching scripts:', err);
      set({ scripts: [] });
    }
  },

  fetchElements: async (scriptId: string) => {
    const supabase = createClient();
    set({ loading: true });
    try {
      const { data } = await supabase
        .from('script_elements')
        .select('*')
        .eq('script_id', scriptId)
        .order('sort_order', { ascending: true });
      set({ elements: data || [], loading: false });
    } catch (err) {
      console.error('Error fetching elements:', err);
      set({ elements: [], loading: false });
    }
  },

  addElement: async (element) => {
    get().pushHistory();
    const supabase = createClient();
    set({ saving: true });
    const elements = get().elements;
    const maxOrder = elements.length > 0 ? Math.max(...elements.map((e) => e.sort_order)) : 0;
    const insertData = {
      ...element,
      sort_order: element.sort_order ?? maxOrder + 1,
    };
    const { data, error } = await supabase
      .from('script_elements')
      .insert(insertData)
      .select()
      .single();
    if (error) {
      console.error('[addElement] Supabase error:', error.message, error.details, error.hint);
    }
    if (data && !error) {
      set({ elements: [...get().elements, data].sort((a, b) => a.sort_order - b.sort_order) });
    }
    set({ saving: false });
    return data ?? null;
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
    const supabase = createClient();
    await supabase.from('script_elements').update(updates).eq('id', id);
    set({ saving: false });
  },

  deleteElement: async (id) => {
    get().pushHistory();
    const supabase = createClient();
    await supabase.from('script_elements').delete().eq('id', id);
    set({ elements: get().elements.filter((e) => e.id !== id) });
  },

  reorderElements: async (elements) => {
    const supabase = createClient();
    set({ elements, saving: true });
    const updates = elements.map((e, i) => ({
      id: e.id,
      sort_order: i,
    }));
    for (const u of updates) {
      await supabase.from('script_elements').update({ sort_order: u.sort_order }).eq('id', u.id);
    }
    set({ saving: false });
  },
}));

// ============================================================
// Presence Store (Real-time collaboration)
// ============================================================

interface PresenceState {
  onlineUsers: UserPresence[];
  setOnlineUsers: (users: UserPresence[]) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: [],
  setOnlineUsers: (users) => set({ onlineUsers: users }),
}));

// ============================================================
// Notification Store
// ============================================================

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
      }).catch(() => {});
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
