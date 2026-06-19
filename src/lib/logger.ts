// Centralized logger — replaces scattered console.log/warn/error
// In production, only errors are logged. In development, all levels are active.
// Can be extended to send to external services (Sentry, etc.)

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = process.env.NODE_ENV === 'development';
const minLevel: LogLevel = isDev ? 'debug' : 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function formatMessage(level: LogLevel, tag: string, message: string): string {
  const prefix = tag ? `[${tag}]` : '';
  return `${prefix} ${message}`;
}

export const logger = {
  debug(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', tag, message), ...args);
    }
  },

  info(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('info')) {
      console.info(formatMessage('info', tag, message), ...args);
    }
  },

  warn(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', tag, message), ...args);
    }
  },

  error(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', tag, message), ...args);
    }
  },
};

export default logger;
