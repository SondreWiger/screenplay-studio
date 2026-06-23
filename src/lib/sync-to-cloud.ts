/**
 * Sync local IndexedDB projects to cloud when user logs in.
 *
 * When a user creates projects offline (without an account), those are
 * stored in IndexedDB. When they sign in, this function finds any projects
 * that haven't been synced yet and pushes them to Supabase.
 */

import { createClient } from '@/lib/supabase/client';
import {
  getCachedProjects,
  getCachedByProject,
  getCachedByScript,
  putCached,
  type Row,
} from '@/lib/offline/db';
import { isElectronMode } from '@/lib/supabase/electron-client';
import { listLocalProjects, loadProjectFromDisk } from '@/lib/local-files';

const SYNCED_KEY = 'ss-synced-project-ids';

function getSyncedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(SYNCED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function markSynced(id: string): void {
  const ids = getSyncedIds();
  ids.add(id);
  try {
    localStorage.setItem(SYNCED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

/**
 * Find all local-only projects (not yet synced to cloud) and push them.
 * Returns the number of projects synced.
 */
export async function syncLocalProjectsToCloud(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return 0;

  const syncedIds = getSyncedIds();
  const localProjects = await getCachedProjects();

  let synced = 0;

  for (const proj of localProjects) {
    const projectId = proj.id as string;

    // Skip already-synced projects
    if (syncedIds.has(projectId)) continue;

    // Check if this project already exists in Supabase
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (existing) {
      // Already in cloud, just mark as synced
      markSynced(projectId);
      continue;
    }

    // Push project metadata to Supabase
    const projectData = {
      id: projectId,
      title: proj.title as string,
      logline: (proj.logline as string) || null,
      format: (proj.format as string) || 'feature',
      genre: (proj.genre as string[]) || [],
      script_type: (proj.script_type as string) || 'screenplay',
      project_type: (proj.project_type as string) || 'film',
      created_by: user.id,
      created_at: (proj.created_at as string) || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: projectError } = await supabase
      .from('projects')
      .upsert(projectData, { onConflict: 'id' });

    if (projectError) {
      console.error('Failed to sync project:', projectId, projectError);
      continue;
    }

    // Push scripts for this project
    const scripts = await getCachedByProject('scripts', projectId);
    for (const script of scripts) {
      const { error: scriptError } = await supabase
        .from('scripts')
        .upsert(script, { onConflict: 'id' });
      if (scriptError) {
        console.error('Failed to sync script:', script.id, scriptError);
        continue;
      }

      // Push script elements
      const elements = await getCachedByScript(script.id as string);
      if (elements.length > 0) {
        // Batch upsert in chunks of 100
        for (let i = 0; i < elements.length; i += 100) {
          const batch = elements.slice(i, i + 100);
          const { error: elemError } = await supabase
            .from('script_elements')
            .upsert(batch, { onConflict: 'id' });
          if (elemError) {
            console.error('Failed to sync script elements:', elemError);
          }
        }
      }
    }

    // Push other project data (characters, scenes, etc.)
    const otherStores = ['characters', 'scenes', 'locations', 'shots', 'ideas', 'budget_items', 'production_schedule'] as const;
    for (const store of otherStores) {
      const rows = await getCachedByProject(store, projectId);
      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100);
          await supabase.from(store).upsert(batch, { onConflict: 'id' });
        }
      }
    }

    markSynced(projectId);
    synced++;
  }

  return synced;
}

/**
 * Find online projects that were cached to disk and have newer local edits.
 * Merges them back to Supabase. Handles basic conflict resolution (latest wins).
 */
export async function syncDiskProjectsToCloud(): Promise<number> {
  if (!isElectronMode()) return 0;
  
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return 0;

  const localProjects = await listLocalProjects();
  let synced = 0;

  for (const proj of localProjects) {
    const projectId = proj.id;
    if (!projectId) continue;

    // We only care about projects the user actually owns/has access to online
    const { data: cloudProject, error } = await supabase
      .from('projects')
      .select('updated_at')
      .eq('id', projectId)
      .single();

    if (error || !cloudProject) continue;

    const localUpdatedAt = proj.updated_at || proj.created_at || '';
    const cloudUpdatedAt = cloudProject.updated_at || '';

    if (localUpdatedAt > cloudUpdatedAt) {
      // Local disk version is strictly newer (offline edits). Push to cloud.
      const diskData = await loadProjectFromDisk(projectId as string);
      if (!diskData) continue;

      console.log(`[Sync] Local project ${projectId} is newer. Syncing to cloud...`);

      // Push project
      await supabase.from('projects').upsert(diskData.project, { onConflict: 'id' });

      // Push scripts
      if (diskData.scripts) {
        for (const script of diskData.scripts) {
          await supabase.from('scripts').upsert(script, { onConflict: 'id' });
        }
      }

      // Push elements in batches
      if (diskData.elements && diskData.elements.length > 0) {
        for (let i = 0; i < diskData.elements.length; i += 100) {
          const batch = diskData.elements.slice(i, i + 100);
          await supabase.from('script_elements').upsert(batch, { onConflict: 'id' });
        }
      }
      synced++;
    } else if (localUpdatedAt < cloudUpdatedAt && window.electron) {
      // Cloud is newer (edited on another device).
      // Backup the local file just in case it had split-brain edits, before auto-save overwrites it.
      const diskData = await loadProjectFromDisk(projectId as string);
      if (diskData) {
        try {
          const basePath = await window.electron.getDocumentsDir();
          const backupName = `project_backup_${localUpdatedAt.replace(/[:.]/g, '-')}.json`;
          await window.electron.writeFile(
            `${basePath}/ScreenplayStudio/projects/${projectId}/${backupName}`,
            JSON.stringify(diskData, null, 2)
          );
          console.log(`[Sync] Cloud project ${projectId} is newer. Created local backup: ${backupName}`);
        } catch (e) {
          console.error('[Sync] Failed to backup old local project', e);
        }
      }
    }
  }

  return synced;
}
