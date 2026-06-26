'use client';

import { useEffect, useRef, useState } from 'react';
import { isElectronMode } from '@/lib/supabase/electron-client';
import { useProjectStore, useScriptStore } from '@/lib/stores';
import { saveProjectToDisk } from '@/lib/local-files';

export function useAutoSave() {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const savingRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSave = async () => {
    if (!isElectronMode() || savingRef.current) return;
    
    const { currentProject } = useProjectStore.getState();
    const { scripts, elements } = useScriptStore.getState();
    
    if (!currentProject) return;

    savingRef.current = true;
    try {
      console.log('[auto-save] Saving project:', currentProject.id, currentProject.title);
      await saveProjectToDisk(currentProject, scripts, elements);
      setLastSaved(new Date());
      console.log('[auto-save] Project saved successfully');

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
  };

  useEffect(() => {
    if (!isElectronMode()) return;

    // Save immediately on first mount if there's a project
    const { currentProject } = useProjectStore.getState();
    if (currentProject) {
      triggerSave();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerSave();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Save on any script or project change (reduced delay to 1s for faster saves)
    const unsubScript = useScriptStore.subscribe(() => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(triggerSave, 1000);
    });

    const unsubProject = useProjectStore.subscribe(() => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(triggerSave, 1000);
    });

    let cleanupTick: (() => void) | undefined;
    if (window.electron?.onAutoSaveTick) {
      cleanupTick = window.electron.onAutoSaveTick(triggerSave);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubScript();
      unsubProject();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (cleanupTick) cleanupTick();
      triggerSave();
    };
  }, []);

  return { lastSaved };
}
