import { createHash, randomBytes } from 'crypto';
import type { TokenScope } from './scopes';

export { TOKEN_SCOPES, type TokenScope } from './scopes';

/**
 * Personal access tokens for the MCP endpoint.
 *
 * Tokens look like `sps_<43 url-safe chars>`. The prefix makes them easy to
 * spot in a config file and lets secret scanners recognise them. Only the
 * SHA-256 hash is stored; a plain hash (not bcrypt) is right here because the
 * token itself has 256 bits of entropy, and the lookup happens on every MCP
 * request.
 */

export const TOKEN_PREFIX = 'sps_';

export function generateToken(): { token: string; hash: string; prefix: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token), prefix: token.slice(0, 12) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function looksLikeToken(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX) && value.length >= 40 && value.length <= 80;
}

/** Pulls the token out of `Authorization: Bearer sps_...`. */
export function tokenFromHeader(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match || !looksLikeToken(match[1])) return null;
  return match[1];
}

/** A scope can do everything the scopes before it can. */
export function scopeAllows(granted: TokenScope, needed: TokenScope): boolean {
  const rank: Record<TokenScope, number> = { read: 0, write: 1, admin: 2 };
  return rank[granted] >= rank[needed];
}
