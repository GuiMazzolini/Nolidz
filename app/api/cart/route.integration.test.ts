import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", async () => {
  const { getMockSession } = await import("@/app/test/session");
  return { getServerSession: async () => getMockSession() };
});

vi.mock("@/app/lib/auth", () => ({ authOptions: {} }));

import { DELETE, GET, PATCH, POST } from "@/app/api/cart/route";
import type { CartDoc, CartItemDoc } from "@/app/lib/db-collections";
import { BUYER, catalog } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import {
  getIntegrationMongo,
  useTestDatabase,
  type TestDatabase,
} from "@/app/test/mongo-integration";
import { setMockSession } from "@/app/test/session";

const mongoUri = await getIntegrationMongo();
let test: TestDatabase;

type CartLine = { id: string; quantity: number; variantSku?: string };

async function storedItems(): Promise<CartItemDoc[]> {
  const cart = await test.db.collection<CartDoc>("carts").findOne({ userId: BUYER });
  return cart?.items ?? [];
}

async function seedCart(items: CartItemDoc[]) {
  await test.db
    .collection<CartDoc>("carts")
    .insertOne({ userId: BUYER, items } as CartDoc);
}

/**
 * The same cart scenarios as route.test.ts, run against a real server. If the
 * in-memory double's matching semantics were wrong, these are what catch it.
 */
describe.skipIf(!mongoUri)("cart API against a real MongoDB", () => {
  beforeAll(async () => {
    test = await useTestDatabase("cart", mongoUri!);
  });

  afterEach(async () => {
    await test.clear();
  });

  afterAll(async () => {
    await test?.teardown();
  });

  beforeAll(async () => {
    setMockSession(BUYER);
  });

  async function seedCatalog() {
    await test.db.collection("products").insertMany(structuredClone(catalog));
  }

  it("creates the cart on first add and stores the SKU", async () => {
    await seedCatalog();

    const { status } = await readResponse(
      await POST(
        jsonRequest("POST", { productId: "runner", variantSku: "runner-eu42-black" })
      )
    );

    expect(status).toBe(201);
    expect(await storedItems()).toEqual([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
    ]);
  });

  it("increments the matching size through the positional operator", async () => {
    await seedCatalog();
    await seedCart([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
    ]);

    await POST(
      jsonRequest("POST", { productId: "runner", variantSku: "runner-eu42-white" })
    );

    // Real `items.$.quantity` must hit the second element, not the first.
    expect(await storedItems()).toEqual([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
      { productId: "runner", quantity: 2, variantSku: "runner-eu42-white" },
    ]);
  });

  it("updates one size and leaves the others untouched", async () => {
    await seedCatalog();
    await seedCart([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
      { productId: "mug", quantity: 1 },
    ]);

    await PATCH(
      jsonRequest("PATCH", {
        productId: "runner",
        variantSku: "runner-eu42-white",
        quantity: 4,
      })
    );

    expect(await storedItems()).toEqual([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
      { productId: "runner", quantity: 4, variantSku: "runner-eu42-white" },
      { productId: "mug", quantity: 1 },
    ]);
  });

  it("pulls only the named size", async () => {
    await seedCatalog();
    await seedCart([
      { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
    ]);

    await DELETE(
      jsonRequest("DELETE", {
        productId: "runner",
        variantSku: "runner-eu42-black",
      })
    );

    expect(await storedItems()).toEqual([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
    ]);
  });

  it("pulls a single-SKU line without removing sized lines of another product", async () => {
    // `variantSku: { $exists: false }` has to exclude the sized documents.
    await seedCatalog();
    await seedCart([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
      { productId: "mug", quantity: 1 },
    ]);

    await DELETE(jsonRequest("DELETE", { productId: "mug" }));

    expect(await storedItems()).toEqual([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
    ]);
  });

  it("enforces the per-size stock ceiling", async () => {
    await seedCatalog();
    await seedCart([
      { productId: "runner", quantity: 3, variantSku: "runner-eu42-black" },
    ]);

    const { status, body } = await readResponse<{ error: string }>(
      await POST(
        jsonRequest("POST", { productId: "runner", variantSku: "runner-eu42-black" })
      )
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Only 3 in stock");
    expect((await storedItems())[0].quantity).toBe(3);
  });

  it("serializes each line against its own variant stock", async () => {
    await seedCatalog();
    await seedCart([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
      { productId: "mug", quantity: 2 },
    ]);

    const { body } = await readResponse<CartLine[]>(await GET(jsonRequest("GET")));

    expect(body).toEqual([
      expect.objectContaining({ variantSku: "runner-eu42-white", stock: 6 }),
      expect.objectContaining({ id: "mug", stock: 2 }),
    ]);
  });

  it("keeps one cart per user, as the unique index requires", async () => {
    await seedCatalog();

    await POST(jsonRequest("POST", { productId: "mug" }));
    await POST(jsonRequest("POST", { productId: "mug" }));

    const carts = await test.db.collection("carts").countDocuments({});
    expect(carts).toBe(1);
    expect((await storedItems())[0].quantity).toBe(2);
  });
});
