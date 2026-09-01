import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { licenceSecretConfigured, mintCode, pretty, type ProductKey } from '@/lib/licence';

/**
 * Issuing the codes that make Pro here worth more than Pro here.
 *
 * A Screenplay Studio subscription also covers Cinderra and CastingCall.
 * Those are separate deployments on separate databases, so entitlement
 * travels as a signed code the subscriber pastes in over there.
 *
 * Everything in this file is server side. Minting reads the shared secret,
 * and a browser that could mint would be a browser that could grant itself
 * a subscription in two other products.
 */

/** The apps a Screenplay Studio subscription unlocks. */
export const BUNDLED: ProductKey[] = ['cinderra', 'castingcall'];

export const BUNDLE_APPS: Record<string, { name: string; url: string; blurb: string }> = {
  cinderra: {
    name: 'Cinderra',
    url: 'https://cinderra.app/pro/redeem',
    blurb: 'Infinite canvas for planning — boards, moodboards, shot lists.',
  },
  castingcall: {
    name: 'CastingCall',
    url: 'https://casting-call-jade.vercel.app/billing',
    blurb: 'Applications, selftapes, availability and travel costs.',
  },
};

export type BundleCode = {
  product: ProductKey;
  code: string;
  expiresAt: string;
  redeemedAt: string | null;
};

/**
 * Makes sure a subscriber holds a current code for every bundled app.
 *
 * Safe to call repeatedly — on the account page, after a PayPal webhook, or
 * across every existing subscriber in a backfill. An unexpired code is left
 * alone; anything missing or lapsed is replaced, which is what makes renewal
 * and retroactive issuing the same operation.
 */
export async function ensureBundleCodes(
  userId: string,
  expiresAt: Date
): Promise<{ ok: true; codes: BundleCode[] } | { ok: false; error: string }> {
  if (!licenceSecretConfigured()) {
    return { ok: false, error: 'NORTHEM_LICENCE_SECRET is not set, so bundle codes cannot be issued.' };
  }

  const admin = createAdminSupabaseClient();

  const { data: existing, error } = await admin
    .from('bundle_codes')
    .select('product, code, expires_at, redeemed_at')
    .eq('user_id', userId);

  if (error) {
    if (error.code === '42P01') {
      return { ok: false, error: 'Run supabase/migration_bundle_codes.sql before issuing bundle codes.' };
    }
    return { ok: false, error: error.message };
  }

  const held = new Map((existing || []).map((row) => [row.product as ProductKey, row]));
  const codes: BundleCode[] = [];

  for (const product of BUNDLED) {
    const current = held.get(product);
    const stillGood = current && new Date(current.expires_at).getTime() > Date.now();

    if (stillGood) {
      codes.push({
        product,
        code: pretty(current.code),
        expiresAt: current.expires_at,
        redeemedAt: current.redeemed_at,
      });
      continue;
    }

    // A code is minted for the app it unlocks and nothing else, so a
    // subscriber cannot walk one code across both products.
    const code = mintCode({ products: [product], expiresAt });

    const { error: writeError } = await admin.from('bundle_codes').upsert(
      {
        user_id: userId,
        product,
        code,
        expires_at: expiresAt.toISOString(),
        redeemed_at: null,
      },
      { onConflict: 'user_id,product' }
    );

    if (writeError) return { ok: false, error: writeError.message };

    codes.push({ product, code: pretty(code), expiresAt: expiresAt.toISOString(), redeemedAt: null });
  }

  return { ok: true, codes };
}

/**
 * When a subscription runs to. Falls back to a year out for the accounts
 * that were made Pro by an admin toggle rather than a payment, which is how
 * everyone who signed up before self-serve billing exists got their Pro.
 */
export function coverUntil(subscription: { current_period_end?: string | null } | null) {
  const end = subscription?.current_period_end;
  if (end) return new Date(end);
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
}
