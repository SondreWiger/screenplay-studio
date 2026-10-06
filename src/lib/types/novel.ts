// Novel Types — books and short stories (project_type 'novel')

export type NovelItemKind = 'part' | 'chapter' | 'front_matter' | 'back_matter';
export type NovelChapterStatus = 'idea' | 'outline' | 'draft' | 'revised' | 'final';
export type NovelTense = 'past' | 'present' | 'future' | 'mixed';

export interface NovelChapter {
  id: string;
  project_id: string;
  kind: NovelItemKind;
  title: string;
  /** Sanitised HTML: <p>, <em>, <strong>, <u>, <s>, <blockquote>, <h2>, <hr>. */
  content: string;
  synopsis: string | null;
  status: NovelChapterStatus;
  pov_character_id: string | null;
  pov: string | null;
  tense: NovelTense | null;
  label_color: string | null;
  target_words: number | null;
  word_count: number;
  notes: string | null;
  include_in_export: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NovelSnapshot {
  id: string;
  project_id: string;
  chapter_id: string;
  label: string | null;
  title: string;
  content: string;
  word_count: number;
  created_by: string | null;
  created_at: string;
}

export interface NovelWritingLogEntry {
  id: string;
  project_id: string;
  user_id: string;
  day: string;
  words: number;
  sprints: number;
}

export interface NovelTimelineEvent {
  id: string;
  project_id: string;
  title: string;
  story_date: string | null;
  description: string | null;
  chapter_id: string | null;
  character_ids: string[];
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Book-level settings, stored in projects.content_metadata.novel. */
export interface NovelSettings {
  target_words?: number | null;
  daily_goal?: number | null;
  deadline?: string | null;
  author_name?: string | null;
  pen_name?: string | null;
  contact_block?: string | null;
  category?: string | null;           // 'adult' | 'ya' | 'middle_grade' | ...
  scene_break?: string | null;        // glyph used for scene breaks in exports
  chapter_numbering?: 'words' | 'numerals' | 'roman' | 'none' | null;
  query_kit?: NovelQueryKit;
}

export interface NovelQueryKit {
  hook?: string;
  pitch_paragraph?: string;
  synopsis_short?: string;
  synopsis_long?: string;
  blurb?: string;
  /** Query letter bio, usually first person. */
  author_bio?: string;
  /** Back-cover / retailer bio, third person. */
  cover_bio?: string;
  comps?: { title: string; author: string; year: string; why: string }[];
  keywords?: string[];
  personalisation?: string;
}

export const NOVEL_STATUS_CONFIG: Record<NovelChapterStatus, { label: string; dot: string; text: string }> = {
  idea:    { label: 'Idea',    dot: 'bg-surface-500', text: 'text-surface-400' },
  outline: { label: 'Outline', dot: 'bg-sky-400',     text: 'text-sky-400' },
  draft:   { label: 'Draft',   dot: 'bg-amber-400',   text: 'text-amber-400' },
  revised: { label: 'Revised', dot: 'bg-violet-400',  text: 'text-violet-400' },
  final:   { label: 'Final',   dot: 'bg-emerald-400', text: 'text-emerald-400' },
};

export const NOVEL_KIND_LABELS: Record<NovelItemKind, string> = {
  part: 'Part',
  chapter: 'Chapter',
  front_matter: 'Front matter',
  back_matter: 'Back matter',
};

/** Shown in step 1 of New Project when Novel is picked. Stored in projects.format. */
export const NOVEL_FORMAT_OPTIONS: { value: string; label: string; description: string; words: [number, number] }[] = [
  { value: 'novel',        label: 'Novel',          description: 'Full-length book',                  words: [70000, 110000] },
  { value: 'novella',      label: 'Novella',        description: 'Short novel',                       words: [17500, 40000] },
  { value: 'novelette',    label: 'Novelette',      description: 'Long short story',                  words: [7500, 17500] },
  { value: 'short_story',  label: 'Short Story',    description: 'Magazines, anthologies, contests',  words: [1000, 7500] },
  { value: 'flash',        label: 'Flash Fiction',  description: 'Under a thousand words',            words: [100, 1000] },
  { value: 'collection',   label: 'Collection',     description: 'Stories gathered into one book',    words: [40000, 90000] },
  { value: 'serial',       label: 'Web Serial',     description: 'Published chapter by chapter',      words: [50000, 250000] },
];

/** Genres offered for novels in New Project (film genres don't fit books). */
export const NOVEL_GENRE_OPTIONS = [
  'Literary', 'Contemporary', 'Fantasy', 'Science Fiction', 'Mystery', 'Thriller', 'Crime', 'Romance', 'Horror',
  'Historical', 'Young Adult', 'Middle Grade', 'Adventure', 'Dystopian', 'Magical Realism', 'Humour', 'Memoir', 'Short Fiction',
];

/** Typical debut word-count ranges agents and editors expect, by genre. */
export const GENRE_WORD_RANGES: { genre: string; min: number; max: number }[] = [
  { genre: 'Literary fiction',     min: 70000,  max: 100000 },
  { genre: 'Commercial fiction',   min: 80000,  max: 100000 },
  { genre: 'Mystery / Thriller',   min: 70000,  max: 90000 },
  { genre: 'Romance',              min: 50000,  max: 90000 },
  { genre: 'Science fiction',      min: 90000,  max: 120000 },
  { genre: 'Fantasy',              min: 90000,  max: 120000 },
  { genre: 'Horror',               min: 70000,  max: 90000 },
  { genre: 'Historical fiction',   min: 80000,  max: 100000 },
  { genre: 'Young adult',          min: 60000,  max: 90000 },
  { genre: 'Middle grade',         min: 30000,  max: 55000 },
  { genre: 'Memoir',               min: 70000,  max: 90000 },
];
