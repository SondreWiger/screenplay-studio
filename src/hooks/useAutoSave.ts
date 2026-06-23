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
      await saveProjectToDisk(currentProject, scripts, elements);
      setLastSaved(new Date());

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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerSave();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const unsubScript = useScriptStore.subscribe(() => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(triggerSave, 3000);
    });

    const unsubProject = useProjectStore.subscribe(() => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(triggerSave, 3000);
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
