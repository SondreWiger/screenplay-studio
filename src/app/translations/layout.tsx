'use client';

import { AppHeader } from '@/components/AppHeader';

export default function TranslationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
