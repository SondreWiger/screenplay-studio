import { BrowserWindow, Menu, MenuItemConstructorOptions, app, clipboard, shell } from 'electron';

const isMac = process.platform === 'darwin';

/**
 * The right-click menu. Electron ships none, so without this a right-click in
 * the editor did nothing — no spelling suggestions, no copy, no paste.
 */
export function attachContextMenu(
  win: BrowserWindow,
  helpers: {
    isAppUrl: (url: string) => boolean;
    openInNewWindow: (url: string) => void;
  },
) {
  win.webContents.on('context-menu', (_event, params) => {
    const contents = win.webContents;
    const items: MenuItemConstructorOptions[] = [];
    const separator = () => {
      if (items.length && items[items.length - 1].type !== 'separator') items.push({ type: 'separator' });
    };

    // ── Spelling ──────────────────────────────────────────────
    if (params.isEditable && params.misspelledWord) {
      const suggestions = params.dictionarySuggestions.slice(0, 5);
      if (suggestions.length) {
        for (const suggestion of suggestions) {
          items.push({
            label: suggestion,
            click: () => contents.replaceMisspelling(suggestion),
          });
        }
      } else {
        items.push({ label: 'No Guesses Found', enabled: false });
      }
      separator();
      items.push({
        label: `Learn “${params.misspelledWord}”`,
        click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      separator();
    }

    // ── Links ─────────────────────────────────────────────────
    if (params.linkURL) {
      const internal = helpers.isAppUrl(params.linkURL);
      if (internal) {
        items.push({ label: 'Open Link in New Window', click: () => helpers.openInNewWindow(params.linkURL) });
      } else {
        items.push({ label: 'Open Link in Browser', click: () => { void shell.openExternal(params.linkURL); } });
      }
      items.push({
        label: 'Copy Link',
        click: () => clipboard.writeText(params.linkURL),
      });
      separator();
    }

    // ── Images ────────────────────────────────────────────────
    if (params.mediaType === 'image' && params.srcURL) {
      items.push({ label: 'Copy Image', click: () => contents.copyImageAt(params.x, params.y) });
      items.push({ label: 'Save Image As…', click: () => contents.downloadURL(params.srcURL) });
      if (!params.srcURL.startsWith('data:')) {
        items.push({ label: 'Copy Image Address', click: () => clipboard.writeText(params.srcURL) });
      }
      separator();
    }

    // ── Editing ───────────────────────────────────────────────
    const flags = params.editFlags;
    const selection = params.selectionText.trim();
    if (params.isEditable) {
      items.push(
        { label: 'Undo', role: 'undo', enabled: flags.canUndo },
        { label: 'Redo', role: 'redo', enabled: flags.canRedo },
        { type: 'separator' },
        { label: 'Cut', role: 'cut', enabled: flags.canCut },
        { label: 'Copy', role: 'copy', enabled: flags.canCopy },
        { label: 'Paste', role: 'paste', enabled: flags.canPaste },
        { label: 'Paste and Match Style', role: 'pasteAndMatchStyle', enabled: flags.canPaste },
        { label: 'Select All', role: 'selectAll', enabled: flags.canSelectAll },
      );
    } else if (selection) {
      items.push({ label: 'Copy', role: 'copy', enabled: flags.canCopy });
    }

    if (selection) {
      const short = selection.length > 24 ? `${selection.slice(0, 24)}…` : selection;
      separator();
      if (isMac) {
        items.push({ label: `Look Up “${short}”`, click: () => contents.showDefinitionForSelection() });
      }
      items.push({
        label: `Search the Web for “${short}”`,
        click: () => { void shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(selection)}`); },
      });
    }

    if (!app.isPackaged) {
      separator();
      items.push({ label: 'Inspect Element', click: () => contents.inspectElement(params.x, params.y) });
    }

    while (items.length && items[items.length - 1].type === 'separator') items.pop();
    if (!items.length) return;

    Menu.buildFromTemplate(items).popup({ window: win });
  });
}
