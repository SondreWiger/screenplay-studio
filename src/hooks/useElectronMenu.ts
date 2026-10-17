'use client';

import { useEffect, useRef } from 'react';
import { ELECTRON_MENU_EVENT } from '@/components/ElectronShell';
import type { DesktopMenuAction as MenuAction } from '@/types/electron';

export function useElectronMenu(handlers: Partial<Record<MenuAction, () => void>>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handler = (e: Event) => {
      const action = (e as CustomEvent<MenuAction>).detail;
      handlersRef.current[action]?.();
    };
    window.addEventListener(ELECTRON_MENU_EVENT, handler);
    return () => window.removeEventListener(ELECTRON_MENU_EVENT, handler);
  }, []);
}
