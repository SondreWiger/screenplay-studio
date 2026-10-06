'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DOMPurify from 'dompurify';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, LoadingPage, toast, ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fetchChapters, useNovelSettings } from '@/hooks/useNovel';
import { compileBook, sectionHeading, type ChapterNumbering } from '@/lib/novel/compile';
import {
  buildDocx, buildEpub, buildMarkdown, buildPlainText, buildPrintHtml, downloadFile, safeFilename, sectionBodyHtml, type ExportMeta,
} from '@/lib/novel/export';
import type { NovelChapter } from '@/lib/types';

type Format = 'epub' | 'docx_manuscript' | 'docx_book' | 'pdf' | 'markdown' | 'txt';

const FORMATS: { id: Format; label: string; ext: string; description: string }[] = [
  { id: 'docx_manuscript', label: 'Manuscript (DOCX)', ext: 'docx', description: 'Standard manuscript format for agents, editors and magazines: Times 12pt, double spaced, page headers.' },
  { id: 'epub', label: 'E-book (EPUB)', ext: 'epub', description: 'For Kindle (Send to Kindle), Apple Books, Kobo, KDP and Draft2Digital.' },
  { id: 'pdf', label: 'Print / PDF', ext: 'pdf', description: 'Book layout at a trim size. Opens your browser’s print dialog — choose Save as PDF.' },
  { id: 'docx_book', label: 'Reading copy (DOCX)', ext: 'docx', description: 'Single-spaced book layout for beta readers and editing in Word or Google Docs.' },
  { id: 'markdown', label: 'Markdown', ext: 'md', description: 'Plain text with formatting marks, for other writing tools and static sites.' },
  { id: 'txt', label: 'Plain text', ext: 'txt', description: 'No formatting at all.' },
];

const TRIMS: { id: string; label: string; width: string; height: string }[] = [
  { id: '5x8', label: '5 × 8 in', width: '5in', height: '8in' },
  { id: '5.5x8.5', label: '5.5 × 8.5 in', width: '5.5in', height: '8.5in' },
  { id: '6x9', label: '6 × 9 in (trade)', width: '6in', height: '9in' },
  { id: 'a5', label: 'A5', width: '148mm', height: '210mm' },
  { id: 'letter', label: 'US Letter', width: '8.5in', height: '11in' },
  { id: 'a4', label: 'A4', width: '210mm', height: '297mm' },
];

const SCENE_BREAKS = ['* * *', '#', '⁂', '~', '•'];

export default function BookExportPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { settings, save, loading: settingsLoading } = useNovelSettings(projectId);

  const [chapters, setChapters] = useState<NovelChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<Format>('docx_manuscript');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [contact, setContact] = useState('');
  const [numbering, setNumbering] = useState<ChapterNumbering>('words');
  const [sceneBreak, setSceneBreak] = useState('* * *');
  const [front, setFront] = useState(true);
  const [back, setBack] = useState(true);
  const [trim, setTrim] = useState('6x9');
  const [language, setLanguage] = useState('en');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchChapters(projectId, true).then((rows) => { setChapters(rows); setLoading(false); });
  }, [projectId]);

  // Fill the form once; saving choices after an export mustn't reset it.
  const initialised = useRef(false);
  useEffect(() => {
    if (settingsLoading || !currentProject || initialised.current) return;
    initialised.current = true;
    setTitle(currentProject?.title || '');
    setAuthor(settings.pen_name || settings.author_name || user?.full_name || user?.display_name || '');
    setContact(settings.contact_block || [settings.author_name || user?.full_name || '', user?.email || ''].filter(Boolean).join('\n'));
    if (settings.chapter_numbering) setNumbering(settings.chapter_numbering);
    if (settings.scene_break) setSceneBreak(settings.scene_break);
    setLanguage(currentProject?.language || 'en');
  }, [settingsLoading, settings, currentProject, user]);

  // Short fiction for magazines usually goes without chapter numbers.
  useEffect(() => {
    if (!settings.chapter_numbering && ['short_story', 'flash'].includes(currentProject?.format || '')) setNumbering('none');
  }, [settings.chapter_numbering, currentProject?.format]);

  const book = useMemo(
    () => (loading ? null : compileBook(chapters, { title: title || 'Untitled', author: author || 'Anonymous' }, { numbering, includeFrontMatter: front, includeBackMatter: back })),
    [loading, chapters, title, author, numbering, front, back],
  );

  const meta: ExportMeta = {
    language,
    sceneBreak,
    contactBlock: contact,
    surname: (settings.author_name || author).trim().split(/\s+/).pop(),
    description: settings.query_kit?.blurb || currentProject?.logline || undefined,
  };

  const excluded = chapters.filter((c) => !c.include_in_export);
  const empty = book?.sections.filter((s) => s.kind === 'chapter' && s.blocks.length === 0) ?? [];

  const run = async () => {
    if (!book) return;
    if (book.sections.length === 0) { toast('Nothing to export yet', 'error'); return; }
    setBusy(true);
    try {
      const name = safeFilename(title);
      if (format === 'epub') downloadFile(buildEpub(book, meta), `${name}.epub`, 'application/epub+zip');
      else if (format === 'docx_manuscript' || format === 'docx_book') {
        const blob = await buildDocx(book, meta, format === 'docx_manuscript' ? 'manuscript' : 'book');
        downloadFile(blob, `${name}${format === 'docx_manuscript' ? '-manuscript' : ''}.docx`, blob.type);
      } else if (format === 'markdown') downloadFile(buildMarkdown(book, meta), `${name}.md`, 'text/markdown;charset=utf-8');
      else if (format === 'txt') downloadFile(buildPlainText(book, meta), `${name}.txt`, 'text/plain;charset=utf-8');
      else if (format === 'pdf') {
        const t = TRIMS.find((x) => x.id === trim) || TRIMS[2];
        const html = buildPrintHtml(book, meta, { width: t.width, height: t.height });
        const w = window.open('', '_blank');
        if (!w) { toast('Allow pop-ups to print the book', 'error'); return; }
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.onload = () => setTimeout(() => w.print(), 250);
      }
      // Remember the choices for next time.
      save({
        author_name: settings.author_name || author || null,
        contact_block: contact || null,
        chapter_numbering: numbering,
        scene_break: sceneBreak,
      });
    } catch (e) {
      console.error(e);
      toast('Export failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading || settingsLoading || !book) return <LoadingPage />;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <ToastContainer />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Export Book</h1>
        <p className="text-sm text-surface-400 mt-0.5">
          {book.sections.length} {book.sections.length === 1 ? 'section' : 'sections'} · {book.wordCount.toLocaleString()} words
        </p>
      </div>

      <div className="grid lg:grid-cols-[22rem_1fr] gap-6">
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-surface-500">Format</legend>
            {FORMATS.map((f) => (
              <label key={f.id} className={cn('flex gap-3 rounded-xl border p-3 cursor-pointer transition-colors',
                format === f.id ? 'border-teal-500/60 bg-teal-500/10' : 'border-surface-800 hover:border-surface-700')}>
                <input type="radio" name="format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="mt-1 accent-teal-500" />
                <span>
                  <span className="block text-sm font-medium text-white">{f.label}</span>
                  <span className="block text-xs text-surface-400">{f.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-3">
            <TextField label="Title" value={title} onChange={setTitle} />
            <TextField label="Author name on the cover" value={author} onChange={setAuthor} placeholder="Your name or pen name" />
            {format === 'docx_manuscript' && (
              <label className="block">
                <span className="block text-xs text-surface-400 mb-1">Contact block (title page, top left)</span>
                <textarea value={contact} onChange={(e) => setContact(e.target.value)} rows={4} placeholder={'Legal name\nStreet address\nCity, postcode\nemail@example.com'}
                  className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white placeholder:text-surface-600" />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-surface-400 mb-1">Chapter headings</span>
              <select value={numbering} onChange={(e) => setNumbering(e.target.value as ChapterNumbering)}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-2 text-sm text-white">
                <option value="words">Chapter One</option>
                <option value="numerals">Chapter 1</option>
                <option value="roman">Chapter I</option>
                <option value="none">Titles only</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-surface-400 mb-1">Scene break</span>
              <select value={sceneBreak} onChange={(e) => setSceneBreak(e.target.value)} disabled={format === 'docx_manuscript'}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-2 text-sm text-white disabled:opacity-50">
                {SCENE_BREAKS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            {format === 'pdf' && (
              <label className="block col-span-2">
                <span className="block text-xs text-surface-400 mb-1">Trim size</span>
                <select value={trim} onChange={(e) => setTrim(e.target.value)}
                  className="w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-2 text-sm text-white">
                  {TRIMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
            )}
            {format === 'epub' && (
              <label className="block col-span-2">
                <span className="block text-xs text-surface-400 mb-1">Language code</span>
                <input value={language} onChange={(e) => setLanguage(e.target.value.trim() || 'en')} placeholder="en, nb, de…"
                  className="w-full rounded-lg bg-surface-800 border border-surface-700 px-2.5 py-2 text-sm text-white" />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-surface-300">
              <input type="checkbox" checked={front} onChange={(e) => setFront(e.target.checked)} /> Include front matter
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-300">
              <input type="checkbox" checked={back} onChange={(e) => setBack(e.target.checked)} /> Include back matter
            </label>
          </div>

          {(excluded.length > 0 || empty.length > 0) && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
              {excluded.length > 0 && <p>{excluded.length} {excluded.length === 1 ? 'section is' : 'sections are'} set not to export: {excluded.map((c) => c.title || 'Untitled').join(', ')}.</p>}
              {empty.length > 0 && <p>{empty.length} empty {empty.length === 1 ? 'chapter' : 'chapters'}: {empty.map((s) => sectionHeading(s)).join(', ')}.</p>}
            </div>
          )}

          <Button className="w-full" size="lg" onClick={run} loading={busy} disabled={busy || book.sections.length === 0}>
            {format === 'pdf' ? 'Open print layout' : `Download ${FORMATS.find((f) => f.id === format)?.ext.toUpperCase()}`}
          </Button>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/30 overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-800 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">Preview</span>
            <Link href={`/projects/${projectId}/manuscript`} className="text-xs text-teal-300 hover:underline">Edit manuscript</Link>
          </div>
          {book.sections.length === 0 ? (
            <p className="p-10 text-center text-sm text-surface-500">No sections to export. Add chapters in the Manuscript.</p>
          ) : (
            <div className="max-h-[75vh] overflow-y-auto bg-[#fbf8f1] text-[#1d1b17]">
              <div className="mx-auto max-w-[34rem] px-8 py-12 book-preview" lang={language}>
                <style jsx>{`
                  .book-preview .book-body :global(p) { margin: 0; text-indent: 1.5em; text-align: justify; line-height: 1.6; }
                  .book-preview .book-body :global(p.no-indent), .book-preview .book-body :global(p.center), .book-preview .book-body :global(p.scene-break) { text-indent: 0; }
                  .book-preview .book-body :global(p.center), .book-preview .book-body :global(p.scene-break) { text-align: center; }
                  .book-preview .book-body :global(p.scene-break) { margin: 1em 0; }
                  .book-preview .book-body :global(h3) { text-align: center; font-weight: 700; margin: 1.2em 0 0.6em; }
                  .book-preview .book-body :global(blockquote) { margin: 1em 2em; font-style: italic; }
                `}</style>
                <div className="text-center py-16 font-serif">
                  <h2 className="text-3xl">{book.title}</h2>
                  <p className="mt-3 text-lg">{book.author}</p>
                </div>
                <nav className="py-10 font-serif" aria-label="Contents preview">
                  <h3 className="text-center text-sm uppercase tracking-[0.2em] mb-4">Contents</h3>
                  <ol className="space-y-1 text-sm">
                    {book.sections.filter((s) => sectionHeading(s)).map((s) => (
                      <li key={s.id} className={cn(s.kind === 'part' && 'mt-3 font-semibold')}>{sectionHeading(s)}</li>
                    ))}
                  </ol>
                </nav>
                {book.sections.slice(0, 6).map((s) => (
                  <section key={s.id} className="py-12 font-serif text-[15px]">
                    {(s.label || s.title) && (
                      <header className="text-center mb-8">
                        {s.label && <p className={cn(s.kind === 'part' ? 'text-2xl' : 'text-xl')}>{s.label}</p>}
                        {s.title && <p className={cn(s.label ? 'italic mt-1' : 'text-xl')}>{s.title}</p>}
                      </header>
                    )}
                    <div className="book-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sectionBodyHtml(s, sceneBreak)) }} />
                  </section>
                ))}
                {book.sections.length > 6 && (
                  <p className="py-8 text-center text-sm italic opacity-60">…and {book.sections.length - 6} more sections in the export.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs text-surface-400 mb-1">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white placeholder:text-surface-600" />
    </label>
  );
}
