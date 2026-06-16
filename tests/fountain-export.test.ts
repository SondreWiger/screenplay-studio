import { describe, it, expect } from 'vitest';
import { parseFountain, generateFountain } from '@/lib/scripts/fountain';
import type { ScriptElement, ScriptElementType, TitlePageData } from '@/lib/types';

function el(type: ScriptElementType, content: string, overrides: Partial<ScriptElement> = {}): ScriptElement {
  return {
    id: 'id-' + Math.random().toString(36).slice(2, 8),
    element_type: type,
    content,
    sort_order: 0,
    scene_number: null,
    revision_color: 'white',
    is_revised: false,
    is_omitted: false,
    scene_status: null,
    metadata: {},
    created_by: null,
    last_edited_by: null,
    script_id: 's1',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('parseFountain (scripts/fountain)', () => {
  it('parses scene headings', () => {
    const result = parseFountain('INT. OFFICE - DAY');
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].element_type).toBe('scene_heading');
    expect(result.elements[0].scene_number).toBe('1');
  });

  it('parses forced scene headings', () => {
    const result = parseFountain('.BEDROOM - NIGHT');
    expect(result.elements[0].element_type).toBe('scene_heading');
  });

  it('numbers scenes sequentially', () => {
    const result = parseFountain('INT. A\n\nINT. B\n\nINT. C');
    expect(result.elements.filter(e => e.element_type === 'scene_heading')).toHaveLength(3);
    expect(result.elements[0].scene_number).toBe('1');
    expect(result.elements[1].scene_number).toBe('2');
    expect(result.elements[2].scene_number).toBe('3');
  });

  it('parses action blocks', () => {
    const result = parseFountain('A man walks into a room.\nHe looks around.');
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].element_type).toBe('action');
    expect(result.elements[0].content).toContain('A man walks');
  });

  it('parses character + dialogue', () => {
    const result = parseFountain('JOHN\nHello there!');
    const character = result.elements.find(e => e.element_type === 'character');
    const dialogue = result.elements.find(e => e.element_type === 'dialogue');
    expect(character).toBeDefined();
    expect(dialogue).toBeDefined();
    expect(dialogue!.content).toBe('Hello there!');
  });

  it('parses forced character with @', () => {
    const result = parseFountain('@John\nHi!');
    expect(result.elements[0].element_type).toBe('character');
    expect(result.elements[0].content).toBe('John');
  });

  it('parses parentheticals', () => {
    const result = parseFountain('JOHN\n(whispering)\nHello');
    const parens = result.elements.find(e => e.element_type === 'parenthetical');
    expect(parens).toBeDefined();
    expect(parens!.content).toBe('(whispering)');
  });

  it('parses transitions', () => {
    const result = parseFountain('> CUT TO:');
    expect(result.elements[0].element_type).toBe('transition');
  });

  it('parses centered text', () => {
    const result = parseFountain('> Title Here <');
    expect(result.elements[0].element_type).toBe('centered');
  });

  it('parses lyrics', () => {
    const result = parseFountain('~ A song');
    expect(result.elements[0].element_type).toBe('lyrics');
  });

  it('parses notes', () => {
    const result = parseFountain('[[ a note ]]');
    expect(result.elements[0].element_type).toBe('note');
  });

  it('parses sections', () => {
    const result = parseFountain('# Act One');
    expect(result.elements[0].element_type).toBe('section');
  });

  it('parses synopses', () => {
    const result = parseFountain('= A brief summary');
    expect(result.elements[0].element_type).toBe('synopsis');
  });

  it('parses page breaks', () => {
    const result = parseFountain('===');
    expect(result.elements[0].element_type).toBe('page_break');
  });

  it('extracts title page data', () => {
    const result = parseFountain('Title: My Movie\nAuthor: John Doe\n\nINT. ROOM');
    expect(result.titlePage.title).toBe('My Movie');
    expect(result.titlePage.author).toBe('John Doe');
  });

  it('extracts scene numbers from #N# syntax', () => {
    const result = parseFountain('INT. ROOM #42#');
    expect(result.elements[0].scene_number).toBe('42');
  });

  it('handles empty input', () => {
    const result = parseFountain('');
    expect(result.elements).toEqual([]);
  });
});

describe('generateFountain', () => {
  it('generates scene heading with INT./EXT. prefix', () => {
    const elements = [el('scene_heading', 'INT. OFFICE - DAY')];
    const output = generateFountain({ elements });
    expect(output).toContain('INT. OFFICE - DAY');
  });

  it('adds . prefix for non-standard headings', () => {
    const elements = [el('scene_heading', 'BEDROOM - NIGHT')];
    const output = generateFountain({ elements });
    expect(output).toContain('.BEDROOM - NIGHT');
  });

  it('includes scene number markers', () => {
    const elements = [el('scene_heading', 'INT. ROOM', { scene_number: '5' })];
    const output = generateFountain({ elements });
    expect(output).toContain('#5#');
  });

  it('generates action', () => {
    const elements = [el('action', 'A man enters.')];
    const output = generateFountain({ elements });
    expect(output).toContain('A man enters.');
  });

  it('generates character (uppercase)', () => {
    const elements = [el('character', 'john')];
    const output = generateFountain({ elements });
    expect(output).toContain('JOHN');
  });

  it('generates dialogue', () => {
    const elements = [el('dialogue', 'Hello!')];
    const output = generateFountain({ elements });
    expect(output).toContain('Hello!');
  });

  it('generates parenthetical with parens', () => {
    const elements = [el('parenthetical', 'whispering')];
    const output = generateFountain({ elements });
    expect(output).toContain('(whispering)');
  });

  it('does not double-wrap parenthetical', () => {
    const elements = [el('parenthetical', '(already wrapped)')];
    const output = generateFountain({ elements });
    expect(output).toContain('(already wrapped)');
    expect(output).not.toContain('((already wrapped))');
  });

  it('generates transition with > prefix', () => {
    const elements = [el('transition', 'CUT TO:')];
    const output = generateFountain({ elements });
    expect(output).toContain('> CUT TO:');
  });

  it('generates centered with > <', () => {
    const elements = [el('centered', 'Title')];
    const output = generateFountain({ elements });
    expect(output).toContain('> Title <');
  });

  it('generates lyrics with ~', () => {
    const elements = [el('lyrics', 'A song')];
    const output = generateFountain({ elements });
    expect(output).toContain('~ A song');
  });

  it('generates note with [[ ]]', () => {
    const elements = [el('note', 'a note')];
    const output = generateFountain({ elements });
    expect(output).toContain('[[ a note ]]');
  });

  it('generates section with #', () => {
    const elements = [el('section', 'Act One')];
    const output = generateFountain({ elements });
    expect(output).toContain('# Act One');
  });

  it('generates synopsis with =', () => {
    const elements = [el('synopsis', 'Summary')];
    const output = generateFountain({ elements });
    expect(output).toContain('= Summary');
  });

  it('generates page break with ===', () => {
    const elements = [el('page_break', '')];
    const output = generateFountain({ elements });
    expect(output).toContain('===');
  });

  it('generates title page', () => {
    const titlePage: TitlePageData = { title: 'My Movie', author: 'John' };
    const output = generateFountain({ titlePage, elements: [] });
    expect(output).toContain('Title: My Movie');
    expect(output).toContain('Author: John');
  });

  it('adds blank line between elements', () => {
    const elements = [
      el('scene_heading', 'INT. ROOM'),
      el('action', 'Something.'),
    ];
    const output = generateFountain({ elements });
    expect(output).toContain('\n\n');
  });

  it('does not add blank line before dialogue after character', () => {
    const elements = [
      el('character', 'JOHN'),
      el('dialogue', 'Hello'),
    ];
    const output = generateFountain({ elements });
    const lines = output.split('\n');
    const johnIdx = lines.findIndex(l => l === 'JOHN');
    expect(lines[johnIdx + 1]).toBe('Hello');
  });
});
