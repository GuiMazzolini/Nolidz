import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSessionMock, forcedStockError } = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  /** undefined = use the real check; null = pretend it passed. See below. */
  forcedStockError: { value: undefined as string | null | undefined },
}));

/**
 * The read-only stock check and the hold both read the same database in a
 * single-threaded test, so the window between them cannot occur naturally.
 * Forcing the check to pass is how we reproduce another customer's checkout
 * landing in that window — the exact race the hold exists to close.
 */
vi.mock("@/app/lib/checkout-cart", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app/lib/checkout-cart")>();
  return {
    ...actual,
    getCartStockError: (...args: Parameters<typeof actual.getCartStockError>) =>
      forcedStockError.value !== undefined
        ? forcedStockError.value
        : actual.getCartStockError(...args),
  };
});

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
import { RATE_LIMITS } from "@/app/lib/rate-limit";
import { MAX_OPEN_HOLDS_PER_BUYER } from "@/app/lib/reservations";
import { commitHold } from "@/app/lib/stock-hold";
import { BUYER, catalog, runnerProduct } from "@/app/test/fixtures";
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
  forcedStockError.value = undefined;
});

function variantStock(sku: string): number {
  const product = testDb.all("products").find((p) => p.id === "runner");
  const variants = product!.variants as { sku: string; stock: number }[];
  return variants.find((v) => v.sku === sku)!.stock;
}

/** Enough of one size that a run of checkouts cannot exhaust it. */
function seedDeepStock() {
  testDb.seed("products", [
    {
      ...runnerProduct,
      stock: 99,
      variants: [
        { sku: "runner-eu42-black", size: "42", color: "Black", stock: 99 },
      ],
    },
  ]);
}

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
    expect(args.payment_method_types).toEqual(["card", "paypal"]);
  });

  it("expires the session so an abandoned checkout stops being payable", async () => {
    const before = Math.floor(Date.now() / 1000);
    await POST(
      jsonRequest("POST", { items: [{ productId: "mug", quantity: 1 }] })
    );

    // Stripe rejects anything under 30 minutes out, so this is the floor.
    expect(lastSessionArgs().expires_at).toBeGreaterThanOrEqual(before + 30 * 60);
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

    // One pair is €89.99, still under the €100 threshold. Two pairs clear it.
    await POST(
      jsonRequest("POST", {
        items: [{ productId: "runner", quantity: 2, variantSku: "runner-eu42-black" }],
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

  it("holds the stock against the signed-in buyer", async () => {
    await POST(jsonRequest("POST"));

    const hold = testDb.all("reservations")[0];
    expect(hold.userId).toBe(BUYER);
    expect(hold.status).toBe("held");
  });

  it("is rate limited", async () => {
    // Every attempt takes a hold and none of them pay, so the size needs
    // enough stock to survive the run — the request budget is what should
    // stop this, not the inventory.
    seedDeepStock();

    for (let i = 0; i < RATE_LIMITS.checkout.limit; i++) {
      expect((await POST(jsonRequest("POST"))).status).toBe(200);
      // Open holds are capped separately, and this test is about the request
      // budget. Clearing them isolates the one limit under test.
      testDb.seed("reservations", []);
    }

    expect((await POST(jsonRequest("POST"))).status).toBe(429);
  });
});

describe("capping how much stock one buyer can hold at once", () => {
  beforeEach(() => {
    setMockSession(BUYER);
    testDb.seed("carts", [
      {
        userId: BUYER,
        items: [{ productId: "runner", quantity: 1, variantSku: "runner-eu42-black" }],
      },
    ]);
    seedDeepStock();
  });

  it("refuses a buyer who already has the maximum open", async () => {
    for (let i = 0; i < MAX_OPEN_HOLDS_PER_BUYER; i++) {
      expect((await POST(jsonRequest("POST"))).status).toBe(200);
    }

    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST"))
    );

    expect(status).toBe(429);
    expect(body.error).toContain("checkouts open");
    // The refused attempt must not have taken any stock of its own.
    expect(variantStock("runner-eu42-black")).toBe(99 - MAX_OPEN_HOLDS_PER_BUYER);
  });

  it("lets them start again once a hold is settled", async () => {
    for (let i = 0; i < MAX_OPEN_HOLDS_PER_BUYER; i++) {
      await POST(jsonRequest("POST"));
    }

    const [first] = testDb.all("reservations");
    await commitHold(testDb as never, first.reservationId as string);

    expect((await POST(jsonRequest("POST"))).status).toBe(200);
  });

  it("does not let one buyer's holds lock out another", async () => {
    for (let i = 0; i < MAX_OPEN_HOLDS_PER_BUYER; i++) {
      await POST(jsonRequest("POST"));
    }

    // A guest checking out from a different address is a different holder.
    setMockSession(null);
    const { status } = await readResponse(
      await POST(
        jsonRequest("POST", {
          items: [
            { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
          ],
        })
      )
    );

    expect(status).toBe(200);
  });

  it("counts lapsed checkouts as closed, not open", async () => {
    for (let i = 0; i < MAX_OPEN_HOLDS_PER_BUYER; i++) {
      await POST(jsonRequest("POST"));
    }

    // Their window passed without payment, so they no longer count against
    // the buyer — otherwise abandoning a checkout would lock them out.
    testDb.seed(
      "reservations",
      testDb.all("reservations").map((doc) => ({
        ...doc,
        expiresAt: new Date(Date.now() - 60_000),
      }))
    );

    expect((await POST(jsonRequest("POST"))).status).toBe(200);
  });
});

describe("holding stock for the checkout", () => {
  it("takes the size out of sale before the customer reaches Stripe", async () => {
    await POST(
      jsonRequest("POST", {
        items: [
          { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
        ],
      })
    );

    // Three were in stock; the hold owns two of them from now on.
    expect(variantStock("runner-eu42-black")).toBe(1);
  });

  it("gives fulfillment the hold to close, via session metadata", async () => {
    await POST(
      jsonRequest("POST", { items: [{ productId: "mug", quantity: 1 }] })
    );

    const reservationId = (lastSessionArgs().metadata as Record<string, string>)
      .reservationId;
    expect(reservationId).toBeTruthy();
    expect(testDb.all("reservations")[0].reservationId).toBe(reservationId);
  });

  it("records the session on the hold for support lookups", async () => {
    await POST(
      jsonRequest("POST", { items: [{ productId: "mug", quantity: 1 }] })
    );

    expect(testDb.all("reservations")[0].stripeSessionId).toBe("cs_test_1");
  });

  it("refuses a size that sold out between the check and the hold", async () => {
    // Someone else's checkout took the last pair in that window.
    await POST(
      jsonRequest("POST", {
        items: [
          { productId: "runner", quantity: 3, variantSku: "runner-eu42-black" },
        ],
      })
    );
    forcedStockError.value = null;

    const { status, body } = await readResponse<{ error: string }>(
      await POST(
        jsonRequest("POST", {
          items: [
            { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
          ],
        })
      )
    );

    expect(status).toBe(409);
    expect(body.error).toBe(
      "Runner (EU 42 · Black) sold out while you were checking out. Please update your basket."
    );
    // The refused checkout must not have taken anything.
    expect(variantStock("runner-eu42-black")).toBe(0);
  });

  it("puts the stock back when Stripe cannot create the session", async () => {
    createSessionMock.mockRejectedValueOnce(new Error("stripe is down"));

    const { status } = await readResponse(
      await POST(
        jsonRequest("POST", {
          items: [
            { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
          ],
        })
      )
    );

    expect(status).toBe(502);
    // A payment provider outage must not cost the shop its inventory.
    expect(variantStock("runner-eu42-black")).toBe(3);
    expect(testDb.all("reservations")[0].status).toBe("released");
  });

  it("puts the stock back when the session comes back unusable", async () => {
    createSessionMock.mockResolvedValueOnce({ id: "cs_test_1", url: null });

    const { status } = await readResponse(
      await POST(
        jsonRequest("POST", {
          items: [
            { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
          ],
        })
      )
    );

    expect(status).toBe(500);
    expect(variantStock("runner-eu42-black")).toBe(3);
  });

  it("reclaims an abandoned checkout's stock before taking its own", async () => {
    await POST(
      jsonRequest("POST", {
        items: [
          { productId: "runner", quantity: 3, variantSku: "runner-eu42-black" },
        ],
      })
    );

    // That checkout was never paid and its window has passed.
    const stale = testDb.all("reservations")[0];
    testDb.seed("reservations", [
      { ...stale, expiresAt: new Date(Date.now() - 60_000) },
    ]);

    const { status } = await readResponse(
      await POST(
        jsonRequest("POST", {
          items: [
            { productId: "runner", quantity: 3, variantSku: "runner-eu42-black" },
          ],
        })
      )
    );

    // Without the sweep this size would look sold out to everyone.
    expect(status).toBe(200);
    expect(variantStock("runner-eu42-black")).toBe(0);
  });
});
