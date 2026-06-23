/**
 * Custom theme system.
 *
 * A theme is a set of CSS color overrides that the user can tweak
 * via a full-screen editor. Themes are shared via a SHA-256 hash
 * embedded in the URL: /colors/<sha>
 */

// ── Types ──────────────────────────────────────────────────────

export interface ThemeColors {
  /** Main background (surface-950) */
  bgBase: string;
  /** Card/panel background (surface-900) */
  bgSurface: string;
  /** Elevated surface (surface-800) */
  bgElevated: string;
  /** Border / divider (surface-700) */
  border: string;
  /** Primary text (white) */
  textPrimary: string;
  /** Secondary text (surface-300) */
  textSecondary: string;
  /** Muted text (surface-500) */
  textMuted: string;
  /** Brand / accent color (orange #FF5F1F) */
  brand: string;
  /** Script page background (dark: #1a1a2e) */
  scriptBg: string;
  /** Script page text (dark: #e0e0e0) */
  scriptText: string;
}

export interface AppTheme {
  name: string;
  colors: ThemeColors;
}

// ── Defaults ───────────────────────────────────────────────────

export const DEFAULT_THEME: AppTheme = {
  name: 'Default',
  colors: {
    bgBase: '#070710',
    bgSurface: '#0f0f1c',
    bgElevated: '#181828',
    border: '#24243a',
    textPrimary: '#f4f4fc',
    textSecondary: '#b0b0cc',
    textMuted: '#5c5c7a',
    brand: '#FF5F1F',
    scriptBg: '#1a1a2e',
    scriptText: '#e0e0e0',
  },
};

// ── Color pickers config ───────────────────────────────────────

export const THEME_COLOR_FIELDS: { key: keyof ThemeColors; label: string; group: 'ui' | 'text' | 'script' }[] = [
  { key: 'bgBase', label: 'Background', group: 'ui' },
  { key: 'bgSurface', label: 'Surface', group: 'ui' },
  { key: 'bgElevated', label: 'Elevated', group: 'ui' },
  { key: 'border', label: 'Border', group: 'ui' },
  { key: 'brand', label: 'Accent', group: 'ui' },
  { key: 'textPrimary', label: 'Primary text', group: 'text' },
  { key: 'textSecondary', label: 'Secondary text', group: 'text' },
  { key: 'textMuted', label: 'Muted text', group: 'text' },
  { key: 'scriptBg', label: 'Script background', group: 'script' },
  { key: 'scriptText', label: 'Script text', group: 'script' },
];

// ── SHA-256 hash ───────────────────────────────────────────────

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Encode / decode theme to compact string ────────────────────
//
// The theme is encoded as a JSON object, then base64url-encoded.
// The SHA is computed over the JSON string.

export async function encodeTheme(theme: AppTheme): Promise<{ sha: string; encoded: string }> {
  const json = JSON.stringify(theme);
  const sha = await sha256hex(json);
  const encoded = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { sha, encoded };
}

export function decodeTheme(encoded: string): AppTheme | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (encoded.length % 4)) % 4);
    const json = atob(padded);
    const theme = JSON.parse(json) as AppTheme;
    if (theme.colors && typeof theme.colors.bgBase === 'string') return theme;
    return null;
  } catch {
    return null;
  }
}

// ── Apply theme to document ────────────────────────────────────

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty('--theme-bg-base', c.bgBase);
  root.style.setProperty('--theme-bg-surface', c.bgSurface);
  root.style.setProperty('--theme-bg-elevated', c.bgElevated);
  root.style.setProperty('--theme-border', c.border);
  root.style.setProperty('--theme-text-primary', c.textPrimary);
  root.style.setProperty('--theme-text-secondary', c.textSecondary);
  root.style.setProperty('--theme-text-muted', c.textMuted);
  root.style.setProperty('--theme-brand', c.brand);
  root.style.setProperty('--theme-script-bg', c.scriptBg);
  root.style.setProperty('--theme-script-text', c.scriptText);
  root.setAttribute('data-custom-theme', '1');
}

export function clearTheme() {
  const root = document.documentElement;
  [
    '--theme-bg-base', '--theme-bg-surface', '--theme-bg-elevated',
    '--theme-border', '--theme-text-primary', '--theme-text-secondary',
    '--theme-text-muted', '--theme-brand', '--theme-script-bg', '--theme-script-text',
  ].forEach((v) => root.style.removeProperty(v));
  root.removeAttribute('data-custom-theme');
}

// ── Stripe SVG for embeds ──────────────────────────────────────

export function generateStripeSVG(theme: AppTheme): string {
  const c = theme.colors;
  const colors = [c.bgBase, c.bgSurface, c.bgElevated, c.brand, c.scriptBg, c.textPrimary, c.scriptText, c.border];
  const stripeH = 20;
  const w = 600;
  const h = colors.length * stripeH;
  const rects = colors
    .map((col, i) => `<rect x="0" y="${i * stripeH}" width="${w}" height="${stripeH}" fill="${col}" />`)
    .join('\n    ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${rects}
    <text x="${w / 2}" y="${h + 24}" text-anchor="middle" font-family="monospace" font-size="12" fill="#888">screenplaystudio.fun/colors</text>
  </svg>`;
}
