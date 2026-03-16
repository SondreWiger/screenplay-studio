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

function writeStorage(items: RecentProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function useRecentProjects() {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    setRecentProjects(readStorage());
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
