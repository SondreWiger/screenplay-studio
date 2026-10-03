'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

/** The shell's topbar slot element, shared through context once mounted. */
export const ShellSlotContext = createContext<{ slot: HTMLElement | null; inShell: boolean }>({ slot: null, inShell: false });

export function useInShell() {
  return useContext(ShellSlotContext).inShell;
}

/**
 * Render page or area actions (buttons, links) into the app shell's topbar.
 * Outside the shell it renders nothing, so it is safe in any page.
 */
export function ShellActions({ children }: { children: ReactNode }) {
  const { slot } = useContext(ShellSlotContext);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !slot) return null;
  return createPortal(<div className="flex items-center gap-2">{children}</div>, slot);
}

/** "← Label" link in the shell topbar, for detail pages that belong to a list. */
export function ShellBack({ href, label }: { href: string; label: string }) {
  return (
    <ShellActions>
      <Link href={href} className="rounded-xl border border-surface-800 px-3 py-1.5 text-xs font-semibold text-surface-300 transition-colors hover:text-white">
        ← {label}
      </Link>
    </ShellActions>
  );
}
