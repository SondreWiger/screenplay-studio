'use client';

/**
 * usePreMiD — Discord Rich Presence via PreMiD
 *
 * How it works:
 *   1. This hook writes `window.__PREMID_DATA__` whenever state changes.
 *   2. The PreMiD browser extension runs the presence/presence.ts script, which
 *      reads `window.__PREMID_DATA__` via `presence.getPageVariable()` and
 *      forwards it to the PreMiD desktop app → Discord.
 *   3. Users control what is shared from Settings → Preferences → Discord Presence.
 *
 * Privacy model:
 *   - premid_enabled:      master on/off         (default: true)
 *   - premid_show_project: show project name      (default: false — opt-in)
 *   - premid_show_tool:    show current tool name (default: true)
 *
 * Idle detection: 5 minutes of no mouse/keyboard activity → state = 'idle'.
 * Tab hidden → immediately idle.
 */

import { useEffect, useRef } from 'react';

const WINDOW_KEY = '__PREMID_DATA__';
const IDLE_MS = 5 * 60 * 1000; // 5 minutes

export type PreMiDState = 'editing' | 'viewing' | 'idle';

export interface PreMiDData {
  /** Current activity state */
  state: PreMiDState;
  /** Project name — null if user has not consented to sharing it */
  project: string | null;
  /** Human-readable tool label, e.g. "Script Editor", "Corkboard" */
  tool: string | null;
  /** Unix timestamp (seconds) when the current session started */
  startTimestamp: number;
}

function readConsent(): { premidEnabled: boolean; showProject: boolean; showTool: boolean } {
  try {
    return {
      premidEnabled: localStorage.getItem('premid_enabled') !== 'false',
      showProject: localStorage.getItem('premid_show_project') === 'true',
      showTool: localStorage.getItem('premid_show_tool') !== 'false',
    };
  } catch {
    return { premidEnabled: true, showProject: false, showTool: true };
  }
}

function clearPreMiD() {
  if (typeof window !== 'undefined') {
    try { delete (window as unknown as Record<string, unknown>)[WINDOW_KEY]; } catch {}
  }
}

export interface UsePreMiDOptions {
  /** Name of the current project. Shown only if user has opted in. */
  projectName?: string | null;
  /** Human-readable label for the current tool / page. */
  currentTool?: string | null;
  /** Set to false to suspend updates (e.g. on non-project pages). */
  active?: boolean;
}

export function usePreMiD({ projectName, currentTool, active = true }: UsePreMiDOptions) {
  // Use refs so the idle callback / visibility handler always has fresh values
  const projectNameRef  = useRef(projectName);
  const currentToolRef  = useRef(currentTool);
  const activeRef       = useRef(active);
  const isIdleRef       = useRef(false);
  const idleTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // One stable timestamp for the session — reset when the hook remounts
  const startTimestamp  = useRef(Math.floor(Date.now() / 1000));

  // Keep refs in sync with latest props without re-triggering the effect
  useEffect(() => { projectNameRef.current  = projectName;  }, [projectName]);
  useEffect(() => { currentToolRef.current  = currentTool;  }, [currentTool]);
  useEffect(() => { activeRef.current       = active;       }, [active]);

  // Write the window variable based on current state
  const writeData = (idle: boolean) => {
    if (typeof window === 'undefined') return;

    const { premidEnabled, showProject, showTool } = readConsent();

    if (!premidEnabled || !activeRef.current) {
      clearPreMiD();
      return;
    }

    const data: PreMiDData = {
      state:          idle ? 'idle' : 'editing',
      project:        showProject && projectNameRef.current ? projectNameRef.current : null,
      tool:           showTool && currentToolRef.current ? currentToolRef.current : null,
      startTimestamp: startTimestamp.current,
    };

    (window as unknown as Record<string, unknown>)[WINDOW_KEY] = data;
  };

  // Reset the idle timer and un-idle if currently idle
  const resetIdle = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    if (isIdleRef.current) {
      isIdleRef.current = false;
      writeData(false);
    }

    idleTimerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      writeData(true);
    }, IDLE_MS);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!active) { clearPreMiD(); return; }

    startTimestamp.current = Math.floor(Date.now() / 1000);
    isIdleRef.current = false;

    writeData(false);
    resetIdle();

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const;
    activityEvents.forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));

    const handleVisibility = () => {
      if (document.hidden) {
        isIdleRef.current = true;
        writeData(true);
      } else {
        isIdleRef.current = false;
        writeData(false);
        resetIdle();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Re-write whenever localStorage settings change (cross-tab or same-tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('premid_')) writeData(isIdleRef.current);
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetIdle));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
      clearPreMiD();
    };
    // Only the active flag re-triggers setup; projectName/currentTool go via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // When project name or tool changes, just refresh the window data (no timer reset)
  useEffect(() => {
    if (!isIdleRef.current) writeData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, currentTool]);
}
