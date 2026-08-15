import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  commitHold,
  holdStock,
  releaseHold,
  sweepExpiredHolds,
} from "@/app/lib/stock-hold";
import type { ProductDoc } from "@/app/lib/db-collections";
import type { ReservationDoc } from "@/app/lib/reservations";
import { runnerProduct } from "@/app/test/fixtures";
import {
  getIntegrationMongo,
  useTestDatabase,
  type TestDatabase,
} from "@/app/test/mongo-integration";

/**
 * The whole point of a hold is that it cannot be beaten by a concurrent one,
 * and that guarantee comes from MongoDB applying a conditional update to a
 * single document atomically. The in-memory double models that behaviour, but
 * it is single-threaded and it is our own code, so it cannot prove it. These
 * tests fire real overlapping writes at a real server.
 */

const mongoUri = await getIntegrationMongo();
let test: TestDatabase;

const BLACK_42 = "runner-eu42-black"; // three in stock

async function seedCatalog() {
  await test.db.collection("products").insertOne(structuredClone(runnerProduct));
}

async function sizeStock(sku: string): Promise<number> {
  const doc = await test.db
    .collection<ProductDoc>("products")
    .findOne({ id: "runner" });
  return doc!.variants!.find((v) => v.sku === sku)!.stock;
}

async function productStock(): Promise<number> {
  const doc = await test.db
    .collection<ProductDoc>("products")
    .findOne({ id: "runner" });
  return doc!.stock;
}

describe.skipIf(!mongoUri)("stock holds against a real MongoDB", () => {
  beforeAll(async () => {
    test = await useTestDatabase("stock_hold", mongoUri!);
  });

  afterEach(async () => {
    await test.clear();
  });

  afterAll(async () => {
    await test?.teardown();
  });

  it("lets exactly one of many simultaneous buyers take the last pair", async () => {
    await seedCatalog();

    // Ten checkouts fired at once, each wanting all three remaining pairs.
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        holdStock(test.db, {
          reservationId: `r${i}`,
          lines: [{ productId: "runner", quantity: 3, variantSku: BLACK_42 }],
        })
      )
    );

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await sizeStock(BLACK_42)).toBe(0);
    // Nine refusals must leave no trace on the counter.
    expect(await productStock()).toBe(runnerProduct.stock - 3);
  });

  it("hands the last three pairs to three different buyers, not four", async () => {
    await seedCatalog();

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        holdStock(test.db, {
          reservationId: `r${i}`,
          lines: [{ productId: "runner", quantity: 1, variantSku: BLACK_42 }],
        })
      )
    );

    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(await sizeStock(BLACK_42)).toBe(0);
  });

  it("moves the size and the product mirror by the same amount", async () => {
    await seedCatalog();

    await holdStock(test.db, {
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 2, variantSku: BLACK_42 }],
    });

    // The positional `$` has to land on the right element, or the mirror
    // drifts away from the sizes underneath it.
    expect(await sizeStock(BLACK_42)).toBe(1);
    expect(await productStock()).toBe(runnerProduct.stock - 2);
    expect(await sizeStock("runner-eu42-white")).toBe(6);
  });

  it("returns stock once even when release and sweep race", async () => {
    await seedCatalog();
    await holdStock(test.db, {
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 3, variantSku: BLACK_42 }],
    });

    await test.db
      .collection<ReservationDoc>("reservations")
      .updateOne(
        { reservationId: "r1" },
        { $set: { expiresAt: new Date(Date.now() - 60_000) } }
      );

    // The expired-session webhook and the sweep both arrive at once.
    const [released, swept] = await Promise.all([
      releaseHold(test.db, "r1", "webhook"),
      sweepExpiredHolds(test.db),
    ]);

    // Exactly one of them did the work; the status transition is the lock.
    expect([released, swept > 0].filter(Boolean)).toHaveLength(1);
    expect(await sizeStock(BLACK_42)).toBe(3);
    expect(await productStock()).toBe(runnerProduct.stock);
  });

  it("commits once when two webhook deliveries arrive together", async () => {
    await seedCatalog();
    await holdStock(test.db, {
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 2, variantSku: BLACK_42 }],
    });

    const results = await Promise.all([
      commitHold(test.db, "r1"),
      commitHold(test.db, "r1"),
    ]);

    expect(results.filter((r) => r === "committed")).toHaveLength(1);
    expect(results.filter((r) => r === "already-committed")).toHaveLength(1);
    expect(await sizeStock(BLACK_42)).toBe(1);
  });

  it("refuses to hold a size that no longer exists", async () => {
    await seedCatalog();

    const result = await holdStock(test.db, {
      reservationId: "r1",
      lines: [{ productId: "runner", quantity: 1, variantSku: "runner-eu99-gold" }],
    });

    expect(result.ok).toBe(false);
    expect(await productStock()).toBe(runnerProduct.stock);
  });

  it("keeps a partly-taken cart from stranding stock", async () => {
    await seedCatalog();

    const result = await holdStock(test.db, {
      reservationId: "r1",
      lines: [
        { productId: "runner", quantity: 2, variantSku: "runner-eu42-white" },
        { productId: "runner", quantity: 99, variantSku: BLACK_42 },
      ],
    });

    expect(result.ok).toBe(false);
    // The first line was taken and must have been given back.
    expect(await sizeStock("runner-eu42-white")).toBe(6);
    expect(await productStock()).toBe(runnerProduct.stock);
  });
});
