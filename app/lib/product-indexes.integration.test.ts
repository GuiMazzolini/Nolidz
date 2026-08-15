import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { connectToDB, unsetEmptyProductVariants } from "@/app/api/db";
import type { ProductDoc } from "@/app/lib/db-collections";
import { isDuplicateKeyError } from "@/app/lib/mongo-errors";
import {
  getIntegrationMongo,
  useTestDatabase,
  type TestDatabase,
} from "@/app/test/mongo-integration";

/**
 * The unique index on `variants.sku`.
 *
 * A SKU is the identity of a cart line, an order line, and a stock hold, so two
 * variants sharing one ships the wrong shoe. Guarding that takes both halves:
 * resolveVariants de-duplicates within a single save, and only the index can
 * stop two products — or two concurrent saves — from colliding.
 *
 * These run against a real MongoDB because the in-memory double's createIndex
 * is a no-op: it cannot tell us whether the index we declared is the index the
 * server builds, and a partial multikey unique index is exactly the kind that
 * behaves differently than it reads.
 */

const mongoUri = await getIntegrationMongo();
let test: TestDatabase;

function product(overrides: Partial<ProductDoc>): ProductDoc {
  return {
    id: "runner",
    name: "Runner",
    description: "A shoe",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/runner.png",
    price: 100,
    stock: 0,
    ...overrides,
  };
}

function variant(sku: string, size = "42", color = "Black") {
  return { sku, size, color, stock: 3 };
}

async function insert(doc: ProductDoc) {
  const { db } = await connectToDB();
  await db.collection<ProductDoc>("products").insertOne(doc);
}

/** The error an insert raised, or null if it succeeded. */
async function insertError(doc: ProductDoc): Promise<unknown> {
  try {
    await insert(doc);
    return null;
  } catch (err) {
    return err;
  }
}

describe.skipIf(!mongoUri)("product indexes against a real MongoDB", () => {
  beforeAll(async () => {
    test = await useTestDatabase("product_indexes", mongoUri!);
    // Builds the indexes under test; connectToDB caches after the first call.
    await connectToDB();
  });

  afterEach(async () => {
    await test.clear();
  });

  afterAll(async () => {
    await test?.teardown();
  });

  it("declares the SKU index as unique and partial", async () => {
    const indexes = await test.db.collection("products").indexes();
    const skuIndex = indexes.find((index) => index.key["variants.sku"] === 1);

    expect(skuIndex).toBeDefined();
    expect(skuIndex!.unique).toBe(true);
    expect(skuIndex!.partialFilterExpression).toEqual({
      "variants.0": { $exists: true },
    });
  });

  it("rejects the same SKU on a second product", async () => {
    await insert(product({ id: "runner", variants: [variant("shared-sku")] }));

    const err = await insertError(
      product({ id: "trainer", variants: [variant("shared-sku")] })
    );

    expect(isDuplicateKeyError(err)).toBe(true);
  });

  /**
   * The limit of what the index buys us, pinned so nobody drops the in-code
   * check believing the database has it covered. A unique multikey index
   * de-duplicates one document's keys before comparing them, so a SKU repeated
   * inside a single product's array is accepted here — resolveVariants is what
   * stops it, and schemas.test.ts covers that.
   */
  it("does not catch a SKU repeated inside one product's size run", async () => {
    const err = await insertError(
      product({
        id: "runner",
        variants: [variant("dup-sku", "42"), variant("dup-sku", "43")],
      })
    );

    expect(err).toBeNull();
  });

  /**
   * The reason the index is partial. A plain unique index would index every
   * variant-less product under the same missing key, so the second one ever
   * created would be rejected — which is most of the catalog.
   */
  it("lets any number of single-SKU products coexist", async () => {
    await insert(product({ id: "mug", stock: 5 }));
    await insert(product({ id: "hat", stock: 5 }));

    const count = await test.db.collection("products").countDocuments();
    expect(count).toBe(2);
  });

  /**
   * The deploy-time worry: a unique index on `variants.sku` treats an empty
   * array the same as a missing field (both index as null), so two products
   * with `variants: []` would stop a *plain* unique index from building.
   * The partial filter is what makes that a non-event — `variants.0` does
   * not exist on an empty array, so those documents are not in the index.
   * ensureIndexes also rewrites them to a missing field so the stored shape
   * matches what the write path now produces.
   */
  it("still builds when products already persist variants as an empty array", async () => {
    const col = test.db.collection("products");
    await insert(product({ id: "mug", stock: 5, variants: [] }));
    await insert(product({ id: "hat", stock: 5, variants: [] }));

    await col.dropIndex("variants.sku_1");
    await expect(
      col.createIndex(
        { "variants.sku": 1 },
        { unique: true, partialFilterExpression: { "variants.0": { $exists: true } } }
      )
    ).resolves.toBe("variants.sku_1");
  });

  it("rewrites empty variant arrays to a missing field", async () => {
    const col = test.db.collection("products");
    await insert(product({ id: "mug", stock: 5, variants: [] }));
    await insert(product({ id: "hat", stock: 5, variants: [] }));

    await unsetEmptyProductVariants(test.db);

    expect(await col.countDocuments({ variants: { $size: 0 } })).toBe(0);
    expect(await col.countDocuments({ variants: { $exists: false } })).toBe(2);
  });

  it("still allows distinct SKUs across products", async () => {
    await insert(product({ id: "runner", variants: [variant("runner-eu42-black")] }));
    await insert(product({ id: "trainer", variants: [variant("trainer-eu42-black")] }));

    const count = await test.db.collection("products").countDocuments();
    expect(count).toBe(2);
  });
});
