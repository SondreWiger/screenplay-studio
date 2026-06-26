'use client';

import { Suspense, useEffect } from 'react';
import { Toaster } from 'sonner';
import { ToastContainer } from '@/components/ui';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { BetaBanner } from '@/components/BetaBanner';
import { CommandPaletteProvider } from '@/components/ui/CommandPalette';
import { TranslationProvider } from '@/components/TranslationProvider';
import { ThemeEditor } from '@/components/ThemeEditor';
import { ConnectionToast } from '@/components/ConnectionToast';
import { ElectronShell } from '@/components/ElectronShell';
import { useThemeStore } from '@/lib/stores';

function ThemeLoader() {
  const loadSaved = useThemeStore((s) => s.loadSaved);
  useEffect(() => { 
    loadSaved(); 
    try {
      let accent = null;
      let uiTheme = null;
      if (typeof window !== 'undefined' && (window as any).electron?.getPreferenceSync) {
        accent = (window as any).electron.getPreferenceSync('ss-accent-color');
        uiTheme = (window as any).electron.getPreferenceSync('ss-ui-theme');
      }
      if (!accent) accent = localStorage.getItem('ss-accent-color');
      if (!uiTheme) uiTheme = localStorage.getItem('ss-ui-theme');
      
      if (accent) document.documentElement.setAttribute('data-accent', accent);
      if (uiTheme) document.documentElement.setAttribute('data-theme', uiTheme);
    } catch {}
  }, [loadSaved]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeLoader />
      <ServiceWorkerRegistration />
      <BetaBanner />
      <Suspense fallback={null}>
        <ElectronShell />
      </Suspense>
      <TranslationProvider>
        <CommandPaletteProvider>
          {children}
        </CommandPaletteProvider>
      </TranslationProvider>
      <ThemeEditor />
      <ConnectionToast />
      <ToastContainer />
      <Toaster position="bottom-right" theme="dark" richColors />
    </>
  );
}
