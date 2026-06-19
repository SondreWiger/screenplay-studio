// Centralized constants — single source of truth for app-wide values

// Brand colors
export const COLORS = {
  brand: {
    50: '#FFF4ED',
    100: '#FFE5D4',
    200: '#FFCBA8',
    300: '#FFA971',
    400: '#FF7D38',
    500: '#FF5F1F',
    600: '#E54E15',
    700: '#BF3A0D',
    800: '#992F0F',
    900: '#7D2A10',
    950: '#431206',
  },
  discord: '#5865F2',
  surface: {
    950: '#070710',
  },
} as const;

// App config
export const APP_NAME = 'Screenplay Studio';
export const APP_URL = 'https://screenplay.studio';
export const APP_LOGO = `${APP_URL}/logo.png`;

// Discord
export const DISCORD_BOT_NAME = 'Screenplay Studio Bot';
export const DISCORD_AVATAR_URL = APP_LOGO;

// Challenge theme emoji mapping (shared across discord.ts, scheduler, announce)
export const THEME_EMOJI_MAP: Array<[string, string]> = [
  ['day', '⏰'], ['time', '⏰'],
  ['stranger', '👤'], ['person', '👤'],
  ['wrong', '✉️'], ['letter', '✉️'],
  ['room', '🏠'], ['silent', '🏠'],
  ['train', '🚂'], ['film', '🚂'],
  ['night', '🌙'], ['dark', '🌙'],
  ['loop', '🔄'],
  ['heist', '💰'], ['money', '💰'],
  ['contact', '📞'], ['first', '📞'],
  ['party', '🍽️'], ['dinner', '🍽️'],
  ['unreliable', '🤔'],
  ['chase', '🏃'], ['pursuit', '🏃'],
  ['backwards', '⬅️'],
  ['audition', '🎭'],
];

export const DEFAULT_THEME_EMOJI = '🎪';

/**
 * Get an emoji representing a challenge theme.
 * Shared across discord.ts, scheduler route, and announce route.
 */
export function getThemeEmoji(theme: string | null | undefined): string {
  if (!theme) return DEFAULT_THEME_EMOJI;
  const lower = theme.toLowerCase();
  for (const [keyword, emoji] of THEME_EMOJI_MAP) {
    if (lower.includes(keyword)) return emoji;
  }
  return DEFAULT_THEME_EMOJI;
}

// Challenge phase emoji mapping (shared across scheduler and announce routes)
export const PHASE_EMOJI_MAP: Record<string, string> = {
  upcoming: '🚀',
  submissions: '📝',
  voting: '🗳️',
  completed: '🏆',
  reveal_pending: '⏳',
};

export const DEFAULT_PHASE_EMOJI = '🎭';

export function getPhaseEmoji(phase: string): string {
  return PHASE_EMOJI_MAP[phase] || DEFAULT_PHASE_EMOJI;
}

// Screenplay formatting
export const SCREENPLAY = {
  FONT_SIZE: 12,
  LINE_HEIGHT: 1.5,
  LINES_PER_PAGE: 56,
  CHARACTER_MARGIN: '35%',
  PARENTHETICAL_MARGIN: '30%',
  DIALOGUE_MARGIN: '25%',
  DIALOGUE_MAX_WIDTH: '35ch',
  PARENTHETICAL_MAX_WIDTH: '25ch',
} as const;
