import { describe, it, expect } from 'vitest';
import { getNavCategories, getProjectNavFlags } from '@/lib/navCategories';

// getProjectNavFlags decides which tool set a project gets. The sidebar and the
// command palette both call it, so a wrong flag silently changes someone's nav.

describe('getProjectNavFlags', () => {
  it('defaults everything to false for a plain film project', () => {
    expect(getProjectNavFlags({ project_type: 'film', script_type: 'feature' })).toEqual({
      isContentCreator: false,
      isTvProduction: false,
      isAudioDrama: false,
      isStagePlay: false,
      isEpisodic: false,
      isViewer: false,
    });
  });

  it('handles a missing project without throwing', () => {
    const flags = getProjectNavFlags(null);
    expect(flags.isTvProduction).toBe(false);
    expect(flags.isContentCreator).toBe(false);
    expect(getProjectNavFlags(undefined).isEpisodic).toBe(false);
  });

  it('detects TV production', () => {
    expect(getProjectNavFlags({ project_type: 'tv_production' }).isTvProduction).toBe(true);
  });

  it('detects audio drama from either project or script type', () => {
    expect(getProjectNavFlags({ project_type: 'audio_drama' }).isAudioDrama).toBe(true);
    expect(getProjectNavFlags({ script_type: 'audio_drama' }).isAudioDrama).toBe(true);
  });

  it('detects stage plays, including the "stageplay" script type spelling', () => {
    expect(getProjectNavFlags({ project_type: 'stage_play' }).isStagePlay).toBe(true);
    expect(getProjectNavFlags({ script_type: 'stageplay' }).isStagePlay).toBe(true);
  });

  it.each(['youtube', 'tiktok', 'podcast', 'educational', 'livestream'])(
    'treats %s as a content-creator project', (type) => {
      expect(getProjectNavFlags({ project_type: type }).isContentCreator).toBe(true);
    });

  it('detects content creators from the script type too', () => {
    expect(getProjectNavFlags({ script_type: 'youtube' }).isContentCreator).toBe(true);
    expect(getProjectNavFlags({ script_type: 'tiktok' }).isContentCreator).toBe(true);
  });

  it('detects episodic scripts', () => {
    expect(getProjectNavFlags({ script_type: 'episodic' }).isEpisodic).toBe(true);
  });

  it('passes the viewer flag through', () => {
    expect(getProjectNavFlags({ project_type: 'film' }, true).isViewer).toBe(true);
  });
});

describe('getNavCategories via the flags', () => {
  const nav = (project: Record<string, string>) =>
    getNavCategories('p1', getProjectNavFlags(project));
  const categories = (project: Record<string, string>) => nav(project).map((c) => c.category);

  it('gives broadcast projects the On Air nav and no Pro Tools category', () => {
    const cats = categories({ project_type: 'tv_production' });
    expect(cats).toContain('On Air');
    expect(cats).not.toContain('Pro Tools');
  });

  it('gives every other project type a Pro Tools category', () => {
    for (const project of [
      { project_type: 'film' },
      { project_type: 'audio_drama' },
      { project_type: 'stage_play' },
      { project_type: 'youtube' },
    ]) {
      expect(categories(project), JSON.stringify(project)).toContain('Pro Tools');
    }
  });

  it('only shows Episodes when the script is episodic', () => {
    const labels = (p: Record<string, string>) => nav(p).flatMap((c) => c.items).map((i) => i.label);
    expect(labels({ project_type: 'film', script_type: 'episodic' })).toContain('Episodes');
    expect(labels({ project_type: 'film', script_type: 'feature' })).not.toContain('Episodes');
  });

  it('every nav item has a destination', () => {
    for (const project of [{ project_type: 'film' }, { project_type: 'tv_production' }, { project_type: 'youtube' }]) {
      for (const item of nav(project).flatMap((c) => c.items)) {
        expect(item.href, `${item.label} has no href`).toBeTruthy();
        expect(item.href.startsWith('/projects/p1'), `${item.label} → ${item.href}`).toBe(true);
      }
    }
  });
});
