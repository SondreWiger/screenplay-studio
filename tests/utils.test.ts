import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  formatDate,
  formatDateTime,
  formatTime,
  timeAgo,
  generateSceneNumber,
  estimatePageCount,
  getInitials,
  slugify,
  formatCurrency,
  formatNumber,
  getChallengePhase,
  getPhaseLabel,
  getPhaseColor,
  timeUntil,
  escapeHtml,
  stripHtml,
  isValidEmail,
  isValidUrl,
  sanitizeFilename,
  truncate,
  debounce,
} from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('deduplicates tailwind classes', () => {
    expect(cn('px-4 py-2', 'px-8')).toBe('py-2 px-8');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2025-06-15');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date('2025-01-01'));
    expect(result).toContain('Jan');
    expect(result).toContain('2025');
  });
});

describe('formatDateTime', () => {
  it('includes date and time components', () => {
    const result = formatDateTime('2025-06-15T14:30:00');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });
});

describe('formatTime', () => {
  it('returns a time string', () => {
    const result = formatTime('2025-06-15T14:30:00');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for recent times', () => {
    expect(timeAgo('2025-06-15T11:59:50Z')).toBe('just now');
  });

  it('returns minutes ago', () => {
    expect(timeAgo('2025-06-15T11:55:00Z')).toBe('5m ago');
  });

  it('returns hours ago', () => {
    expect(timeAgo('2025-06-15T09:00:00Z')).toBe('3h ago');
  });

  it('returns days ago', () => {
    expect(timeAgo('2025-06-13T12:00:00Z')).toBe('2d ago');
  });

  it('returns formatted date for old dates', () => {
    const result = timeAgo('2025-05-01T12:00:00Z');
    expect(result).toContain('May');
    expect(result).toContain('2025');
  });
});

describe('generateSceneNumber', () => {
  it('returns 1-based string from 0-based index', () => {
    expect(generateSceneNumber(0)).toBe('1');
    expect(generateSceneNumber(5)).toBe('6');
    expect(generateSceneNumber(99)).toBe('100');
  });
});

describe('estimatePageCount', () => {
  it('returns minimum 0.125 for empty content', () => {
    expect(estimatePageCount('')).toBe(0.125);
  });

  it('estimates based on line count', () => {
    const content = Array(56).fill('line').join('\n');
    expect(estimatePageCount(content)).toBe(1);
  });

  it('rounds to nearest 1/8 page', () => {
    const content = Array(28).fill('line').join('\n');
    const result = estimatePageCount(content);
    expect(result % 0.125).toBe(0);
  });
});

describe('getInitials', () => {
  it('returns first two characters uppercase', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('handles single name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('returns ? for null', () => {
    expect(getInitials(null)).toBe('?');
  });

  it('returns ? for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('caps at 2 characters', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello! @World#')).toBe('hello-world');
  });

  it('handles multiple spaces/underscores', () => {
    expect(slugify('hello   world__foo')).toBe('hello-world-foo');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify(' hello world ')).toBe('hello-world');
  });
});

describe('formatCurrency', () => {
  it('formats as USD', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('formatNumber', () => {
  it('formats with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('getChallengePhase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "upcoming" when now is before starts_at', () => {
    expect(getChallengePhase({
      starts_at: '2025-12-31T00:00:00Z',
      submissions_close_at: '2026-01-07T00:00:00Z',
      voting_close_at: '2026-01-14T00:00:00Z',
      reveal_at: '2026-01-21T00:00:00Z',
    })).toBe('upcoming');
  });

  it('returns "submissions" when in submission window', () => {
    expect(getChallengePhase({
      starts_at: '2025-01-01T00:00:00Z',
      submissions_close_at: '2025-12-31T00:00:00Z',
      voting_close_at: '2026-01-14T00:00:00Z',
      reveal_at: '2026-01-21T00:00:00Z',
    })).toBe('submissions');
  });

  it('returns "voting" when in voting window', () => {
    expect(getChallengePhase({
      starts_at: '2025-01-01T00:00:00Z',
      submissions_close_at: '2025-06-01T00:00:00Z',
      voting_close_at: '2025-12-31T00:00:00Z',
      reveal_at: '2026-01-21T00:00:00Z',
    })).toBe('voting');
  });

  it('returns "reveal_pending" before reveal', () => {
    expect(getChallengePhase({
      starts_at: '2025-01-01T00:00:00Z',
      submissions_close_at: '2025-03-01T00:00:00Z',
      voting_close_at: '2025-06-01T00:00:00Z',
      reveal_at: '2025-12-31T00:00:00Z',
    })).toBe('reveal_pending');
  });

  it('returns "completed" after reveal', () => {
    expect(getChallengePhase({
      starts_at: '2025-01-01T00:00:00Z',
      submissions_close_at: '2025-03-01T00:00:00Z',
      voting_close_at: '2025-06-01T00:00:00Z',
      reveal_at: '2025-06-01T00:00:00Z',
    })).toBe('completed');
  });
});

describe('getPhaseLabel', () => {
  it('returns correct labels', () => {
    expect(getPhaseLabel('upcoming')).toBe('Starting Soon');
    expect(getPhaseLabel('submissions')).toBe('Submissions Open');
    expect(getPhaseLabel('voting')).toBe('Voting Open');
    expect(getPhaseLabel('reveal_pending')).toBe('Results Pending');
    expect(getPhaseLabel('completed')).toBe('Completed');
  });

  it('returns raw phase for unknown', () => {
    expect(getPhaseLabel('unknown')).toBe('unknown');
  });
});

describe('getPhaseColor', () => {
  it('returns a class string for each phase', () => {
    expect(getPhaseColor('upcoming')).toContain('blue');
    expect(getPhaseColor('submissions')).toContain('green');
    expect(getPhaseColor('voting')).toContain('amber');
    expect(getPhaseColor('reveal_pending')).toContain('purple');
    expect(getPhaseColor('completed')).toContain('stone');
  });

  it('returns default for unknown', () => {
    expect(getPhaseColor('unknown')).toBe('text-stone-600 bg-stone-100');
  });
});

describe('timeUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "now" for past dates', () => {
    expect(timeUntil('2025-06-14T12:00:00Z')).toBe('now');
  });

  it('returns minutes for short durations', () => {
    expect(timeUntil('2025-06-15T12:30:00Z')).toBe('30m');
  });

  it('returns hours and minutes', () => {
    expect(timeUntil('2025-06-15T15:45:00Z')).toBe('3h 45m');
  });

  it('returns days and hours', () => {
    expect(timeUntil('2025-06-18T18:00:00Z')).toBe('3d 6h');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes single quote', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('returns clean text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>hello</p>')).toBe('hello');
  });

  it('removes nested tags', () => {
    expect(stripHtml('<div><b>bold</b> text</div>')).toBe('bold text');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('no tags')).toBe('no tags');
  });
});

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('name.last@domain.co')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user @domain.com')).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('rejects non-http protocols', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('removes special characters', () => {
    expect(sanitizeFilename('my file (1).txt')).toBe('my_file_1.txt');
  });

  it('preserves dots and hyphens', () => {
    expect(sanitizeFilename('my-file.name.txt')).toBe('my-file.name.txt');
  });

  it('replaces spaces with underscores', () => {
    expect(sanitizeFilename('hello world')).toBe('hello_world');
  });

  it('truncates to 255 chars', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeFilename(long)).toHaveLength(255);
  });
});

describe('truncate', () => {
  it('returns text unchanged if under max', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello w…');
  });

  it('respects custom ellipsis', () => {
    expect(truncate('hello world', 8, '...')).toBe('hello...');
  });

  it('handles exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels previous calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('a', 'b');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });
});
