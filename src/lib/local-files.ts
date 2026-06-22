/**
 * Local project storage for Electron mode.
 * Projects are stored on disk in a visible file structure:
 *   ~/ScreenplayStudio/
 *     projects/
 *       {project-id}/
 *         project.json          — metadata
 *         scripts/
 *           {script-id}.json    — script + elements
 *         characters.json
 *         scenes.json
 *         ...
 */

import { isElectronMode } from '@/lib/supabase/electron-client';
import type { Project, Script, ScriptElement } from '@/lib/types';

const PROJECTS_DIR = 'ScreenplayStudio/projects';

// ── Electron file system helpers ───────────────────────────────

async function getBasePath(): Promise<string | null> {
  if (!window.electron) return null;
  const platform = await window.electron.getPlatform();
  const home = platform === 'darwin'
    ? process.env.HOME || '/Users/user'
    : platform === 'win32'
      ? process.env.USERPROFILE || 'C:\\Users\\user'
      : process.env.HOME || '/home/user';
  return `${home}/${PROJECTS_DIR}`;
}

async function ensureDir(path: string): Promise<void> {
  // Electron doesn't have mkdir via IPC yet; we rely on writeFile creating parent dirs
  // This is a no-op for now; real implementation would use IPC
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
  // In a real implementation, we'd list directories
  // For now, return empty — the IndexedDB layer handles listing
  return [];
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
