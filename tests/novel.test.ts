import { describe, it, expect } from 'vitest';
import { sanitizeProse, htmlToPlain, countWords, parseProse } from '@/lib/novel/text';
import { analyzeProse, findIssues, splitSentences, syllables } from '@/lib/novel/prose';
import { compileBook, numberBinder, numberToWords, toRoman, roundedWordCount, sectionHeading } from '@/lib/novel/compile';
import { buildEpub, buildMarkdown } from '@/lib/novel/export';
import { crc32 } from '@/lib/novel/zip';
import type { NovelChapter } from '@/lib/types';

const chapter = (over: Partial<NovelChapter>): NovelChapter => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  project_id: 'p', kind: 'chapter', title: '', content: '', synopsis: null, status: 'draft',
  pov_character_id: null, pov: null, tense: null, label_color: null, target_words: null,
  word_count: 0, notes: null, include_in_export: true, sort_order: 0, created_by: null,
  created_at: '', updated_at: '',
  ...over,
});

describe('sanitizeProse', () => {
  it('turns contentEditable divs and bare text into paragraphs', () => {
    expect(sanitizeProse('First line<div>Second line</div><div><br></div><div>Third</div>'))
      .toBe('<p>First line</p><p>Second line</p><p>Third</p>');
  });

  it('maps b/i to strong/em and keeps scene breaks', () => {
    expect(sanitizeProse('<p><b>Bold</b> and <i>italic</i></p><hr><p>After</p>'))
      .toBe('<p><strong>Bold</strong> and <em>italic</em></p><hr><p>After</p>');
  });

  it('strips scripts, styles, attributes and unknown classes', () => {
    const out = sanitizeProse('<p class="center evil" style="color:red" onclick="x()">Hi<script>alert(1)</script></p><img src=x onerror=alert(1)>');
    expect(out).toBe('<p class="center">Hi</p>');
  });

  it('unwraps Word-style spans and headings', () => {
    expect(sanitizeProse('<h1>Letter</h1><p><span style="font-weight:bold">Dear</span> Ana</p>'))
      .toBe('<h2>Letter</h2><p>Dear Ana</p>');
  });
});

describe('word counting', () => {
  it('counts words across paragraphs and formatting', () => {
    expect(countWords('<p>The <em>quick</em> brown fox.</p><p>Jumps&nbsp;over.</p>')).toBe(6);
    expect(countWords('')).toBe(0);
    expect(countWords('<p></p><hr>')).toBe(0);
    expect(countWords('plain text here')).toBe(3);
  });

  it('keeps paragraph breaks in plain text', () => {
    expect(htmlToPlain('<p>One</p><p>Two &amp; three</p>')).toBe('One\nTwo & three');
  });
});

describe('parseProse', () => {
  it('keeps inline marks as runs and scene breaks as blocks', () => {
    const blocks = parseProse('<p>A <em>b</em></p><hr><blockquote>Q</blockquote>');
    expect(blocks.map((b) => b.type)).toEqual(['p', 'break', 'quote']);
    const p = blocks[0] as Extract<typeof blocks[0], { type: 'p' }>;
    expect(p.runs).toEqual([{ text: 'A ' }, { text: 'b', em: true }]);
  });
});

describe('prose analysis', () => {
  it('splits sentences and ignores common abbreviations', () => {
    const s = splitSentences('Mr. Hale arrived. Was he late? "No!" she said.\nA new paragraph');
    expect(s.map((x) => x.text)).toEqual(['Mr. Hale arrived.', 'Was he late?', '"No!" she said.', 'A new paragraph']);
  });

  it('counts syllables roughly', () => {
    expect(syllables('cat')).toBe(1);
    expect(syllables('water')).toBe(2);
    expect(syllables('beautiful')).toBe(3);
  });

  it('flags adverbs but not -ly nouns and adjectives', () => {
    const kinds = (t: string) => findIssues(t).filter((i) => i.kind === 'adverb').map((i) => i.match);
    expect(kinds('She ran quickly to her family in Italy.')).toEqual(['quickly']);
  });

  it('flags passive voice, filter words and weak words', () => {
    const issues = findIssues('The letter was written by Ana. She felt very cold. He was tired.');
    const by = (k: string) => issues.filter((i) => i.kind === k).map((i) => i.match.toLowerCase());
    expect(by('passive')).toEqual(['was written by']);
    expect(by('filter')).toEqual(['felt']);
    expect(by('weak')).toEqual(['very']);
  });

  it('flags three sentences in a row with the same opening word', () => {
    const issues = findIssues('She ran. She hid. She waited. Then dawn.');
    expect(issues.filter((i) => i.kind === 'repeat_start')).toHaveLength(3);
  });

  it('reports readability, dialogue share and repeated phrases', () => {
    const text = '"Come here," she said. The cat sat on the mat. '.repeat(4) + 'At the end of the day it rained.';
    const r = analyzeProse(text);
    expect(r.words).toBeGreaterThan(30);
    expect(r.readingEase).toBeGreaterThan(70);
    expect(r.dialogueRatio).toBeGreaterThan(0.1);
    expect(r.counts.cliche).toBe(1);
    expect(r.repeatedPhrases.some((p) => p.phrase === 'the cat sat on')).toBe(true);
  });

  it('handles empty text', () => {
    const r = analyzeProse('');
    expect(r.words).toBe(0);
    expect(r.readingEase).toBe(0);
  });
});

describe('compileBook', () => {
  it('numbers chapters through the book and parts separately', () => {
    const items = [
      chapter({ id: 'f', kind: 'front_matter', title: 'Dedication' }),
      chapter({ id: 'p1', kind: 'part' }),
      chapter({ id: 'c1' }),
      chapter({ id: 'c2' }),
      chapter({ id: 'p2', kind: 'part', title: 'The Return' }),
      chapter({ id: 'c3' }),
    ];
    const words = numberBinder(items, 'words');
    expect(words.get('f')).toBe('');
    expect(words.get('p1')).toBe('Part One');
    expect(words.get('c2')).toBe('Chapter Two');
    expect(words.get('c3')).toBe('Chapter Three');
    expect(numberBinder(items, 'roman').get('c3')).toBe('Chapter III');
    expect(numberBinder(items, 'none').get('c1')).toBe('');
  });

  it('writes numbers as words and roman numerals', () => {
    expect(numberToWords(1)).toBe('One');
    expect(numberToWords(42)).toBe('Forty-Two');
    expect(numberToWords(101)).toBe('One Hundred One');
    expect(toRoman(14)).toBe('XIV');
  });

  it('skips excluded sections and front/back matter when asked', () => {
    const book = compileBook([
      chapter({ id: 'a', kind: 'front_matter', title: 'Epigraph', sort_order: 0 }),
      chapter({ id: 'b', title: 'Arrival', content: '<p>Rain.</p>', word_count: 1, sort_order: 1 }),
      chapter({ id: 'c', title: 'Cut', include_in_export: false, sort_order: 2 }),
      chapter({ id: 'd', kind: 'back_matter', title: 'Thanks', sort_order: 3 }),
    ], { title: 'T', author: 'A' }, { numbering: 'words', includeFrontMatter: false, includeBackMatter: true });
    expect(book.sections.map((s) => s.id)).toEqual(['b', 'd']);
    expect(sectionHeading(book.sections[0])).toBe('Chapter One: Arrival');
    expect(book.wordCount).toBe(1);
  });

  it('rounds word counts the way manuscript title pages do', () => {
    expect(roundedWordCount(84612)).toBe('about 85,000 words');
    expect(roundedWordCount(4321)).toBe('about 4,300 words');
    expect(roundedWordCount(12)).toBe('about 100 words');
  });
});

describe('exports', () => {
  const book = compileBook([
    chapter({ id: 'x', title: 'Storm & Sea', content: '<p>It was <em>dark</em>.</p><hr><p>Then light.</p>', word_count: 5 }),
  ], { title: 'The <Lighthouse>', author: 'Ana Berg' }, { numbering: 'words', includeFrontMatter: true, includeBackMatter: true });
  const meta = { language: 'en', sceneBreak: '* * *' };

  it('builds a valid EPUB zip with mimetype stored first', () => {
    const bytes = buildEpub(book, meta);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const nameLen = view.getUint16(26, true);
    const name = new TextDecoder().decode(bytes.slice(30, 30 + nameLen));
    expect(name).toBe('mimetype');
    expect(view.getUint16(8, true)).toBe(0); // stored, not deflated
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('application/epub+zip');
    expect(text).toContain('<dc:title>The &lt;Lighthouse&gt;</dc:title>');
    expect(text).toContain('Chapter One: Storm &amp; Sea');
    expect(text).toContain('<p class="scene-break">* * *</p>');
    // End of central directory record is present.
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  });

  it('builds Markdown with headings, italics and scene breaks', () => {
    const md = buildMarkdown(book, meta);
    expect(md).toContain('## Chapter One: Storm & Sea');
    expect(md).toContain('It was *dark*.');
    expect(md).toContain('* * *');
  });

  it('computes CRC-32 correctly', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('importManuscript', () => {
  it('splits chapters on headings and keeps scene breaks and italics', async () => {
    const { importManuscript } = await import('@/lib/novel/import');
    const out = importManuscript([
      'The Lighthouse', '',
      'Prologue', '', 'Before the storm.', '',
      'PART ONE: Arrival', '',
      'Chapter 1: Rain', '', 'It was *very* dark.', 'Still dark.', '', '* * *', '', 'Morning came.', '',
      '## The Second', '', 'Second chapter text.', '',
      'Acknowledgements', '', 'Thanks, everyone.',
    ].join('\n'));
    // "The Lighthouse" alone on the first line is the book title and is dropped.
    expect(out.map((s) => [s.kind, s.title])).toEqual([
      ['front_matter', 'Prologue'],
      ['part', 'Arrival'],
      ['chapter', 'Rain'],
      ['chapter', 'The Second'],
      ['back_matter', 'Acknowledgements'],
    ]);
    expect(out[0].content).toBe('<p>Before the storm.</p>');
    expect(out[2].content).toBe('<p>It was <em>very</em> dark. Still dark.</p><hr><p>Morning came.</p>');
  });

  it('treats every line as a paragraph when there are no blank lines', async () => {
    const { importManuscript } = await import('@/lib/novel/import');
    const out = importManuscript('Chapter One\nFirst.\nSecond.');
    expect(out).toEqual([{ kind: 'chapter', title: '', content: '<p>First.</p><p>Second.</p>' }]);
  });
});

describe('writing goals', () => {
  it('counts the current streak through yesterday and the best streak', async () => {
    const { currentStreak, bestStreak, wordsByDay } = await import('@/lib/novel/goals');
    const byDay = wordsByDay([
      { day: '2026-10-01', words: 100 }, { day: '2026-10-02', words: 50 },
      { day: '2026-10-04', words: 10 }, { day: '2026-10-05', words: 20 }, { day: '2026-10-05', words: 5 },
    ]);
    expect(byDay.get('2026-10-05')).toBe(25);
    expect(currentStreak(byDay, '2026-10-06')).toBe(2); // nothing yet today; streak still alive
    expect(currentStreak(byDay, '2026-10-07')).toBe(0);
    expect(bestStreak(byDay)).toBe(2);
  });

  it('works out the daily words needed and a projected finish', async () => {
    const { pace } = await import('@/lib/novel/goals');
    const byDay = new Map([['2026-10-06', 400], ['2026-10-05', 500], ['2026-10-03', 500]]);
    const p = pace({ total: 70000, target: 80000, deadline: '2026-10-15', today: '2026-10-06', byDay });
    expect(p.remaining).toBe(10000);
    expect(p.daysLeft).toBe(10);
    expect(p.neededPerDay).toBe(1000);
    expect(p.recentPerDay).toBe(100); // 1400 over a 14-day window
    expect(p.projectedFinish).toBe('2027-01-14'); // 10,000 words at 100/day
    // One day of writing is too little to project from.
    expect(pace({ total: 0, target: 80000, today: '2026-10-06', byDay: new Map([['2026-10-06', 50]]) }).projectedFinish).toBeNull();
  });

  it('crosses month and year boundaries', async () => {
    const { addDays, daysBetween } = await import('@/lib/novel/goals');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-06', '2026-11-06')).toBe(31);
  });
});
