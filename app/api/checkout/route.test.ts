import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSessionMock } = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
}));

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

vi.mock("next-auth", async () => {
  const { getMockSession } = await import("@/app/test/session");
  return { getServerSession: async () => getMockSession() };
});

vi.mock("@/app/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/app/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: createSessionMock } } }),
  getAppUrl: () => "http://localhost:3000",
}));

import { POST } from "@/app/api/checkout/route";
import { decodeCartMetadata } from "@/app/lib/cart-metadata";
import { BUYER, catalog } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import { setMockSession } from "@/app/test/session";
import type Stripe from "stripe";

type SessionArgs = Stripe.Checkout.SessionCreateParams;

function lastSessionArgs(): SessionArgs {
  return createSessionMock.mock.calls.at(-1)![0] as SessionArgs;
}

beforeEach(() => {
  vi.clearAllMocks();
  createSessionMock.mockResolvedValue({
    id: "cs_test_1",
    url: "https://checkout.stripe.com/c/pay/cs_test_1",
  });
  testDb.reset();
  testDb.seed("products", catalog);
  setMockSession(null);
});

describe("guest checkout", () => {
  it("prices the guest cart from the catalog and returns the Stripe URL", async () => {
    const { status, body } = await readResponse<{ url: string }>(
      await POST(
        jsonRequest("POST", {
          items: [{ productId: "mug", quantity: 2 }],
        })
      )
    );

    expect(status).toBe(200);
    expect(body.url).toContain("checkout.stripe.com");

    const args = lastSessionArgs();
    expect(args.line_items).toHaveLength(1);
    expect(args.line_items![0].price_data!.unit_amount).toBe(1499);
    expect(args.line_items![0].quantity).toBe(2);
    expect(args.metadata).toMatchObject({ isGuest: "true" });
    expect(args.client_reference_id).toBeUndefined();
  });

  it("names the line item with its EU size and colour", async () => {
    await POST(
      jsonRequest("POST", {
        items: [
          { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
        ],
      })
    );

    expect(lastSessionArgs().line_items![0].price_data!.product_data!.name).toBe(
      "Runner — EU 42 · White"
    );
  });

  it("carries the SKU into metadata so fulfillment decrements the right size", async () => {
    await POST(
      jsonRequest("POST", {
        items: [
          { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
          { productId: "mug", quantity: 1 },
        ],
      })
    );

    const metadata = lastSessionArgs().metadata as Record<string, string>;
    expect(decodeCartMetadata(metadata)).toEqual([
      { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
      { productId: "mug", quantity: 1 },
    ]);
  });

  it("blocks a quantity above that size's stock", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await POST(
        jsonRequest("POST", {
          items: [
            { productId: "runner", quantity: 4, variantSku: "runner-eu42-black" },
          ],
        })
      )
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Only 3 of Runner (EU 42 · Black) left in stock");
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("blocks a sold-out size even when the product has stock elsewhere", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await POST(
        jsonRequest("POST", {
          items: [
            { productId: "runner", quantity: 1, variantSku: "runner-eu43-black" },
          ],
        })
      )
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Runner (EU 43 · Black) is out of stock");
  });

  it("blocks a variant product with no size chosen", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST", { items: [{ productId: "runner", quantity: 1 }] }))
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Please choose a size and colour for Runner");
  });

  it("rejects an empty or malformed cart", async () => {
    expect((await POST(jsonRequest("POST", { items: [] }))).status).toBe(400);
    expect((await POST(jsonRequest("POST", {}))).status).toBe(400);
  });

  it("drops unknown products and refuses a cart left with nothing", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST", { items: [{ productId: "ghost", quantity: 1 }] }))
    );

    expect(status).toBe(400);
    expect(body.error).toBe("Cart is empty");
  });

  it("charges shipping below the free threshold and not above it", async () => {
    await POST(jsonRequest("POST", { items: [{ productId: "mug", quantity: 1 }] }));
    const cheap = lastSessionArgs();
    expect(
      cheap.shipping_options![0].shipping_rate_data!.fixed_amount!.amount
    ).toBe(500);

    await POST(
      jsonRequest("POST", {
        items: [{ productId: "runner", quantity: 1, variantSku: "runner-eu42-black" }],
      })
    );
    const pricey = lastSessionArgs();
    expect(
      pricey.shipping_options![0].shipping_rate_data!.fixed_amount!.amount
    ).toBe(0);
  });

  it("surfaces a Stripe outage as a 502 rather than a crash", async () => {
    createSessionMock.mockRejectedValueOnce(new Error("stripe down"));

    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST", { items: [{ productId: "mug", quantity: 1 }] }))
    );

    expect(status).toBe(502);
    expect(body.error).toContain("Payment provider");
  });
});

describe("authenticated checkout", () => {
  beforeEach(() => {
    setMockSession(BUYER);
    testDb.seed("carts", [
      {
        userId: BUYER,
        items: [{ productId: "runner", quantity: 1, variantSku: "runner-eu42-black" }],
      },
    ]);
  });

  it("reads the saved cart and ignores any body the client sends", async () => {
    await POST(
      jsonRequest("POST", { items: [{ productId: "mug", quantity: 99 }] })
    );

    const args = lastSessionArgs();
    expect(args.line_items).toHaveLength(1);
    expect(args.line_items![0].price_data!.product_data!.name).toBe(
      "Runner — EU 42 · Black"
    );
    expect(args.client_reference_id).toBe(BUYER);
    expect(args.metadata).toMatchObject({ userId: BUYER });
  });

  it("prefills from a saved Stripe customer when one exists", async () => {
    testDb.seed("users", [
      { email: BUYER, name: "Buyer", createdAt: new Date(), stripeCustomerId: "cus_123" },
    ]);

    await POST(jsonRequest("POST"));

    const args = lastSessionArgs();
    expect(args.customer).toBe("cus_123");
    // Stripe rejects customer and customer_email together.
    expect(args.customer_email).toBeUndefined();
  });

  it("falls back to customer_email without a saved customer", async () => {
    await POST(jsonRequest("POST"));
    expect(lastSessionArgs().customer_email).toBe(BUYER);
  });

  it("refuses an empty saved cart", async () => {
    testDb.seed("carts", [{ userId: BUYER, items: [] }]);
    const { status } = await readResponse(await POST(jsonRequest("POST")));
    expect(status).toBe(400);
  });

  it("refuses a saved cart over the line-item cap", async () => {
    // A saved cart is not re-validated on read, so the cap is enforced here.
    testDb.seed("carts", [
      {
        userId: BUYER,
        items: Array.from({ length: 26 }, (_, i) => ({
          productId: `p${i}`,
          quantity: 1,
        })),
      },
    ]);

    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST"))
    );
    expect(status).toBe(400);
    expect(body.error).toContain("at most");
  });

  it("is rate limited", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await POST(jsonRequest("POST"))).status).toBe(200);
    }
    expect((await POST(jsonRequest("POST"))).status).toBe(429);
  });
});
