'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { normalizeDraftCode } from '@/lib/scripts/drafts';

type LookupResult = {
  code: string;
  printed_at: string;
  script_title: string;
  project_title: string;
  element_count: number;
  word_count: number;
  is_current: boolean | null;
  script_deleted: boolean;
  member: boolean;
  // Members only
  project_id?: string;
  recipient?: string | null;
  source?: string;
  format?: string | null;
};

function LookupContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [input, setInput] = useState(params?.get('code') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const lookup = useCallback(async (raw: string) => {
    const code = normalizeDraftCode(raw);
    setResult(null);
    if (!code) { setError('A draft code is 5 letters and digits, like A7K2Q.'); return; }
    setError(null);
    setLoading(true);
    router.replace(`/lookup?code=${code}`, { scroll: false });
    try {
      const res = await fetch(`/api/drafts/lookup?code=${code}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error || 'Lookup failed.');
      else setResult(body.draft as LookupResult);
    } catch {
      setError('Lookup failed — check your connection.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Look up straight away when opened with ?code=
  useEffect(() => {
    const initial = params?.get('code');
    if (initial) lookup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen px-4 py-16 sm:py-24" style={{ background: 'rgb(var(--surface-950))' }}>
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>Look up a printed draft</h1>
        <p className="text-sm text-surface-400 mb-8">
          Script pages printed from Screenplay Studio carry a small draft code at the foot of each page.
          Enter it to see when that copy was printed and whether the script has changed since.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); lookup(input); }}
          className="flex gap-2 mb-6"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="A7K2Q"
            maxLength={7}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label="Draft code"
            className="flex-1 min-w-0 bg-surface-900 border border-surface-700 rounded-lg px-4 py-3 font-mono text-xl tracking-[0.2em] text-white placeholder:text-surface-700 outline-none focus:border-brand-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Looking…' : 'Look up'}
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-surface-800 bg-surface-900/60 px-4 py-3 text-sm text-surface-300">{error}</div>
        )}

        {result && (
          <div className="rounded-xl border border-surface-800 bg-surface-900/60 p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="font-mono text-2xl font-semibold text-white tracking-[0.15em]">{result.code}</span>
              {result.script_deleted ? (
                <span className="text-xs px-2 py-1 rounded-full bg-surface-800 text-surface-400">Script deleted</span>
              ) : result.is_current ? (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">Still current</span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400">Changed since printing</span>
              )}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
              <dt className="text-surface-500">Project</dt>
              <dd className="text-white">{result.project_title}</dd>
              <dt className="text-surface-500">Script</dt>
              <dd className="text-white">{result.script_title || 'Untitled'}</dd>
              <dt className="text-surface-500">Printed</dt>
              <dd className="text-white">{new Date(result.printed_at).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</dd>
              <dt className="text-surface-500">Length</dt>
              <dd className="text-white">{result.word_count.toLocaleString()} words</dd>
              {result.member && result.recipient && (
                <>
                  <dt className="text-surface-500">Given to</dt>
                  <dd className="text-white">{result.recipient}</dd>
                </>
              )}
            </dl>
            {result.member && result.project_id && (
              <Link
                href={`/projects/${result.project_id}/drafts?code=${result.code}`}
                className="mt-5 inline-flex text-sm font-medium text-brand-400 hover:text-brand-300"
              >
                Open in project — see the snapshot and what changed →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LookupPage() {
  return (
    <Suspense>
      <LookupContent />
    </Suspense>
  );
}
