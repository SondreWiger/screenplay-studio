import { describe, it, expect } from 'vitest';
import { parseOpenedFile } from '@/lib/desktop/import-file';
import { buildShellNav, type ShellNavContext } from '@/components/shell/nav';

// Files opened in the desktop app (File › Open, double-click in Finder or
// Explorer) become projects. parseOpenedFile decides what a file contains.

describe('parseOpenedFile', () => {
  it('reads a Fountain script and takes the title from its title page', () => {
    const text = 'Title: The Long Winter\nAuthor: M. Holm\n\nEXT. HARBOUR - NIGHT\n\nIce groans against the hull.\n\nMAREN\nYou came back.\n';
    const parsed = parseOpenedFile('/Users/me/Desktop/draft.fountain', text);
    expect(parsed.title).toBe('The Long Winter');
    expect(parsed.bundle).toBeUndefined();
    expect(parsed.elements.map((e) => e.element_type)).toEqual(
      expect.arrayContaining(['scene_heading', 'action', 'character', 'dialogue']),
    );
  });

  it('falls back to the file name when a script has no title', () => {
    const parsed = parseOpenedFile('C:\\Scripts\\Pilot Episode.fountain', 'INT. KITCHEN - DAY\n\nShe waits.\n');
    expect(parsed.title).toBe('Pilot Episode');
  });

  it('reads a .screenplay file saved by the editor', () => {
    const file = JSON.stringify({
      version: 1,
      script: { id: 's1', project_id: 'p1', title: 'Draft 2', title_page_data: { title: 'Draft 2' } },
      elements: [{ id: 'e1', script_id: 's1', element_type: 'action', content: 'Rain.', sort_order: 0 }],
    });
    const parsed = parseOpenedFile('/tmp/Draft 2.screenplay', file);
    expect(parsed.title).toBe('Draft 2');
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.bundle).toBeUndefined();
  });

  it('recognises a whole-project bundle and keeps its ids', () => {
    const file = JSON.stringify({
      project: { id: 'p9', title: 'Harbour' },
      scripts: [{ id: 's9', project_id: 'p9', title: 'Draft' }],
      elements: [{ id: 'e9', script_id: 's9', element_type: 'action', content: 'x', sort_order: 0 }],
    });
    const parsed = parseOpenedFile('/x/project.json', file);
    expect(parsed.bundle?.project.id).toBe('p9');
    expect(parsed.bundle?.scripts).toHaveLength(1);
    expect(parsed.bundle?.elements).toHaveLength(1);
  });

  it('rejects files that are neither a script nor a project', () => {
    expect(() => parseOpenedFile('/x/notes.json', '{"hello":"world"}')).toThrow(/isn’t a Screenplay Studio/);
    expect(() => parseOpenedFile('/x/broken.screenplay', 'not json')).toThrow(/isn’t a Screenplay Studio/);
    expect(() => parseOpenedFile('/x/empty.fountain', '   \n')).toThrow(/no script/);
  });
});

// The desktop app's sidebar shows places to work, not the website.

const base: ShellNavContext = {
  signedIn: true,
  isElectron: true,
  community: true,
  messages: false,
  companies: true,
  hasCompany: true,
  accountability: true,
  staff: false,
  isAdmin: false,
  username: 'writer',
};

const hrefs = (ctx: ShellNavContext) => buildShellNav(ctx).flatMap((s) => s.items.map((i) => i.href));

describe('desktop sidebar', () => {
  it('leaves out website pages', () => {
    const items = hrefs(base);
    for (const web of ['/blog', '/changelog', '/testimonials', '/translations', '/legal', '/download', '/community', '/learn']) {
      expect(items).not.toContain(web);
    }
    expect(items).toContain('/dashboard');
    expect(items).toContain('/settings');
  });

  it('drops everything that needs an account in local mode', () => {
    const items = hrefs({ ...base, localOnly: true });
    for (const cloud of ['/notifications', '/people', '/quotes', '/accountability', '/company', '/messages']) {
      expect(items).not.toContain(cloud);
    }
    expect(items).toEqual(expect.arrayContaining(['/dashboard', '/idea-boards', '/tools', '/settings']));
  });

  it('keeps the web sidebar unchanged in a browser', () => {
    const items = hrefs({ ...base, isElectron: false });
    expect(items).toEqual(expect.arrayContaining(['/community', '/blog', '/download', '/notifications']));
  });
});
