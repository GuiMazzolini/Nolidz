import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachSessionToHold,
  commitHold,
  holdStock,
  releaseHold,
  sweepExpiredHolds,
} from "@/app/lib/stock-hold";
import type { ReservationDoc } from "@/app/lib/reservations";
import { mugProduct, runnerProduct } from "@/app/test/fixtures";
import { testDb } from "@/app/test/mongo-double";

/**
 * These run against the in-memory driver double, which applies the same
 * conditional updates the real one does. What is being tested is that a hold
 * cannot take stock that is not there, and that stock taken is always either
 * committed or given back exactly once.
 */

const db = testDb as never;

/** Most of these care about stock, not about who took it. */
function takeHold(args: {
  reservationId: string;
  lines: Parameters<typeof holdStock>[1]["lines"];
  userId?: string | null;
  holder?: string;
}) {
  return holdStock(db, { holder: "buyer@example.com", ...args });
}

/** Stock of one size, as the catalog would report it. */
function stockOf(sku: string): number {
  const product = testDb
    .all("products")
    .find((p) => p.id === "runner") as unknown as typeof runnerProduct;
  return product.variants!.find((v) => v.sku === sku)!.stock;
}

function productStock(id: string): number {
  const product = testDb.all("products").find((p) => p.id === id);
  return product!.stock as number;
}

function holdDoc(reservationId: string): ReservationDoc {
  return testDb
    .all("reservations")
    .find((d) => d.reservationId === reservationId) as unknown as ReservationDoc;
}

const BLACK_42 = "runner-eu42-black"; // stock 3
const WHITE_42 = "runner-eu42-white"; // stock 6

beforeEach(() => {
  testDb.reset();
  testDb.seed("products", [
    structuredClone(runnerProduct),
    structuredClone(mugProduct),
  ]);
  vi.restoreAllMocks();
});

describe("taking a hold", () => {
  it("moves the size and the product mirror together", async () => {
    const result = await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 2, variantSku: BLACK_42 }],
    });

    expect(result).toEqual({ ok: true });
    expect(stockOf(BLACK_42)).toBe(1);
    // The mirror the catalog card reads must fall by the same amount.
    expect(productStock("runner")).toBe(7);
  });

  it("takes stock from a single-SKU product", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "mug", quantity: 2 }],
    });

    expect(productStock("mug")).toBe(0);
  });

  it("refuses to take more of a size than exists", async () => {
    const result = await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 4, variantSku: BLACK_42 }],
    });

    expect(result).toEqual({
      ok: false,
      failed: { productId: "runner", quantity: 4, variantSku: BLACK_42 },
    });
    expect(stockOf(BLACK_42)).toBe(3);
  });

  it("gives back the lines it already took when a later one is short", async () => {
    const result = await takeHold({
      reservationId: "r1",
      lines: [
        { productId: "runner", quantity: 2, variantSku: WHITE_42 },
        { productId: "mug", quantity: 1 },
        // Only three of these exist.
        { productId: "runner", quantity: 9, variantSku: BLACK_42 },
      ],
    });

    expect(result.ok).toBe(false);
    // Nothing may be left held after a refused checkout.
    expect(stockOf(WHITE_42)).toBe(6);
    expect(productStock("mug")).toBe(2);
    expect(holdDoc("r1").status).toBe("released");
  });

  it("lets the second buyer of the last pair fail rather than oversell", async () => {
    const line = { productId: "runner", quantity: 3, variantSku: BLACK_42 };

    const first = await takeHold({ reservationId: "r1", lines: [line] });
    const second = await takeHold({ reservationId: "r2", lines: [line] });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    // The guard is what keeps this from going negative.
    expect(stockOf(BLACK_42)).toBe(0);
  });

  it("records only the lines it actually took", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [
        { productId: "mug", quantity: 1 },
        { productId: "runner", quantity: 99, variantSku: BLACK_42 },
      ],
    });

    // `applied` drives the refund, so it must never include the failed line.
    expect(holdDoc("r1").applied).toEqual([{ productId: "mug", quantity: 1 }]);
  });
});

describe("releasing a hold", () => {
  it("puts the stock back on sale", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 2, variantSku: BLACK_42 }],
    });
    expect(stockOf(BLACK_42)).toBe(1);

    expect(await releaseHold(db, "r1", "expired")).toBe(true);
    expect(stockOf(BLACK_42)).toBe(3);
    expect(productStock("runner")).toBe(9);
  });

  it("does not return the same stock twice", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 2, variantSku: BLACK_42 }],
    });

    await releaseHold(db, "r1", "expired");
    // The sweep and the expired-session webhook can both reach the same hold.
    expect(await releaseHold(db, "r1", "webhook")).toBe(false);
    expect(stockOf(BLACK_42)).toBe(3);
  });

  it("reports nothing to release for an unknown hold", async () => {
    expect(await releaseHold(db, "nope", "expired")).toBe(false);
  });

  it("warns rather than throws when the size was deleted mid-checkout", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 1, variantSku: BLACK_42 }],
    });

    // An admin edits the colourway away while the customer is on Stripe.
    testDb.seed("products", [{ ...structuredClone(runnerProduct), variants: [] }]);

    expect(await releaseHold(db, "r1", "expired")).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("runner/" + BLACK_42));
  });

  it("cannot release what was already paid for", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 2, variantSku: BLACK_42 }],
    });
    await commitHold(db, "r1");

    expect(await releaseHold(db, "r1", "expired")).toBe(false);
    // Committed stock stays sold.
    expect(stockOf(BLACK_42)).toBe(1);
  });
});

describe("committing a hold", () => {
  it("moves no counters, because the stock already left at hold time", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 2, variantSku: BLACK_42 }],
    });

    expect(await commitHold(db, "r1")).toBe("committed");
    expect(stockOf(BLACK_42)).toBe(1);
  });

  it("is safe to retry, as Stripe retries webhooks", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 2, variantSku: BLACK_42 }],
    });

    await commitHold(db, "r1");
    expect(await commitHold(db, "r1")).toBe("already-committed");
    expect(stockOf(BLACK_42)).toBe(1);
  });

  it("reports a hold that expired before the payment landed", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 2, variantSku: BLACK_42 }],
    });
    await releaseHold(db, "r1", "expired");

    // "gone" is the signal for fulfillment to decrement directly instead.
    expect(await commitHold(db, "r1")).toBe("gone");
  });

  it("reports an unknown hold as gone", async () => {
    expect(await commitHold(db, "nope")).toBe("gone");
  });
});

describe("sweeping expired holds", () => {
  it("returns stock from a checkout nobody paid for", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 3, variantSku: BLACK_42 }],
    });
    expect(stockOf(BLACK_42)).toBe(0);

    const later = new Date(Date.now() + 60 * 60_000);
    expect(await sweepExpiredHolds(db, later)).toBe(1);
    expect(stockOf(BLACK_42)).toBe(3);
  });

  it("leaves a checkout that is still open alone", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 3, variantSku: BLACK_42 }],
    });

    expect(await sweepExpiredHolds(db, new Date())).toBe(0);
    expect(stockOf(BLACK_42)).toBe(0);
  });

  it("ignores holds that are already settled", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 1, variantSku: BLACK_42 }],
    });
    await commitHold(db, "r1");

    const later = new Date(Date.now() + 60 * 60_000);
    expect(await sweepExpiredHolds(db, later)).toBe(0);
    // A committed hold must never hand stock back.
    expect(stockOf(BLACK_42)).toBe(2);
  });
});

describe("the Stripe session on a hold", () => {
  it("is recorded for support lookups", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "mug", quantity: 1 }],
      userId: "buyer@example.com",
    });
    await attachSessionToHold(db, "r1", "cs_test_1");

    const doc = holdDoc("r1");
    expect(doc.stripeSessionId).toBe("cs_test_1");
    expect(doc.userId).toBe("buyer@example.com");
  });

  it("leaves a guest hold unattributed", async () => {
    await takeHold({
      reservationId: "r1",
      lines: [{ productId: "mug", quantity: 1 }],
    });

    expect(holdDoc("r1").userId).toBeNull();
  });
});
