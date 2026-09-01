'use client';

import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';

/**
 * The two codes a Pro subscription hands you for the other apps.
 *
 * The codes are minted server side the first time this loads, which is what
 * makes the bundle retroactive: a subscriber from before any of this existed
 * opens billing and their codes are simply there.
 */

type Code = {
  product: 'cinderra' | 'castingcall';
  code: string;
  expiresAt: string;
  redeemedAt: string | null;
  app: { name: string; url: string; blurb: string };
};

export function BundleCodes() {
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/bundle/codes')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setCodes(data.pro ? data.codes : []);
      })
      .catch(() => !cancelled && setError('Could not load your codes just now.'));

    return () => {
      cancelled = true;
    };
  }, []);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      // Clipboard can be blocked; the code is selectable on screen anyway.
    }
  };

  if (error) {
    return (
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Your other apps</h2>
        <p className="text-sm text-red-400">{error}</p>
      </Card>
    );
  }

  // Nothing to show a free account, and nothing to flash while loading.
  if (!codes || codes.length === 0) return null;

  return (
    <Card className="p-6 mb-6">
      <div className="mb-1 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-white">Included with your subscription</h2>
      </div>
      <p className="mb-5 text-sm text-surface-400">
        Pro covers all three apps. Paste a code into the app it names and it unlocks straight away, no card needed.
        Each code works once.
      </p>

      <div className="space-y-3">
        {codes.map((entry) => (
          <div
            key={entry.product}
            className="rounded-xl border border-surface-700 bg-surface-800/60 p-4"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-white">{entry.app.name}</div>
                <div className="text-sm text-surface-400">{entry.app.blurb}</div>
              </div>
              {entry.redeemedAt ? (
                <span className="shrink-0 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                  Redeemed
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                  Ready to use
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded-lg bg-surface-900 px-3 py-2 font-mono text-sm tracking-wider text-white">
                {entry.code}
              </code>
              <Button variant="secondary" onClick={() => copy(entry.code)}>
                {copied === entry.code ? 'Copied' : 'Copy'}
              </Button>
              <a href={entry.app.url} target="_blank" rel="noreferrer">
                <Button variant="primary">Open {entry.app.name}</Button>
              </a>
            </div>

            <p className="mt-2 text-xs text-surface-500">
              Valid until {new Date(entry.expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}. A fresh code
              is issued when your subscription renews.
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
