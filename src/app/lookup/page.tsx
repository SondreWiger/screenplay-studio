'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { normalizeDraftCode } from '@/lib/scripts/drafts';
import type { DraftChangeSummary, SceneRef } from '@/lib/scripts/draft-changes';

type LookupResult = {
  code: string;
  printed_at: string;
  script_title: string;
  project_title: string;
  element_count: number;
  word_count: number;
  is_current: boolean | null;
  script_deleted: boolean;
  via_qr: boolean;
  newer_prints: number;
  latest_print_at: string | null;
  changes?: DraftChangeSummary;
  member: boolean;
  // Members only
  project_id?: string;
  recipient?: string | null;
  source?: string;
  format?: string | null;
  printed_by?: string | null;
};

/** "3 weeks ago" — the paper says roughly when; the exact time is below it. */
function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year'],
  ];
  let v = -s;
  for (const [size, unit] of steps) {
    if (Math.abs(v) < size) return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(v), unit);
    v /= size;
  }
  return '';
}

function SceneList({ title, scenes, tone }: { title: string; scenes: SceneRef[]; tone: string }) {
  const [all, setAll] = useState(false);
  if (scenes.length === 0) return null;
  const shown = all ? scenes : scenes.slice(0, 8);
  return (
    <div className="mt-4">
      <div className={`text-xs font-medium mb-1.5 ${tone}`}>{title} ({scenes.length})</div>
      <ul className="space-y-1">
        {shown.map((sc, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="w-8 shrink-0 text-right font-mono text-surface-500">{sc.number}</span>
            <span className="text-surface-200 font-mono text-[13px] uppercase truncate">{sc.heading}</span>
          </li>
        ))}
      </ul>
      {scenes.length > shown.length && (
        <button onClick={() => setAll(true)} className="mt-1 ml-11 text-xs text-brand-400 hover:text-brand-300">
          Show all {scenes.length}
        </button>
      )}
    </div>
  );
}

function ChangeSummary({ c, member }: { c: DraftChangeSummary; member: boolean }) {
  const wordDelta = c.words_now - c.words_then;
  const facts = [
    c.changed.length > 0 && `${c.changed.length} scene${c.changed.length === 1 ? '' : 's'} changed`,
    c.added_count > 0 && `${c.added_count} new`,
    c.removed.length > 0 && `${c.removed.length} cut`,
    c.moved_count > 0 && `${c.moved_count} moved`,
  ].filter(Boolean) as string[];
  return (
    <div className="mt-5 pt-5 border-t border-surface-800">
      <h2 className="text-sm font-semibold text-white mb-1">What has changed since</h2>
      <p className="text-sm text-surface-400">
        {facts.length ? facts.join(' · ') : 'Small edits outside any scene'}
        {' — '}
        {c.scenes_then} → {c.scenes_now} scenes, {wordDelta === 0 ? 'same length' : `${wordDelta > 0 ? '+' : ''}${wordDelta.toLocaleString()} words`}
      </p>
      <SceneList title="Changed in your copy" scenes={c.changed} tone="text-amber-400" />
      <SceneList title="Cut since" scenes={c.removed} tone="text-red-400" />
      {member
        ? <SceneList title="New scenes" scenes={c.added} tone="text-emerald-400" />
        : c.added_count > 0 && (
          <p className="mt-4 text-xs text-surface-500">
            {c.added_count} new scene{c.added_count === 1 ? ' has' : 's have'} been added — ask the team for an up-to-date copy.
          </p>
        )}
    </div>
  );
}

function LookupContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [input, setInput] = useState(params?.get('code') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const lookup = useCallback(async (raw: string, key?: string | null) => {
    const code = normalizeDraftCode(raw);
    setResult(null);
    if (!code) { setError('A draft code is 5 letters and digits, like A7K2Q.'); return; }
    setError(null);
    setLoading(true);
    // A scanned QR carries a key; keep it in the URL so a reload still works
    const k = key ? `&k=${encodeURIComponent(key)}` : '';
    router.replace(`/lookup?code=${code}${k}`, { scroll: false });
    try {
      const res = await fetch(`/api/drafts/lookup?code=${code}${k}`, { cache: 'no-store' });
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
    if (initial) lookup(initial, params?.get('k'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen px-4 py-16 sm:py-24" style={{ background: 'rgb(var(--surface-950))' }}>
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>Look up a printed draft</h1>
        <p className="text-sm text-surface-400 mb-8">
          Script pages printed from Screenplay Studio carry a small draft code at the foot of each page,
          and a QR code on the front. Enter the code or scan the QR to see when that copy was printed and what has changed since.
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
              <dd className="text-white">
                {timeAgo(result.printed_at)}
                <span className="block text-xs text-surface-500">
                  {new Date(result.printed_at).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                </span>
              </dd>
              {result.member && result.printed_by && (
                <>
                  <dt className="text-surface-500">Printed by</dt>
                  <dd className="text-white">{result.printed_by}</dd>
                </>
              )}
              <dt className="text-surface-500">Length</dt>
              <dd className="text-white">{result.word_count.toLocaleString()} words</dd>
              {result.newer_prints > 0 && result.latest_print_at && (
                <>
                  <dt className="text-surface-500">Newer prints</dt>
                  <dd className="text-white">
                    {result.newer_prints} since, latest {timeAgo(result.latest_print_at)}
                  </dd>
                </>
              )}
              {result.member && result.recipient && (
                <>
                  <dt className="text-surface-500">Given to</dt>
                  <dd className="text-white">{result.recipient}</dd>
                </>
              )}
            </dl>
            {result.changes && <ChangeSummary c={result.changes} member={result.member} />}
            {result.is_current && (
              <p className="mt-5 pt-5 border-t border-surface-800 text-sm text-surface-400">
                Nothing in the script has changed since this copy was printed.
              </p>
            )}
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
