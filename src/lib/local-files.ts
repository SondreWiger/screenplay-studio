/**
 * Local project storage for Electron mode.
 * Projects are stored on disk in a visible file structure:
 *   ~/ScreenplayStudio/projects/{project-id}/project.json
 */

import { isElectronMode } from '@/lib/supabase/electron-client';
import type { Project, Script, ScriptElement } from '@/lib/types';

const PROJECTS_DIR = 'ScreenplayStudio/projects';

let cachedDocumentsDir: string | null = null;

export async function getBasePath(): Promise<string | null> {
  if (!window.electron) return null;
  if (!cachedDocumentsDir) {
    cachedDocumentsDir = await window.electron.getDocumentsDir();
  }
  return `${cachedDocumentsDir}/${PROJECTS_DIR}`;
}

// ── Project file operations ────────────────────────────────────

export async function saveProjectToDisk(
  project: Project,
  scripts: Script[],
  elements: ScriptElement[]
): Promise<void> {
  if (!window.electron) return;
  const basePath = await getBasePath();
  if (!basePath) return;

  const projectDir = `${basePath}/${project.id}`;
  const data = {
    project,
    scripts,
    elements,
    savedAt: new Date().toISOString(),
    version: 1,
  };

  await window.electron.writeFile(
    `${projectDir}/project.json`,
    JSON.stringify(data, null, 2)
  );
}

export async function loadProjectFromDisk(
  projectId: string
): Promise<{ project: Project; scripts: Script[]; elements: ScriptElement[] } | null> {
  if (!window.electron) return null;
  const basePath = await getBasePath();
  if (!basePath) return null;

  try {
    const content = await window.electron.readFile(`${basePath}/${projectId}/project.json`);
    const data = JSON.parse(content);
    return {
      project: data.project,
      scripts: data.scripts || [],
      elements: data.elements || [],
    };
  } catch {
    return null;
  }
}

export async function listLocalProjects(): Promise<Project[]> {
  if (!window.electron) return [];
  const basePath = await getBasePath();
  if (!basePath) return [];

  const projectIds = await window.electron.listDir(basePath);
  const projects: Project[] = [];

  for (const id of projectIds) {
    const loaded = await loadProjectFromDisk(id);
    if (loaded?.project) projects.push(loaded.project);
  }

  return projects.sort((a, b) => {
    const aTime = a.updated_at || a.created_at || '';
    const bTime = b.updated_at || b.created_at || '';
    return bTime.localeCompare(aTime);
  });
}

export async function saveScriptToDisk(
  projectId: string,
  script: Script,
  elements: ScriptElement[]
): Promise<void> {
  if (!window.electron) return;
  const basePath = await getBasePath();
  if (!basePath) return;

  const data = { script, elements, savedAt: new Date().toISOString() };
  await window.electron.writeFile(
    `${basePath}/${projectId}/scripts/${script.id}.json`,
    JSON.stringify(data, null, 2)
  );
}

// ── Last-used file path caching (for Cmd+S without dialog) ────

const LAST_PATH_KEY = 'ss-electron-last-save-path';

export function getCachedSavePath(projectId: string): string | null {
  try {
    const cached = localStorage.getItem(LAST_PATH_KEY);
    if (!cached) return null;
    const map = JSON.parse(cached) as Record<string, string>;
    return map[projectId] || null;
  } catch {
    return null;
  }
}

export function setCachedSavePath(projectId: string, filePath: string): void {
  try {
    const cached = localStorage.getItem(LAST_PATH_KEY);
    const map = cached ? JSON.parse(cached) : {};
    map[projectId] = filePath;
    localStorage.setItem(LAST_PATH_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
