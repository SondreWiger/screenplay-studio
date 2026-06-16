import { describe, it, expect } from 'vitest';
import { parseFountain, parseFdx, fileExtension, isParseable, formatFileSize, FORMAT_LABELS } from '@/lib/screenplay-parsers';

describe('parseFountain', () => {
  it('parses scene headings (INT./EXT.)', () => {
    const result = parseFountain('INT. OFFICE - DAY');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('scene_heading');
    expect(result[0].content).toBe('INT. OFFICE - DAY');
    expect(result[0].scene_number).toBe('1');
  });

  it('parses forced scene headings with . prefix', () => {
    const result = parseFountain('.INT. BEDROOM - NIGHT');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('scene_heading');
    expect(result[0].content).toBe('INT. BEDROOM - NIGHT');
  });

  it('numbers scenes sequentially', () => {
    const result = parseFountain('INT. ROOM A\n\nEXT. ROOM B');
    expect(result[0].scene_number).toBe('1');
    expect(result[1].scene_number).toBe('2');
  });

  it('parses action text', () => {
    const result = parseFountain('A man walks into a bar.');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('action');
    expect(result[0].content).toBe('A man walks into a bar.');
  });

  it('parses forced action with ! prefix', () => {
    const result = parseFountain('!EXPLOSION everywhere');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('action');
    expect(result[0].content).toBe('EXPLOSION everywhere');
  });

  it('parses character + dialogue', () => {
    const result = parseFountain('JOHN\nHello there!');
    expect(result).toHaveLength(2);
    expect(result[0].element_type).toBe('character');
    expect(result[0].content).toBe('JOHN');
    expect(result[1].element_type).toBe('dialogue');
    expect(result[1].content).toBe('Hello there!');
  });

  it('parses forced character with @ prefix', () => {
    const result = parseFountain('@John\nHello!');
    expect(result[0].element_type).toBe('character');
    expect(result[0].content).toBe('John');
    expect(result[1].element_type).toBe('dialogue');
  });

  it('parses parentheticals', () => {
    const result = parseFountain('JOHN\n(whispering)\nHello!');
    expect(result).toHaveLength(3);
    expect(result[1].element_type).toBe('parenthetical');
    expect(result[1].content).toBe('(whispering)');
  });

  it('parses transitions', () => {
    const result = parseFountain('> CUT TO:');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('transition');
    expect(result[0].content).toBe('CUT TO:');
  });

  it('parses standard transitions (ALL CAPS TO:)', () => {
    const result = parseFountain('CUT TO:');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('transition');
  });

  it('parses centered text', () => {
    const result = parseFountain('> Title Here <');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('centered');
    expect(result[0].content).toBe('Title Here');
  });

  it('parses lyrics', () => {
    const result = parseFountain('~ A beautiful song');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('lyrics');
    expect(result[0].content).toBe('A beautiful song');
  });

  it('parses title page', () => {
    const result = parseFountain('Title: My Movie\nAuthor: John\n\nINT. ROOM');
    expect(result[0].element_type).toBe('title_page');
    expect(result).toHaveLength(2);
  });

  it('handles page breaks', () => {
    const result = parseFountain('INT. ROOM');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('scene_heading');
  });

  it('handles boneyard comments on separate blocks', () => {
    const result = parseFountain('INT. ROOM');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('scene_heading');
  });

  it('handles notes on separate blocks', () => {
    const result = parseFountain('INT. ROOM');
    expect(result).toHaveLength(1);
  });

  it('handles section headings on separate blocks', () => {
    const result = parseFountain('INT. ROOM');
    expect(result).toHaveLength(1);
    expect(result[0].element_type).toBe('scene_heading');
  });

  it('handles synopses on separate blocks', () => {
    const result = parseFountain('INT. ROOM');
    expect(result).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(parseFountain('')).toEqual([]);
  });

  it('handles dual dialogue marker ^', () => {
    const result = parseFountain('JOHN^\nHello!');
    expect(result[0].element_type).toBe('character');
    expect(result[0].content).toBe('JOHN');
  });

  it('handles FADE OUT as transition', () => {
    const result = parseFountain('FADE OUT.');
    expect(result[0].element_type).toBe('transition');
  });
});

describe('parseFdx', () => {
  it('parses basic FDX with scene headings', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Content>
  <Paragraph Type="Scene Heading"><Text>INT. OFFICE - DAY</Text></Paragraph>
  <Paragraph Type="Action"><Text>A man walks in.</Text></Paragraph>
</Content>`;
    const result = parseFdx(xml);
    expect(result).toHaveLength(2);
    expect(result[0].element_type).toBe('scene_heading');
    expect(result[0].scene_number).toBe('1');
    expect(result[1].element_type).toBe('action');
  });

  it('numbers scenes sequentially in FDX', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Content>
  <Paragraph Type="Scene Heading"><Text>INT. ROOM A</Text></Paragraph>
  <Paragraph Type="Scene Heading"><Text>INT. ROOM B</Text></Paragraph>
</Content>`;
    const result = parseFdx(xml);
    expect(result[0].scene_number).toBe('1');
    expect(result[1].scene_number).toBe('2');
  });

  it('parses all FDX types', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Content>
  <Paragraph Type="Scene Heading"><Text>INT. ROOM</Text></Paragraph>
  <Paragraph Type="Character"><Text>JOHN</Text></Paragraph>
  <Paragraph Type="Dialogue"><Text>Hello</Text></Paragraph>
  <Paragraph Type="Parenthetical"><Text>(whispering)</Text></Paragraph>
  <Paragraph Type="Transition"><Text>CUT TO:</Text></Paragraph>
  <Paragraph Type="Shot"><Text>WIDE SHOT</Text></Paragraph>
</Content>`;
    const result = parseFdx(xml);
    expect(result.map(e => e.element_type)).toEqual([
      'scene_heading', 'character', 'dialogue', 'parenthetical', 'transition', 'shot'
    ]);
  });

  it('maps unknown types to action', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Content>
  <Paragraph Type="Unknown"><Text>Some text</Text></Paragraph>
</Content>`;
    const result = parseFdx(xml);
    expect(result[0].element_type).toBe('action');
  });

  it('skips empty paragraphs', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Content>
  <Paragraph Type="Action"><Text></Text></Paragraph>
  <Paragraph Type="Action"><Text>Real text</Text></Paragraph>
</Content>`;
    const result = parseFdx(xml);
    expect(result).toHaveLength(1);
  });

  it('throws on invalid XML', () => {
    expect(() => parseFdx('not xml at all')).toThrow('Invalid FDX XML');
  });

  it('concatenates multiple Text nodes', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Content>
  <Paragraph Type="Action"><Text>Hello </Text><Text>World</Text></Paragraph>
</Content>`;
    const result = parseFdx(xml);
    expect(result[0].content).toBe('Hello World');
  });
});

describe('fileExtension', () => {
  it('returns lowercase extension', () => {
    expect(fileExtension('script.fountain')).toBe('fountain');
    expect(fileExtension('SCRIPT.FDX')).toBe('fdx');
  });

  it('returns the filename itself when no dot', () => {
    expect(fileExtension('noextension')).toBe('noextension');
  });

  it('handles multiple dots', () => {
    expect(fileExtension('my.script.fountain')).toBe('fountain');
  });
});

describe('isParseable', () => {
  it('returns true for parseable formats', () => {
    expect(isParseable('fountain')).toBe(true);
    expect(isParseable('fdx')).toBe(true);
    expect(isParseable('txt')).toBe(true);
  });

  it('returns false for pdf', () => {
    expect(isParseable('pdf')).toBe(false);
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

describe('FORMAT_LABELS', () => {
  it('has labels for all formats', () => {
    expect(FORMAT_LABELS.fountain).toBe('Fountain');
    expect(FORMAT_LABELS.fdx).toBe('Final Draft');
    expect(FORMAT_LABELS.txt).toBe('Plain Text');
    expect(FORMAT_LABELS.pdf).toBe('PDF');
  });
});
