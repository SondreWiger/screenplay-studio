import { describe, it, expect } from 'vitest';
import { aggregateLogsByDate, calculateStreak } from '@/lib/work-tracker';

describe('aggregateLogsByDate', () => {
  it('aggregates logs by date', () => {
    const logs = [
      { log_date: '2025-06-15', pages_written: 2, session_minutes: 30 },
      { log_date: '2025-06-15', pages_written: 3, session_minutes: 20 },
    ];
    const result = aggregateLogsByDate(logs);
    expect(result.get('2025-06-15')).toEqual({ pages: 5, minutes: 50 });
  });

  it('handles multiple dates', () => {
    const logs = [
      { log_date: '2025-06-15', pages_written: 1, session_minutes: 10 },
      { log_date: '2025-06-16', pages_written: 2, session_minutes: 20 },
    ];
    const result = aggregateLogsByDate(logs);
    expect(result.size).toBe(2);
    expect(result.get('2025-06-15')).toEqual({ pages: 1, minutes: 10 });
    expect(result.get('2025-06-16')).toEqual({ pages: 2, minutes: 20 });
  });

  it('returns empty map for empty logs', () => {
    expect(aggregateLogsByDate([]).size).toBe(0);
  });
});

describe('calculateStreak', () => {
  it('returns 0 for empty logs', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('counts consecutive days', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      logs.push({
        log_date: d.toISOString().slice(0, 10),
        pages_written: 1,
        session_minutes: 30,
      });
    }

    const streak = calculateStreak(logs);
    expect(streak).toBeGreaterThanOrEqual(4);
  });

  it('breaks streak on missing day', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = [];
    // 2 days ago and 4 days ago (gap at 3 days ago means no consecutive run from today)
    for (const offset of [4, 2]) {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      logs.push({
        log_date: d.toISOString().slice(0, 10),
        pages_written: 1,
        session_minutes: 30,
      });
    }

    const streak = calculateStreak(logs);
    expect(streak).toBe(0);
  });

  it('allows today to have no activity without breaking streak', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = [];
    // Yesterday and 2 days ago (today has no data)
    for (const offset of [2, 1]) {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      logs.push({
        log_date: d.toISOString().slice(0, 10),
        pages_written: 1,
        session_minutes: 30,
      });
    }

    const streak = calculateStreak(logs);
    expect(streak).toBeGreaterThanOrEqual(1);
  });
});
