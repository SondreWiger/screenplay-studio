import { ALL_KITS, buildPitch, ideaChecks, ideaTitle, kitFor, pitchIsComplete, starterToText } from '@/lib/idea-starter';

describe('kitFor', () => {
  it('picks a kit from the script type', () => {
    expect(kitFor('film', 'screenplay').id).toBe('screenplay');
    expect(kitFor('film', 'episodic').id).toBe('episodic');
    expect(kitFor('film', 'sketch').id).toBe('sketch');
    expect(kitFor('film', 'comic').id).toBe('comic');
  });

  it('lets a specific project type win', () => {
    expect(kitFor('tv_production', 'screenplay').id).toBe('tv_production');
    expect(kitFor('documentary', 'screenplay').id).toBe('documentary');
    expect(kitFor('stage_play', 'screenplay').id).toBe('stageplay');
    expect(kitFor('novel', null).id).toBe('novel');
  });

  it('falls back to the feature film kit', () => {
    expect(kitFor(null, null).id).toBe('screenplay');
    expect(kitFor('film', 'something-new').id).toBe('screenplay');
  });

  it('has a kit for every script and project type', () => {
    const scriptTypes = ['screenplay', 'stageplay', 'episodic', 'sketch', 'comic', 'podcast', 'audio_drama', 'youtube', 'tiktok', 'videogame', 'novel'];
    for (const t of scriptTypes) expect(kitFor('film', t).id).toBe(t);
    const projectTypes = ['youtube', 'tiktok', 'podcast', 'audio_drama', 'documentary', 'educational', 'livestream', 'tv_production', 'stage_play', 'videogame', 'novel'];
    for (const t of projectTypes) expect(kitFor(t, 'screenplay').id).not.toBe('screenplay');
  });

  it('every template placeholder has a field', () => {
    for (const kit of ALL_KITS) {
      const keys = [...kit.pitch.template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      expect(keys.sort()).toEqual(kit.pitch.fields.map((f) => f.key).sort());
    }
  });
});

describe('buildPitch', () => {
  const kit = kitFor('film', 'screenplay');

  it('fills the template', () => {
    const values = { hero: 'a paramedic', incident: 'the dead wake up', goal: 'find out why', stakes: 'dawn' };
    expect(buildPitch(kit, values)).toBe('When the dead wake up, a paramedic must find out why before dawn.');
    expect(pitchIsComplete(kit, values)).toBe(true);
  });

  it('leaves readable placeholders for blanks', () => {
    expect(buildPitch(kit, { hero: 'a paramedic' })).toBe('When [what happens], a paramedic must [they must] before [or else].');
    expect(pitchIsComplete(kit, { hero: 'a paramedic' })).toBe(false);
  });
});

describe('ideaChecks', () => {
  it('spots the parts of a strong idea', () => {
    const checks = ideaChecks("A lonely lighthouse keeper must guide a ghost ship home, but its crew don't know they're dead, before the storm destroys the town.");
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it('flags what is missing', () => {
    const checks = ideaChecks('space pirates');
    expect(checks.find((c) => c.label === 'Stakes')?.ok).toBe(false);
    expect(checks.find((c) => c.label === 'Enough to work with')?.ok).toBe(false);
  });
});

describe('starterToText', () => {
  it('includes only what was filled in', () => {
    const kit = kitFor('youtube', null);
    const text = starterToText(kit, {
      idea: 'Peasant week',
      pitch: {},
      answers: { hook: 'Me eating gruel' },
      beats: { 'Payoff': 'Day 7 feast' },
    });
    expect(text).toContain('Peasant week');
    expect(text).toContain('Me eating gruel');
    expect(text).toContain('- Payoff: Day 7 feast');
    expect(text).not.toContain('Title + promise');
  });
});

describe('ideaTitle', () => {
  it('uses the first sentence and caps it', () => {
    expect(ideaTitle('A ghost ship. It comes back every night.')).toBe('A ghost ship.');
    expect(ideaTitle('x'.repeat(100), 10)).toBe('xxxxxxxxx…');
  });
});
