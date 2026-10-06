'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, LoadingPage, toast, ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fetchChapters, useNovelSettings } from '@/hooks/useNovel';
import { countWords } from '@/lib/novel/text';
import { roundedWordCount, numberBinder } from '@/lib/novel/compile';
import { GENRE_WORD_RANGES, type NovelChapter, type NovelQueryKit } from '@/lib/types';

const CATEGORIES = [
  { value: 'adult', label: 'Adult' },
  { value: 'new_adult', label: 'New Adult' },
  { value: 'ya', label: 'Young Adult' },
  { value: 'middle_grade', label: 'Middle Grade' },
  { value: 'chapter_book', label: 'Chapter Book' },
];

type Tab = 'query' | 'synopsis' | 'blurb' | 'market';

export default function QueryKitPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user } = useAuthStore();
  const { currentProject, members, setCurrentProject } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const { settings, save, loading: settingsLoading } = useNovelSettings(projectId);
  const [kit, setKit] = useState<NovelQueryKit>({});
  const [chapters, setChapters] = useState<NovelChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('query');
  const [logline, setLogline] = useState('');
  const [category, setCategory] = useState('adult');
  const [genreLabel, setGenreLabel] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const dirty = useRef(false);

  useEffect(() => { fetchChapters(projectId).then((rows) => { setChapters(rows); setLoading(false); }); }, [projectId]);

  // Copy saved settings into the form once. Re-copying on every save would
  // wipe out whatever was typed while the save was in flight.
  const initialised = useRef(false);
  useEffect(() => {
    if (settingsLoading || initialised.current) return;
    initialised.current = true;
    setKit(settings.query_kit ?? {});
    setCategory(settings.category || 'adult');
    setLogline(currentProject?.logline || '');
    setGenreLabel((currentProject?.genre || []).join(' ').toLowerCase());
  }, [settingsLoading, settings, currentProject]);

  const update = (patch: Partial<NovelQueryKit>) => { dirty.current = true; setKit((k) => ({ ...k, ...patch })); };
  const persist = async () => {
    if (!dirty.current || !canEdit) return;
    dirty.current = false;
    const { error } = await save({ query_kit: kit, category });
    if (error) toast('Could not save', 'error');
  };
  // Save when leaving the page with unsaved edits.
  const kitRef = useRef(kit);
  kitRef.current = kit;
  useEffect(() => () => { if (dirty.current) save({ query_kit: kitRef.current }); }, [save]);

  const saveLogline = async () => {
    if (!currentProject || logline === (currentProject.logline || '')) return;
    const { error } = await createClient().from('projects').update({ logline: logline || null }).eq('id', projectId);
    if (error) toast('Could not save the logline', 'error');
    else setCurrentProject({ ...currentProject, logline: logline || null });
  };

  const words = chapters.filter((c) => c.kind !== 'part' && c.include_in_export).reduce((n, c) => n + c.word_count, 0);
  const title = currentProject?.title || 'Untitled';
  const author = settings.pen_name || settings.author_name || user?.full_name || user?.display_name || '';
  const catLabel = CATEGORIES.find((c) => c.value === category)?.label.toLowerCase() || '';
  const comps = useMemo(() => kit.comps || [], [kit.comps]);

  const letter = useMemo(() => {
    const compLine = comps.filter((c) => c.title).length
      ? ` It will appeal to readers of ${comps.filter((c) => c.title).slice(0, 2).map((c) => `${c.title.toUpperCase()}${c.author ? ` by ${c.author}` : ''}`).join(' and ')}.`
      : '';
    const parts = [
      'Dear [Agent name],',
      kit.personalisation?.trim(),
      [kit.hook?.trim(), kit.pitch_paragraph?.trim()].filter(Boolean).join('\n\n'),
      `${title.toUpperCase()} is ${/^[aeiou]/i.test(catLabel) ? 'an' : 'a'} ${catLabel}${genreLabel ? ` ${genreLabel}` : ''} novel complete at ${roundedWordCount(words).replace('about ', '')}.${compLine}`,
      kit.author_bio?.trim(),
      'Thank you for your time and consideration.',
      `Best wishes,\n${author || '[Your name]'}`,
    ];
    return parts.filter(Boolean).join('\n\n');
  }, [kit, comps, title, catLabel, genreLabel, words, author]);

  const letterWords = countWords(letter);

  const buildFromChapters = () => {
    const labels = numberBinder(chapters, 'numerals');
    const lines = chapters.filter((c) => c.kind === 'chapter' && c.synopsis?.trim())
      .map((c) => `${labels.get(c.id)}${c.title ? ` (${c.title})` : ''}: ${c.synopsis!.trim()}`);
    if (!lines.length) { toast('Add synopses to chapters in the Manuscript inspector first', 'info'); return; }
    if (kit.synopsis_long?.trim() && !confirm('Replace the long synopsis with a draft built from your chapter synopses?')) return;
    update({ synopsis_long: lines.join('\n\n') });
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Copied', 'success'); } catch { toast('Copy failed', 'error'); }
  };

  if (loading || settingsLoading) return <LoadingPage />;

  const genreMatch = GENRE_WORD_RANGES.filter((g) => {
    const name = g.genre.toLowerCase();
    return (currentProject?.genre || []).some((x) => name.includes(x.toLowerCase()) || x.toLowerCase().includes(name.split(' ')[0]));
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6" onBlur={persist}>
      <ToastContainer />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Query Kit</h1>
          <p className="text-sm text-surface-400 mt-0.5">Everything agents, editors and readers ask for: query letter, synopses, blurb and comps.</p>
        </div>
        <div className="text-right text-xs text-surface-400">
          <p className="text-white text-sm font-medium">{roundedWordCount(words)}</p>
          <p>{words.toLocaleString()} exact</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-800" role="tablist">
        {([['query', 'Query letter'], ['synopsis', 'Synopses'], ['blurb', 'Blurb & bio'], ['market', 'Comps & market']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px', tab === id ? 'border-teal-400 text-white' : 'border-transparent text-surface-400 hover:text-white')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'query' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Area label="Logline" hint="One sentence: who wants what, what stands in the way, what's at stake." value={logline} onChange={setLogline} onBlur={saveLogline} rows={2} target={[25, 50]} readOnly={!canEdit} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs text-surface-400 mb-1">Category</span>
                <select value={category} disabled={!canEdit} onChange={(e) => { setCategory(e.target.value); dirty.current = true; }}
                  className="w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-2 text-sm text-white">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs text-surface-400 mb-1">Genre wording</span>
                <input value={genreLabel} onChange={(e) => setGenreLabel(e.target.value)} placeholder="literary thriller" readOnly={!canEdit}
                  className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" />
              </label>
            </div>
            <Area label="Personalisation" hint="Optional: why this agent — a book they represent, a wishlist item." value={kit.personalisation || ''} onChange={(v) => update({ personalisation: v })} rows={2} readOnly={!canEdit} />
            <Area label="Hook" hint="One or two sentences that make them read on." value={kit.hook || ''} onChange={(v) => update({ hook: v })} rows={3} target={[20, 60]} readOnly={!canEdit} />
            <Area label="The book" hint="The pitch: protagonist, inciting incident, choice, stakes. Present tense, third person. Don't reveal the ending." value={kit.pitch_paragraph || ''} onChange={(v) => update({ pitch_paragraph: v })} rows={8} target={[150, 250]} readOnly={!canEdit} />
            <Area label="Bio" hint="Publishing credits, relevant expertise, a line about you. Short is fine." value={kit.author_bio || ''} onChange={(v) => update({ author_bio: v })} rows={3} target={[30, 80]} readOnly={!canEdit} />
          </div>
          <div className="lg:sticky lg:top-6 self-start rounded-xl border border-surface-800 bg-surface-900/50">
            <div className="flex items-center justify-between border-b border-surface-800 px-4 py-2.5">
              <span className={cn('text-xs tabular-nums', letterWords > 400 ? 'text-amber-300' : 'text-surface-400')}>
                {letterWords} words {letterWords > 400 ? '— most agents want 250–350' : '· aim for 250–350'}
              </span>
              <Button size="sm" variant="secondary" onClick={() => copy(letter)}>Copy letter</Button>
            </div>
            <pre className="whitespace-pre-wrap p-5 font-serif text-[14px] leading-relaxed text-surface-200 max-h-[70vh] overflow-y-auto">{letter}</pre>
          </div>
        </div>
      )}

      {tab === 'synopsis' && (
        <div className="space-y-6">
          <Area label="Short synopsis" hint="One paragraph, beginning to end, including the ending. For contests and some agents." value={kit.synopsis_short || ''} onChange={(v) => update({ synopsis_short: v })} rows={6} target={[100, 250]} readOnly={!canEdit} copy={copy} />
          <div>
            <Area label="Full synopsis" hint="One to two pages, single spaced, present tense. Main plot and character arc, and how it ends. Name characters in CAPS on first mention." value={kit.synopsis_long || ''} onChange={(v) => update({ synopsis_long: v })} rows={18} target={[500, 1000]} readOnly={!canEdit} copy={copy} />
            {canEdit && (
              <button type="button" onClick={buildFromChapters} className="mt-2 text-xs text-teal-300 hover:underline">
                Draft it from my chapter synopses
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'blurb' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Area label="Back-cover blurb" hint="Sell the book to a reader: voice, stakes, a question. No spoilers. Used as the EPUB description." value={kit.blurb || ''} onChange={(v) => update({ blurb: v })} rows={10} target={[100, 200]} readOnly={!canEdit} copy={copy} />
          <Area label="Author bio (third person)" hint="For the back cover, retailer pages and press kits." value={kit.cover_bio || ''} onChange={(v) => update({ cover_bio: v })} rows={6} target={[40, 120]} readOnly={!canEdit} copy={copy} />
        </div>
      )}

      {tab === 'market' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Comparable titles</h2>
              <span className="text-xs text-surface-500">Two or three books from the last five years work best</span>
            </div>
            <div className="space-y-3">
              {comps.map((c, i) => (
                <div key={i} className="grid sm:grid-cols-[1fr_1fr_5rem_auto] gap-2 items-start">
                  <input value={c.title} placeholder="Title" readOnly={!canEdit} onChange={(e) => update({ comps: comps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })}
                    className="rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" aria-label="Comp title" />
                  <input value={c.author} placeholder="Author" readOnly={!canEdit} onChange={(e) => update({ comps: comps.map((x, j) => (j === i ? { ...x, author: e.target.value } : x)) })}
                    className="rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" aria-label="Comp author" />
                  <input value={c.year} placeholder="Year" readOnly={!canEdit} onChange={(e) => update({ comps: comps.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)) })}
                    className={cn('rounded-lg bg-surface-800 border px-3 py-2 text-sm text-white', c.year && parseInt(c.year, 10) < new Date().getFullYear() - 5 ? 'border-amber-500/50' : 'border-surface-700')} aria-label="Comp year" />
                  {canEdit && (
                    <button type="button" onClick={() => update({ comps: comps.filter((_, j) => j !== i) })} className="px-2 py-2 text-surface-500 hover:text-red-400" aria-label="Remove comp">✕</button>
                  )}
                  <input value={c.why} placeholder="Why it compares (tone, premise, audience)" readOnly={!canEdit} onChange={(e) => update({ comps: comps.map((x, j) => (j === i ? { ...x, why: e.target.value } : x)) })}
                    className="sm:col-span-4 rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" aria-label="Why it compares" />
                </div>
              ))}
              {canEdit && (
                <Button size="sm" variant="secondary" onClick={() => update({ comps: [...comps, { title: '', author: '', year: '', why: '' }] })}>Add comp</Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Keywords</h2>
              <span className={cn('text-xs', (kit.keywords?.length || 0) > 7 ? 'text-amber-300' : 'text-surface-500')}>{kit.keywords?.length || 0} / 7 (Amazon KDP allows seven)</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(kit.keywords || []).map((k) => (
                <span key={k} className="flex items-center gap-1 rounded-full bg-surface-800 px-2.5 py-1 text-xs text-surface-200">
                  {k}
                  {canEdit && <button type="button" onClick={() => update({ keywords: (kit.keywords || []).filter((x) => x !== k) })} className="text-surface-500 hover:text-white" aria-label={`Remove ${k}`}>×</button>}
                </span>
              ))}
            </div>
            {canEdit && (
              <form onSubmit={(e) => { e.preventDefault(); const k = keywordInput.trim(); if (k && !(kit.keywords || []).includes(k)) update({ keywords: [...(kit.keywords || []), k] }); setKeywordInput(''); }} className="flex gap-2">
                <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} placeholder="cozy mystery small town"
                  className="flex-1 rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" aria-label="New keyword" />
                <Button size="sm" type="submit">Add</Button>
              </form>
            )}
          </div>

          <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Length by genre</h2>
            <p className="text-xs text-surface-500 mb-4">Typical debut ranges agents expect. Yours: {words.toLocaleString()} words.</p>
            <div className="space-y-2">
              {GENRE_WORD_RANGES.map((g) => {
                const scale = 130000;
                const inRange = words >= g.min && words <= g.max;
                const highlight = genreMatch.includes(g);
                return (
                  <div key={g.genre} className="flex items-center gap-3">
                    <span className={cn('w-40 text-xs truncate', highlight ? 'text-white font-medium' : 'text-surface-400')}>{g.genre}</span>
                    <div className="relative flex-1 h-2.5 rounded-full bg-surface-800">
                      <div className={cn('absolute h-full rounded-full', inRange ? 'bg-teal-500' : 'bg-surface-600')} style={{ left: `${(g.min / scale) * 100}%`, width: `${((g.max - g.min) / scale) * 100}%` }} />
                      {words > 0 && <div className="absolute -top-1 w-0.5 bg-white" style={{ left: `${Math.min(100, (words / scale) * 100)}%`, height: '18px' }} />}
                    </div>
                    <span className="w-24 text-right text-[11px] tabular-nums text-surface-500">{Math.round(g.min / 1000)}–{Math.round(g.max / 1000)}k</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Area({ label, hint, value, onChange, onBlur, rows, target, readOnly, copy }: {
  label: string; hint: string; value: string; onChange: (v: string) => void; onBlur?: () => void;
  rows: number; target?: [number, number]; readOnly?: boolean; copy?: (t: string) => void;
}) {
  const n = countWords(value);
  const over = target && n > target[1];
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="flex items-center gap-2">
          {target && <span className={cn('text-[11px] tabular-nums', over ? 'text-amber-300' : 'text-surface-500')}>{n} / {target[0]}–{target[1]} words</span>}
          {copy && value && <button type="button" onClick={(e) => { e.preventDefault(); copy(value); }} className="text-[11px] text-teal-300 hover:underline">Copy</button>}
        </span>
      </span>
      <span className="block text-xs text-surface-500 mb-1.5">{hint}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} rows={rows} readOnly={readOnly} aria-label={label}
        className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm leading-relaxed text-white resize-y" />
    </label>
  );
}
