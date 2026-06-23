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
  id?: string;
  author_id?: string;
  author_name?: string;
  category?: string;
  description?: string;
  created_at?: string;
  use_count?: number;
  is_staff_pick?: boolean;
  staff_pick_week?: string;
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

// ── Color helpers ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbStr(r: number, g: number, b: number): string {
  return `${r} ${g} ${b}`;
}

function mix(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function generateSurfacePalette(base: string, surface: string, elevated: string, textPrimary: string): string[] {
  const [bR, bG, bB] = hexToRgb(base);
  const [sR, sG, sB] = hexToRgb(surface);
  const [eR, eG, eB] = hexToRgb(elevated);
  const [tR, tG, tB] = hexToRgb(textPrimary);

  return [
    rgbStr(mix(tR, sR, 0.8), mix(tG, sG, 0.8), mix(tB, sB, 0.8)),       // 50 - lightest
    rgbStr(mix(tR, sR, 0.65), mix(tG, sG, 0.65), mix(tB, sB, 0.65)),     // 100
    rgbStr(mix(tR, sR, 0.5), mix(tG, sG, 0.5), mix(tB, sB, 0.5)),        // 200
    rgbStr(mix(tR, sR, 0.35), mix(tG, sG, 0.35), mix(tB, sB, 0.35)),     // 300
    rgbStr(mix(tR, sR, 0.2), mix(tG, sG, 0.2), mix(tB, sB, 0.2)),        // 400
    rgbStr(mix(sR, eR, 0.4), mix(sG, eG, 0.4), mix(sB, eB, 0.4)),        // 500
    rgbStr(mix(sR, eR, 0.7), mix(sG, eG, 0.7), mix(sB, eB, 0.7)),        // 600
    rgbStr(eR, eG, eB),                                                     // 700 - border
    rgbStr(mix(eR, bR, 0.4), mix(eG, bG, 0.4), mix(eB, bB, 0.4)),        // 800
    rgbStr(mix(eR, bR, 0.7), mix(eG, bG, 0.7), mix(eB, bB, 0.7)),        // 900
    rgbStr(bR, bG, bB),                                                     // 950 - base
  ];
}

function generateBrandPalette(accent: string): string[] {
  const [aR, aG, aB] = hexToRgb(accent);
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [10, 10, 10];

  return [
    rgbStr(...white.map((w, i) => mix(w, [aR, aG, aB][i], 0.12)) as [number, number, number]),  // 50
    rgbStr(...white.map((w, i) => mix(w, [aR, aG, aB][i], 0.25)) as [number, number, number]),  // 100
    rgbStr(...white.map((w, i) => mix(w, [aR, aG, aB][i], 0.4)) as [number, number, number]),   // 200
    rgbStr(...white.map((w, i) => mix(w, [aR, aG, aB][i], 0.6)) as [number, number, number]),   // 300
    rgbStr(...white.map((w, i) => mix(w, [aR, aG, aB][i], 0.8)) as [number, number, number]),   // 400
    rgbStr(aR, aG, aB),                                                                           // 500
    rgbStr(...[aR, aG, aB].map((v, i) => mix(v, [black[0], black[1], black[2]][i], 0.15)) as [number, number, number]), // 600
    rgbStr(...[aR, aG, aB].map((v, i) => mix(v, [black[0], black[1], black[2]][i], 0.3)) as [number, number, number]),  // 700
    rgbStr(...[aR, aG, aB].map((v, i) => mix(v, [black[0], black[1], black[2]][i], 0.5)) as [number, number, number]),  // 800
    rgbStr(...[aR, aG, aB].map((v, i) => mix(v, [black[0], black[1], black[2]][i], 0.7)) as [number, number, number]),  // 900
    rgbStr(...[aR, aG, aB].map((v, i) => mix(v, [black[0], black[1], black[2]][i], 0.85)) as [number, number, number]), // 950
  ];
}

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

  // Generate full surface palette from the 4 user surface colors
  const surfacePalette = generateSurfacePalette(c.bgBase, c.bgSurface, c.bgElevated, c.textPrimary);
  const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
  SHADES.forEach((shade, i) => {
    root.style.setProperty(`--surface-${shade}`, surfacePalette[i]);
  });

  // Generate full brand palette from accent color
  const brandPalette = generateBrandPalette(c.brand);
  SHADES.forEach((shade, i) => {
    root.style.setProperty(`--brand-${shade}`, brandPalette[i]);
  });

  // Script editor overrides
  root.style.setProperty('--theme-script-bg', c.scriptBg);
  root.style.setProperty('--theme-script-text', c.scriptText);

  root.setAttribute('data-custom-theme', '1');
}

export function clearTheme() {
  const root = document.documentElement;
  const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
  SHADES.forEach((shade) => {
    root.style.removeProperty(`--surface-${shade}`);
    root.style.removeProperty(`--brand-${shade}`);
  });
  root.style.removeProperty('--theme-script-bg');
  root.style.removeProperty('--theme-script-text');
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

// ── Categories ─────────────────────────────────────────────────

export const THEME_CATEGORIES = [
  { id: 'all', label: 'All Themes', icon: '🎨' },
  { id: 'dark', label: 'Dark', icon: '🌙' },
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'neon', label: 'Neon', icon: '⚡' },
  { id: 'pastel', label: 'Pastel', icon: '🌸' },
  { id: 'warm', label: 'Warm', icon: '🔥' },
  { id: 'cool', label: 'Cool', icon: '❄️' },
  { id: 'minimal', label: 'Minimal', icon: '◻️' },
  { id: 'retro', label: 'Retro', icon: '📼' },
] as const;

export type ThemeCategory = typeof THEME_CATEGORIES[number]['id'];
