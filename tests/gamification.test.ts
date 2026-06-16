import { describe, it, expect } from 'vitest';
import {
  XP_VALUES,
  getLevelInfo,
  getLevelTitle,
  getLevelUnlocks,
  multiplierLabel,
  multiplierHours,
  getGlowTier,
  GLOW_CLASSES,
  LEVEL_THRESHOLDS_EXPORT,
  LEVEL_DATA,
} from '@/lib/gamification';

describe('XP_VALUES', () => {
  it('has values for all event types', () => {
    expect(XP_VALUES.words_written).toBe(1);
    expect(XP_VALUES.community_post).toBe(25);
    expect(XP_VALUES.project_created).toBe(10);
    expect(XP_VALUES.daily_login).toBe(5);
  });
});

describe('getLevelInfo', () => {
  it('returns level 1 for 0 XP', () => {
    const info = getLevelInfo(0);
    expect(info.level).toBe(1);
  });

  it('returns level 1 for low XP', () => {
    const info = getLevelInfo(50);
    expect(info.level).toBe(1);
  });

  it('returns correct level for higher XP', () => {
    const threshold = LEVEL_THRESHOLDS_EXPORT[2];
    const info = getLevelInfo(threshold);
    expect(info.level).toBeGreaterThanOrEqual(2);
  });

  it('caps at level 100', () => {
    const info = getLevelInfo(999999999);
    expect(info.level).toBe(100);
    expect(info.progressPercent).toBe(100);
  });

  it('calculates progress percent correctly', () => {
    const info = getLevelInfo(0);
    expect(info.progressPercent).toBeGreaterThanOrEqual(0);
    expect(info.progressPercent).toBeLessThanOrEqual(100);
  });

  it('returns xpForCurrentLevel and xpForNextLevel', () => {
    const info = getLevelInfo(500);
    expect(info.xpForCurrentLevel).toBeGreaterThanOrEqual(0);
    expect(info.xpForNextLevel).toBeGreaterThan(info.xpForCurrentLevel);
  });
});

describe('getLevelTitle', () => {
  it('returns title for level 1', () => {
    expect(getLevelTitle(1)).toBe('Aspiring Writer');
  });

  it('returns title for level 2', () => {
    expect(getLevelTitle(2)).toBe('Scribbler');
  });

  it('returns title for level 10', () => {
    expect(getLevelTitle(10)).toBe('Plot Weaver');
  });

  it('returns title for level 100', () => {
    expect(getLevelTitle(100)).toBe('The Auteur');
  });

  it('returns closest lower level title', () => {
    expect(getLevelTitle(3)).toBe('Story Apprentice');
    expect(getLevelTitle(6)).toBe('Scene Builder');
  });

  it('returns default for level 0', () => {
    expect(getLevelTitle(0)).toBe('Aspiring Writer');
  });
});

describe('getLevelUnlocks', () => {
  it('returns unlocks for level 2', () => {
    expect(getLevelUnlocks(2)).toContain('Bronze username glow');
  });

  it('returns empty array for levels without unlocks', () => {
    expect(getLevelUnlocks(1)).toEqual([]);
    expect(getLevelUnlocks(4)).toEqual([]);
  });

  it('returns unlocks for level 100', () => {
    expect(getLevelUnlocks(100)).toContain('Ultra profile effect');
  });
});

describe('multiplierLabel', () => {
  it('returns empty for 1x', () => {
    expect(multiplierLabel(1)).toBe('');
  });

  it('returns label for higher multipliers', () => {
    expect(multiplierLabel(2)).toBe('2×');
    expect(multiplierLabel(16)).toBe('16×');
  });

  it('returns empty for values <= 1', () => {
    expect(multiplierLabel(0)).toBe('');
    expect(multiplierLabel(0.5)).toBe('');
  });
});

describe('multiplierHours', () => {
  it('calculates inverse of 2^hours', () => {
    expect(multiplierHours(1)).toBe(0);
    expect(multiplierHours(2)).toBe(1);
    expect(multiplierHours(4)).toBe(2);
    expect(multiplierHours(8)).toBe(3);
    expect(multiplierHours(16)).toBe(4);
  });
});

describe('getGlowTier', () => {
  it('returns none for low levels', () => {
    expect(getGlowTier(0)).toBe('none');
    expect(getGlowTier(1)).toBe('none');
  });

  it('returns bronze for level 2+', () => {
    expect(getGlowTier(2)).toBe('bronze');
    expect(getGlowTier(9)).toBe('bronze');
  });

  it('returns silver for level 10+', () => {
    expect(getGlowTier(10)).toBe('silver');
    expect(getGlowTier(19)).toBe('silver');
  });

  it('returns gold for level 20+', () => {
    expect(getGlowTier(20)).toBe('gold');
    expect(getGlowTier(49)).toBe('gold');
  });

  it('returns platinum for level 50+', () => {
    expect(getGlowTier(50)).toBe('platinum');
    expect(getGlowTier(74)).toBe('platinum');
  });

  it('returns rainbow for level 75+', () => {
    expect(getGlowTier(75)).toBe('rainbow');
    expect(getGlowTier(100)).toBe('rainbow');
  });
});

describe('GLOW_CLASSES', () => {
  it('has a class for each tier', () => {
    expect(GLOW_CLASSES.none).toBe('');
    expect(GLOW_CLASSES.bronze).toContain('drop-shadow');
    expect(GLOW_CLASSES.rainbow).toContain('rainbow');
  });
});

describe('LEVEL_THRESHOLDS_EXPORT', () => {
  it('starts at 0', () => {
    expect(LEVEL_THRESHOLDS_EXPORT[0]).toBe(0);
  });

  it('has 101 entries (0-100)', () => {
    expect(LEVEL_THRESHOLDS_EXPORT).toHaveLength(101);
  });

  it('is monotonically increasing', () => {
    for (let i = 1; i < LEVEL_THRESHOLDS_EXPORT.length; i++) {
      expect(LEVEL_THRESHOLDS_EXPORT[i]).toBeGreaterThanOrEqual(LEVEL_THRESHOLDS_EXPORT[i - 1]);
    }
  });
});
