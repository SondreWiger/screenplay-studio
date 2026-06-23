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
        }
      }
    }
    checkPlatform();
  }, []);

  if (!isMacElectron) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '32px',
        WebkitAppRegion: 'drag',
        zIndex: 9999,
        pointerEvents: 'none',
      } as React.CSSProperties}
    />
  );
}
