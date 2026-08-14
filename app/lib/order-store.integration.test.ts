import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { retrieveMock, confirmationEmailMock } = vi.hoisted(() => ({
  retrieveMock: vi.fn(),
  confirmationEmailMock: vi.fn(),
}));

vi.mock("@/app/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve: retrieveMock } } }),
  getAppUrl: () => "http://localhost:3000",
}));

vi.mock("@/app/lib/email", () => ({
  sendOrderConfirmationEmail: confirmationEmailMock,
  sendShippingNotificationEmail: vi.fn(),
}));

import { fulfillCheckoutSession } from "@/app/lib/orders";
import type { ProductDoc } from "@/app/lib/db-collections";
import { BUYER, catalog } from "@/app/test/fixtures";
import {
  getIntegrationMongo,
  useTestDatabase,
  type TestDatabase,
} from "@/app/test/mongo-integration";

const mongoUri = await getIntegrationMongo();
let test: TestDatabase;

async function product(id: string): Promise<ProductDoc> {
  return (await test.db
    .collection<ProductDoc>("products")
    .findOne({ id })) as ProductDoc;
}

async function variantStock(id: string, sku: string): Promise<number> {
  const doc = await product(id);
  return doc.variants!.find((v) => v.sku === sku)!.stock;
}

function paidSession(metadata: Record<string, string>) {
  return {
    id: "cs_test_1",
    payment_status: "paid",
    client_reference_id: BUYER,
    metadata: { userId: BUYER, ...metadata },
    customer_details: { email: BUYER },
    customer_email: null,
    amount_subtotal: 8999,
    amount_total: 8999,
    currency: "usd",
    total_details: { amount_shipping: 0 },
    collected_information: null,
    line_items: {
      data: [
        {
          description: "Runner — EU 42 · Black",
          quantity: 1,
          price: { unit_amount: 8999 },
        },
      ],
    },
  };
}

/**
 * Inventory is the part of this feature a modelled database is least able to
 * vouch for: it turns on `$elemMatch` picking the right array element and the
 * positional `$inc` landing on it. Run it for real.
 */
describe.skipIf(!mongoUri)("fulfillment against a real MongoDB", () => {
  beforeAll(async () => {
    test = await useTestDatabase("orders", mongoUri!);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await test.clear();
  });

  afterAll(async () => {
    await test?.teardown();
  });

  async function seedCatalog() {
    await test.db.collection("products").insertMany(structuredClone(catalog));
  }

  it("decrements the bought size and the product mirror in one update", async () => {
    await seedCatalog();
    retrieveMock.mockResolvedValue(
      paidSession({ cartItems: "runner|runner-eu42-black:2" })
    );

    await fulfillCheckoutSession("cs_test_1");

    expect(await variantStock("runner", "runner-eu42-black")).toBe(1);
    expect(await variantStock("runner", "runner-eu42-white")).toBe(6);
    expect((await product("runner")).stock).toBe(7);
  });

  it("decrements the second colourway when that is the one bought", async () => {
    // The positional operator must not fall back to the first array element.
    await seedCatalog();
    retrieveMock.mockResolvedValue(
      paidSession({ cartItems: "runner|runner-eu42-white:3" })
    );

    await fulfillCheckoutSession("cs_test_1");

    expect(await variantStock("runner", "runner-eu42-black")).toBe(3);
    expect(await variantStock("runner", "runner-eu42-white")).toBe(3);
  });

  it("refuses to oversell a size that raced to zero", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await seedCatalog();
    retrieveMock.mockResolvedValue(
      paidSession({ cartItems: "runner|runner-eu42-black:99" })
    );

    await fulfillCheckoutSession("cs_test_1");

    expect(await variantStock("runner", "runner-eu42-black")).toBe(3);
    expect((await product("runner")).stock).toBe(9);
    warn.mockRestore();
  });

  it("stays idempotent through the real unique index on stripeSessionId", async () => {
    await seedCatalog();
    retrieveMock.mockResolvedValue(
      paidSession({ cartItems: "runner|runner-eu42-black:1" })
    );

    // The webhook and the success page both fulfill the same session.
    await Promise.all([
      fulfillCheckoutSession("cs_test_1"),
      fulfillCheckoutSession("cs_test_1"),
    ]);

    expect(await test.db.collection("orders").countDocuments({})).toBe(1);
    expect(await variantStock("runner", "runner-eu42-black")).toBe(2);
    expect(confirmationEmailMock).toHaveBeenCalledOnce();
  });

  it("empties the buyer's saved cart", async () => {
    await seedCatalog();
    await test.db
      .collection("carts")
      .insertOne({ userId: BUYER, items: [{ productId: "mug", quantity: 1 }] });
    retrieveMock.mockResolvedValue(paidSession({ cartItems: "mug:1" }));

    await fulfillCheckoutSession("cs_test_1");

    const cart = await test.db.collection("carts").findOne({ userId: BUYER });
    expect(cart?.items).toEqual([]);
  });
});
