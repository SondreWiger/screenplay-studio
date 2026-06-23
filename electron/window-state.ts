/**
 * Window state persistence.
 *
 * Saves/restores { x, y, width, height, isMaximized } to a JSON file in
 * the Electron userData directory so the app re-opens exactly where the
 * user left it.
 */

import { app, BrowserWindow, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

const DEFAULTS: WindowState = {
  width: 1400,
  height: 900,
  isMaximized: false,
};

/** Read the saved window state from disk. */
export function loadWindowState(): WindowState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const saved = JSON.parse(raw) as Partial<WindowState>;

      const state: WindowState = {
        width: saved.width && saved.width >= 800 ? saved.width : DEFAULTS.width,
        height: saved.height && saved.height >= 600 ? saved.height : DEFAULTS.height,
        isMaximized: saved.isMaximized ?? false,
      };

      // Only restore position if it's on a visible display
      if (typeof saved.x === 'number' && typeof saved.y === 'number') {
        const displays = screen.getAllDisplays();
        const visible = displays.some((d) => {
          const { x, y, width, height } = d.bounds;
          return (
            saved.x! >= x - 50 &&
            saved.x! <= x + width + 50 &&
            saved.y! >= y - 50 &&
            saved.y! <= y + height + 50
          );
        });
        if (visible) {
          state.x = saved.x;
          state.y = saved.y;
        }
      }

      return state;
    }
  } catch {
    // Corrupted or missing file — use defaults
  }
  return { ...DEFAULTS };
}

/** Persist the current window state to disk. */
function saveWindowState(state: WindowState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Silently fail — non-critical
  }
}

/**
 * Attach event listeners to a BrowserWindow to track and save its
 * geometry on move, resize, and close (debounced).
 */
export function trackWindowState(win: BrowserWindow): void {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      const bounds = win.getBounds();
      saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: win.isMaximized(),
      });
    }, 500);
  };

  win.on('resize', debouncedSave);
  win.on('move', debouncedSave);
  win.on('close', () => {
    if (saveTimer) clearTimeout(saveTimer);
    if (win.isDestroyed()) return;
    const bounds = win.getBounds();
    saveWindowState({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized(),
    });
  });
}
