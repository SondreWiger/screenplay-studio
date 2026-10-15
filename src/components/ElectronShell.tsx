'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, RotateCw, X } from 'lucide-react';
import { isElectronMode } from '@/lib/supabase/electron-client';
import { isElectronMarketingPath } from '@/lib/electron-routes';
import { DESKTOP_TOGGLE_SIDEBAR_EVENT } from '@/lib/desktop/events';
import type { DesktopMenuAction, DesktopUpdateStatus } from '@/types/electron';

const MENU_EVENT = 'electron:menu-action';

/** Replay a shortcut the page already listens for (e.g. ⌘/ for shortcuts). */
function dispatchShortcut(key: string) {
  const mac = window.electron?.platform === 'darwin';
  document.dispatchEvent(new KeyboardEvent('keydown', { key, metaKey: mac, ctrlKey: !mac, bubbles: true }));
}

/**
 * The bridge between the desktop app's native shell and the web app: menu
 * commands, files opened from Finder or Explorer, navigation requested by the
 * menu bar, and the update banner. Renders nothing outside the desktop app.
 */
export function ElectronShell() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [update, setUpdate] = useState<DesktopUpdateStatus | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!isElectronMode()) return;
    // Keep marketing/public pages out of the app window.
    if (isElectronMarketingPath(pathname)) {
      const url = `https://screenplaystudio.fun${pathname}${searchParams?.toString() ? `?${searchParams}` : ''}`;
      window.electron?.openExternal(url);
      router.replace('/dashboard');
    }
  }, [pathname, router, searchParams]);

  const openFile = useCallback(async (filePath?: string) => {
    const { importDesktopFile, chooseAndImportFile } = await import('@/lib/desktop/import-file');
    try {
      const result = filePath ? await importDesktopFile(filePath) : await chooseAndImportFile();
      if (!result) return;
      toast.success(result.alreadyExisted ? `Opened “${result.title}”` : `“${result.title}” is ready`);
      router.push(`/projects/${result.projectId}/script`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t open that file.');
    }
  }, [router]);

  // Menu commands.
  useEffect(() => {
    if (!isElectronMode() || !window.electron?.onMenuAction) return;
    return window.electron.onMenuAction((action: DesktopMenuAction) => {
      // Pages that handle a command themselves (the editor's Save) listen here.
      window.dispatchEvent(new CustomEvent(MENU_EVENT, { detail: action }));

      switch (action) {
        case 'menu:new-project':
          if (pathRef.current === '/dashboard') dispatchShortcut('n');
          else router.push('/dashboard?new=1');
          break;
        case 'menu:open-file':
          void openFile();
          break;
        case 'menu:toggle-sidebar':
          window.dispatchEvent(new CustomEvent(DESKTOP_TOGGLE_SIDEBAR_EVENT));
          break;
        case 'menu:shortcuts':
          dispatchShortcut('/');
          break;
      }
    });
  }, [router, openFile]);

  // Navigation requested by the menu bar or dock menu.
  useEffect(() => {
    if (!isElectronMode() || !window.electron?.onNavigate) return;
    return window.electron.onNavigate((path) => router.push(path));
  }, [router]);

  // Files double-clicked in Finder/Explorer, including any that launched the app.
  useEffect(() => {
    if (!isElectronMode()) return;
    const off = window.electron?.onExternalFileOpen?.((filePath) => { void openFile(filePath); });
    window.electron?.takePendingFiles?.().then((files) => {
      for (const file of files) void openFile(file);
    }).catch(() => {});
    return off;
  }, [openFile]);

  // Background updates.
  useEffect(() => {
    if (!isElectronMode() || !window.electron?.onUpdateStatus) return;
    window.electron.getUpdateStatus?.().then(setUpdate).catch(() => {});
    return window.electron.onUpdateStatus(setUpdate);
  }, []);

  if (!update || update.state !== 'ready' || dismissedVersion === update.version) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        role="status"
        className="fixed bottom-4 left-4 z-[90] flex max-w-sm items-center gap-3 rounded-2xl border border-surface-700/70 bg-surface-900/95 py-2.5 pl-3 pr-2 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
          <Download className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">Update ready</p>
          <p className="truncate text-[11px] text-surface-400">Version {update.version} installs when you restart.</p>
        </div>
        <button
          onClick={() => window.electron?.installUpdate?.()}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-500"
        >
          <RotateCw className="h-3.5 w-3.5" /> Restart
        </button>
        <button
          onClick={() => setDismissedVersion(update.version)}
          className="rounded-lg p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-white"
          aria-label="Later"
          title="Later — it installs next time you quit"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export { MENU_EVENT as ELECTRON_MENU_EVENT };
