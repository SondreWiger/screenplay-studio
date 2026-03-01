'use client';

import { ToastContainer } from '@/components/ui';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { BetaBanner } from '@/components/BetaBanner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistration />
      <BetaBanner />
      {children}
      <ToastContainer />
    </>
  );
}
