'use client';

import { useEffect, useRef, useState } from 'react';
import { isElectronMode } from '@/lib/supabase/electron-client';
import { useProjectStore, useScriptStore } from '@/lib/stores';
import { saveProjectToDisk } from '@/lib/local-files';

/**
 * Auto-save hook for Electron mode.
 *
 * Listens for `auto-save-tick` events from the main process (every 30s)
 * and persists the current project + scripts + elements to disk.
 *
 * Returns `lastSaved` — the Date of the last successful save, or null.
 */
export function useAutoSave() {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isElectronMode() || !window.electron?.onAutoSaveTick) return;

    const cleanup = window.electron.onAutoSaveTick(async () => {
      if (savingRef.current) return; // Skip if already saving

      const { currentProject } = useProjectStore.getState();
      const { scripts, elements } = useScriptStore.getState();

      if (!currentProject) return;

      savingRef.current = true;
      try {
        await saveProjectToDisk(currentProject, scripts, elements);
        setLastSaved(new Date());

        // Also track as recent project
        if (window.electron?.addRecentProject) {
          window.electron.addRecentProject({
            id: currentProject.id,
            title: currentProject.title || 'Untitled',
          });
        }
      } catch (err) {
        console.error('[auto-save] Failed to save:', err);
      } finally {
        savingRef.current = false;
      }
    });

    return cleanup;
  }, []);

  return { lastSaved };
}
