'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const DURATIONS = [10, 15, 25, 45, 60];

/**
 * Word sprint: a countdown that measures how many words were written while
 * it ran. `getWords` returns the book's live word count; the difference
 * between start and finish is the sprint's score.
 */
export function SprintTimer({ getWords, onFinish }: {
  getWords: () => number;
  onFinish: (result: { words: number; minutes: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(25);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<{ words: number; minutes: number } | null>(null);
  const startWords = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [endsAt]);

  const finish = (early = false) => {
    const mins = early ? Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)) : minutes;
    const r = { words: Math.max(0, getWords() - startWords.current), minutes: mins };
    setEndsAt(null);
    setResult(r);
    setOpen(true);
    onFinish(r);
  };

  useEffect(() => {
    if (endsAt && now >= endsAt) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, endsAt]);

  const start = () => {
    startWords.current = getWords();
    startedAt.current = Date.now();
    setResult(null);
    setNow(Date.now());
    setEndsAt(Date.now() + minutes * 60000);
    setOpen(false);
  };

  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const live = endsAt ? Math.max(0, getWords() - startWords.current) : 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
          endsAt ? 'bg-teal-500/15 text-teal-300 tabular-nums' : 'text-surface-400 hover:text-white hover:bg-surface-800',
        )}
        title="Word sprint"
        aria-label={endsAt ? `Sprint running, ${mm}:${ss} left` : 'Word sprint'}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="13" r="8" strokeWidth={1.5} /><path strokeLinecap="round" strokeWidth={1.5} d="M12 9v4l2.5 2.5M9.5 2.5h5" /></svg>
        {endsAt ? <span>{mm}:{ss} · {live}w</span> : <span className="hidden lg:inline">Sprint</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-40 w-64 rounded-xl border border-surface-700 bg-surface-900 p-4 shadow-xl">
          {result && (
            <div className="mb-4 rounded-lg bg-teal-500/10 border border-teal-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-teal-300 tabular-nums">{result.words.toLocaleString()}</p>
              <p className="text-xs text-surface-400">words in {result.minutes} min · {Math.round(result.words / Math.max(1, result.minutes))} wpm</p>
            </div>
          )}
          {endsAt ? (
            <div className="space-y-3">
              <p className="text-sm text-surface-300">Sprint running: <span className="tabular-nums font-semibold text-white">{mm}:{ss}</span> left, {live} words so far.</p>
              <button type="button" onClick={() => finish(true)} className="w-full rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-300 hover:text-white hover:border-surface-500">
                End sprint now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">Sprint length</p>
              <div className="flex flex-wrap gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setMinutes(d)}
                    className={cn('px-2.5 py-1 rounded-md text-xs font-medium', minutes === d ? 'bg-teal-600 text-white' : 'bg-surface-800 text-surface-400 hover:text-white')}
                  >
                    {d}m
                  </button>
                ))}
              </div>
              <button type="button" onClick={start} className="w-full rounded-lg bg-teal-600 hover:bg-teal-500 px-3 py-2 text-sm font-semibold text-white">
                Start {minutes}-minute sprint
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
