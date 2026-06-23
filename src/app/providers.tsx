'use client';

import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { ToastContainer } from '@/components/ui';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { BetaBanner } from '@/components/BetaBanner';
import { CommandPaletteProvider } from '@/components/ui/CommandPalette';
import { TranslationProvider } from '@/components/TranslationProvider';
import { ThemeEditor } from '@/components/ThemeEditor';
import { useThemeStore } from '@/lib/stores';

function ThemeLoader() {
  const loadSaved = useThemeStore((s) => s.loadSaved);
  useEffect(() => { loadSaved(); }, [loadSaved]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeLoader />
      <ServiceWorkerRegistration />
      <BetaBanner />
      <TranslationProvider>
        <CommandPaletteProvider>
          {children}
        </CommandPaletteProvider>
      </TranslationProvider>
      <ThemeEditor />
      <ToastContainer />
      <Toaster position="bottom-right" theme="dark" richColors />
    </>
  );
}
