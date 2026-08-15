import { describe, expect, it } from "vitest";

import {
  CHECKOUT_HOLD_MINUTES,
  checkoutSessionExpiresAt,
  reservationExpiresAt,
} from "@/app/lib/reservations";

const NOW = new Date("2026-01-01T12:00:00.000Z");

describe("the checkout hold window", () => {
  it("gives Stripe unix seconds, not milliseconds", () => {
    const expiry = checkoutSessionExpiresAt(NOW);

    expect(expiry).toBe(NOW.getTime() / 1000 + CHECKOUT_HOLD_MINUTES * 60);
    // Milliseconds here would read as the year 56000 and Stripe would reject it.
    expect(String(expiry)).toHaveLength(10);
  });

  it("meets Stripe's 30-minute floor", () => {
    expect(CHECKOUT_HOLD_MINUTES).toBeGreaterThanOrEqual(30);
  });

  it("outlives the Stripe session, so a last-second payment still has its hold", () => {
    const session = checkoutSessionExpiresAt(NOW) * 1000;
    expect(reservationExpiresAt(NOW).getTime()).toBeGreaterThan(session);
  });
});
