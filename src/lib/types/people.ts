// People directory — the cross-project address book.

export type PersonCategory =
  | 'crew' | 'talent' | 'vendor' | 'agent' | 'writer' | 'producer' | 'other';

export const PERSON_CATEGORIES: PersonCategory[] = [
  'crew', 'talent', 'vendor', 'agent', 'writer', 'producer', 'other',
];

export const PERSON_CATEGORY_LABEL: Record<PersonCategory, string> = {
  crew: 'Crew',
  talent: 'Talent',
  vendor: 'Vendor',
  agent: 'Agent',
  writer: 'Writer',
  producer: 'Producer',
  other: 'Other',
};

/** Badge classes per category — mirrors the tone palette used elsewhere. */
export const PERSON_CATEGORY_TONE: Record<PersonCategory, string> = {
  crew: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  talent: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  vendor: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  agent: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
  writer: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  producer: 'text-brand-500 bg-brand-500/10 border-brand-500/30',
  other: 'text-surface-400 bg-surface-800 border-surface-700',
};

/** Common departments, offered as suggestions rather than enforced. */
export const PERSON_DEPARTMENTS = [
  'Production', 'Direction', 'Camera', 'Grip & Electric', 'Art', 'Costume',
  'Hair & Make-up', 'Sound', 'Post', 'VFX', 'Music', 'Locations', 'Transport',
  'Casting', 'Stunts', 'Catering', 'Other',
];

export interface PersonLinks {
  imdb?: string;
  reel?: string;
  website?: string;
  instagram?: string;
}

export interface Person {
  id: string;
  owner_id: string;
  name: string;
  category: PersonCategory;
  role: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  agency: string | null;
  day_rate: number | null;
  currency: string | null;
  links: PersonLinks;
  tags: string[];
  rating: number | null;
  is_favourite: boolean;
  notes: string | null;
  last_worked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonCredit {
  id: string;
  owner_id: string;
  person_id: string;
  project_id: string | null;
  production_name: string | null;
  role: string | null;
  year: number | null;
  created_at: string;
}

/** Initials for the avatar fallback. */
export function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable colour per person, so the same face keeps the same swatch. */
export function personColor(name: string): string {
  const palette = ['#f97316', '#0ea5e9', '#8b5cf6', '#10b981', '#f43f5e', '#eab308', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

/** Search a person across everything worth matching on. */
export function personMatches(person: Person, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    person.name, person.role, person.department, person.email,
    person.agency, person.location, person.notes,
    ...person.tags,
  ].some((v) => (v ?? '').toLowerCase().includes(q));
}
