'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'ss_beta_banner_dismissed_v1';

/**
 * A dismissible full-width beta disclaimer banner shown at the very top
 * of the screen. Persists dismissal in localStorage so it only appears once
 * per browser.
 */
export function BetaBanner() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setVisible(false);
  };

  // Don't show on public share pages — they have their own minimal chrome
  if (pathname?.startsWith('/share/')) return null;

  if (!visible) return null;

  return (
    <div className="relative z-50 bg-surface-950 border-b border-surface-800">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start">
          {/* Beta badge */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-brand-500/20 text-brand-400 border border-brand-500/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            Beta
          </span>
          <p className="text-xs text-surface-300 leading-snug">
            <span className="font-semibold text-white">Screenplay Studio is in early access.</span>
            {' '}Some features are still being refined — your feedback directly shapes what ships next.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/feedback"
            className="text-xs font-medium text-brand-500 hover:text-brand-400 transition-colors underline underline-offset-2"
          >
            Report a bug
          </Link>
          <button
            onClick={dismiss}
            className="p-1 rounded-md text-surface-500 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss beta notice"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
