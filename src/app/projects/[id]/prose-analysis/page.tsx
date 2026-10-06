'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LoadingPage } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fetchChapters } from '@/hooks/useNovel';
import { htmlToPlain } from '@/lib/novel/text';
import { analyzeProse, findIssues, ISSUE_INFO, readingEaseLabel, type IssueKind } from '@/lib/novel/prose';
import { numberBinder } from '@/lib/novel/compile';
import type { NovelChapter } from '@/lib/types';

const KINDS = Object.keys(ISSUE_INFO) as IssueKind[];

export default function ProseAnalysisPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [chapters, setChapters] = useState<NovelChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<string>('book');
  const [enabled, setEnabled] = useState<Set<IssueKind>>(new Set<IssueKind>(['adverb', 'passive', 'filter', 'weak', 'cliche']));

  useEffect(() => {
    fetchChapters(projectId, true).then((rows) => {
      setChapters(rows.filter((c) => c.kind !== 'part'));
      setLoading(false);
    });
  }, [projectId]);

  const labels = useMemo(() => numberBinder(chapters, 'numerals'), [chapters]);
  const name = (c: NovelChapter) => [labels.get(c.id), c.title].filter(Boolean).join(': ') || 'Untitled';

  const plain = useMemo(() => new Map(chapters.map((c) => [c.id, htmlToPlain(c.content)])), [chapters]);
  const perChapter = useMemo(() => chapters.map((c) => ({ c, r: analyzeProse(plain.get(c.id) || '') })), [chapters, plain]);
  const selected = scope === 'book' ? null : chapters.find((c) => c.id === scope) || null;
  const text = selected ? plain.get(selected.id) || '' : chapters.map((c) => plain.get(c.id) || '').join('\n\n');
  const report = useMemo(() => analyzeProse(text), [text]);

  // Dominant tense / POV, to flag chapters that drift from it.
  const tenseCounts = chapters.reduce((m, c) => (c.tense ? m.set(c.tense, (m.get(c.tense) || 0) + 1) : m), new Map<string, number>());
  const mainTense = Array.from(tenseCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const povList = Array.from(new Set(chapters.map((c) => c.pov).filter(Boolean))) as string[];

  if (loading) return <LoadingPage />;

  if (chapters.length === 0 || !text.trim()) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white">Prose Analysis</h1>
        <div className="mt-6 rounded-xl border border-dashed border-surface-700 p-10 text-center">
          <p className="text-white font-medium">Nothing to analyse yet</p>
          <p className="mt-1 text-sm text-surface-400">Write a chapter in the <Link className="text-teal-300 hover:underline" href={`/projects/${projectId}/manuscript`}>Manuscript</Link> and come back.</p>
        </div>
      </div>
    );
  }

  const per1k = (n: number, words: number) => (words ? (n / words) * 1000 : 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Prose Analysis</h1>
          <p className="text-sm text-surface-400 mt-0.5">Readability, style flags and repetition. Pointers to look at, not rules.</p>
        </div>
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="What to analyse"
          className="rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white">
          <option value="book">Whole manuscript</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Words" value={report.words.toLocaleString()} sub={`${report.sentences.toLocaleString()} sentences · ${report.paragraphs.toLocaleString()} paragraphs`} />
        <Metric label="Reading ease" value={Math.round(report.readingEase).toString()} sub={`${readingEaseLabel(report.readingEase)} · grade ${report.gradeLevel.toFixed(1)}`} />
        <Metric label="Avg. sentence" value={`${report.avgSentenceLength.toFixed(1)} words`} sub={`${report.counts.long_sentence} over 35 words`} />
        <Metric label="Dialogue" value={`${Math.round(report.dialogueRatio * 100)}%`} sub={`${Math.round(report.readingMinutes)} min read · ${Math.round(report.uniqueWordRatio * 100)}% unique words`} />
      </div>

      <SentenceRhythm lengths={report.sentenceLengths} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Style flags</h2>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => {
                const on = enabled.has(k);
                return (
                  <button key={k} type="button" aria-pressed={on} title={ISSUE_INFO[k].hint}
                    onClick={() => setEnabled((s) => { const n = new Set(s); if (on) n.delete(k); else n.add(k); return n; })}
                    className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs', on ? 'border-surface-600 bg-surface-800 text-white' : 'border-surface-800 text-surface-500')}>
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ISSUE_INFO[k].color, opacity: on ? 1 : 0.35 }} />
                    {ISSUE_INFO[k].label}
                    <span className="tabular-nums text-surface-400">{report.counts[k]}</span>
                    <span className="tabular-nums text-surface-600">{per1k(report.counts[k], report.words).toFixed(1)}/1k</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selected ? (
            <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">{name(selected)}</h2>
                <Link href={`/projects/${projectId}/manuscript`} className="text-xs text-teal-300 hover:underline">Edit in Manuscript</Link>
              </div>
              <HighlightedText text={text} enabled={enabled} />
            </div>
          ) : (
            <div className="rounded-xl border border-surface-800 bg-surface-900/50 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Analysis per chapter</caption>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-surface-500 border-b border-surface-800">
                    <th className="px-4 py-3 font-semibold">Chapter</th>
                    <th className="px-3 py-3 font-semibold text-right">Words</th>
                    <th className="px-3 py-3 font-semibold text-right">Ease</th>
                    <th className="px-3 py-3 font-semibold text-right">Sentence</th>
                    <th className="px-3 py-3 font-semibold text-right">Adverbs/1k</th>
                    <th className="px-3 py-3 font-semibold text-right">Passive/1k</th>
                    <th className="px-3 py-3 font-semibold text-right">Dialogue</th>
                    <th className="px-3 py-3 font-semibold">POV · Tense</th>
                  </tr>
                </thead>
                <tbody>
                  {perChapter.map(({ c, r }) => (
                    <tr key={c.id} className="border-b border-surface-800/60 hover:bg-surface-800/40 cursor-pointer" onClick={() => setScope(c.id)}>
                      <td className="px-4 py-2.5 text-surface-200 max-w-[14rem] truncate">{name(c)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-surface-300">{r.words.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-surface-300">{r.words ? Math.round(r.readingEase) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-surface-300">{r.words ? r.avgSentenceLength.toFixed(1) : '—'}</td>
                      <Flagged value={per1k(r.counts.adverb, r.words)} warn={per1k(report.counts.adverb, report.words) * 1.5} />
                      <Flagged value={per1k(r.counts.passive, r.words)} warn={per1k(report.counts.passive, report.words) * 1.5} />
                      <td className="px-3 py-2.5 text-right tabular-nums text-surface-300">{r.words ? `${Math.round(r.dialogueRatio * 100)}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="text-surface-300">{c.pov || '—'}</span>
                        <span className="text-surface-600"> · </span>
                        <span className={cn(c.tense && mainTense && c.tense !== mainTense ? 'text-amber-300' : 'text-surface-400')}>{c.tense || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-3 text-[11px] text-surface-500">
                Click a chapter to see its text with flags highlighted. Rates in amber are well above your book&apos;s average.
                {mainTense && ` Tenses that differ from the book's usual ${mainTense} tense are in amber.`}
                {povList.length > 1 && ` ${povList.length} points of view: ${povList.join(', ')}.`}
                {' '}Set POV and tense per chapter in the Manuscript inspector.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <WordList title="Most used words" empty="No word is used three times yet."
            items={report.overused.map((o) => ({ key: o.word, label: o.word, value: `${o.count} · ${o.per10k}/10k` }))} />
          <WordList title="Repeated phrases" empty="No phrase is repeated three or more times."
            items={report.repeatedPhrases.map((p) => ({ key: p.phrase, label: `“${p.phrase}”`, value: `${p.count}×` }))} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-surface-400">{sub}</p>
    </div>
  );
}

function Flagged({ value, warn }: { value: number; warn: number }) {
  return (
    <td className={cn('px-3 py-2.5 text-right tabular-nums', warn > 0 && value > warn ? 'text-amber-300' : 'text-surface-300')}>
      {value.toFixed(1)}
    </td>
  );
}

function WordList({ title, items, empty }: { title: string; items: { key: string; label: string; value: string }[]; empty: string }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
      <h2 className="text-sm font-semibold text-white mb-3">{title}</h2>
      {items.length === 0 ? <p className="text-xs text-surface-500">{empty}</p> : (
        <ul className="space-y-1 max-h-80 overflow-y-auto">
          {items.map((i) => (
            <li key={i.key} className="flex justify-between gap-3 text-sm">
              <span className="text-surface-200 truncate">{i.label}</span>
              <span className="text-xs tabular-nums text-surface-500 shrink-0">{i.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sentence lengths in order — a flat line reads monotonous, a varied one reads alive. */
function SentenceRhythm({ lengths }: { lengths: number[] }) {
  const shown = lengths.slice(0, 300);
  if (shown.length < 3) return null;
  const max = Math.max(...shown, 1);
  const avg = shown.reduce((a, b) => a + b, 0) / shown.length;
  const sd = Math.sqrt(shown.reduce((n, l) => n + (l - avg) ** 2, 0) / shown.length);
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
      <div className="flex flex-wrap justify-between items-baseline gap-2 mb-3">
        <h2 className="text-sm font-semibold text-white">Sentence rhythm</h2>
        <span className="text-xs text-surface-500">
          Variation {sd.toFixed(1)} words{sd < 5 ? ' — sentences are much the same length' : ''}
          {lengths.length > shown.length ? ` · first ${shown.length} sentences` : ''}
        </span>
      </div>
      <div className="h-20 flex items-end gap-px" role="img" aria-label={`Lengths of ${shown.length} sentences, average ${avg.toFixed(1)} words`}>
        {shown.map((l, i) => (
          <div key={i} className={cn('flex-1 rounded-t-[1px]', l > 35 ? 'bg-orange-400' : 'bg-teal-600')} style={{ height: `${(l / max) * 100}%` }} title={`${l} words`} />
        ))}
      </div>
    </div>
  );
}

/** The chapter's text with flagged spans marked. Long sentences get a tint; the rest an underline. */
function HighlightedText({ text, enabled }: { text: string; enabled: Set<IssueKind> }) {
  const segments = useMemo(() => {
    const issues = findIssues(text).filter((i) => enabled.has(i.kind));
    const marks: (Set<IssueKind> | null)[] = new Array(text.length).fill(null);
    for (const i of issues) {
      for (let k = i.start; k < i.end; k++) {
        if (!marks[k]) marks[k] = new Set();
        marks[k]!.add(i.kind);
      }
    }
    const key = (s: Set<IssueKind> | null) => (s ? Array.from(s).sort().join(',') : '');
    const out: { text: string; kinds: IssueKind[] }[] = [];
    let start = 0;
    for (let k = 1; k <= text.length; k++) {
      if (k === text.length || key(marks[k]) !== key(marks[start])) {
        out.push({ text: text.slice(start, k), kinds: marks[start] ? Array.from(marks[start]!) : [] });
        start = k;
      }
    }
    return out;
  }, [text, enabled]);

  return (
    <div className="font-serif text-[16px] leading-[1.9] text-surface-200 whitespace-pre-wrap">
      {segments.map((s, i) => {
        if (!s.kinds.length) return <span key={i}>{s.text}</span>;
        const long = s.kinds.includes('long_sentence');
        const word = s.kinds.find((k) => k !== 'long_sentence');
        return (
          <span
            key={i}
            title={s.kinds.map((k) => `${ISSUE_INFO[k].label}: ${ISSUE_INFO[k].hint}`).join('\n')}
            style={{
              background: long ? 'rgb(251 146 60 / 0.12)' : undefined,
              textDecoration: word ? 'underline' : undefined,
              textDecorationColor: word ? ISSUE_INFO[word].color : undefined,
              textDecorationThickness: word ? '2px' : undefined,
              textUnderlineOffset: word ? '3px' : undefined,
            }}
          >
            {s.text}
          </span>
        );
      })}
    </div>
  );
}

