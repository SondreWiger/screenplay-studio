'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type {
  Project, Script, ScriptElement, Character, Location,
  Scene, Shot, Idea, BudgetItem, ScheduleEvent, Comment,
  Profile, ProjectMember, UserPresence
} from '@/lib/types';

// ============================================================
// Auth Store
// ============================================================

interface AuthState {
  user: Profile | null;
  loading: boolean;
  setUser: (user: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    const supabase = createClient();
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
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });
    set({ projects: data || [], loading: false });
  },
  fetchProject: async (id: string) => {
    const supabase = createClient();
    set({ loading: true });
    const [projectRes, membersRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('project_members').select('*, profile:profiles(*)').eq('project_id', id),
    ]);
    set({
      currentProject: projectRes.data,
      members: membersRes.data || [],
      loading: false,
    });
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

export const useScriptStore = create<ScriptState>((set, get) => ({
  scripts: [],
  currentScript: null,
  elements: [],
  selectedElementId: null,
  loading: true,
  saving: false,
  setScripts: (scripts) => set({ scripts }),
  setCurrentScript: (script) => set({ currentScript: script }),
  setElements: (elements) => set({ elements }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setSaving: (saving) => set({ saving }),
  setLoading: (loading) => set({ loading }),

  fetchScripts: async (projectId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .order('version', { ascending: false });
    const scripts = data || [];
    set({ scripts });
    if (scripts.length > 0 && !get().currentScript) {
      const active = scripts.find((s) => s.is_active) || scripts[0];
      set({ currentScript: active });
    }
  },

  fetchElements: async (scriptId: string) => {
    const supabase = createClient();
    set({ loading: true });
    const { data } = await supabase
      .from('script_elements')
      .select('*')
      .eq('script_id', scriptId)
      .order('sort_order', { ascending: true });
    set({ elements: data || [], loading: false });
  },

  addElement: async (element) => {
    const supabase = createClient();
    set({ saving: true });
    const elements = get().elements;
    const maxOrder = elements.length > 0 ? Math.max(...elements.map((e) => e.sort_order)) : 0;
    const { data, error } = await supabase
      .from('script_elements')
      .insert({
        ...element,
        sort_order: element.sort_order ?? maxOrder + 1,
      })
      .select()
      .single();
    if (data && !error) {
      set({ elements: [...elements, data].sort((a, b) => a.sort_order - b.sort_order) });
    }
    set({ saving: false });
    return data;
  },

  updateElement: async (id, updates) => {
    const supabase = createClient();
    set({ saving: true });
    await supabase.from('script_elements').update(updates).eq('id', id);
    set({
      elements: get().elements.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      saving: false,
    });
  },

  deleteElement: async (id) => {
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
