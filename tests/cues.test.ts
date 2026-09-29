import { describe, it, expect } from 'vitest';
import { isCharacterCue } from '@/lib/scripts/cues';

describe('isCharacterCue', () => {
  it.each(['MARA', 'DR. HALE', "O'BRIEN", 'MARA (V.O.)', 'GUARD #2'.replace('#', ''), 'JEAN-LUC (CONT\'D)'])('%s is a cue', (s) => {
    expect(isCharacterCue(s)).toBe(true);
  });
  it.each(['INT. LIGHTHOUSE - NIGHT', 'EXT. CLIFF - DAWN', 'I/E. CAR - DAY', 'CUT TO:', 'BOOM.', 'Mara', 'Rain hammers the glass.', 'A', ''])('%s is not a cue', (s) => {
    expect(isCharacterCue(s)).toBe(false);
  });
});
