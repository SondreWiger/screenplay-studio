/**
 * Splits a scene heading like "INT. COFFEE SHOP - NIGHT" into its parts.
 * Used when breakdown rows on the Scenes page are created from a script.
 */
export function parseSceneHeading(heading: string): { locationType: 'INT' | 'EXT' | 'INT_EXT'; locationName: string; timeOfDay: string } {
  let locationType: 'INT' | 'EXT' | 'INT_EXT' = 'INT';
  const h = heading.trim().toUpperCase();
  if (h.startsWith('INT./EXT.') || h.startsWith('INT/EXT') || h.startsWith('I/E.')) locationType = 'INT_EXT';
  else if (h.startsWith('EXT.')) locationType = 'EXT';

  const rest = h.replace(/^(INT\.\/EXT\.|INT\/EXT|I\/E\.|INT\.|EXT\.)\s*/i, '').trim();
  const parts = rest.split(/\s+-\s+/);
  return {
    locationType,
    locationName: parts[0]?.trim() || '',
    timeOfDay: parts.length > 1 ? parts[parts.length - 1].trim() || 'DAY' : 'DAY',
  };
}
