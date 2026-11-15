import { createHash, timingSafeEqual } from 'crypto';

/** Constant-time string comparison for secrets. Never true for empty/missing input. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
