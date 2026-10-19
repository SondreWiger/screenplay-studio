'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';

/**
 * One Cinderra board in an iframe.
 *
 * Asks /api/cinderra/embed for a URL on every mount. The URL carries a
 * one-time sign-in, so it cannot be cached or reused: a remount, a retry or a
 * "need-token" message from the frame all fetch a new one.
 *
 * The frame talks back with postMessage (Cinderra's src/lib/embed.js):
 *   ready       the board has loaded, hide our spinner
 *   title       the board was renamed inside the frame
 *   need-token  its session is gone (sessionStorage cleared, token spent);
 *               hand it a fresh URL
 * Messages are only accepted from the origin of the URL we loaded.
 */

/** The user's accent, as "r,g,b", so the board matches the app around it. */
function currentAccent() {
  if (typeof window === 'undefined') return null;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim();
  const parts = raw.split(/[\s,]+/).filter(Boolean).slice(0, 3);
  return parts.length === 3 && parts.every((p) => /^\d{1,3}$/.test(p)) ? parts.join(',') : null;
}

export function CinderraFrame({
  boardRowId,
  title,
  onTitle,
  className,
}: {
  boardRowId: string;
  title: string;
  onTitle?: (title: string) => void;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const originRef = useRef<string | null>(null);
  const retries = useRef(0);
  const onTitleRef = useRef(onTitle);
  onTitleRef.current = onTitle;

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const res = await fetch('/api/cinderra/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: boardRowId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error || 'Could not open this board');

      const url = new URL(json.url);
      const accent = currentAccent();
      if (accent) url.searchParams.set('accent', accent);
      originRef.current = url.origin;
      setSrc(url.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open this board');
      setPhase('error');
    }
  }, [boardRowId]);

  useEffect(() => {
    retries.current = 0;
    setSrc(null);
    load();
  }, [load]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!originRef.current || e.origin !== originRef.current) return;
      const data = e.data as { source?: string; type?: string; title?: string } | null;
      if (!data || data.source !== 'cinderra') return;
      if (data.type === 'ready') {
        retries.current = 0;
        setPhase('ready');
      } else if (data.type === 'title' && typeof data.title === 'string') {
        onTitleRef.current?.(data.title);
      } else if (data.type === 'need-token') {
        if (retries.current >= 2) {
          setError('Cinderra could not sign you in to this board.');
          setPhase('error');
          return;
        }
        retries.current += 1;
        load();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [load]);

  // A frame that never says "ready" (blocked, offline, an old Cinderra) would
  // otherwise spin forever. After a while, show it anyway: whatever it has
  // rendered is more useful than our spinner.
  useEffect(() => {
    if (phase !== 'loading' || !src) return;
    const t = setTimeout(() => setPhase((p) => (p === 'loading' ? 'ready' : p)), 12000);
    return () => clearTimeout(t);
  }, [phase, src]);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-surface-950 ${className ?? ''}`}>
      {src && (
        <iframe
          key={src}
          src={src}
          title={`${title} — Cinderra board`}
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-300 ${phase === 'ready' ? 'opacity-100' : 'opacity-0'}`}
          allow="clipboard-read; clipboard-write; fullscreen; microphone"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}

      {phase === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-surface-400">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
          <p className="text-sm">Opening {title}…</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-white">Couldn&apos;t open this board</p>
            <p className="mt-1 text-sm text-surface-400">{error}</p>
            <button
              type="button"
              onClick={() => { retries.current = 0; load(); }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-surface-800 px-3 py-2 text-sm font-medium text-white hover:bg-surface-700"
            >
              <RotateCw className="h-4 w-4" /> Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
