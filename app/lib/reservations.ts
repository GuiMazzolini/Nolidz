/**
 * Stock is held for the length of a checkout, not for the length of a basket.
 *
 * Adding to the basket deliberately holds nothing: a basket can sit for weeks,
 * and holding stock for it would take the last pair of a size out of sale for
 * everyone else. The hold starts when the customer commits to paying, and it
 * has to expire — an abandoned checkout that held stock forever would trade
 * overselling for slowly strangling the catalog.
 *
 * This module stays free of server imports so the cart page can quote the hold
 * duration without pulling the Mongo driver into the client bundle. The
 * database side lives in `lib/stock-hold`.
 */

/** One line of a cart, as held against inventory. */
export type ReservationLine = {
  productId: string;
  quantity: number;
  variantSku?: string;
};

/**
 * `held` owns stock. `committed` was paid for — the stock is gone for good.
 * `released` gave it back. Only `held` may transition, which is what keeps a
 * webhook retry from returning the same stock twice.
 */
export type ReservationStatus = "held" | "committed" | "released";

export type ReservationDoc = {
  reservationId: string;
  stripeSessionId: string | null;
  /** Null for a guest checkout, which has no account to attribute it to. */
  userId: string | null;
  /**
   * Who to count open holds against: the account email, or `ip:<addr>` for a
   * guest. Holding stock costs nothing, so without a cap one script can take
   * the scarce sizes out of sale repeatedly without ever paying.
   */
  holder: string;
  lines: ReservationLine[];
  /**
   * The lines whose stock was actually taken. Releasing gives back only these,
   * so a hold abandoned halfway through cannot return stock it never took.
   */
  applied: ReservationLine[];
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  committedAt?: Date;
  releasedAt?: Date;
  releaseReason?: string;
};

/**
 * How long a checkout may stay open. Stripe rejects an `expires_at` less than
 * 30 minutes out, so this is also the floor.
 */
export const CHECKOUT_HOLD_MINUTES = 30;

/**
 * Open checkouts one buyer may have at once. Enough for someone juggling tabs
 * or retrying a declined card; low enough that abandoning them cannot freeze
 * the catalog. This bounds the blast radius rather than closing the hole —
 * see the README on what it does not solve.
 */
export const MAX_OPEN_HOLDS_PER_BUYER = 3;

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

/** "runner/runner-eu42-black", for logs. */
export function describeLineRef(line: ReservationLine): string {
  return line.variantSku ? `${line.productId}/${line.variantSku}` : line.productId;
}
