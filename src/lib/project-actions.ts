/**
 * Rename and delete for projects and scripts, shared by every place that
 * offers them (dashboard cards, project overview, project settings, script
 * editor) so they behave the same everywhere.
 *
 * Each write uses .select(): when row-level security blocks an update or
 * delete, PostgREST answers with no error and 0 rows, which must not be
 * reported as success.
 */

import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useScriptStore } from '@/lib/stores';
import { putCached, deleteCached } from '@/lib/offline/db';
import { isElectronMode } from '@/lib/supabase/electron-client';
import { removeProjectFromDisk } from '@/lib/local-files';
import { updateRecentProject } from '@/hooks/useRecentProjects';
import type { Project, Script } from '@/lib/types';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

const NOT_ALLOWED = {
  renameProject: 'Only the project owner or an admin can rename this project.',
  deleteProject: 'Only the person who created this project can delete it.',
  renameScript: 'You need write access to this project to rename scripts.',
  deleteScript: 'Only the project owner or an admin can delete scripts.',
};

export async function renameProject(projectId: string, rawTitle: string): Promise<ActionResult<Project>> {
  const title = rawTitle.trim();
  if (!title) return { ok: false, message: 'The project needs a name.' };
  const supabase = createClient();
  const { data, error } = await supabase.from('projects').update({ title }).eq('id', projectId).select('*');
  if (error) return { ok: false, message: 'Could not rename the project: ' + error.message };
  if (!data?.length) return { ok: false, message: NOT_ALLOWED.renameProject };
  const saved = data[0] as Project;
  applyProjectUpdate(saved);
  return { ok: true, data: saved };
}

/** Push a saved project row into the store and offline cache. */
export function applyProjectUpdate(saved: Project) {
  useProjectStore.setState((state) => ({
    projects: state.projects.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)),
    currentProject: state.currentProject?.id === saved.id ? { ...state.currentProject, ...saved } : state.currentProject,
  }));
  putCached('projects', saved as unknown as Record<string, unknown>).catch(() => {});
  if (saved.title) updateRecentProject(saved.id, { title: saved.title });
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const supabase = createClient();
  // Related rows (scripts, characters, scenes, …) cascade.
  const { data, error } = await supabase.from('projects').delete().eq('id', projectId).select('id');
  if (error) return { ok: false, message: 'Could not delete the project: ' + error.message };
  if (!data?.length) return { ok: false, message: NOT_ALLOWED.deleteProject };
  // Drop every local copy so the dashboard doesn't show it again
  useProjectStore.setState((state) => ({
    projects: state.projects.filter((p) => p.id !== projectId),
    currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
  }));
  deleteCached('projects', projectId).catch(() => {});
  if (isElectronMode()) removeProjectFromDisk(projectId).catch(() => {});
  updateRecentProject(projectId, 'deleted');
  return { ok: true, data: undefined };
}

export async function renameScript(scriptId: string, rawTitle: string): Promise<ActionResult<Script>> {
  const title = rawTitle.trim();
  if (!title) return { ok: false, message: 'The script needs a name.' };
  const supabase = createClient();
  const { data, error } = await supabase.from('scripts').update({ title }).eq('id', scriptId).select('*');
  if (error) return { ok: false, message: 'Could not rename the script: ' + error.message };
  if (!data?.length) return { ok: false, message: NOT_ALLOWED.renameScript };
  const saved = data[0] as Script;
  useScriptStore.setState((state) => ({
    scripts: state.scripts.map((s) => (s.id === saved.id ? { ...s, ...saved } : s)),
    currentScript: state.currentScript?.id === saved.id ? { ...state.currentScript, ...saved } : state.currentScript,
  }));
  putCached('scripts', saved as unknown as Record<string, unknown>).catch(() => {});
  return { ok: true, data: saved };
}

export async function deleteScript(scriptId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.from('scripts').delete().eq('id', scriptId).select('id');
  if (error) return { ok: false, message: 'Could not delete the script: ' + error.message };
  if (!data?.length) return { ok: false, message: NOT_ALLOWED.deleteScript };
  useScriptStore.setState((state) => ({ scripts: state.scripts.filter((s) => s.id !== scriptId) }));
  deleteCached('scripts', scriptId).catch(() => {});
  return { ok: true, data: undefined };
}
