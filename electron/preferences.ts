import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Desktop preferences, stored as JSON in userData.
 *
 * Two kinds of keys live here: the `ss-*` keys the web app reads and writes
 * through the preload bridge (local mode, onboarding), and the typed desktop
 * settings below, which only the main process acts on.
 */

export type ThemeSource = 'system' | 'light' | 'dark';
export type LaunchBehaviour = 'restore' | 'dashboard';

export interface DesktopSettings {
  /** Native window chrome, context menus and dialogs follow this. */
  theme: ThemeSource;
  /** Page zoom, as a Chromium zoom level (0 = 100%). */
  zoomLevel: number;
  /** Spell checking in text fields, with suggestions in the right-click menu. */
  spellcheck: boolean;
  /** What a new launch opens. */
  launchBehaviour: LaunchBehaviour;
  /** Download updates in the background and offer a restart. */
  autoUpdate: boolean;
  /** Last workspace path, for `launchBehaviour: 'restore'`. */
  lastPath: string;
}

export const DEFAULT_SETTINGS: DesktopSettings = {
  theme: 'dark',
  zoomLevel: 0,
  spellcheck: true,
  launchBehaviour: 'restore',
  autoUpdate: true,
  lastPath: '',
};

const SETTINGS_KEY = 'desktop-settings';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prefsCache: Record<string, any> | null = null;

function getPrefsPath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPrefs(): Record<string, any> {
  if (prefsCache) return prefsCache;
  try {
    const data = fs.readFileSync(getPrefsPath(), 'utf-8');
    const parsed = JSON.parse(data);
    prefsCache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    prefsCache = {};
  }
  return prefsCache!;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function writeNow() {
  if (!prefsCache) return;
  try {
    fs.mkdirSync(path.dirname(getPrefsPath()), { recursive: true });
    // Write to a temp file and rename, so a crash mid-write can't leave
    // half a JSON file that resets every preference on the next launch.
    const tmp = `${getPrefsPath()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(prefsCache, null, 2), 'utf-8');
    fs.renameSync(tmp, getPrefsPath());
  } catch (err) {
    console.error('[preferences] Failed to save:', err);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; writeNow(); }, 150);
}

/** Flush pending writes; call before quitting. */
export function flushPreferences() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; writeNow(); }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPreference(key: string): any {
  return loadPrefs()[key];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setPreference(key: string, value: any) {
  const prefs = loadPrefs();
  if (value === null || value === undefined) delete prefs[key];
  else prefs[key] = value;
  // The web app's keys gate onboarding and local mode, so write them through
  // immediately rather than on the debounce.
  if (key.startsWith('ss-')) writeNow();
  else scheduleSave();
}

export function getSettings(): DesktopSettings {
  const stored = loadPrefs()[SETTINGS_KEY];
  return { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
}

export function updateSettings(patch: Partial<DesktopSettings>): DesktopSettings {
  const next = { ...getSettings() };
  for (const key of Object.keys(patch) as (keyof DesktopSettings)[]) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    const value = patch[key];
    if (value === undefined || typeof value !== typeof DEFAULT_SETTINGS[key]) continue;
    (next as unknown as Record<string, unknown>)[key] = value;
  }
  next.zoomLevel = Math.max(-3, Math.min(3, next.zoomLevel));
  loadPrefs()[SETTINGS_KEY] = next;
  scheduleSave();
  return next;
}
