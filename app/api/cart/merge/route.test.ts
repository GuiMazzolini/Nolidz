import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

vi.mock("next-auth", async () => {
  const { getMockSession } = await import("@/app/test/session");
  return { getServerSession: async () => getMockSession() };
});

vi.mock("@/app/lib/auth", () => ({ authOptions: {} }));

import { POST } from "@/app/api/cart/merge/route";
import { MAX_CART_QUANTITY } from "@/app/lib/cart-limits";
import { BUYER, catalog } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import { setMockSession } from "@/app/test/session";
import type { CartItemDoc } from "@/app/lib/db-collections";

type CartLine = { id: string; quantity: number; variantSku?: string };

function storedItems(): CartItemDoc[] {
  return (testDb.all("carts")[0]?.items as CartItemDoc[]) ?? [];
}

beforeEach(() => {
  testDb.reset();
  testDb.seed("products", catalog);
  setMockSession(BUYER);
});

describe("POST /api/cart/merge", () => {
  it("requires a session", async () => {
    setMockSession(null);
    const res = await POST(jsonRequest("POST", { items: [] }));
    expect(res.status).toBe(401);
  });

  it("adds the guest cart to an empty saved cart", async () => {
    const { status, body } = await readResponse<CartLine[]>(
      await POST(
        jsonRequest("POST", {
          items: [
            { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
            { productId: "mug", quantity: 1 },
          ],
        })
      )
    );

    expect(status).toBe(200);
    expect(body).toHaveLength(2);
    expect(storedItems()).toEqual([
      { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
      { productId: "mug", quantity: 1 },
    ]);
  });

  it("sums quantities for the same size and keeps other sizes separate", async () => {
    testDb.seed("carts", [
      {
        userId: BUYER,
        items: [
          { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
          { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
        ],
      },
    ]);

    await POST(
      jsonRequest("POST", {
        items: [{ productId: "runner", quantity: 2, variantSku: "runner-eu42-black" }],
      })
    );

    expect(storedItems()).toEqual([
      { productId: "runner", quantity: 3, variantSku: "runner-eu42-black" },
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
    ]);
  });

  it("clamps the merged quantity to that size's stock", async () => {
    testDb.seed("carts", [
      {
        userId: BUYER,
        items: [{ productId: "runner", quantity: 2, variantSku: "runner-eu42-black" }],
      },
    ]);

    // 2 saved + 3 guest = 5, but EU 42 Black stocks 3.
    await POST(
      jsonRequest("POST", {
        items: [{ productId: "runner", quantity: 3, variantSku: "runner-eu42-black" }],
      })
    );

    expect(storedItems()[0].quantity).toBe(3);
  });

  it("drops a line whose variant no longer exists", async () => {
    await POST(
      jsonRequest("POST", {
        items: [
          { productId: "runner", quantity: 1, variantSku: "discontinued" },
          { productId: "mug", quantity: 1 },
        ],
      })
    );

    expect(storedItems()).toEqual([{ productId: "mug", quantity: 1 }]);
  });

  it("drops a guest line with no size on a product that now sells by size", async () => {
    // A cart saved in localStorage before the product gained variants.
    await POST(
      jsonRequest("POST", { items: [{ productId: "runner", quantity: 1 }] })
    );

    expect(storedItems()).toEqual([]);
  });

  it("drops sold-out and unknown products", async () => {
    await POST(
      jsonRequest("POST", {
        items: [
          { productId: "pins", quantity: 1 },
          { productId: "ghost", quantity: 1 },
          { productId: "mug", quantity: 1 },
        ],
      })
    );

    expect(storedItems()).toEqual([{ productId: "mug", quantity: 1 }]);
  });

  it("rejects a payload over the line-item cap or with bad quantities", async () => {
    const tooMany = Array.from({ length: 26 }, (_, i) => ({
      productId: `p${i}`,
      quantity: 1,
    }));
    expect((await POST(jsonRequest("POST", { items: tooMany }))).status).toBe(400);

    expect(
      (
        await POST(
          jsonRequest("POST", {
            items: [{ productId: "mug", quantity: MAX_CART_QUANTITY + 1 }],
          })
        )
      ).status
    ).toBe(400);
  });

  it("rejects a SKU containing a metadata separator", async () => {
    const res = await POST(
      jsonRequest("POST", {
        items: [{ productId: "runner", quantity: 1, variantSku: "runner|eu42" }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("is rate limited", async () => {
    const send = () =>
      POST(jsonRequest("POST", { items: [{ productId: "mug", quantity: 1 }] }));

    // The cartMerge budget is 30 per hour from one IP.
    for (let i = 0; i < 30; i++) {
      expect((await send()).status).toBe(200);
    }

    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});
