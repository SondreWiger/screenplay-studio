'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ss_recent_projects';
const MAX_ENTRIES = 8;

export interface RecentProject {
  id: string;
  title: string;
  cover_url?: string | null;
  project_type?: string;
  viewed_at: string; // ISO date string
}

function readStorage(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentProject[];
  } catch {
    return [];
  }
}

/** Synchronously read recent projects from localStorage (for use outside a hook context). */
export function getRecentProjects(): RecentProject[] {
  if (typeof window === 'undefined') return [];
  return readStorage();
}

const CHANGED_EVENT = 'ss-recent-projects-changed';

function writeStorage(items: RecentProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

/** Keep the "recently viewed" list in step after a rename or delete. */
export function updateRecentProject(id: string, change: { title: string } | 'deleted') {
  if (typeof window === 'undefined') return;
  const items = readStorage();
  const next = change === 'deleted'
    ? items.filter((p) => p.id !== id)
    : items.map((p) => (p.id === id ? { ...p, title: change.title } : p));
  writeStorage(next);
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function useRecentProjects() {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    setRecentProjects(readStorage());
    const reload = () => setRecentProjects(readStorage());
    window.addEventListener(CHANGED_EVENT, reload);
    return () => window.removeEventListener(CHANGED_EVENT, reload);
  }, []);

  const recordView = useCallback((project: Omit<RecentProject, 'viewed_at'>) => {
    setRecentProjects(prev => {
      // Remove existing entry for this project (de-dup)
      const filtered = prev.filter(p => p.id !== project.id);
      const next: RecentProject[] = [
        { ...project, viewed_at: new Date().toISOString() },
        ...filtered,
      ].slice(0, MAX_ENTRIES);
      writeStorage(next);
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    writeStorage([]);
    setRecentProjects([]);
  }, []);

  return { recentProjects, recordView, clearRecent };
}
