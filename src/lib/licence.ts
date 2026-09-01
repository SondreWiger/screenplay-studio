// Server only: this file reads NORTHEM_LICENCE_SECRET and must never reach a bundle.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Northem licence codes — one Pro purchase, unlocked across three apps.
 *
 * Screenplay Studio, Cinderra and CastingCall each run their own Supabase
 * project. There is no shared database to ask "is this person Pro?", and
 * making one app call another at redemption time would mean a sale in one
 * product fails whenever a different product is down.
 *
 * So a code carries its own proof. The issuing app signs a tiny payload with
 * a secret all three share; the redeeming app checks the signature offline
 * and writes the code into its own ledger so it cannot be used twice. No
 * network call between apps, and no way to forge a code without the secret.
 *
 * What that buys, and what it costs:
 *   + redemption works even if the issuing app is down
 *   + retroactive codes are just a mint loop, no backfill dance
 *   - a code cannot be revoked once redeemed, so it carries an expiry
 *     instead: codes are minted for the length of the subscription and
 *     re-minted on renewal. A lapsed subscription simply stops re-minting.
 *
 * The same file exists in all three repos and must stay byte-identical in
 * behaviour. If you change the format, bump VERSION and keep the old branch
 * readable, because codes are already in people's inboxes.
 */

/* ------------------------------------------------------------------ *
 * Format
 * ------------------------------------------------------------------ */

const VERSION = 1;

/** Bit per product, so one code can unlock several at once. */
export const PRODUCTS = {
  sps: 1 << 0,
  cinderra: 1 << 1,
  castingcall: 1 << 2,
} as const;

export type ProductKey = keyof typeof PRODUCTS;

export const PRODUCT_LABELS: Record<ProductKey, string> = {
  sps: 'Screenplay Studio',
  cinderra: 'Cinderra',
  castingcall: 'CastingCall',
};

/** Days are counted from here so an expiry fits in two bytes. */
const EPOCH = Date.UTC(2020, 0, 1);
const DAY_MS = 86_400_000;

/**
 * Crockford's base32: no I, L, O or U, so there is no ambiguity between
 * one and ell, or zero and oh, when somebody reads a code off a screen.
 * Shared with the browser-safe half of the format.
 */
import { ALPHABET, normalise, pretty } from './licence-format';

export { normalise, pretty };

/** Fixed 20-byte payload → exactly 32 characters, in eight groups of four. */
const NONCE_BYTES = 7;
const MAC_BYTES = 10;
const SIGNED_BYTES = 1 + 2 + NONCE_BYTES; // version+products, expiry, nonce
const TOTAL_BYTES = SIGNED_BYTES + MAC_BYTES;

function encode(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let out = '';

  // Indexed rather than for..of: the three repos build against different
  // TypeScript targets, and iterating a Buffer needs a modern one.
  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function decode(text: string): Buffer | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const index = ALPHABET.indexOf(text[i]);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function secret() {
  const value = process.env.NORTHEM_LICENCE_SECRET || '';
  if (value.length < 32) {
    throw new Error(
      'NORTHEM_LICENCE_SECRET is missing or too short. It must be the same 32+ character secret in Screenplay Studio, Cinderra and CastingCall.'
    );
  }
  return value;
}

export function licenceSecretConfigured() {
  return (process.env.NORTHEM_LICENCE_SECRET || '').length >= 32;
}

function sign(signed: Buffer) {
  return createHmac('sha256', secret()).update(signed).digest().subarray(0, MAC_BYTES);
}

/* ------------------------------------------------------------------ *
 * Minting and checking
 * ------------------------------------------------------------------ */

export type Mint = {
  /** Which products this code unlocks when redeemed. */
  products: ProductKey[];
  /** Last day the code may be redeemed, and how long the grant then lasts. */
  expiresAt: Date;
};

export function mintCode({ products, expiresAt }: Mint) {
  let mask = 0;
  for (const product of products) mask |= PRODUCTS[product];
  if (!mask) throw new Error('A code must unlock at least one product.');

  const days = Math.floor((expiresAt.getTime() - EPOCH) / DAY_MS);
  if (days < 0 || days > 0xffff) throw new Error('That expiry is outside the range a code can carry.');

  const signed = Buffer.alloc(SIGNED_BYTES);
  // Version in the top three bits, product mask in the low five.
  signed[0] = (VERSION << 5) | (mask & 31);
  signed.writeUInt16BE(days, 1);
  randomBytes(NONCE_BYTES).copy(signed, 3);

  return encode(Buffer.concat([signed, sign(signed)]));
}

export type CodeCheck =
  | { ok: true; products: ProductKey[]; expiresAt: Date; code: string }
  | { ok: false; error: string };

/**
 * Verifies a code without contacting anyone.
 *
 * `wantedProduct` is the app doing the checking: a code minted for Cinderra
 * is rejected by CastingCall even though the signature is perfectly valid,
 * so one code cannot be walked between products.
 */
export function readCode(input: string, wantedProduct: ProductKey): CodeCheck {
  const code = normalise(input);
  if (code.length !== Math.ceil((TOTAL_BYTES * 8) / 5)) {
    return { ok: false, error: 'That code is not the right length. Check for a missing character.' };
  }

  const bytes = decode(code);
  if (!bytes || bytes.length < TOTAL_BYTES) {
    return { ok: false, error: 'That code contains characters we do not recognise.' };
  }

  const signed = bytes.subarray(0, SIGNED_BYTES);
  const mac = bytes.subarray(SIGNED_BYTES, TOTAL_BYTES);

  const expected = sign(signed);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) {
    return { ok: false, error: 'That code is not valid. Check you copied all of it.' };
  }

  if (signed[0] >> 5 !== VERSION) {
    return { ok: false, error: 'That code was issued by an older version. Ask us for a fresh one.' };
  }

  const mask = signed[0] & 31;
  const products = (Object.keys(PRODUCTS) as ProductKey[]).filter((key) => mask & PRODUCTS[key]);

  if (!products.includes(wantedProduct)) {
    const listed = products.map((key) => PRODUCT_LABELS[key]).join(' and ');
    return {
      ok: false,
      error: `That code unlocks ${listed || 'nothing here'}, not ${PRODUCT_LABELS[wantedProduct]}.`,
    };
  }

  const expiresAt = new Date(EPOCH + signed.readUInt16BE(1) * DAY_MS);
  if (expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'That code has expired. If your subscription is still active, ask us for a new one.' };
  }

  return { ok: true, products, expiresAt, code };
}
