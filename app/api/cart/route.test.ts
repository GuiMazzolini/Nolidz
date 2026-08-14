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

import { DELETE, GET, PATCH, POST } from "@/app/api/cart/route";
import { BUYER, catalog, mugProduct } from "@/app/test/fixtures";
import { jsonRequest, malformedRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import { setMockSession } from "@/app/test/session";
import type { CartItemDoc } from "@/app/lib/db-collections";

type CartLine = {
  id: string;
  name: string;
  quantity: number;
  stock: number;
  variantSku?: string;
  variantSize?: string;
  variantColor?: string;
};

function storedItems(): CartItemDoc[] {
  return (testDb.all("carts")[0]?.items as CartItemDoc[]) ?? [];
}

function seedCart(items: CartItemDoc[]) {
  testDb.seed("carts", [{ userId: BUYER, items }]);
}

beforeEach(() => {
  testDb.reset();
  testDb.seed("products", catalog);
  setMockSession(BUYER);
});

describe("cart API authentication", () => {
  it("refuses every method without a session", async () => {
    setMockSession(null);

    const responses = await Promise.all([
      GET(),
      POST(jsonRequest("POST", { productId: "mug" })),
      PATCH(jsonRequest("PATCH", { productId: "mug", quantity: 1 })),
      DELETE(jsonRequest("DELETE", { productId: "mug" })),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
    expect(testDb.all("carts")).toHaveLength(0);
  });
});

describe("POST /api/cart", () => {
  it("adds a variant line carrying its size and colour", async () => {
    const { status, body } = await readResponse<CartLine[]>(
      await POST(
        jsonRequest("POST", { productId: "runner", variantSku: "runner-eu42-black" })
      )
    );

    expect(status).toBe(201);
    expect(body).toEqual([
      expect.objectContaining({
        id: "runner",
        quantity: 1,
        stock: 3,
        variantSku: "runner-eu42-black",
        variantSize: "42",
        variantColor: "Black",
      }),
    ]);
    expect(storedItems()).toEqual([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
    ]);
  });

  it("keeps two sizes of the same product as separate lines", async () => {
    await POST(jsonRequest("POST", { productId: "runner", variantSku: "runner-eu42-black" }));
    const { body } = await readResponse<CartLine[]>(
      await POST(
        jsonRequest("POST", { productId: "runner", variantSku: "runner-eu42-white" })
      )
    );

    expect(body).toHaveLength(2);
    expect(body.map((line) => line.variantSku)).toEqual([
      "runner-eu42-black",
      "runner-eu42-white",
    ]);
    expect(body.every((line) => line.quantity === 1)).toBe(true);
  });

  it("increments the matching line rather than appending a duplicate", async () => {
    await POST(jsonRequest("POST", { productId: "runner", variantSku: "runner-eu42-black" }));
    const { body } = await readResponse<CartLine[]>(
      await POST(
        jsonRequest("POST", { productId: "runner", variantSku: "runner-eu42-black" })
      )
    );

    expect(body).toHaveLength(1);
    expect(body[0].quantity).toBe(2);
  });

  it("stops at the stock of that one size, not the product total", async () => {
    // EU 42 Black holds 3 of the product's 9 units.
    seedCart([{ productId: "runner", quantity: 3, variantSku: "runner-eu42-black" }]);

    const { status, body } = await readResponse<{ error: string }>(
      await POST(
        jsonRequest("POST", { productId: "runner", variantSku: "runner-eu42-black" })
      )
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Only 3 in stock");
  });

  it("rejects a variant product with no size chosen", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST", { productId: "runner" }))
    );

    expect(status).toBe(400);
    expect(body.error).toBe("Choose a size and colour");
    expect(testDb.all("carts")).toHaveLength(0);
  });

  it("rejects a SKU that does not belong to the product", async () => {
    const { status } = await readResponse(
      await POST(jsonRequest("POST", { productId: "runner", variantSku: "not-a-real-sku" }))
    );
    expect(status).toBe(400);
  });

  it("adds a single-SKU product with no variant fields", async () => {
    const { status, body } = await readResponse<CartLine[]>(
      await POST(jsonRequest("POST", { productId: "mug" }))
    );

    expect(status).toBe(201);
    expect(body[0]).not.toHaveProperty("variantSku");
    expect(storedItems()).toEqual([{ productId: "mug", quantity: 1 }]);
  });

  it("404s an unknown product and 409s a sold-out one", async () => {
    expect((await POST(jsonRequest("POST", { productId: "ghost" }))).status).toBe(404);
    expect((await POST(jsonRequest("POST", { productId: "pins" }))).status).toBe(409);
  });

  it("rejects a Mongo operator smuggled in as a product id", async () => {
    const { status } = await readResponse(
      await POST(jsonRequest("POST", { productId: { $ne: null } }))
    );
    expect(status).toBe(400);
  });

  it("rejects a malformed body", async () => {
    expect((await POST(malformedRequest())).status).toBe(400);
  });
});

describe("PATCH /api/cart", () => {
  beforeEach(() => {
    seedCart([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
      { productId: "mug", quantity: 1 },
    ]);
  });

  it("updates only the size named in the request", async () => {
    const { body } = await readResponse<CartLine[]>(
      await PATCH(
        jsonRequest("PATCH", {
          productId: "runner",
          variantSku: "runner-eu42-white",
          quantity: 4,
        })
      )
    );

    const byLine = Object.fromEntries(
      body.map((line) => [line.variantSku ?? line.id, line.quantity])
    );
    expect(byLine).toEqual({
      "runner-eu42-black": 1,
      "runner-eu42-white": 4,
      mug: 1,
    });
  });

  it("removes only the matching line at quantity 0", async () => {
    const { body } = await readResponse<CartLine[]>(
      await PATCH(
        jsonRequest("PATCH", {
          productId: "runner",
          variantSku: "runner-eu42-black",
          quantity: 0,
        })
      )
    );

    expect(body.map((line) => line.variantSku ?? line.id)).toEqual([
      "runner-eu42-white",
      "mug",
    ]);
  });

  it("removes the single-SKU line without touching the variant lines", async () => {
    // The bare product id must not match the variant lines of another product.
    const { body } = await readResponse<CartLine[]>(
      await PATCH(jsonRequest("PATCH", { productId: "mug", quantity: 0 }))
    );

    expect(body).toHaveLength(2);
    expect(body.every((line) => line.id === "runner")).toBe(true);
  });

  it("refuses a quantity above that size's stock", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await PATCH(
        jsonRequest("PATCH", {
          productId: "runner",
          variantSku: "runner-eu42-black",
          quantity: 5,
        })
      )
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Only 3 in stock");
    expect(storedItems().find((i) => i.variantSku === "runner-eu42-black")?.quantity).toBe(1);
  });

  it("refuses a size that is sold out", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await PATCH(
        jsonRequest("PATCH", {
          productId: "runner",
          variantSku: "runner-eu43-black",
          quantity: 1,
        })
      )
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Out of stock");
  });

  it("404s a line that is not in the cart", async () => {
    const { status } = await readResponse(
      await PATCH(
        jsonRequest("PATCH", {
          productId: "runner",
          variantSku: "runner-eu42-black",
          quantity: 0,
        })
      )
    );
    expect(status).toBe(200);

    setMockSession("other@example.com");
    const missing = await readResponse(
      await PATCH(jsonRequest("PATCH", { productId: "mug", quantity: 2 }))
    );
    expect(missing.status).toBe(404);
  });

  it("rejects quantities outside the allowed range", async () => {
    for (const quantity of [-1, 1.5, 100]) {
      const res = await PATCH(
        jsonRequest("PATCH", { productId: "mug", quantity })
      );
      expect(res.status).toBe(400);
    }
  });
});

describe("DELETE /api/cart", () => {
  it("deletes one size and leaves the rest of the cart intact", async () => {
    seedCart([
      { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
    ]);

    const { status, body } = await readResponse<CartLine[]>(
      await DELETE(
        jsonRequest("DELETE", {
          productId: "runner",
          variantSku: "runner-eu42-black",
        })
      )
    );

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].variantSku).toBe("runner-eu42-white");
  });
});

describe("GET /api/cart", () => {
  it("prices each line against its own variant stock", async () => {
    seedCart([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
      { productId: "mug", quantity: 2 },
    ]);

    const { body } = await readResponse<CartLine[]>(await GET());

    expect(body).toEqual([
      expect.objectContaining({ variantSku: "runner-eu42-white", stock: 6 }),
      expect.objectContaining({ id: "mug", stock: 2 }),
    ]);
  });

  it("drops a line whose variant no longer exists in the catalog", async () => {
    seedCart([
      { productId: "runner", quantity: 1, variantSku: "discontinued-sku" },
      { productId: "mug", quantity: 1 },
    ]);

    const { body } = await readResponse<CartLine[]>(await GET());

    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("mug");
  });

  it("drops a line whose product was deleted", async () => {
    seedCart([{ productId: "gone", quantity: 1 }]);
    const { body } = await readResponse<CartLine[]>(await GET());
    expect(body).toEqual([]);
  });

  it("returns an empty cart for a user who has none", async () => {
    const { status, body } = await readResponse<CartLine[]>(await GET());
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it("never returns another user's cart", async () => {
    seedCart([{ productId: "mug", quantity: 1 }]);
    setMockSession("someone-else@example.com");

    const { body } = await readResponse<CartLine[]>(await GET());
    expect(body).toEqual([]);
    expect(mugProduct.stock).toBe(2);
  });
});
