/**
 * Whether a line typed as Action is really a character cue (the Fountain
 * rule): short, all caps, optionally followed by an extension such as (V.O.).
 * Scene headings, transitions ("CUT TO:") and shouted action ending in a
 * period ("BOOM.") are not cues.
 */
export function isCharacterCue(raw: string): boolean {
  const line = raw.trim();
  if (line.length < 2 || line.length > 40) return false;
  if (!/[A-Z]/.test(line) || line !== line.toUpperCase()) return false;
  if (/^(INT|EXT|EST|INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\/E)[.\s]/.test(line)) return false;
  const match = line.match(/^([A-Z0-9 .'\-]+?)\s*(\([A-Z0-9 .'\-]+\))?$/);
  if (!match) return false;
  const name = match[1].trim();
  return name.length >= 2 && !name.endsWith('.');
}
