/**
 * Stock is held for the length of a checkout, not for the length of a basket.
 *
 * Adding to the basket deliberately holds nothing: a basket can sit for weeks,
 * and holding stock for it would take the last pair of a size out of sale for
 * everyone else. The hold starts when the customer commits to paying, and it
 * has to expire — an abandoned checkout that held stock forever would trade
 * overselling for slowly strangling the catalog.
 */

/**
 * How long a checkout may stay open. Stripe rejects an `expires_at` less than
 * 30 minutes out, so this is also the floor.
 */
export const CHECKOUT_HOLD_MINUTES = 30;

/**
 * The hold outlives the Stripe session by this much. Payment authorised in the
 * final seconds of a session still arrives as a webhook a moment later; without
 * the grace period that hold would be swept and the stock sold twice.
 */
const HOLD_GRACE_MINUTES = 5;

const MINUTE_MS = 60_000;

/** Unix seconds, which is the unit Stripe's `expires_at` takes. */
export function checkoutSessionExpiresAt(now: Date = new Date()): number {
  return Math.floor((now.getTime() + CHECKOUT_HOLD_MINUTES * MINUTE_MS) / 1000);
}

export function reservationExpiresAt(now: Date = new Date()): Date {
  return new Date(
    now.getTime() + (CHECKOUT_HOLD_MINUTES + HOLD_GRACE_MINUTES) * MINUTE_MS
  );
}
