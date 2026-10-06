import { describe, it, expect } from 'vitest';
import { scoreEngagement, ACTIVE_DAY_SECONDS, type EngagementInput } from '@/lib/engagement';

const NOW = new Date('2026-10-06T12:00:00Z');

function days(spec: Record<string, number>): Record<string, number> {
  return spec;
}

/** `count` days of work, `every` days apart, ending yesterday. */
function spread(count: number, every: number, secondsEach: number) {
  const out: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    const d = new Date(NOW.getTime() - (1 + i * every) * 86_400_000);
    out[d.toISOString().slice(0, 10)] = secondsEach;
  }
  return out;
}

const base: EngagementInput = {
  workByDay: {},
  projects: 0,
  contentEdits: 0,
  priorWorkSeconds: 0,
  priorContentEdits: 0,
  lastActiveAt: null,
};

describe('scoreEngagement', () => {
  it('rates steady, productive work as committed', () => {
    const r = scoreEngagement({ ...base, workByDay: spread(12, 2, 3600), projects: 2, contentEdits: 400, lastActiveAt: '2026-10-05T20:00:00Z' }, 30, NOW);
    expect(r.tier).toBe('committed');
    expect(r.activeDays).toBe(12);
    expect(r.workHours).toBe(12);
    expect(r.score).toBeGreaterThan(70);
  });

  it('rates a few real sessions across weeks as active', () => {
    const r = scoreEngagement({ ...base, workByDay: spread(4, 6, 1800), projects: 1, contentEdits: 40, lastActiveAt: '2026-10-05T10:00:00Z' }, 30, NOW);
    expect(r.tier).toBe('active');
    expect(r.activeWeeks).toBeGreaterThanOrEqual(2);
  });

  it('treats one long binge as trying out, not active', () => {
    const r = scoreEngagement({ ...base, workByDay: spread(1, 1, 5 * 3600), projects: 1, contentEdits: 300, lastActiveAt: '2026-10-05T10:00:00Z' }, 30, NOW);
    expect(r.tier).toBe('trying');
  });

  it('treats lots of time with almost no output as trying out', () => {
    const r = scoreEngagement({ ...base, workByDay: spread(10, 2, 3600), projects: 1, contentEdits: 3, lastActiveAt: '2026-10-05T10:00:00Z' }, 30, NOW);
    expect(r.tier).toBe('trying');
  });

  it('does not count days below the active-day minimum', () => {
    const r = scoreEngagement({ ...base, workByDay: spread(6, 2, ACTIVE_DAY_SECONDS - 1), contentEdits: 50 }, 30, NOW);
    expect(r.activeDays).toBe(0);
    expect(r.tier).toBe('trying');
  });

  it('marks past workers with nothing recent as dormant', () => {
    const r = scoreEngagement({ ...base, priorWorkSeconds: 4 * 3600, priorContentEdits: 120, lastActiveAt: '2026-07-01T10:00:00Z' }, 30, NOW);
    expect(r.tier).toBe('dormant');
    expect(r.score).toBe(0);
  });

  it('marks people who never did real work as never started', () => {
    const r = scoreEngagement({ ...base, priorWorkSeconds: 600, lastActiveAt: '2026-10-05T10:00:00Z' }, 30, NOW);
    expect(r.tier).toBe('never');
    // A visit alone earns no recency points
    expect(r.score).toBe(0);
  });

  it('scales thresholds with a longer window', () => {
    const input = { ...base, workByDay: days(spread(4, 6, 1800)), projects: 1, contentEdits: 40, lastActiveAt: '2026-10-05T10:00:00Z' };
    expect(scoreEngagement(input, 30, NOW).tier).toBe('active');
    // The same activity is thinner over 90 days
    expect(scoreEngagement(input, 90, NOW).tier).toBe('trying');
  });

  it('keeps the score within 0–100', () => {
    const r = scoreEngagement({ ...base, workByDay: spread(30, 1, 8 * 3600), projects: 5, contentEdits: 50_000, lastActiveAt: NOW.toISOString() }, 30, NOW);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBe(100);
  });
});
