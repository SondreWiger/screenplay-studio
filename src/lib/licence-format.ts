/**
 * The parts of the licence code format that are safe in a browser.
 *
 * Shaping and tidying a code needs no secret, and the redeem box wants to
 * group characters as they are typed. The signing and checking stay in
 * licence.ts, which is server-only — importing that from a client component
 * would drag the HMAC secret towards the bundle.
 */

/** Crockford's base32: no I, L, O or U, so nothing reads ambiguously. */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Length of a full code, in characters. */
export const CODE_LENGTH = 32;

/**
 * Accepts a code however it arrives — pasted with dashes, typed in lower
 * case, with a stray space, or with an O where a zero belongs.
 */
export function normalise(code: string) {
  return code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V')
    .slice(0, CODE_LENGTH);
}

/** Groups a code for display: XXXX-XXXX-… */
export function pretty(code: string) {
  return (normalise(code).match(/.{1,4}/g) || []).join('-');
}
