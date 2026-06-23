import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let prefsCache: Record<string, any> | null = null;

function getPrefsPath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function loadPrefs() {
  if (prefsCache) return prefsCache;
  try {
    const data = fs.readFileSync(getPrefsPath(), 'utf-8');
    prefsCache = JSON.parse(data);
  } catch {
    prefsCache = {};
  }
  return prefsCache;
}

function savePrefs(prefs: Record<string, any>) {
  prefsCache = prefs;
  try {
    fs.mkdirSync(path.dirname(getPrefsPath()), { recursive: true });
    fs.writeFileSync(getPrefsPath(), JSON.stringify(prefs, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Preferences] Failed to save preferences:', err);
  }
}

export function getPreference(key: string) {
  const prefs = loadPrefs();
  return prefs ? prefs[key] : undefined;
}

export function setPreference(key: string, value: any) {
  const prefs = loadPrefs();
  if (prefs) {
    prefs[key] = value;
    savePrefs(prefs);
  }
}
