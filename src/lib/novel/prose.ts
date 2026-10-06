/**
 * Prose analysis for the Novel tools: readability, style flags and
 * repetition. Pure functions over plain text (see htmlToPlain), so they run
 * in the browser, in tests and on the server alike.
 *
 * These are heuristics in the tradition of ProWritingAid and Hemingway — they
 * point at sentences worth a second look, they do not grade the writing.
 */

export type IssueKind =
  | 'adverb' | 'passive' | 'filter' | 'weak' | 'cliche' | 'long_sentence' | 'repeat_start' | 'echo';

export interface ProseIssue {
  kind: IssueKind;
  start: number;
  end: number;
  match: string;
}

export const ISSUE_INFO: Record<IssueKind, { label: string; hint: string; color: string }> = {
  adverb:        { label: 'Adverbs',            hint: 'An -ly adverb can often be replaced by a stronger verb.',                     color: '#38bdf8' },
  passive:       { label: 'Passive voice',      hint: 'Who is doing it? Active voice is usually clearer.',                           color: '#a78bfa' },
  filter:        { label: 'Filter words',       hint: 'Words like "saw", "felt", "noticed" put a layer between reader and moment.',  color: '#f472b6' },
  weak:          { label: 'Weak words',         hint: '"Very", "really", "just" and friends rarely earn their place.',               color: '#fbbf24' },
  cliche:        { label: 'Clichés',            hint: 'A phrase readers have seen many times.',                                      color: '#f87171' },
  long_sentence: { label: 'Long sentences',     hint: 'Over 35 words. Fine on purpose, tiring by accident.',                         color: '#fb923c' },
  repeat_start:  { label: 'Repeated openings',  hint: 'Several sentences in a row start with the same word.',                        color: '#34d399' },
  echo:          { label: 'Echoes',             hint: 'The same uncommon word again within a few sentences.',                        color: '#94a3b8' },
};

// ── Word lists ──────────────────────────────────────────────────────────────

/** -ly words that are not manner adverbs. */
const LY_EXCEPTIONS = new Set([
  'only', 'family', 'early', 'daily', 'weekly', 'monthly', 'yearly', 'holy', 'ugly', 'lonely', 'lovely', 'friendly',
  'silly', 'belly', 'jelly', 'bully', 'fly', 'reply', 'supply', 'apply', 'rely', 'ally', 'italy', 'july', 'lily', 'sally',
  'billy', 'molly', 'kelly', 'emily', 'holly', 'polly', 'dolly', 'rally', 'tally', 'folly', 'jolly', 'hilly', 'chilly',
  'curly', 'surly', 'burly', 'elderly', 'likely', 'unlikely', 'costly', 'deadly', 'lively', 'orderly', 'scholarly',
  'comply', 'imply', 'multiply', 'anomaly', 'assembly', 'butterfly', 'dragonfly', 'firefly', 'monopoly', 'homily',
  'gully', 'wily', 'smelly', 'woolly', 'bodily', 'kindly', 'ghostly', 'ghastly', 'worldly', 'cowardly', 'manly',
  'womanly', 'beastly', 'heavenly', 'stately', 'timely', 'sickly', 'measly', 'portly', 'prickly', 'wriggly', 'sly',
]);

const FILTER_WORDS = [
  'saw', 'see', 'sees', 'seeing', 'seen', 'heard', 'hear', 'hears', 'felt', 'feel', 'feels', 'feeling',
  'noticed', 'notice', 'notices', 'realized', 'realised', 'realize', 'realise', 'wondered', 'wonder', 'wonders',
  'thought', 'think', 'thinks', 'knew', 'know', 'knows', 'seemed', 'seem', 'seems', 'watched', 'watch', 'watches',
  'looked', 'decided', 'decide', 'decides', 'smelled', 'smelt', 'tasted', 'observed', 'experienced', 'sensed',
];

const WEAK_WORDS = [
  'very', 'really', 'just', 'quite', 'rather', 'somewhat', 'somehow', 'basically', 'actually', 'literally',
  'totally', 'completely', 'absolutely', 'definitely', 'certainly', 'simply', 'suddenly', 'pretty much',
  'kind of', 'sort of', 'a little', 'a bit', 'began to', 'started to', 'in order to', 'at that moment',
];

const CLICHES = [
  'at the end of the day', 'avoid like the plague', 'better late than never', 'blood ran cold', 'calm before the storm',
  'cold as ice', 'dead as a doornail', 'heart skipped a beat', 'heart pounded', 'let out a breath', 'released a breath',
  'breath (?:he|she|they|i) didn\'t know (?:he|she|they|i) was holding', 'all hell broke loose', 'in the nick of time',
  'time stood still', 'only time will tell', 'quiet as a mouse', 'scared to death', 'sent shivers down', 'shiver down (?:his|her|their|my) spine',
  'tip of the iceberg', 'white as a sheet', 'crystal clear', 'as luck would have it', 'every fiber of (?:his|her|their|my) being',
  'eyes widened', 'a single tear', 'heart in (?:his|her|their|my) throat', 'butterflies in (?:his|her|their|my) stomach',
  'dark and stormy night', 'little did (?:he|she|they|i) know', 'without further ado', 'out of the blue', 'when all is said and done',
  'the last straw', 'nerves of steel', 'sigh of relief', 'like a deer in headlights', 'fit as a fiddle', 'easier said than done',
];

const BE_VERBS = 'am|is|are|was|were|be|been|being|get|gets|got|gotten|getting';
const IRREGULAR_PARTICIPLES = [
  'awoken', 'beaten', 'begun', 'bent', 'bitten', 'bled', 'blown', 'broken', 'brought', 'built', 'burnt', 'bought', 'caught',
  'chosen', 'cut', 'dealt', 'done', 'drawn', 'driven', 'eaten', 'fed', 'felt', 'fought', 'found', 'forbidden', 'forgotten',
  'forgiven', 'frozen', 'given', 'gone', 'ground', 'grown', 'hung', 'heard', 'hidden', 'hit', 'held', 'hurt', 'kept', 'known',
  'laid', 'led', 'left', 'lent', 'lost', 'made', 'meant', 'met', 'paid', 'put', 'read', 'ridden', 'rung', 'risen', 'run',
  'said', 'seen', 'sought', 'sold', 'sent', 'set', 'shaken', 'shot', 'shown', 'shut', 'sung', 'sunk', 'slain', 'slung',
  'spoken', 'spent', 'spun', 'spread', 'stolen', 'stuck', 'stung', 'struck', 'sworn', 'swept', 'taken', 'taught', 'torn',
  'told', 'thought', 'thrown', 'understood', 'woken', 'worn', 'woven', 'won', 'wound', 'written',
];

/** Function words skipped by the overused-word and echo checks. */
const STOPWORDS = new Set((
  'a an the and or but if then so of to in on at by for from with without into onto over under about above below ' +
  'up down out off again further once here there when where why how all any both each few more most other some such ' +
  'no nor not only own same than too very can will just don should now i me my myself we our ours ourselves you your ' +
  'yours yourself yourselves he him his himself she her hers herself it its itself they them their theirs themselves ' +
  'what which who whom this that these those am is are was were be been being have has had having do does did doing ' +
  'would could ought i\'m you\'re he\'s she\'s it\'s we\'re they\'re i\'ve you\'ve we\'ve they\'ve i\'d you\'d he\'d ' +
  'she\'d we\'d they\'d i\'ll you\'ll he\'ll she\'ll we\'ll they\'ll isn\'t aren\'t wasn\'t weren\'t hasn\'t haven\'t ' +
  'hadn\'t doesn\'t don\'t didn\'t won\'t wouldn\'t shan\'t shouldn\'t can\'t cannot couldn\'t mustn\'t let\'s that\'s ' +
  'who\'s what\'s here\'s there\'s when\'s where\'s why\'s how\'s as until while because through during before after ' +
  'between against said says say like back one two get got go went come came know see look looked even still also ' +
  'away around then them well yes oh into could would might must shall may'
).split(/\s+/));

// ── Tokenising ──────────────────────────────────────────────────────────────

const WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g;

export function words(text: string): string[] {
  return (text.match(WORD_RE) || []).map((w) => w.toLowerCase().replace(/’/g, "'"));
}

export interface Sentence { text: string; start: number; end: number }

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr', 'sr', 'prof', 'mt', 'vs', 'etc', 'e.g', 'i.e', 'capt', 'lt', 'col', 'gen', 'sgt', 'rev', 'hon']);

/**
 * Split into sentences, keeping offsets into the original text. A sentence
 * ends at . ! ? or … (plus closing quotes) when the next word starts a new
 * sentence — a capital, a digit or an opening quote — or at a line break.
 * So `"No!" she said.` stays one sentence and `Mr. Hale` doesn't split.
 */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed && /[A-Za-z0-9]/.test(trimmed)) out.push({ text: trimmed, start: start + lead, end: start + lead + trimmed.length });
  };
  const re = /([.!?…]+)(["'”’)\]]*)(\s+)|\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1] === undefined) { push(m.index); start = m.index + 1; continue; }
    const end = m.index + m[1].length + m[2].length;
    if (!m[3].includes('\n')) {
      if (m[1] === '.' && !m[2]) {
        const before = text.slice(start, m.index).match(/(\S+)$/)?.[1].toLowerCase().replace(/^["'“‘(]/, '');
        if (before && (ABBREVIATIONS.has(before) || /^[a-z]$/.test(before))) continue;
      }
      const next = text[re.lastIndex];
      if (next && !/[A-Z0-9"“‘'(\[À-ÖØ-Þ]/.test(next)) continue;
    }
    push(end);
    start = end;
  }
  push(text.length);
  return out;
}

/** Rough English syllable count — good enough for readability scores. */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

// ── Issue finding ───────────────────────────────────────────────────────────

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findAll(text: string, re: RegExp, kind: IssueKind, out: ProseIssue[], filter?: (m: RegExpExecArray) => boolean) {
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    if (filter && !filter(m)) continue;
    out.push({ kind, start: m.index, end: m.index + m[0].length, match: m[0] });
  }
}

const ADVERB_RE = /\b[A-Za-z]{3,}ly\b/g;
const PASSIVE_RE = new RegExp(`\\b(?:${BE_VERBS})\\s+(?:(?:not|never|always|also|just|being)\\s+)?(?:[a-z]+ed|${IRREGULAR_PARTICIPLES.join('|')})\\b(?:\\s+by\\b)?`, 'gi');
const FILTER_RE = new RegExp(`\\b(?:${FILTER_WORDS.join('|')})\\b`, 'gi');
const WEAK_RE = new RegExp(`\\b(?:${WEAK_WORDS.map((w) => escapeRe(w).replace(/ /g, '\\s+')).join('|')})\\b`, 'gi');
const CLICHE_RE = new RegExp(`\\b(?:${CLICHES.map((c) => c.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi');

/** Adjective-ish -ed words that follow "was" without being passive. */
const PASSIVE_FALSE_POSITIVES = /\b(?:was|were|is|are|am|be|been)\s+(?:tired|bored|scared|interested|excited|worried|married|related|supposed|used|pleased|surprised|annoyed|confused|tied|ashamed|embarrassed|exhausted|terrified|frightened|amazed|delighted|disappointed|determined|prepared|involved|located|dressed|naked|wicked|crooked|beloved|aged|blessed|cursed|learned|rugged|sacred)\b/i;

export function findIssues(text: string): ProseIssue[] {
  const issues: ProseIssue[] = [];
  findAll(text, new RegExp(ADVERB_RE), 'adverb', issues, (m) => !LY_EXCEPTIONS.has(m[0].toLowerCase()));
  findAll(text, new RegExp(PASSIVE_RE), 'passive', issues, (m) => !PASSIVE_FALSE_POSITIVES.test(m[0]));
  findAll(text, new RegExp(FILTER_RE), 'filter', issues);
  findAll(text, new RegExp(WEAK_RE), 'weak', issues);
  findAll(text, new RegExp(CLICHE_RE), 'cliche', issues);

  const sentences = splitSentences(text);
  for (const s of sentences) {
    if (words(s.text).length > 35) issues.push({ kind: 'long_sentence', start: s.start, end: s.end, match: s.text });
  }

  // Three or more consecutive sentences opening with the same word.
  for (let i = 0; i + 2 < sentences.length; i++) {
    const first = (s: Sentence) => words(s.text)[0];
    const w = first(sentences[i]);
    if (!w) continue;
    let j = i + 1;
    while (j < sentences.length && first(sentences[j]) === w) j++;
    if (j - i >= 3) {
      for (let k = i; k < j; k++) {
        const s = sentences[k];
        const lead = s.text.match(WORD_RE)?.[0] ?? '';
        issues.push({ kind: 'repeat_start', start: s.start, end: s.start + lead.length, match: lead });
      }
      i = j - 1;
    }
  }

  // Echoes: an uncommon word (6+ letters, not a stopword) repeated within ~50 words.
  const tokenRe = new RegExp(WORD_RE);
  const recent = new Map<string, number>();
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = tokenRe.exec(text)) !== null) {
    const w = m[0].toLowerCase();
    if (w.length >= 6 && !STOPWORDS.has(w)) {
      const last = recent.get(w);
      if (last !== undefined && idx - last <= 50) {
        issues.push({ kind: 'echo', start: m.index, end: m.index + m[0].length, match: m[0] });
      }
      recent.set(w, idx);
    }
    idx++;
  }

  return issues.sort((a, b) => a.start - b.start || b.end - a.end);
}

// ── Report ──────────────────────────────────────────────────────────────────

export interface ProseReport {
  words: number;
  sentences: number;
  paragraphs: number;
  characters: number;
  avgSentenceLength: number;
  avgWordLength: number;
  /** Flesch reading ease: 0–100, higher is easier. */
  readingEase: number;
  /** Flesch–Kincaid grade level. */
  gradeLevel: number;
  readingMinutes: number;
  uniqueWordRatio: number;
  /** Share of words inside quotation marks. */
  dialogueRatio: number;
  counts: Record<IssueKind, number>;
  overused: { word: string; count: number; per10k: number }[];
  repeatedPhrases: { phrase: string; count: number }[];
  sentenceLengths: number[];
}

export function analyzeProse(text: string): ProseReport {
  const allWords = words(text);
  const sentences = splitSentences(text);
  const paragraphs = text.split(/\n+/).filter((p) => p.trim()).length;
  const totalSyllables = allWords.reduce((n, w) => n + syllables(w), 0);
  const wc = allWords.length;
  const sc = Math.max(1, sentences.length);

  const wordsPerSentence = wc / sc;
  const syllablesPerWord = wc ? totalSyllables / wc : 0;
  const readingEase = wc ? 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord : 0;
  const gradeLevel = wc ? 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59 : 0;

  // Dialogue: words between straight or curly double quotes.
  let dialogueWords = 0;
  for (const q of text.match(/["“][^"”]*["”]/g) || []) dialogueWords += words(q).length;

  const issues = findIssues(text);
  const counts = Object.fromEntries(Object.keys(ISSUE_INFO).map((k) => [k, 0])) as Record<IssueKind, number>;
  for (const i of issues) counts[i.kind]++;

  const freq = new Map<string, number>();
  for (const w of allWords) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const overused = Array.from(freq.entries())
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word, count]) => ({ word, count, per10k: wc ? Math.round((count / wc) * 10000) : 0 }));

  // Three- and four-word phrases used three or more times, ignoring all-stopword phrases.
  const phraseCounts = new Map<string, number>();
  for (const s of sentences) {
    const sw = words(s.text);
    for (const n of [4, 3]) {
      for (let i = 0; i + n <= sw.length; i++) {
        const gram = sw.slice(i, i + n);
        if (gram.every((g) => STOPWORDS.has(g))) continue;
        const key = gram.join(' ');
        phraseCounts.set(key, (phraseCounts.get(key) || 0) + 1);
      }
    }
  }
  const phrases = Array.from(phraseCounts.entries()).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  // Drop a 3-gram when a 4-gram containing it is listed with the same count.
  const repeatedPhrases: { phrase: string; count: number }[] = [];
  for (const [phrase, count] of phrases) {
    if (repeatedPhrases.some((r) => r.count === count && r.phrase.includes(phrase))) continue;
    repeatedPhrases.push({ phrase, count });
    if (repeatedPhrases.length >= 20) break;
  }

  return {
    words: wc,
    sentences: sentences.length,
    paragraphs,
    characters: text.replace(/\s/g, '').length,
    avgSentenceLength: sentences.length ? wc / sentences.length : 0,
    avgWordLength: wc ? allWords.reduce((n, w) => n + w.length, 0) / wc : 0,
    readingEase: Math.max(0, Math.min(100, readingEase)),
    gradeLevel: Math.max(0, gradeLevel),
    readingMinutes: wc / 250,
    uniqueWordRatio: wc ? new Set(allWords).size / wc : 0,
    dialogueRatio: wc ? Math.min(1, dialogueWords / wc) : 0,
    counts,
    overused,
    repeatedPhrases,
    sentenceLengths: sentences.map((s) => words(s.text).length),
  };
}

export function readingEaseLabel(score: number): string {
  if (score >= 90) return 'Very easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly easy';
  if (score >= 60) return 'Plain English';
  if (score >= 50) return 'Fairly difficult';
  if (score >= 30) return 'Difficult';
  return 'Very difficult';
}
