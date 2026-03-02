'use client';

import { ToastContainer } from '@/components/ui';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { BetaBanner } from '@/components/BetaBanner';
import { CommandPaletteProvider } from '@/components/ui/CommandPalette';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistration />
      <BetaBanner />
      <CommandPaletteProvider>
        {children}
      </CommandPaletteProvider>
      <ToastContainer />
    </>
  );
}
