'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useBroadcastSync } from '@/hooks/useBroadcastSync';

// ── PopoutButton ─────────────────────────────────────────────
// Renders a small icon button that opens the current page in a
// chrome-free popout window (?popout=1). Designed to sit in a
// page header or sidebar footer.

interface PopoutButtonProps {
  projectId: string;
  pageLabel?: string;
  className?: string;
}

export function PopoutButton({ projectId, pageLabel, className }: PopoutButtonProps) {
  const pathname = usePathname();

  const handlePopout = useCallback(() => {
    const url = `${pathname}?popout=1`;
    // Try to place the window on screen 2 by using a large left offset.
    // If they only have one screen it just opens offset from left edge.
    const w = 1280, h = 900;
    const left = window.screen.availWidth + 60;
    const top = 40;
    window.open(
      url,
      `ss-popout-${projectId}-${pathname}`,
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );
  }, [pathname, projectId]);

  return (
    <button
      onClick={handlePopout}
      title={`Pop out ${pageLabel || 'this page'} to a second screen`}
      className={`flex items-center justify-center rounded-lg text-surface-500 hover:text-white hover:bg-surface-800 transition-all ${className ?? 'p-1.5'}`}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </button>
  );
}

// ── PopoutBar ────────────────────────────────────────────────
// Thin bar shown at the bottom of a popout window showing the
// project name, current page, sync status, and a close button.

interface PopoutBarProps {
  projectId: string;
  projectTitle: string;
  pageLabel: string;
}

export function PopoutBar({ projectId, projectTitle, pageLabel }: PopoutBarProps) {
  const [synced, setSynced] = useState(false);
  const [peerCount, setPeerCount] = useState(0);

  const { broadcast } = useBroadcastSync({
    projectId,
    onEvent: (event) => {
      if (event.type === 'ping') {
        setSynced(true);
        setPeerCount((n) => n + 1);
        // Reply so the main window knows we're here
        broadcast({ type: 'pong', payload: { windowId: event.payload.windowId } });
        // Auto-reset synced indicator after 3s inactivity
        const timer = setTimeout(() => setSynced(false), 3000);
        return () => clearTimeout(timer);
      }
      if (event.type === 'pong') {
        setSynced(true);
      }
      if (event.type === 'navigate') {
        setSynced(true);
      }
    },
  });

  // Announce ourselves on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      broadcast({ type: 'ping', payload: { windowId: 'popout' } });
    }, 500);
    return () => clearTimeout(timer);
  }, [broadcast]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-xs select-none"
      style={{
        background: 'rgba(7,7,16,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Left — project + page */}
      <div className="flex items-center gap-2 text-surface-500">
        <span className="font-bold text-[#FF5F1F]">S</span>
        <span className="text-surface-700">/</span>
        <span className="truncate max-w-[200px] font-medium text-surface-400">{projectTitle}</span>
        <span className="text-surface-700">/</span>
        <span className="text-surface-300 font-semibold">{pageLabel}</span>
      </div>

      {/* Center — sync status */}
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full transition-colors ${synced ? 'bg-green-400' : 'bg-surface-700'}`} />
        <span className={`font-medium transition-colors ${synced ? 'text-green-400' : 'text-surface-600'}`}>
          {synced ? 'Synced' : 'Standalone'}
        </span>
        {peerCount > 0 && (
          <span className="text-surface-600 ml-1">· {peerCount} window{peerCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Right — close */}
      <button
        onClick={() => window.close()}
        title="Close popout window"
        className="flex items-center gap-1 px-2 py-1 rounded text-surface-600 hover:text-white hover:bg-surface-800 transition-all"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span>Close</span>
      </button>
    </div>
  );
}
