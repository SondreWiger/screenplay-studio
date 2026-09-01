/**
 * What everything costs, in one place.
 *
 * Prices live here rather than in the pricing page's markup so the page,
 * the checkout and the emails cannot drift apart — which is how a customer
 * ends up seeing one number and being charged another.
 *
 * The portfolio follows DaVinci Resolve: the free tier is the whole product,
 * and paying buys a separate suite of heavier tools. CastingCall is the one
 * deliberate exception. It is not a creative tool somebody uses alone — it
 * holds other people's names, addresses and phone numbers, and running a
 * casting call is a commercial act. So it is paid, with a trial small enough
 * to be honest about being a trial.
 */

export const CURRENCY = 'usd';

/** Everything in cents, because that is what PayPal wants. */
export const PRICES = {
  sps: {
    yearly: 24900,
    monthly: 2900,
    /** Per seat on a team plan, bought in bulk. */
    teamSeat: 19900,
  },
  cinderra: {
    /** Billed monthly; the annual figure is what twelve months would cost. */
    monthly: 900,
    yearly: 10800,
    teamMonthly: 3400,
  },
  castingcall: {
    /** One production, no expiry. */
    projectPass: 10000,
    monthly: 5000,
  },
} as const;

/** The monthly CastingCall plan is billed for at least this many months. */
export const CASTINGCALL_COMMITMENT_MONTHS = 2;

/**
 * The free trial.
 *
 * Deliberately shown up front rather than discovered by hitting a wall. The
 * numbers are small because CastingCall is sold per production: a trial that
 * covers a real shoot is not a trial, it is the product.
 */
export const TRIAL = {
  productions: 1,
  applicants: 10,
  exports: false,
  label: '1 production, 10 applicants',
} as const;

export function formatPrice(cents: number, currency: string = CURRENCY) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * What buying Screenplay Studio Pro actually gets you.
 *
 * Used by the pricing page in all three apps, so the bundle is described
 * identically wherever somebody meets it.
 */
export const BUNDLE = {
  sourceLabel: 'Screenplay Studio Pro',
  unlocks: ['cinderra', 'castingcall'] as const,
  blurb:
    'Screenplay Studio Pro includes Cinderra Pro and CastingCall Pro. Write it, plan it on a canvas, then cast it — one subscription, three apps.',
};
