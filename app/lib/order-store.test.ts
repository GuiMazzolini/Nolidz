import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieveMock, confirmationEmailMock, shippingEmailMock } = vi.hoisted(
  () => ({
    retrieveMock: vi.fn(),
    confirmationEmailMock: vi.fn(),
    shippingEmailMock: vi.fn(),
  })
);

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

vi.mock("@/app/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve: retrieveMock } } }),
  getAppUrl: () => "http://localhost:3000",
}));

vi.mock("@/app/lib/email", () => ({
  sendOrderConfirmationEmail: confirmationEmailMock,
  sendShippingNotificationEmail: shippingEmailMock,
}));

import {
  fulfillCheckoutSession,
  getAccessibleOrder,
  getAllOrders,
  getOrdersForUser,
  markOrderShipped,
} from "@/app/lib/orders";
import { BUYER, catalog } from "@/app/test/fixtures";
import { testDb } from "@/app/test/mongo-double";
import type { ProductDoc } from "@/app/lib/db-collections";

function product(id: string): ProductDoc {
  return testDb.all("products").find((doc) => doc.id === id) as ProductDoc;
}

function variantStock(id: string, sku: string): number {
  return product(id).variants!.find((v) => v.sku === sku)!.stock;
}

/** A paid session whose metadata carries the cart, as checkout wrote it. */
function paidSession(metadata: Record<string, string>, overrides = {}) {
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  confirmationEmailMock.mockResolvedValue(undefined);
  shippingEmailMock.mockResolvedValue(undefined);
  testDb.reset();
  testDb.seed("products", catalog);
});

describe("inventory after a paid checkout", () => {
  it("decrements the bought size and the product mirror together", async () => {
    retrieveMock.mockResolvedValue(
      paidSession({ cartItems: "runner|runner-eu42-black:2" })
    );

    await fulfillCheckoutSession("cs_test_1");

    expect(variantStock("runner", "runner-eu42-black")).toBe(1);
    // Untouched sizes keep their counts; the total drops by the same 2.
    expect(variantStock("runner", "runner-eu42-white")).toBe(6);
    expect(product("runner").stock).toBe(7);
  });

  it("leaves other sizes alone when several are bought at once", async () => {
    retrieveMock.mockResolvedValue(
      paidSession({
        cartItems: "runner|runner-eu42-black:1,runner|runner-eu42-white:2",
      })
    );

    await fulfillCheckoutSession("cs_test_1");

    expect(variantStock("runner", "runner-eu42-black")).toBe(2);
    expect(variantStock("runner", "runner-eu42-white")).toBe(4);
    expect(product("runner").stock).toBe(6);
  });

  it("skips a size that raced to zero rather than going negative", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    retrieveMock.mockResolvedValue(
      paidSession({ cartItems: "runner|runner-eu42-black:99" })
    );

    await fulfillCheckoutSession("cs_test_1");

    expect(variantStock("runner", "runner-eu42-black")).toBe(3);
    expect(product("runner").stock).toBe(9);
    // The order still stands; the mismatch is logged for a human.
    expect(testDb.all("orders")).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("runner/runner-eu42-black")
    );
    warn.mockRestore();
  });

  it("ignores a SKU that is no longer in the catalog", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    retrieveMock.mockResolvedValue(
      paidSession({ cartItems: "runner|deleted-sku:1" })
    );

    await fulfillCheckoutSession("cs_test_1");

    expect(product("runner").stock).toBe(9);
    warn.mockRestore();
  });

  it("decrements a single-SKU product from its own count", async () => {
    retrieveMock.mockResolvedValue(paidSession({ cartItems: "mug:2" }));

    await fulfillCheckoutSession("cs_test_1");

    expect(product("mug").stock).toBe(0);
  });

  it("reassembles a cart split across metadata chunks", async () => {
    retrieveMock.mockResolvedValue(
      paidSession({
        cartItems: "runner|runner-eu42-black:1",
        cartItems2: "mug:1",
      })
    );

    await fulfillCheckoutSession("cs_test_1");

    expect(variantStock("runner", "runner-eu42-black")).toBe(2);
    expect(product("mug").stock).toBe(1);
  });

  it("decrements once even if fulfillment runs twice", async () => {
    // The webhook and the success page both fulfill the same session.
    retrieveMock.mockResolvedValue(
      paidSession({ cartItems: "runner|runner-eu42-black:1" })
    );

    await fulfillCheckoutSession("cs_test_1");
    await fulfillCheckoutSession("cs_test_1");

    expect(variantStock("runner", "runner-eu42-black")).toBe(2);
    expect(testDb.all("orders")).toHaveLength(1);
    expect(confirmationEmailMock).toHaveBeenCalledOnce();
  });

  it("does nothing for a session that is not paid", async () => {
    retrieveMock.mockResolvedValue(
      paidSession({ cartItems: "mug:1" }, { payment_status: "unpaid" })
    );

    const result = await fulfillCheckoutSession("cs_test_1");

    expect(result).toEqual({ paid: false, fulfilled: false });
    expect(product("mug").stock).toBe(2);
    expect(testDb.all("orders")).toHaveLength(0);
  });

  it("records the order with the variant name from the Stripe line item", async () => {
    retrieveMock.mockResolvedValue(
      paidSession({ cartItems: "runner|runner-eu42-black:1" })
    );

    await fulfillCheckoutSession("cs_test_1");

    const [order] = testDb.all("orders");
    expect(order.items).toEqual([
      { name: "Runner — EU 42 · Black", quantity: 1, unitAmount: 89.99 },
    ]);
    expect(order.status).toBe("paid");
  });
});

describe("cart clearing after checkout", () => {
  it("empties the signed-in buyer's saved cart", async () => {
    testDb.seed("carts", [
      { userId: BUYER, items: [{ productId: "mug", quantity: 1 }] },
    ]);
    retrieveMock.mockResolvedValue(paidSession({ cartItems: "mug:1" }));

    await fulfillCheckoutSession("cs_test_1");

    expect(testDb.all("carts")[0].items).toEqual([]);
  });

  it("never empties an account's cart from a guest checkout", async () => {
    // A guest can type any address into Stripe, including a registered one.
    testDb.seed("carts", [
      { userId: BUYER, items: [{ productId: "mug", quantity: 1 }] },
    ]);
    retrieveMock.mockResolvedValue(
      paidSession(
        { cartItems: "mug:1" },
        { client_reference_id: null, metadata: { isGuest: "true", cartItems: "mug:1" } }
      )
    );

    await fulfillCheckoutSession("cs_test_1");

    expect(testDb.all("carts")[0].items).toHaveLength(1);
  });
});

describe("order queries", () => {
  beforeEach(() => {
    testDb.seed("orders", [
      {
        stripeSessionId: "cs_old",
        userId: BUYER,
        customerEmail: BUYER,
        items: [],
        subtotal: 10,
        shippingCost: 0,
        total: 10,
        currency: "usd",
        status: "paid",
        createdAt: new Date("2026-01-01"),
      },
      {
        stripeSessionId: "cs_new",
        userId: BUYER,
        customerEmail: BUYER,
        items: [],
        subtotal: 20,
        shippingCost: 0,
        total: 20,
        currency: "usd",
        status: "paid",
        createdAt: new Date("2026-06-01"),
      },
      {
        stripeSessionId: "cs_other",
        userId: "someone@example.com",
        customerEmail: "someone@example.com",
        items: [],
        subtotal: 5,
        shippingCost: 0,
        total: 5,
        currency: "usd",
        status: "paid",
        createdAt: new Date("2026-03-01"),
      },
    ]);
  });

  it("returns a user's own orders, newest first", async () => {
    const orders = await getOrdersForUser(BUYER);
    expect(orders.map((o) => o.stripeSessionId)).toEqual(["cs_new", "cs_old"]);
  });

  it("matches the account regardless of email casing", async () => {
    const orders = await getOrdersForUser("BUYER@Example.COM");
    expect(orders).toHaveLength(2);
  });

  it("never leaks another account's orders", async () => {
    const orders = await getOrdersForUser(BUYER);
    expect(orders.some((o) => o.stripeSessionId === "cs_other")).toBe(false);
  });

  it("lists every order for admin, newest first", async () => {
    const orders = await getAllOrders();
    expect(orders.map((o) => o.stripeSessionId)).toEqual([
      "cs_new",
      "cs_other",
      "cs_old",
    ]);
  });

  it("lets the owner and the matching guest email read an order", async () => {
    await expect(
      getAccessibleOrder({ sessionId: "cs_new", sessionEmail: "BUYER@example.com" })
    ).resolves.toMatchObject({ stripeSessionId: "cs_new" });

    await expect(
      getAccessibleOrder({ sessionId: "cs_new", guestEmail: BUYER })
    ).resolves.toMatchObject({ stripeSessionId: "cs_new" });
  });

  it("refuses an unrelated reader and an unknown id", async () => {
    await expect(
      getAccessibleOrder({ sessionId: "cs_new", sessionEmail: "mallory@example.com" })
    ).resolves.toBeNull();

    await expect(
      getAccessibleOrder({ sessionId: "cs_missing", sessionEmail: BUYER })
    ).resolves.toBeNull();
  });
});

describe("markOrderShipped", () => {
  beforeEach(() => {
    testDb.seed("orders", [
      {
        stripeSessionId: "cs_new",
        userId: BUYER,
        customerEmail: BUYER,
        items: [],
        subtotal: 10,
        shippingCost: 0,
        total: 10,
        currency: "usd",
        status: "paid",
        createdAt: new Date("2026-06-01"),
      },
    ]);
  });

  it("records tracking, flips the status, and notifies the customer", async () => {
    const order = await markOrderShipped({
      sessionId: "cs_new",
      trackingNumber: "  TRACK123  ",
      carrier: "DHL",
    });

    expect(order).toMatchObject({
      status: "shipped",
      trackingNumber: "TRACK123",
      carrier: "DHL",
    });
    expect(order!.shippedAt).toBeInstanceOf(Date);
    expect(shippingEmailMock).toHaveBeenCalledOnce();
  });

  it("can ship without emailing", async () => {
    await markOrderShipped({
      sessionId: "cs_new",
      trackingNumber: "TRACK123",
      sendEmail: false,
    });
    expect(shippingEmailMock).not.toHaveBeenCalled();
  });

  it("rejects a blank tracking number", async () => {
    await expect(
      markOrderShipped({ sessionId: "cs_new", trackingNumber: "   " })
    ).rejects.toThrow("Tracking number is required");
  });

  it("returns null for an unknown order", async () => {
    await expect(
      markOrderShipped({ sessionId: "cs_missing", trackingNumber: "T1" })
    ).resolves.toBeNull();
    expect(shippingEmailMock).not.toHaveBeenCalled();
  });
});
