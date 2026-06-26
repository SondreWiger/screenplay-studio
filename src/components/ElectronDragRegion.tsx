'use client';

import { useEffect, useState } from 'react';
import { isElectronMode } from '@/lib/supabase/electron-client';

export function ElectronDragRegion() {
  const [isMacElectron, setIsMacElectron] = useState(false);

  useEffect(() => {
    async function checkPlatform() {
      if (isElectronMode() && window.electron) {
        const platform = await window.electron.getPlatform();
        if (platform === 'darwin') {
          setIsMacElectron(true);
          document.body.classList.add('is-mac-electron');
        }
      }
    }
    checkPlatform();
  }, []);

  if (!isMacElectron) return null;

  return null;
}
