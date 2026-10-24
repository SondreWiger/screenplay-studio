import { describe, it, expect } from 'vitest';
import {
  cleanPollSource, computePollAnalytics, formatDuration, median, percentile, respondentsToCSV, type Respondent,
} from '@/lib/polls/analytics';

const person = (id: string, over: Partial<Respondent> = {}): Respondent => ({
  user_id: id, name: id, username: null, avatar_url: null, email: `${id}@x.test`,
  response_id: `r-${id}`, completed_at: '2026-10-20T10:00:00Z', started_at: null,
  duration_ms: null, source: null, resumed: false, answers: {}, ...over,
});

describe('poll analytics', () => {
  it('median / percentile / duration formatting', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3); // rounds 2.5
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(200_000)).toBe('3m 20s');
    expect(formatDuration(3_900_000)).toBe('1h 5m');
    expect(formatDuration(null)).toBe('—');
  });

  it('only accepts known sources', () => {
    expect(cleanPollSource('popup')).toBe('popup');
    expect(cleanPollSource('evil')).toBeNull();
    expect(cleanPollSource(3)).toBeNull();
  });

  it('builds the funnel, drop-off and per-question timings', () => {
    const respondents = [
      person('a', { duration_ms: 60_000, source: 'popup', answers: { q1: { text: 'yes', list: null, time_ms: 4000 }, q2: { text: '', list: null, time_ms: 1000 } } }),
      person('b', { duration_ms: 120_000, source: 'popup', answers: { q1: { text: 'no', list: null, time_ms: 6000 }, q2: { text: 'Hi', list: null, time_ms: 9000 } } }),
      person('old'), // answered before tracking existed: no view row, no timings
    ];
    const views = [
      { user_id: 'a', first_shown_at: '2026-10-19T00:00:00Z', max_step: 2, dismiss_count: 0, source: 'popup' },
      { user_id: 'b', first_shown_at: '2026-10-19T01:00:00Z', max_step: 2, dismiss_count: 1, source: 'popup' },
      { user_id: 'c', first_shown_at: '2026-10-19T02:00:00Z', max_step: 0, dismiss_count: 2, source: 'popup' },
      { user_id: 'd', first_shown_at: '2026-10-19T03:00:00Z', max_step: 1, dismiss_count: 0, source: 'link' },
    ];
    const a = computePollAnalytics(['q1', 'q2'], respondents, views);
    expect(a.views).toBe(5);
    expect(a.started).toBe(4);
    expect(a.completed).toBe(3);
    expect(a.dismissed).toBe(1); // b closed it once but finished later
    expect(a.median_ms).toBe(90_000);
    expect(a.timed_responses).toBe(2);
    expect(a.dropoff).toEqual([{ step: 0, count: 1 }, { step: 1, count: 1 }]);
    expect(a.by_source).toEqual([{ label: 'popup', count: 2 }, { label: 'unknown', count: 1 }]);
    expect(a.question_times[0]).toMatchObject({ answered: 2, skipped: 1, median_ms: 5000 });
    expect(a.question_times[1]).toMatchObject({ answered: 1, skipped: 2 });
    expect(a.tracked_since).toBe('2026-10-19T00:00:00Z');
  });

  it('exports CSV with escaping and no spreadsheet formulas', () => {
    const csv = respondentsToCSV(
      [{ id: 'q1', question_text: 'Why, though?' }, { id: 'q2', question_text: 'Pick' }],
      [person('a', { name: 'Ann "A"', duration_ms: 61_000, answers: { q1: { text: '=HYPERLINK("x")', list: null, time_ms: null }, q2: { text: null, list: ['x', 'y'], time_ms: null } } })],
    );
    const [header, row] = csv.split('\r\n');
    expect(header).toBe('Name,Username,Email,Completed,Time spent (s),Source,"Why, though?",Pick');
    expect(row).toContain('"Ann ""A"""');
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain('x | y');
    expect(row).toContain(',61,');
  });
});
