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
