'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isElectronMode } from '@/lib/supabase/electron-client';
import { isElectronMarketingPath } from '@/lib/electron-routes';

const MENU_EVENT = 'electron:menu-action';

export function ElectronShell() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isElectronMode()) return;

    // Default landing → workspace
    if (pathname === '/') {
      router.replace('/desktop-welcome');
      return;
    }

    // Keep marketing/public pages out of the app window
    if (isElectronMarketingPath(pathname)) {
      const url = `https://screenplaystudio.fun${pathname}${searchParams?.toString() ? `?${searchParams}` : ''}`;
      window.electron?.openExternal(url);
      router.replace('/dashboard');
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!isElectronMode() || !window.electron?.onMenuAction) return;

    return window.electron.onMenuAction((action) => {
      window.dispatchEvent(new CustomEvent(MENU_EVENT, { detail: action }));

      if (action === 'menu:new-project') {
        router.push('/dashboard?new=1');
        return;
      }

      if (action === 'menu:open-file') {
        const onScript = pathname.includes('/script');
        if (!onScript) {
          router.push(`${pathname.replace(/\/[^/]+$/, '/script')}`);
        }
      }
    });
  }, [pathname, router]);

  return null;
}

export { MENU_EVENT as ELECTRON_MENU_EVENT };
