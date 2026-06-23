'use client';

import { useEffect, useRef } from 'react';
import { ELECTRON_MENU_EVENT } from '@/components/ElectronShell';

type MenuAction = 'menu:new-project' | 'menu:open-file' | 'menu:save' | 'menu:save-as';

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
