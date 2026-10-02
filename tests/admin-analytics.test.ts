import { describe, expect, it } from 'vitest';
import {
  RANGES, addUnit, bucketIndex, bucketize, bucketizePrevious, compact, countBy, floorTo,
  formatDuration, pctChange, resolveRange, weekdayHourGrid,
} from '@/lib/admin/analytics';

const NOW = Date.UTC(2026, 9, 2, 14, 37, 12); // Fri Oct 2 2026 14:37:12 UTC
const DAY = 86_400_000;

describe('floorTo / addUnit', () => {
  it('aligns to UTC boundaries', () => {
    expect(new Date(floorTo(NOW, 'hour')).toISOString()).toBe('2026-10-02T14:00:00.000Z');
    expect(new Date(floorTo(NOW, '5m')).toISOString()).toBe('2026-10-02T14:35:00.000Z');
    expect(new Date(floorTo(NOW, '6h')).toISOString()).toBe('2026-10-02T12:00:00.000Z');
    expect(new Date(floorTo(NOW, 'day')).toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(new Date(floorTo(NOW, 'week')).toISOString()).toBe('2026-09-28T00:00:00.000Z'); // Monday
    expect(new Date(floorTo(NOW, 'month')).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('adds calendar months across year ends', () => {
    expect(new Date(addUnit(Date.UTC(2026, 11, 1), 'month')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(new Date(addUnit(Date.UTC(2026, 0, 1), 'month', -1)).toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });
});

describe('resolveRange', () => {
  it('produces contiguous buckets that cover the window up to now', () => {
    for (const r of RANGES) {
      const range = resolveRange(r.key, NOW, Date.UTC(2024, 2, 15));
      expect(range.buckets[0]).toBeLessThanOrEqual(range.start);
      expect(range.buckets[range.buckets.length - 1]).toBeLessThanOrEqual(NOW);
      expect(addUnit(range.buckets[range.buckets.length - 1], range.unit)).toBeGreaterThan(NOW);
      for (let i = 1; i < range.buckets.length; i++) {
        expect(range.buckets[i]).toBe(addUnit(range.buckets[i - 1], range.unit));
      }
    }
  });

  it('has a previous window of equal length except for all-time', () => {
    const r = resolveRange('7d', NOW);
    expect(r.start - r.prevStart!).toBe(7 * DAY);
    expect(resolveRange('all', NOW, null).prevStart).toBeNull();
  });

  it('anchors all-time on the earliest data point', () => {
    const r = resolveRange('all', NOW, Date.UTC(2024, 2, 15));
    expect(new Date(r.buckets[0]).toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(r.unit).toBe('month');
  });

  it('uses sensible bucket counts', () => {
    expect(resolveRange('1h', NOW).buckets.length).toBe(13);
    expect(resolveRange('24h', NOW).buckets.length).toBe(25);
    expect(resolveRange('30d', NOW).buckets.length).toBe(31);
  });
});

describe('bucketize', () => {
  const range = resolveRange('7d', NOW);

  it('counts rows into the right bucket and ignores out-of-range rows', () => {
    const rows = [
      { t: new Date(NOW - 1000).toISOString() },
      { t: new Date(NOW - 2000).toISOString() },
      { t: new Date(range.buckets[0]).toISOString() },
      { t: new Date(range.buckets[0] - 1).toISOString() },
      { t: null },
    ];
    const out = bucketize(rows, range.buckets, (r) => r.t);
    expect(out[out.length - 1]).toBe(2);
    expect(out[0]).toBe(1);
    expect(out.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('sums a value when given', () => {
    const rows = [{ t: NOW - 10, v: 30 }, { t: NOW - 20, v: 12 }];
    expect(bucketize(rows, range.buckets, (r) => r.t, (r) => r.v).at(-1)).toBe(42);
  });

  it('aligns the previous window onto the current buckets', () => {
    const rows = [{ t: NOW - 7 * DAY - 1000 }, { t: NOW - 1000 }];
    const prev = bucketizePrevious(rows, range, (r) => r.t)!;
    expect(prev.at(-1)).toBe(1);
    expect(prev.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('finds bucket indexes by binary search', () => {
    const b = [0, 10, 20, 30];
    expect(bucketIndex(b, -1)).toBe(-1);
    expect(bucketIndex(b, 0)).toBe(0);
    expect(bucketIndex(b, 19)).toBe(1);
    expect(bucketIndex(b, 99)).toBe(3);
  });
});

describe('helpers', () => {
  it('pctChange handles empty baselines', () => {
    expect(pctChange(15, 10)).toBe(50);
    expect(pctChange(5, 10)).toBe(-50);
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(3, 0)).toBeNull();
    expect(pctChange(3, null)).toBeNull();
  });

  it('countBy sorts and folds the tail into Other', () => {
    const rows = ['a', 'a', 'a', 'b', 'b', 'c', 'd', null].map((k) => ({ k }));
    expect(countBy(rows, (r) => r.k, 3)).toEqual([
      { label: 'a', count: 3 },
      { label: 'b', count: 2 },
      { label: 'Other', count: 3 },
    ]);
  });

  it('weekdayHourGrid puts Monday first', () => {
    const grid = weekdayHourGrid([Date.UTC(2026, 8, 28, 9), NOW]); // Mon 09h, Fri 14h
    expect(grid[0][9]).toBe(1);
    expect(grid[4][14]).toBe(1);
  });

  it('formats compact numbers and durations', () => {
    expect(compact(999)).toBe('999');
    expect(compact(12_345)).toBe('12.3K');
    expect(compact(2_500_000)).toBe('2.5M');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(3_725)).toBe('1h 2m');
  });
});
