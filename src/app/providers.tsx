'use client';

import { Toaster } from 'sonner';
import { ToastContainer } from '@/components/ui';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { BetaBanner } from '@/components/BetaBanner';
import { CommandPaletteProvider } from '@/components/ui/CommandPalette';
import { TranslationProvider } from '@/components/TranslationProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistration />
      <BetaBanner />
      <TranslationProvider>
        <CommandPaletteProvider>
          {children}
        </CommandPaletteProvider>
      </TranslationProvider>
      <ToastContainer />
      <Toaster position="bottom-right" theme="dark" richColors />
    </>
  );
}
