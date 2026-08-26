import { describe, it, expect } from 'vitest';
import {
  personInitials, personColor, personMatches,
  PERSON_CATEGORIES, PERSON_CATEGORY_LABEL, PERSON_CATEGORY_TONE,
  type Person,
} from '@/lib/types';

function person(over: Partial<Person> = {}): Person {
  return {
    id: 'p1', owner_id: 'u1', name: 'Ada Lovelace', category: 'crew',
    role: 'Gaffer', department: 'Grip & Electric', email: 'ada@example.com',
    phone: null, location: 'Oslo', agency: 'Northem', day_rate: 900,
    currency: 'USD', links: {}, tags: ['night shoots'], rating: 5,
    is_favourite: true, notes: null, last_worked_at: null,
    created_at: '2026-01-01', updated_at: '2026-01-01', ...over,
  };
}

describe('personInitials', () => {
  it('uses first and last name', () => {
    expect(personInitials('Ada Lovelace')).toBe('AL');
    expect(personInitials('Jean-Luc Picard Jr')).toBe('JJ');
  });

  it('falls back to two letters for a single name', () => {
    expect(personInitials('Cher')).toBe('CH');
  });

  it('survives empty and whitespace-only input', () => {
    expect(personInitials('')).toBe('?');
    expect(personInitials('   ')).toBe('?');
  });

  it('collapses extra whitespace', () => {
    expect(personInitials('  Ada   Lovelace  ')).toBe('AL');
  });
});

describe('personColor', () => {
  it('is stable for the same name', () => {
    expect(personColor('Ada Lovelace')).toBe(personColor('Ada Lovelace'));
  });

  it('always returns a colour', () => {
    for (const name of ['A', 'Ada', '', 'Zoë Ø', '陈']) {
      expect(personColor(name)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('personMatches', () => {
  const p = person();

  it('matches an empty query', () => {
    expect(personMatches(p, '')).toBe(true);
    expect(personMatches(p, '   ')).toBe(true);
  });

  it('searches name, role, department, agency, location and tags', () => {
    expect(personMatches(p, 'lovelace')).toBe(true);
    expect(personMatches(p, 'gaffer')).toBe(true);
    expect(personMatches(p, 'grip')).toBe(true);
    expect(personMatches(p, 'northem')).toBe(true);
    expect(personMatches(p, 'oslo')).toBe(true);
    expect(personMatches(p, 'night')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(personMatches(p, 'ADA')).toBe(true);
  });

  it('returns false for no match', () => {
    expect(personMatches(p, 'zzz')).toBe(false);
  });

  it('handles a person with mostly null fields', () => {
    const sparse = person({
      role: null, department: null, email: null, agency: null,
      location: null, notes: null, tags: [],
    });
    expect(personMatches(sparse, 'ada')).toBe(true);
    expect(personMatches(sparse, 'gaffer')).toBe(false);
  });
});

describe('category metadata', () => {
  it('labels and tones every category', () => {
    for (const c of PERSON_CATEGORIES) {
      expect(PERSON_CATEGORY_LABEL[c], c).toBeTruthy();
      expect(PERSON_CATEGORY_TONE[c], c).toBeTruthy();
    }
  });

  it('gives each category its own tone', () => {
    const tones = PERSON_CATEGORIES.map((c) => PERSON_CATEGORY_TONE[c]);
    expect(new Set(tones).size).toBe(tones.length);
  });
});
