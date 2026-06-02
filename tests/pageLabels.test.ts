import { describe, it, expect } from 'vitest';
import { getPageSection, PAGE_LABELS } from '@/lib/pageLabels';

describe('getPageSection', () => {
  it('returns "overview" for project root', () => {
    expect(getPageSection('/projects/abc123', 'abc123')).toBe('overview');
  });

  it('returns "overview" for non-project paths', () => {
    expect(getPageSection('/dashboard', 'abc123')).toBe('overview');
  });

  it('extracts first segment after project id', () => {
    expect(getPageSection('/projects/abc123/script', 'abc123')).toBe('script');
    expect(getPageSection('/projects/abc123/characters', 'abc123')).toBe('characters');
    expect(getPageSection('/projects/abc123/settings', 'abc123')).toBe('settings');
  });

  it('ignores sub-routes (UUIDs)', () => {
    expect(getPageSection('/projects/abc123/characters/some-uuid', 'abc123')).toBe('characters');
    expect(getPageSection('/projects/abc123/script?script_id=xyz', 'abc123')).toBe('script');
  });

  it('returns "overview" for empty path after project id', () => {
    expect(getPageSection('/projects/abc123/', 'abc123')).toBe('overview');
  });
});

describe('PAGE_LABELS', () => {
  it('has labels for all core pages', () => {
    expect(PAGE_LABELS['overview']).toBe('Overview');
    expect(PAGE_LABELS['script']).toBe('Script Editor');
    expect(PAGE_LABELS['characters']).toBe('Characters');
    expect(PAGE_LABELS['settings']).toBe('Settings');
  });

  it('has labels for broadcast pages', () => {
    expect(PAGE_LABELS['rundown']).toBe('Rundown');
    expect(PAGE_LABELS['prompter']).toBe('Prompter');
    expect(PAGE_LABELS['vision-mixer']).toBe('Vision Mixer');
  });

  it('has labels for audio drama pages', () => {
    expect(PAGE_LABELS['sound-design']).toBe('Sound Design');
    expect(PAGE_LABELS['voice-cast']).toBe('Voice Cast');
  });
});
